import React, { useState, useMemo } from "react";
import {
  Mission,
  QuantumNoiseConfig,
  NoisePreset,
  QAOAFidelityAnalysis,
  MeasuredEigenstate,
} from "../types";
import {
  runQAOAFidelityAnalysis,
  NOISE_PRESETS,
} from "../lib/optimization";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  Legend,
  Cell,
} from "recharts";
import {
  ShieldCheck,
  ShieldAlert,
  Atom,
  Sparkles,
  BarChart3,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  Sliders,
  Cpu,
  Zap,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Check,
  RefreshCw,
  Gauge,
  Scale,
} from "lucide-react";

interface QuantumFidelityViewProps {
  mission: Mission;
  onProceedToComparison?: () => void;
  onProceedToQAOA?: () => void;
  onProceedToQEC?: () => void;
}

export type DistributionViewMode = "top_eigenstates" | "full_spectrum" | "cumulative_cdf" | "subspace_partition";

export const QuantumFidelityView: React.FC<QuantumFidelityViewProps> = ({
  mission,
  onProceedToComparison,
  onProceedToQAOA,
  onProceedToQEC,
}) => {
  // Quantum Circuit Hyperparameters
  const [layersP, setLayersP] = useState<number>(1);
  const [shots, setShots] = useState<number>(1024);
  const [gamma, setGamma] = useState<number>(0.42);
  const [beta, setBeta] = useState<number>(0.35);
  const [selectedNoisePreset, setSelectedNoisePreset] = useState<NoisePreset>("ideal");
  const [noiseConfig, setNoiseConfig] = useState<QuantumNoiseConfig>(NOISE_PRESETS.ideal);

  // Visualization Mode
  const [viewMode, setViewMode] = useState<DistributionViewMode>("top_eigenstates");
  const [topCount, setTopCount] = useState<number>(16);
  const [tableFilter, setTableFilter] = useState<"all" | "feasible" | "infeasible">("all");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [selectedEigenstate, setSelectedEigenstate] = useState<MeasuredEigenstate | null>(null);

  // Handle noise preset change
  const handleSelectNoisePreset = (preset: NoisePreset) => {
    setSelectedNoisePreset(preset);
    if (preset !== "custom") {
      setNoiseConfig(NOISE_PRESETS[preset]);
    }
  };

  // Run full 512-state statevector fidelity analysis
  const fidelityAnalysis: QAOAFidelityAnalysis = useMemo(() => {
    return runQAOAFidelityAnalysis(mission, layersP, shots, gamma, beta, noiseConfig);
  }, [mission, layersP, shots, gamma, beta, noiseConfig]);

  const { eigenstates, statistics } = fidelityAnalysis;

  // Selected state defaults to ground state
  const activeState = selectedEigenstate || eigenstates[0];

  // Top eigenstates for primary bar chart
  const topEigenstatesData = useMemo(() => {
    return eigenstates.slice(0, topCount).map((s: MeasuredEigenstate) => ({
      ...s,
      shortLabel: `|${s.bitstring.slice(0, 3)} ${s.bitstring.slice(3, 6)} ${s.bitstring.slice(6, 9)}⟩`,
      probPct: Number((s.probability * 100).toFixed(2)),
      uniformPct: Number(((1 / 512) * 100).toFixed(3)),
    }));
  }, [eigenstates, topCount]);

  // Full 512-state spectrum for energy vs probability scatter/area
  const fullSpectrumData = useMemo(() => {
    // Sort by energy ascending to show energy landscape
    const sortedByEnergy = [...eigenstates].sort((a, b) => a.qubo_energy - b.qubo_energy);
    return sortedByEnergy.map((s: MeasuredEigenstate, idx: number) => ({
      energyIndex: idx,
      bitstring: s.bitstring,
      qubo_energy: s.qubo_energy,
      probability: Number((s.probability * 100).toFixed(3)),
      is_feasible: s.is_feasible,
      is_ground_state: s.is_ground_state,
      shots: s.measured_shots,
    }));
  }, [eigenstates]);

  // Cumulative distribution function (CDF)
  const cumulativeData = useMemo(() => {
    const sortedByEnergy = [...eigenstates].sort((a, b) => a.qubo_energy - b.qubo_energy);
    let cumProb = 0;
    return sortedByEnergy.map((s: MeasuredEigenstate, idx: number) => {
      cumProb += s.probability;
      return {
        stateRank: idx + 1,
        energy: s.qubo_energy,
        cumulativePct: Number((cumProb * 100).toFixed(2)),
        is_feasible: s.is_feasible,
      };
    });
  }, [eigenstates]);

  // Filtered table rows
  const filteredTableRows = useMemo(() => {
    return eigenstates.filter((s: MeasuredEigenstate) => {
      const matchesFilter =
        tableFilter === "all" ||
        (tableFilter === "feasible" && s.is_feasible) ||
        (tableFilter === "infeasible" && !s.is_feasible);

      const matchesSearch =
        !tableSearch.trim() ||
        s.bitstring.includes(tableSearch.trim()) ||
        s.window_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        s.trajectory_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        s.mode_name.toLowerCase().includes(tableSearch.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [eigenstates, tableFilter, tableSearch]);

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono text-cyan-400 font-semibold tracking-wider">
                  Page 11 — Quantum Fidelity &amp; Convergence Statistics
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border font-bold uppercase ${
                    statistics.confidence_tier === "High Confidence"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                      : statistics.confidence_tier === "Moderate Confidence"
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-rose-950 text-rose-300 border-rose-800"
                  }`}
                >
                  {statistics.confidence_tier} ({statistics.confidence_score}%)
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">
                QAOA Statevector Probability Distribution &amp; Solution Confidence
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl font-sans">
                Full statistical breakdown of the 9-qubit ($2^9 = 512$ dimensional) Hilbert space.
                Evaluate ground-state concentration, feasible subspace probability mass, spectral gap protection,
                and Shannon entropy to quantify statistical certainty before mission sign-off.
              </p>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex items-center gap-2">
            {onProceedToQAOA && (
              <button
                onClick={onProceedToQAOA}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Atom className="w-3.5 h-3.5 text-cyan-400" />
                <span>QAOA Circuit View</span>
              </button>
            )}

            {onProceedToQEC && (
              <button
                onClick={onProceedToQEC}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>QEC Noise Sim</span>
              </button>
            )}

            {onProceedToComparison && (
              <button
                onClick={onProceedToComparison}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors cursor-pointer shadow-sm shadow-cyan-500/20 font-mono"
              >
                <span>Comparison Benchmark</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 5 MASTER STATISTICAL CONFIDENCE KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs font-mono">
          {/* KPI 1: Ground State Fidelity */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 font-sans">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ground State |ψ₀⟩</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">Z = +{statistics.z_score_vs_uniform}σ</span>
            </div>
            <div className="text-2xl font-bold text-emerald-300 tracking-tight flex items-baseline gap-1">
              <span>{(statistics.ground_state_fidelity * 100).toFixed(1)}%</span>
              <span className="text-xs text-slate-500 font-normal">prob</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate" title={`Optimal: |${statistics.ground_state_bitstring}⟩`}>
              |{statistics.ground_state_bitstring}⟩ · E = {statistics.ground_state_energy}
            </div>
          </div>

          {/* KPI 2: Feasible Subspace Ratio */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Feasible Subspace</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-bold">27 / 512 States</span>
            </div>
            <div className="text-2xl font-bold text-cyan-300 tracking-tight flex items-baseline gap-1">
              <span>{statistics.feasible_mass_pct}%</span>
              <span className="text-xs text-slate-500 font-normal">mass</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Infeasible penalty leakage: {statistics.infeasible_mass_pct}%
            </div>
          </div>

          {/* KPI 3: Solution Confidence Score */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 font-sans">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                <span>Solution Confidence</span>
              </span>
              <span className="text-[10px] text-amber-400 font-bold">Bayesian</span>
            </div>
            <div className="text-2xl font-bold text-amber-300 tracking-tight flex items-baseline gap-1">
              <span>{statistics.confidence_score}</span>
              <span className="text-xs text-slate-500 font-normal">/ 100</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {statistics.confidence_tier}
            </div>
          </div>

          {/* KPI 4: Spectral Energy Gap */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 font-sans">
                <Scale className="w-3.5 h-3.5 text-indigo-400" />
                <span>Energy Gap ΔE</span>
              </span>
              <span className="text-[10px] text-indigo-400 font-bold">E₁ - E₀</span>
            </div>
            <div className="text-2xl font-bold text-indigo-300 tracking-tight flex items-baseline gap-1">
              <span>+{statistics.energy_spectral_gap}</span>
              <span className="text-xs text-slate-500 font-normal">units</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Ground-to-excited margin: {statistics.ground_vs_excited_ratio}×
            </div>
          </div>

          {/* KPI 5: Shannon Entropy & State Purity */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 font-sans">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Shannon Entropy</span>
              </span>
              <span className="text-[10px] text-purple-400 font-bold">{statistics.normalized_entropy_pct}%</span>
            </div>
            <div className="text-2xl font-bold text-purple-300 tracking-tight flex items-baseline gap-1">
              <span>{statistics.shannon_entropy}</span>
              <span className="text-xs text-slate-500 font-normal">/ 9 bits</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {statistics.effective_dimension} effective states
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE CONTROLS TOOLBAR FOR REAL-TIME RE-CALIBRATION */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-sans">
              Variational Calibration &amp; Noise Simulator:
            </span>
          </div>

          {/* Noise Preset Pills */}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-slate-500 mr-1 font-sans">Hardware Model:</span>
            {[
              { id: "ideal", label: "Ideal Statevector" },
              { id: "trapped_ion", label: "Ion Trap (Quantinuum)" },
              { id: "superconducting", label: "Transmon (IBM)" },
              { id: "high_decoherence", label: "High Thermal Drift" },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectNoisePreset(preset.id as NoisePreset)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer border ${
                  selectedNoisePreset === preset.id
                    ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-xs"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Slider Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
          {/* QAOA Layers p */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span className="font-sans">QAOA Layers (p):</span>
              <span className="text-cyan-400 font-bold">p = {layersP}</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={layersP}
              onChange={(e) => setLayersP(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>p=1 (Shallow)</span>
              <span>p=4 (Deep Entangled)</span>
            </div>
          </div>

          {/* Measurement Shots */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span className="font-sans">Measurement Shots:</span>
              <span className="text-amber-400 font-bold">{shots} shots</span>
            </div>
            <input
              type="range"
              min={256}
              max={4096}
              step={256}
              value={shots}
              onChange={(e) => setShots(Number(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>256 (Fast)</span>
              <span>4,096 (High Precision)</span>
            </div>
          </div>

          {/* Phase Angle Gamma */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span className="font-sans">Cost Phase (γ):</span>
              <span className="text-indigo-400 font-bold">{gamma.toFixed(2)} rad</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.02}
              value={gamma}
              onChange={(e) => setGamma(Number(e.target.value))}
              className="w-full accent-indigo-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.10 rad</span>
              <span>1.50 rad</span>
            </div>
          </div>

          {/* Mixer Angle Beta */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span className="font-sans">Mixer Angle (β):</span>
              <span className="text-purple-400 font-bold">{beta.toFixed(2)} rad</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.02}
              value={beta}
              onChange={(e) => setBeta(Number(e.target.value))}
              className="w-full accent-purple-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.10 rad</span>
              <span>1.50 rad</span>
            </div>
          </div>
        </div>
      </div>

      {/* STATISTICAL CONFIDENCE VERDICT BOX */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-xs font-sans">
          <div className="font-bold text-white flex items-center gap-2">
            <span>Statistical Confidence Assessment &amp; Hypothesis Validation:</span>
            <span className="text-slate-400 font-mono text-[11px]">
              Null Hypothesis H₀: P = 0.195% (Uniform Superposition)
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {statistics.confidence_summary}
          </p>
        </div>
      </div>

      {/* MAIN VISUALIZATION WORKBENCH: EIGENSTATE DISTRIBUTION */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        {/* Visual Mode Navigation Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase">View Spectrum:</span>
            <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setViewMode("top_eigenstates")}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === "top_eigenstates"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Top Eigenstates Bar Chart
              </button>

              <button
                onClick={() => setViewMode("full_spectrum")}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === "full_spectrum"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Full 512-State Spectrum (Energy vs P)
              </button>

              <button
                onClick={() => setViewMode("cumulative_cdf")}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === "cumulative_cdf"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Cumulative Confidence Curve (CDF)
              </button>
            </div>
          </div>

          {/* Sub-selector for top eigenstates count */}
          {viewMode === "top_eigenstates" && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <span>Display:</span>
              <select
                value={topCount}
                onChange={(e) => setTopCount(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value={8}>Top 8 States</option>
                <option value={16}>Top 16 States</option>
                <option value={24}>Top 24 States</option>
                <option value={32}>Top 32 States</option>
              </select>
            </div>
          )}
        </div>

        {/* CHART CANVAS */}
        <div className="w-full h-84 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 pt-4">
          {/* VIEW 1: TOP EIGENSTATES BAR CHART */}
          {viewMode === "top_eigenstates" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEigenstatesData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  unit="%"
                  label={{ value: "Measurement Probability P(x) (%)", angle: -90, position: "insideLeft", offset: 12, fill: "#38bdf8", fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data: MeasuredEigenstate = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-2xl text-xs font-mono space-y-1.5 max-w-sm">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                          <span className="text-white font-bold text-sm">|{data.bitstring}⟩</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              data.is_ground_state
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : data.is_feasible
                                ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                                : "bg-rose-950 text-rose-300 border border-rose-800"
                            }`}
                          >
                            {data.is_ground_state ? "Ground State Optimum" : data.is_feasible ? "Feasible State" : "Constraint Penalty"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div>
                            <span className="text-slate-500 block">Probability:</span>
                            <span className="text-cyan-300 font-bold">{(data.probability * 100).toFixed(2)}%</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Shots Measured:</span>
                            <span className="text-amber-300 font-bold">{data.measured_shots} / {shots}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">QUBO Energy:</span>
                            <span className="text-white font-bold">{data.qubo_energy}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Rank:</span>
                            <span className="text-slate-300 font-bold">#{data.rank} of 512</span>
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-slate-800 text-[10px] font-sans text-slate-300 space-y-0.5">
                          <div className="font-semibold text-white">Decoded Aerospace Configuration:</div>
                          <div>Window: <strong className="text-slate-200">{data.window_name}</strong></div>
                          <div>Trajectory: <strong className="text-slate-200">{data.trajectory_name}</strong></div>
                          <div>Throttle Mode: <strong className="text-slate-200">{data.mode_name}</strong></div>
                        </div>

                        {data.violations.length > 0 && (
                          <div className="pt-1 text-[10px] text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-900/60">
                            Violations: {data.violations.join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Reference line for uniform random distribution (1/512 = 0.195%) */}
                <ReferenceLine
                  y={Number(((1 / 512) * 100).toFixed(3))}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: "Uniform Baseline (1/512 = 0.195%)", fill: "#94a3b8", fontSize: 10, position: "insideTopRight" }}
                />
                <Bar dataKey="probPct" name="Probability (%)" radius={[4, 4, 0, 0]}>
                  {topEigenstatesData.map((entry: (typeof topEigenstatesData)[0], index: number) => {
                    let fill = "#6366f1"; // default indigo
                    if (entry.is_ground_state) fill = "#10b981"; // emerald for ground state
                    else if (entry.is_feasible) fill = "#06b6d4"; // cyan for feasible
                    else fill = "#f43f5e"; // rose for infeasible
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* VIEW 2: FULL 512-STATE SPECTRUM (SCATTER: ENERGY VS PROBABILITY) */}
          {viewMode === "full_spectrum" && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="qubo_energy"
                  name="QUBO Energy"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: "QUBO Energy E(x) (Lower is Better)", position: "insideBottom", offset: -12, fill: "#64748b", fontSize: 11 }}
                />
                <YAxis
                  dataKey="probability"
                  name="Probability"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  unit="%"
                  label={{ value: "State Probability P(x) (%)", angle: -90, position: "insideLeft", offset: 12, fill: "#38bdf8", fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-xs font-mono space-y-1">
                        <div className="text-white font-bold">|{data.bitstring}⟩</div>
                        <div className="text-cyan-400">Probability: {data.probability}%</div>
                        <div className="text-amber-400">Energy: {data.qubo_energy}</div>
                        <div className={data.is_feasible ? "text-emerald-400" : "text-rose-400"}>
                          {data.is_feasible ? "Feasible Subspace" : "Penalty Violated"}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter data={fullSpectrumData}>
                  {fullSpectrumData.map((entry, index) => {
                    let fill = "#6366f1";
                    if (entry.is_ground_state) fill = "#10b981";
                    else if (entry.is_feasible) fill = "#06b6d4";
                    else fill = "#f43f5e";
                    return <Cell key={`scatter-cell-${index}`} fill={fill} opacity={entry.is_feasible ? 0.9 : 0.4} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}

          {/* VIEW 3: CUMULATIVE CONFIDENCE CURVE (CDF) */}
          {viewMode === "cumulative_cdf" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="cdfGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="energy"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: "Sorted QUBO Energy Threshold E", position: "insideBottom", offset: -12, fill: "#64748b", fontSize: 11 }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  unit="%"
                  domain={[0, 100]}
                  label={{ value: "Cumulative Probability CDF (%)", angle: -90, position: "insideLeft", offset: 12, fill: "#38bdf8", fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-xs font-mono space-y-1">
                        <div className="text-cyan-400 font-bold">Energy Threshold ≤ {data.energy}</div>
                        <div className="text-white">Cumulative Confidence: {data.cumulativePct}%</div>
                        <div className="text-slate-400">Rank: #{data.stateRank} of 512 states</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "50% Confidence", fill: "#f59e0b", fontSize: 10 }} />
                <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" label={{ value: "90% Confidence", fill: "#10b981", fontSize: 10 }} />
                <Area type="monotone" dataKey="cumulativePct" stroke="#06b6d4" strokeWidth={2.4} fill="url(#cdfGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* COLOR-CODED LEGEND STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span>Ground State Optimum |ψ₀⟩</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
              <span>Feasible States (27 valid)</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              <span>Infeasible (Penalty Violated)</span>
            </span>
          </div>

          <div className="text-slate-500 text-[11px]">
            Statistical Confidence Index: <strong className="text-amber-400">{statistics.confidence_score}/100</strong>
          </div>
        </div>
      </div>

      {/* SELECTED EIGENSTATE DECODED INSPECTOR CARD */}
      {activeState && (
        <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/60 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono">
              <Atom className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold text-sm">
                Eigenstate Inspector: |{activeState.bitstring}⟩
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  activeState.is_ground_state
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : activeState.is_feasible
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {activeState.is_ground_state ? "Global Ground State" : activeState.is_feasible ? "Feasible Candidate" : "Penalty Violated"}
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Rank #{activeState.rank} of 512 · {activeState.measured_shots} shots measured ({(activeState.probability * 100).toFixed(2)}%)
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Launch Window</span>
              <span className="text-white font-bold">{activeState.window_name}</span>
            </div>
            <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Trajectory Profile</span>
              <span className="text-cyan-300 font-bold">{activeState.trajectory_name}</span>
            </div>
            <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Throttle Mode</span>
              <span className="text-amber-300 font-bold">{activeState.mode_name}</span>
            </div>
            <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">QUBO Energy</span>
              <span className="text-emerald-300 font-bold">{activeState.qubo_energy}</span>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED EIGENSTATE TABLE WITH SEARCH & FILTER */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 shadow-xl space-y-0">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-sans uppercase tracking-wider">
              Measured Eigenstates Ledger ({eigenstates.length} Quantum States)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setTableFilter("all")}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  tableFilter === "all" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                All (512)
              </button>
              <button
                onClick={() => setTableFilter("feasible")}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  tableFilter === "feasible" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Feasible (27)
              </button>
              <button
                onClick={() => setTableFilter("infeasible")}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  tableFilter === "infeasible" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Infeasible (485)
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter bitstring..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md pl-7 pr-2 py-1 w-36 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-600"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-mono border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Eigenstate |x⟩</th>
                <th className="p-3">Probability</th>
                <th className="p-3">Measured Shots</th>
                <th className="p-3">QUBO Energy</th>
                <th className="p-3">Feasibility Status</th>
                <th className="p-3">Decoded Aerospace Configuration</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {filteredTableRows.slice(0, 50).map((row: MeasuredEigenstate) => {
                const isSelected = activeState?.bitstring === row.bitstring;
                return (
                  <tr
                    key={row.bitstring}
                    onClick={() => setSelectedEigenstate(row)}
                    className={`hover:bg-slate-900/60 cursor-pointer transition-colors ${
                      isSelected ? "bg-cyan-950/30 border-l-2 border-l-cyan-400" : ""
                    }`}
                  >
                    <td className="p-3 font-bold text-slate-400">#{row.rank}</td>
                    <td className="p-3 font-bold text-white">
                      |{row.bitstring}⟩
                      {row.is_ground_state && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Ground
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-cyan-300 font-semibold tabular-nums">
                      {(row.probability * 100).toFixed(2)}%
                    </td>
                    <td className="p-3 text-amber-300 tabular-nums">
                      {row.measured_shots} / {shots}
                    </td>
                    <td className="p-3 text-slate-200 tabular-nums font-bold">
                      {row.qubo_energy}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.is_feasible
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800/80"
                            : "bg-rose-950 text-rose-300 border border-rose-800/80"
                        }`}
                      >
                        {row.is_feasible ? "Feasible" : "Infeasible"}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-300 text-[11px] truncate max-w-xs">
                      {row.window_name} · {row.trajectory_name} · {row.mode_name}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEigenstate(row);
                        }}
                        className="px-2 py-1 text-[10px] font-mono bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700 rounded transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
