import React, { useState, useMemo } from "react";
import { Mission, QUBOResult } from "../types";
import { buildQUBOMatrix, VARIABLE_LABELS } from "../lib/optimization";
import { ArrowRight, Grid, Sliders, Info } from "lucide-react";

interface QUBOViewProps {
  mission: Mission;
  onProceedToQAOA: () => void;
}

export const QUBOView: React.FC<QUBOViewProps> = ({ mission, onProceedToQAOA }) => {
  const [penaltyWindow, setPenaltyWindow] = useState<number>(120);
  const [penaltyTrajectory, setPenaltyTrajectory] = useState<number>(120);
  const [penaltyMode, setPenaltyMode] = useState<number>(120);
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number; val: number } | null>(null);

  const quboData: QUBOResult = useMemo(() => {
    return buildQUBOMatrix(mission, penaltyWindow, penaltyTrajectory, penaltyMode);
  }, [mission, penaltyWindow, penaltyTrajectory, penaltyMode]);

  const Q = quboData.qubo_matrix;
  const n = quboData.num_qubits;

  // Find min and max for heatmap color scaling
  const allVals = Q.flat();
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);

  const getCellColor = (val: number, i: number, j: number) => {
    if (i === j) {
      // Diagonal linear term
      return val < 0
        ? "bg-rose-950/70 border-rose-800/80 text-rose-300"
        : "bg-cyan-950/70 border-cyan-800/80 text-cyan-300";
    }
    // Off-diagonal quadratic penalty/coupling
    if (val > 100) return "bg-amber-950/80 border-amber-800/70 text-amber-300";
    if (val > 0) return "bg-indigo-950/60 border-indigo-900/60 text-indigo-300";
    return "bg-slate-950 border-slate-900 text-slate-500";
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-mono text-cyan-400">Page 5 — QUBO &amp; Ising Hamiltonian Formulation</div>
          <div className="text-xl font-bold text-white mt-0.5">
            9-Qubit Binary Formulation: Cost(x) = xᵀ Q x
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Binary Register x ∈ &#123;0, 1&#125;⁹ · 3 Group Constraints (Window, Trajectory, Mode) · Energy Offset: {quboData.qubo_offset}
          </div>
        </div>

        <button
          onClick={onProceedToQAOA}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
        >
          <span>Run QAOA Simulation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Binary Register Mapping Definition */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Grid className="w-4 h-4 text-cyan-400" />
          <span>Discrete Aerospace Decisions Mapped to 9 Binary Qubits</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-xs font-mono">
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-semibold flex items-center justify-between">
              <span>Group 1: Launch Window</span>
              <span className="text-slate-500">∑ x₁..₃ = 1</span>
            </div>
            <div className="text-slate-300">x₁: Early Window (-15 min, calmer winds)</div>
            <div className="text-slate-300">x₂: Mid Window (Nominal T-0)</div>
            <div className="text-slate-300">x₃: Late Window (+15 min, thermal drift)</div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-semibold flex items-center justify-between">
              <span>Group 2: Trajectory Profile</span>
              <span className="text-slate-500">∑ x₄..₆ = 1</span>
            </div>
            <div className="text-slate-300">x₄: Direct Ascent (steep, high drag)</div>
            <div className="text-slate-300">x₅: Gravity Turn (optimal pitchover)</div>
            <div className="text-slate-300">x₆: Multi-Stage Ascent (staged insertion)</div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-semibold flex items-center justify-between">
              <span>Group 3: Propellant &amp; Mode</span>
              <span className="text-slate-500">∑ x₇..₉ = 1</span>
            </div>
            <div className="text-slate-300">x₇: Conservative Mode (+5% margin)</div>
            <div className="text-slate-300">x₈: Nominal Mode (standard reserves)</div>
            <div className="text-slate-300">x₉: Aggressive / Optimal (-5% margin)</div>
          </div>
        </div>
      </div>

      {/* Interactive QUBO Matrix Heatmap */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm font-semibold text-slate-200">
            9×9 Symmetric QUBO Matrix (Hover Cells for Interaction Values)
          </div>

          {hoveredCell ? (
            <div className="text-xs font-mono text-cyan-300 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
              Q[{VARIABLE_LABELS[hoveredCell.i]}, {VARIABLE_LABELS[hoveredCell.j]}] = {hoveredCell.val.toFixed(2)}
            </div>
          ) : (
            <div className="text-xs font-mono text-slate-500">
              Hover over matrix cells to inspect coefficients
            </div>
          )}
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid grid-cols-10 gap-1 text-center font-mono text-xs">
              <div className="p-2 text-slate-500 font-bold">Q_ij</div>
              {VARIABLE_LABELS.map((lbl, idx) => (
                <div key={idx} className="p-2 text-slate-400 font-bold truncate">
                  x{idx + 1}
                </div>
              ))}

              {Q.map((row, i) => (
                <React.Fragment key={i}>
                  <div className="p-2 text-slate-400 font-bold text-left flex items-center">
                    x{i + 1}
                  </div>
                  {row.map((val, j) => (
                    <div
                      key={j}
                      onMouseEnter={() => setHoveredCell({ i, j, val })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`p-2 rounded border transition-colors cursor-crosshair font-semibold tabular-nums ${getCellColor(
                        val,
                        i,
                        j
                      )}`}
                    >
                      {val.toFixed(0)}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-950 border border-rose-800" />
            Diagonal Linear (-P + Cost)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-950 border border-amber-800" />
            Constraint Penalty (+2P)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-950 border border-indigo-900" />
            Coupling Penalty
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-950 border border-slate-900" />
            Independent (0)
          </span>
        </div>
      </div>

      {/* Penalty Parameter Sliders */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Interactive Penalty Multipliers Calibration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono">
          <div className="space-y-2">
            <div className="flex justify-between text-slate-300">
              <span>P_window (Launch Window)</span>
              <span className="text-cyan-400 font-bold">{penaltyWindow}</span>
            </div>
            <input
              type="range"
              min={60}
              max={240}
              step={10}
              value={penaltyWindow}
              onChange={(e) => setPenaltyWindow(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-slate-300">
              <span>P_trajectory (Ascent Profile)</span>
              <span className="text-cyan-400 font-bold">{penaltyTrajectory}</span>
            </div>
            <input
              type="range"
              min={60}
              max={240}
              step={10}
              value={penaltyTrajectory}
              onChange={(e) => setPenaltyTrajectory(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-slate-300">
              <span>P_mode (Fuel &amp; Payload Mode)</span>
              <span className="text-cyan-400 font-bold">{penaltyMode}</span>
            </div>
            <input
              type="range"
              min={60}
              max={240}
              step={10}
              value={penaltyMode}
              onChange={(e) => setPenaltyMode(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
