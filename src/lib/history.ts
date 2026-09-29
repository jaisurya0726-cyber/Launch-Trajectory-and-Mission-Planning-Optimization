import { HistoryEntry, Mission, ClassicalResult, QAOAResult } from "../types";

const HISTORY_STORAGE_KEY = "aeroquantum_mission_history";
const MAX_HISTORY_ITEMS = 15;

export function getMissionHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_HISTORY_ITEMS);
    }
  } catch (err) {
    console.error("Failed to read mission history from localStorage", err);
  }
  return [];
}

export function saveMissionToHistory(
  mission: Mission,
  classicalRes: ClassicalResult,
  qaoaRes: QAOAResult
): HistoryEntry[] {
  try {
    const history = getMissionHistory();

    const now = new Date();
    const formattedDate = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
      " · " +
      now.toLocaleDateString([], { month: "short", day: "numeric" });

    const newEntry: HistoryEntry = {
      id: `hist_${mission.mission_id}_${Date.now()}`,
      timestamp: formattedDate,
      mission_id: mission.mission_id,
      satellite_name: mission.satellite_name,
      rocket: mission.rocket,
      target_orbit: mission.target_orbit,
      altitude: mission.altitude,
      payload_mass: mission.payload_mass,
      selected_window: classicalRes.selected_configuration.window_name,
      selected_trajectory: classicalRes.selected_configuration.trajectory_name,
      selected_mode: classicalRes.selected_configuration.mode_name,
      classical_objective: classicalRes.optimized.objective_value,
      quantum_objective: qaoaRes.decoded_plan.objective_value,
      best_bitstring: qaoaRes.best_bitstring,
      fuel_consumption_kg: classicalRes.optimized.fuel_consumption_kg,
      fuel_saved_kg: Math.round(
        Math.max(0, classicalRes.baseline.fuel_consumption_kg - classicalRes.optimized.fuel_consumption_kg)
      ),
      launch_cost_musd: classicalRes.optimized.launch_cost_musd,
      risk_score: classicalRes.optimized.risk_score,
      mission,
    };

    // Filter out duplicate identical runs for same mission if immediately repeated
    const filtered = history.filter((h) => h.mission_id !== mission.mission_id || h.best_bitstring !== newEntry.best_bitstring);
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to save mission history to localStorage", err);
    return getMissionHistory();
  }
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  try {
    const history = getMissionHistory();
    const updated = history.filter((item) => item.id !== id);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to remove history entry", err);
    return getMissionHistory();
  }
}

export function clearMissionHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear mission history", err);
  }
}

export function updateHistoryEntryNotes(
  id: string,
  notes: string,
  tags?: string[]
): HistoryEntry[] {
  try {
    const history = getMissionHistory();
    const updated = history.map((entry) => {
      if (entry.id === id) {
        const now = new Date();
        const formattedDate =
          now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
          " · " +
          now.toLocaleDateString([], { month: "short", day: "numeric" });
        return {
          ...entry,
          notes,
          notes_updated_at: formattedDate,
          tags: tags || entry.tags || [],
        };
      }
      return entry;
    });
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to update mission entry notes", err);
    return getMissionHistory();
  }
}

