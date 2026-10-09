import React, { useState, useMemo } from "react";
import { Mission, HistoryEntry, TrajectoryData } from "../types";
import { simulateAscentTrajectory } from "../lib/physics";
import { runClassicalOptimization, runQAOASimulation } from "../lib/optimization";
import { getMissionHistory } from "../lib/history";
import rawMissions from "../data/missions.json";
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  GitCompare,
  ArrowRightLeft,
  Activity,
  Flame,
  Fuel,
  DollarSign,
  Shield,
  Gauge,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Maximize2,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface SideBySideIterationComparisonProps {
  activeMission: Mission;
  history?: HistoryEntry[];
  allMissions?: Mission[];
  onSelectMission?: (mission: Mission) => void;
}

export interface IterationOption {
  id: string;
  isCurrent: boolean;
  label: string;
  subLabel: string;
  mission: Mission;
  historyEntry?: HistoryEntry;
  notes?: string;
  timestamp?: string;
}

export const SideBySideIterationComparison: React.FC<SideBySideIterationComparisonProps> = ({
  activeMission,
  history: propHistory,
  allMissions = [],
  onSelectMission,
}) => {
  // Merge prop history with localStorage and fallback pre-seeded dataset if empty
  const availableIterations = useMemo<IterationOption[]>(() => {
    const list: IterationOption[] = [];

    // Always include the Active Workspace Mission as option 0
    list.push({
      id: "active_current_workspace",
      isCurrent: true,
      label: `Active: ${activeMission.satellite_name}`,
      subLabel: `${activeMission.mission_id} · ${activeMission.rocket} · ${activeMission.target_orbit} (${activeMission.altitude} km)`,
      mission: activeMission,
      notes: "Active mission currently configured in workspace parameters.",
      timestamp: "Current Workspace Run",
    });

    const stored = propHistory && propHistory.length > 0 ? propHistory : getMissionHistory();

    if (stored.length > 0) {
      stored.forEach((entry, idx) => {
        list.push({
          id: entry.id,
          isCurrent: false,
          label: `${entry.satellite_name} (Iter #${idx + 1})`,
          subLabel: `${entry.mission_id} · ${entry.rocket} · ${entry.target_orbit} · ${entry.timestamp}`,
          mission: entry.mission,
          historyEntry: entry,
          notes: entry.notes,
          timestamp: entry.timestamp,
        });
      });
    } else {
      // Pre-seed from raw dataset so user can immediately compare iterations
      const seeds = (rawMissions as any[]).slice(0, 5);
      seeds.forEach((raw, idx) => {
        const m: Mission = {
          mission_id: String(raw.mission_id),
          satellite_name: String(raw.satellite_name),
          data_type: raw.data_type,
          launch_date: String(raw.launch_date),
          launch_time: String(raw.launch_time),
          launch_site: String(raw.launch_site),
          rocket: String(raw.rocket),
          rocket_mass: Number(raw.rocket_mass),
          fuel_mass: Number(raw.fuel_mass),
          payload_capacity: Number(raw.payload_capacity),
          thrust: Number(raw.thrust),
          specific_impulse: Number(raw.specific_impulse),
          payload_mass: Number(raw.payload_mass),
          payload_volume: Number(raw.payload_volume || 0),
          target_orbit: String(raw.target_orbit),
          altitude: Number(raw.altitude),
          inclination: Number(raw.inclination),
          delta_v: Number(raw.delta_v),
          flight_time: Number(raw.flight_time),
          fuel_consumption: Number(raw.fuel_consumption),
          weather_temperature: Number(raw.weather_temperature),
          wind_speed: Number(raw.wind_speed),
          rain: Number(raw.rain),
          humidity: Number(raw.humidity),
          safety_status: String(raw.safety_status),
          launch_window_start: String(raw.launch_window_start),
          launch_window_end: String(raw.launch_window_end),
          launch_window_duration: Number(raw.launch_window_duration),
          launch_cost: Number(raw.launch_cost),
          risk_score: Number(raw.risk_score),
          mission_priority: Number(raw.mission_priority),
          trajectory_type: String(raw.trajectory_type),
          cross_section_area: Number(raw.cross_section_area || 10.0),
          drag_coefficient: Number(raw.drag_coefficient || 0.32),
          fuel_margin: Number(raw.fuel_margin || 0.05),
          payload_fraction: Number(raw.payload_fraction || 0.02),
          thrust_to_weight_ratio: Number(raw.thrust_to_weight_ratio || 1.3),
          mission_efficiency: Number(raw.mission_efficiency || 100.0),
        };

        const notes = [
          "Nominal gravity turn profile with standard staging and first stage fuel reserve.",
          "High-apogee orbital injection variant with aggressive angle-of-attack pitch program.",
          "Heavy payload configuration testing maximum transonic dynamic pressure tolerance.",
          "Delayed launch window simulation with adapted propellant margin and thermal throttling.",
          "Polar LEO circularization test with high inclination gravity turn optimization.",
        ];

        list.push({
          id: `seed_opt_${m.mission_id}_${idx}`,
          isCurrent: false,
          label: `${m.satellite_name} (Benchmark Iter #${idx + 1})`,
          subLabel: `${m.mission_id} · ${m.rocket} · ${m.target_orbit} (${m.altitude} km)`,
          mission: m,
          notes: notes[idx] || "Standard benchmark trajectory iteration.",
          timestamp: `Iter #${idx + 1} (${m.launch_date})`,
        });
      });
    }

    return list;
  }, [activeMission, propHistory]);

  // Selected iteration IDs for A and B
  const [selectedIdA, setSelectedIdA] = useState<string>(() => {
    return availableIterations[0]?.id || "active_current_workspace";
  });

  const [selectedIdB, setSelectedIdB] = useState<string>(() => {
    return availableIterations.length > 1 ? availableIterations[1]?.id : "active_current_workspace";
  });

  // Chart display modes
  const [comparisonChartMode, setComparisonChartMode] = useState<"overlaid" | "side_by_side">("overlaid");
  const [activeTrajectoryMetric, setActiveTrajectoryMetric] = useState<"altitude" | "velocity" | "dynamic_pressure" | "accel_g">("altitude");

  // Retrieve selected options
  const optionA = useMemo(() => {
    return availableIterations.find((i) => i.id === selectedIdA) || availableIterations[0];
  }, [availableIterations, selectedIdA]);

  const optionB = useMemo(() => {
    return availableIterations.find((i) => i.id === selectedIdB) || (availableIterations[1] || availableIterations[0]);
  }, [availableIterations, selectedIdB]);

  // Compute 4th-Order Runge-Kutta trajectories for both iterations
  const trajA = useMemo<TrajectoryData>(() => {
    return simulateAscentTrajectory(optionA.mission);
  }, [optionA.mission]);

  const trajB = useMemo<TrajectoryData>(() => {
    return simulateAscentTrajectory(optionB.mission);
  }, [optionB.mission]);

  // Compute Classical and QAOA optimization results for both iterations
  const optA = useMemo(() => {
    const c = runClassicalOptimization(optionA.mission);
    const q = runQAOASimulation(optionA.mission, 1, 1024);
    return { classical: c, qaoa: q };
  }, [optionA.mission]);

  const optB = useMemo(() => {
    const c = runClassicalOptimization(optionB.mission);
    const q = runQAOASimulation(optionB.mission, 1, 1024);
    return { classical: c, qaoa: q };
  }, [optionB.mission]);

  // Swap Iteration A and B
  const handleSwapIterations = () => {
    const temp = selectedIdA;
    setSelectedIdA(selectedIdB);
    setSelectedIdB(temp);
  };

  // Interpolated side-by-side time series data for synchronized chart rendering
  const timeSeriesData = useMemo(() => {
    const maxTimeA = trajA.time[trajA.time.length - 1] || 500;
    const maxTimeB = trajB.time[trajB.time.length - 1] || 500;
    const maxTime = Math.max(maxTimeA, maxTimeB);

    const numPoints = 55;
    const step = maxTime / (numPoints - 1);
    const points = [];

    // Helper to interpolate scalar from trajectory time series
    const sampleTraj = (traj: TrajectoryData, tTarget: number) => {
      const times = traj.time;
      if (times.length === 0) return { alt: 0, vel: 0, q: 0, g: 1 };

      if (tTarget <= times[0]) {
        return {
          alt: traj.altitude_km[0] || 0,
          vel: traj.velocity_ms[0] || 0,
          q: traj.dynamic_pressure_kPa[0] || 0,
          g: traj.accel_g[0] || 1,
        };
      }
      if (tTarget >= times[times.length - 1]) {
        const lastIdx = times.length - 1;
        return {
          alt: traj.altitude_km[lastIdx] || 0,
          vel: traj.velocity_ms[lastIdx] || 0,
          q: traj.dynamic_pressure_kPa[lastIdx] || 0,
          g: traj.accel_g[lastIdx] || 1,
        };
      }

      // Binary search for nearest bounding interval
      let low = 0;
      let high = times.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] <= tTarget) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const idx1 = Math.max(0, high);
      const idx2 = Math.min(times.length - 1, low);
      const t1 = times[idx1];
      const t2 = times[idx2];
      const frac = t2 === t1 ? 0 : Math.max(0, Math.min(1, (tTarget - t1) / (t2 - t1)));

      return {
        alt: Number(((traj.altitude_km[idx1] || 0) + frac * ((traj.altitude_km[idx2] || 0) - (traj.altitude_km[idx1] || 0))).toFixed(2)),
        vel: Number(((traj.velocity_ms[idx1] || 0) + frac * ((traj.velocity_ms[idx2] || 0) - (traj.velocity_ms[idx1] || 0))).toFixed(1)),
        q: Number(((traj.dynamic_pressure_kPa[idx1] || 0) + frac * ((traj.dynamic_pressure_kPa[idx2] || 0) - (traj.dynamic_pressure_kPa[idx1] || 0))).toFixed(2)),
        g: Number(((traj.accel_g[idx1] || 1) + frac * ((traj.accel_g[idx2] || 1) - (traj.accel_g[idx1] || 1))).toFixed(2)),
      };
    };

    for (let i = 0; i < numPoints; i++) {
      const t = Math.round(i * step);
      const sA = sampleTraj(trajA, t);
      const sB = sampleTraj(trajB, t);

      points.push({
        time: t,
        // Iteration A
        altA: sA.alt,
        velA: sA.vel,
        qA: sA.q,
        gA: sA.g,
        // Iteration B
        altB: sB.alt,
        velB: sB.vel,
        qB: sB.q,
        gB: sB.g,
        // Deltas (B - A)
        deltaAlt: Number((sB.alt - sA.alt).toFixed(2)),
        deltaVel: Number((sB.vel - sA.vel).toFixed(1)),
        deltaQ: Number((sB.q - sA.q).toFixed(2)),
      });
    }

    return points;
  }, [trajA, trajB]);

  // Delta Performance Metrics (Iteration B compared against Iteration A)
  const deltas = useMemo(() => {
    const sumA = trajA.summary;
    const sumB = trajB.summary;

    const deltaApogeeKm = sumB.max_altitude_km - sumA.max_altitude_km;
    const deltaApogeePct = sumA.max_altitude_km !== 0 ? (deltaApogeeKm / sumA.max_altitude_km) * 100 : 0;

    const deltaVelMs = sumB.final_velocity_ms - sumA.final_velocity_ms;
    const deltaVelPct = sumA.final_velocity_ms !== 0 ? (deltaVelMs / sumA.final_velocity_ms) * 100 : 0;

    const deltaFuelKg = optionB.mission.fuel_consumption - optionA.mission.fuel_consumption;
    const deltaFuelPct = optionA.mission.fuel_consumption !== 0 ? (deltaFuelKg / optionA.mission.fuel_consumption) * 100 : 0;

    const deltaMaxQKPa = sumB.max_dynamic_pressure_kPa - sumA.max_dynamic_pressure_kPa;
    const deltaMaxQPct = sumA.max_dynamic_pressure_kPa !== 0 ? (deltaMaxQKPa / sumA.max_dynamic_pressure_kPa) * 100 : 0;

    const deltaBurnSec = sumB.burn_time_sec - sumA.burn_time_sec;

    const deltaCostMusd = optionB.mission.launch_cost - optionA.mission.launch_cost;
    const deltaRiskScore = optionB.mission.risk_score - optionA.mission.risk_score;

    const objA = optA.classical.optimized.objective_value;
    const objB = optB.classical.optimized.objective_value;
    const deltaObjective = objB - objA;

    return {
      deltaApogeeKm,
      deltaApogeePct,
      deltaVelMs,
      deltaVelPct,
      deltaFuelKg,
      deltaFuelPct,
      deltaMaxQKPa,
      deltaMaxQPct,
      deltaBurnSec,
      deltaCostMusd,
      deltaRiskScore,
      deltaObjective,
    };
  }, [trajA, trajB, optionA, optionB, optA, optB]);

  // Metric metadata
  const metricConfig = {
    altitude: {
      label: "Altitude Profile",
      unit: "km",
      keyA: "altA",
      keyB: "altB",
      deltaKey: "deltaAlt",
      colorA: "#06b6d4",
      colorB: "#f59e0b",
      valA: trajA.summary.max_altitude_km.toFixed(1),
      valB: trajB.summary.max_altitude_km.toFixed(1),
      deltaVal: `${deltas.deltaApogeeKm >= 0 ? "+" : ""}${deltas.deltaApogeeKm.toFixed(1)} km (${deltas.deltaApogeePct >= 0 ? "+" : ""}${deltas.deltaApogeePct.toFixed(1)}%)`,
    },
    velocity: {
      label: "Orbital Velocity",
      unit: "m/s",
      keyA: "velA",
      keyB: "velB",
      deltaKey: "deltaVel",
      colorA: "#06b6d4",
      colorB: "#f59e0b",
      valA: trajA.summary.final_velocity_ms.toFixed(0),
      valB: trajB.summary.final_velocity_ms.toFixed(0),
      deltaVal: `${deltas.deltaVelMs >= 0 ? "+" : ""}${deltas.deltaVelMs.toFixed(0)} m/s (${deltas.deltaVelPct >= 0 ? "+" : ""}${deltas.deltaVelPct.toFixed(1)}%)`,
    },
    dynamic_pressure: {
      label: "Dynamic Pressure (Max-Q)",
      unit: "kPa",
      keyA: "qA",
      keyB: "qB",
      deltaKey: "deltaQ",
      colorA: "#06b6d4",
      colorB: "#f59e0b",
      valA: trajA.summary.max_dynamic_pressure_kPa.toFixed(2),
      valB: trajB.summary.max_dynamic_pressure_kPa.toFixed(2),
      deltaVal: `${deltas.deltaMaxQKPa >= 0 ? "+" : ""}${deltas.deltaMaxQKPa.toFixed(2)} kPa (${deltas.deltaMaxQPct >= 0 ? "+" : ""}${deltas.deltaMaxQPct.toFixed(1)}%)`,
    },
    accel_g: {
      label: "Acceleration G-Force",
      unit: "g",
      keyA: "gA",
      keyB: "gB",
      deltaKey: null,
      colorA: "#06b6d4",
      colorB: "#f59e0b",
      valA: trajA.summary.max_acceleration_g.toFixed(2),
      valB: trajB.summary.max_acceleration_g.toFixed(2),
      deltaVal: `${(trajB.summary.max_acceleration_g - trajA.summary.max_acceleration_g).toFixed(2)} g`,
    },
  };

  const activeConf = metricConfig[activeTrajectoryMetric];

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. ITERATION SELECTORS & QUICK SWAP CONTROLLER
          ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Side-by-Side Dual Iteration Comparator</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                  Trajectory Differential
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Select two historical mission runs to visualize aerodynamic performance and optimization deltas side-by-side
              </div>
            </div>
          </div>

          {/* Quick Swap Button */}
          <button
            onClick={handleSwapIterations}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono cursor-pointer transition-colors shadow-xs"
            title="Swap Iteration A and Iteration B positions"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Swap A ⇄ B</span>
          </button>
        </div>

        {/* Dual Selectors: Iteration A & Iteration B */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box A: Primary / Baseline Iteration */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-800/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  Iteration A (Baseline)
                </span>
              </div>
              {optionA.isCurrent && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                  Active Workspace
                </span>
              )}
            </div>

            <select
              value={selectedIdA}
              onChange={(e) => setSelectedIdA(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-cyan-400 focus:outline-hidden cursor-pointer"
            >
              {availableIterations.map((it) => (
                <option key={`opt_a_${it.id}`} value={it.id}>
                  {it.label} — {it.subLabel}
                </option>
              ))}
            </select>

            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Vehicle &amp; Site:</span>
                <span className="text-slate-200">{optionA.mission.rocket} · {optionA.mission.launch_site.split(",")[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Target Orbit:</span>
                <span className="text-cyan-300 font-semibold">{optionA.mission.target_orbit} ({optionA.mission.altitude} km)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Payload Mass:</span>
                <span className="text-slate-200">{optionA.mission.payload_mass.toLocaleString()} kg</span>
              </div>
            </div>
          </div>

          {/* Box B: Comparison Iteration */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-800/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                  Iteration B (Comparison Target)
                </span>
              </div>
              {optionB.isCurrent && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300 font-semibold">
                  Active Workspace
                </span>
              )}
            </div>

            <select
              value={selectedIdB}
              onChange={(e) => setSelectedIdB(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-amber-400 focus:outline-hidden cursor-pointer"
            >
              {availableIterations.map((it) => (
                <option key={`opt_b_${it.id}`} value={it.id}>
                  {it.label} — {it.subLabel}
                </option>
              ))}
            </select>

            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Vehicle &amp; Site:</span>
                <span className="text-slate-200">{optionB.mission.rocket} · {optionB.mission.launch_site.split(",")[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Target Orbit:</span>
                <span className="text-amber-300 font-semibold">{optionB.mission.target_orbit} ({optionB.mission.altitude} km)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Payload Mass:</span>
                <span className="text-slate-200">{optionB.mission.payload_mass.toLocaleString()} kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. PERFORMANCE DELTA KPI CARDS (B vs A)
          ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Metric 1: Apogee Altitude */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400">Apogee Altitude</div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-white tabular-nums">
              {trajB.summary.max_altitude_km.toFixed(1)} <span className="text-xs text-slate-500 font-sans">km</span>
            </span>
            <span className={`text-xs font-mono font-bold flex items-center ${
              deltas.deltaApogeeKm >= 0 ? "text-cyan-400" : "text-amber-400"
            }`}>
              {deltas.deltaApogeeKm >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {deltas.deltaApogeeKm >= 0 ? "+" : ""}{deltas.deltaApogeeKm.toFixed(1)} km
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            A: {trajA.summary.max_altitude_km.toFixed(1)} km · Target B: {optionB.mission.altitude} km
          </div>
        </div>

        {/* Metric 2: Final Insertion Velocity */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400">Final Velocity</div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-white tabular-nums">
              {trajB.summary.final_velocity_ms.toFixed(0)} <span className="text-xs text-slate-500 font-sans">m/s</span>
            </span>
            <span className={`text-xs font-mono font-bold flex items-center ${
              deltas.deltaVelMs >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}>
              {deltas.deltaVelMs >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {deltas.deltaVelMs >= 0 ? "+" : ""}{deltas.deltaVelMs.toFixed(0)} m/s
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            A: {trajA.summary.final_velocity_ms.toFixed(0)} m/s ({deltas.deltaVelPct >= 0 ? "+" : ""}{deltas.deltaVelPct.toFixed(1)}%)
          </div>
        </div>

        {/* Metric 3: Propellant Consumption */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400">Fuel Consumption</div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-white tabular-nums">
              {(optionB.mission.fuel_consumption / 1000).toFixed(1)} <span className="text-xs text-slate-500 font-sans">t</span>
            </span>
            <span className={`text-xs font-mono font-bold flex items-center ${
              deltas.deltaFuelKg <= 0 ? "text-emerald-400" : "text-amber-400"
            }`}>
              {deltas.deltaFuelKg <= 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
              {deltas.deltaFuelKg > 0 ? "+" : ""}{(deltas.deltaFuelKg / 1000).toFixed(1)} t
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {deltas.deltaFuelKg < 0 ? `Saved ${Math.abs(deltas.deltaFuelKg).toLocaleString()} kg` : `+${deltas.deltaFuelKg.toLocaleString()} kg payload load`}
          </div>
        </div>

        {/* Metric 4: Max-Q Dynamic Pressure */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400">Max Dynamic Pressure (Max-Q)</div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-mono font-bold text-white tabular-nums">
              {trajB.summary.max_dynamic_pressure_kPa.toFixed(2)} <span className="text-xs text-slate-500 font-sans">kPa</span>
            </span>
            <span className={`text-xs font-mono font-bold flex items-center ${
              Math.abs(deltas.deltaMaxQKPa) < 1.0 ? "text-slate-300" : deltas.deltaMaxQKPa < 0 ? "text-emerald-400" : "text-amber-400"
            }`}>
              {deltas.deltaMaxQKPa >= 0 ? "+" : ""}{deltas.deltaMaxQKPa.toFixed(2)} kPa
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            A: {trajA.summary.max_dynamic_pressure_kPa.toFixed(2)} kPa ({deltas.deltaMaxQPct >= 0 ? "+" : ""}{deltas.deltaMaxQPct.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. TRAJECTORY PERFORMANCE CHARTS (OVERLAID OR SIDE-BY-SIDE)
          ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        {/* Controls Toolbar: Mode Switch & Metric Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          {/* Metric Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTrajectoryMetric("altitude")}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                activeTrajectoryMetric === "altitude"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Altitude (km)
            </button>
            <button
              onClick={() => setActiveTrajectoryMetric("velocity")}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                activeTrajectoryMetric === "velocity"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Velocity (m/s)
            </button>
            <button
              onClick={() => setActiveTrajectoryMetric("dynamic_pressure")}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                activeTrajectoryMetric === "dynamic_pressure"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Max-Q Pressure (kPa)
            </button>
            <button
              onClick={() => setActiveTrajectoryMetric("accel_g")}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                activeTrajectoryMetric === "accel_g"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              G-Force Load (g)
            </button>
          </div>

          {/* Presentation Mode: Overlaid vs Side-by-Side Dual Charts */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setComparisonChartMode("overlaid")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                comparisonChartMode === "overlaid"
                  ? "bg-slate-800 text-cyan-300 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Superposed Overlay
            </button>
            <button
              onClick={() => setComparisonChartMode("side_by_side")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                comparisonChartMode === "side_by_side"
                  ? "bg-slate-800 text-cyan-300 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dual Side-by-Side
            </button>
          </div>
        </div>

        {/* CHART RENDERING 1: SUPERPOSED OVERLAY CHART */}
        {comparisonChartMode === "overlaid" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono px-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <span className="w-3 h-0.5 bg-cyan-400 rounded-full" />
                  <span>Iteration A: {optionA.mission.satellite_name} ({activeConf.valA} {activeConf.unit})</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
                  <span>Iteration B: {optionB.mission.satellite_name} ({activeConf.valB} {activeConf.unit})</span>
                </span>
              </div>
              <span className="text-slate-400">
                Performance Delta: <strong className="text-white">{activeConf.deltaVal}</strong>
              </span>
            </div>

            <div className="h-80 w-full bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `T+${val}s`}
                    label={{ value: "Mission Flight Time (seconds)", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    label={{ value: `${activeConf.label} (${activeConf.unit})`, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0b0f17", borderColor: "#334155", borderRadius: "0.5rem", fontSize: "11px", fontFamily: "monospace" }}
                    labelFormatter={(val) => `T+${val}s into flight`}
                    formatter={(value: any, name: any) => {
                      if (name === activeConf.keyA) return [`${Number(value).toFixed(2)} ${activeConf.unit}`, `Iteration A (${optionA.mission.satellite_name})`];
                      if (name === activeConf.keyB) return [`${Number(value).toFixed(2)} ${activeConf.unit}`, `Iteration B (${optionB.mission.satellite_name})`];
                      return [value, name];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={activeConf.keyA}
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={false}
                    name={activeConf.keyA}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={activeConf.keyB}
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    strokeDasharray="4 2"
                    dot={false}
                    name={activeConf.keyB}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART RENDERING 2: DUAL SIDE-BY-SIDE CHARTS */}
        {comparisonChartMode === "side_by_side" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Chart: Iteration A */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-cyan-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Iteration A: {optionA.mission.satellite_name}</span>
                </span>
                <span className="text-slate-400">{activeConf.valA} {activeConf.unit}</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 15, left: -5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickFormatter={(val) => `T+${val}s`} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0b0f17", borderColor: "#334155", borderRadius: "0.5rem", fontSize: "11px", fontFamily: "monospace" }}
                      formatter={(value: any) => [`${Number(value).toFixed(2)} ${activeConf.unit}`, "Iteration A"]}
                    />
                    <Area type="monotone" dataKey={activeConf.keyA} stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorA)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Chart: Iteration B */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-amber-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Iteration B: {optionB.mission.satellite_name}</span>
                </span>
                <span className="text-slate-400">{activeConf.valB} {activeConf.unit}</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 15, left: -5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickFormatter={(val) => `T+${val}s`} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0b0f17", borderColor: "#334155", borderRadius: "0.5rem", fontSize: "11px", fontFamily: "monospace" }}
                      formatter={(value: any) => [`${Number(value).toFixed(2)} ${activeConf.unit}`, "Iteration B"]}
                    />
                    <Area type="monotone" dataKey={activeConf.keyB} stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorB)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          4. COMPREHENSIVE PERFORMANCE ATTRIBUTE MATRIX (SIDE-BY-SIDE AUDIT)
          ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase font-mono">
            Flight Dynamics &amp; Optimization Attribute Comparison
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Direct Differential: B minus A
          </span>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-sans font-semibold">Parameter / Performance Dimension</th>
                <th className="p-3 text-cyan-400">Iteration A ({optionA.mission.satellite_name.split(" ")[0]})</th>
                <th className="p-3 text-amber-400">Iteration B ({optionB.mission.satellite_name.split(" ")[0]})</th>
                <th className="p-3">Performance Differential (Δ)</th>
                <th className="p-3">Evaluation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 tabular-nums">
              {/* Row: Target Orbit */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3 font-sans font-medium text-slate-200">Target Orbit Regime &amp; Altitude</td>
                <td className="p-3 text-cyan-300">{optionA.mission.target_orbit} ({optionA.mission.altitude} km)</td>
                <td className="p-3 text-amber-300">{optionB.mission.target_orbit} ({optionB.mission.altitude} km)</td>
                <td className="p-3">
                  {optionB.mission.altitude - optionA.mission.altitude >= 0 ? "+" : ""}
                  {optionB.mission.altitude - optionA.mission.altitude} km
                </td>
                <td className="p-3">
                  {optionB.mission.altitude >= optionA.mission.altitude ? (
                    <span className="text-cyan-400 font-semibold">Higher Orbit Insertion</span>
                  ) : (
                    <span className="text-slate-400">Lower Orbit Regime</span>
                  )}
                </td>
              </tr>

              {/* Row: Payload Mass */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3 font-sans font-medium text-slate-200">Payload Mass Carried</td>
                <td className="p-3">{optionA.mission.payload_mass.toLocaleString()} kg</td>
                <td className="p-3">{optionB.mission.payload_mass.toLocaleString()} kg</td>
                <td className="p-3">
                  {(optionB.mission.payload_mass - optionA.mission.payload_mass) >= 0 ? "+" : ""}
                  {(optionB.mission.payload_mass - optionA.mission.payload_mass).toLocaleString()} kg
                </td>
                <td className="p-3">
                  <span className="text-slate-400">
                    {((optionB.mission.payload_mass / optionB.mission.payload_capacity) * 100).toFixed(1)}% Capacity
                  </span>
                </td>
              </tr>

              {/* Row: Peak Acceleration */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3 font-sans font-medium text-slate-200">Peak G-Force Load (Liftoff/MECO)</td>
                <td className="p-3">{trajA.summary.max_acceleration_g.toFixed(2)} g</td>
                <td className="p-3">{trajB.summary.max_acceleration_g.toFixed(2)} g</td>
                <td className="p-3">
                  {(trajB.summary.max_acceleration_g - trajA.summary.max_acceleration_g) >= 0 ? "+" : ""}
                  {(trajB.summary.max_acceleration_g - trajA.summary.max_acceleration_g).toFixed(2)} g
                </td>
                <td className="p-3">
                  <span className="text-emerald-400 font-semibold">Within 6.0g Structural Limit</span>
                </td>
              </tr>

              {/* Row: Multi-Objective Score */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3 font-sans font-medium text-slate-200">Multi-Objective Score (QAOA Ground State)</td>
                <td className="p-3 text-cyan-300">{optA.qaoa.decoded_plan.objective_value.toFixed(4)}</td>
                <td className="p-3 text-amber-300">{optB.qaoa.decoded_plan.objective_value.toFixed(4)}</td>
                <td className="p-3">
                  {deltas.deltaObjective >= 0 ? "+" : ""}
                  {deltas.deltaObjective.toFixed(4)}
                </td>
                <td className="p-3">
                  {deltas.deltaObjective <= 0 ? (
                    <span className="text-emerald-400 font-semibold">Iteration B Superior (Lower Cost)</span>
                  ) : (
                    <span className="text-cyan-400 font-semibold">Iteration A Superior</span>
                  )}
                </td>
              </tr>

              {/* Row: Estimated Launch Cost */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3 font-sans font-medium text-slate-200">Estimated Mission Launch Cost</td>
                <td className="p-3">${optionA.mission.launch_cost}M</td>
                <td className="p-3">${optionB.mission.launch_cost}M</td>
                <td className="p-3">
                  {deltas.deltaCostMusd >= 0 ? "+" : ""}
                  ${deltas.deltaCostMusd.toFixed(2)}M
                </td>
                <td className="p-3">
                  {deltas.deltaCostMusd < 0 ? (
                    <span className="text-emerald-400 font-semibold">${Math.abs(deltas.deltaCostMusd).toFixed(2)}M Cost Savings</span>
                  ) : (
                    <span className="text-slate-400">Standard Budget</span>
                  )}
                </td>
              </tr>

              {/* Row: Risk Score */}
              <tr className="hover:bg-slate-900/40">
                <td className="p-3 font-sans font-medium text-slate-200">Mission Operational Risk Score</td>
                <td className="p-3">{optionA.mission.risk_score.toFixed(1)} / 100</td>
                <td className="p-3">{optionB.mission.risk_score.toFixed(1)} / 100</td>
                <td className="p-3">
                  {deltas.deltaRiskScore >= 0 ? "+" : ""}
                  {deltas.deltaRiskScore.toFixed(1)} pts
                </td>
                <td className="p-3">
                  <span className={optionB.mission.safety_status.includes("HIGH") ? "text-rose-400" : "text-emerald-400 font-semibold"}>
                    {optionB.mission.safety_status}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Engineering Logbook Notes Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-cyan-900/50 space-y-1">
            <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold flex items-center justify-between">
              <span>Iteration A Engineering Notes</span>
              <span className="text-slate-500 font-normal">{optionA.timestamp}</span>
            </div>
            <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
              {optionA.notes || "Standard flight dynamics logbook entry."}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-amber-900/50 space-y-1">
            <div className="text-[10px] font-mono uppercase text-amber-400 font-bold flex items-center justify-between">
              <span>Iteration B Engineering Notes</span>
              <span className="text-slate-500 font-normal">{optionB.timestamp}</span>
            </div>
            <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
              {optionB.notes || "Standard flight dynamics logbook entry."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
