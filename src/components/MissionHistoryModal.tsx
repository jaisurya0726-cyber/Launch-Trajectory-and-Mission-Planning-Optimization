import React from "react";
import { HistoryEntry } from "../types";
import { X, History, Trash2, ArrowUpRight, Cpu, Atom, Clock, BarChart3, BookOpen } from "lucide-react";

interface MissionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  onRemoveEntry: (id: string) => void;
  onClearHistory: () => void;
  onNavigateToAnalytics?: () => void;
  onOpenLogbook?: () => void;
}

export const MissionHistoryModal: React.FC<MissionHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectEntry,
  onRemoveEntry,
  onClearHistory,
  onNavigateToAnalytics,
  onOpenLogbook,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0b0e17] border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Mission Optimization History</div>
              <div className="text-xs text-slate-400 font-mono">
                Persisted research iterations (Last {history.length} of 5 saved in LocalStorage)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onOpenLogbook && (
              <button
                onClick={() => {
                  onClose();
                  onOpenLogbook();
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Logbook</span>
              </button>
            )}
            {onNavigateToAnalytics && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToAnalytics();
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>View Analytics</span>
              </button>
            )}
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Clock className="w-6 h-6" />
              </div>
              <div className="text-sm font-medium text-slate-300">No Optimization Iterations Saved Yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
                Run an optimization on any mission to automatically record and track research iterations here.
              </p>
            </div>
          ) : (
            history.map((entry, index) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-900/60 transition-all space-y-3 group"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-cyan-400">
                        #{index + 1} · {entry.mission_id}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-sm font-semibold text-white font-sans">
                        {entry.satellite_name}
                      </span>
                    </div>
                    {/* Unboxed Metadata with · separator */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{entry.rocket}</span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.target_orbit} ({entry.altitude} km)</span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.payload_mass.toLocaleString()} kg payload</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono tabular-nums">{entry.timestamp}</span>
                    <button
                      onClick={() => onRemoveEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity cursor-pointer"
                      title="Remove entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Optimal Decision Variables */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 grid grid-cols-3 gap-2 text-xs font-mono text-slate-300">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Window</span>
                    <span className="text-cyan-300 truncate block">{entry.selected_window}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Trajectory</span>
                    <span className="text-cyan-300 truncate block">{entry.selected_trajectory}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Mode</span>
                    <span className="text-cyan-300 truncate block">{entry.selected_mode}</span>
                  </div>
                </div>

                {/* Metrics Breakdown & Restore Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60 text-xs font-mono tabular-nums">
                  <div className="flex items-center gap-4 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-cyan-400" />
                      Classical Obj: <strong className="text-slate-200">{entry.classical_objective.toFixed(4)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Atom className="w-3 h-3 text-amber-400" />
                      Quantum Obj: <strong className="text-slate-200">{entry.quantum_objective.toFixed(4)}</strong>
                    </span>
                    <span>Cost: ${entry.launch_cost_musd.toFixed(2)}M</span>
                    <span>Risk: {entry.risk_score.toFixed(1)}/100</span>
                  </div>

                  <button
                    onClick={() => onSelectEntry(entry)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer whitespace-nowrap ml-auto"
                  >
                    <span>Restore Iteration</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
