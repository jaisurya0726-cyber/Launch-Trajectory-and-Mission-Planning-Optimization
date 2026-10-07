import React, { useState } from "react";
import { Mission } from "../types";
import {
  Download,
  Play,
  Rocket,
  History,
  BookOpen,
  Sun,
  Moon,
  Sliders,
  Activity,
  Cpu,
  Grid,
  Atom,
  GitCompare,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface TopBarProps {
  activeTab: number;
  setActiveTab: (tab: number) => void;
  activeMission: Mission;
  onRunAll: () => void;
  onExportAll: () => void;
  isSimulating: boolean;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenLogbook?: () => void;
  notesCount?: number;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const NAV_ITEMS = [
  "1. Selection",
  "2. Parameters",
  "3. Trajectory",
  "4. Classical",
  "5. QUBO",
  "6. QAOA",
  "7. Comparison",
  "8. Plan & Export",
  "9. Analytics",
  "10. Sensitivity",
  "11. Quantum Fidelity",
  "12. Mission Input",
];

export const NAV_CONFIG = [
  { id: 0, step: "01", label: "Mission Selection", shortLabel: "Selection", icon: Rocket, description: "Payload & target orbit" },
  { id: 1, step: "02", label: "Parameters", shortLabel: "Parameters", icon: Sliders, description: "Propulsion & staging" },
  { id: 2, step: "03", label: "Ascent Trajectory", shortLabel: "Trajectory", icon: Activity, description: "Runge-Kutta simulation" },
  { id: 3, step: "04", label: "Classical Optimizer", shortLabel: "Classical", icon: Cpu, description: "Simulated annealing" },
  { id: 4, step: "05", label: "QUBO Formulation", shortLabel: "QUBO", icon: Grid, description: "Ising Hamiltonian mapping" },
  { id: 5, step: "06", label: "QAOA Circuit", shortLabel: "QAOA", icon: Atom, description: "Quantum statevector" },
  { id: 6, step: "07", label: "Benchmark", shortLabel: "Comparison", icon: GitCompare, description: "Classical vs Quantum" },
  { id: 7, step: "08", label: "Mission Plan", shortLabel: "Plan & Export", icon: CheckCircle2, description: "Flight burn profile & CSV" },
  { id: 8, step: "09", label: "Analytics Dashboard", shortLabel: "Analytics", icon: BarChart3, description: "Historical telemetry" },
  { id: 9, step: "10", label: "Sensitivity Analysis", shortLabel: "Sensitivity", icon: TrendingUp, description: "D3 dispersion scatter" },
  { id: 10, step: "11", label: "Quantum Fidelity", shortLabel: "Fidelity", icon: ShieldCheck, description: "Eigenstate confidence" },
  { id: 11, step: "12", label: "Mission Input", shortLabel: "Input", icon: Sparkles, description: "Custom parameters & optimize" },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  activeMission,
  onRunAll,
  onExportAll,
  isSimulating,
  historyCount,
  onOpenHistory,
  onOpenLogbook,
  notesCount,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(true);
  const [isStagesListExpanded, setIsStagesListExpanded] = useState(true);

  const sidebarOpen = isSidebarOpen !== undefined ? isSidebarOpen : internalSidebarOpen;
  const handleToggleSidebar = onToggleSidebar || (() => setInternalSidebarOpen((prev) => !prev));

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          onClick={handleToggleSidebar}
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
        />
      )}

      {/* Top Header - Opaque bg so position:fixed on nav correctly anchors to the viewport */}
      <header className={`border-b border-slate-800 bg-[#07090e] sticky top-0 z-30 ${sidebarOpen ? "md:pl-64" : "md:pl-0"} transition-all duration-200`}>
        {/* Precision Telemetry Ribbon */}
        <div className="px-6 py-1.5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums overflow-x-auto">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-slate-200 font-semibold">{activeMission.mission_id}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300">{activeMission.satellite_name}</span>
            <span className="text-slate-600">/</span>
            <span>{activeMission.rocket}</span>
            <span className="text-slate-600">/</span>
            <span>{activeMission.target_orbit} ({activeMission.altitude} km)</span>
            <span className="text-slate-600">/</span>
            <span className={activeMission.safety_status.includes("HIGH") ? "text-rose-400 font-medium" : "text-emerald-400 font-medium"}>
              {activeMission.safety_status}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-500 whitespace-nowrap">
            <span>TWR: {activeMission.thrust_to_weight_ratio.toFixed(2)}</span>
            <span>Δv: {activeMission.delta_v} km/s</span>
            <span>Qubits: 9 (2⁹ Hilbert Space)</span>
          </div>
        </div>

        {/* Main Top Bar: 3-Zone Contract */}
        <div className="px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Zone 1: Workflow Phase Toggle Button + Current Workflow Stage indicator */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleToggleSidebar}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all cursor-pointer group shadow-sm ${
                sidebarOpen
                  ? "bg-cyan-950/70 hover:bg-cyan-900/80 border-cyan-500/50 text-cyan-200 shadow-cyan-950/40"
                  : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300"
              }`}
              title={sidebarOpen ? "Click to close Workflow Phase sidebar" : "Click to open Workflow Phase sidebar"}
              aria-label={sidebarOpen ? "Close Workflow Phase navigation panel" : "Open Workflow Phase navigation panel"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              )}
              <span className="font-semibold text-xs whitespace-nowrap">Workflow Phase</span>
              <div className="flex items-center rounded bg-slate-950/90 p-0.5 border border-slate-800 text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                    sidebarOpen
                      ? "bg-cyan-500 text-slate-950 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  OPEN
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                    !sidebarOpen
                      ? "bg-slate-700 text-slate-200 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  CLOSE
                </span>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 font-semibold whitespace-nowrap">
                STAGE {activeTab + 1}/{NAV_CONFIG.length}
              </span>
              <span className="text-sm font-bold text-white tracking-tight truncate max-w-[130px] sm:max-w-none">
                {NAV_CONFIG[activeTab]?.label || NAV_ITEMS[activeTab]}
              </span>
            </div>
          </div>

          {/* Zone 2: FULLY VISIBLE VERTICAL SIDEBAR */}
          <nav
            className={`fixed left-0 top-0 bottom-0 w-64 bg-[#07090e] border-r border-slate-800 z-50 flex flex-col justify-between p-3 shadow-2xl transition-transform duration-200 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Top Brand & Progress */}
            <div className="space-y-3 shrink-0 pb-2 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-cyan-950/80 border border-cyan-800/60 rounded-lg text-cyan-400">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-tight leading-tight">
                      AeroQuantum
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono leading-tight">
                      Mission Optimizer
                    </div>
                  </div>
                </div>

                {/* Close Button on sidebar */}
                <button
                  onClick={handleToggleSidebar}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 border border-transparent hover:border-slate-700/60 transition-colors cursor-pointer flex items-center gap-1 font-mono text-[10px]"
                  title="Close Workflow Phase sidebar"
                  aria-label="Close Workflow Phase sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>

              {/* Progress Bar with toggle for stage list */}
              <div className="space-y-1 font-mono">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-slate-500 uppercase font-semibold">Workflow Phase</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">{Math.round(((activeTab + 1) / NAV_CONFIG.length) * 100)}%</span>
                    <button
                      onClick={() => setIsStagesListExpanded((prev) => !prev)}
                      className="text-[9px] text-slate-400 hover:text-cyan-300 flex items-center cursor-pointer ml-0.5"
                      title={isStagesListExpanded ? "Collapse workflow stages list" : "Expand workflow stages list"}
                    >
                      {isStagesListExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${((activeTab + 1) / NAV_CONFIG.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Scrollable Navigation Button Stack */}
            {isStagesListExpanded ? (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 py-2 pr-0.5">
                <div className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-semibold px-2 pb-0.5">
                  Pipeline Stages (1–{NAV_CONFIG.length})
                </div>

                {NAV_CONFIG.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                      }}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer group ${
                        isActive
                          ? "bg-cyan-500/20 text-white border border-cyan-500/50 shadow-xs shadow-cyan-500/10 font-bold"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent"
                      }`}
                    >
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold shrink-0 transition-colors ${
                          isActive
                            ? "bg-cyan-500 text-slate-950 font-bold"
                            : "bg-slate-900 border border-slate-800 text-slate-500 group-hover:text-slate-300"
                        }`}
                      >
                        {item.step}
                      </span>

                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                          isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />

                      <span className="truncate text-[11px] flex-1 leading-tight">
                        {item.label}
                      </span>

                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-slate-500 text-xs font-mono space-y-2">
                <span>Stages list collapsed</span>
                <button
                  onClick={() => setIsStagesListExpanded(true)}
                  className="px-2.5 py-1 text-[10px] rounded bg-slate-900 border border-slate-800 text-cyan-400 hover:bg-slate-800 cursor-pointer"
                >
                  Expand Stages
                </button>
              </div>
            )}

            {/* Sidebar Bottom: Compact Active Vehicle Telemetry Card */}
            <div className="pt-2 border-t border-slate-800/90 shrink-0 space-y-1.5">
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-[11px] truncate max-w-[130px]">{activeMission.rocket}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                      activeMission.safety_status.includes("HIGH")
                        ? "bg-rose-950 text-rose-300 border border-rose-800"
                        : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    }`}
                  >
                    {activeMission.safety_status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>{activeMission.target_orbit}</span>
                  <span className="text-cyan-400">{activeMission.altitude} km</span>
                </div>
              </div>
            </div>
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(11)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 11
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                  : "text-cyan-300 hover:text-white bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-800/80"
              }`}
              title="Open Custom Mission Input & Optimization Engine"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mission Input</span>
            </button>
            {onOpenLogbook && (
              <button
                onClick={onOpenLogbook}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                title="Open Mission Logbook"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Logbook</span>
                {typeof notesCount === "number" && notesCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-cyan-950 text-[10px] text-cyan-300 border border-cyan-800/60 rounded font-mono">
                    {notesCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Open Mission History"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>History</span>
              <span className="px-1.5 py-0.2 bg-slate-800 text-[10px] text-cyan-300 rounded font-mono">
                {historyCount}
              </span>
            </button>
            <button
              onClick={onRunAll}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors shadow-sm shadow-cyan-500/25 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSimulating ? "Optimizing..." : "Run Optimization"}</span>
            </button>
            <button
              onClick={onExportAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
              aria-label="Toggle dark/light theme"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
