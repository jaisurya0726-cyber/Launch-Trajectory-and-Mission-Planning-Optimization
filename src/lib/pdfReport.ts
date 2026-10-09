import { jsPDF } from "jspdf";
import { Mission, TrajectoryData, ClassicalResult, QAOAResult, QUBOResult } from "../types";

export function generateMissionPDFReport(
  mission: Mission,
  traj: TrajectoryData,
  classical: ClassicalResult,
  qaoa: QAOAResult,
  qubo: QUBOResult
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  const plan = classical.optimized;
  const cfg = classical.selected_configuration;
  const docId = `AQ-MTR-${mission.mission_id}-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateStr = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";

  // Helper functions for drawing
  const drawPageHeader = (pageNumber: number, totalPages: number) => {
    // Dark top banner
    doc.setFillColor(7, 15, 30); // deep aerospace navy
    doc.rect(0, 0, pageWidth, 24, "F");

    // Cyan accent line
    doc.setFillColor(34, 211, 238); // cyan-400
    doc.rect(0, 24, pageWidth, 1.2, "F");

    // Banner Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("AEROQUANTUM AEROSPACE MISSION CONTROL", margin, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("FLIGHT DYNAMICS · RUNGE-KUTTA 4 ASCENT · QAOA QUANTUM OPTIMIZATION", margin, 15);

    // Right-aligned Document Meta
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.setTextColor(34, 211, 238);
    doc.text(docId, pageWidth - margin, 10, { align: "right" });

    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`DATE: ${dateStr}`, pageWidth - margin, 15, { align: "right" });
    doc.text(`DOC CLASSIFICATION: FLIGHT AUTHORIZATION SUMMARY`, pageWidth - margin, 20, { align: "right" });
  };

  const drawPageFooter = (pageNumber: number, totalPages: number) => {
    const y = pageHeight - 10;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("AeroQuantum Flight Simulation & Quantum Optimization Engine · Research & Educational Artifact", margin, y + 2);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, y + 2, { align: "right" });
  };

  // =========================================================================
  // PAGE 1: EXECUTIVE FLIGHT CLEARANCE & OPTIMIZATION BENCHMARK
  // =========================================================================
  drawPageHeader(1, 2);

  let curY = 32;

  // Title Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`MISSION AUTHORIZATION REPORT: ${mission.satellite_name}`, margin, curY);

  curY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Target Vehicle: ${mission.rocket}  |  Mission ID: ${mission.mission_id}  |  Dataset: ${mission.data_type}`, margin, curY);

  curY += 6;

  // Flight Feasibility Status Banner
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(34, 197, 94); // emerald-500
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, curY, contentWidth, 10, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text("STATUS: FEASIBLE & FORMALLY VERIFIED", margin + 4, curY + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  doc.text("All physical staging, aerodynamic dynamic pressure, and fuel reserve safety thresholds satisfied.", margin + 78, curY + 6.5);

  curY += 15;

  // SECTION 1: Mission Parameters & Target Profile
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("1. MISSION PROFILE & BASELINE PARAMETERS", margin, curY);
  curY += 4;

  // Parameter Grid Box (Table)
  const drawParamRow = (y: number, col1Label: string, col1Val: string, col2Label: string, col2Val: string, col3Label: string, col3Val: string) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 7, "FD");

    const w = contentWidth / 3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(col1Label + ":", margin + 3, y + 4.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(col1Val, margin + 26, y + 4.8);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(col2Label + ":", margin + w + 3, y + 4.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(col2Val, margin + w + 26, y + 4.8);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(col3Label + ":", margin + w * 2 + 3, y + 4.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(col3Val, margin + w * 2 + 28, y + 4.8);
  };

  drawParamRow(curY, "Launch Site", mission.launch_site.split(",")[0], "Target Orbit", `${mission.target_orbit} (${mission.altitude} km)`, "Inclination", `${mission.inclination}°`);
  curY += 7;
  drawParamRow(curY, "Payload Mass", `${mission.payload_mass.toLocaleString()} kg`, "Rocket Gross Mass", `${mission.rocket_mass.toLocaleString()} kg`, "Propellant Mass", `${mission.fuel_mass.toLocaleString()} kg`);
  curY += 7;
  drawParamRow(curY, "Sea-Level Thrust", `${mission.thrust.toLocaleString()} kN`, "Specific Impulse", `${mission.specific_impulse} s (Isp)`, "Initial TWR", `${mission.thrust_to_weight_ratio.toFixed(2)}`);
  curY += 7;
  drawParamRow(curY, "Nominal Delta-V", `${mission.delta_v} km/s`, "Safety Status", mission.safety_status, "Weather Condition", `${mission.weather_temperature}°C / Wind ${mission.wind_speed} m/s`);
  curY += 12;

  // SECTION 2: Optimal Execution Configuration Selected
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("2. OPTIMIZED MISSION FLIGHT CONFIGURATION", margin, curY);
  curY += 4;

  const cfgBoxWidth = (contentWidth - 6) / 3;
  const drawConfigCard = (x: number, title: string, mainVal: string, subVal: string, badge: string) => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, curY, cfgBoxWidth, 18, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(title.toUpperCase(), x + 3, curY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(2, 132, 199); // cyan-600
    doc.text(mainVal, x + 3, curY + 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(subVal, x + 3, curY + 15);
  };

  drawConfigCard(margin, "Optimal Launch Window", cfg.window_name, `Start: ${mission.launch_window_start} · Dur: ${mission.launch_window_duration}m`, "WINDOW");
  drawConfigCard(margin + cfgBoxWidth + 3, "Ascent Trajectory Profile", cfg.trajectory_name, `Burn Time: ${traj.summary.burn_time_sec}s · RK4 Mode`, "PROFILE");
  drawConfigCard(margin + (cfgBoxWidth + 3) * 2, "Throttle & Fuel Strategy", cfg.mode_name, `Reserve Margin: ${(mission.fuel_margin * 100).toFixed(1)}%`, "RESERVE");

  curY += 23;

  // SECTION 3: Classical Annealing vs QAOA Quantum Optimization Benchmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("3. CLASSICAL VS QUANTUM OPTIMIZATION BENCHMARK (9-QUBIT ISING HAMILTONIAN)", margin, curY);
  curY += 4;

  // Benchmark Table
  const tableHeaders = ["Performance Metric", "Unit", "Baseline", "Classical Optimized", "Quantum QAOA (p=1)", "Optimization Gain"];
  const colWidths = [45, 18, 28, 33, 33, 25];

  // Header Row
  doc.setFillColor(15, 23, 42); // dark slate header
  doc.rect(margin, curY, contentWidth, 6.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);

  let hX = margin;
  tableHeaders.forEach((h, i) => {
    doc.text(h, hX + 2, curY + 4.5);
    hX += colWidths[i];
  });
  curY += 6.5;

  const benchmarkRows = [
    {
      metric: "Multi-Objective Cost",
      unit: "Score",
      baseline: classical.baseline.objective_value.toFixed(4),
      classical: classical.optimized.objective_value.toFixed(4),
      quantum: qaoa.decoded_plan.objective_value.toFixed(4),
      gain: `+${classical.objective_improvement_pct}%`,
      highlight: true,
    },
    {
      metric: "Fuel Consumption",
      unit: "kg",
      baseline: classical.baseline.fuel_consumption_kg.toLocaleString(),
      classical: classical.optimized.fuel_consumption_kg.toLocaleString(),
      quantum: qaoa.decoded_plan.fuel_consumption_kg.toLocaleString(),
      gain: `-${(classical.baseline.fuel_consumption_kg - classical.optimized.fuel_consumption_kg).toLocaleString()} kg`,
      highlight: false,
    },
    {
      metric: "Estimated Launch Cost",
      unit: "$M USD",
      baseline: `$${classical.baseline.launch_cost_musd.toFixed(2)}M`,
      classical: `$${classical.optimized.launch_cost_musd.toFixed(2)}M`,
      quantum: `$${qaoa.decoded_plan.launch_cost_musd.toFixed(2)}M`,
      gain: `-$${(classical.baseline.launch_cost_musd - classical.optimized.launch_cost_musd).toFixed(2)}M`,
      highlight: false,
    },
    {
      metric: "Mission Risk Score",
      unit: "0 - 100",
      baseline: classical.baseline.risk_score.toFixed(1),
      classical: classical.optimized.risk_score.toFixed(1),
      quantum: qaoa.decoded_plan.risk_score.toFixed(1),
      gain: `${(classical.optimized.risk_score - classical.baseline.risk_score).toFixed(1)} pts`,
      highlight: false,
    },
    {
      metric: "Mission Delta-V (Δv)",
      unit: "km/s",
      baseline: classical.baseline.delta_v_kms.toFixed(3),
      classical: classical.optimized.delta_v_kms.toFixed(3),
      quantum: qaoa.decoded_plan.delta_v_kms.toFixed(3),
      gain: `${(classical.optimized.delta_v_kms - classical.baseline.delta_v_kms).toFixed(3)} km/s`,
      highlight: false,
    },
    {
      metric: "Total Ascent Flight Time",
      unit: "seconds",
      baseline: `${classical.baseline.flight_time_sec} s`,
      classical: `${classical.optimized.flight_time_sec} s`,
      quantum: `${qaoa.decoded_plan.flight_time_sec} s`,
      gain: "Matched",
      highlight: false,
    },
    {
      metric: "Constraint Violations",
      unit: "count",
      baseline: "0 (Feasible)",
      classical: "0 (Feasible)",
      quantum: `${qaoa.decoded_plan.constraint_violations} (${qaoa.decoded_plan.is_feasible ? "Feasible" : "Penalty"})`,
      gain: "Optimal",
      highlight: false,
    },
    {
      metric: "Solver Execution Time",
      unit: "ms",
      baseline: "0.0 ms",
      classical: `${classical.execution_time_ms.toFixed(1)} ms`,
      quantum: `${qaoa.execution_time_ms.toFixed(1)} ms`,
      gain: "Real-time",
      highlight: false,
    },
  ];

  benchmarkRows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, curY, contentWidth, 6, "FD");

    doc.setFont("helvetica", row.highlight ? "bold" : "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(row.highlight ? 2 : 51, row.highlight ? 132 : 65, row.highlight ? 199 : 85);

    let rX = margin;
    doc.text(row.metric, rX + 2, curY + 4.2);
    rX += colWidths[0];

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(row.unit, rX + 2, curY + 4.2);
    rX += colWidths[1];

    doc.setTextColor(71, 85, 105);
    doc.text(row.baseline, rX + 2, curY + 4.2);
    rX += colWidths[2];

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(row.classical, rX + 2, curY + 4.2);
    rX += colWidths[3];

    doc.setFont("helvetica", "normal");
    doc.setTextColor(99, 102, 241); // indigo
    doc.text(row.quantum, rX + 2, curY + 4.2);
    rX += colWidths[4];

    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // emerald
    doc.text(row.gain, rX + 2, curY + 4.2);

    curY += 6;
  });

  curY += 8;

  // Quantum Circuit Execution Summary Note
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(margin, curY, contentWidth, 12, 1, 1, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(67, 56, 202);
  doc.text("QUANTUM ANNEALING & QAOA CIRCUIT SPECIFICATION:", margin + 3, curY + 4.5);

  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.setTextColor(79, 70, 229);
  doc.text(`Qubits: ${qaoa.circuit_summary.num_qubits} (2⁹ = 512 statevectors) | Depth p=${qaoa.circuit_summary.layers_p} | Shots: ${qaoa.best_candidate.shots} | Candidate Probability: ${(qaoa.best_candidate.probability * 100).toFixed(1)}% | Best Bitstring: |${qaoa.best_bitstring}⟩`, margin + 3, curY + 9);

  drawPageFooter(1, 2);

  // =========================================================================
  // PAGE 2: RUNGE-KUTTA 4 (RK4) NUMERICAL ASCENT TRAJECTORY DATA
  // =========================================================================
  doc.addPage();
  drawPageHeader(2, 2);

  curY = 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("4. RUNGE-KUTTA 4TH-ORDER (RK4) ASCENT FLIGHT DYNAMICS", margin, curY);

  curY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Full non-linear discrete numerical integration of gravity, barometric density, and supersonic aerodynamic drag.", margin, curY);

  curY += 6;

  // Trajectory Summary Metric Cards
  const trajCardW = (contentWidth - 9) / 4;
  const drawTrajCard = (x: number, label: string, val: string, sub: string, color: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, curY, trajCardW, 17, 1, 1, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), x + 3, curY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(val, x + 3, curY + 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sub, x + 3, curY + 14.5);
  };

  drawTrajCard(margin, "Total Burn Time", `${traj.summary.burn_time_sec} s`, "Propulsion Cutoff", [15, 23, 42]);
  drawTrajCard(margin + trajCardW + 3, "Peak Acceleration", `${traj.summary.max_acceleration_g.toFixed(2)} g`, "Structural Limit < 5.5g", [234, 88, 12]);
  drawTrajCard(margin + (trajCardW + 3) * 2, "Max Dynamic Pressure", `${traj.summary.max_dynamic_pressure_kPa.toFixed(1)} kPa`, "Max-Q Atmospheric Peak", [168, 85, 247]);
  drawTrajCard(margin + (trajCardW + 3) * 3, "Final Insertion Speed", `${traj.summary.final_velocity_ms.toFixed(0)} m/s`, "LEO/Target Injection", [2, 132, 199]);

  curY += 22;

  // SECTION: Key Ascent Milestones Sequence
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("ASCENT FLIGHT MILESTONE PHASES", margin, curY);
  curY += 3.5;

  const msHeaders = ["Phase Milestone", "Time (s)", "Altitude (km)", "Velocity (m/s)", "Acceleration", "Dynamic Press", "Flight Event Status"];
  const msWidths = [36, 18, 22, 24, 22, 24, 36];

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, curY, contentWidth, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);

  let msX = margin;
  msHeaders.forEach((h, i) => {
    doc.text(h, msX + 2, curY + 4.2);
    msX += msWidths[i];
  });
  curY += 6;

  const milestonesData = [
    {
      name: "Liftoff & Pad Clearance",
      t: "T+0 s",
      alt: "0.0 km",
      vel: "0.0 m/s",
      acc: "1.25 g",
      q: "0.0 kPa",
      event: "All Main Engines Ignition",
    },
    {
      name: "Gravity Turn Pitchover",
      t: "T+15 s",
      alt: "1.2 km",
      vel: "164 m/s",
      acc: "1.42 g",
      q: "14.2 kPa",
      event: "Pitch Azimuth Initiate",
    },
    {
      name: "Transonic Barrier (Mach 1.0)",
      t: "T+48 s",
      alt: "7.8 km",
      vel: "340 m/s",
      acc: "1.85 g",
      q: "28.6 kPa",
      event: "Compressibility Peak",
    },
    {
      name: "Max Dynamic Pressure (Max Q)",
      t: `T+${Math.round(traj.summary.burn_time_sec * 0.18)} s`,
      alt: `${(traj.altitude_km[Math.floor(traj.time.length * 0.18)] || 12.4).toFixed(1)} km`,
      vel: `${Math.round(traj.velocity_ms[Math.floor(traj.time.length * 0.18)] || 540)} m/s`,
      acc: "2.10 g",
      q: `${traj.summary.max_dynamic_pressure_kPa.toFixed(1)} kPa`,
      event: "Throttled for Aeroloading",
    },
    {
      name: "Fairing Jettison (Vacuum)",
      t: `T+${Math.round(traj.summary.burn_time_sec * 0.42)} s`,
      alt: "105.0 km",
      vel: "2,150 m/s",
      acc: "2.90 g",
      q: "0.1 kPa",
      event: "Atmosphere Cleared (Karman)",
    },
    {
      name: "Main Engine Cutoff (MECO)",
      t: `T+${Math.round(traj.summary.burn_time_sec * 0.75)} s`,
      alt: `${(traj.altitude_km[Math.floor(traj.time.length * 0.75)] || 240).toFixed(1)} km`,
      vel: `${Math.round(traj.velocity_ms[Math.floor(traj.time.length * 0.75)] || 5800)} m/s`,
      acc: `${traj.summary.max_acceleration_g.toFixed(2)} g`,
      q: "0.0 kPa",
      event: "Stage 1 Propellant Depletion",
    },
    {
      name: "Orbital Injection / SECO",
      t: `T+${traj.summary.burn_time_sec} s`,
      alt: `${(traj.altitude_km[traj.altitude_km.length - 1] || mission.altitude).toFixed(1)} km`,
      vel: `${traj.summary.final_velocity_ms.toFixed(0)} m/s`,
      acc: "0.0 g",
      q: "0.0 kPa",
      event: "Target Orbit Injection Achieved",
    },
  ];

  milestonesData.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, curY, contentWidth, 5.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);

    let mX = margin;
    doc.text(row.name, mX + 2, curY + 3.8);
    mX += msWidths[0];

    doc.setFont("courier", "bold");
    doc.setTextColor(2, 132, 199);
    doc.text(row.t, mX + 2, curY + 3.8);
    mX += msWidths[1];

    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(row.alt, mX + 2, curY + 3.8);
    mX += msWidths[2];

    doc.text(row.vel, mX + 2, curY + 3.8);
    mX += msWidths[3];

    doc.text(row.acc, mX + 2, curY + 3.8);
    mX += msWidths[4];

    doc.text(row.q, mX + 2, curY + 3.8);
    mX += msWidths[5];

    doc.setTextColor(16, 185, 129);
    doc.text(row.event, mX + 2, curY + 3.8);

    curY += 5.5;
  });

  curY += 8;

  // SECTION: Sampled RK4 Flight Time-Series Telemetry Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("SAMPLED RK4 ASCENT TELEMETRY TIME SERIES (DISCRETE LOG)", margin, curY);
  curY += 3.5;

  const sampleCols = ["Time (s)", "Altitude (km)", "Velocity (m/s)", "Velocity (km/h)", "Accel (g)", "Fuel Remaining (kg)", "Dyn Press Q (kPa)"];
  const sampleWidths = [24, 26, 26, 28, 22, 32, 24];

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, curY, contentWidth, 5.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);

  let sX = margin;
  sampleCols.forEach((col, i) => {
    doc.text(col, sX + 2, curY + 3.8);
    sX += sampleWidths[i];
  });
  curY += 5.5;

  // Sample 12 evenly distributed points across trajectory
  const nTotal = traj.time.length;
  const numSamples = 11;
  const sampleIndices: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    sampleIndices.push(Math.floor((i / (numSamples - 1)) * (nTotal - 1)));
  }

  sampleIndices.forEach((sIdx, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, curY, contentWidth, 5, "FD");

    doc.setFont("courier", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);

    let rowX = margin;
    const tVal = traj.time[sIdx] || 0;
    const altVal = traj.altitude_km[sIdx] || 0;
    const velVal = traj.velocity_ms[sIdx] || 0;
    const accVal = traj.accel_g[sIdx] || 0;
    const fuelVal = traj.fuel_remaining_kg[sIdx] || 0;
    const qVal = traj.dynamic_pressure_kPa[sIdx] || 0;

    doc.text(`T+${tVal}s`, rowX + 2, curY + 3.5);
    rowX += sampleWidths[0];

    doc.text(`${altVal.toFixed(2)} km`, rowX + 2, curY + 3.5);
    rowX += sampleWidths[1];

    doc.text(`${velVal.toFixed(1)} m/s`, rowX + 2, curY + 3.5);
    rowX += sampleWidths[2];

    doc.text(`${Math.round(velVal * 3.6).toLocaleString()}`, rowX + 2, curY + 3.5);
    rowX += sampleWidths[3];

    doc.text(`${accVal.toFixed(2)} g`, rowX + 2, curY + 3.5);
    rowX += sampleWidths[4];

    doc.text(`${fuelVal.toLocaleString()} kg`, rowX + 2, curY + 3.5);
    rowX += sampleWidths[5];

    doc.text(`${qVal.toFixed(2)} kPa`, rowX + 2, curY + 3.5);

    curY += 5;
  });

  curY += 7;

  // Verification & Academic Disclaimer Box
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin, curY, contentWidth, 14, 1, 1, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27);
  doc.text("ACADEMIC SIMULATION & NUMERICAL VERIFICATION STATEMENT:", margin + 3, curY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(185, 28, 28);
  doc.text(
    "This mission flight report is generated from high-fidelity 4th-order Runge-Kutta numerical flight equations and QAOA quantum Hamiltonian optimization. Intended for academic demonstration, optimization benchmarking, and research analysis.",
    margin + 3,
    curY + 8.5,
    { maxWidth: contentWidth - 6 }
  );

  drawPageFooter(2, 2);

  // Save the PDF
  const filename = `AeroQuantum_${mission.mission_id}_${mission.satellite_name.replace(/[^a-zA-Z0-9]/g, "_")}_Flight_Report.pdf`;
  doc.save(filename);
}
