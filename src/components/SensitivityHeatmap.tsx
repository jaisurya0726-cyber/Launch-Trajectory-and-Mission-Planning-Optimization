import React, { useState, useMemo } from "react";
import { Mission } from "../types";
import { simulateAscentTrajectory, EARTH_RADIUS_M, EARTH_MU } from "../lib/physics";
import {
  Grid,
  Sliders,
  Target,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Gauge,
  ArrowRight,
  TrendingUp,
  Info,
} from "lucide-react";

interface SensitivityHeatmapProps {
  mission: Mission;
  onApplyScenario?: (params: { angleDeg: number; fuelDeltaPct: number }) => void;
  currentAngleDeviation?: number;
}

interface CellData {
  angle: number;
  fuelPct: number;
  fuelMassKg: number;
  achievedAltKm: number;
  deltaAltKm: number;
  finalVelMs: number;
  burnTimeSec: number;
  maxQkPa: number;
  maxG: number;
  efficiency: number;
  status: "Optimal" | "Nominal" | "Marginal" | "Shortfall" | "Overstressed";
  isBaseline: boolean;
}

const ANGLE_STEPS = [-4.0, -2.5, -1.0, 0.0, 1.0, 2.5, 4.0];
const FUEL_STEPS = [15, 10, 5, 0, -5, -10, -15]; // Rows from +15% down to -15%

export const SensitivityHeatmap: React.FC<SensitivityHeatmapProps> = ({
  mission,
  onApplyScenario,
  currentAngleDeviation = 0,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<"efficiency" | "altitude" | "velocity" | "maxq">("efficiency");
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);

  // Required circular orbital velocity at target altitude
  const targetAltM = mission.altitude * 1000;
  const vOrbitalReq = Math.sqrt(EARTH_MU / (EARTH_RADIUS_M + targetAltM));

  // Compute the 7x7 matrix
  const { matrix, optimalCell, baselineCell } = useMemo<{
    matrix: CellData[][];
    optimalCell: CellData | null;
    baselineCell: CellData | null;
  }>(() => {
    const grid: CellData[][] = [];
    let bestCell: CellData | null = null;
    let baseCell: CellData | null = null;

    FUEL_STEPS.forEach((fuelPct) => {
      const row: CellData[] = [];
      const fuelMultiplier = 1 + fuelPct / 100;
      const testFuel = mission.fuel_consumption * fuelMultiplier;

      const simMission: Mission = {
        ...mission,
        fuel_consumption: testFuel,
        fuel_mass: mission.fuel_mass * fuelMultiplier,
      };

      ANGLE_STEPS.forEach((angle) => {
        // Fast RK4 run
        const traj = simulateAscentTrajectory(simMission, 3.5, Math.min(mission.flight_time, 900), angle);
        const achievedAlt = traj.summary.max_altitude_km;
        const deltaAlt = Number((achievedAlt - mission.altitude).toFixed(1));
        const finalVel = traj.summary.final_velocity_ms;
        const maxQ = traj.summary.max_dynamic_pressure_kPa;
        const maxG = traj.summary.max_acceleration_g;
        const burnTime = traj.summary.burn_time_sec;

        // 1. Altitude Insertion Accuracy
        const altDevRatio = Math.abs(achievedAlt - mission.altitude) / Math.max(1, mission.altitude);
        let altScore = Math.max(0, 1 - altDevRatio * 3.5);
        if (achievedAlt < mission.altitude) {
          altScore *= Math.max(0.2, achievedAlt / mission.altitude);
        }

        // 2. Velocity Score
        const velRatio = finalVel / vOrbitalReq;
        const velScore = Math.max(0, Math.min(1.0, velRatio));

        // 3. Propellant Mass Penalty
        // Excess fuel carries structural payload penalty; deficit leads to starvation
        let fuelScore = 1.0;
        if (fuelPct > 0) {
          fuelScore = 1.0 - (fuelPct / 100) * 0.45; // parasitic mass penalty
        } else {
          fuelScore = 1.0 - Math.abs(fuelPct / 100) * 1.2; // fuel starvation penalty
        }

        // 4. Combined Orbit Insertion Mission Efficiency (%)
        let rawEfficiency = (altScore * 0.42 + velScore * 0.42 + fuelScore * 0.16) * 100;

        // Structural and aerodynamic stress penalties
        if (maxQ > 82) rawEfficiency -= (maxQ - 82) * 0.6;
        if (maxG > 5.5) rawEfficiency -= (maxG - 5.5) * 4.0;
        if (achievedAlt < mission.altitude * 0.7) rawEfficiency *= 0.6;

        const efficiency = Number(Math.max(14.0, Math.min(98.8, rawEfficiency)).toFixed(1));

        let status: CellData["status"] = "Nominal";
        if (efficiency >= 92) status = "Optimal";
        else if (efficiency >= 80) status = "Nominal";
        else if (efficiency >= 60) status = "Marginal";
        else if (achievedAlt < mission.altitude * 0.75) status = "Shortfall";
        else status = "Overstressed";

        const isBaseline = angle === 0 && fuelPct === 0;

        const cell: CellData = {
          angle,
          fuelPct,
          fuelMassKg: Math.round(testFuel),
          achievedAltKm: Number(achievedAlt.toFixed(1)),
          deltaAltKm: deltaAlt,
          finalVelMs: Number(finalVel.toFixed(0)),
          burnTimeSec: Number(burnTime.toFixed(0)),
          maxQkPa: Number(maxQ.toFixed(1)),
          maxG: Number(maxG.toFixed(2)),
          efficiency,
          status,
          isBaseline,
        };

        row.push(cell);

        if (!bestCell || cell.efficiency > bestCell.efficiency) {
          bestCell = cell;
        }
        if (isBaseline) {
          baseCell = cell;
        }
      });

      grid.push(row);
    });

    return { matrix: grid, optimalCell: bestCell, baselineCell: baseCell };
  }, [mission, vOrbitalReq]);

  // Active cell to show in inspector (hovered takes precedence, then selected, then baseline)
  const activeInspector = hoveredCell || selectedCell || baselineCell || matrix[3][3];

  // Helper for cell background color styling based on metric
  const getCellBg = (cell: CellData) => {
    if (selectedMetric === "efficiency") {
      const e = cell.efficiency;
      if (e >= 92) return "bg-emerald-500 text-slate-950 font-bold hover:brightness-110";
      if (e >= 84) return "bg-emerald-600/80 text-white font-semibold hover:brightness-110";
      if (e >= 74) return "bg-cyan-600/75 text-white hover:brightness-110";
      if (e >= 62) return "bg-sky-700/70 text-slate-200 hover:brightness-110";
      if (e >= 48) return "bg-amber-600/80 text-white hover:brightness-110";
      if (e >= 35) return "bg-orange-700/80 text-white hover:brightness-110";
      return "bg-rose-900/85 text-rose-200 hover:brightness-110";
    }

    if (selectedMetric === "altitude") {
      const ratio = cell.achievedAltKm / mission.altitude;
      if (ratio >= 0.98 && ratio <= 1.05) return "bg-emerald-500 text-slate-950 font-bold";
      if (ratio >= 0.90) return "bg-cyan-600/80 text-white";
      if (ratio >= 0.75) return "bg-amber-600/80 text-white";
      return "bg-rose-900/85 text-rose-200";
    }

    if (selectedMetric === "velocity") {
      const v = cell.finalVelMs;
      if (v >= 7400) return "bg-emerald-500 text-slate-950 font-bold";
      if (v >= 6800) return "bg-cyan-600/80 text-white";
      if (v >= 6000) return "bg-amber-600/80 text-white";
      return "bg-rose-900/85 text-rose-200";
    }

    // maxq
    const q = cell.maxQkPa;
    if (q < 65) return "bg-emerald-600/80 text-white";
    if (q <= 76) return "bg-cyan-600/80 text-white";
    if (q <= 85) return "bg-amber-600/80 text-white font-bold";
    return "bg-rose-800 text-white font-bold";
  };

  const formatCellValue = (cell: CellData) => {
    if (selectedMetric === "efficiency") return `${cell.efficiency.toFixed(0)}%`;
    if (selectedMetric === "altitude") return `${cell.achievedAltKm.toFixed(0)}`;
    if (selectedMetric === "velocity") return `${cell.finalVelMs}`;
    return `${cell.maxQkPa.toFixed(0)}`;
  };

  return (
    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
            <Grid className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Dual-Variable Sensitivity Analysis Heatmap</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-indigo-800/80 bg-indigo-950/70 text-indigo-300">
                7×7 Discretized Solution Grid (49 Scenarios)
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans">
              Evaluates final orbit insertion mission efficiency across coupled Launch Angle (Δγ) and Propellant Mass (Δm_fuel) variations
            </div>
          </div>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
          {[
            { id: "efficiency", label: "Mission Efficiency (%)" },
            { id: "altitude", label: "Apogee (km)" },
            { id: "velocity", label: "Final Vel (m/s)" },
            { id: "maxq", label: "Max-Q (kPa)" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMetric(m.id as any)}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedMetric === m.id
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid & Scenario Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Heatmap Matrix Table (8 Columns on LG) */}
        <div className="lg:col-span-8 overflow-x-auto space-y-2">
          {/* X-Axis Header Label */}
          <div className="text-center text-xs font-mono font-semibold text-cyan-400">
            Launch Angle Deviation (Δγ in Degrees)
          </div>

          <div className="inline-block min-w-full bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
            <table className="w-full border-collapse text-xs font-mono">
              <thead>
                <tr>
                  <th className="p-1 text-[10px] text-slate-500 text-left font-normal border-b border-slate-800">
                    ΔFuel \ ΔAngle
                  </th>
                  {ANGLE_STEPS.map((deg) => (
                    <th
                      key={deg}
                      className={`p-1.5 text-center font-mono text-[11px] border-b border-slate-800 ${
                        deg === 0 ? "text-cyan-400 font-bold" : "text-slate-400"
                      }`}
                    >
                      {deg > 0 ? `+${deg}°` : `${deg}°`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, rIdx) => {
                  const fuelPct = FUEL_STEPS[rIdx];
                  return (
                    <tr key={fuelPct}>
                      {/* Y-Axis Row Header */}
                      <td className="p-1.5 text-[11px] text-slate-400 whitespace-nowrap font-mono border-r border-slate-800">
                        <span className={fuelPct === 0 ? "text-amber-400 font-bold" : ""}>
                          {fuelPct > 0 ? `+${fuelPct}%` : `${fuelPct}%`} Fuel
                        </span>
                      </td>

                      {/* Cells */}
                      {row.map((cell) => {
                        const isOptimal = optimalCell && cell.angle === optimalCell.angle && cell.fuelPct === optimalCell.fuelPct;
                        const isSelected = selectedCell && cell.angle === selectedCell.angle && cell.fuelPct === selectedCell.fuelPct;
                        const isHovered = hoveredCell && cell.angle === hoveredCell.angle && cell.fuelPct === hoveredCell.fuelPct;

                        return (
                          <td
                            key={`${cell.angle}_${cell.fuelPct}`}
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => setSelectedCell(cell)}
                            className="p-1 text-center cursor-pointer relative"
                          >
                            <div
                              className={`h-9 w-full rounded flex items-center justify-center text-[11px] transition-all transform ${getCellBg(
                                cell
                              )} ${
                                isSelected
                                  ? "ring-2 ring-white scale-105 z-20 shadow-lg shadow-cyan-500/30"
                                  : isHovered
                                  ? "scale-105 z-10 brightness-125"
                                  : ""
                              } ${cell.isBaseline ? "border border-amber-300" : ""}`}
                            >
                              <span>{formatCellValue(cell)}</span>

                              {/* Optimal Marker Star */}
                              {isOptimal && (
                                <span className="absolute -top-1 -right-1 text-[9px] text-amber-300 animate-pulse">
                                  ★
                                </span>
                              )}

                              {/* Baseline Marker Crosshair */}
                              {cell.isBaseline && (
                                <span className="absolute -bottom-1 -left-1 text-[8px] text-amber-300 font-bold">
                                  ⊙
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Matrix Legend Footer */}
            <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-3 border-t border-slate-800/80 mt-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-amber-300">★</span> Optimal Insertion Sweet-Spot ({optimalCell?.efficiency}%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-300">⊙</span> Baseline Nominal (0°, 0%)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Color Scale:</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-900 text-rose-200">Critical (&lt;40%)</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white">Marginal</span>
                <span className="px-1.5 py-0.2 rounded bg-cyan-600 text-white">Nominal</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-bold">Optimal (&gt;90%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scenario Telemetry Inspector Panel (4 Columns on LG) */}
        <div className="lg:col-span-4 bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Scenario Telemetry Inspector</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                activeInspector.status === "Optimal"
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : activeInspector.status === "Nominal"
                  ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                  : activeInspector.status === "Marginal"
                  ? "bg-amber-950 text-amber-300 border-amber-800"
                  : "bg-rose-950 text-rose-300 border-rose-800"
              }`}
            >
              {activeInspector.status}
            </span>
          </div>

          {/* Active Configuration Coordinates */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-900/70 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">LAUNCH ANGLE Δγ</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {activeInspector.angle > 0 ? `+${activeInspector.angle}°` : `${activeInspector.angle}°`}
              </span>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {activeInspector.angle === 0 ? "Nominal Pitch Profile" : activeInspector.angle > 0 ? "Steeper Ascent" : "Shallow Ascent"}
              </div>
            </div>

            <div className="p-2 bg-slate-900/70 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">PROPELLANT DELTA</span>
              <span className="text-sm font-bold text-amber-400 tabular-nums">
                {activeInspector.fuelPct > 0 ? `+${activeInspector.fuelPct}%` : `${activeInspector.fuelPct}%`}
              </span>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {activeInspector.fuelMassKg.toLocaleString()} kg total
              </div>
            </div>
          </div>

          {/* Calculated Output Metrics */}
          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Orbit Insertion Efficiency:</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                {activeInspector.efficiency.toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Achieved Apogee</span>
                <span className="font-bold text-white tabular-nums">{activeInspector.achievedAltKm} km</span>
                <span className={`text-[10px] block ${activeInspector.deltaAltKm >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                  {activeInspector.deltaAltKm >= 0 ? `+${activeInspector.deltaAltKm}` : activeInspector.deltaAltKm} km vs target
                </span>
              </div>

              <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Burnout Velocity</span>
                <span className="font-bold text-white tabular-nums">{activeInspector.finalVelMs} m/s</span>
                <span className="text-[10px] text-slate-500 block">
                  Req: {vOrbitalReq.toFixed(0)} m/s
                </span>
              </div>

              <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Peak Max-Q Load</span>
                <span className="font-bold text-amber-400 tabular-nums">{activeInspector.maxQkPa} kPa</span>
                <span className="text-[10px] text-slate-500 block">Dynamic pressure</span>
              </div>

              <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Peak G-Force Load</span>
                <span className="font-bold text-rose-400 tabular-nums">{activeInspector.maxG} g</span>
                <span className="text-[10px] text-slate-500 block">Limit: 6.0 g</span>
              </div>
            </div>
          </div>

          {/* Action Button: Apply Scenario */}
          {onApplyScenario && (
            <button
              onClick={() => onApplyScenario({ angleDeg: activeInspector.angle, fuelDeltaPct: activeInspector.fuelPct })}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Apply Δγ={activeInspector.angle}° &amp; Fuel={activeInspector.fuelPct}% to Active Simulation</span>
            </button>
          )}

          {/* Optimal Recommendation Summary */}
          {optimalCell && (
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-900/60 text-[11px] font-sans text-slate-300 space-y-1">
              <div className="font-semibold text-indigo-300 flex items-center gap-1">
                <span>Optimizer Insight:</span>
              </div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Maximum insertion efficiency is achieved at <strong className="text-white">Δγ={optimalCell.angle > 0 ? `+${optimalCell.angle}°` : `${optimalCell.angle}°`}</strong> with <strong className="text-white">{optimalCell.fuelPct > 0 ? `+${optimalCell.fuelPct}%` : `${optimalCell.fuelPct}%`} propellant</strong>, yielding an apogee of {optimalCell.achievedAltKm} km and {optimalCell.efficiency}% mission efficiency.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
