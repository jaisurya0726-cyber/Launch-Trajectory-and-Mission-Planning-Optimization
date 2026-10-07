/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import rawMissions from "./data/missions.json";
import { Mission, HistoryEntry } from "./types";
import { TopBar } from "./components/TopBar";
import { ScientificDisclaimer } from "./components/ScientificDisclaimer";
import { MissionSelector } from "./components/MissionSelector";
import { MissionParameters } from "./components/MissionParameters";
import { TrajectorySimulationView } from "./components/TrajectorySimulationView";
import { ClassicalOptimizationView } from "./components/ClassicalOptimizationView";
import { QUBOView } from "./components/QUBOView";
import { QAOAView } from "./components/QAOAView";
import { ComparisonView } from "./components/ComparisonView";
import { FinalPlanView } from "./components/FinalPlanView";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { SensitivityAnalysisView } from "./components/SensitivityAnalysisView";
import { QuantumFidelityView } from "./components/QuantumFidelityView";
import { MissionInputView } from "./components/MissionInputView";
import { MissionHistoryModal } from "./components/MissionHistoryModal";
import { MissionLogbookSidebar } from "./components/MissionLogbookSidebar";
import { runClassicalOptimization, runQAOASimulation } from "./lib/optimization";
import {
  getMissionHistory,
  saveMissionToHistory,
  removeHistoryEntry,
  clearMissionHistory,
  updateHistoryEntryNotes,
} from "./lib/history";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

function MainApp() {
  const { isDark } = useTheme();

  const missions: Mission[] = useMemo(() => {
    return (rawMissions as any[]).map((r) => ({
      mission_id: String(r.mission_id),
      satellite_name: String(r.satellite_name),
      data_type: r.data_type as "Reference" | "Synthetic",
      launch_date: String(r.launch_date),
      launch_time: String(r.launch_time),
      launch_site: String(r.launch_site),
      rocket: String(r.rocket),
      rocket_mass: Number(r.rocket_mass),
      fuel_mass: Number(r.fuel_mass),
      payload_capacity: Number(r.payload_capacity),
      thrust: Number(r.thrust),
      specific_impulse: Number(r.specific_impulse),
      payload_mass: Number(r.payload_mass),
      payload_volume: Number(r.payload_volume || 0),
      target_orbit: String(r.target_orbit),
      altitude: Number(r.altitude),
      inclination: Number(r.inclination),
      delta_v: Number(r.delta_v),
      flight_time: Number(r.flight_time),
      fuel_consumption: Number(r.fuel_consumption),
      weather_temperature: Number(r.weather_temperature),
      wind_speed: Number(r.wind_speed),
      rain: Number(r.rain),
      humidity: Number(r.humidity),
      safety_status: String(r.safety_status),
      launch_window_start: String(r.launch_window_start),
      launch_window_end: String(r.launch_window_end),
      launch_window_duration: Number(r.launch_window_duration),
      launch_cost: Number(r.launch_cost),
      risk_score: Number(r.risk_score),
      mission_priority: Number(r.mission_priority),
      trajectory_type: String(r.trajectory_type),
      cross_section_area: Number(r.cross_section_area || 10.0),
      drag_coefficient: Number(r.drag_coefficient || 0.32),
      fuel_margin: Number(r.fuel_margin || 0.05),
      payload_fraction: Number(r.payload_fraction || 0.02),
      thrust_to_weight_ratio: Number(r.thrust_to_weight_ratio || 1.3),
      mission_efficiency: Number(r.mission_efficiency || 100.0),
    }));
  }, []);

  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedMission, setSelectedMission] = useState<Mission>(missions[0] || ({} as Mission));
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isLogbookOpen, setIsLogbookOpen] = useState<boolean>(false);

  // Load history from localStorage on startup
  useEffect(() => {
    const loaded = getMissionHistory();
    setHistory(loaded);
  }, []);

  const notesCount = useMemo(() => {
    return history.filter((h) => Boolean(h.notes && h.notes.trim().length > 0)).length;
  }, [history]);

  const handleSaveLogbookNote = (id: string, note: string, tags: string[]) => {
    const updated = updateHistoryEntryNotes(id, note, tags);
    setHistory(updated);
  };

  const persistCurrentRun = useCallback((m: Mission) => {
    const classical = runClassicalOptimization(m);
    const qaoa = runQAOASimulation(m, 1, 1024);
    const updated = saveMissionToHistory(m, classical, qaoa);
    setHistory(updated);
  }, []);

  const handleRunAll = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      persistCurrentRun(selectedMission);
      setActiveTab(6); // Switch to Comparison tab
    }, 450);
  };

  const handleExportAll = () => {
    persistCurrentRun(selectedMission);
    setActiveTab(7); // Switch to Final Mission Plan & Exports tab
  };

  const handleSelectHistoryEntry = (entry: HistoryEntry) => {
    setSelectedMission(entry.mission);
    setIsHistoryModalOpen(false);
    setActiveTab(6); // Jump straight to benchmark comparison of the restored iteration
  };

  const handleRemoveHistoryEntry = (id: string) => {
    const updated = removeHistoryEntry(id);
    setHistory(updated);
  };

  const handleClearHistory = () => {
    clearMissionHistory();
    setHistory([]);
  };

  return (
    <div
      className={`min-h-screen ${
        isDark ? "bg-[#07090e] text-slate-200" : "bg-[#f8fafc] text-slate-800"
      } flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950 transition-colors duration-200`}
    >
      {/* Top Bar with Precision 3-Zone Contract */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeMission={selectedMission}
        onRunAll={handleRunAll}
        onExportAll={handleExportAll}
        isSimulating={isSimulating}
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenLogbook={() => setIsLogbookOpen(true)}
        notesCount={notesCount}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 md:pl-64 flex flex-col transition-all duration-200">
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        <ScientificDisclaimer />

        {/* Tab 1: Mission Selection */}
        {activeTab === 0 && (
          <MissionSelector
            missions={missions}
            selectedMission={selectedMission}
            onSelectMission={(m) => {
              setSelectedMission(m);
            }}
            onProceed={() => setActiveTab(1)}
            onOpenCustomInput={() => setActiveTab(11)}
          />
        )}

        {/* Tab 2: Mission Parameters */}
        {activeTab === 1 && (
          <MissionParameters
            mission={selectedMission}
            onProceedToTrajectory={() => setActiveTab(2)}
          />
        )}

        {/* Tab 3: Trajectory Simulation */}
        {activeTab === 2 && (
          <TrajectorySimulationView
            mission={selectedMission}
            onProceedToClassical={() => setActiveTab(3)}
            onProceedToSensitivity={() => setActiveTab(9)}
          />
        )}

        {/* Tab 4: Classical Optimization */}
        {activeTab === 3 && (
          <ClassicalOptimizationView
            mission={selectedMission}
            onProceedToQUBO={() => setActiveTab(4)}
          />
        )}

        {/* Tab 5: QUBO Formulation */}
        {activeTab === 4 && (
          <QUBOView
            mission={selectedMission}
            onProceedToQAOA={() => setActiveTab(5)}
          />
        )}

        {/* Tab 6: QAOA Quantum Optimization */}
        {activeTab === 5 && (
          <QAOAView
            mission={selectedMission}
            onProceedToComparison={() => {
              persistCurrentRun(selectedMission);
              setActiveTab(6);
            }}
            onProceedToFidelity={() => {
              persistCurrentRun(selectedMission);
              setActiveTab(10);
            }}
          />
        )}

        {/* Tab 7: Classical vs Quantum Comparison */}
        {activeTab === 6 && (
          <ComparisonView
            mission={selectedMission}
            onProceedToPlan={() => setActiveTab(7)}
            history={history}
            allMissions={missions}
            onOpenLogbook={() => setIsLogbookOpen(true)}
            onSelectMission={(m) => setSelectedMission(m)}
            onSaveCurrentToHistory={persistCurrentRun}
          />
        )}

        {/* Tab 8: Final Mission Plan & Exports */}
        {activeTab === 7 && <FinalPlanView mission={selectedMission} />}

        {/* Tab 9: Analytics Dashboard */}
        {activeTab === 8 && (
          <AnalyticsDashboard
            history={history}
            allMissions={missions}
            onSelectMission={(m) => {
              setSelectedMission(m);
              setActiveTab(6);
            }}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
          />
        )}

        {/* Tab 10: Sensitivity Analysis */}
        {activeTab === 9 && (
          <SensitivityAnalysisView
            mission={selectedMission}
            onUpdateMission={(updated) => setSelectedMission(updated)}
            onProceedToOptimization={() => setActiveTab(3)}
          />
        )}

        {/* Tab 11: Quantum Fidelity & Solution Confidence */}
        {activeTab === 10 && (
          <QuantumFidelityView
            mission={selectedMission}
            onProceedToComparison={() => {
              persistCurrentRun(selectedMission);
              setActiveTab(6);
            }}
            onProceedToQAOA={() => setActiveTab(5)}
          />
        )}

        {/* Tab 12: Mission Input & Custom Optimizer */}
        {activeTab === 11 && (
          <MissionInputView
            initialMission={selectedMission}
            onApplyMission={(m) => {
              setSelectedMission(m);
              persistCurrentRun(m);
            }}
            onProceedToComparison={() => {
              persistCurrentRun(selectedMission);
              setActiveTab(6);
            }}
            onProceedToPlan={() => {
              persistCurrentRun(selectedMission);
              setActiveTab(7);
            }}
          />
        )}
        </main>
      </div>

      {/* Mission History Modal / Drawer */}
      <MissionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        onSelectEntry={handleSelectHistoryEntry}
        onRemoveEntry={handleRemoveHistoryEntry}
        onClearHistory={handleClearHistory}
        onNavigateToAnalytics={() => setActiveTab(8)}
        onOpenLogbook={() => setIsLogbookOpen(true)}
      />

      {/* Mission Logbook Sidebar */}
      <MissionLogbookSidebar
        isOpen={isLogbookOpen}
        onClose={() => setIsLogbookOpen(false)}
        history={history}
        onSaveNote={handleSaveLogbookNote}
        onSelectMission={handleSelectHistoryEntry}
      />

      {/* Quiet Academic Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-6 text-xs text-slate-500 font-mono flex flex-wrap items-center justify-between gap-4">
        <div>Launch Trajectory &amp; Mission-Planning Optimization using Quantum Computing</div>
        <div className="flex items-center gap-4">
          <span>Python 3.10 + Qiskit-compatible Ising Formulation</span>
          <span>·</span>
          <span>Tsiolkovsky / RK4 Integration</span>
          <span>·</span>
          <span>{history.length} Saved Iterations</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
