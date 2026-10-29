import React, { useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Rocket,
  Gauge,
  CheckCircle2,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";
import { Mission, TrajectoryData } from "../types";

interface AnimatedTrajectoryProgressProps {
  mission: Mission;
  trajectory: TrajectoryData;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const AnimatedTrajectoryProgress: React.FC<AnimatedTrajectoryProgressProps> = ({
  mission,
  trajectory,
  currentIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
}) => {
  const nPoints = trajectory.time.length;
  const currentIdx = Math.min(Math.max(0, currentIndex), nPoints - 1);
  const progressPct = nPoints > 1 ? (currentIdx / (nPoints - 1)) * 100 : 0;

  // Real-time instantaneous flight telemetry
  const currentTime = trajectory.time[currentIdx] || 0;
  const currentAlt = trajectory.altitude_km[currentIdx] || 0;
  const currentVel = trajectory.velocity_ms[currentIdx] || 0;
  const currentG = trajectory.accel_g[currentIdx] || 1;
  const currentQ = trajectory.dynamic_pressure_kPa[currentIdx] || 0;
  const currentAngle = trajectory.flight_path_angle_deg?.[currentIdx] ?? 90;
  const currentDownrange = trajectory.downrange_km?.[currentIdx] || 0;
  const isEngineFiring = currentTime <= trajectory.summary.burn_time_sec;

  // Max-Q and milestone indices
  const maxQIdx = useMemo(() => {
    return trajectory.dynamic_pressure_kPa.indexOf(trajectory.summary.max_dynamic_pressure_kPa);
  }, [trajectory]);

  const mecoIdx = useMemo(() => {
    const burnTime = trajectory.summary.burn_time_sec;
    const idx = trajectory.time.findIndex((t) => t >= burnTime);
    return idx !== -1 ? idx : Math.floor(nPoints * 0.7);
  }, [trajectory, nPoints]);

  const karmanIdx = useMemo(() => {
    const idx = trajectory.altitude_km.findIndex((a) => a >= 100);
    return idx !== -1 ? idx : Math.floor(nPoints * 0.45);
  }, [trajectory, nPoints]);

  // Compute Real-Time Mission Success Probability
  const successAnalysis = useMemo(() => {
    // 1. Structural Dynamic Pressure Factor (limit ~ 38 kPa)
    const maxQ = trajectory.summary.max_dynamic_pressure_kPa;
    let qSafety = 100;
    if (maxQ > 38) {
      qSafety = Math.max(40, 100 - (maxQ - 38) * 5);
    } else if (maxQ > 32) {
      qSafety = 100 - (maxQ - 32) * 2;
    }

    // 2. G-Force Factor (limit 6.0 g)
    const maxG = trajectory.summary.max_acceleration_g;
    let gSafety = 100;
    if (maxG > 6.0) {
      gSafety = Math.max(30, 100 - (maxG - 6.0) * 35);
    } else if (maxG > 5.0) {
      gSafety = 100 - (maxG - 5.0) * 10;
    }

    // 3. Target Orbit Altitude Accuracy
    const finalAlt = trajectory.altitude_km[nPoints - 1] || 0;
    const altDelta = Math.abs(finalAlt - mission.altitude);
    let altSafety = 100;
    if (altDelta > 50) {
      altSafety = Math.max(50, 100 - (altDelta - 50) * 1.2);
    } else if (altDelta > 15) {
      altSafety = 100 - (altDelta - 15) * 0.8;
    }

    // 4. Base Weather & Launch Window Factor
    const weatherBase = Math.max(70, 100 - mission.risk_score * 0.4);

    // 5. Dynamic Progress Factor: As milestones are completed, confidence solidifies
    let flightCompletionBonus = 0;
    if (currentIdx > maxQIdx) flightCompletionBonus += 2;
    if (currentIdx > karmanIdx) flightCompletionBonus += 3;
    if (currentIdx > mecoIdx) flightCompletionBonus += 3;

    // Instantaneous Stress Penalty if current telemetry spikes
    let instantStressPenalty = 0;
    if (currentG > 5.5) instantStressPenalty += 10;
    if (currentQ > 35) instantStressPenalty += 8;

    const baseScore =
      qSafety * 0.25 +
      gSafety * 0.25 +
      altSafety * 0.3 +
      weatherBase * 0.2;

    const currentSuccessPct = Math.min(
      99.9,
      Math.max(
        15.0,
        Number((baseScore + flightCompletionBonus - instantStressPenalty).toFixed(1))
      )
    );

    let statusLabel = "NOMINAL INSERTION CORRIDOR";
    let statusTheme = "emerald";
    let statusDesc = "All aerothermal, structural, and orbital velocity vectors within flight margins.";

    if (currentSuccessPct >= 95) {
      statusLabel = "OPTIMAL FLIGHT CORRIDOR";
      statusTheme = "emerald";
      statusDesc = "Exceptional flight stability. Max-Q and G-loads well inside vehicle margins.";
    } else if (currentSuccessPct >= 85) {
      statusLabel = "NOMINAL TRAJECTORY";
      statusTheme = "cyan";
      statusDesc = "Trajectory parameters nominal. Small orbital circularization burn required.";
    } else if (currentSuccessPct >= 70) {
      statusLabel = "MARGINAL STABILITY DISPERSION";
      statusTheme = "amber";
      statusDesc = "Elevated aerodynamic or gravity loss dispersion. Approaching margin boundaries.";
    } else {
      statusLabel = "TRAJECTORY ANOMALY ADVISORY";
      statusTheme = "rose";
      statusDesc = "High dispersion or structural limits exceeded. Orbital insertion at risk.";
    }

    return {
      score: currentSuccessPct,
      label: statusLabel,
      theme: statusTheme,
      desc: statusDesc,
      qSafety: qSafety.toFixed(0),
      gSafety: gSafety.toFixed(0),
      altSafety: altSafety.toFixed(0),
      altDelta: altDelta.toFixed(1),
    };
  }, [trajectory, mission, currentIdx, maxQIdx, karmanIdx, mecoIdx, nPoints, currentG, currentQ]);

  // Current Flight Phase
  const currentPhase = useMemo(() => {
    if (currentIdx === 0) {
      return { id: 1, name: "Pad Readiness & Liftoff", color: "text-cyan-400" };
    } else if (currentIdx <= maxQIdx) {
      return { id: 1, name: "Atmospheric Ascent & Max-Q", color: "text-amber-400" };
    } else if (currentIdx <= karmanIdx) {
      return { id: 2, name: "Gravity Turn & Stratosphere Exit", color: "text-indigo-400" };
    } else if (currentIdx <= mecoIdx) {
      return { id: 3, name: "Exospheric Acceleration to MECO", color: "text-purple-400" };
    } else {
      return { id: 4, name: "Orbital Coast & Insertion", color: "text-emerald-400" };
    }
  }, [currentIdx, maxQIdx, karmanIdx, mecoIdx]);

  // SVG Geometry for Trajectory Curve
  // Width: 800, Height: 200. Padding: 50
  const svgWidth = 800;
  const svgHeight = 200;
  const paddingLeft = 50;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const maxAltPlot = Math.max(
    trajectory.summary.max_altitude_km,
    mission.altitude * 1.15,
    100
  );

  // Generate path points
  const pathCoordinates = useMemo(() => {
    return trajectory.altitude_km.map((alt, idx) => {
      const x = paddingLeft + (idx / (nPoints - 1)) * plotWidth;
      const y = paddingTop + plotHeight - (alt / maxAltPlot) * plotHeight;
      return { x, y };
    });
  }, [trajectory, nPoints, paddingLeft, paddingTop, plotWidth, plotHeight, maxAltPlot]);

  // Current Rocket vehicle coordinates
  const currentCoord = pathCoordinates[currentIdx] || { x: paddingLeft, y: paddingTop + plotHeight };

  // Completed path string up to currentIdx
  const completedPathD = useMemo(() => {
    if (pathCoordinates.length === 0) return "";
    const activeCoords = pathCoordinates.slice(0, currentIdx + 1);
    return activeCoords.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  }, [pathCoordinates, currentIdx]);

  // Full planned path string
  const fullPathD = useMemo(() => {
    if (pathCoordinates.length === 0) return "";
    return pathCoordinates.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  }, [pathCoordinates]);

  // Milestone X positions along the curve
  const milestoneCoords = useMemo(() => {
    return [
      { name: "Liftoff", idx: 0, pt: pathCoordinates[0], label: "T+0s", alt: "0 km" },
      { name: "Max-Q", idx: maxQIdx, pt: pathCoordinates[maxQIdx], label: `T+${trajectory.time[maxQIdx] || 60}s`, alt: `${trajectory.summary.max_dynamic_pressure_kPa.toFixed(1)} kPa` },
      { name: "Kármán (100km)", idx: karmanIdx, pt: pathCoordinates[karmanIdx], label: `T+${trajectory.time[karmanIdx] || 120}s`, alt: "100 km" },
      { name: "MECO", idx: mecoIdx, pt: pathCoordinates[mecoIdx], label: `T+${trajectory.summary.burn_time_sec}s`, alt: "Cutoff" },
      { name: "Target Orbit", idx: nPoints - 1, pt: pathCoordinates[nPoints - 1], label: `T+${trajectory.time[nPoints - 1]}s`, alt: `${mission.altitude} km` },
    ];
  }, [pathCoordinates, maxQIdx, karmanIdx, mecoIdx, nPoints, trajectory, mission]);

  // Target Orbit Reference line Y
  const targetOrbitY = paddingTop + plotHeight - (mission.altitude / maxAltPlot) * plotHeight;
  const karmanY = paddingTop + plotHeight - (100 / maxAltPlot) * plotHeight;

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-[#080d1a] border border-cyan-500/30 shadow-xl space-y-4">
      {/* Top Header: Title, Real-Time Success Probability Meter & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-950 to-indigo-950 border border-cyan-500/40 text-cyan-400 shadow-md shadow-cyan-950/40">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">
                Real-Time Trajectory Ascent &amp; Mission Success Feedback
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-semibold uppercase">
                {currentPhase.name}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>RK4 4th-Order Integration</span>
              <span>·</span>
              <span className="text-cyan-400">T+{currentTime.toFixed(1)} s</span>
              <span>·</span>
              <span>Step {currentIdx + 1} of {nPoints}</span>
            </div>
          </div>
        </div>

        {/* Live Mission Success Confidence Widget */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
          {/* Circular / Arc Gauge representation */}
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                className="stroke-slate-800"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke={
                  successAnalysis.theme === "emerald"
                    ? "#10b981"
                    : successAnalysis.theme === "cyan"
                    ? "#06b6d4"
                    : successAnalysis.theme === "amber"
                    ? "#f59e0b"
                    : "#f43f5e"
                }
                strokeWidth="3"
                strokeDasharray={`${(successAnalysis.score * 94.2) / 100} 94.2`}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-mono font-bold text-white leading-none">
                {successAnalysis.score.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="space-y-0.5 text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                Mission Success Probability
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  successAnalysis.theme === "emerald"
                    ? "bg-emerald-400 animate-pulse"
                    : successAnalysis.theme === "cyan"
                    ? "bg-cyan-400 animate-pulse"
                    : successAnalysis.theme === "amber"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-500 animate-pulse"
                }`}
              />
            </div>
            <div
              className={`text-xs font-mono font-bold tracking-tight ${
                successAnalysis.theme === "emerald"
                  ? "text-emerald-400"
                  : successAnalysis.theme === "cyan"
                  ? "text-cyan-400"
                  : successAnalysis.theme === "amber"
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {successAnalysis.label}
            </div>
            <div className="text-[10px] text-slate-400 font-sans truncate max-w-xs">
              {successAnalysis.desc}
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory Ascent Canvas / SVG Path with Real-Time Vehicle Marker */}
      <div className="relative w-full h-56 bg-slate-950 rounded-xl border border-slate-800/90 overflow-hidden select-none">
        {/* Atmosphere Gradient Background Layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Troposphere / Lower Atmosphere (0 - 15 km) */}
          <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-cyan-950/30 to-transparent" />
          {/* Space Horizon / Thermosphere (>100 km) */}
          <div className="absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-[#030611] to-transparent" />
        </div>

        {/* Flight Trajectory SVG */}
        <svg
          className="w-full h-full"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Gradient for Completed Trajectory */}
            <linearGradient id="trajGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
            </linearGradient>

            {/* Gradient for Altitude Area Fill */}
            <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing filter for Rocket Exhaust */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid Lines */}
          <line x1={paddingLeft} y1={paddingTop + plotHeight * 0.25} x2={svgWidth - paddingRight} y2={paddingTop + plotHeight * 0.25} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={paddingLeft} y1={paddingTop + plotHeight * 0.5} x2={svgWidth - paddingRight} y2={paddingTop + plotHeight * 0.5} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={paddingLeft} y1={paddingTop + plotHeight * 0.75} x2={svgWidth - paddingRight} y2={paddingTop + plotHeight * 0.75} stroke="#1e293b" strokeDasharray="3 3" />

          {/* Target Orbit Threshold Line (Green Dashed) */}
          <line
            x1={paddingLeft}
            y1={targetOrbitY}
            x2={svgWidth - paddingRight}
            y2={targetOrbitY}
            stroke="#10b981"
            strokeDasharray="4 3"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <text
            x={svgWidth - paddingRight - 8}
            y={targetOrbitY - 5}
            fill="#10b981"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="end"
          >
            Target Orbit ({mission.target_orbit} · {mission.altitude} km)
          </text>

          {/* Kármán Line (100 km boundary) */}
          <line
            x1={paddingLeft}
            y1={karmanY}
            x2={svgWidth - paddingRight}
            y2={karmanY}
            stroke="#6366f1"
            strokeDasharray="2 3"
            strokeWidth="1"
            opacity="0.6"
          />
          <text
            x={paddingLeft + 6}
            y={karmanY - 4}
            fill="#818cf8"
            fontSize="9"
            fontFamily="monospace"
          >
            Kármán Line (100 km Edge of Space)
          </text>

          {/* Planned Future Trajectory Line (Faint Dashed Grey) */}
          <path
            d={fullPathD}
            fill="none"
            stroke="#334155"
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Completed Ascent Trajectory Curve (Vibrant Gradient) */}
          {completedPathD && (
            <>
              {/* Semi-transparent area fill underneath trajectory */}
              <path
                d={`${completedPathD} L ${currentCoord.x} ${paddingTop + plotHeight} L ${paddingLeft} ${paddingTop + plotHeight} Z`}
                fill="url(#areaGrad)"
              />
              <path
                d={completedPathD}
                fill="none"
                stroke="url(#trajGrad)"
                strokeWidth="3.5"
                filter="url(#glow)"
              />
            </>
          )}

          {/* Milestone Waypoints on the Path */}
          {milestoneCoords.map((ms, i) => {
            if (!ms.pt) return null;
            const isPassed = currentIdx >= ms.idx;
            return (
              <g key={i}>
                <circle
                  cx={ms.pt.x}
                  cy={ms.pt.y}
                  r={isPassed ? 4 : 3}
                  className={`transition-all duration-200 ${
                    isPassed
                      ? "fill-cyan-400 stroke-cyan-200 stroke-2"
                      : "fill-slate-800 stroke-slate-600 stroke-1"
                  }`}
                />
                <text
                  x={ms.pt.x}
                  y={ms.pt.y + 14}
                  fill={isPassed ? "#e2e8f0" : "#64748b"}
                  fontSize="8.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {ms.name}
                </text>
              </g>
            );
          })}

          {/* Animated Rocket Vehicle Marker on the Trajectory Path */}
          {currentCoord && (
            <g
              transform={`translate(${currentCoord.x}, ${currentCoord.y}) rotate(${
                Math.max(-85, Math.min(85, 90 - currentAngle))
              })`}
              className="transition-transform duration-75"
            >
              {/* Rocket Exhaust Flame (Animated Plume when engine firing) */}
              {isEngineFiring && (
                <g filter="url(#glow)">
                  <path
                    d="M -3 6 L 0 16 L 3 6 Z"
                    fill="#f97316"
                    className="animate-pulse"
                  />
                  <path
                    d="M -1.5 6 L 0 11 L 1.5 6 Z"
                    fill="#fde047"
                  />
                </g>
              )}

              {/* Rocket Outer Aura Circle */}
              <circle
                r="11"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                className="animate-[spin_10s_linear_infinite]"
              />

              {/* Central Rocket Icon Capsule */}
              <circle r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
              <polygon points="0,-4 3,3 -3,3" fill="#ffffff" />
            </g>
          )}

          {/* Altitude Y-Axis Labels */}
          <text x={paddingLeft - 8} y={paddingTop + plotHeight} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">0 km</text>
          <text x={paddingLeft - 8} y={paddingTop + plotHeight * 0.5} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
            {(maxAltPlot * 0.5).toFixed(0)} km
          </text>
          <text x={paddingLeft - 8} y={paddingTop + 6} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
            {maxAltPlot.toFixed(0)} km
          </text>
        </svg>

        {/* Floating Telemetry HUD Overlay in Top Left of Visualizer */}
        <div className="absolute top-2.5 left-3 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs font-mono tabular-nums text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">ALT:</span>
            <span className="font-bold text-cyan-400">{currentAlt.toFixed(1)} km</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">VEL:</span>
            <span className="font-bold text-emerald-400">{currentVel.toFixed(0)} m/s</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">G-LOAD:</span>
            <span className={`font-bold ${currentG > 5 ? "text-rose-400" : "text-amber-400"}`}>
              {currentG.toFixed(2)} g
            </span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-500">MAX-Q:</span>
            <span className="font-bold text-white">{currentQ.toFixed(1)} kPa</span>
          </div>
        </div>
      </div>

      {/* Multi-Segment Flight Phase Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 uppercase font-semibold">Ascent Flight Progress:</span>
            <span className="text-white font-bold">{progressPct.toFixed(1)}% Complete</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>Apogee: {trajectory.summary.max_altitude_km.toFixed(1)} km</span>
            <span>·</span>
            <span>Target: {mission.altitude} km</span>
            <span>·</span>
            <span className={isEngineFiring ? "text-amber-400 font-semibold" : "text-slate-500"}>
              {isEngineFiring ? "🔥 ENGINES FIRING" : "⚡ MECO COAST"}
            </span>
          </div>
        </div>

        {/* Interactive Scrubbable Progress Bar Track */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            const newIdx = Math.round(pct * (nPoints - 1));
            onIndexChange(newIdx);
          }}
          className="relative h-3 w-full bg-slate-950 rounded-full border border-slate-800 cursor-pointer overflow-hidden group"
          title="Click or drag to scrub flight timeline"
        >
          {/* Animated Gradient Fill */}
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-100 relative"
            style={{ width: `${progressPct}%` }}
          >
            {/* Shimmer light effect when playing */}
            {isPlaying && (
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            )}
          </div>

          {/* Milestone markers on progress track */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
            style={{ left: `${(maxQIdx / (nPoints - 1)) * 100}%` }}
            title="Max-Q"
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-400"
            style={{ left: `${(karmanIdx / (nPoints - 1)) * 100}%` }}
            title="Kármán line (100km)"
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-purple-400"
            style={{ left: `${(mecoIdx / (nPoints - 1)) * 100}%` }}
            title="MECO"
          />
        </div>

        {/* Phase segment labels underneath */}
        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-slate-500 pt-0.5">
          <div className={currentIdx <= maxQIdx ? "text-cyan-400 font-semibold" : ""}>
            1. Boost &amp; Max-Q
          </div>
          <div className={currentIdx > maxQIdx && currentIdx <= karmanIdx ? "text-cyan-400 font-semibold" : ""}>
            2. Stratosphere Exit
          </div>
          <div className={currentIdx > karmanIdx && currentIdx <= mecoIdx ? "text-cyan-400 font-semibold" : ""}>
            3. MECO Burnout
          </div>
          <div className={currentIdx > mecoIdx ? "text-emerald-400 font-semibold" : ""}>
            4. Orbit Insertion
          </div>
        </div>
      </div>

      {/* Transport Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          {/* Play / Pause Toggle Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shadow-sm ${
              isPlaying
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Flight</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Flight</span>
              </>
            )}
          </button>

          {/* Reset / Replay Button */}
          <button
            onClick={() => {
              onIndexChange(0);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
            title="Reset flight to liftoff (T+0s)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Liftoff</span>
          </button>
        </div>

        {/* Speed multiplier selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <span className="text-[10px] text-slate-500 px-2 uppercase">Speed:</span>
          {[0.5, 1, 2, 4].map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                playbackSpeed === spd
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Mission Corridor Metric Summary Cards */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Max-Q Margin:</span>
            <span className="text-emerald-400 font-bold">{successAnalysis.qSafety}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">G-Load Margin:</span>
            <span className="text-emerald-400 font-bold">{successAnalysis.gSafety}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Apogee Δh:</span>
            <span className={Number(successAnalysis.altDelta) <= 15 ? "text-cyan-400 font-bold" : "text-amber-400 font-bold"}>
              ±{successAnalysis.altDelta} km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
