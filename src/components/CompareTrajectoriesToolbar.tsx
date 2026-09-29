import React, { useState, useMemo, useEffect } from "react";
import { Mission, HistoryEntry, TrajectoryData } from "../types";
import { getMissionHistory, saveMissionToHistory } from "../lib/history";
import { runClassicalOptimization, runQAOASimulation } from "../lib/optimization";
import { simulateAscentTrajectory } from "../lib/physics";
import { TrajectoryComparisonOverlay } from "./FlightPathCanvas";
import rawMissions from "../data/missions.json";
import {
  GitCompare,
  ArrowLeftRight,
  History,
  BookmarkPlus,
  Rocket,
  CheckCircle2,
  TrendingUp,
  Sliders,
  ChevronDown,
} from "lucide-react";

interface CompareTrajectoriesToolbarProps {
  currentMission: Mission;
  activeAngleDeviation: number;
  fuelDeltaPct: number;
  onComparisonChange: (overlay: TrajectoryComparisonOverlay | null) => void;
  onSelectCurrentMissionOverride?: (m: Mission) => void;
}

interface RunOption {
  id: string;
  label: string;
  subLabel: string;
  source: "current" | "history" | "preset";
  mission: Mission;
}

export const CompareTrajectoriesToolbar: React.FC<CompareTrajectoriesToolbarProps> = ({
  currentMission,
  activeAngleDeviation,
  fuelDeltaPct,
  onComparisonChange,
}) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [historyRuns, setHistoryRuns] = useState<HistoryEntry[]>([]);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Load history from localStorage
  const refreshHistory = () => {
    const list = getMissionHistory();
    setHistoryRuns(list);
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  // Construct options list combining:
  // 1. Current Active Simulation (with any angle or fuel deviations applied)
  // 2. Saved History runs
  // 3. Built-in Preset reference benchmark missions
  const availableRunOptions: RunOption[] = useMemo(() => {
    const list: RunOption[] = [];

    // Current Active Run
    const activeModifiedMission: Mission = {
      ...currentMission,
      fuel_consumption: currentMission.fuel_consumption * (1 + fuelDeltaPct / 100),
      fuel_mass: currentMission.fuel_mass * (1 + fuelDeltaPct / 100),
    };

    const currentNotes = [];
    if (activeAngleDeviation !== 0) currentNotes.push(`Δγ=${activeAngleDeviation > 0 ? "+" : ""}${activeAngleDeviation}°`);
    if (fuelDeltaPct !== 0) currentNotes.push(`Fuel ${fuelDeltaPct > 0 ? "+" : ""}${fuelDeltaPct}%`);
    const currentNotesStr = currentNotes.length > 0 ? ` (${currentNotes.join(", ")})` : "";

    list.push({
      id: "current_active",
      label: `[Active Simulation] ${currentMission.satellite_name}${currentNotesStr}`,
      subLabel: `${currentMission.rocket} · ${currentMission.target_orbit} (${currentMission.altitude} km)`,
      source: "current",
      mission: activeModifiedMission,
    });

    // Saved History Runs
    historyRuns.forEach((h, idx) => {
      list.push({
        id: h.id,
        label: `[History #${idx + 1}] ${h.satellite_name} (${h.timestamp})`,
        subLabel: `${h.rocket} · ${h.target_orbit} · ${h.fuel_consumption_kg.toLocaleString()} kg fuel`,
        source: "history",
        mission: h.mission,
      });
    });

    // Built-in presets from dataset for instant comparison
    const presets: Array<{ mission_id: string; tag: string }> = [
      { mission_id: "M0001", tag: "Cartosat-3 (PSLV · SSO 505 km)" },
      { mission_id: "M0008", tag: "Chandrayaan-3 (LVM3 · GTO 36000 km)" },
      { mission_id: "M0004", tag: "EOS-06 (PSLV · SSO 738 km)" },
      { mission_id: "M0009", tag: "Aditya-L1 (PSLV · HEO 23500 km)" },
      { mission_id: "M0015", tag: "Microsat-R (PSLV · LEO 274 km)" },
    ];

    presets.forEach((p) => {
      const found = (rawMissions as any[]).find((m) => String(m.mission_id) === p.mission_id);
      if (found) {
        list.push({
          id: `preset_${p.mission_id}`,
          label: `[Preset Benchmark] ${p.tag}`,
          subLabel: `${found.rocket} · ${found.target_orbit} (${found.altitude} km) · ${found.payload_mass} kg payload`,
          source: "preset",
          mission: {
            mission_id: String(found.mission_id),
            satellite_name: String(found.satellite_name),
            data_type: found.data_type,
            launch_date: String(found.launch_date),
            launch_time: String(found.launch_time),
            launch_site: String(found.launch_site),
            rocket: String(found.rocket),
            rocket_mass: Number(found.rocket_mass),
            fuel_mass: Number(found.fuel_mass),
            payload_capacity: Number(found.payload_capacity),
            thrust: Number(found.thrust),
            specific_impulse: Number(found.specific_impulse),
            payload_mass: Number(found.payload_mass),
            payload_volume: Number(found.payload_volume),
            target_orbit: String(found.target_orbit),
            altitude: Number(found.altitude),
            inclination: Number(found.inclination),
            delta_v: Number(found.delta_v),
            flight_time: Number(found.flight_time),
            fuel_consumption: Number(found.fuel_consumption),
            weather_temperature: Number(found.weather_temperature),
            wind_speed: Number(found.wind_speed),
            rain: Number(found.rain),
            humidity: Number(found.humidity),
            safety_status: String(found.safety_status),
            launch_window_start: String(found.launch_window_start),
            launch_window_end: String(found.launch_window_end),
            launch_window_duration: Number(found.launch_window_duration),
            launch_cost: Number(found.launch_cost),
            risk_score: Number(found.risk_score),
            mission_priority: Number(found.mission_priority),
            trajectory_type: String(found.trajectory_type),
            cross_section_area: Number(found.cross_section_area),
            drag_coefficient: Number(found.drag_coefficient),
            fuel_margin: Number(found.fuel_margin),
            payload_fraction: Number(found.payload_fraction),
            thrust_to_weight_ratio: Number(found.thrust_to_weight_ratio),
            mission_efficiency: Number(found.mission_efficiency),
          },
        });
      }
    });

    return list;
  }, [currentMission, activeAngleDeviation, fuelDeltaPct, historyRuns]);

  // Selected runs
  const [selectedRunAId, setSelectedRunAId] = useState<string>("current_active");
  const [selectedRunBId, setSelectedRunBId] = useState<string>(() => {
    return historyRuns.length > 0 ? historyRuns[0].id : "preset_M0008";
  });

  // Resolve Run A & Run B
  const runAOption = useMemo(() => {
    return availableRunOptions.find((o) => o.id === selectedRunAId) || availableRunOptions[0];
  }, [availableRunOptions, selectedRunAId]);

  const runBOption = useMemo(() => {
    return availableRunOptions.find((o) => o.id === selectedRunBId) || availableRunOptions[1] || availableRunOptions[0];
  }, [availableRunOptions, selectedRunBId]);

  // Fast trajectory simulations for both runs
  const comparisonData = useMemo<{
    trajA: TrajectoryData;
    trajB: TrajectoryData;
  }>(() => {
    const trajA = simulateAscentTrajectory(
      runAOption.mission,
      2.0,
      undefined,
      runAOption.id === "current_active" ? activeAngleDeviation : 0
    );
    const trajB = simulateAscentTrajectory(runBOption.mission, 2.0);
    return { trajA, trajB };
  }, [runAOption, runBOption, activeAngleDeviation]);

  // Notify parent on changes
  useEffect(() => {
    if (!isEnabled) {
      onComparisonChange(null);
      return;
    }

    onComparisonChange({
      enabled: true,
      runA: {
        id: runAOption.id,
        label: runAOption.label.replace(/^\[.*?\]\s*/, ""),
        mission: runAOption.mission,
        trajectory: comparisonData.trajA,
        color: "#06b6d4", // Cyan
      },
      runB: {
        id: runBOption.id,
        label: runBOption.label.replace(/^\[.*?\]\s*/, ""),
        mission: runBOption.mission,
        trajectory: comparisonData.trajB,
        color: "#f59e0b", // Amber
      },
    });
  }, [isEnabled, runAOption, runBOption, comparisonData, onComparisonChange]);

  // Swap runs handler
  const handleSwap = () => {
    const prevA = selectedRunAId;
    setSelectedRunAId(selectedRunBId);
    setSelectedRunBId(prevA);
  };

  // Snapshot current mission to history
  const handleSnapshotCurrent = () => {
    const activeModifiedMission: Mission = {
      ...currentMission,
      fuel_consumption: currentMission.fuel_consumption * (1 + fuelDeltaPct / 100),
      fuel_mass: currentMission.fuel_mass * (1 + fuelDeltaPct / 100),
    };
    const classical = runClassicalOptimization(activeModifiedMission);
    const qaoa = runQAOASimulation(activeModifiedMission, 1, 1024);
    saveMissionToHistory(activeModifiedMission, classical, qaoa);
    refreshHistory();

    setSavedSuccessMsg("Current trajectory snapshotted to History!");
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  // KPI differences
  const kpis = useMemo(() => {
    const tA = comparisonData.trajA.summary;
    const tB = comparisonData.trajB.summary;
    const mA = runAOption.mission;
    const mB = runBOption.mission;

    return {
      apogeeA: tA.max_altitude_km,
      apogeeB: tB.max_altitude_km,
      deltaApogee: Number((tA.max_altitude_km - tB.max_altitude_km).toFixed(1)),

      velA: tA.final_velocity_ms,
      velB: tB.final_velocity_ms,
      deltaVel: Math.round(tA.final_velocity_ms - tB.final_velocity_ms),

      maxQA: tA.max_dynamic_pressure_kPa,
      maxQB: tB.max_dynamic_pressure_kPa,
      deltaMaxQ: Number((tA.max_dynamic_pressure_kPa - tB.max_dynamic_pressure_kPa).toFixed(1)),

      fuelA: mA.fuel_consumption,
      fuelB: mB.fuel_consumption,
      deltaFuel: Math.round(mA.fuel_consumption - mB.fuel_consumption),

      payloadA: mA.payload_mass,
      payloadB: mB.payload_mass,
      deltaPayload: Math.round(mA.payload_mass - mB.payload_mass),

      timeA: tA.burn_time_sec,
      timeB: tB.burn_time_sec,
      deltaTime: Math.round(tA.burn_time_sec - tB.burn_time_sec),
    };
  }, [comparisonData, runAOption, runBOption]);

  return (
    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
      {/* Header & Main Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Compare Trajectories Overlay</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/80 bg-cyan-950/70 text-cyan-300">
                Dual Arc Canvas Overlay
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans">
              Select two mission runs from history or benchmark presets to render simultaneous color-coded trajectory arcs on the canvas
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Snapshot Button */}
          <button
            onClick={handleSnapshotCurrent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Save current simulation parameters to mission history"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Snapshot Current Run</span>
          </button>

          {/* Compare Mode Toggle */}
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
              isEnabled
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm shadow-cyan-500/25"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Overlay: {isEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {savedSuccessMsg && (
        <div className="p-2 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* Selectors & Comparative Cards (Active when isEnabled) */}
      {isEnabled && (
        <div className="space-y-4 pt-1 animate-fadeIn">
          {/* Dual Dropdown Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Run A Selector (Cyan) */}
            <div className="md:col-span-5 p-3 rounded-lg bg-slate-950/80 border border-cyan-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Run 1 (Primary Arc - Cyan):</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase">{runAOption.source}</span>
              </div>

              <select
                value={selectedRunAId}
                onChange={(e) => setSelectedRunAId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {availableRunOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-slate-400 font-sans truncate">{runAOption.subLabel}</div>
            </div>

            {/* Swap Button (2 Cols on MD) */}
            <div className="md:col-span-2 flex justify-center">
              <button
                onClick={handleSwap}
                className="flex items-center justify-center gap-1.5 p-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer text-xs font-mono"
                title="Swap Run 1 and Run 2"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="md:hidden">Swap Runs</span>
              </button>
            </div>

            {/* Run B Selector (Amber) */}
            <div className="md:col-span-5 p-3 rounded-lg bg-slate-950/80 border border-amber-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Run 2 (Comparative Arc - Amber):</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase">{runBOption.source}</span>
              </div>

              <select
                value={selectedRunBId}
                onChange={(e) => setSelectedRunBId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {availableRunOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-slate-400 font-sans truncate">{runBOption.subLabel}</div>
            </div>
          </div>

          {/* Side-by-Side Comparative Telemetry KPI Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs font-mono">
            {/* Apogee */}
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">Achieved Apogee</span>
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="text-cyan-300 font-bold">{kpis.apogeeA.toFixed(1)}</span>
                <span className="text-slate-500 text-[10px]">vs</span>
                <span className="text-amber-300 font-bold">{kpis.apogeeB.toFixed(1)} km</span>
              </div>
              <div className={`text-[10px] font-bold ${kpis.deltaApogee >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                Δ {kpis.deltaApogee >= 0 ? `+${kpis.deltaApogee}` : kpis.deltaApogee} km
              </div>
            </div>

            {/* Burnout Velocity */}
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">Final Velocity</span>
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="text-cyan-300 font-bold">{kpis.velA.toFixed(0)}</span>
                <span className="text-slate-500 text-[10px]">vs</span>
                <span className="text-amber-300 font-bold">{kpis.velB.toFixed(0)} m/s</span>
              </div>
              <div className={`text-[10px] font-bold ${kpis.deltaVel >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                Δ {kpis.deltaVel >= 0 ? `+${kpis.deltaVel}` : kpis.deltaVel} m/s
              </div>
            </div>

            {/* Peak Max-Q Load */}
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">Peak Max-Q</span>
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="text-cyan-300 font-bold">{kpis.maxQA.toFixed(1)}</span>
                <span className="text-slate-500 text-[10px]">vs</span>
                <span className="text-amber-300 font-bold">{kpis.maxQB.toFixed(1)} kPa</span>
              </div>
              <div className={`text-[10px] font-bold ${kpis.deltaMaxQ <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                Δ {kpis.deltaMaxQ >= 0 ? `+${kpis.deltaMaxQ}` : kpis.deltaMaxQ} kPa
              </div>
            </div>

            {/* Propellant Mass */}
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">Propellant Mass</span>
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="text-cyan-300 font-bold">{(kpis.fuelA / 1000).toFixed(0)}t</span>
                <span className="text-slate-500 text-[10px]">vs</span>
                <span className="text-amber-300 font-bold">{(kpis.fuelB / 1000).toFixed(0)}t</span>
              </div>
              <div className={`text-[10px] font-bold ${kpis.deltaFuel <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                Δ {kpis.deltaFuel >= 0 ? `+${Math.round(kpis.deltaFuel / 1000)}t` : `${Math.round(kpis.deltaFuel / 1000)}t`}
              </div>
            </div>

            {/* Payload Mass */}
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">Payload Mass</span>
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="text-cyan-300 font-bold">{kpis.payloadA.toLocaleString()}</span>
                <span className="text-slate-500 text-[10px]">vs</span>
                <span className="text-amber-300 font-bold">{kpis.payloadB.toLocaleString()} kg</span>
              </div>
              <div className={`text-[10px] font-bold ${kpis.deltaPayload >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                Δ {kpis.deltaPayload >= 0 ? `+${kpis.deltaPayload}` : kpis.deltaPayload} kg
              </div>
            </div>

            {/* Burn Time Duration */}
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">Burn Duration</span>
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="text-cyan-300 font-bold">{kpis.timeA}s</span>
                <span className="text-slate-500 text-[10px]">vs</span>
                <span className="text-amber-300 font-bold">{kpis.timeB}s</span>
              </div>
              <div className={`text-[10px] font-bold ${kpis.deltaTime <= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                Δ {kpis.deltaTime >= 0 ? `+${kpis.deltaTime}` : kpis.deltaTime}s
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
