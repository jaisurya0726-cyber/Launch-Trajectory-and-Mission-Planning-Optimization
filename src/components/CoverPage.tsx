import React, { useState } from "react";
import {
  Rocket,
  ArrowRight,
  Atom,
  Activity,
  Layers,
  Flame,
  ShieldCheck,
  Cpu,
  Sparkles,
  Sun,
  Moon,
  ChevronRight,
  Database,
  BarChart3,
  Globe,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface CoverPageProps {
  onGetStarted: (initialTab?: number) => void;
  onOpenGeminiChat?: () => void;
}

export const CoverPage: React.FC<CoverPageProps> = ({ onGetStarted, onOpenGeminiChat }) => {
  const { isDark, toggleTheme } = useTheme();
  const [isExiting, setIsExiting] = useState(false);

  const handleLaunch = (tabIndex: number = 0) => {
    setIsExiting(true);
    // Smooth transition delay before switching views
    setTimeout(() => {
      onGetStarted(tabIndex);
    }, 320);
  };

  return (
    <div
      className={`min-h-screen w-full relative overflow-x-hidden flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950 transition-all duration-300 ${
        isExiting ? "opacity-0 scale-[0.98] pointer-events-none" : "opacity-100 scale-100"
      } ${
        isDark
          ? "bg-[#07090e] text-slate-200"
          : "bg-[#f8fafc] text-slate-800"
      }`}
    >
      {/* Background Decorative Ambient Radial Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 bg-cyan-600/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-10 -left-48 w-96 h-96 bg-blue-600/5 blur-3xl pointer-events-none rounded-full" />

      {/* Subtle Coordinate Grid Lines Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* =========================================================================
          TOP NAVIGATION BAR
          ========================================================================= */}
      <header className="relative z-20 w-full border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-6 lg:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-400 shadow-sm shadow-cyan-500/20">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>AeroQuantum</span>
              <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800/60 uppercase">
                v2.4
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Mission Optimizer &amp; Quantum Computing Engine
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenGeminiChat && (
            <button
              onClick={onOpenGeminiChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-cyan-950/90 to-indigo-950/90 hover:from-cyan-900 hover:to-indigo-900 border border-cyan-500/50 text-cyan-200 hover:text-white transition-all cursor-pointer shadow-xs"
              title="Open Gemini Chatbot"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Chat with Gemini</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
      </header>

      {/* =========================================================================
          MAIN HERO CONTENT
          ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-12 lg:py-16 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Mission Description & CTA */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Kicker Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-xs font-mono text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>AEROSPACE DYNAMICS &amp; QUANTUM COMPUTING PLATFORM</span>
            </div>

            {/* Main Title */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.12]">
                Launch Trajectory &amp;{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
                  Mission Quantum Optimization
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl pt-2 font-sans">
                A dual classical and quantum optimization platform for spaceflight engineering. Simulate 4th-order Runge-Kutta rocket ascent trajectories, formulate 9-qubit combinatorial QUBO Ising Hamiltonians, execute QAOA statevector quantum circuits, and model hypersonic atmospheric re-entry aerothermal dynamics.
              </p>
            </div>

            {/* Quick Feature Badges (Unboxed Clean Metadata) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-slate-400 pt-1">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>RK4 Numerical Flight Dynamics</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Atom className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>9-Qubit QAOA Simulation</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                <span>Sutton-Graves Re-entry</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button
                onClick={() => handleLaunch(0)}
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl font-mono text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-teal-300 hover:from-cyan-300 hover:to-teal-200 transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 cursor-pointer active:scale-95"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Direct Workflow Phase Jump Options */}
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
                Quick Jump to Workflow Stage:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleLaunch(0)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Stage 01: Catalog (500 Missions)
                </button>
                <button
                  onClick={() => handleLaunch(2)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Stage 03: 3D Trajectory
                </button>
                <button
                  onClick={() => handleLaunch(5)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Stage 06: QAOA Quantum
                </button>
                <button
                  onClick={() => handleLaunch(13)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Stage 14: Atmospheric Re-entry
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Aerospace & Quantum Orbital Illustration */}
          <div className="lg:col-span-5 flex items-center justify-center relative">
            <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center">
              
              {/* Outer Decorative Glow Rings */}
              <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-[spin_60s_linear_infinite]" />
              <div className="absolute inset-8 rounded-full border border-dashed border-indigo-500/25 animate-[spin_40s_linear_infinite_reverse]" />
              <div className="absolute inset-16 rounded-full border border-cyan-500/30" />

              {/* Quantum Bloch / Superposition Constellation Nodes */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-800/80 text-[10px] font-mono text-cyan-300 shadow-lg">
                <Atom className="w-3 h-3 text-cyan-400 animate-spin" />
                <span>|ψ(γ, β)⟩ · 2⁹ = 512 States</span>
              </div>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-indigo-800/80 text-[10px] font-mono text-indigo-300 shadow-lg">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span>RK4 Flight Path · 4th-Order Precision</span>
              </div>

              {/* Left Orbit Waypoint */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[9px] font-mono text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>LEO 500 km</span>
              </div>

              {/* Right Orbit Waypoint */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[9px] font-mono text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span>Max-Q: 32 kPa</span>
              </div>

              {/* Central Planet Sphere with Atmosphere Halo */}
              <div className="relative w-44 h-44 rounded-full bg-gradient-to-tr from-slate-950 via-slate-900 to-cyan-950 border-2 border-cyan-500/40 shadow-2xl shadow-cyan-500/20 flex flex-col items-center justify-center overflow-hidden">
                {/* Atmospheric Glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 via-transparent to-cyan-400/20 rounded-full" />
                
                {/* Latitude and Longitude Grids */}
                <div className="absolute inset-0 rounded-full border border-cyan-500/15" />
                <div className="absolute w-full h-[1px] bg-cyan-500/20 top-1/2 -translate-y-1/2" />
                <div className="absolute h-full w-[1px] bg-cyan-500/20 left-1/2 -translate-x-1/2" />
                <div className="absolute inset-3 rounded-full border border-dashed border-cyan-400/20" />

                {/* Central Rocket Icon */}
                <div className="relative z-10 p-3 rounded-2xl bg-cyan-950/90 border border-cyan-500/60 text-cyan-300 shadow-md shadow-cyan-500/40">
                  <Rocket className="w-8 h-8 text-cyan-400" />
                </div>
                <div className="relative z-10 text-[10px] font-mono font-bold text-cyan-200 mt-1">
                  AeroQuantum
                </div>
              </div>

              {/* Orbiting Satellite Node 1 */}
              <div className="absolute top-12 right-12 w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-md shadow-cyan-400 animate-pulse" />
              {/* Orbiting Satellite Node 2 */}
              <div className="absolute bottom-16 left-12 w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-md shadow-indigo-400" />
            </div>
          </div>
        </div>

        {/* =========================================================================
            CORE ARCHITECTURE CAPABILITIES (4 PILLARS)
            ========================================================================= */}
        <div className="pt-16 lg:pt-20 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                Platform Capabilities
              </h2>
              <div className="text-lg font-bold text-white tracking-tight mt-0.5">
                Complete End-to-End Mission Engineering
              </div>
            </div>
            <span className="text-xs font-mono text-cyan-400">14 Workflow Stages</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            {/* Card 1 */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-2 text-cyan-400">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-mono font-bold uppercase text-white">
                  01. Ascent Trajectory
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                4th-order Runge-Kutta numerical integration with gravity turn, atmospheric drag, Max-Q aerodynamic limits, and live 3D Earth orbit visualization.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-2 text-purple-400">
                <Cpu className="w-4 h-4" />
                <span className="text-xs font-mono font-bold uppercase text-white">
                  02. Classical Optimization
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Simulated annealing and combinatorial pruning balancing fuel consumption, launch cost, safety thresholds, and payload capacity margins.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <Atom className="w-4 h-4" />
                <span className="text-xs font-mono font-bold uppercase text-white">
                  03. QAOA Quantum Circuit
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                9-qubit QUBO Ising Hamiltonian formulation solved via statevector evolution, evaluating quantum ground state convergence and fidelity.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-2 text-orange-400">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-mono font-bold uppercase text-white">
                  04. Atmospheric Re-entry
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Hypersonic Sutton-Graves stagnation heat flux, TPS ablation recession (PICA-X, Carbon-Phenolic), and deceleration G-load profiles.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          QUIET ACADEMIC FOOTER
          ========================================================================= */}
      <footer className="relative z-20 w-full border-t border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-6 lg:px-12 py-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-500">
        <div>
          <span>AeroQuantum · Launch Trajectory &amp; Mission Quantum Optimization</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>RK4 Flight Dynamics</span>
          <span>·</span>
          <span>QUBO &amp; QAOA (2⁹ States)</span>
          <span>·</span>
          <span>500 Mission Catalog</span>
        </div>
      </footer>
    </div>
  );
};
