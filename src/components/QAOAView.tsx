import React, { useState, useMemo } from "react";
import { Mission, QAOAResult, QuantumNoiseConfig } from "../types";
import { runQAOASimulation, NOISE_PRESETS } from "../lib/optimization";
import { QuantumBlochSphere } from "./QuantumBlochSphere";
import { QuantumNoiseSimulator } from "./QuantumNoiseSimulator";
import { QAOACircuitDepthVisualizer } from "./QAOACircuitDepthVisualizer";
import {
  ArrowRight,
  Atom,
  Play,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Activity,
  TrendingDown,
  Layers,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

interface QAOAViewProps {
  mission: Mission;
  onProceedToComparison: () => void;
  onProceedToFidelity?: () => void;
}

export const QAOAView: React.FC<QAOAViewProps> = ({
  mission,
  onProceedToComparison,
  onProceedToFidelity,
}) => {
  const [layersP, setLayersP] = useState<number>(1);
  const [shots, setShots] = useState<number>(1024);
  const [gamma, setGamma] = useState<number>(0.42);
  const [beta, setBeta] = useState<number>(0.35);
  const [activeSubTab, setActiveSubTab] = useState<"circuit" | "depth" | "noise">("circuit");
  const [noiseConfig, setNoiseConfig] = useState<QuantumNoiseConfig>({
    ...NOISE_PRESETS.superconducting,
    enabled: false,
  });
  const [convergenceViewMode, setConvergenceViewMode] = useState<
    "energy" | "feasibility" | "parameters" | "noise"
  >("energy");

  const qaoaResult: QAOAResult = useMemo(() => {
    return runQAOASimulation(mission, layersP, shots, gamma, beta, noiseConfig);
  }, [mission, layersP, shots, gamma, beta, noiseConfig]);

  const cs = qaoaResult.circuit_summary;
  const bestCand = qaoaResult.best_candidate;
  const decoded = qaoaResult.decoded_plan;
  const convergenceData = qaoaResult.convergence_history || [];

  const initialEnergy = convergenceData[0]?.cost_energy || 150;
  const finalEnergy = convergenceData[convergenceData.length - 1]?.best_energy || bestCand.qubo_energy;
  const energyDropPct = initialEnergy > 0 ? Number((((initialEnergy - finalEnergy) / initialEnergy) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-mono text-cyan-400">Page 6 — Quantum Approximate Optimization Algorithm (QAOA)</div>
          <div className="text-xl font-bold text-white mt-0.5">
            Quantum Circuit &amp; Statevector Simulator (9 Qubits · 2⁹ = 512 States)
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Circuit Depth: {cs.circuit_depth || (2 + 20 * layersP)} · Total Gates: {18 + 126 * layersP} ({72 * layersP} CNOTs) · Shots: {shots} · Execution: {qaoaResult.execution_time_ms} ms · Phase γ = {gamma} · Mixer β = {beta}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onProceedToFidelity && (
            <button
              onClick={onProceedToFidelity}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold text-cyan-300 bg-cyan-950/70 hover:bg-cyan-900/70 border border-cyan-800/80 rounded-lg transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Analyze Quantum Fidelity</span>
            </button>
          )}

          <button
            onClick={onProceedToComparison}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
          >
            <span>View Comparison Benchmark</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs: Pure State vs Depth vs Noise Simulation */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("circuit")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "circuit"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Atom className="w-4 h-4" />
            <span>1. Circuit Topology &amp; State Simulation</span>
          </button>

          <button
            onClick={() => setActiveSubTab("depth")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "depth"
                ? "bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-300" />
            <span>2. Circuit Depth &amp; Gate Complexity</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-950 text-indigo-200 border border-indigo-700">
              Depth {cs.circuit_depth || (2 + 20 * layersP)}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab("noise");
              if (!noiseConfig.enabled) {
                setNoiseConfig((prev) => ({ ...prev, enabled: true }));
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "noise"
                ? "bg-rose-500 text-white font-bold shadow-md shadow-rose-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>3. Quantum Noise / Error Simulation</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                noiseConfig.enabled
                  ? "bg-rose-950 text-rose-200 border border-rose-700"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {noiseConfig.enabled ? "Active" : "Decoherence"}
            </span>
          </button>
        </div>

        {/* Quick Noise Toggle Pill */}
        <div className="flex items-center gap-2 pr-2">
          <span className="text-[11px] text-slate-400">Noise Injection:</span>
          <button
            onClick={() =>
              setNoiseConfig((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
              noiseConfig.enabled
                ? "bg-rose-950 text-rose-300 border-rose-800"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            {noiseConfig.enabled ? "Decoherence ON" : "Noise OFF"}
          </button>
        </div>
      </div>

      {/* When in Noise Tab: Render QuantumNoiseSimulator component */}
      {activeSubTab === "noise" && (
        <QuantumNoiseSimulator
          noiseConfig={noiseConfig}
          onUpdateNoiseConfig={setNoiseConfig}
          layersP={layersP}
        />
      )}

      {/* When in Depth Tab: Render QAOACircuitDepthVisualizer prominently at top */}
      {activeSubTab === "depth" && (
        <QAOACircuitDepthVisualizer
          qaoaResult={qaoaResult}
          layersP={layersP}
          gamma={gamma}
          beta={beta}
          noiseConfig={noiseConfig}
        />
      )}

      {/* Quantum Controls Ribbon */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>QAOA Layers (p)</span>
            <span className="text-cyan-400 font-bold">{layersP}</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            value={layersP}
            onChange={(e) => setLayersP(Number(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Measurement Shots</span>
            <span className="text-cyan-400 font-bold">{shots}</span>
          </div>
          <select
            value={shots}
            onChange={(e) => setShots(Number(e.target.value))}
            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 cursor-pointer"
          >
            <option value={256}>256 Shots</option>
            <option value={512}>512 Shots</option>
            <option value={1024}>1024 Shots</option>
            <option value={2048}>2048 Shots</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Variational Angle γ (Phase)</span>
            <span className="text-cyan-400 font-bold">{gamma.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.5}
            step={0.05}
            value={gamma}
            onChange={(e) => setGamma(Number(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Variational Angle β (Mixer)</span>
            <span className="text-cyan-400 font-bold">{beta.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.2}
            step={0.05}
            value={beta}
            onChange={(e) => setBeta(Number(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Best Sampled Bitstring Card */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-cyan-900/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Atom className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-xs uppercase font-mono text-cyan-400">Optimal Ground State Bitstring Decoded</div>
              <div className="text-lg font-mono font-bold text-white mt-0.5">
                |ψ⟩ = |{qaoaResult.best_bitstring}⟩
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-right">
              <span className="text-slate-400">Sample Frequency: </span>
              <span className="text-cyan-400 font-bold">
                {bestCand.shots} / {shots} ({(bestCand.probability * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-right">
              <span className="text-slate-400">Ground State Energy: </span>
              <span className="text-emerald-400 font-bold">{bestCand.qubo_energy.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Decoded Mission Profile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Decoded Window (x₁..₃):</span>
            <div className="text-cyan-300 font-semibold mt-1">{decoded.window_name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Offset: {decoded.window_offset_min} min</div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Decoded Trajectory (x₄..₆):</span>
            <div className="text-cyan-300 font-semibold mt-1">{decoded.trajectory_name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Δv: {decoded.delta_v_kms} km/s</div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Decoded Fuel Mode (x₇..₉):</span>
            <div className="text-cyan-300 font-semibold mt-1">{decoded.mode_name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Objective: {decoded.objective_value.toFixed(4)}</div>
          </div>
        </div>
      </div>

      {/* RECHARTS: QUANTUM OPTIMIZATION COST FUNCTION CONVERGENCE */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Quantum Optimization Cost Function Convergence</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/70 text-cyan-300">
                  COBYLA · 25 Iteration Steps
                </span>
              </div>
              <div className="text-xs text-slate-400 font-sans">
                Expectation value ⟨ψ(γ, β)| H_C |ψ(γ, β)⟩ minimization trajectory over classical parameter update steps
              </div>
            </div>
          </div>

          {/* View Mode Toggle Strip */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setConvergenceViewMode("energy")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                convergenceViewMode === "energy"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Cost Energy ⟨H_C⟩
            </button>
            <button
              onClick={() => setConvergenceViewMode("feasibility")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                convergenceViewMode === "feasibility"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Energy vs Feasibility
            </button>
            <button
              onClick={() => setConvergenceViewMode("parameters")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                convergenceViewMode === "parameters"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Angle Trajectory (γ, β)
            </button>
            <button
              onClick={() => {
                setConvergenceViewMode("noise");
                if (!noiseConfig.enabled) {
                  setNoiseConfig((prev) => ({ ...prev, enabled: true }));
                }
              }}
              className={`px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                convergenceViewMode === "noise"
                  ? "bg-rose-500 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Decoherence Noise Impact</span>
            </button>
          </div>
        </div>

        {/* Convergence KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono tabular-nums">
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-[10px] uppercase text-slate-400 block">Initial Energy ⟨H_C⟩₀</span>
            <div className="text-base font-bold text-slate-300 mt-0.5">{initialEnergy.toFixed(1)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Random Superposition</div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-[10px] uppercase text-slate-400 block">
              {noiseConfig.enabled ? "Noisy Plateau Floor" : "Converged Ground Energy"}
            </span>
            <div
              className={`text-base font-bold mt-0.5 ${
                noiseConfig.enabled ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {noiseConfig.enabled
                ? (convergenceData[convergenceData.length - 1]?.noisy_best_energy || finalEnergy).toFixed(2)
                : finalEnergy.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {noiseConfig.enabled
                ? `Barren Gap: +${(
                    (convergenceData[convergenceData.length - 1]?.noisy_best_energy || finalEnergy) - finalEnergy
                  ).toFixed(1)}`
                : `ΔE = -${energyDropPct}%`}
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-[10px] uppercase text-slate-400 block">
              {noiseConfig.enabled ? "Decohered Fidelity" : "Feasible State Fidelity"}
            </span>
            <div
              className={`text-base font-bold mt-0.5 ${
                noiseConfig.enabled ? "text-amber-400" : "text-cyan-300"
              }`}
            >
              {noiseConfig.enabled
                ? `${(
                    convergenceData[convergenceData.length - 1]?.noisy_feasible_prob ||
                    bestCand.probability * 100
                  ).toFixed(1)}%`
                : `${(bestCand.probability * 100).toFixed(1)}%`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {noiseConfig.enabled ? "Corrupted by Noise" : "One-Hot Valid States"}
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-[10px] uppercase text-slate-400 block">Optimal Phase γ*</span>
            <div className="text-base font-bold text-cyan-400 mt-0.5">{gamma.toFixed(2)} rad</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Phase Unitary U(C, γ)</div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-[10px] uppercase text-slate-400 block">
              {noiseConfig.enabled ? "Quantum Gate Error" : "Optimal Mixer β*"}
            </span>
            <div
              className={`text-base font-bold mt-0.5 ${
                noiseConfig.enabled ? "text-rose-400" : "text-amber-400"
              }`}
            >
              {noiseConfig.enabled
                ? `${(noiseConfig.twoQubitGateError * 100).toFixed(1)}% (2Q)`
                : `${beta.toFixed(2)} rad`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {noiseConfig.enabled ? "CNOT Entangler Error" : "Mixer Unitary U(B, β)"}
            </div>
          </div>
        </div>

        {/* Recharts Composed Chart */}
        <div className="h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={convergenceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="qaoaEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="qaoaFeasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

              <XAxis
                dataKey="step"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                tickFormatter={(val) => `k=${val}`}
              />

              {convergenceViewMode === "parameters" ? (
                <>
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                    domain={[0, 1.6]}
                    tickFormatter={(val) => `${val.toFixed(2)} rad`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-3 bg-slate-950/95 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md text-xs font-mono space-y-1">
                            <div className="text-cyan-400 font-semibold border-b border-slate-800 pb-1">
                              Optimizer Step #{d.step}
                            </div>
                            <div className="text-slate-300">Phase Angle γ: <span className="text-cyan-300 font-bold">{d.gamma} rad</span></div>
                            <div className="text-slate-300">Mixer Angle β: <span className="text-amber-400 font-bold">{d.beta} rad</span></div>
                            <div className="text-slate-400 text-[10px] pt-0.5">Cost Expectation: {d.cost_energy}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "8px" }} />
                  <Line
                    type="monotone"
                    dataKey="gamma"
                    name="Phase Angle γ (rad)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#38bdf8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="beta"
                    name="Mixer Angle β (rad)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#f59e0b" }}
                  />
                </>
              ) : convergenceViewMode === "feasibility" ? (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#06b6d4"
                    tick={{ fill: "#06b6d4", fontSize: 11, fontFamily: "monospace" }}
                    domain={["auto", "auto"]}
                    tickFormatter={(val) => `${val}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    tick={{ fill: "#10b981", fontSize: 11, fontFamily: "monospace" }}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-3 bg-slate-950/95 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md text-xs font-mono space-y-1">
                            <div className="text-cyan-400 font-semibold border-b border-slate-800 pb-1">
                              Optimizer Step #{d.step}
                            </div>
                            <div className="text-slate-300">Energy ⟨H_C⟩: <span className="text-white font-bold">{d.cost_energy}</span></div>
                            <div className="text-emerald-400">Feasible Sampling: <span className="font-bold">{d.feasible_prob}%</span></div>
                            <div className="text-slate-400 text-[10px]">Best Energy: {d.best_energy}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "8px" }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="cost_energy"
                    name="Cost Energy ⟨H_C⟩"
                    stroke="#06b6d4"
                    fill="url(#qaoaEnergyGrad)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="feasible_prob"
                    name="Feasible Sampling %"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#10b981" }}
                  />
                  {noiseConfig.enabled && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="noisy_feasible_prob"
                      name="Noisy Feasible Sampling %"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={{ r: 2, fill: "#f43f5e" }}
                    />
                  )}
                </>
              ) : convergenceViewMode === "noise" ? (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#06b6d4"
                    tick={{ fill: "#06b6d4", fontSize: 11, fontFamily: "monospace" }}
                    domain={["auto", "auto"]}
                    tickFormatter={(val) => `${val}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#f43f5e"
                    tick={{ fill: "#f43f5e", fontSize: 11, fontFamily: "monospace" }}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        const gap = d.noisy_cost_energy
                          ? Number((d.noisy_cost_energy - d.cost_energy).toFixed(2))
                          : 0;
                        return (
                          <div className="p-3 bg-slate-950/95 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md text-xs font-mono space-y-1">
                            <div className="text-rose-400 font-semibold border-b border-slate-800 pb-1 flex justify-between">
                              <span>Step #{d.step} — NISQ Simulation</span>
                              <span className="text-amber-300 text-[10px]">Noise Active</span>
                            </div>
                            <div className="text-slate-300">
                              Ideal ⟨H_C⟩: <span className="text-cyan-300 font-bold">{d.cost_energy}</span>
                            </div>
                            <div className="text-rose-400">
                              Noisy ⟨H_C⟩: <span className="font-bold">{d.noisy_cost_energy}</span>
                            </div>
                            <div className="text-amber-400">
                              Decoherence Penalty: <span className="font-bold">+{gap}</span>
                            </div>
                            <div className="text-emerald-400">
                              Ideal Best Energy: <span className="font-bold">{d.best_energy}</span>
                            </div>
                            <div className="text-orange-400">
                              Noisy Plateau Floor: <span className="font-bold">{d.noisy_best_energy}</span>
                            </div>
                            <div className="text-slate-400 text-[10px] border-t border-slate-800 pt-1">
                              Fidelity Loss: {d.decoherence_loss}% · Feasible Survival: {d.noisy_feasible_prob}%
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "8px" }} />
                  <ReferenceLine
                    yAxisId="left"
                    y={bestCand.qubo_energy}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: `Target Ground State (${bestCand.qubo_energy.toFixed(1)})`,
                      fill: "#10b981",
                      fontSize: 10,
                      position: "insideTopRight",
                      fontFamily: "monospace",
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="cost_energy"
                    name="Ideal Energy ⟨H_C⟩ (Noise-Free)"
                    stroke="#06b6d4"
                    fill="url(#qaoaEnergyGrad)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="noisy_cost_energy"
                    name="Noisy Cost ⟨H_C⟩ (Decoherence)"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: "#f43f5e" }}
                  />
                  <Line
                    yAxisId="left"
                    type="stepAfter"
                    dataKey="best_energy"
                    name="Ideal Best Seen"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                  <Line
                    yAxisId="left"
                    type="stepAfter"
                    dataKey="noisy_best_energy"
                    name="Noisy Best (Barren Plateau Floor)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="decoherence_loss"
                    name="Circuit Fidelity Loss %"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                </>
              ) : (
                <>
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        const noiseGap = d.noisy_cost_energy
                          ? Number((d.noisy_cost_energy - d.cost_energy).toFixed(2))
                          : 0;
                        return (
                          <div className="p-3 bg-slate-950/95 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md text-xs font-mono space-y-1">
                            <div className="text-cyan-400 font-semibold border-b border-slate-800 pb-1 flex justify-between">
                              <span>Iteration Step #{d.step}</span>
                              {noiseConfig.enabled && (
                                <span className="text-rose-400 text-[10px]">Noise Active</span>
                              )}
                            </div>
                            <div className="text-slate-300">
                              Ideal ⟨H_C⟩: <span className="text-cyan-300 font-bold">{d.cost_energy}</span>
                            </div>
                            {noiseConfig.enabled && typeof d.noisy_cost_energy === "number" && (
                              <div className="text-rose-400">
                                Noisy ⟨H_C⟩: <span className="font-bold">{d.noisy_cost_energy}</span>
                                <span className="text-[10px] text-slate-400 ml-1">(ΔE: +{noiseGap})</span>
                              </div>
                            )}
                            <div className="text-emerald-400">
                              Best Energy (Ideal): <span className="font-bold">{d.best_energy}</span>
                            </div>
                            {noiseConfig.enabled && typeof d.noisy_best_energy === "number" && (
                              <div className="text-amber-400">
                                Noisy Best Seen: <span className="font-bold">{d.noisy_best_energy}</span>
                              </div>
                            )}
                            <div className="text-slate-400 text-[10px] border-t border-slate-800 pt-1">
                              γ: {d.gamma} rad · β: {d.beta} rad · Feasible: {d.feasible_prob}%
                              {noiseConfig.enabled && typeof d.noisy_feasible_prob === "number" && (
                                <span className="text-rose-400 block mt-0.5">
                                  Noisy Feasible: {d.noisy_feasible_prob}% (Loss: {d.decoherence_loss}%)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "8px" }} />
                  <ReferenceLine
                    y={bestCand.qubo_energy}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: `Target Ground State (${bestCand.qubo_energy.toFixed(1)})`,
                      fill: "#10b981",
                      fontSize: 10,
                      position: "insideTopRight",
                      fontFamily: "monospace",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost_energy"
                    name="Ideal Energy ⟨H_C⟩ (Noise-Free)"
                    stroke="#06b6d4"
                    fill="url(#qaoaEnergyGrad)"
                    strokeWidth={2}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="best_energy"
                    name="Ideal Best Solution Seen"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                  {noiseConfig.enabled && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="noisy_cost_energy"
                        name="Noisy Cost ⟨H_C⟩ (Decoherence)"
                        stroke="#f43f5e"
                        strokeWidth={2.5}
                        dot={{ r: 2, fill: "#f43f5e" }}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="noisy_best_energy"
                        name="Noisy Best (Barren Plateau Floor)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </>
                  )}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Decoherence Physics Insight Callout */}
        {noiseConfig.enabled && (
          <div className="p-3.5 bg-rose-950/40 rounded-lg border border-rose-800/60 text-xs font-sans text-rose-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-rose-300">
                NISQ Decoherence &amp; Barren Plateau Phenomenon:
              </span>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Under <strong>{(noiseConfig.twoQubitGateError * 100).toFixed(2)}% CNOT error</strong> and{" "}
                <strong>T₂ = {noiseConfig.dephasingTimeT2Us} μs</strong> dephasing, error accumulation across the {36 * layersP} entangling gates
                causes the quantum state to mix into the maximally mixed state I/2⁹. As a result, the cost function expectation value
                ⟨H_C⟩ no longer reaches the global ground state ({bestCand.qubo_energy.toFixed(1)}), but instead gets trapped in a noisy
                barren plateau floor ({(convergenceData[convergenceData.length - 1]?.noisy_best_energy || 0).toFixed(1)}).
                Notice how adding layers (p=2 or p=3) increases algorithmic expressibility in theory, but accelerates decoherence in practice on noisy hardware!
              </p>
            </div>
          </div>
        )}

        {/* Theoretical Insight Callout */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs font-sans text-slate-400 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-200">Variational Quantum-Classical Optimization Loop:</span>
            <p className="text-[11px] leading-relaxed">
              At step k=1, the quantum circuit initialized in uniform superposition |+⟩⁹ yields a high expectation value ⟨H_C⟩.
              As the classical optimizer (COBYLA) iteratively tunes the variational parameters γ (phase separation) and β (transverse mixer),
              probability concentrates inside the low-energy ground state subspace, successfully isolating the optimal launch window and trajectory configuration.
            </p>
          </div>
        </div>
      </div>

      {/* QUANTUM STATE BLOCH SPHERE VISUALIZATION */}
      <QuantumBlochSphere
        qaoaResult={qaoaResult}
        layersP={layersP}
        gamma={gamma}
        beta={beta}
      />

      {/* Measurement Probability Distribution Histogram */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">
            QAOA Measurement Histogram: Top Sampled Computational States
          </div>
          <div className="text-xs font-mono text-slate-400">
            Distribution across {shots} projective measurements
          </div>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {qaoaResult.top_bitstrings.map((item, idx) => {
            const isBest = item.bitstring === qaoaResult.best_bitstring;
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className={`w-28 text-left ${isBest ? "text-cyan-400 font-bold" : "text-slate-300"}`}>
                  |{item.bitstring}⟩
                </span>
                <div className="flex-1 bg-slate-950 h-5 rounded overflow-hidden relative border border-slate-800/80">
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.is_feasible
                        ? isBest
                          ? "bg-cyan-500"
                          : "bg-cyan-700/60"
                        : "bg-rose-600/70"
                    }`}
                    style={{ width: `${Math.min(100, item.probability * 300)}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">
                    {(item.probability * 100).toFixed(1)}% ({item.shots} shots) · E: {item.qubo_energy.toFixed(1)}
                  </span>
                </div>
                <span className="w-20 text-right">
                  {item.is_feasible ? (
                    <span className="text-emerald-400 text-[11px]">Feasible</span>
                  ) : (
                    <span className="text-rose-400 text-[11px]">Infeasible</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quantum Circuit Depth & Gate Complexity Visualizer */}
      {activeSubTab !== "depth" && (
        <QAOACircuitDepthVisualizer
          qaoaResult={qaoaResult}
          layersP={layersP}
          gamma={gamma}
          beta={beta}
          noiseConfig={noiseConfig}
        />
      )}
    </div>
  );
};
