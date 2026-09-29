import React, { useState, useMemo, useEffect } from "react";
import { Mission, HistoryEntry, TrajectoryData } from "../types";
import { simulateAscentTrajectory } from "../lib/physics";
import { runClassicalOptimization, runQAOASimulation } from "../lib/optimization";
import { getMissionHistory, saveMissionToHistory } from "../lib/history";
import rawMissions from "../data/missions.json";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  Line,
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
  Layers,
  BookOpen,
  CheckSquare,
  Square,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Fuel,
  DollarSign,
  Shield,
  Activity,
  ArrowRight,
  Info,
  Calendar,
  Rocket,
  Tag,
  BookmarkPlus,
  RefreshCw,
  Search,
  CheckCircle2,
} from "lucide-react";

export const ITERATION_PALETTE = [
  { name: "Cyan", stroke: "#06b6d4", bg: "bg-cyan-500", text: "text-cyan-400", border: "border-cyan-500" },
  { name: "Amber", stroke: "#f59e0b", bg: "bg-amber-500", text: "text-amber-400", border: "border-amber-500" },
  { name: "Emerald", stroke: "#10b981", bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500" },
  { name: "Rose", stroke: "#f43f5e", bg: "bg-rose-500", text: "text-rose-400", border: "border-rose-500" },
  { name: "Purple", stroke: "#a855f7", bg: "bg-purple-500", text: "text-purple-400", border: "border-purple-500" },
  { name: "Sky", stroke: "#38bdf8", bg: "bg-sky-500", text: "text-sky-400", border: "border-sky-500" },
  { name: "Orange", stroke: "#fb923c", bg: "bg-orange-500", text: "text-orange-400", border: "border-orange-500" },
  { name: "Indigo", stroke: "#818cf8", bg: "bg-indigo-500", text: "text-indigo-400", border: "border-indigo-500" },
];

export interface MultiIterationHistoricalOverlayProps {
  activeMission: Mission;
  history?: HistoryEntry[];
  allMissions?: Mission[];
  onOpenLogbook?: () => void;
  onSelectMission?: (mission: Mission) => void;
  onSaveCurrentToHistory?: (mission: Mission) => void;
}

export type OverlayChartMode =
  | "unified" // Single composed chart combining trajectory altitude + optimization objective
  | "trajectory" // Altitude vs Flight Time overlay
  | "aerodynamics" // Velocity & Dynamic Pressure Max-Q overlay
  | "optimization_vector" // Multi-objective optimization metrics comparison
  | "pareto"; // Cost vs Fuel Saved trade-off space

export interface SelectedIterationItem {
  id: string;
  isCurrent: boolean;
  iterationNum: number | string;
  label: string;
  subLabel: string;
  mission: Mission;
  color: (typeof ITERATION_PALETTE)[0];
  historyEntry?: HistoryEntry;
  trajectory: TrajectoryData;
  classicalObjective: number;
  quantumObjective: number;
  fuelSavedKg: number;
  launchCostMusd: number;
  riskScore: number;
  fuelConsumptionKg: number;
  apogeeKm: number;
  finalVelocityMs: number;
  maxQKPa: number;
  burnTimeSec: number;
  notes?: string;
  tags?: string[];
  timestamp?: string;
}

export const MultiIterationHistoricalOverlay: React.FC<MultiIterationHistoricalOverlayProps> = ({
  activeMission,
  history: propHistory,
  allMissions = [],
  onOpenLogbook,
  onSelectMission,
  onSaveCurrentToHistory,
}) => {
  // Local history state synced with localStorage or props
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>(() => {
    return propHistory && propHistory.length > 0 ? propHistory : getMissionHistory();
  });

  // Keep local history updated when prop changes
  useEffect(() => {
    if (propHistory && propHistory.length > 0) {
      setLocalHistory(propHistory);
    } else {
      setLocalHistory(getMissionHistory());
    }
  }, [propHistory]);

  // Search & Tag Filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [chartMode, setChartMode] = useState<OverlayChartMode>("unified");
  const [trajectoryMetric, setTrajectoryMetric] = useState<"altitude" | "velocity" | "dynamic_pressure">("altitude");
  const [includeActiveMission, setIncludeActiveMission] = useState<boolean>(true);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Selected iteration IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pre-seed sample historical runs if history is empty so it's immediately testable
  const effectiveHistory = useMemo<HistoryEntry[]>(() => {
    if (localHistory.length > 0) return localHistory;

    // Build 4 rich benchmark iterations from raw dataset with varied logbook notes & tags
    const benchmarkMissions = (rawMissions as any[]).slice(0, 4);
    return benchmarkMissions.map((raw, idx) => {
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

      const c = runClassicalOptimization(m);
      const q = runQAOASimulation(m, 1, 1024);

      const sampleNotes = [
        "Nominal gravity turn profile. High thrust-to-weight margin in first stage. QAOA circuit converged on feasible ground state bitstring with zero constraint penalties.",
        "Mid-window launch offset evaluated with higher aerodynamic loading during transonic regime. Fuel consumption reduced by 4.2% via classical differential pruning.",
        "Aggressive trajectory mode tested. Achieved higher insertion velocity but dynamic pressure max-Q elevated near 38 kPa. Structural acoustic margin acceptable.",
        "Weather hold simulated during morning squall. Trajectory shifted to late window; optimization objective improved cost by $1.8M while maintaining safety clearance.",
      ];

      const sampleTags = [
        ["Propulsion Margin", "QAOA Convergence"],
        ["Launch Window", "Propulsion Margin"],
        ["Aerodynamic Max-Q", "Flight Safety"],
        ["Weather Hold", "Launch Window"],
      ];

      return {
        id: `seed_hist_${m.mission_id}_${idx}`,
        timestamp: `Iter #${idx + 1} · ${m.launch_date.slice(5)}`,
        mission_id: m.mission_id,
        satellite_name: m.satellite_name,
        rocket: m.rocket,
        target_orbit: m.target_orbit,
        altitude: m.altitude,
        payload_mass: m.payload_mass,
        selected_window: c.selected_configuration.window_name,
        selected_trajectory: c.selected_configuration.trajectory_name,
        selected_mode: c.selected_configuration.mode_name,
        classical_objective: c.optimized.objective_value,
        quantum_objective: q.decoded_plan.objective_value,
        best_bitstring: q.best_bitstring,
        fuel_consumption_kg: c.optimized.fuel_consumption_kg,
        fuel_saved_kg: Math.round(Math.max(0, c.baseline.fuel_consumption_kg - c.optimized.fuel_consumption_kg)),
        launch_cost_musd: c.optimized.launch_cost_musd,
        risk_score: c.optimized.risk_score,
        mission: m,
        notes: sampleNotes[idx] || "Standard benchmark trajectory log.",
        tags: sampleTags[idx] || ["Propulsion Margin"],
        notes_updated_at: "Pre-calibrated",
      };
    });
  }, [localHistory]);

  // Initial selection: select first 2 historical iterations
  useEffect(() => {
    if (selectedIds.length === 0 && effectiveHistory.length > 0) {
      const initial = effectiveHistory.slice(0, 2).map((h) => h.id);
      setSelectedIds(initial);
    }
  }, [effectiveHistory, selectedIds.length]);

  // Available unique tags from history
  const allAvailableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    effectiveHistory.forEach((h) => {
      (h.tags || []).forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [effectiveHistory]);

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return effectiveHistory.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.satellite_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mission_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.rocket.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag =
        selectedTagFilter === "all" || (item.tags || []).includes(selectedTagFilter);

      return matchesSearch && matchesTag;
    });
  }, [effectiveHistory, searchQuery, selectedTagFilter]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredHistory.map((h) => h.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleSelectLatest = (count: number) => {
    setSelectedIds(effectiveHistory.slice(0, count).map((h) => h.id));
  };

  // Snapshot active mission to history
  const handleSnapshotActive = () => {
    const classical = runClassicalOptimization(activeMission);
    const qaoa = runQAOASimulation(activeMission, 1, 1024);
    const updated = saveMissionToHistory(activeMission, classical, qaoa);
    setLocalHistory(updated);
    if (onSaveCurrentToHistory) {
      onSaveCurrentToHistory(activeMission);
    }
    setSavedSuccessMsg(`Current run "${activeMission.satellite_name}" archived to Logbook!`);
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  // Build compiled items for all selected iterations (+ optionally the active mission)
  const compiledSelectedItems = useMemo<SelectedIterationItem[]>(() => {
    const items: SelectedIterationItem[] = [];
    let colorIdx = 0;

    // Optional Active Mission as primary or comparison series
    if (includeActiveMission) {
      const activeColor = ITERATION_PALETTE[colorIdx % ITERATION_PALETTE.length];
      colorIdx++;
      const traj = simulateAscentTrajectory(activeMission, 2.0);
      const c = runClassicalOptimization(activeMission);
      const q = runQAOASimulation(activeMission, 1, 1024);

      items.push({
        id: "active_current_mission",
        isCurrent: true,
        iterationNum: "Active",
        label: `[Active] ${activeMission.satellite_name}`,
        subLabel: `${activeMission.rocket} · ${activeMission.target_orbit} (${activeMission.altitude} km)`,
        mission: activeMission,
        color: activeColor,
        trajectory: traj,
        classicalObjective: c.optimized.objective_value,
        quantumObjective: q.decoded_plan.objective_value,
        fuelSavedKg: Math.round(Math.max(0, c.baseline.fuel_consumption_kg - c.optimized.fuel_consumption_kg)),
        launchCostMusd: c.optimized.launch_cost_musd,
        riskScore: c.optimized.risk_score,
        fuelConsumptionKg: c.optimized.fuel_consumption_kg,
        apogeeKm: traj.summary.max_altitude_km,
        finalVelocityMs: traj.summary.final_velocity_ms,
        maxQKPa: traj.summary.max_dynamic_pressure_kPa,
        burnTimeSec: traj.summary.burn_time_sec,
        notes: "Current active workspace configuration being optimized.",
        tags: ["Active Workspace"],
        timestamp: "Live Current",
      });
    }

    // Historical items selected
    effectiveHistory.forEach((h, hIdx) => {
      if (selectedIds.includes(h.id)) {
        const itemColor = ITERATION_PALETTE[colorIdx % ITERATION_PALETTE.length];
        colorIdx++;
        const traj = simulateAscentTrajectory(h.mission, 2.0);

        items.push({
          id: h.id,
          isCurrent: false,
          iterationNum: `#${hIdx + 1}`,
          label: `Iter #${hIdx + 1}: ${h.satellite_name}`,
          subLabel: `${h.rocket} · ${h.target_orbit} (${h.altitude} km)`,
          mission: h.mission,
          color: itemColor,
          historyEntry: h,
          trajectory: traj,
          classicalObjective: h.classical_objective,
          quantumObjective: h.quantum_objective,
          fuelSavedKg: h.fuel_saved_kg,
          launchCostMusd: h.launch_cost_musd,
          riskScore: h.risk_score,
          fuelConsumptionKg: h.fuel_consumption_kg,
          apogeeKm: traj.summary.max_altitude_km,
          finalVelocityMs: traj.summary.final_velocity_ms,
          maxQKPa: traj.summary.max_dynamic_pressure_kPa,
          burnTimeSec: traj.summary.burn_time_sec,
          notes: h.notes,
          tags: h.tags,
          timestamp: h.timestamp,
        });
      }
    });

    return items;
  }, [includeActiveMission, activeMission, effectiveHistory, selectedIds]);

  // Construct trajectory time-series data for chart overlays
  // Sample every 6 seconds from t=0 to 600 seconds
  const trajectoryTimeSeriesData = useMemo(() => {
    if (compiledSelectedItems.length === 0) return [];

    const maxBurnTime = Math.max(
      ...compiledSelectedItems.map((item) => item.trajectory.summary.burn_time_sec || 500)
    );
    const maxTime = Math.min(1000, Math.max(300, Math.ceil(maxBurnTime / 20) * 20));
    const step = 6;
    const numPoints = Math.floor(maxTime / step) + 1;

    const data: any[] = [];

    for (let i = 0; i < numPoints; i++) {
      const t = i * step;
      const point: any = { time: t };

      compiledSelectedItems.forEach((item) => {
        const times = item.trajectory.time;
        // Find closest index in times array
        let closestIdx = 0;
        let minDiff = 999999;
        for (let j = 0; j < times.length; j++) {
          const diff = Math.abs(times[j] - t);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = j;
          }
        }

        // Metrics for this item at time t
        const alt = Number(item.trajectory.altitude_km[closestIdx]?.toFixed(1) || 0);
        const vel = Number(item.trajectory.velocity_ms[closestIdx]?.toFixed(0) || 0);
        const q = Number(item.trajectory.dynamic_pressure_kPa[closestIdx]?.toFixed(1) || 0);
        const downrange = Number(item.trajectory.downrange_km[closestIdx]?.toFixed(1) || 0);

        point[`alt_${item.id}`] = alt;
        point[`vel_${item.id}`] = vel;
        point[`q_${item.id}`] = q;
        point[`downrange_${item.id}`] = downrange;

        // Overlay optimization target / reference value for unified composed chart
        point[`opt_obj_${item.id}`] = Number(item.classicalObjective.toFixed(2));
      });

      data.push(point);
    }

    return data;
  }, [compiledSelectedItems]);

  // Construct discrete iteration comparative data (for bar / vector overlay chart)
  const iterationComparativeData = useMemo(() => {
    return compiledSelectedItems.map((item) => ({
      name: item.label,
      id: item.id,
      color: item.color.stroke,
      classicalObjective: Number(item.classicalObjective.toFixed(2)),
      quantumObjective: Number(item.quantumObjective.toFixed(2)),
      fuelSaved: item.fuelSavedKg,
      fuelConsumptionTons: Number((item.fuelConsumptionKg / 1000).toFixed(1)),
      launchCost: item.launchCostMusd,
      riskScore: item.riskScore,
      apogeeKm: Number(item.apogeeKm.toFixed(1)),
      finalVelocity: Number(item.finalVelocityMs.toFixed(0)),
      maxQKPa: Number(item.maxQKPa.toFixed(1)),
      burnTime: item.burnTimeSec,
      notes: item.notes || "No notes recorded.",
      tags: item.tags || [],
    }));
  }, [compiledSelectedItems]);

  // Top summary KPIs across selected iterations
  const comparativeKPIs = useMemo(() => {
    if (compiledSelectedItems.length === 0) return null;

    const bestObjItem = [...compiledSelectedItems].sort(
      (a, b) => a.classicalObjective - b.classicalObjective
    )[0];
    const bestFuelItem = [...compiledSelectedItems].sort((a, b) => b.fuelSavedKg - a.fuelSavedKg)[0];
    const lowestCostItem = [...compiledSelectedItems].sort(
      (a, b) => a.launchCostMusd - b.launchCostMusd
    )[0];
    const highestApogeeItem = [...compiledSelectedItems].sort((a, b) => b.apogeeKm - a.apogeeKm)[0];

    return {
      count: compiledSelectedItems.length,
      bestObj: { val: bestObjItem.classicalObjective.toFixed(2), label: bestObjItem.label, color: bestObjItem.color },
      bestFuelSaved: { val: `${bestFuelItem.fuelSavedKg.toLocaleString()} kg`, label: bestFuelItem.label, color: bestFuelItem.color },
      lowestCost: { val: `$${lowestCostItem.launchCostMusd.toFixed(2)}M`, label: lowestCostItem.label, color: lowestCostItem.color },
      highestApogee: { val: `${highestApogeeItem.apogeeKm.toFixed(1)} km`, label: highestApogeeItem.label, color: highestApogeeItem.color },
    };
  }, [compiledSelectedItems]);

  return (
    <div className="space-y-6">
      {/* Section Header & Master Controls */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/80 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm uppercase font-mono text-cyan-400 font-semibold tracking-wider">
                  Logbook Historical Analysis
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 border border-cyan-800/80 text-cyan-300 font-medium">
                  {compiledSelectedItems.length} Iterations Overlaid
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">
                Multi-Iteration Trajectory &amp; Optimization Overlay
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Select historical iterations from the engineering logbook to superimpose their simulated flight arcs,
                apogees, aerodynamic dynamic pressure curves, and multi-objective optimization metrics on a single unified chart.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Snapshot Button */}
            <button
              onClick={handleSnapshotActive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Snapshot active workspace mission parameters to history"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Snapshot Active Run</span>
            </button>

            {/* Open Full Logbook Drawer */}
            {onOpenLogbook && (
              <button
                onClick={onOpenLogbook}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 rounded-lg transition-colors cursor-pointer"
                title="Open Logbook sidebar to view and edit notes"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open Field Notes</span>
              </button>
            )}
          </div>
        </div>

        {savedSuccessMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
        )}

        {/* Iteration Selection Strip */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Select Iterations to Overlay:</span>
              </span>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  onClick={() => handleSelectLatest(3)}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
                >
                  Latest 3
                </button>
                <button
                  onClick={handleSelectAllFiltered}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Search & Tag Filter in Strip */}
            <div className="flex items-center gap-2">
              {/* Tag Filter Dropdown */}
              {allAvailableTags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-500" />
                  <select
                    value={selectedTagFilter}
                    onChange={(e) => setSelectedTagFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-md px-2 py-1 font-mono focus:outline-none focus:border-cyan-600 cursor-pointer"
                  >
                    <option value="all">All Tags ({allAvailableTags.length})</option>
                    {allAvailableTags.map((t) => (
                      <option key={t} value={t}>
                        #{t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter runs or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md pl-7 pr-2 py-1 w-44 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-600"
                />
              </div>
            </div>
          </div>

          {/* Iteration Cards Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 scrollbar-thin">
            {/* Active Workspace Mission Card */}
            <div
              onClick={() => setIncludeActiveMission(!includeActiveMission)}
              className={`p-3 rounded-lg border transition-all cursor-pointer select-none ${
                includeActiveMission
                  ? "bg-slate-950 border-cyan-500/80 shadow-xs shadow-cyan-500/20"
                  : "bg-slate-950/60 border-slate-800/80 opacity-60 hover:opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] font-bold ${
                      includeActiveMission
                        ? "bg-cyan-500 border-cyan-400 text-slate-950"
                        : "border-slate-700 bg-slate-900"
                    }`}
                  >
                    {includeActiveMission && "✓"}
                  </div>
                  <span className="text-xs font-bold text-white font-sans truncate">
                    [Active] {activeMission.satellite_name}
                  </span>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" title="Active Series: Cyan" />
              </div>

              <div className="mt-1.5 text-[11px] font-mono text-slate-400 space-y-0.5">
                <div className="truncate">
                  {activeMission.rocket} · {activeMission.target_orbit} ({activeMission.altitude} km)
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px] pt-1 border-t border-slate-800/60">
                  <span className="text-cyan-300 font-semibold">Live Workspace</span>
                  <span className="text-slate-400">${activeMission.launch_cost}M</span>
                </div>
              </div>
            </div>

            {/* Historical Iterations */}
            {filteredHistory.map((h, idx) => {
              const isSelected = selectedIds.includes(h.id);
              // Find matching color from compiled items or palette
              const itemMatch = compiledSelectedItems.find((c) => c.id === h.id);
              const colorStroke = itemMatch ? itemMatch.color.stroke : "#94a3b8";
              const hasNotes = Boolean(h.notes && h.notes.trim().length > 0);

              return (
                <div
                  key={h.id}
                  onClick={() => handleToggleSelect(h.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                    isSelected
                      ? "bg-slate-950 border-cyan-500/80 shadow-xs shadow-cyan-500/20"
                      : "bg-slate-950/60 border-slate-800/80 opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    borderColor: isSelected ? colorStroke : undefined,
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] font-bold ${
                            isSelected
                              ? "bg-cyan-500 border-cyan-400 text-slate-950"
                              : "border-slate-700 bg-slate-900"
                          }`}
                          style={{
                            backgroundColor: isSelected ? colorStroke : undefined,
                            borderColor: isSelected ? colorStroke : undefined,
                          }}
                        >
                          {isSelected && "✓"}
                        </div>
                        <span className="text-xs font-bold text-slate-200 font-sans truncate">
                          #{idx + 1} {h.satellite_name}
                        </span>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: colorStroke }}
                        title={`Color: ${colorStroke}`}
                      />
                    </div>

                    <div className="mt-1 text-[11px] font-mono text-slate-400 truncate">
                      {h.rocket} · {h.target_orbit} ({h.altitude} km)
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-800/60 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-emerald-400 font-medium">-{h.fuel_saved_kg} kg fuel</span>
                      <span className="text-slate-300 font-bold">${h.launch_cost_musd}M</span>
                    </div>

                    {/* Logbook snippet if present */}
                    {hasNotes && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-300 font-sans truncate bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40">
                        <BookOpen className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                        <span className="truncate">{h.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Comparative Badge Ribbon */}
      {comparativeKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span className="uppercase">Best Objective Score</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-bold font-mono text-cyan-300">{comparativeKPIs.bestObj.val}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{comparativeKPIs.bestObj.label}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span className="uppercase">Max Fuel Saved</span>
              <Fuel className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold font-mono text-emerald-300">{comparativeKPIs.bestFuelSaved.val}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{comparativeKPIs.bestFuelSaved.label}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span className="uppercase">Lowest Launch Cost</span>
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono text-amber-300">{comparativeKPIs.lowestCost.val}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{comparativeKPIs.lowestCost.label}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span className="uppercase">Highest Orbit Apogee</span>
              <Rocket className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-bold font-mono text-purple-300">{comparativeKPIs.highestApogee.val}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{comparativeKPIs.highestApogee.label}</div>
          </div>
        </div>
      )}

      {/* Main Single Chart Canvas Container */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        {/* Chart View Modes & Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase">Overlay Mode:</span>
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                onClick={() => setChartMode("unified")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                  chartMode === "unified"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Unified Ascent &amp; Optimization
              </button>

              <button
                onClick={() => setChartMode("trajectory")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                  chartMode === "trajectory"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Flight Trajectory Arcs
              </button>

              <button
                onClick={() => setChartMode("aerodynamics")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                  chartMode === "aerodynamics"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Velocity &amp; Dynamic Pressure
              </button>

              <button
                onClick={() => setChartMode("optimization_vector")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                  chartMode === "optimization_vector"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Multi-Objective Metric Bars
              </button>

              <button
                onClick={() => setChartMode("pareto")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                  chartMode === "pareto"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Cost vs Fuel Trade-Off
              </button>
            </div>
          </div>

          {/* Sub-selector for trajectory metric when in trajectory mode */}
          {chartMode === "trajectory" && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <span>Metric:</span>
              <select
                value={trajectoryMetric}
                onChange={(e) => setTrajectoryMetric(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value="altitude">Altitude vs Time (km)</option>
                <option value="velocity">Velocity vs Time (m/s)</option>
                <option value="dynamic_pressure">Max-Q Dynamic Pressure (kPa)</option>
              </select>
            </div>
          )}
        </div>

        {/* Chart Render Area */}
        {compiledSelectedItems.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <Layers className="w-8 h-8 text-slate-600" />
            <div className="text-sm font-semibold text-slate-300">No Iterations Selected for Chart Overlay</div>
            <p className="text-xs text-slate-500 max-w-md font-sans">
              Check one or more historical iterations from the selection grid above or toggle the active workspace
              mission to render simultaneous trajectory and optimization curves on this chart.
            </p>
            <button
              onClick={() => handleSelectLatest(2)}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              Select Top 2 Iterations
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chart Canvas */}
            <div className="w-full h-88 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 pt-4">
              {/* MODE 1: UNIFIED ASCENT & OPTIMIZATION COMPOSED CHART */}
              {chartMode === "unified" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trajectoryTimeSeriesData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit="s"
                      label={{ value: "Flight Elapsed Time (s)", position: "insideBottom", offset: -12, fill: "#64748b", fontSize: 11 }}
                    />
                    {/* Left Y Axis: Trajectory Altitude */}
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit=" km"
                      label={{ value: "Trajectory Altitude (km)", angle: -90, position: "insideLeft", offset: 12, fill: "#38bdf8", fontSize: 11 }}
                    />
                    {/* Right Y Axis: Optimization Objective Score */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      domain={["auto", "auto"]}
                      label={{ value: "Optimization Objective (Score)", angle: 90, position: "insideRight", offset: 12, fill: "#f59e0b", fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-2xl text-xs font-mono space-y-2 max-w-sm">
                            <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1 flex items-center justify-between">
                              <span>Flight Time: {label} seconds</span>
                              <span className="text-[10px] text-slate-500 uppercase">Unified Overlay</span>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {compiledSelectedItems.map((item) => {
                                const altVal = payload.find((p) => p.dataKey === `alt_${item.id}`)?.value;
                                return (
                                  <div key={item.id} className="p-1 rounded bg-slate-900/60 border border-slate-800/60 space-y-0.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-bold flex items-center gap-1.5" style={{ color: item.color.stroke }}>
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color.stroke }} />
                                        <span>{item.label}</span>
                                      </span>
                                      <span className="text-slate-300 font-bold">{altVal !== undefined ? `${altVal} km` : "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                      <span>Obj: {item.classicalObjective.toFixed(2)}</span>
                                      <span>Cost: ${item.launchCostMusd}M</span>
                                      <span className="text-emerald-400">-{item.fuelSavedKg} kg fuel</span>
                                    </div>
                                    {item.notes && (
                                      <div className="text-[9px] text-amber-300/90 font-sans italic truncate">
                                        📝 {item.notes}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(val: string) => {
                        const clean = val.replace(/^alt_/, "").replace(/^opt_obj_/, "Obj: ");
                        const match = compiledSelectedItems.find((c) => c.id === clean || `alt_${c.id}` === val);
                        return <span className="text-[11px] font-mono text-slate-300">{match ? match.label : clean}</span>;
                      }}
                    />

                    {/* Render Trajectory Lines (Left Axis) */}
                    {compiledSelectedItems.map((item) => (
                      <Line
                        key={`line_alt_${item.id}`}
                        yAxisId="left"
                        type="monotone"
                        dataKey={`alt_${item.id}`}
                        name={item.label}
                        stroke={item.color.stroke}
                        strokeWidth={2.4}
                        dot={false}
                        activeDot={{ r: 5, stroke: item.color.stroke, strokeWidth: 2, fill: "#080b13" }}
                      />
                    ))}

                    {/* Render Horizontal Reference Lines for target orbital altitudes */}
                    {compiledSelectedItems.map((item, idx) => (
                      <ReferenceLine
                        key={`ref_target_${item.id}`}
                        yAxisId="left"
                        y={item.mission.altitude}
                        stroke={item.color.stroke}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* MODE 2: FLIGHT TRAJECTORY ARCS OVERLAY */}
              {chartMode === "trajectory" && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajectoryTimeSeriesData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit="s"
                      label={{ value: "Elapsed Time (seconds)", position: "insideBottom", offset: -12, fill: "#64748b", fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit={trajectoryMetric === "altitude" ? " km" : trajectoryMetric === "velocity" ? " m/s" : " kPa"}
                      label={{
                        value:
                          trajectoryMetric === "altitude"
                            ? "Ascent Altitude (km)"
                            : trajectoryMetric === "velocity"
                            ? "In-Flight Velocity (m/s)"
                            : "Aerodynamic Max-Q Dynamic Pressure (kPa)",
                        angle: -90,
                        position: "insideLeft",
                        offset: 12,
                        fill: "#38bdf8",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const metricPrefix =
                          trajectoryMetric === "altitude" ? "alt_" : trajectoryMetric === "velocity" ? "vel_" : "q_";
                        const metricUnit =
                          trajectoryMetric === "altitude" ? "km" : trajectoryMetric === "velocity" ? "m/s" : "kPa";

                        return (
                          <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-2xl text-xs font-mono space-y-2">
                            <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1">
                              t = {label}s · Trajectory Arc Comparison
                            </div>
                            <div className="space-y-1">
                              {compiledSelectedItems.map((item) => {
                                const val = payload.find((p) => p.dataKey === `${metricPrefix}${item.id}`)?.value;
                                return (
                                  <div key={item.id} className="flex items-center justify-between gap-4 text-[11px]">
                                    <span className="flex items-center gap-1.5" style={{ color: item.color.stroke }}>
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color.stroke }} />
                                      <span>{item.label}</span>
                                    </span>
                                    <span className="text-white font-bold">
                                      {val !== undefined ? `${val} ${metricUnit}` : "—"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(val: string) => {
                        const clean = val.replace(/^(alt|vel|q)_/, "");
                        const match = compiledSelectedItems.find((c) => c.id === clean || val.includes(c.id));
                        return <span className="text-[11px] font-mono text-slate-300">{match ? match.label : val}</span>;
                      }}
                    />
                    {compiledSelectedItems.map((item) => {
                      const dataKey =
                        trajectoryMetric === "altitude"
                          ? `alt_${item.id}`
                          : trajectoryMetric === "velocity"
                          ? `vel_${item.id}`
                          : `q_${item.id}`;
                      return (
                        <Line
                          key={`line_traj_${item.id}`}
                          type="monotone"
                          dataKey={dataKey}
                          name={item.label}
                          stroke={item.color.stroke}
                          strokeWidth={2.4}
                          dot={false}
                          activeDot={{ r: 5, stroke: item.color.stroke, strokeWidth: 2, fill: "#080b13" }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* MODE 3: VELOCITY & AERODYNAMIC DYNAMIC PRESSURE (MAX-Q) */}
              {chartMode === "aerodynamics" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trajectoryTimeSeriesData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit="s"
                      label={{ value: "Burn Time (seconds)", position: "insideBottom", offset: -12, fill: "#64748b", fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit=" m/s"
                      label={{ value: "Ascent Velocity (m/s)", angle: -90, position: "insideLeft", offset: 12, fill: "#38bdf8", fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit=" kPa"
                      label={{ value: "Dynamic Pressure q (kPa)", angle: 90, position: "insideRight", offset: 12, fill: "#f43f5e", fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-2xl text-xs font-mono space-y-2">
                            <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1">
                              t = {label}s · Aerodynamic Flight Loads
                            </div>
                            <div className="space-y-1">
                              {compiledSelectedItems.map((item) => {
                                const vel = payload.find((p) => p.dataKey === `vel_${item.id}`)?.value;
                                const q = payload.find((p) => p.dataKey === `q_${item.id}`)?.value;
                                return (
                                  <div key={item.id} className="flex items-center justify-between gap-3 text-[11px]">
                                    <span style={{ color: item.color.stroke }}>{item.label}:</span>
                                    <span className="text-white font-mono">
                                      {vel} m/s <span className="text-slate-500">|</span> {q} kPa
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(val: string) => {
                        return <span className="text-[11px] font-mono text-slate-300">{val}</span>;
                      }}
                    />
                    {compiledSelectedItems.map((item) => (
                      <Line
                        key={`vel_${item.id}`}
                        yAxisId="left"
                        type="monotone"
                        dataKey={`vel_${item.id}`}
                        name={`Vel: ${item.label}`}
                        stroke={item.color.stroke}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                    {compiledSelectedItems.map((item) => (
                      <Line
                        key={`q_${item.id}`}
                        yAxisId="right"
                        type="monotone"
                        dataKey={`q_${item.id}`}
                        name={`Max-Q: ${item.label}`}
                        stroke={item.color.stroke}
                        strokeWidth={1.8}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* MODE 4: MULTI-OBJECTIVE OPTIMIZATION METRIC BARS */}
              {chartMode === "optimization_vector" && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={iterationComparativeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-2xl text-xs font-mono space-y-1.5 max-w-xs">
                            <div className="font-bold text-white border-b border-slate-800 pb-1">{label}</div>
                            <div className="text-cyan-400">Classical Objective: {data.classicalObjective}</div>
                            <div className="text-amber-400">QAOA Quantum Objective: {data.quantumObjective}</div>
                            <div className="text-emerald-400">Fuel Saved: {data.fuelSaved.toLocaleString()} kg</div>
                            <div className="text-slate-300">Launch Cost: ${data.launchCost}M</div>
                            <div className="text-rose-400">Risk Score: {data.riskScore}/100</div>
                            <div className="text-purple-400">Achieved Apogee: {data.apogeeKm} km</div>
                            {data.notes && (
                              <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800 italic">
                                📝 {data.notes}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="classicalObjective" name="Classical Objective Score" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="quantumObjective" name="QAOA Energy Score" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="launchCost" name="Launch Cost ($M)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* MODE 5: PARETO TRADE-OFF SPACE (COST VS FUEL SAVED) */}
              {chartMode === "pareto" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={iterationComparativeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis
                      dataKey="launchCost"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit="M"
                      label={{ value: "Launch Cost ($ Million USD)", position: "insideBottom", offset: -12, fill: "#64748b", fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="fuelSaved"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit=" kg"
                      label={{ value: "Propellant Fuel Saved (kg)", angle: -90, position: "insideLeft", offset: 12, fill: "#10b981", fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-2xl text-xs font-mono space-y-1">
                            <div className="font-bold text-white border-b border-slate-800 pb-1">{data.name}</div>
                            <div className="text-emerald-400">Fuel Saved: {data.fuelSaved.toLocaleString()} kg</div>
                            <div className="text-amber-400">Cost: ${data.launchCost}M</div>
                            <div className="text-cyan-400">Objective: {data.classicalObjective}</div>
                            <div className="text-purple-400">Apogee: {data.apogeeKm} km</div>
                            {data.notes && (
                              <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800">
                                📝 {data.notes}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="fuelSaved" name="Fuel Saved (kg)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="classicalObjective" name="Objective Multiplier" stroke="#06b6d4" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Color-Coded Iteration Series Legend Tags with Notes Snippet */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {compiledSelectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                  style={{ borderLeftColor: item.color.stroke, borderLeftWidth: "3px" }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color.stroke }} />
                  <span className="font-bold text-slate-200">{item.label}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">{item.apogeeKm.toFixed(0)} km apogee</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-emerald-400">Obj: {item.classicalObjective.toFixed(1)}</span>
                  {item.notes && (
                    <span className="text-amber-400 text-[10px]" title={item.notes}>
                      📝
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Detailed Iteration Matrix & Logbook Notes Table */}
      {compiledSelectedItems.length > 0 && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 shadow-xl space-y-0">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                Cross-Iteration Engineering Matrix &amp; Field Notes
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Showing {compiledSelectedItems.length} selected runs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Iteration / Mission</th>
                  <th className="p-3">Rocket &amp; Target Orbit</th>
                  <th className="p-3 text-cyan-400">Achieved Apogee</th>
                  <th className="p-3 text-emerald-400">Fuel Saved</th>
                  <th className="p-3 text-amber-400">Launch Cost</th>
                  <th className="p-3">Classical vs Quantum</th>
                  <th className="p-3">Engineering Logbook Note &amp; Tags</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {compiledSelectedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-sans font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color.stroke }}
                        />
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{item.label}</span>
                            {item.isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.timestamp}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-slate-400">
                      <div>{item.mission.rocket}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.mission.target_orbit} · {item.mission.payload_mass} kg
                      </div>
                    </td>

                    <td className="p-3 font-semibold text-cyan-300 tabular-nums">
                      <div>{item.apogeeKm.toFixed(1)} km</div>
                      <div className="text-[10px] text-slate-500">{item.finalVelocityMs.toFixed(0)} m/s burnout</div>
                    </td>

                    <td className="p-3 font-semibold text-emerald-300 tabular-nums">
                      <div>-{item.fuelSavedKg.toLocaleString()} kg</div>
                      <div className="text-[10px] text-slate-500">
                        Total: {(item.fuelConsumptionKg / 1000).toFixed(0)}t
                      </div>
                    </td>

                    <td className="p-3 font-semibold text-amber-300 tabular-nums">
                      <div>${item.launchCostMusd.toFixed(2)}M</div>
                      <div className="text-[10px] text-slate-500">Risk: {item.riskScore.toFixed(0)}/100</div>
                    </td>

                    <td className="p-3 tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <span className="text-cyan-400">{item.classicalObjective.toFixed(2)}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-amber-400">{item.quantumObjective.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Classic / QAOA</div>
                    </td>

                    <td className="p-3 font-sans text-slate-300 max-w-xs">
                      {item.notes ? (
                        <div className="space-y-1">
                          <p className="text-[11px] text-slate-300 line-clamp-2">{item.notes}</p>
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map((t) => (
                                <span
                                  key={t}
                                  className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-cyan-300"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">No notes recorded</span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {!item.isCurrent && onSelectMission && (
                        <button
                          onClick={() => onSelectMission(item.mission)}
                          className="px-2.5 py-1 text-[11px] font-mono bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700 rounded transition-all cursor-pointer whitespace-nowrap"
                          title="Load this iteration's mission into active workspace"
                        >
                          Load Run
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
