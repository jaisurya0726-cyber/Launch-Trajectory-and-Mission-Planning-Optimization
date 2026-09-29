import React, { useState, useMemo } from "react";
import { QAOAResult, QuantumNoiseConfig } from "../types";
import {
  Layers,
  Cpu,
  Zap,
  Sparkles,
  Clock,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Info,
  Maximize2,
  Minimize2,
  Filter,
  Activity,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface QAOACircuitDepthVisualizerProps {
  qaoaResult: QAOAResult;
  layersP: number;
  gamma: number;
  beta: number;
  noiseConfig?: QuantumNoiseConfig;
}

interface GateDetail {
  id: string;
  name: string;
  symbol: string;
  type: "1q" | "2q" | "measure";
  category: "init" | "cost" | "mixer" | "measure";
  qubits: number[];
  durationNs: number;
  errorRate: number; // e.g. 0.001 = 0.1%
  formula: string;
  description: string;
}

// 9 aerospace qubit definitions
const QUBIT_DEFINITIONS = [
  { id: 0, group: "window", label: "q₀: Window Early", sub: "t₀ - 15 min", color: "cyan" },
  { id: 1, group: "window", label: "q₁: Window Mid", sub: "Nominal (t₀)", color: "cyan" },
  { id: 2, group: "window", label: "q₂: Window Late", sub: "t₀ + 15 min", color: "cyan" },
  { id: 3, group: "trajectory", label: "q₃: Hohmann Traj", sub: "Min Δv transfer", color: "indigo" },
  { id: 4, group: "trajectory", label: "q₄: Direct Insertion", sub: "Nominal profile", color: "indigo" },
  { id: 5, group: "trajectory", label: "q₅: Fast Transit", sub: "High-thrust burn", color: "indigo" },
  { id: 6, group: "fuel", label: "q₆: Fuel Conserv.", sub: "High reserve (+10%)", color: "amber" },
  { id: 7, group: "fuel", label: "q₇: Fuel Balanced", sub: "Nominal loading", color: "amber" },
  { id: 8, group: "fuel", label: "q₈: Fuel Aggressive", sub: "Max payload (-8%)", color: "amber" },
];

export const QAOACircuitDepthVisualizer: React.FC<QAOACircuitDepthVisualizerProps> = ({
  qaoaResult,
  layersP,
  gamma,
  beta,
  noiseConfig,
}) => {
  // Transpilation Target: standard CNOT basis vs native 2Q gates
  const [transpileBasis, setTranspileBasis] = useState<"standard" | "native">("standard");
  // Circuit diagram view mode: detailed (individual gates/CNOTs) vs compact (macro blocks)
  const [diagramMode, setDiagramMode] = useState<"detailed" | "compact">("detailed");
  // Subsystem filter: all, window, trajectory, fuel
  const [subsystemFilter, setSubsystemFilter] = useState<"all" | "window" | "trajectory" | "fuel">("all");
  // Include hardware SWAP routing overhead simulation (e.g. heavy-hex grid)
  const [showTopologyRouting, setShowTopologyRouting] = useState<boolean>(false);
  // Hovered / selected gate for inspector
  const [selectedGate, setSelectedGate] = useState<GateDetail | null>(null);
  // Active layer preview tab inside the diagram
  const [activeLayerTab, setActiveLayerTab] = useState<number>(1);

  // Constants for hardware pulse physics
  const T1_SUPERCONDUCTING_US = noiseConfig?.relaxationTimeT1Us || 100;
  const T2_SUPERCONDUCTING_US = noiseConfig?.dephasingTimeT2Us || 65;
  const GATE_1Q_DURATION_NS = 25;
  const GATE_2Q_DURATION_NS = 250;
  const MEASURE_DURATION_NS = 300;

  // Quantum calculations
  const numQubits = 9;
  const quboPairsCount = (numQubits * (numQubits - 1)) / 2; // 36 couplings

  // Hardware topology routing factor: on heavy-hex/grid (IBM Heron/Eagle), ~2.6x CNOTs due to SWAP chains
  const routingMultiplier = showTopologyRouting ? 2.6 : 1.0;

  // Gate counts
  const hadamardCount = numQubits;
  // Linear Rz on each qubit + coupling Rz
  const rzLinearCount = numQubits * layersP;
  const rzCouplingCount = quboPairsCount * layersP;
  const totalRzCount = rzLinearCount + rzCouplingCount;
  const rxMixerCount = numQubits * layersP;
  const measurementCount = numQubits;

  // 2-qubit CNOT count
  // In standard basis: 2 CNOTs per ZZ interaction = 72 * layersP * routingMultiplier
  const baseCnotCount = quboPairsCount * 2 * layersP;
  const totalCnotCount = Math.round(baseCnotCount * routingMultiplier);

  // In native basis: 1 Rzz gate per interaction
  const native2QCount = Math.round(quboPairsCount * layersP * (showTopologyRouting ? 2.2 : 1.0));

  const total1QCount = hadamardCount + totalRzCount + rxMixerCount;
  const totalGateCount =
    transpileBasis === "standard"
      ? total1QCount + totalCnotCount + measurementCount
      : hadamardCount + rzLinearCount + rxMixerCount + native2QCount + measurementCount;

  // Circuit Depth Calculations
  // Init layer: 1 layer of H
  const depthInit = 1;

  // Cost Hamiltonian depth:
  // Complete graph K9 edge coloring takes 9 rounds.
  // In standard basis, each round has CNOT - Rz - CNOT => 2 CNOT steps (Rz executes in parallel with CNOT delays or adds 1)
  // Standard depth per layer = 1 (linear Rz) + 9 rounds * 2 (CNOT steps) = 19
  // In native basis, 9 rounds * 1 = 9 + 1 (linear Rz) = 10
  const standardCostDepthPerLayer = Math.round(19 * (showTopologyRouting ? 2.4 : 1.0));
  const nativeCostDepthPerLayer = Math.round(10 * (showTopologyRouting ? 2.0 : 1.0));

  const costDepthPerLayer = transpileBasis === "standard" ? standardCostDepthPerLayer : nativeCostDepthPerLayer;
  const totalCostDepth = costDepthPerLayer * layersP;

  // Mixer Hamiltonian depth: 1 layer of Rx(2β) on all qubits
  const totalMixerDepth = 1 * layersP;

  // Measurement layer depth: 1
  const depthMeasure = 1;

  // Total circuit depth
  const totalCircuitDepth = depthInit + totalCostDepth + totalMixerDepth + depthMeasure;

  // Critical path duration (microseconds)
  const singleQTimeNs = GATE_1Q_DURATION_NS;
  const twoQTimeNs = GATE_2Q_DURATION_NS;
  const measureTimeNs = MEASURE_DURATION_NS;

  const totalDurationNs =
    singleQTimeNs + // Init H
    layersP * (singleQTimeNs + (transpileBasis === "standard" ? standardCostDepthPerLayer * twoQTimeNs : nativeCostDepthPerLayer * twoQTimeNs) + singleQTimeNs) +
    measureTimeNs;

  const totalDurationUs = Number((totalDurationNs / 1000).toFixed(2));

  // Coherence budget used (% of T2)
  const coherenceBudgetPct = Number(Math.min(100, (totalDurationUs / T2_SUPERCONDUCTING_US) * 100).toFixed(1));

  // 2-Qubit gate fraction
  const twoQFractionPct = Number(
    (((transpileBasis === "standard" ? totalCnotCount : native2QCount) / totalGateCount) * 100).toFixed(1)
  );

  // Filtered qubits list
  const visibleQubits = useMemo(() => {
    if (subsystemFilter === "all") return QUBIT_DEFINITIONS;
    return QUBIT_DEFINITIONS.filter((q) => q.group === subsystemFilter);
  }, [subsystemFilter]);

  // Scalability Matrix across layers p = 1 to 5
  const scalabilityTable = useMemo(() => {
    return [1, 2, 3, 4, 5].map((p) => {
      const depth = depthInit + (transpileBasis === "standard" ? 19 : 10) * p * (showTopologyRouting ? 2.4 : 1.0) + p + depthMeasure;
      const cnots = Math.round(36 * 2 * p * (showTopologyRouting ? 2.6 : 1.0));
      const totalGates = 9 + (9 + 36 + 9) * p + cnots + 9;
      const durUs = (25 + p * (25 + 19 * 250 + 25) + 300) / 1000;
      const budgetPct = Math.min(100, (durUs / T2_SUPERCONDUCTING_US) * 100);
      const estFidelity = Math.max(
        0.05,
        Math.pow(1 - 0.008, cnots) * Math.exp(-durUs / T2_SUPERCONDUCTING_US)
      );

      return {
        p,
        depth: Math.round(depth),
        cnots,
        totalGates,
        durUs: Number(durUs.toFixed(2)),
        budgetPct: Number(budgetPct.toFixed(1)),
        estFidelityPct: Number((estFidelity * 100).toFixed(1)),
        isCurrent: p === layersP,
      };
    });
  }, [layersP, transpileBasis, showTopologyRouting, T2_SUPERCONDUCTING_US]);

  // Representative scheduled coupling pairs for detailed diagram
  const couplingRounds = useMemo(() => {
    // 4 representative matchings demonstrating constraints & objective couplings
    return [
      {
        round: 1,
        title: "Round 1: One-Hot Mutex Constraints",
        couplings: [
          { q1: 0, q2: 1, label: "J₀₁ (Window Mutex)" },
          { q1: 3, q2: 4, label: "J₃₄ (Traj Mutex)" },
          { q1: 6, q2: 7, label: "J₆₇ (Fuel Mutex)" },
        ],
      },
      {
        round: 2,
        title: "Round 2: Window-Trajectory Couplings",
        couplings: [
          { q1: 0, q2: 3, label: "J₀₃ (Early-Hohmann)" },
          { q1: 1, q2: 4, label: "J₁₄ (Nominal-Direct)" },
          { q1: 2, q2: 5, label: "J₂₅ (Late-Fast)" },
        ],
      },
      {
        round: 3,
        title: "Round 3: Trajectory-Fuel Objective Optimization",
        couplings: [
          { q1: 3, q2: 6, label: "J₃₆ (Hohmann-Reserve)" },
          { q1: 4, q2: 7, label: "J₄₇ (Direct-Balanced)" },
          { q1: 5, q2: 8, label: "J₅₈ (Fast-Aggressive)" },
        ],
      },
      {
        round: 4,
        title: "Round 4: Secondary QUBO Penalty Cross-Terms",
        couplings: [
          { q1: 0, q2: 2, label: "J₀₂ (Window Mutex)" },
          { q1: 3, q2: 5, label: "J₃₅ (Traj Mutex)" },
          { q1: 6, q2: 8, label: "J₆₈ (Fuel Mutex)" },
        ],
      },
    ];
  }, []);

  return (
    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-xl">
      {/* SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>QAOA Circuit Depth &amp; Quantum Gate Complexity</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/70 text-cyan-300">
                Depth {totalCircuitDepth} · {totalGateCount} Operations
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Parameterized quantum circuit architecture, entangling depth, and execution latency across {numQubits} mission registers
            </div>
          </div>
        </div>

        {/* Transpilation & Topology Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Transpilation Basis Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setTranspileBasis("standard")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                transpileBasis === "standard"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Decomposed into standard 1-qubit rotations and CNOT gates (e.g. IBM Quantum, Rigetti)"
            >
              CNOT Basis
            </button>
            <button
              onClick={() => setTranspileBasis("native")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                transpileBasis === "native"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Native two-qubit Rzz entanglers (e.g. IonQ, Honeywell, Google Sycamore)"
            >
              Native Rzz
            </button>
          </div>

          {/* Heavy-Hex Grid Routing Switch */}
          <button
            onClick={() => setShowTopologyRouting(!showTopologyRouting)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              showTopologyRouting
                ? "bg-amber-950/80 text-amber-300 border-amber-800"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="Toggle simulation of nearest-neighbor qubit connectivity (requires SWAP network)"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{showTopologyRouting ? "Grid Routing (SWAP+)" : "All-to-All QPU"}</span>
          </button>
        </div>
      </div>

      {/* TOP 4 KEY METRICS HERO CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        {/* Metric 1: Total Circuit Depth */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-sans">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Circuit Depth</span>
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">p = {layersP}</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{totalCircuitDepth}</div>
          <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
            <span>Critical Path: {costDepthPerLayer * layersP} (Cost) + {layersP} (Mixer)</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (totalCircuitDepth / 70) * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Total Quantum Gates */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-sans">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Total Gate Count</span>
            </span>
            <span className="text-[10px] text-indigo-400 font-mono">
              {transpileBasis === "standard" ? "CNOT Decomp" : "Native"}
            </span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{totalGateCount}</div>
          <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
            <span>{total1QCount} 1Q · {transpileBasis === "standard" ? totalCnotCount : native2QCount} 2Q · 9 M</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-indigo-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (totalGateCount / 400) * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: 2-Qubit Entangler Density */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-sans">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>2-Qubit Gate Ratio</span>
            </span>
            <span className="text-[10px] text-amber-400 font-mono">Error Critical</span>
          </div>
          <div className="text-2xl font-bold text-amber-300 tracking-tight">{twoQFractionPct}%</div>
          <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
            <span>{transpileBasis === "standard" ? totalCnotCount : native2QCount} Entangling Gates</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${twoQFractionPct}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Hardware Latency & Coherence Budget */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-sans">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>Coherence Budget</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">T₂ = {T2_SUPERCONDUCTING_US} μs</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-1.5">
            <span>{totalDurationUs}</span>
            <span className="text-xs text-slate-400 font-normal">μs</span>
            <span
              className={`text-[11px] font-bold ml-auto ${
                coherenceBudgetPct > 35 ? "text-rose-400" : coherenceBudgetPct > 20 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {coherenceBudgetPct}% T₂
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
            <span>{T2_SUPERCONDUCTING_US - totalDurationUs > 0 ? `${(T2_SUPERCONDUCTING_US - totalDurationUs).toFixed(1)} μs margin` : "Decohered"}</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                coherenceBudgetPct > 35 ? "bg-rose-500" : coherenceBudgetPct > 20 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${coherenceBudgetPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* GATE COMPOSITION VISUAL PROPORTION BAR */}
      <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex flex-wrap items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-sans font-semibold">Quantum Gate Composition Breakdown</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              <span>Hadamard &amp; 1Q Rz: {hadamardCount + totalRzCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              <span>2Q Entanglers: {transpileBasis === "standard" ? totalCnotCount : native2QCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>1Q Rx Mixers: {rxMixerCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Measurements: {measurementCount}</span>
            </span>
          </div>
        </div>

        {/* Multi-segment stacked bar */}
        <div className="w-full h-3 bg-slate-900 rounded-md overflow-hidden flex border border-slate-800">
          <div
            style={{ width: `${((hadamardCount + totalRzCount) / totalGateCount) * 100}%` }}
            className="bg-cyan-500 hover:opacity-90 transition-all cursor-help"
            title={`Hadamard & Rz Rotations: ${hadamardCount + totalRzCount} gates`}
          />
          <div
            style={{ width: `${((transpileBasis === "standard" ? totalCnotCount : native2QCount) / totalGateCount) * 100}%` }}
            className="bg-indigo-500 hover:opacity-90 transition-all cursor-help"
            title={`2-Qubit Entanglers: ${transpileBasis === "standard" ? totalCnotCount : native2QCount} gates`}
          />
          <div
            style={{ width: `${(rxMixerCount / totalGateCount) * 100}%` }}
            className="bg-amber-400 hover:opacity-90 transition-all cursor-help"
            title={`Transverse Rx Mixers: ${rxMixerCount} gates`}
          />
          <div
            style={{ width: `${(measurementCount / totalGateCount) * 100}%` }}
            className="bg-emerald-500 hover:opacity-90 transition-all cursor-help"
            title={`Measurements: ${measurementCount} operations`}
          />
        </div>
      </div>

      {/* INTERACTIVE QUANTUM CIRCUIT DIAGRAM */}
      <div className="space-y-3">
        {/* Circuit Diagram Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-xs">Filter Subsystem:</span>
            <button
              onClick={() => setSubsystemFilter("all")}
              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                subsystemFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              All 9 Qubits
            </button>
            <button
              onClick={() => setSubsystemFilter("window")}
              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                subsystemFilter === "window" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-800" : "text-slate-400 hover:text-white"
              }`}
            >
              Window (q₀₋₂)
            </button>
            <button
              onClick={() => setSubsystemFilter("trajectory")}
              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                subsystemFilter === "trajectory" ? "bg-indigo-950 text-indigo-300 font-bold border border-indigo-800" : "text-slate-400 hover:text-white"
              }`}
            >
              Trajectory (q₃₋₅)
            </button>
            <button
              onClick={() => setSubsystemFilter("fuel")}
              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                subsystemFilter === "fuel" ? "bg-amber-950 text-amber-300 font-bold border border-amber-800" : "text-slate-400 hover:text-white"
              }`}
            >
              Fuel Mode (q₆₋₈)
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Layer tabs if p > 1 */}
            {layersP > 1 && (
              <div className="flex items-center gap-1 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] px-1 font-sans">Inspect Layer:</span>
                {Array.from({ length: layersP }, (_, i) => i + 1).map((lp) => (
                  <button
                    key={lp}
                    onClick={() => setActiveLayerTab(lp)}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                      activeLayerTab === lp ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    p={lp}
                  </button>
                ))}
              </div>
            )}

            {/* Detailed vs Compact Toggle */}
            <button
              onClick={() => setDiagramMode(diagramMode === "detailed" ? "compact" : "detailed")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              {diagramMode === "detailed" ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Compact View</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Detailed Gates</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visual Circuit Schematic Canvas Container */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
          <div className="min-w-[760px] space-y-4">
            {/* Timeline Stage Headers */}
            <div className="grid grid-cols-12 gap-2 text-[11px] font-mono text-center border-b border-slate-800/80 pb-2">
              <div className="col-span-2 text-left text-slate-400 font-sans">Qubit Registers</div>
              <div className="col-span-1 text-cyan-400 font-semibold bg-cyan-950/40 py-0.5 rounded border border-cyan-800/40">
                Stage 0: |+⟩⁹
              </div>
              <div className="col-span-6 text-indigo-300 font-semibold bg-indigo-950/40 py-0.5 rounded border border-indigo-800/40">
                QAOA Layer {layersP > 1 ? activeLayerTab : 1}: Cost Separator U(C, γ={gamma}) · Depth {costDepthPerLayer}
              </div>
              <div className="col-span-2 text-amber-300 font-semibold bg-amber-950/40 py-0.5 rounded border border-amber-800/40">
                Mixer U(B, β={beta})
              </div>
              <div className="col-span-1 text-emerald-400 font-semibold bg-emerald-950/40 py-0.5 rounded border border-emerald-800/40">
                Measure
              </div>
            </div>

            {/* Qubit Wires */}
            <div className="space-y-3 pt-1">
              {visibleQubits.map((q) => {
                const wireColor =
                  q.group === "window"
                    ? "border-cyan-500/40"
                    : q.group === "trajectory"
                    ? "border-indigo-500/40"
                    : "border-amber-500/40";

                return (
                  <div key={q.id} className="grid grid-cols-12 gap-2 items-center text-xs font-mono relative">
                    {/* Qubit Label and Mission Role */}
                    <div className="col-span-2 flex items-center justify-between pr-2 border-r border-slate-800">
                      <div>
                        <div
                          className={`font-bold ${
                            q.group === "window"
                              ? "text-cyan-400"
                              : q.group === "trajectory"
                              ? "text-indigo-400"
                              : "text-amber-400"
                          }`}
                        >
                          {q.label}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">{q.sub}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        |0⟩
                      </span>
                    </div>

                    {/* Stage 0: Hadamard Gate */}
                    <div className="col-span-1 flex items-center justify-center relative">
                      {/* Wire Background Line */}
                      <div className="absolute inset-x-0 h-0.5 bg-slate-700/80 -z-0" />
                      <button
                        onClick={() =>
                          setSelectedGate({
                            id: `h_${q.id}`,
                            name: `Hadamard Gate H(q${q.id})`,
                            symbol: "H",
                            type: "1q",
                            category: "init",
                            qubits: [q.id],
                            durationNs: GATE_1Q_DURATION_NS,
                            errorRate: noiseConfig?.singleQubitGateError || 0.001,
                            formula: "H = \\frac{1}{\\sqrt{2}} \\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}",
                            description: `Initializes qubit q${q.id} into uniform superposition |+⟩ = (|0⟩+|1⟩)/√2 to begin global parallel search across 2⁹=512 launch trajectories.`,
                          })
                        }
                        className="relative z-10 w-8 h-8 rounded bg-cyan-950 border border-cyan-500 text-cyan-300 font-bold flex items-center justify-center shadow-md hover:bg-cyan-900 transition-colors cursor-pointer"
                        title="Click to inspect Hadamard Unitary"
                      >
                        H
                      </button>
                    </div>

                    {/* QAOA Layer: Cost Unitary U(C, γ) */}
                    <div className="col-span-6 relative flex items-center px-1">
                      {/* Wire Background Line */}
                      <div className="absolute inset-x-0 h-0.5 bg-slate-700/80 -z-0" />

                      {diagramMode === "compact" ? (
                        /* Compact View: Macro Unitary Block */
                        <div className="relative z-10 w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/70 border border-indigo-700 text-indigo-200">
                          <button
                            onClick={() =>
                              setSelectedGate({
                                id: `rz_${q.id}`,
                                name: `Linear Phase Rotation Rz(2γ·h_${q.id})`,
                                symbol: "Rz(γ)",
                                type: "1q",
                                category: "cost",
                                qubits: [q.id],
                                durationNs: GATE_1Q_DURATION_NS,
                                errorRate: noiseConfig?.singleQubitGateError || 0.001,
                                formula: "R_z(2\\gamma h_i) = \\exp(-i \\gamma h_i Z_i)",
                                description: `Encodes linear objective bias h_${q.id} for ${q.label} based on target orbit parameters and fuel penalties.`,
                              })
                            }
                            className="px-2 py-0.5 rounded bg-indigo-900/90 border border-indigo-500 text-cyan-300 text-[10px] font-bold hover:bg-indigo-800 transition-colors cursor-pointer"
                          >
                            Rz(γ)
                          </button>

                          <div className="flex-1 text-center text-[10px] text-indigo-300 font-mono">
                            {/* Representative coupling connections */}
                            <span>
                              ZZ Couplings: {q.group === "window" ? "Mutex (q₀..q₂) + Δv cost" : q.group === "trajectory" ? "Mutex (q₃..q₅) + Fuel coupling" : "Mutex (q₆..q₈) + Payload margin"}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              setSelectedGate({
                                id: `cnot_${q.id}`,
                                name: `CNOT Entangler Network`,
                                symbol: "CX",
                                type: "2q",
                                category: "cost",
                                qubits: [q.id],
                                durationNs: GATE_2Q_DURATION_NS,
                                errorRate: noiseConfig?.twoQubitGateError || 0.008,
                                formula: "CNOT_{ij} \\cdot R_z(2\\gamma J_{ij}) \\cdot CNOT_{ij}",
                                description: `Decomposes non-local ZZ coupling e^{-iγ J_{ij} Z_i Z_j} into two CNOT gates sandwiching a central Z-axis phase rotation.`,
                              })
                            }
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-indigo-300 text-[10px] font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            2Q Entangle (×{quboPairsCount / 9})
                          </button>
                        </div>
                      ) : (
                        /* Detailed View: Unrolled Parallel Gate Sequence */
                        <div className="relative z-10 w-full flex items-center justify-between gap-1.5">
                          {/* Linear Phase Gate */}
                          <button
                            onClick={() =>
                              setSelectedGate({
                                id: `rz_${q.id}`,
                                name: `Linear Phase Rotation Rz(2γ·h_${q.id})`,
                                symbol: "Rz",
                                type: "1q",
                                category: "cost",
                                qubits: [q.id],
                                durationNs: GATE_1Q_DURATION_NS,
                                errorRate: noiseConfig?.singleQubitGateError || 0.001,
                                formula: "R_z(2\\gamma h_i) = \\exp(-i \\gamma h_i Z_i)",
                                description: `Applies phase shift corresponding to single-variable QUBO linear term for ${q.label}.`,
                              })
                            }
                            className="w-7 h-7 rounded bg-indigo-950 border border-indigo-500 text-cyan-300 text-[10px] font-bold flex items-center justify-center hover:bg-indigo-900 transition-colors cursor-pointer shadow"
                            title="Linear Rz phase shift"
                          >
                            Rz
                          </button>

                          {/* 4 Representative scheduled entangling moments */}
                          {couplingRounds.map((rnd, rIdx) => {
                            // Check if this qubit participates in this round
                            const activeCoupling = rnd.couplings.find(
                              (c) => c.q1 === q.id || c.q2 === q.id
                            );

                            if (!activeCoupling) {
                              return (
                                <div
                                  key={rIdx}
                                  className="w-10 h-7 flex items-center justify-center text-[10px] text-slate-600"
                                >
                                  —
                                </div>
                              );
                            }

                            const isControl = activeCoupling.q1 === q.id;
                            const partnerId = isControl ? activeCoupling.q2 : activeCoupling.q1;

                            return (
                              <button
                                key={rIdx}
                                onClick={() =>
                                  setSelectedGate({
                                    id: `cnot_${q.id}_${partnerId}`,
                                    name: transpileBasis === "standard" ? `CNOT Gate (q${q.id} ↔ q${partnerId})` : `Native ZZ Rotation Rzz(q${q.id}, q${partnerId})`,
                                    symbol: transpileBasis === "standard" ? "CX" : "ZZ",
                                    type: "2q",
                                    category: "cost",
                                    qubits: [q.id, partnerId],
                                    durationNs: GATE_2Q_DURATION_NS,
                                    errorRate: noiseConfig?.twoQubitGateError || 0.008,
                                    formula: transpileBasis === "standard"
                                      ? "U_{ZZ}(\\gamma J) = CX \\cdot (I \\otimes R_z(2\\gamma J)) \\cdot CX"
                                      : "R_{ZZ}(\\theta) = \\exp(-i \\frac{\\theta}{2} Z \\otimes Z)",
                                    description: `Coupling interaction enforcing constraint: ${activeCoupling.label}. Penalty parameter penalizes concurrent selection or pairs with high risk.`,
                                  })
                                }
                                className={`w-10 h-7 rounded flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer shadow ${
                                  transpileBasis === "standard"
                                    ? isControl
                                      ? "bg-cyan-950 border-cyan-400 text-cyan-200"
                                      : "bg-indigo-950 border-indigo-400 text-indigo-200"
                                    : "bg-purple-950 border-purple-400 text-purple-200"
                                }`}
                                title={`Coupling with q${partnerId}: ${activeCoupling.label}`}
                              >
                                {transpileBasis === "standard" ? (
                                  isControl ? (
                                    <span className="flex items-center gap-0.5">
                                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                                      <span className="text-[9px]">q{partnerId}</span>
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5">
                                      <span className="text-indigo-400 font-bold">⊕</span>
                                      <span className="text-[9px]">q{partnerId}</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[9px]">ZZ(q{partnerId})</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* QAOA Layer: Mixer Unitary U(B, β) */}
                    <div className="col-span-2 relative flex items-center justify-center">
                      {/* Wire Background Line */}
                      <div className="absolute inset-x-0 h-0.5 bg-slate-700/80 -z-0" />
                      <button
                        onClick={() =>
                          setSelectedGate({
                            id: `rx_${q.id}`,
                            name: `Transverse Mixer Rotation Rx(2β)`,
                            symbol: "Rx(2β)",
                            type: "1q",
                            category: "mixer",
                            qubits: [q.id],
                            durationNs: GATE_1Q_DURATION_NS,
                            errorRate: noiseConfig?.singleQubitGateError || 0.001,
                            formula: "R_x(2\\beta) = \\exp(-i \\beta X_i) = \\begin{pmatrix} \\cos\\beta & -i\\sin\\beta \\\\ -i\\sin\\beta & \\cos\\beta \\end{pmatrix}",
                            description: `Transverse magnetic field mixer driving quantum tunneling transitions between computational basis states |0⟩ and |1⟩.`,
                          })
                        }
                        className="relative z-10 px-2.5 py-1 rounded bg-amber-950 border border-amber-500 text-amber-300 font-bold flex items-center justify-center shadow-md hover:bg-amber-900 transition-colors cursor-pointer text-[10px]"
                        title="Transverse mixer Rx(2β)"
                      >
                        Rx({(2 * beta).toFixed(2)})
                      </button>
                    </div>

                    {/* Measurement Layer */}
                    <div className="col-span-1 relative flex items-center justify-center">
                      {/* Wire Background Line */}
                      <div className="absolute inset-x-0 h-0.5 bg-slate-700/80 -z-0" />
                      <button
                        onClick={() =>
                          setSelectedGate({
                            id: `m_${q.id}`,
                            name: `Computational Z-Basis Projective Measurement`,
                            symbol: "M_Z",
                            type: "measure",
                            category: "measure",
                            qubits: [q.id],
                            durationNs: MEASURE_DURATION_NS,
                            errorRate: noiseConfig?.readoutError || 0.015,
                            formula: "\\mathcal{M}_Z = |0\\rangle\\langle 0| - |1\\rangle\\langle 1|",
                            description: `Collapses quantum superposition onto bit c[${q.id}] ∈ {0, 1} registering whether ${q.label} is activated.`,
                          })
                        }
                        className="relative z-10 w-8 h-8 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold flex items-center justify-center shadow-md hover:bg-emerald-900 transition-colors cursor-pointer text-xs"
                        title="Z-basis detector measurement"
                      >
                        ∢
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Classical Bit Output Register Wire */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">c[0..8]:</span>
                <span className="text-slate-300">Classical Register Bus</span>
                <span className="text-emerald-400">=== 9 Classical Bits Output (Sampled Bitstrings) ===</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Optimal Decoded: |ψ⟩ = |{qaoaResult.best_bitstring}⟩
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC GATE INSPECTOR MODAL / CARD (WHEN CLICKED) */}
      {selectedGate && (
        <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/60 shadow-2xl relative space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-cyan-950 border border-cyan-600 text-cyan-300 font-mono font-bold flex items-center justify-center text-xs">
                {selectedGate.symbol}
              </span>
              <div>
                <div className="text-sm font-bold text-white font-mono">{selectedGate.name}</div>
                <div className="text-[11px] text-cyan-400">
                  Target Qubit(s): {selectedGate.qubits.map((q) => `q${q}`).join(", ")} · Type: {selectedGate.type.toUpperCase()}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedGate(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs font-mono">
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400 font-sans">Physical Gate Duration:</span>
              <div className="text-white font-bold mt-0.5">{selectedGate.durationNs} ns</div>
              <div className="text-[10px] text-slate-500 font-sans">Transmon microwave pulse</div>
            </div>

            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400 font-sans">Hardware Infidelity (Error):</span>
              <div className="text-amber-400 font-bold mt-0.5">
                {(selectedGate.errorRate * 100).toFixed(2)}% error
              </div>
              <div className="text-[10px] text-slate-500 font-sans">Cross-talk &amp; TLS loss</div>
            </div>

            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400 font-sans">Mathematical Operator:</span>
              <div className="text-cyan-300 font-bold mt-0.5 overflow-x-auto">{selectedGate.formula}</div>
              <div className="text-[10px] text-slate-500 font-sans">Unitary evolution matrix</div>
            </div>
          </div>

          <p className="text-xs text-slate-300 font-sans leading-relaxed pt-1">
            {selectedGate.description}
          </p>
        </div>
      )}

      {/* CIRCUIT DEPTH SCALABILITY & NISQ TRADE-OFF COMPARISON TABLE */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Algorithmic Depth Scaling vs. Physical NISQ Coherence Window (p = 1..5)</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Superconducting Transmon Baseline (T₂ = {T2_SUPERCONDUCTING_US} μs)
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Layers (p)</th>
                <th className="py-2.5 px-3">Circuit Depth</th>
                <th className="py-2.5 px-3">2Q CNOT Count</th>
                <th className="py-2.5 px-3">Total Gates</th>
                <th className="py-2.5 px-3">Duration (μs)</th>
                <th className="py-2.5 px-3">T₂ Budget Used</th>
                <th className="py-2.5 px-3">Est. State Fidelity</th>
                <th className="py-2.5 px-3">NISQ Practical Feasibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {scalabilityTable.map((row) => (
                <tr
                  key={row.p}
                  className={`transition-colors ${
                    row.isCurrent
                      ? "bg-cyan-950/40 border-l-4 border-cyan-400 text-white font-semibold"
                      : "text-slate-300 hover:bg-slate-900/60"
                  }`}
                >
                  <td className="py-2 px-3 flex items-center gap-1.5">
                    <span>p = {row.p}</span>
                    {row.isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 font-bold uppercase">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-bold text-white">{row.depth}</td>
                  <td className="py-2 px-3 text-indigo-300">{row.cnots}</td>
                  <td className="py-2 px-3">{row.totalGates}</td>
                  <td className="py-2 px-3">{row.durUs} μs</td>
                  <td className="py-2 px-3">
                    <span
                      className={`font-bold ${
                        row.budgetPct > 50
                          ? "text-rose-400"
                          : row.budgetPct > 25
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {row.budgetPct}%
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`font-bold ${
                        row.estFidelityPct > 60
                          ? "text-emerald-400"
                          : row.estFidelityPct > 30
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {row.estFidelityPct}%
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {row.p === 1 ? (
                      <span className="text-emerald-400 font-sans flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> High Fidelity (Optimal NISQ)
                      </span>
                    ) : row.p === 2 ? (
                      <span className="text-amber-400 font-sans flex items-center gap-1 text-[11px]">
                        <Activity className="w-3.5 h-3.5" /> Moderate Decoherence
                      </span>
                    ) : row.p === 3 ? (
                      <span className="text-rose-400 font-sans flex items-center gap-1 text-[11px]">
                        <ShieldAlert className="w-3.5 h-3.5" /> Barren Plateau Risk
                      </span>
                    ) : (
                      <span className="text-slate-500 font-sans text-[11px]">
                        Requires Fault-Tolerant QEC
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* THEORETICAL INSIGHT CALLOUT: THE NISQ DILEMMA */}
      <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs font-sans text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-white">
            The NISQ Depth Dilemma in Launch Trajectory Optimization:
          </span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            In quantum theory, increasing the QAOA layer count <em>p → ∞</em> guarantees asymptotic convergence to the exact global ground state (lowest fuel consumption and zero risk violations).
            However, on contemporary NISQ hardware, each layer increases circuit depth by <strong>{costDepthPerLayer + 1} steps</strong> and appends <strong>{36 * (transpileBasis === "standard" ? 2 : 1)} two-qubit entanglers</strong>.
            Because physical two-qubit gate errors (~0.8%) and phase dephasing (T₂ = {T2_SUPERCONDUCTING_US} μs) compound exponentially, deep circuits suffer from fidelity collapse and barren plateaus.
            For this 9-qubit mission profile, <strong>p = 1 or p = 2</strong> represents the sweet spot maximizing quantum speedup while staying within the hardware coherence envelope.
          </p>
        </div>
      </div>
    </div>
  );
};
