import React, { useState, useMemo } from "react";
import { Mission, TrajectoryData } from "../types";
import { simulateAscentTrajectory } from "../lib/physics";
import { FlightPathCanvas, TrajectoryComparisonOverlay } from "./FlightPathCanvas";
import { LiveTelemetryMonitor } from "./LiveTelemetryMonitor";
import { SensitivityHeatmap } from "./SensitivityHeatmap";
import { StabilityMap } from "./StabilityMap";
import { CompareTrajectoriesToolbar } from "./CompareTrajectoriesToolbar";
import {
  ArrowRight,
  Activity,
  Gauge,
  Flame,
  Compass,
  Sliders,
  Layers,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  GitCompare,
} from "lucide-react";

interface TrajectorySimulationViewProps {
  mission: Mission;
  onProceedToClassical: () => void;
  onProceedToSensitivity?: () => void;
}

const DEVIATION_PRESETS = [-5, -2.5, 0, 2.5, 5];

export const TrajectorySimulationView: React.FC<TrajectorySimulationViewProps> = ({
  mission,
  onProceedToClassical,
  onProceedToSensitivity,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<"alt_vel" | "fuel_mass" | "accel_drag">("alt_vel");
  const [scrubberIdx, setScrubberIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Launch Angle Sensitivity & Propellant Mass State
  const [activeAngleDeviation, setActiveAngleDeviation] = useState<number>(0);
  const [fuelDeltaPct, setFuelDeltaPct] = useState<number>(0);
  const [showStabilityEnvelope, setShowStabilityEnvelope] = useState<boolean>(true);
  const [showStabilityMap, setShowStabilityMap] = useState<boolean>(true);
  const [comparisonOverlay, setComparisonOverlay] = useState<TrajectoryComparisonOverlay | null>(null);

  // Active mission with optional fuel mass scaling
  const activeMission: Mission = useMemo(() => {
    if (fuelDeltaPct === 0) return mission;
    const mult = 1 + fuelDeltaPct / 100;
    return {
      ...mission,
      fuel_consumption: mission.fuel_consumption * mult,
      fuel_mass: mission.fuel_mass * mult,
    };
  }, [mission, fuelDeltaPct]);

  // Nominal / active trajectory
  const trajData: TrajectoryData = useMemo(() => {
    return simulateAscentTrajectory(activeMission, 2.0, undefined, activeAngleDeviation);
  }, [activeMission, activeAngleDeviation]);

  // Stability envelope trajectories across ±5°
  const envelopeTrajectories = useMemo(() => {
    return DEVIATION_PRESETS.map((deg) => {
      const data = simulateAscentTrajectory(mission, 2.0, undefined, deg);
      const finalAlt = data.altitude_km[data.altitude_km.length - 1] || 0;
      const targetAlt = mission.altitude;
      const altDelta = Number((finalAlt - targetAlt).toFixed(1));
      return {
        deg,
        label: deg === 0 ? "Nominal (0°)" : deg > 0 ? `+${deg}° (Steeper)` : `${deg}° (Shallower)`,
        color: deg === 0 ? "#06b6d4" : deg === -5 ? "#f59e0b" : deg === -2.5 ? "#fb923c" : deg === 2.5 ? "#14b8a6" : "#a855f7",
        dashArray: deg === 0 ? "none" : deg === -5 || deg === 5 ? "6 3" : "4 2",
        data,
        finalAlt,
        altDelta,
        maxQ: data.summary.max_dynamic_pressure_kPa,
        finalVelocity: data.summary.final_velocity_ms,
      };
    });
  }, [mission]);

  const nPoints = trajData.time.length;
  const currentIdx = Math.min(scrubberIdx, nPoints - 1);

  // Global max altitude across envelope and active deviation for proper scaling
  const maxEnvelopeAlt = useMemo(() => {
    const envMax = Math.max(...envelopeTrajectories.map((e) => e.data.summary.max_altitude_km));
    const activeMax = trajData.summary.max_altitude_km;
    return Math.max(envMax, activeMax, mission.altitude * 1.2, 1);
  }, [envelopeTrajectories, trajData, mission]);

  // Current active angle stability status
  const currentStabilityStatus = useMemo(() => {
    const finalAlt = trajData.altitude_km[trajData.altitude_km.length - 1] || 0;
    const deltaAlt = finalAlt - mission.altitude;
    const absDelta = Math.abs(deltaAlt);
    if (absDelta <= 15) {
      return {
        label: "OPTIMAL INSERTION CORRIDOR",
        badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
        description: "Trajectory remains tightly within nominal orbit insertion margins.",
      };
    } else if (absDelta <= 45) {
      return {
        label: "BOUNDED FLIGHT DISPERSION",
        badgeColor: "bg-cyan-950/80 text-cyan-300 border-cyan-800/80",
        description: "Flight corridor exhibits minor altitude deviation correctable via circularization burn.",
      };
    } else {
      return {
        label: "HIGH DISPERSION ADVISORY",
        badgeColor: "bg-amber-950/80 text-amber-300 border-amber-800/80",
        description: "Significant apogee offset; requires elevated orbital correction propellant delta-v.",
      };
    }
  }, [trajData, mission]);

  // Flight milestone events
  const milestones = useMemo(() => {
    const maxQIdx = trajData.dynamic_pressure_kPa.indexOf(trajData.summary.max_dynamic_pressure_kPa);
    return [
      { name: "Liftoff & Main Engine Ignition", time: 0, alt: 0, icon: "🔥" },
      { name: "Gravity Turn Pitchover", time: 12, alt: 1.2, icon: "🧭" },
      {
        name: `Max-Q (${trajData.summary.max_dynamic_pressure_kPa} kPa)`,
        time: trajData.time[maxQIdx] || 60,
        alt: trajData.altitude_km[maxQIdx] || 11.5,
        icon: "⚡",
      },
      {
        name: "Stage Burnout & MECO",
        time: trajData.summary.burn_time_sec,
        alt: trajData.altitude_km[Math.min(Math.floor(trajData.summary.burn_time_sec / 2), nPoints - 1)] || 180,
        icon: "🚀",
      },
      {
        name: `Orbital Injection (${mission.target_orbit})`,
        time: trajData.time[nPoints - 1],
        alt: trajData.altitude_km[nPoints - 1],
        icon: "🎯",
      },
    ];
  }, [trajData, mission, nPoints]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-mono text-cyan-400">Page 3 — 4th-Order Runge-Kutta Trajectory Simulation</div>
          <div className="text-xl font-bold text-white mt-0.5">
            Ascent Dynamics: {mission.rocket} · {mission.trajectory_type}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Simulated Burn Time: {trajData.summary.burn_time_sec} s · Max Altitude: {trajData.summary.max_altitude_km.toFixed(1)} km · Final Velocity: {trajData.summary.final_velocity_ms.toLocaleString()} m/s
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* STABILITY MAP TOGGLE BUTTON */}
          <button
            onClick={() => setShowStabilityMap(!showStabilityMap)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              showStabilityMap
                ? "bg-emerald-950 text-emerald-300 border-emerald-700 shadow-sm shadow-emerald-500/20"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="Toggle Weather-Constrained Launch Stability Map"
          >
            {showStabilityMap ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Stability Map: ON</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Stability Map: OFF</span>
              </>
            )}
          </button>

          {onProceedToSensitivity && (
            <button
              onClick={onProceedToSensitivity}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-950 border border-cyan-800/80 text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Open D3 Trajectory Parameter Sensitivity Analysis"
            >
              <span>Sensitivity Analysis</span>
            </button>
          )}

          <button
            onClick={onProceedToClassical}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
          >
            <span>Run Classical Optimization</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Max Altitude Reached</div>
          <div className="text-2xl font-mono font-bold text-cyan-400 mt-1 tabular-nums">
            {trajData.summary.max_altitude_km.toFixed(1)} <span className="text-xs text-slate-500 font-sans">km</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Target Orbit: {mission.target_orbit}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Final Velocity Magnitude</div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {trajData.summary.final_velocity_ms.toFixed(0)} <span className="text-xs text-slate-500 font-sans">m/s</span>
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-mono">
            Δv Required: {mission.delta_v} km/s
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Peak G-Force Load</div>
          <div className="text-2xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
            {trajData.summary.max_acceleration_g.toFixed(2)} <span className="text-xs text-slate-500 font-sans">g</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Structural Limit: 6.0 g</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Max Dynamic Pressure (Max-Q)</div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {trajData.summary.max_dynamic_pressure_kPa.toFixed(2)} <span className="text-xs text-slate-500 font-sans">kPa</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">Atmospheric drag peak</div>
        </div>
      </div>

      {/* CANVAS FLIGHT PATH ANIMATION */}
      <FlightPathCanvas
        mission={mission}
        trajectory={trajData}
        currentIndex={currentIdx}
        onIndexChange={(idx) => setScrubberIdx(idx)}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={(spd) => setPlaybackSpeed(spd)}
        envelopeTrajectories={envelopeTrajectories}
        showEnvelope={showStabilityEnvelope}
        comparisonOverlay={comparisonOverlay || undefined}
      />

      {/* COMPARE TRAJECTORIES OVERLAY TOOLBAR */}
      <CompareTrajectoriesToolbar
        currentMission={activeMission}
        activeAngleDeviation={activeAngleDeviation}
        fuelDeltaPct={fuelDeltaPct}
        onComparisonChange={setComparisonOverlay}
      />

      {/* LAUNCH ANGLE SENSITIVITY & STABILITY ENVELOPE (±5°) OVERLAY TOOL */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/30 border border-indigo-900/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Launch Angle Sensitivity &amp; Stability Overlay (±5° Deviation)</span>
                {activeAngleDeviation !== 0 && (
                  <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Active Deviation: {activeAngleDeviation > 0 ? `+${activeAngleDeviation}°` : `${activeAngleDeviation}°`}
                  </span>
                )}
                {fuelDeltaPct !== 0 && (
                  <span className="text-[11px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                    Fuel Delta: {fuelDeltaPct > 0 ? `+${fuelDeltaPct}%` : `${fuelDeltaPct}%`}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-sans">
                Evaluates flight corridor stability and orbital insertion altitude dispersion under angular perturbations
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStabilityMap(!showStabilityMap)}
              className={`px-3 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                showStabilityMap
                  ? "bg-emerald-950 text-emerald-300 border-emerald-700/80"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>{showStabilityMap ? "Hide Stability Map" : "Show Stability Map"}</span>
            </button>
            <button
              onClick={() => setShowStabilityEnvelope(!showStabilityEnvelope)}
              className={`px-3 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                showStabilityEnvelope
                  ? "bg-indigo-950 text-indigo-300 border-indigo-700/80"
                  : "bg-slate-950 text-slate-400 border-slate-800"
              }`}
            >
              {showStabilityEnvelope ? "Hide Envelope Overlay" : "Show Full ±5° Envelope"}
            </button>
            {(activeAngleDeviation !== 0 || fuelDeltaPct !== 0) && (
              <button
                onClick={() => {
                  setActiveAngleDeviation(0);
                  setFuelDeltaPct(0);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Baseline</span>
              </button>
            )}
          </div>
        </div>

        {/* Preset Angle Buttons & Interactive Range Slider Controls */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800/80">
              {DEVIATION_PRESETS.map((deg) => {
                const isActive = activeAngleDeviation === deg;
                const label = deg === 0 ? "Nominal (0°)" : deg > 0 ? `+${deg}°` : `${deg}°`;
                return (
                  <button
                    key={deg}
                    onClick={() => setActiveAngleDeviation(deg)}
                    className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                      isActive
                        ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/25"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Fine Nudge Controls */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80 text-xs font-mono">
              <button
                onClick={() => setActiveAngleDeviation((prev) => Math.max(-5.0, Number((prev - 1.0).toFixed(1))))}
                className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Decrease 1.0°"
              >
                -1.0°
              </button>
              <button
                onClick={() => setActiveAngleDeviation((prev) => Math.max(-5.0, Number((prev - 0.1).toFixed(1))))}
                className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Decrease 0.1°"
              >
                -0.1°
              </button>
              <button
                onClick={() => setActiveAngleDeviation(0)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  activeAngleDeviation === 0
                    ? "text-cyan-400 font-bold"
                    : "text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
                }`}
                title="Reset to 0.0° Nominal"
              >
                0.0°
              </button>
              <button
                onClick={() => setActiveAngleDeviation((prev) => Math.min(5.0, Number((prev + 0.1).toFixed(1))))}
                className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Increase 0.1°"
              >
                +0.1°
              </button>
              <button
                onClick={() => setActiveAngleDeviation((prev) => Math.min(5.0, Number((prev + 1.0).toFixed(1))))}
                className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Increase 1.0°"
              >
                +1.0°
              </button>
            </div>
          </div>

          {/* Interactive Continuous Range Slider */}
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-amber-400 font-semibold">-5.0° (Shallower Pitch)</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Launch Angle Deviation:</span>
                <span className="text-sm text-cyan-300 font-bold tabular-nums">
                  {activeAngleDeviation > 0 ? `+${activeAngleDeviation.toFixed(1)}°` : `${activeAngleDeviation.toFixed(1)}°`}
                </span>
                <span className="text-slate-500 font-sans text-[11px]">
                  (Pitchover Angle: {(89.8 + activeAngleDeviation * 0.25).toFixed(2)}°)
                </span>
              </div>
              <span className="text-purple-400 font-semibold">+5.0° (Steeper Pitch)</span>
            </div>

            <div className="relative pt-1 pb-1">
              <input
                type="range"
                min={-5.0}
                max={5.0}
                step={0.1}
                value={activeAngleDeviation}
                onChange={(e) => setActiveAngleDeviation(Number(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-2.5 rounded-lg cursor-pointer transition-all"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5 mt-1">
                <span>-5°</span>
                <span>-2.5°</span>
                <span className="text-cyan-400 font-bold">0° (Nominal)</span>
                <span>+2.5°</span>
                <span>+5°</span>
              </div>
            </div>

            {/* Real-time Dynamic Simulation Results Feedback HUD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-slate-800/70 text-xs font-mono">
              <div className="p-2 bg-slate-900/60 rounded border border-slate-800/70">
                <span className="text-[10px] uppercase text-slate-400 block">Achieved Apogee</span>
                <div className="text-sm font-bold text-white mt-0.5 tabular-nums">
                  {trajData.summary.max_altitude_km.toFixed(1)} <span className="text-[10px] text-slate-500 font-sans">km</span>
                </div>
                <div className={`text-[10px] mt-0.5 tabular-nums ${
                  trajData.summary.max_altitude_km >= mission.altitude ? "text-cyan-400" : "text-amber-400"
                }`}>
                  {(trajData.summary.max_altitude_km - mission.altitude) >= 0 ? "+" : ""}
                  {(trajData.summary.max_altitude_km - mission.altitude).toFixed(1)} km vs target
                </div>
              </div>

              <div className="p-2 bg-slate-900/60 rounded border border-slate-800/70">
                <span className="text-[10px] uppercase text-slate-400 block">Final Velocity</span>
                <div className="text-sm font-bold text-emerald-400 mt-0.5 tabular-nums">
                  {trajData.summary.final_velocity_ms.toFixed(0)} <span className="text-[10px] text-slate-500 font-sans">m/s</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Δv: {mission.delta_v} km/s
                </div>
              </div>

              <div className="p-2 bg-slate-900/60 rounded border border-slate-800/70">
                <span className="text-[10px] uppercase text-slate-400 block">Peak Dynamic Pressure</span>
                <div className="text-sm font-bold text-amber-400 mt-0.5 tabular-nums">
                  {trajData.summary.max_dynamic_pressure_kPa.toFixed(2)} <span className="text-[10px] text-slate-500 font-sans">kPa</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Max-Q stress load
                </div>
              </div>

              <div className="p-2 bg-slate-900/60 rounded border border-slate-800/70">
                <span className="text-[10px] uppercase text-slate-400 block">Stability Corridor</span>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mt-1 ${currentStabilityStatus.badgeColor}`}>
                  {currentStabilityStatus.label}
                </span>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={currentStabilityStatus.description}>
                  {currentStabilityStatus.description}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stability Envelope Trajectory Altitude Overlay Chart */}
        <div className="h-64 w-full bg-slate-950/80 rounded-lg border border-slate-800/80 p-2 relative flex flex-col justify-end">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 200" preserveAspectRatio="none">
            {/* Horizontal Grid lines */}
            <line x1="0" y1="50" x2="1000" y2="50" stroke="#1e293b" strokeDasharray="4 4" />
            <line x1="0" y1="100" x2="1000" y2="100" stroke="#1e293b" strokeDasharray="4 4" />
            <line x1="0" y1="150" x2="1000" y2="150" stroke="#1e293b" strokeDasharray="4 4" />

            {/* Target Orbit Line (Horizontal Dashed White) */}
            {(() => {
              const targetY = 190 - (mission.altitude / maxEnvelopeAlt) * 170;
              return (
                <>
                  <line x1="0" y1={targetY} x2="1000" y2={targetY} stroke="#94a3b8" strokeDasharray="2 2" strokeWidth="1" />
                  <text x="980" y={targetY - 5} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                    Target Orbit ({mission.altitude} km)
                  </text>
                </>
              );
            })()}

            {/* Envelope Trajectory Curves */}
            {envelopeTrajectories.map((env) => {
              const isSelected = activeAngleDeviation === env.deg;
              if (!showStabilityEnvelope && !isSelected && env.deg !== 0) return null;

              const points = env.data.altitude_km;
              const pathD = points
                .map((val, idx) => {
                  const x = (idx / (points.length - 1)) * 1000;
                  const y = 190 - (val / maxEnvelopeAlt) * 170;
                  return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ");

              return (
                <path
                  key={env.deg}
                  d={pathD}
                  fill="none"
                  stroke={env.color}
                  strokeWidth={isSelected ? 3 : env.deg === 0 ? 2.5 : 1.5}
                  strokeDasharray={env.dashArray}
                  opacity={isSelected ? 1 : env.deg === 0 ? 0.9 : 0.6}
                />
              );
            })}

            {/* Dynamic Active Deviation Curve for intermediate slider values */}
            {!DEVIATION_PRESETS.includes(activeAngleDeviation) && (
              <path
                d={trajData.altitude_km
                  .map((val, idx) => {
                    const x = (idx / (trajData.altitude_km.length - 1)) * 1000;
                    const y = 190 - (val / maxEnvelopeAlt) * 170;
                    return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={3}
                strokeDasharray="4 2"
                opacity={1}
              />
            )}

            {/* Scrubber vertical line */}
            <line
              x1={(currentIdx / (nPoints - 1)) * 1000}
              y1="0"
              x2={(currentIdx / (nPoints - 1)) * 1000}
              y2="200"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>

          {/* Overlay Legend */}
          <div className="absolute top-2 left-3 flex flex-wrap items-center gap-3 text-[11px] font-mono bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
            {envelopeTrajectories.map((env) => (
              <span key={env.deg} className="flex items-center gap-1.5" style={{ color: env.color }}>
                <span className="w-2.5 h-1 rounded" style={{ backgroundColor: env.color }} />
                <span>{env.label}</span>
              </span>
            ))}
            {!DEVIATION_PRESETS.includes(activeAngleDeviation) && (
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                <span className="w-2.5 h-1 rounded bg-cyan-400" />
                <span>Active ({activeAngleDeviation > 0 ? `+${activeAngleDeviation}°` : `${activeAngleDeviation}°`})</span>
              </span>
            )}
          </div>
        </div>

        {/* Stability Dispersion Analysis Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono tabular-nums pt-1">
          {envelopeTrajectories.map((env) => {
            const isSelected = activeAngleDeviation === env.deg;
            return (
              <div
                key={env.deg}
                onClick={() => setActiveAngleDeviation(env.deg)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 border-cyan-500 shadow-sm shadow-cyan-500/20"
                    : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{env.label}</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: env.color }} />
                </div>
                <div className="text-base font-bold mt-1 text-slate-200">
                  {env.finalAlt.toFixed(1)} km
                </div>
                <div className={`text-[11px] mt-0.5 ${env.altDelta >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                  {env.altDelta >= 0 ? `+${env.altDelta}` : env.altDelta} km vs target
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Max-Q: {env.maxQ.toFixed(1)} kPa
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WEATHER-CONSTRAINED LAUNCH PARAMETER STABILITY MAP */}
      {showStabilityMap && (
        <StabilityMap
          mission={mission}
          activeAngleDeviation={activeAngleDeviation}
          onSelectAngleDeviation={(deg) => setActiveAngleDeviation(deg)}
        />
      )}

      {/* DUAL-VARIABLE SENSITIVITY ANALYSIS HEATMAP (LAUNCH ANGLE × FUEL MASS) */}
      <SensitivityHeatmap
        mission={mission}
        currentAngleDeviation={activeAngleDeviation}
        onApplyScenario={({ angleDeg, fuelDeltaPct: newFuelPct }) => {
          setActiveAngleDeviation(angleDeg);
          setFuelDeltaPct(newFuelPct);
        }}
      />

      {/* Standard Telemetry View & Interactive Scrubber */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setSelectedMetric("alt_vel")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedMetric === "alt_vel" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Altitude &amp; Velocity
            </button>
            <button
              onClick={() => setSelectedMetric("fuel_mass")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedMetric === "fuel_mass" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Mass &amp; Propellant Depletion
            </button>
            <button
              onClick={() => setSelectedMetric("accel_drag")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedMetric === "accel_drag" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Acceleration &amp; Aerodynamic Drag
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>T+ {trajData.time[currentIdx]} s</span>
            <span>·</span>
            <span>Alt: {trajData.altitude_km[currentIdx]} km</span>
            <span>·</span>
            <span>Vel: {trajData.velocity_ms[currentIdx]} m/s</span>
            <span>·</span>
            <span>Accel: {trajData.accel_g[currentIdx]} g</span>
          </div>
        </div>

        {/* SVG Time-Series Chart */}
        <div className="h-64 w-full bg-slate-950/80 rounded-lg border border-slate-800/80 p-2 relative flex flex-col justify-end">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 200" preserveAspectRatio="none">
            {/* Grid Lines */}
            <line x1="0" y1="50" x2="1000" y2="50" stroke="#1e293b" strokeDasharray="4 4" />
            <line x1="0" y1="100" x2="1000" y2="100" stroke="#1e293b" strokeDasharray="4 4" />
            <line x1="0" y1="150" x2="1000" y2="150" stroke="#1e293b" strokeDasharray="4 4" />

            {selectedMetric === "alt_vel" && (
              <>
                {/* Altitude Curve (Cyan) */}
                <path
                  d={trajData.altitude_km
                    .map((val, idx) => {
                      const x = (idx / (nPoints - 1)) * 1000;
                      const maxA = trajData.summary.max_altitude_km || 1;
                      const y = 190 - (val / maxA) * 170;
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                />
                {/* Velocity Curve (Yellow/Amber) */}
                <path
                  d={trajData.velocity_ms
                    .map((val, idx) => {
                      const x = (idx / (nPoints - 1)) * 1000;
                      const maxV = trajData.summary.final_velocity_ms || 1;
                      const y = 190 - (val / maxV) * 170;
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />
              </>
            )}

            {selectedMetric === "fuel_mass" && (
              <>
                {/* Fuel Remaining Curve (Blue) */}
                <path
                  d={trajData.fuel_remaining_kg
                    .map((val, idx) => {
                      const x = (idx / (nPoints - 1)) * 1000;
                      const maxF = trajData.fuel_remaining_kg[0] || 1;
                      const y = 190 - (val / maxF) * 170;
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                />
                {/* Total Mass Curve (Purple) */}
                <path
                  d={trajData.mass_kg
                    .map((val, idx) => {
                      const x = (idx / (nPoints - 1)) * 1000;
                      const maxM = trajData.mass_kg[0] || 1;
                      const y = 190 - (val / maxM) * 170;
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="2"
                />
              </>
            )}

            {selectedMetric === "accel_drag" && (
              <>
                {/* Acceleration G-load (Rose) */}
                <path
                  d={trajData.accel_g
                    .map((val, idx) => {
                      const x = (idx / (nPoints - 1)) * 1000;
                      const maxG = trajData.summary.max_acceleration_g || 1;
                      const y = 190 - (val / maxG) * 170;
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                />
                {/* Drag Force (Emerald) */}
                <path
                  d={trajData.drag_kN
                    .map((val, idx) => {
                      const x = (idx / (nPoints - 1)) * 1000;
                      const maxD = Math.max(...trajData.drag_kN, 1);
                      const y = 190 - (val / maxD) * 170;
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                />
              </>
            )}

            {/* Scrubber vertical line */}
            <line
              x1={(currentIdx / (nPoints - 1)) * 1000}
              y1="0"
              x2={(currentIdx / (nPoints - 1)) * 1000}
              y2="200"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>

          {/* Legend */}
          <div className="absolute top-3 left-4 flex items-center gap-4 text-xs font-mono">
            {selectedMetric === "alt_vel" && (
              <>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm" /> Altitude (km)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-sm" /> Velocity (m/s)
                </span>
              </>
            )}
            {selectedMetric === "fuel_mass" && (
              <>
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2.5 h-2.5 bg-blue-400 rounded-sm" /> Fuel Remaining (kg)
                </span>
                <span className="flex items-center gap-1.5 text-purple-400">
                  <span className="w-2.5 h-2.5 bg-purple-400 rounded-sm" /> Vehicle Mass (kg)
                </span>
              </>
            )}
            {selectedMetric === "accel_drag" && (
              <>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 bg-rose-400 rounded-sm" /> Acceleration (g)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" /> Aerodynamic Drag (kN)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>Liftoff T+0s</span>
            <span>Flight Elapsed Time Scrubber: T+{trajData.time[currentIdx]}s</span>
            <span>Burnout T+{trajData.time[nPoints - 1]}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={nPoints - 1}
            value={currentIdx}
            onChange={(e) => setScrubberIdx(Number(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* REAL-TIME VEHICLE TELEMETRY MONITOR SIMULATION */}
      <LiveTelemetryMonitor
        mission={mission}
        baseAltitudeKm={trajData.altitude_km[currentIdx]}
        baseVelocityMs={trajData.velocity_ms[currentIdx]}
      />

      {/* Flight Milestones Sequence */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Ascent Flight Trajectory Milestones</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {milestones.map((m, i) => (
            <div key={i} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
              <div className="text-lg">{m.icon}</div>
              <div className="text-xs font-semibold text-slate-200">{m.name}</div>
              <div className="text-xs font-mono text-cyan-400">T+{m.time} s</div>
              <div className="text-xs text-slate-500 font-mono">{m.alt.toFixed(1)} km alt</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
