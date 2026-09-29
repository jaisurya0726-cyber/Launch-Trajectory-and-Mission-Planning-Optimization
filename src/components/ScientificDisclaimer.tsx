import React from "react";
import { AlertCircle, FileText } from "lucide-react";

export const ScientificDisclaimer: React.FC = () => {
  return (
    <div className="border border-cyan-900/40 bg-cyan-950/20 rounded-xl p-4 flex items-start gap-3.5 text-xs text-slate-300">
      <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <div className="font-semibold text-cyan-300">Academic Simulation &amp; Quantum Benchmark Disclaimer</div>
        <p className="leading-relaxed text-slate-400">
          This project is an academic simulation using simplified aerospace models and synthetic/educational data.
          It is intended for research and demonstration of optimization techniques and is not a flight-certified launch guidance,
          navigation, or mission-control system. No artificial quantum advantage is claimed; performance benchmarks reflect
          empirical NISQ-era quantum simulation versus classical combinatorial baselines.
        </p>
      </div>
    </div>
  );
};
