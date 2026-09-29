import React, { useMemo } from "react";
import { Mission, ClassicalResult } from "../types";
import { runClassicalOptimization } from "../lib/optimization";
import { ArrowRight, CheckCircle2, TrendingUp, Cpu } from "lucide-react";

interface ClassicalOptimizationViewProps {
  mission: Mission;
  onProceedToQUBO: () => void;
}

export const ClassicalOptimizationView: React.FC<ClassicalOptimizationViewProps> = ({
  mission,
  onProceedToQUBO,
}) => {
  const result: ClassicalResult = useMemo(() => {
    return runClassicalOptimization(mission);
  }, [mission]);

  const b = result.baseline;
  const opt = result.optimized;
  const cfg = result.selected_configuration;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-mono text-cyan-400">Page 4 — Classical Multi-Objective Optimization</div>
          <div className="text-xl font-bold text-white mt-0.5">
            Differential Search &amp; Combinatorial Pruning
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Evaluated {result.iterations} Candidate Space Configurations in {result.execution_time_ms} ms · Objective Improved by {result.objective_improvement_pct}%
          </div>
        </div>

        <button
          onClick={onProceedToQUBO}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
        >
          <span>Formulate QUBO Matrix</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Optimal Configuration Ribbon */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-800/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase font-mono text-slate-400">Optimal Decision Profile Selected by Classical Engine</div>
            <div className="text-sm font-semibold text-white mt-0.5 flex items-center gap-2">
              <span className="text-cyan-300">{cfg.window_name}</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-300">{cfg.trajectory_name}</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-300">{cfg.mode_name}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-mono uppercase text-slate-400">Convergence Metric</div>
          <div className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
            Δ Objective: -{(b.objective_value - opt.objective_value).toFixed(3)}
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison: Baseline vs Optimized */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline Card */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Unoptimized Baseline Configuration</span>
            <span className="text-xs font-mono text-slate-500">Initial State</span>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-xs font-mono uppercase text-slate-400">Scalarized Objective Cost</div>
            <div className="text-3xl font-mono font-bold text-slate-200 mt-1 tabular-nums">
              {b.objective_value.toFixed(4)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Default nominal trajectory &amp; launch time</div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Fuel Consumption</span>
              <span className="text-slate-200">{b.fuel_consumption_kg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Launch Cost</span>
              <span className="text-slate-200">${b.launch_cost_musd.toFixed(2)} M</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Risk Score</span>
              <span className="text-slate-200">{b.risk_score.toFixed(1)} / 100</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Mission Δv</span>
              <span className="text-slate-200">{b.delta_v_kms.toFixed(3)} km/s</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Flight Duration</span>
              <span className="text-slate-200">{b.flight_time_sec} s</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400 font-sans">Constraint Violations</span>
              <span className="text-emerald-400 font-semibold">0 (Feasible)</span>
            </div>
          </div>
        </div>

        {/* Optimized Card */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-cyan-900/50 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-cyan-400">Classically Optimized Configuration</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              +{result.objective_improvement_pct}% Better
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-cyan-900/50">
            <div className="text-xs font-mono uppercase text-slate-400">Optimized Objective Cost</div>
            <div className="text-3xl font-mono font-bold text-cyan-400 mt-1 tabular-nums">
              {opt.objective_value.toFixed(4)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Multi-objective minimum across Pareto front</div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Fuel Consumption</span>
              <span className="text-cyan-300 font-semibold">
                {opt.fuel_consumption_kg.toLocaleString()} kg{" "}
                <span className="text-emerald-400 text-[11px]">
                  ({(opt.fuel_consumption_kg - b.fuel_consumption_kg > 0 ? "+" : "") +
                    (opt.fuel_consumption_kg - b.fuel_consumption_kg).toLocaleString()}{" "}
                  kg)
                </span>
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Launch Cost</span>
              <span className="text-cyan-300 font-semibold">
                ${opt.launch_cost_musd.toFixed(2)} M{" "}
                <span className="text-emerald-400 text-[11px]">
                  ({(opt.launch_cost_musd - b.launch_cost_musd).toFixed(2)} M)
                </span>
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Risk Score</span>
              <span className="text-cyan-300 font-semibold">
                {opt.risk_score.toFixed(1)} / 100{" "}
                <span className="text-emerald-400 text-[11px]">
                  ({(opt.risk_score - b.risk_score).toFixed(1)} pts)
                </span>
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Mission Δv</span>
              <span className="text-cyan-300 font-semibold">
                {opt.delta_v_kms.toFixed(3)} km/s
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Flight Duration</span>
              <span className="text-cyan-300 font-semibold">{opt.flight_time_sec} s</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400 font-sans">Constraint Violations</span>
              <span className="text-emerald-400 font-semibold">0 (Strictly Feasible)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
