import React, { useState, useMemo } from "react";
import { Mission } from "../types";
import { Search, Filter, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

interface MissionSelectorProps {
  missions: Mission[];
  selectedMission: Mission;
  onSelectMission: (mission: Mission) => void;
  onProceed: () => void;
  onOpenCustomInput?: () => void;
}

export const MissionSelector: React.FC<MissionSelectorProps> = ({
  missions,
  selectedMission,
  onSelectMission,
  onProceed,
  onOpenCustomInput,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [orbitFilter, setOrbitFilter] = useState("ALL");
  const [rocketFilter, setRocketFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const orbitOptions = useMemo(() => ["ALL", ...Array.from(new Set(missions.map((m) => m.target_orbit)))], [missions]);
  const rocketOptions = useMemo(() => ["ALL", ...Array.from(new Set(missions.map((m) => m.rocket)))], [missions]);
  const statusOptions = ["ALL", "SAFE", "MODERATE RISK", "HIGH RISK / HOLD ADVISORY"];

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      const matchSearch =
        m.mission_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.satellite_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.rocket.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.launch_site.toLowerCase().includes(searchTerm.toLowerCase());
      const matchOrbit = orbitFilter === "ALL" || m.target_orbit === orbitFilter;
      const matchRocket = rocketFilter === "ALL" || m.rocket === rocketFilter;
      const matchStatus = statusFilter === "ALL" || m.safety_status === statusFilter;
      return matchSearch && matchOrbit && matchRocket && matchStatus;
    });
  }, [missions, searchTerm, orbitFilter, rocketFilter, statusFilter]);

  const refCount = useMemo(() => missions.filter((m) => m.data_type === "Reference").length, [missions]);
  const safeCount = useMemo(() => missions.filter((m) => m.safety_status === "SAFE").length, [missions]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Total Missions In Catalog</div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">{missions.length}</div>
          <div className="text-xs text-slate-500 mt-1">Physically verified dataset</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Reference Historical Missions</div>
          <div className="text-2xl font-mono font-bold text-cyan-400 mt-1 tabular-nums">{refCount}</div>
          <div className="text-xs text-slate-500 mt-1">ISRO / Global real references</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Synthetic Validated Missions</div>
          <div className="text-2xl font-mono font-bold text-slate-200 mt-1 tabular-nums">{missions.length - refCount}</div>
          <div className="text-xs text-slate-500 mt-1">Tsiolkovsky &amp; drag-calibrated</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-xs uppercase font-mono text-slate-400">Readiness Status: Safe</div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">{safeCount}</div>
          <div className="text-xs text-slate-500 mt-1">Risk score &le; 30 / 100</div>
        </div>
      </div>

      {/* Custom Mission Input Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-800/50 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-700/60 text-cyan-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Have Custom Flight or Vehicle Specifications?</span>
              <span className="px-1.5 py-0.2 bg-cyan-500 text-[10px] text-slate-950 rounded font-mono font-bold uppercase">New</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Input custom rocket, payload, trajectory, and weather parameters to run full classical vs QAOA optimization.
            </div>
          </div>
        </div>
        {onOpenCustomInput && (
          <button
            onClick={onOpenCustomInput}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <span>Enter Mission Parameters</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search mission ID, satellite, rocket, launch site..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={orbitFilter}
            onChange={(e) => setOrbitFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Orbits</option>
            {orbitOptions.filter((o) => o !== "ALL").map((o) => (
              <option key={o} value={o}>Orbit: {o}</option>
            ))}
          </select>

          <select
            value={rocketFilter}
            onChange={(e) => setRocketFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Rockets</option>
            {rocketOptions.filter((r) => r !== "ALL").map((r) => (
              <option key={r} value={r}>Rocket: {r}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Safety Statuses</option>
            {statusOptions.filter((s) => s !== "ALL").map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-400 font-mono tabular-nums">
          Showing {filteredMissions.length} of {missions.length} records
        </div>
      </div>

      {/* Selected Mission Active Card */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-900/70 border border-cyan-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase font-mono text-cyan-400">Currently Selected Mission</div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <span>{selectedMission.mission_id} — {selectedMission.satellite_name}</span>
            <span className="text-xs font-normal text-slate-400">({selectedMission.data_type})</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{selectedMission.rocket}</span>
            <span>·</span>
            <span>Target: {selectedMission.target_orbit} ({selectedMission.altitude} km, {selectedMission.inclination}°)</span>
            <span>·</span>
            <span>Site: {selectedMission.launch_site}</span>
            <span>·</span>
            <span>Payload: {selectedMission.payload_mass.toLocaleString()} kg</span>
          </div>
        </div>

        <button
          onClick={onProceed}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
        >
          <span>Inspect Flight Parameters</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Missions Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Mission ID</th>
                <th className="p-3">Satellite</th>
                <th className="p-3">Type</th>
                <th className="p-3">Rocket</th>
                <th className="p-3">Orbit</th>
                <th className="p-3">Altitude</th>
                <th className="p-3">Payload (kg)</th>
                <th className="p-3">Δv (km/s)</th>
                <th className="p-3">Est. Cost</th>
                <th className="p-3">Risk Score</th>
                <th className="p-3">Safety Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono tabular-nums">
              {filteredMissions.slice(0, 50).map((m) => {
                const isSelected = m.mission_id === selectedMission.mission_id;
                return (
                  <tr
                    key={m.mission_id}
                    onClick={() => onSelectMission(m)}
                    className={`hover:bg-slate-900/50 cursor-pointer transition-colors ${
                      isSelected ? "bg-cyan-950/30 text-white" : ""
                    }`}
                  >
                    <td className="p-3 font-semibold text-slate-200">
                      {isSelected ? (
                        <span className="flex items-center gap-1.5 text-cyan-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {m.mission_id}
                        </span>
                      ) : (
                        m.mission_id
                      )}
                    </td>
                    <td className="p-3 font-sans font-medium text-slate-200">{m.satellite_name}</td>
                    <td className="p-3 text-slate-400">{m.data_type}</td>
                    <td className="p-3 text-slate-300">{m.rocket}</td>
                    <td className="p-3">{m.target_orbit}</td>
                    <td className="p-3">{m.altitude} km</td>
                    <td className="p-3">{m.payload_mass.toLocaleString()}</td>
                    <td className="p-3">{m.delta_v}</td>
                    <td className="p-3">${m.launch_cost}M</td>
                    <td className="p-3 font-semibold">{m.risk_score}</td>
                    <td className="p-3">
                      <span className={m.safety_status === "SAFE" ? "text-emerald-400" : m.safety_status.includes("HIGH") ? "text-rose-400" : "text-amber-400"}>
                        {m.safety_status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMission(m);
                        }}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          isSelected
                            ? "bg-cyan-500 text-slate-950 font-semibold"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {isSelected ? "Selected" : "Select"}
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
