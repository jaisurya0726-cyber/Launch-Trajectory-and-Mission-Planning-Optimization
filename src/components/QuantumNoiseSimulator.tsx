import React from "react";
import { QuantumNoiseConfig, NoisePreset } from "../types";
import { NOISE_PRESETS } from "../lib/optimization";
import {
  Zap,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Cpu,
  TrendingDown,
  Info,
} from "lucide-react";

interface QuantumNoiseSimulatorProps {
  noiseConfig: QuantumNoiseConfig;
  onUpdateNoiseConfig: (config: QuantumNoiseConfig) => void;
  layersP: number;
}

export const QuantumNoiseSimulator: React.FC<QuantumNoiseSimulatorProps> = ({
  noiseConfig,
  onUpdateNoiseConfig,
  layersP,
}) => {
  const cnotCount = 36 * layersP;
  const singleQCount = 9 + 18 * layersP;
  const circuitDurationUs = layersP * (36 * 0.25 + 18 * 0.04);

  // Compute live physics parameters
  const gateFidelity =
    Math.pow(Math.max(0, 1 - noiseConfig.twoQubitGateError), cnotCount) *
    Math.pow(Math.max(0, 1 - noiseConfig.singleQubitGateError), singleQCount);

  const decoherenceFidelity =
    Math.exp(-circuitDurationUs / Math.max(1, noiseConfig.dephasingTimeT2Us)) *
    Math.exp(-circuitDurationUs / (2 * Math.max(1, noiseConfig.relaxationTimeT1Us)));

  const readoutFidelity = Math.pow(Math.max(0, 1 - noiseConfig.readoutError), 9);

  const totalCircuitFidelity = noiseConfig.enabled
    ? Math.max(0.04, Math.min(0.999, gateFidelity * decoherenceFidelity * readoutFidelity))
    : 1.0;

  const decoherenceLossPct = Number(((1.0 - totalCircuitFidelity) * 100).toFixed(1));

  const handleSelectPreset = (preset: Exclude<NoisePreset, "custom">) => {
    onUpdateNoiseConfig({
      ...NOISE_PRESETS[preset],
    });
  };

  const handleToggleNoise = () => {
    onUpdateNoiseConfig({
      ...noiseConfig,
      enabled: !noiseConfig.enabled,
    });
  };

  const handleSliderChange = (field: keyof QuantumNoiseConfig, value: number) => {
    onUpdateNoiseConfig({
      ...noiseConfig,
      enabled: true,
      preset: "custom",
      [field]: value,
    });
  };

  return (
    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
      {/* Header & Master Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-400">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>NISQ Quantum Noise &amp; Decoherence Channel Simulator</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                  noiseConfig.enabled
                    ? "bg-rose-950 text-rose-300 border-rose-800"
                    : "bg-emerald-950 text-emerald-300 border-emerald-800"
                }`}
              >
                {noiseConfig.enabled ? "Noise Active (Decohering)" : "Ideal Circuit (Noise-Free)"}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Simulate Krauss depolarizing operators, T₁/T₂ dephasing, and CNOT entangler gate cross-talk on 9-qubit QAOA convergence
            </div>
          </div>
        </div>

        {/* Master Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleNoise}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
              noiseConfig.enabled
                ? "bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{noiseConfig.enabled ? "Disable Noise" : "Enable Noise Simulation"}</span>
          </button>
        </div>
      </div>

      {/* Hardware Architecture Presets */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono text-slate-400 block">Quantum Hardware Architecture Presets:</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <button
            onClick={() => handleSelectPreset("ideal")}
            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              !noiseConfig.enabled || noiseConfig.preset === "ideal"
                ? "bg-cyan-950 text-cyan-200 border-cyan-500 shadow-md font-bold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span>Zero Noise</span>
              <span className="text-[9px] px-1 bg-emerald-950 text-emerald-300 rounded font-mono">100% Purity</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-sans">Fault-tolerant mathematical limit</div>
          </button>

          <button
            onClick={() => handleSelectPreset("trapped_ion")}
            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              noiseConfig.enabled && noiseConfig.preset === "trapped_ion"
                ? "bg-cyan-950 text-cyan-200 border-cyan-500 shadow-md font-bold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span>Trapped Ion</span>
              <span className="text-[9px] px-1 bg-cyan-950 text-cyan-300 rounded font-mono">Quantinuum H2</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-sans">Low 2Q error (0.3%), T₂ = 1.2 ms</div>
          </button>

          <button
            onClick={() => handleSelectPreset("superconducting")}
            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              noiseConfig.enabled && noiseConfig.preset === "superconducting"
                ? "bg-amber-950 text-amber-200 border-amber-500 shadow-md font-bold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span>Superconducting</span>
              <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded font-mono">IBM Eagle / Heron</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-sans">Transmon 2Q error (1.5%), T₂ = 65 μs</div>
          </button>

          <button
            onClick={() => handleSelectPreset("high_decoherence")}
            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              noiseConfig.enabled && noiseConfig.preset === "high_decoherence"
                ? "bg-rose-950 text-rose-200 border-rose-500 shadow-md font-bold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span>High Decoherence</span>
              <span className="text-[9px] px-1 bg-rose-950 text-rose-300 rounded font-mono">Severe Noise</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-sans">High crosstalk (4.8%), T₂ = 18 μs</div>
          </button>
        </div>
      </div>

      {/* Live Physical Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block uppercase">Circuit State Purity (Fidelity)</span>
          <div
            className={`text-base font-bold mt-0.5 tabular-nums ${
              totalCircuitFidelity > 0.75
                ? "text-emerald-400"
                : totalCircuitFidelity > 0.45
                ? "text-amber-400"
                : "text-rose-400"
            }`}
          >
            {(totalCircuitFidelity * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            F = F_gate · F_T1/T2 · F_RO
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block uppercase">Decoherence Loss Gap (ΔF)</span>
          <div className="text-base font-bold text-rose-400 mt-0.5 tabular-nums">
            -{decoherenceLossPct}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Depolarization into mixed state</div>
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block uppercase">2Q CNOT Entangler Budget</span>
          <div className="text-base font-bold text-cyan-400 mt-0.5 tabular-nums">
            {cnotCount} Gates (p={layersP})
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Error accumulation: (1 - ε₂)^{cnotCount}
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block uppercase">Circuit Depth / Duration</span>
          <div className="text-base font-bold text-purple-400 mt-0.5 tabular-nums">
            {circuitDurationUs.toFixed(1)} μs
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            T₂ Decay Ratio: {(circuitDurationUs / Math.max(1, noiseConfig.dephasingTimeT2Us)).toFixed(2)}x
          </div>
        </div>
      </div>

      {/* Detailed Interactive Sliders Grid */}
      <div className="p-4 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Parametric Noise Channel Adjustment (Custom Tuning)</span>
          </span>
          <span className="text-[11px] text-slate-500">Fine-tune individual error channels</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
          {/* 2-Qubit CNOT Gate Error Slider */}
          <div className="space-y-1.5 p-2.5 rounded bg-slate-900/60 border border-slate-800/60">
            <div className="flex justify-between">
              <span className="text-slate-400">2-Qubit CNOT Error (ε₂)</span>
              <span className="text-rose-400 font-bold">
                {(noiseConfig.twoQubitGateError * 100).toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.08}
              step={0.001}
              value={noiseConfig.twoQubitGateError}
              onChange={(e) => handleSliderChange("twoQubitGateError", Number(e.target.value))}
              className="w-full accent-rose-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-500">All-to-all QUBO entanglers</div>
          </div>

          {/* 1-Qubit Gate Error Slider */}
          <div className="space-y-1.5 p-2.5 rounded bg-slate-900/60 border border-slate-800/60">
            <div className="flex justify-between">
              <span className="text-slate-400">1-Qubit Gate Error (ε₁)</span>
              <span className="text-amber-400 font-bold">
                {(noiseConfig.singleQubitGateError * 100).toFixed(3)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.015}
              step={0.0002}
              value={noiseConfig.singleQubitGateError}
              onChange={(e) => handleSliderChange("singleQubitGateError", Number(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-500">Hadamard, Rz(γ), and Rx(2β) gates</div>
          </div>

          {/* Dephasing Time T2 Slider */}
          <div className="space-y-1.5 p-2.5 rounded bg-slate-900/60 border border-slate-800/60">
            <div className="flex justify-between">
              <span className="text-slate-400">Dephasing Time (T₂)</span>
              <span className="text-cyan-400 font-bold">{noiseConfig.dephasingTimeT2Us} μs</span>
            </div>
            <input
              type="range"
              min={10}
              max={1500}
              step={10}
              value={noiseConfig.dephasingTimeT2Us}
              onChange={(e) => handleSliderChange("dephasingTimeT2Us", Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-500">Transverse phase coherence lifetime</div>
          </div>

          {/* Thermal Relaxation Time T1 Slider */}
          <div className="space-y-1.5 p-2.5 rounded bg-slate-900/60 border border-slate-800/60">
            <div className="flex justify-between">
              <span className="text-slate-400">Thermal Relaxation (T₁)</span>
              <span className="text-purple-400 font-bold">{noiseConfig.relaxationTimeT1Us} μs</span>
            </div>
            <input
              type="range"
              min={15}
              max={2500}
              step={15}
              value={noiseConfig.relaxationTimeT1Us}
              onChange={(e) => handleSliderChange("relaxationTimeT1Us", Number(e.target.value))}
              className="w-full accent-purple-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-500">Spontaneous emission into ground state</div>
          </div>

          {/* Readout Measurement Error Slider */}
          <div className="space-y-1.5 p-2.5 rounded bg-slate-900/60 border border-slate-800/60">
            <div className="flex justify-between">
              <span className="text-slate-400">Readout Measurement Error</span>
              <span className="text-emerald-400 font-bold">
                {(noiseConfig.readoutError * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.08}
              step={0.002}
              value={noiseConfig.readoutError}
              onChange={(e) => handleSliderChange("readoutError", Number(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
            <div className="text-[10px] text-slate-500">Z-basis projective detector bit-flip rate</div>
          </div>

          {/* Reset to Default */}
          <div className="flex flex-col justify-end p-2.5">
            <button
              onClick={() => handleSelectPreset("superconducting")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset to NISQ Transmon Baseline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
