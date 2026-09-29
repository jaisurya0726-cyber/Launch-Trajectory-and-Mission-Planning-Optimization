import React, { useState, useEffect, useMemo } from "react";
import { HistoryEntry } from "../types";
import {
  BookOpen,
  X,
  Save,
  Check,
  Tag,
  Download,
  Calendar,
  Rocket,
  Atom,
  Clock,
  Search,
} from "lucide-react";

interface MissionLogbookSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSaveNote: (id: string, note: string, tags: string[]) => void;
  onSelectMission?: (entry: HistoryEntry) => void;
}

const DEFAULT_TAGS = [
  "Propulsion Margin",
  "Aerodynamic Max-Q",
  "QUBO Ising Matrix",
  "QAOA Convergence",
  "Launch Window",
  "Weather Hold",
  "Flight Safety",
];

export const MissionLogbookSidebar: React.FC<MissionLogbookSidebarProps> = ({
  isOpen,
  onClose,
  history,
  onSaveNote,
  onSelectMission,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string>(history[0]?.id || "");
  const [currentText, setCurrentText] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Update selected entry if history changes
  useEffect(() => {
    if (history.length > 0 && (!selectedEntryId || !history.some((h) => h.id === selectedEntryId))) {
      setSelectedEntryId(history[0].id);
    }
  }, [history, selectedEntryId]);

  // Active entry
  const activeEntry = useMemo(() => {
    return history.find((h) => h.id === selectedEntryId) || history[0];
  }, [history, selectedEntryId]);

  // Sync textarea state when active entry changes
  useEffect(() => {
    if (activeEntry) {
      setCurrentText(activeEntry.notes || "");
      setSelectedTags(activeEntry.tags || []);
      setSaveSuccess(false);
    }
  }, [activeEntry]);

  // Handle Tag toggle
  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Save current note
  const handleSave = () => {
    if (!activeEntry) return;
    onSaveNote(activeEntry.id, currentText, selectedTags);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Export all notes as text report
  const handleExportNotes = () => {
    if (history.length === 0) return;

    let content = "=== AEROQUANTUM MISSION ENGINEERING LOGBOOK ===\n";
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Total Iterations: ${history.length}\n\n`;

    history.forEach((h, idx) => {
      content += `--------------------------------------------------\n`;
      content += `[${idx + 1}] MISSION ${h.mission_id} - ${h.satellite_name}\n`;
      content += `Timestamp: ${h.timestamp}\n`;
      content += `Rocket: ${h.rocket} | Orbit: ${h.target_orbit} (${h.altitude} km)\n`;
      content += `Config: ${h.selected_window} | ${h.selected_trajectory} | ${h.selected_mode}\n`;
      content += `Cost: $${h.launch_cost_musd}M | Fuel Saved: ${h.fuel_saved_kg} kg | Risk: ${h.risk_score}/100\n`;
      content += `Best Bitstring: |ψ⟩ = |${h.best_bitstring}⟩\n`;
      content += `Tags: ${(h.tags || []).join(", ") || "None"}\n`;
      content += `Notes (Last Updated: ${h.notes_updated_at || "Never"}):\n`;
      content += `${h.notes || "No notes recorded."}\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aeroquantum_engineering_logbook_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered entries for search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter(
      (h) =>
        h.mission_id.toLowerCase().includes(q) ||
        h.satellite_name.toLowerCase().includes(q) ||
        (h.notes || "").toLowerCase().includes(q) ||
        (h.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [history, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full sm:w-[480px] h-full bg-[#080b13] border-l border-slate-800 flex flex-col shadow-2xl text-slate-200 animate-in slide-in-from-right duration-300"
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Mission Logbook</div>
              <div className="text-xs text-slate-400 font-mono">
                Engineering Field Notes · {history.length} Saved Runs
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleExportNotes}
                title="Export Logbook as Text"
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="text-sm font-medium text-slate-300">No Mission History Available</div>
            <p className="text-xs text-slate-500 max-w-xs font-sans">
              Run an optimization to archive iterations and attach engineering notes, anomaly reports, and clearance tags.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Search / Filter Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search notes, mission ID, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-700"
              />
            </div>

            {/* Mission Selection Pill Strip */}
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase font-mono text-slate-400">Select Mission Iteration</div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {filteredHistory.map((item, idx) => {
                  const isSelected = item.id === (activeEntry?.id || "");
                  const hasNote = Boolean(item.notes && item.notes.trim().length > 0);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedEntryId(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm shadow-cyan-500/20"
                          : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      <span>#{idx + 1}</span>
                      <span>{item.mission_id}</span>
                      {hasNote && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Mission Metadata Ribbon */}
            {activeEntry && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-bold text-white font-sans">
                      {activeEntry.satellite_name} ({activeEntry.mission_id})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">{activeEntry.timestamp}</span>
                </div>

                <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-1.5">
                  <span>{activeEntry.rocket}</span>
                  <span>·</span>
                  <span>{activeEntry.target_orbit} ({activeEntry.altitude} km)</span>
                  <span>·</span>
                  <span className="text-emerald-400">-{activeEntry.fuel_saved_kg} kg fuel</span>
                  <span>·</span>
                  <span className="text-slate-300">${activeEntry.launch_cost_musd}M</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 bg-slate-900/60 px-2 py-1 rounded">
                  <Atom className="w-3 h-3 text-amber-400" />
                  <span>Bitstring: |ψ⟩ = |{activeEntry.best_bitstring}⟩</span>
                  <span className="text-slate-600">·</span>
                  <span>{activeEntry.selected_trajectory}</span>
                </div>
              </div>
            )}

            {/* Tag Selection */}
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase font-mono text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-cyan-400" />
                <span>Engineering Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TAGS.map((tag) => {
                  const isChecked = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2.5 py-1 text-[11px] font-mono rounded-md border transition-colors cursor-pointer ${
                        isChecked
                          ? "bg-cyan-950 text-cyan-300 border-cyan-700/80"
                          : "bg-slate-950 text-slate-400 border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      {isChecked ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Textarea for Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="uppercase text-slate-400">Custom Engineering Notes</span>
                {activeEntry?.notes_updated_at && (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Updated {activeEntry.notes_updated_at}
                  </span>
                )}
              </div>
              <textarea
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                rows={7}
                placeholder="Enter technical observations, Isp corrections, staging timings, structural safety margin notes, or QAOA simulation findings..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 leading-relaxed resize-y"
              />
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs font-mono text-slate-500">
                {saveSuccess ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Note saved to browser storage!
                  </span>
                ) : (
                  <span>Auto-persisted in local research storage</span>
                )}
              </div>

              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
