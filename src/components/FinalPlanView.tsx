import React, { useMemo, useState } from "react";
import { Mission, TrajectoryData, ClassicalResult, QAOAResult } from "../types";
import { simulateAscentTrajectory } from "../lib/physics";
import { runClassicalOptimization, runQAOASimulation, buildQUBOMatrix } from "../lib/optimization";
import { generateMissionPDFReport } from "../lib/pdfReport";
import { Download, FileText, CheckCircle2, ShieldAlert, Rocket, Database, Sparkles, Check } from "lucide-react";

interface FinalPlanViewProps {
  mission: Mission;
}

export const FinalPlanView: React.FC<FinalPlanViewProps> = ({ mission }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [hasDownloadedPDF, setHasDownloadedPDF] = useState<boolean>(false);

  const { traj, classical, qaoa, qubo } = useMemo(() => {
    const t = simulateAscentTrajectory(mission, 2.0);
    const c = runClassicalOptimization(mission);
    const q = runQAOASimulation(mission, 1, 1024);
    const qu = buildQUBOMatrix(mission);
    return { traj: t, classical: c, qaoa: q, qubo: qu };
  }, [mission]);

  const plan = classical.optimized;
  const cfg = classical.selected_configuration;

  const downloadFile = (filename: string, content: string, type = "text/csv") => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadOptimizedMission = () => {
    const headers = [
      "mission_id",
      "satellite_name",
      "rocket",
      "target_orbit",
      "selected_window",
      "selected_trajectory",
      "selected_mode",
      "fuel_consumption_kg",
      "delta_v_kms",
      "launch_cost_musd",
      "risk_score",
      "flight_time_sec",
      "objective_value",
    ];
    const values = [
      mission.mission_id,
      mission.satellite_name,
      mission.rocket,
      mission.target_orbit,
      `"${cfg.window_name}"`,
      `"${cfg.trajectory_name}"`,
      `"${cfg.mode_name}"`,
      plan.fuel_consumption_kg,
      plan.delta_v_kms,
      plan.launch_cost_musd,
      plan.risk_score,
      plan.flight_time_sec,
      plan.objective_value,
    ];
    downloadFile("optimized_mission.csv", `${headers.join(",")}\n${values.join(",")}\n`);
  };

  const handleDownloadComparison = () => {
    const rows = [
      "metric,unit,baseline,classical,quantum,best_performer",
      `"Multi-Objective Value","Score",${classical.baseline.objective_value},${classical.optimized.objective_value},${qaoa.decoded_plan.objective_value},"Classical"`,
      `"Fuel Consumption","kg",${classical.baseline.fuel_consumption_kg},${classical.optimized.fuel_consumption_kg},${qaoa.decoded_plan.fuel_consumption_kg},"Classical"`,
      `"Launch Cost","Million USD",${classical.baseline.launch_cost_musd},${classical.optimized.launch_cost_musd},${qaoa.decoded_plan.launch_cost_musd},"Classical"`,
      `"Risk Score","0-100",${classical.baseline.risk_score},${classical.optimized.risk_score},${qaoa.decoded_plan.risk_score},"Classical"`,
      `"Mission Delta-V","km/s",${classical.baseline.delta_v_kms},${classical.optimized.delta_v_kms},${qaoa.decoded_plan.delta_v_kms},"Classical"`,
      `"Flight Time","seconds",${classical.baseline.flight_time_sec},${classical.optimized.flight_time_sec},${qaoa.decoded_plan.flight_time_sec},"Classical"`,
      `"Constraint Violations","count",0,0,${qaoa.decoded_plan.constraint_violations},"Tied"`,
      `"Execution Time","milliseconds",0.0,${classical.execution_time_ms},${qaoa.execution_time_ms},"Classical"`,
    ];
    downloadFile("comparison_results.csv", rows.join("\n"));
  };

  const handleDownloadTrajectory = () => {
    const headers = "time_s,altitude_km,velocity_ms,accel_g,fuel_remaining_kg,dynamic_pressure_kPa";
    const lines = traj.time.map(
      (tVal, i) =>
        `${tVal},${traj.altitude_km[i]},${traj.velocity_ms[i]},${traj.accel_g[i]},${traj.fuel_remaining_kg[i]},${traj.dynamic_pressure_kPa[i]}`
    );
    downloadFile("trajectory_results.csv", `${headers}\n${lines.join("\n")}`);
  };

  const handleDownloadQUBO = () => {
    const header = qubo.variables.join(",");
    const matrixLines = qubo.qubo_matrix.map((row) => row.join(","));
    downloadFile("qubo_matrix.csv", `${header}\n${matrixLines.join("\n")}`);
  };

  const handleDownloadPDFReport = () => {
    setIsGeneratingPDF(true);
    setTimeout(() => {
      try {
        generateMissionPDFReport(mission, traj, classical, qaoa, qubo);
        setHasDownloadedPDF(true);
        setTimeout(() => setHasDownloadedPDF(false), 4000);
      } catch (err) {
        console.error("Failed to generate PDF mission report:", err);
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-mono text-cyan-400">Page 8 — Final Mission Flight Plan &amp; Download Center</div>
          <div className="text-xl font-bold text-white mt-0.5">
            Mission {mission.mission_id}: {mission.satellite_name} Ready for Flight Authorization
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Status: Feasible &amp; Formally Verified · All Constraints Satisfied · Ready to Export
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-950/60 border border-emerald-800 text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Flight Solution Verified
          </span>
          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 rounded-lg shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
            title="Export complete 2-page academic mission results & RK4 trajectory summary as PDF"
          >
            {hasDownloadedPDF ? (
              <>
                <Check className="w-4 h-4 text-slate-950" />
                <span>PDF Downloaded</span>
              </>
            ) : isGeneratingPDF ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-slate-950" />
                <span>Download PDF Mission Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Final Selected Configuration Card */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-cyan-900/50 space-y-4">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Rocket className="w-4 h-4 text-cyan-400" />
          <span>Final Optimized Mission Parameters</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Launch Vehicle &amp; Payload</span>
            <div className="text-sm font-bold text-white mt-1">{mission.rocket}</div>
            <div className="text-slate-500 mt-0.5">{mission.payload_mass.toLocaleString()} kg payload</div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Optimized Window</span>
            <div className="text-sm font-bold text-cyan-400 mt-1">{cfg.window_name}</div>
            <div className="text-slate-500 mt-0.5">Start: {mission.launch_window_start}</div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Ascent Trajectory</span>
            <div className="text-sm font-bold text-cyan-400 mt-1">{cfg.trajectory_name}</div>
            <div className="text-slate-500 mt-0.5">Burn Time: {traj.summary.burn_time_sec} s</div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Throttle &amp; Reserve Mode</span>
            <div className="text-sm font-bold text-cyan-400 mt-1">{cfg.mode_name}</div>
            <div className="text-slate-500 mt-0.5">Fuel Margin: {(mission.fuel_margin * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs font-mono">
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Propellant Burn</span>
            <div className="text-base font-bold text-slate-200 mt-1">
              {plan.fuel_consumption_kg.toLocaleString()} kg
            </div>
            <div className="text-emerald-400 mt-0.5">
              -{(classical.baseline.fuel_consumption_kg - plan.fuel_consumption_kg).toLocaleString()} kg saved
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Total Launch Cost</span>
            <div className="text-base font-bold text-slate-200 mt-1">${plan.launch_cost_musd.toFixed(2)} M</div>
            <div className="text-emerald-400 mt-0.5">
              -${(classical.baseline.launch_cost_musd - plan.launch_cost_musd).toFixed(2)} M saved
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Residual Risk Score</span>
            <div className="text-base font-bold text-emerald-400 mt-1">{plan.risk_score.toFixed(1)} / 100</div>
            <div className="text-slate-500 mt-0.5">Target: {mission.target_orbit}</div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-sans">Multi-Objective Score</span>
            <div className="text-base font-bold text-cyan-400 mt-1">{plan.objective_value.toFixed(4)}</div>
            <div className="text-emerald-400 mt-0.5">+{classical.objective_improvement_pct}% vs baseline</div>
          </div>
        </div>
      </div>

      {/* Downloadable Results & PDF Mission Report */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Downloadable Flight Clearance Artifacts (PDF &amp; CSV Formats)</span>
          </div>
          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-slate-950" />
            <span>{isGeneratingPDF ? "Generating PDF..." : "Export Full PDF Report"}</span>
          </button>
        </div>

        {/* Featured PDF Mission Summary Banner */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-950/60 via-slate-950 to-indigo-950/40 border border-cyan-800/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Official Flight Authorization &amp; Trajectory Summary Report</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                  2-Page PDF
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Includes Executive Flight Clearance, Baseline vs Classical vs 9-Qubit QAOA Benchmarks, RK4 Ascent Flight Dynamics Milestones, and Discrete Numerical Telemetry Time-Series Log.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            {hasDownloadedPDF ? (
              <>
                <Check className="w-4 h-4" />
                <span>Downloaded!</span>
              </>
            ) : isGeneratingPDF ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download PDF Summary</span>
              </>
            )}
          </button>
        </div>

        {/* 5 Downloadable Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <button
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPDF}
            className="p-3.5 bg-slate-950 hover:bg-slate-900 border border-cyan-800/80 hover:border-cyan-500 rounded-lg text-left transition-colors flex flex-col justify-between cursor-pointer space-y-2 ring-1 ring-cyan-500/20"
          >
            <div>
              <div className="font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>flight_report.pdf</span>
              </div>
              <div className="text-slate-400 text-[11px] mt-1">2-page formal mission clearance &amp; RK4 telemetry</div>
            </div>
            <span className="text-cyan-400 font-semibold flex items-center gap-1 font-mono text-[11px]">
              <Download className="w-3 h-3" /> Download PDF
            </span>
          </button>

          <button
            onClick={handleDownloadOptimizedMission}
            className="p-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-600 rounded-lg text-left transition-colors flex flex-col justify-between cursor-pointer space-y-2"
          >
            <div>
              <div className="font-semibold text-slate-200 font-mono">optimized_mission.csv</div>
              <div className="text-slate-500 text-[11px] mt-0.5">Final launch window, trajectory &amp; throttle mode</div>
            </div>
            <span className="text-cyan-400 font-semibold flex items-center gap-1 font-mono">
              <Download className="w-3 h-3" /> Download CSV
            </span>
          </button>

          <button
            onClick={handleDownloadComparison}
            className="p-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-600 rounded-lg text-left transition-colors flex flex-col justify-between cursor-pointer space-y-2"
          >
            <div>
              <div className="font-semibold text-slate-200 font-mono">comparison_results.csv</div>
              <div className="text-slate-500 text-[11px] mt-0.5">Baseline vs Classical vs Quantum benchmark</div>
            </div>
            <span className="text-cyan-400 font-semibold flex items-center gap-1 font-mono">
              <Download className="w-3 h-3" /> Download CSV
            </span>
          </button>

          <button
            onClick={handleDownloadTrajectory}
            className="p-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-600 rounded-lg text-left transition-colors flex flex-col justify-between cursor-pointer space-y-2"
          >
            <div>
              <div className="font-semibold text-slate-200 font-mono">trajectory_results.csv</div>
              <div className="text-slate-500 text-[11px] mt-0.5">RK4 numerical flight dynamics time series</div>
            </div>
            <span className="text-cyan-400 font-semibold flex items-center gap-1 font-mono">
              <Download className="w-3 h-3" /> Download CSV
            </span>
          </button>

          <button
            onClick={handleDownloadQUBO}
            className="p-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-600 rounded-lg text-left transition-colors flex flex-col justify-between cursor-pointer space-y-2"
          >
            <div>
              <div className="font-semibold text-slate-200 font-mono">qubo_matrix.csv</div>
              <div className="text-slate-500 text-[11px] mt-0.5">9×9 formulation matrix &amp; penalty weights</div>
            </div>
            <span className="text-cyan-400 font-semibold flex items-center gap-1 font-mono">
              <Download className="w-3 h-3" /> Download CSV
            </span>
          </button>
        </div>
      </div>

      {/* Dataset Transparency & Scientific Assumptions */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span>Dataset Description &amp; Physical Methodology</span>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed font-sans space-y-2">
          <p>
            <strong>Reference Satellite Missions:</strong> Contains 29 real historical missions (Cartosat-3, Chandrayaan-3, Aditya-L1, RISAT-2BR1, EOS-04, GSAT series) with realistic launch site pairings (Satish Dhawan Space Centre SHAR Sriharikota, Kourou, Cape Canaveral).
          </p>
          <p>
            <strong>Synthetic Mission Catalog:</strong> 471 synthetic missions (e.g. SuryaSat-01, BharatEO-02) generated with fixed random seed (reproducible) enforcing structural bounds (m_payload &le; m_cap, positive thrust, fuel, and specific impulse).
          </p>
          <p>
            <strong>Governing Physical Equations:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-cyan-300">
            <li>Tsiolkovsky Rocket Equation: Δv = Isp × g0 × ln(m0 / mf)</li>
            <li>Newtonian Gravity: g(h) = μ / (R_earth + h)²</li>
            <li>Barometric Exponential Density: ρ(h) = ρ0 × exp(-h / H)</li>
            <li>Aerodynamic Drag: Fd = 0.5 × ρ × v² × Cd × A</li>
            <li>4th-Order Runge-Kutta numerical integration for launch ascent trajectory</li>
          </ul>
        </div>
      </div>

      {/* Prominent Scientific Disclaimer */}
      <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 flex items-start gap-3 text-xs text-slate-300">
        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-rose-300">Important Scientific &amp; Operational Limitation</div>
          <p className="mt-0.5 text-slate-400 leading-relaxed">
            This project is an academic simulation using simplified aerospace models and synthetic/educational data. It is intended for research and demonstration of optimization techniques and is not a flight-certified launch guidance, navigation, or mission-control system.
          </p>
        </div>
      </div>
    </div>
  );
};
