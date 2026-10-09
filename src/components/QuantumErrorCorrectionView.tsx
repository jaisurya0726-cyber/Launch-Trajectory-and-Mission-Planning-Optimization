import React, { useState, useMemo } from "react";
import { Mission, QECCodeType, QECPreset } from "../types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
  Cell,
} from "recharts";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Sliders,
  RotateCcw,
  Sparkles,
  Layers,
  Cpu,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Atom,
  RefreshCw,
  Binary,
  GitBranch,
} from "lucide-react";

interface QuantumErrorCorrectionViewProps {
  mission: Mission;
  onProceedToQAOA?: () => void;
  onProceedToComparison?: () => void;
  onProceedToFidelity?: () => void;
}

interface CodeMetadata {
  name: string;
  shortName: string;
  qubitsPerLogical: number;
  distance: number;
  correctableErrors: number;
  type: string;
  description: string;
}

const QEC_CODES: Record<QECCodeType, CodeMetadata> = {
  unprotected: {
    name: "Unprotected Physical NISQ",
    shortName: "Physical",
    qubitsPerLogical: 1,
    distance: 1,
    correctableErrors: 0,
    type: "Bare Qubit",
    description: "No error correction encoding. Exposed to full gate and environment decoherence.",
  },
  repetition_3: {
    name: "3-Qubit Bit-Flip Repetition [[3, 1, 1]]",
    shortName: "Repetition-3",
    qubitsPerLogical: 3,
    distance: 1, // in Z basis
    correctableErrors: 1,
    type: "Classical-Analog",
    description: "Protects against single bit-flip (X) errors; phase-flip (Z) errors pass unmitigated.",
  },
  perfect_5: {
    name: "5-Qubit Perfect Code [[5, 1, 3]]",
    shortName: "Perfect-5",
    qubitsPerLogical: 5,
    distance: 3,
    correctableErrors: 1,
    type: "Non-CSS Stabilizer",
    description: "Smallest quantum code correcting any arbitrary single-qubit Pauli error (X, Y, or Z).",
  },
  steane_7: {
    name: "Steane CSS Code [[7, 1, 3]]",
    shortName: "Steane-7",
    qubitsPerLogical: 7,
    distance: 3,
    correctableErrors: 1,
    type: "Calderbank-Shor-Steane",
    description: "Derived from classical [7,4,3] Hamming code. Transversal Clifford gates for fast fault-tolerant synthesis.",
  },
  shor_9: {
    name: "Shor Concatenated Code [[9, 1, 3]]",
    shortName: "Shor-9",
    qubitsPerLogical: 9,
    distance: 3,
    correctableErrors: 1,
    type: "Concatenated",
    description: "Concatenates 3-qubit phase-flip and bit-flip codes; historic first universal QEC proposal.",
  },
  surface_17_d3: {
    name: "Rotated Surface Code (d = 3, 17 Qubits)",
    shortName: "Surface-17 (d=3)",
    qubitsPerLogical: 17,
    distance: 3,
    correctableErrors: 1,
    type: "Topological 2D Lattice",
    description: "State-of-the-art planar lattice with 2D nearest-neighbor coupling. High threshold p_th ~ 0.9%.",
  },
  surface_49_d5: {
    name: "Rotated Surface Code (d = 5, 49 Qubits)",
    shortName: "Surface-49 (d=5)",
    qubitsPerLogical: 49,
    distance: 5,
    correctableErrors: 2,
    type: "Topological 2D Lattice",
    description: "Distance-5 lattice capable of correcting any 2 arbitrary errors. Exponential logical suppression below threshold.",
  },
  zne_mitigated: {
    name: "Zero-Noise Extrapolation (ZNE Mitigation)",
    shortName: "ZNE Mitigated",
    qubitsPerLogical: 1,
    distance: 1,
    correctableErrors: 0,
    type: "Algorithmic Mitigation",
    description: "Software-level Richardson extrapolation across noise-scaled pulse durations. No physical qubit overhead.",
  },
};

const PRESETS: Record<QECPreset, {
  name: string;
  depolarizing: number;
  twoQubit: number;
  singleQubit: number;
  readout: number;
  code: QECCodeType;
  description: string;
}> = {
  ideal: {
    name: "Ideal Fault-Free Simulator",
    depolarizing: 0.0,
    twoQubit: 0.0,
    singleQubit: 0.0,
    readout: 0.0,
    code: "unprotected",
    description: "Mathematical statevector simulation without stochastic noise channels.",
  },
  trapped_ion: {
    name: "Trapped Ion (e.g. Quantinuum H2)",
    depolarizing: 0.0006, // 0.06%
    twoQubit: 0.0015,     // 0.15% CNOT
    singleQubit: 0.0002,   // 0.02%
    readout: 0.002,       // 0.2%
    code: "steane_7",
    description: "Ultra-high all-to-all fidelity with deep coherence times and sharp gate precision.",
  },
  superconducting_ft: {
    name: "Fault-Tolerant Superconducting (IBM Heron / Sycamore)",
    depolarizing: 0.002, // 0.2%
    twoQubit: 0.004,     // 0.4%
    singleQubit: 0.0005,  // 0.05%
    readout: 0.012,      // 1.2%
    code: "surface_17_d3",
    description: "Sub-threshold heavy-hex / square planar architecture with active real-time syndrome extraction.",
  },
  threshold_crossing: {
    name: "Pseudothreshold Crossover Point (p ≈ 0.9%)",
    depolarizing: 0.009, // 0.9%
    twoQubit: 0.009,     // 0.9%
    singleQubit: 0.001,
    readout: 0.02,
    code: "surface_17_d3",
    description: "Demonstrates the exact boundary where QEC code overhead matches physical error rates.",
  },
  nisq_baseline: {
    name: "Standard NISQ Commercial Hardware",
    depolarizing: 0.008, // 0.8%
    twoQubit: 0.015,     // 1.5%
    singleQubit: 0.0015,
    readout: 0.025,
    code: "zne_mitigated",
    description: "Contemporary superconducting chips running error mitigation without physical logical encoding.",
  },
  high_noise: {
    name: "High-Noise Decoherence Testbed",
    depolarizing: 0.025, // 2.5%
    twoQubit: 0.035,     // 3.5%
    singleQubit: 0.004,
    readout: 0.05,
    code: "unprotected",
    description: "Severe gate error and depolarizing stress test to inspect fidelity decay and entropy explosion.",
  },
  custom: {
    name: "User-Defined Calibration",
    depolarizing: 0.005,
    twoQubit: 0.008,
    singleQubit: 0.001,
    readout: 0.015,
    code: "surface_17_d3",
    description: "Custom empirical parameters specified via interactive sliders.",
  },
};

export const QuantumErrorCorrectionView: React.FC<QuantumErrorCorrectionViewProps> = ({
  mission,
  onProceedToQAOA,
  onProceedToComparison,
  onProceedToFidelity,
}) => {
  // Interactive Simulation State
  const [activePreset, setActivePreset] = useState<QECPreset>("superconducting_ft");
  const [depolarizingRate, setDepolarizingRate] = useState<number>(0.002); // 0.2%
  const [twoQubitRate, setTwoQubitRate] = useState<number>(0.004);         // 0.4%
  const [singleQubitRate, setSingleQubitRate] = useState<number>(0.0005);   // 0.05%
  const [readoutErrorRate, setReadoutErrorRate] = useState<number>(0.012);  // 1.2%
  const [layersP, setLayersP] = useState<number>(1);
  const [selectedCode, setSelectedCode] = useState<QECCodeType>("surface_17_d3");

  // Interactive Syndrome Simulator state
  const [injectedErrorQubit, setInjectedErrorQubit] = useState<number>(2);
  const [injectedErrorType, setInjectedErrorType] = useState<"X" | "Z" | "Y">("X");
  const [syndromeSimKey, setSyndromeSimKey] = useState<number>(0);

  // Apply a Preset
  const handleSelectPreset = (preset: QECPreset) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      const p = PRESETS[preset];
      setDepolarizingRate(p.depolarizing);
      setTwoQubitRate(p.twoQubit);
      setSingleQubitRate(p.singleQubit);
      setReadoutErrorRate(p.readout);
      setSelectedCode(p.code);
    }
  };

  const handleSliderChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    val: number
  ) => {
    setter(val);
    setActivePreset("custom");
  };

  // Circuit Gate Counts for 9-Qubit QAOA
  const N_LOGICAL = 9;
  const cnotCount = 36 * layersP;
  const singleQCount = 9 + 18 * layersP;
  const totalGates = cnotCount + singleQCount;

  // Physical error aggregation
  const effectivePhysicalError = useMemo(() => {
    return Math.max(depolarizingRate, twoQubitRate) + 0.3 * singleQubitRate;
  }, [depolarizingRate, twoQubitRate, singleQubitRate]);

  // Physical circuit fidelity calculation
  const physicalFidelity = useMemo(() => {
    if (depolarizingRate === 0 && twoQubitRate === 0 && singleQubitRate === 0 && readoutErrorRate === 0) {
      return 1.0;
    }
    const gateTerm =
      Math.pow(Math.max(0, 1 - twoQubitRate), cnotCount) *
      Math.pow(Math.max(0, 1 - singleQubitRate), singleQCount) *
      Math.pow(Math.max(0, 1 - 0.75 * depolarizingRate), totalGates);
    const readoutTerm = Math.pow(Math.max(0, 1 - readoutErrorRate), N_LOGICAL);
    return Math.max(0.01, Math.min(0.999, gateTerm * readoutTerm));
  }, [depolarizingRate, twoQubitRate, singleQubitRate, readoutErrorRate, cnotCount, singleQCount, totalGates]);

  // Threshold calculations
  const SURFACE_THRESHOLD = 0.009; // 0.9% for surface code
  const STEANE_THRESHOLD = 0.005;  // 0.5% for Steane [[7,1,3]]

  // QEC Logical Fidelity calculations for each code
  const computeLogicalFidelityForCode = (code: QECCodeType, pPhys: number, pMeas: number, depth: number) => {
    const gates = 36 * depth + (9 + 18 * depth);
    if (pPhys <= 0.000001 && pMeas <= 0.000001) return 1.0;

    switch (code) {
      case "unprotected": {
        const f = Math.pow(Math.max(0, 1 - pPhys), gates) * Math.pow(Math.max(0, 1 - pMeas), 9);
        return Math.max(0.01, Math.min(0.999, f));
      }
      case "repetition_3": {
        // Corrects bit-flips, but phase-flip is unmitigated
        const pL_bit = 3 * Math.pow(pPhys, 2);
        const pL_phase = pPhys * 0.35; // uncaught phase noise
        const pL_gate = Math.min(0.4, pL_bit + pL_phase);
        const f = Math.pow(Math.max(0, 1 - pL_gate), gates) * Math.pow(Math.max(0, 1 - pMeas * 0.8), 9);
        return Math.max(0.02, Math.min(0.999, f));
      }
      case "perfect_5": {
        // Distance 3, corrects 1 error
        const pL_gate = Math.min(0.35, 10 * Math.pow(pPhys, 2));
        const pL_meas = Math.min(0.35, 6 * Math.pow(pMeas, 2));
        const f = Math.pow(Math.max(0, 1 - pL_gate), gates) * Math.pow(Math.max(0, 1 - pL_meas), 9);
        return Math.max(0.02, Math.min(0.999, f));
      }
      case "steane_7": {
        // Distance 3 CSS code, threshold ~0.5%
        const ratio = pPhys / STEANE_THRESHOLD;
        let pL_gate: number;
        if (ratio < 1.0) {
          pL_gate = 0.04 * Math.pow(ratio, 2);
        } else {
          pL_gate = Math.min(0.35, 0.04 * ratio * 1.8);
        }
        const f = Math.pow(Math.max(0, 1 - pL_gate), gates) * Math.pow(Math.max(0, 1 - 0.02 * Math.pow(pMeas / 0.01, 2)), 9);
        return Math.max(0.02, Math.min(0.999, f));
      }
      case "shor_9": {
        const pL_gate = Math.min(0.35, 27 * Math.pow(pPhys, 2));
        const f = Math.pow(Math.max(0, 1 - pL_gate), gates) * Math.pow(Math.max(0, 1 - pMeas * 0.4), 9);
        return Math.max(0.02, Math.min(0.999, f));
      }
      case "surface_17_d3": {
        // Distance 3 Surface Code, p_th ~ 0.9%
        const ratio = pPhys / SURFACE_THRESHOLD;
        let pL_gate: number;
        if (ratio < 1.0) {
          pL_gate = 0.025 * Math.pow(ratio, 2); // quadratic suppression
        } else {
          pL_gate = Math.min(0.4, 0.025 * Math.pow(ratio, 1.4)); // overhead hurts above threshold
        }
        const pL_meas = Math.min(0.25, 0.015 * Math.pow(pMeas / 0.01, 2));
        const f = Math.pow(Math.max(0, 1 - pL_gate), gates) * Math.pow(Math.max(0, 1 - pL_meas), 9);
        return Math.max(0.03, Math.min(0.999, f));
      }
      case "surface_49_d5": {
        // Distance 5 Surface Code, cubic suppression below threshold
        const ratio = pPhys / SURFACE_THRESHOLD;
        let pL_gate: number;
        if (ratio < 1.0) {
          pL_gate = 0.02 * Math.pow(ratio, 3); // cubic suppression!
        } else {
          pL_gate = Math.min(0.45, 0.02 * Math.pow(ratio, 1.9)); // large overhead hurts more above threshold!
        }
        const pL_meas = Math.min(0.25, 0.01 * Math.pow(pMeas / 0.01, 3));
        const f = Math.pow(Math.max(0, 1 - pL_gate), gates) * Math.pow(Math.max(0, 1 - pL_meas), 9);
        return Math.max(0.02, Math.min(0.999, f));
      }
      case "zne_mitigated": {
        // Algorithmic zero-noise Richardson extrapolation
        const rawF = Math.pow(Math.max(0, 1 - pPhys), gates) * Math.pow(Math.max(0, 1 - pMeas), 9);
        const mitigatedF = Math.min(0.992, rawF + 0.65 * (1.0 - rawF) * Math.exp(-pPhys * 30));
        return Math.max(0.05, mitigatedF);
      }
      default:
        return 0.5;
    }
  };

  // Current selected code logical fidelity
  const currentLogicalFidelity = useMemo(() => {
    return computeLogicalFidelityForCode(selectedCode, effectivePhysicalError, readoutErrorRate, layersP);
  }, [selectedCode, effectivePhysicalError, readoutErrorRate, layersP]);

  // Is sub-threshold?
  const isSubThreshold = effectivePhysicalError < SURFACE_THRESHOLD;
  const thresholdRatio = Number((effectivePhysicalError / SURFACE_THRESHOLD).toFixed(2));

  // Total physical qubits needed for the 9-qubit trajectory mission
  const totalPhysicalQubits = N_LOGICAL * QEC_CODES[selectedCode].qubitsPerLogical;

  // Ground state recovery probability estimate (Ideal ground state probability ~ 16.5% for p=1)
  const idealGroundStateProb = 0.165 + (layersP - 1) * 0.045;
  const physicalGroundStateProb = Math.max(0.002, idealGroundStateProb * physicalFidelity);
  const qecGroundStateProb = Math.max(0.002, idealGroundStateProb * currentLogicalFidelity);

  // Depolarizing Noise Sweep Curve Data (from p = 0 to 2.5%)
  const sweepData = useMemo(() => {
    const points: Array<{
      p_pct: number;
      label: string;
      rawPhysical: number;
      surfaceD3: number;
      surfaceD5: number;
      steane7: number;
      zne: number;
    }> = [];

    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const p = (i * 0.001); // 0.0% to 2.5%
      const p_pct = Number((p * 100).toFixed(2));
      const raw = computeLogicalFidelityForCode("unprotected", p, readoutErrorRate, layersP) * 100;
      const d3 = computeLogicalFidelityForCode("surface_17_d3", p, readoutErrorRate, layersP) * 100;
      const d5 = computeLogicalFidelityForCode("surface_49_d5", p, readoutErrorRate, layersP) * 100;
      const steane = computeLogicalFidelityForCode("steane_7", p, readoutErrorRate, layersP) * 100;
      const zne = computeLogicalFidelityForCode("zne_mitigated", p, readoutErrorRate, layersP) * 100;

      points.push({
        p_pct,
        label: `${p_pct}%`,
        rawPhysical: Number(raw.toFixed(1)),
        surfaceD3: Number(d3.toFixed(1)),
        surfaceD5: Number(d5.toFixed(1)),
        steane7: Number(steane.toFixed(1)),
        zne: Number(zne.toFixed(1)),
      });
    }
    return points;
  }, [readoutErrorRate, layersP]);

  // QAOA Circuit Depth Scaling Data (p = 1 to 5)
  const depthScalingData = useMemo(() => {
    const depths = [1, 2, 3, 4, 5];
    return depths.map((d) => {
      const raw = computeLogicalFidelityForCode("unprotected", effectivePhysicalError, readoutErrorRate, d) * 100;
      const selCodeFid = computeLogicalFidelityForCode(selectedCode, effectivePhysicalError, readoutErrorRate, d) * 100;
      const idealFid = 100;
      const cnotCountForD = 36 * d;
      return {
        depth: `p = ${d}`,
        layers: d,
        cnots: cnotCountForD,
        ideal: idealFid,
        physical: Number(raw.toFixed(1)),
        qecProtected: Number(selCodeFid.toFixed(1)),
      };
    });
  }, [effectivePhysicalError, readoutErrorRate, selectedCode]);

  // Interactive Syndrome Extraction Calculation
  const syndromeResult = useMemo(() => {
    // In Steane [[7,1,3]] or Surface-17, let's illustrate how stabilizer measurements pinpoint the error:
    // Qubit indices 0 to 6 for a 7-qubit code:
    // Syndrome bits: s1, s2, s3 (for bit-flip X) or s4, s5, s6 (for phase-flip Z)
    const q = injectedErrorQubit % 7;
    // Standard Hamming matrix binary representation for qubit index + 1:
    const bin = (q + 1).toString(2).padStart(3, "0");
    const s1 = bin[2] === "1" ? 1 : 0;
    const s2 = bin[1] === "1" ? 1 : 0;
    const s3 = bin[0] === "1" ? 1 : 0;
    const syndromeVector = `[${s3}, ${s2}, ${s1}]`;

    // Is correctable by current code?
    const distance = QEC_CODES[selectedCode].distance;
    const maxErrors = Math.floor((distance - 1) / 2);
    const isCorrectable = maxErrors >= 1;

    let diagnosedQubit = q;
    let appliedCorrection = injectedErrorType;
    let outcomeStatus = "SUCCESS: Error diagnosed & statevector restored";

    if (!isCorrectable) {
      outcomeStatus = "UNPROTECTED: Error uncorrectable by selected code (causes logical state distortion)";
    }

    return {
      injectedQubit: q,
      injectedError: injectedErrorType,
      syndromeVector,
      diagnosedQubit,
      appliedCorrection,
      isCorrectable,
      outcomeStatus,
    };
  }, [injectedErrorQubit, injectedErrorType, selectedCode, syndromeSimKey]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                <span>Quantum Fault Tolerance</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                Mission: {mission.mission_id}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {mission.rocket} · {mission.target_orbit} ({mission.altitude} km)
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Quantum Error Correction (QEC) Simulation</span>
              <span className="text-sm font-normal text-cyan-400 font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60">
                9-Qubit QAOA Ising Circuit
              </span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              Test and analyze the impact of stochastic <strong>depolarizing noise</strong>, <strong>single-qubit</strong>, and <strong>two-qubit CNOT entangler errors</strong> on QAOA statevector fidelity. Compare raw physical NISQ decay against <strong>Surface Codes</strong>, <strong>Steane [[7,1,3]]</strong>, and <strong>Zero-Noise Extrapolation (ZNE)</strong> error mitigation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onProceedToQAOA && (
              <button
                onClick={onProceedToQAOA}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Atom className="w-3.5 h-3.5 text-cyan-400" />
                <span>View QAOA Circuit</span>
              </button>
            )}
            {onProceedToFidelity && (
              <button
                onClick={onProceedToFidelity}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Eigenstate Fidelity</span>
              </button>
            )}
            {onProceedToComparison && (
              <button
                onClick={onProceedToComparison}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-cyan-950/40"
              >
                <span>Benchmark Comparison</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hardware Calibration Presets Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 font-semibold">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>CALIBRATION PRESETS &amp; NOISE BENCHMARKS:</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Current: <strong className="text-cyan-300">{PRESETS[activePreset].name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {(Object.keys(PRESETS) as QECPreset[])
            .filter((p) => p !== "custom")
            .map((presetKey) => {
              const p = PRESETS[presetKey];
              const isSelected = activePreset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => handleSelectPreset(presetKey)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950/50"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="text-xs font-bold truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    p_2q: {(p.twoQubit * 100).toFixed(2)}% · p_depol: {(p.depolarizing * 100).toFixed(2)}%
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Top Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Physical Fidelity */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Raw Physical Fidelity
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {(physicalFidelity * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            <span>-{((1.0 - physicalFidelity) * 100).toFixed(1)}% Noise Decay</span>
          </div>
        </div>

        {/* Metric 2: QEC Logical Fidelity */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            QEC Logical Fidelity
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {(currentLogicalFidelity * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>
              {currentLogicalFidelity > physicalFidelity
                ? `+${((currentLogicalFidelity - physicalFidelity) * 100).toFixed(1)}% QEC Gain`
                : "Overhead Exceeds Gain"}
            </span>
          </div>
        </div>

        {/* Metric 3: Threshold Status */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Threshold Regime
          </div>
          <div className={`text-base font-bold font-mono ${isSubThreshold ? "text-emerald-400" : "text-rose-400"}`}>
            {isSubThreshold ? "SUB-THRESHOLD" : "SUPER-THRESHOLD"}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            p/p_th = <strong className="text-white">{thresholdRatio}×</strong> (p_th = 0.9%)
          </div>
        </div>

        {/* Metric 4: Physical Qubits */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Physical Qubits
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {totalPhysicalQubits}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            9 logical × {QEC_CODES[selectedCode].qubitsPerLogical} phys
          </div>
        </div>

        {/* Metric 5: Ground State Recovery */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Ground-State |ψ₀⟩ Recovery
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {(qecGroundStateProb * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            vs raw {(physicalGroundStateProb * 100).toFixed(1)}% noisy
          </div>
        </div>

        {/* Metric 6: Total Gates Executed */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Total QAOA Gates
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {totalGates}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {cnotCount} CNOTs + {singleQCount} 1Q
          </div>
        </div>
      </div>

      {/* Main Dual Grid: Sliders & QEC Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Noise Channel Parameter Sliders */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                1. Stochastic Noise &amp; Gate Error Rates
              </h3>
            </div>
            <button
              onClick={() => handleSelectPreset("superconducting_ft")}
              className="text-xs font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Slider 1: Depolarizing Noise Rate */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono">
                <span className="text-slate-300 flex items-center gap-1">
                  <span>Depolarizing Noise Rate (p_depol)</span>
                </span>
                <span className="text-cyan-400 font-bold">{(depolarizingRate * 100).toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.05"
                step="0.0005"
                value={depolarizingRate}
                onChange={(e) => handleSliderChange(setDepolarizingRate, parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.0% (Ideal)</span>
                <span>Threshold ~0.9%</span>
                <span>5.0% (Extreme)</span>
              </div>
            </div>

            {/* Slider 2: Two-Qubit CNOT Gate Error */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono">
                <span className="text-slate-300">2-Qubit Entangler Error (p_2q, CNOT)</span>
                <span className="text-cyan-400 font-bold">{(twoQubitRate * 100).toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.05"
                step="0.0005"
                value={twoQubitRate}
                onChange={(e) => handleSliderChange(setTwoQubitRate, parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.0%</span>
                <span>Applied to {cnotCount} CNOTs</span>
                <span>5.0%</span>
              </div>
            </div>

            {/* Slider 3: Single-Qubit Gate Error */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono">
                <span className="text-slate-300">1-Qubit Rotation Gate Error (p_1q)</span>
                <span className="text-cyan-400 font-bold">{(singleQubitRate * 100).toFixed(3)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.01"
                step="0.0001"
                value={singleQubitRate}
                onChange={(e) => handleSliderChange(setSingleQubitRate, parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.0%</span>
                <span>Applied to {singleQCount} Gates</span>
                <span>1.0%</span>
              </div>
            </div>

            {/* Slider 4: Readout Error */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono">
                <span className="text-slate-300">Measurement / Readout SPAM Error (p_meas)</span>
                <span className="text-cyan-400 font-bold">{(readoutErrorRate * 100).toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.05"
                step="0.001"
                value={readoutErrorRate}
                onChange={(e) => handleSliderChange(setReadoutErrorRate, parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.0%</span>
                <span>Applied across 9 Qubits</span>
                <span>5.0%</span>
              </div>
            </div>

            {/* Slider 5: QAOA Layer Depth (p) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between font-mono">
                <span className="text-slate-300 font-bold">QAOA Circuit Depth Layers (p)</span>
                <span className="text-amber-400 font-bold text-sm">p = {layersP}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={layersP}
                onChange={(e) => handleSliderChange(setLayersP, parseInt(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>p = 1 (36 CNOTs)</span>
                <span>p = 3 (108 CNOTs)</span>
                <span>p = 5 (180 CNOTs)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: QEC Code Selection & Architecture Comparison */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                2. QEC Architecture &amp; Error Mitigation Code
              </h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold">
              {QEC_CODES[selectedCode].shortName}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {(Object.keys(QEC_CODES) as QECCodeType[]).map((codeKey) => {
              const code = QEC_CODES[codeKey];
              const isSelected = selectedCode === codeKey;
              return (
                <button
                  key={codeKey}
                  type="button"
                  onClick={() => setSelectedCode(codeKey)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-950/90 border-cyan-500 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/50"
                      : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-xs truncate">{code.shortName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border uppercase font-mono ${
                      code.distance >= 3
                        ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}>
                      d = {code.distance}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    {code.qubitsPerLogical} Phys/Logical ({N_LOGICAL * code.qubitsPerLogical} Total)
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Code Specifications Box */}
          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <span className="text-white font-bold">{QEC_CODES[selectedCode].name}</span>
              <span className="text-[11px] text-cyan-400">Class: {QEC_CODES[selectedCode].type}</span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
              {QEC_CODES[selectedCode].description}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] text-slate-400 border-t border-slate-800/60">
              <div>Code Distance: <strong className="text-white">{QEC_CODES[selectedCode].distance}</strong></div>
              <div>Corrects: <strong className="text-cyan-300">{QEC_CODES[selectedCode].correctableErrors} Error(s)</strong></div>
              <div>Overhead: <strong className="text-amber-400">{QEC_CODES[selectedCode].qubitsPerLogical}×</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart 1: Depolarizing Noise Sweep ($0 \to 2.5\%$) */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              3. Depolarizing Noise Sweep vs Circuit Fidelity (0.0% → 2.5%)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              <span>Current Noise Operating Point: {(depolarizingRate * 100).toFixed(2)}%</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-300 font-sans">
          This curve illustrates the <strong>fault-tolerant threshold theorem</strong>. At noise rates <em>below</em> the threshold (p &lt; p_th ≈ 0.9%), Surface Code d=5 and d=3 deliver dramatic exponential suppression of logical errors. At noise rates <em>above</em> the threshold, the overhead of extra physical qubits causes logical fidelity to decay faster than unprotected NISQ.
        </p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sweepData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval={2}
                label={{ value: "Physical Depolarizing Error Rate (p)", position: "insideBottom", offset: -10, fill: "#64748b", fontSize: 11 }}
              />
              <YAxis
                stroke="#64748b"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                label={{ value: "Fidelity (%)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#090d16",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
              />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }} />
              {/* Threshold line */}
              <ReferenceLine
                x="0.9%"
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{ value: "Threshold p_th ~ 0.9%", fill: "#f43f5e", fontSize: 10, position: "top" }}
              />
              {/* Current operating noise marker */}
              <ReferenceLine
                x={`${(depolarizingRate * 100).toFixed(2)}%`}
                stroke="#38bdf8"
                strokeWidth={2}
                label={{ value: "Operating Point", fill: "#38bdf8", fontSize: 10, position: "insideTopLeft" }}
              />
              <Line
                type="monotone"
                dataKey="rawPhysical"
                name="Raw Physical NISQ"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="surfaceD3"
                name="Surface Code d=3"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="surfaceD5"
                name="Surface Code d=5"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="steane7"
                name="Steane [[7,1,3]]"
                stroke="#a855f7"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="zne"
                name="ZNE Mitigated"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: QAOA Circuit Depth Scaling (p = 1 to 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                4. QAOA Layer Depth Scaling vs Circuit Fidelity
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Layers p = 1 .. 5</span>
          </div>

          <p className="text-xs text-slate-300 font-sans">
            As QAOA depth $p$ increases to sharpen combinatorial convergence, gate count scales linearly ($36p$ CNOTs). In unmitigated hardware, deeper circuits undergo rapid decoherence collapse.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depthScalingData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="depth" stroke="#64748b" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }} />
                <Bar dataKey="physical" name="Raw Physical" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="qecProtected" name={`QEC (${QEC_CODES[selectedCode].shortName})`} fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 5: Live Interactive Stabilizer & Syndrome Simulator */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Binary className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                5. Live Syndrome Extraction &amp; Error Decoding
              </h3>
            </div>
            <button
              onClick={() => setSyndromeSimKey((k) => k + 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Cycle Syringe</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 font-sans">
            Inject a Pauli error on a test physical qubit and observe the non-destructive stabilizer measurements $S_i$ diagnose the error syndrome vector without collapsing the logical superposition.
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Target Physical Qubit:</label>
              <select
                value={injectedErrorQubit}
                onChange={(e) => setInjectedErrorQubit(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
                  <option key={idx} value={idx}>
                    Qubit q_{idx} ({idx === 2 ? "Default Test" : `Physical #${idx}`})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Injected Pauli Channel:</label>
              <div className="grid grid-cols-3 gap-1">
                {(["X", "Z", "Y"] as Array<"X" | "Z" | "Y">).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setInjectedErrorType(op)}
                    className={`py-1.5 rounded border text-center font-bold font-mono transition-colors cursor-pointer ${
                      injectedErrorType === op
                        ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {op} {op === "X" ? "(Bit)" : op === "Z" ? "(Phase)" : "(Depol)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Syndrome Calculation Panel */}
          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Injected Fault:</span>{" "}
                <strong className="text-rose-400">σ_{syndromeResult.injectedError} on q_{syndromeResult.injectedQubit}</strong>
              </div>
              <div>
                <span className="text-slate-500">Stabilizer Syndrome:</span>{" "}
                <strong className="text-cyan-300">{syndromeResult.syndromeVector}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
              <div>
                <span className="text-slate-500">Decoder Diagnosis:</span>{" "}
                <strong className="text-white">Pinpointed q_{syndromeResult.diagnosedQubit}</strong>
              </div>
              <div>
                <span className="text-slate-500">Applied Correction:</span>{" "}
                <strong className="text-emerald-400">R = σ_{syndromeResult.appliedCorrection}^†</strong>
              </div>
            </div>

            <div className={`p-2 rounded mt-1 text-[11px] font-sans flex items-center gap-1.5 border ${
              syndromeResult.isCorrectable
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                : "bg-rose-950/60 text-rose-300 border-rose-800/80"
            }`}>
              {syndromeResult.isCorrectable ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{syndromeResult.outcomeStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Educational & Academic Reference Panel */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-sans">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 font-bold border-b border-slate-800 pb-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>MATHEMATICAL &amp; ARCHITECTURAL PRINCIPLES OF QUANTUM ERROR CORRECTION</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1 font-sans">
            <h4 className="font-bold text-white font-mono flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Depolarizing Noise Channel</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              Models isotropic Pauli decoherence: E(ρ) = (1 - p)ρ + (p/3)(XρX + YρY + ZρZ). Every gate induces a stochastic mixture of bit-flip (X), phase-flip (Z), or combined (Y) Pauli operators.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1 font-sans">
            <h4 className="font-bold text-white font-mono flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span>Threshold Theorem (p_th)</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              Logical error rate scales as p_L ≈ C · (p_phys / p_th)^((d+1)/2). When p_phys &lt; p_th, increasing code distance d yields exponential error reduction; above threshold, extra syndrome ancillae accelerate decay.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1 font-sans">
            <h4 className="font-bold text-white font-mono flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Noise Extrapolation (ZNE)</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              A NISQ error mitigation strategy that systematically scales noise factors (e.g. c = 1, 2, 3 via pulse stretching or unitary gate insertion) and performs Richardson polynomial extrapolation to infer the zero-noise limit without ancilla overhead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
