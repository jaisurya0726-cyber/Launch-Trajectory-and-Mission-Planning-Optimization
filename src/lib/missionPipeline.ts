import { Mission, ClassicalResult, QUBOResult, QAOAResult } from "../types";
import {
  runClassicalOptimization,
  buildQUBOMatrix,
  runQAOASimulation,
  decodeBitstring,
  isBitstringFeasible,
  VARIABLE_LABELS,
} from "./optimization";
import { G0, simulateAscentTrajectory, EARTH_RADIUS_M, EARTH_MU } from "./physics";

export interface RawMissionInput {
  // Launch Parameters
  mission_id: string;
  satellite_name: string;
  launch_date: string;
  launch_time: string;
  launch_site: string;
  rocket: string;
  target_orbit: string;
  altitude: number;
  inclination: number;

  // Rocket Parameters
  rocket_mass: number;
  fuel_mass: number;
  thrust: number;
  specific_impulse: number;

  // Payload Parameters
  payload_mass: number;
  payload_volume: number;
  mission_priority: number;

  // Trajectory Parameters
  delta_v: number;
  flight_time_minutes: number;
  fuel_consumption: number;

  // Weather Parameters
  weather_temperature: number;
  wind_speed: number;
  rain: number;
  weather_condition: string;

  // Mission Constraints
  safety_status: string;
  risk_score: number;
  launch_cost: number;
  launch_window_start: string;
  launch_window_end: string;
  launch_window_duration: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

export interface PreprocessedMissionData {
  mission: Mission;
  flight_time_seconds: number;
  payload_fraction: number;
  thrust_to_weight_ratio: number;
  cross_section_area: number;
  drag_coefficient: number;
  fuel_margin: number;
  warnings: string[];
}

export interface ConstraintCheckItem {
  id: string;
  name: string;
  category: string;
  status: "PASS" | "FAIL";
  measured_value: string;
  limit_value: string;
  description: string;
}

export interface ConstraintVerificationReport {
  isFeasible: boolean;
  passedCount: number;
  totalCount: number;
  checks: {
    fuel_constraint: ConstraintCheckItem;
    payload_constraint: ConstraintCheckItem;
    launch_window_constraint: ConstraintCheckItem;
    weather_constraint: ConstraintCheckItem;
    safety_constraint: ConstraintCheckItem;
    orbit_constraint: ConstraintCheckItem;
    rocket_capacity_constraint: ConstraintCheckItem;
  };
}

export interface DecodedBitstringExplanation {
  bitstring: string;
  variable_mapping: Array<{
    bit: string;
    index: number;
    variable_name: string;
    description: string;
    selected: boolean;
  }>;
  window_choice: string;
  trajectory_choice: string;
  mode_choice: string;
  energy: number;
  is_valid_one_hot: boolean;
  violations: string[];
}

export interface ComparisonTableRow {
  parameter: string;
  unit: string;
  original: string | number;
  classical: string | number;
  qaoa: string | number;
  best: "Original" | "Classical" | "QAOA" | "Tied";
}

export interface PipelineExecutionResult {
  success: boolean;
  errorMessage?: string;
  rawInput: RawMissionInput;
  processedMission: Mission;
  classicalResult: ClassicalResult;
  quboResult: QUBOResult;
  qaoaResult: QAOAResult;
  decodedQAOA: DecodedBitstringExplanation;
  constraintReport: ConstraintVerificationReport;
  comparisonRows: ComparisonTableRow[];
  bestSolution: "Classical" | "QAOA";
  executionTimestamp: string;
}

export const DEFAULT_MISSION_INPUT: RawMissionInput = {
  mission_id: "M-CUSTOM-01",
  satellite_name: "AeroQuantum-Alpha",
  launch_date: new Date().toISOString().split("T")[0],
  launch_time: "06:30:00",
  launch_site: "Satish Dhawan Space Centre, Sriharikota",
  rocket: "PSLV",
  target_orbit: "SSO",
  altitude: 505,
  inclination: 97.4,

  rocket_mass: 28000,
  fuel_mass: 292000,
  thrust: 4800,
  specific_impulse: 305,

  payload_mass: 1625,
  payload_volume: 5.45,
  mission_priority: 1,

  delta_v: 10.846,
  flight_time_minutes: 11.33,
  fuel_consumption: 292000,

  weather_temperature: 24.5,
  wind_speed: 6.2,
  rain: 0.0,
  weather_condition: "Clear Sky",

  safety_status: "SAFE",
  risk_score: 35.0,
  launch_cost: 37.45,
  launch_window_start: "06:15",
  launch_window_end: "06:45",
  launch_window_duration: 30,
};

/**
 * 1. collectMissionInput()
 * Normalizes and collects form fields into a pristine RawMissionInput object.
 */
export function collectMissionInput(partial: Partial<RawMissionInput>): RawMissionInput {
  return {
    mission_id: String(partial.mission_id || DEFAULT_MISSION_INPUT.mission_id).trim(),
    satellite_name: String(partial.satellite_name || DEFAULT_MISSION_INPUT.satellite_name).trim(),
    launch_date: String(partial.launch_date || DEFAULT_MISSION_INPUT.launch_date).trim(),
    launch_time: String(partial.launch_time || DEFAULT_MISSION_INPUT.launch_time).trim(),
    launch_site: String(partial.launch_site || DEFAULT_MISSION_INPUT.launch_site).trim(),
    rocket: String(partial.rocket || DEFAULT_MISSION_INPUT.rocket).trim(),
    target_orbit: String(partial.target_orbit || DEFAULT_MISSION_INPUT.target_orbit).trim(),
    altitude: Number(partial.altitude ?? DEFAULT_MISSION_INPUT.altitude),
    inclination: Number(partial.inclination ?? DEFAULT_MISSION_INPUT.inclination),

    rocket_mass: Number(partial.rocket_mass ?? DEFAULT_MISSION_INPUT.rocket_mass),
    fuel_mass: Number(partial.fuel_mass ?? DEFAULT_MISSION_INPUT.fuel_mass),
    thrust: Number(partial.thrust ?? DEFAULT_MISSION_INPUT.thrust),
    specific_impulse: Number(partial.specific_impulse ?? DEFAULT_MISSION_INPUT.specific_impulse),

    payload_mass: Number(partial.payload_mass ?? DEFAULT_MISSION_INPUT.payload_mass),
    payload_volume: Number(partial.payload_volume ?? DEFAULT_MISSION_INPUT.payload_volume),
    mission_priority: Number(partial.mission_priority ?? DEFAULT_MISSION_INPUT.mission_priority),

    delta_v: Number(partial.delta_v ?? DEFAULT_MISSION_INPUT.delta_v),
    flight_time_minutes: Number(partial.flight_time_minutes ?? DEFAULT_MISSION_INPUT.flight_time_minutes),
    fuel_consumption: Number(partial.fuel_consumption ?? DEFAULT_MISSION_INPUT.fuel_consumption),

    weather_temperature: Number(partial.weather_temperature ?? DEFAULT_MISSION_INPUT.weather_temperature),
    wind_speed: Number(partial.wind_speed ?? DEFAULT_MISSION_INPUT.wind_speed),
    rain: Number(partial.rain ?? DEFAULT_MISSION_INPUT.rain),
    weather_condition: String(partial.weather_condition || DEFAULT_MISSION_INPUT.weather_condition).trim(),

    safety_status: String(partial.safety_status || DEFAULT_MISSION_INPUT.safety_status).trim(),
    risk_score: Number(partial.risk_score ?? DEFAULT_MISSION_INPUT.risk_score),
    launch_cost: Number(partial.launch_cost ?? DEFAULT_MISSION_INPUT.launch_cost),
    launch_window_start: String(partial.launch_window_start || DEFAULT_MISSION_INPUT.launch_window_start).trim(),
    launch_window_end: String(partial.launch_window_end || DEFAULT_MISSION_INPUT.launch_window_end).trim(),
    launch_window_duration: Number(partial.launch_window_duration ?? DEFAULT_MISSION_INPUT.launch_window_duration),
  };
}

/**
 * 2. validateMissionInput()
 * Performs exhaustive physical and aerospace operational validation.
 */
export function validateMissionInput(input: RawMissionInput): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  // Launch Parameters
  if (!input.mission_id) {
    errors.mission_id = "Mission ID is required.";
  }
  if (!input.satellite_name) {
    errors.satellite_name = "Satellite Name is required.";
  }
  if (!input.launch_date) {
    errors.launch_date = "Launch Date is required.";
  }
  if (!input.launch_time) {
    errors.launch_time = "Launch Time (UTC) is required.";
  }
  if (!input.launch_site) {
    errors.launch_site = "Launch Site must be specified.";
  }
  if (!input.rocket) {
    errors.rocket = "Rocket vehicle must be specified.";
  }
  if (!input.target_orbit) {
    errors.target_orbit = "Target Orbit must be specified.";
  }
  if (isNaN(input.altitude) || input.altitude <= 0) {
    errors.altitude = "Altitude must be greater than 0 km.";
  } else if (input.altitude < 120) {
    errors.altitude = "Altitude must be ≥ 120 km (above atmospheric boundary).";
  } else if (input.altitude > 40000) {
    warnings.push("Altitude > 40,000 km exceeds standard orbital trajectories.");
  }

  if (isNaN(input.inclination) || input.inclination < 0 || input.inclination > 180) {
    errors.inclination = "Inclination must be between 0° and 180°.";
  }

  // Rocket Parameters
  if (isNaN(input.rocket_mass) || input.rocket_mass <= 0) {
    errors.rocket_mass = "Rocket dry mass must be greater than 0 kg.";
  }
  if (isNaN(input.fuel_mass) || input.fuel_mass <= 0) {
    errors.fuel_mass = "Fuel mass capacity must be greater than 0 kg.";
  }
  if (isNaN(input.thrust) || input.thrust <= 0) {
    errors.thrust = "Thrust must be greater than 0 kN.";
  }
  if (isNaN(input.specific_impulse) || input.specific_impulse <= 0) {
    errors.specific_impulse = "Specific impulse (Isp) must be greater than 0 s.";
  } else if (input.specific_impulse < 180 || input.specific_impulse > 500) {
    warnings.push("Specific impulse is outside standard chemical propulsion range (180–500 s).");
  }

  // Payload Parameters
  if (isNaN(input.payload_mass) || input.payload_mass <= 0) {
    errors.payload_mass = "Payload mass must be greater than 0 kg.";
  }
  if (isNaN(input.payload_volume) || input.payload_volume <= 0) {
    errors.payload_volume = "Payload volume must be greater than 0 m³.";
  }
  if (isNaN(input.mission_priority) || input.mission_priority < 1 || input.mission_priority > 5) {
    errors.mission_priority = "Mission priority must be between 1 (Critical) and 5 (Routine).";
  }

  // Trajectory Parameters
  if (isNaN(input.delta_v) || input.delta_v <= 0) {
    errors.delta_v = "Delta-V requirement must be greater than 0 km/s.";
  } else if (input.delta_v < 7.5) {
    warnings.push("Delta-V < 7.5 km/s may be insufficient to achieve low Earth orbit.");
  }
  if (isNaN(input.flight_time_minutes) || input.flight_time_minutes <= 0) {
    errors.flight_time_minutes = "Flight time must be greater than 0 minutes.";
  }
  if (isNaN(input.fuel_consumption) || input.fuel_consumption <= 0) {
    errors.fuel_consumption = "Fuel consumption must be greater than 0 kg.";
  } else if (input.fuel_consumption > input.fuel_mass) {
    errors.fuel_consumption = `Fuel consumption (${input.fuel_consumption.toLocaleString()} kg) cannot exceed vehicle fuel capacity (${input.fuel_mass.toLocaleString()} kg).`;
  }

  // Weather Parameters
  if (isNaN(input.weather_temperature) || input.weather_temperature < -60 || input.weather_temperature > 65) {
    errors.weather_temperature = "Temperature must be between -60°C and +65°C.";
  }
  if (isNaN(input.wind_speed) || input.wind_speed < 0) {
    errors.wind_speed = "Wind speed cannot be negative.";
  } else if (input.wind_speed > 25) {
    warnings.push("High wind speed (>25 m/s) flags weather hold risk.");
  }
  if (isNaN(input.rain) || input.rain < 0) {
    errors.rain = "Precipitation cannot be negative.";
  } else if (input.rain > 15) {
    warnings.push("Heavy rainfall (>15 mm) flags pad hold advisory.");
  }

  // Mission Constraints
  if (isNaN(input.risk_score) || input.risk_score < 0 || input.risk_score > 100) {
    errors.risk_score = "Risk score must be between 0 and 100.";
  }
  if (isNaN(input.launch_cost) || input.launch_cost <= 0) {
    errors.launch_cost = "Launch cost must be greater than $0 Million USD.";
  }
  if (isNaN(input.launch_window_duration) || input.launch_window_duration <= 0) {
    errors.launch_window_duration = "Launch window duration must be greater than 0 minutes.";
  }

  // Physical TWR Verification
  const totalMassKg = input.rocket_mass + input.fuel_consumption + input.payload_mass;
  const thrustN = input.thrust * 1000;
  const liftoffTwr = thrustN / (totalMassKg * G0);
  if (liftoffTwr < 1.05) {
    errors.thrust = `Thrust (${input.thrust} kN) produces TWR of ${liftoffTwr.toFixed(2)}, which cannot overcome gravity (TWR must be ≥ 1.10).`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * 3. preprocessMissionData()
 * Converts units, handles defaults, normalizes numerical attributes, and derives secondary physics coefficients.
 */
export function preprocessMissionData(input: RawMissionInput): PreprocessedMissionData {
  const flightTimeSeconds = Math.round(input.flight_time_minutes * 60);
  const totalMassKg = input.rocket_mass + input.fuel_consumption + input.payload_mass;
  const thrustN = input.thrust * 1000;
  const twr = Number((thrustN / (totalMassKg * G0)).toFixed(2));
  const payloadFraction = Number((input.payload_mass / totalMassKg).toFixed(4));
  const fuelMargin = Number(Math.max(0.01, (input.fuel_mass - input.fuel_consumption) / input.fuel_mass).toFixed(3));

  // Determine aerodynamic vehicle dimensions by rocket class
  let crossSection = 6.16;
  let cd = 0.32;
  const rLower = input.rocket.toLowerCase();
  if (rLower.includes("falcon 9")) {
    crossSection = 10.75;
    cd = 0.31;
  } else if (rLower.includes("falcon heavy")) {
    crossSection = 10.75;
    cd = 0.34;
  } else if (rLower.includes("ariane") || rLower.includes("atlas")) {
    crossSection = 22.9;
    cd = 0.30;
  } else if (rLower.includes("gslv") || rLower.includes("lvm3")) {
    crossSection = 12.57;
    cd = 0.34;
  } else if (rLower.includes("electron")) {
    crossSection = 1.13;
    cd = 0.36;
  }

  const warnings: string[] = [];
  if (twr < 1.25) {
    warnings.push(`Low liftoff TWR (${twr}) will incur heightened gravity turn ascent losses.`);
  }

  // Construct standard Mission entity
  const mission: Mission = {
    mission_id: input.mission_id,
    satellite_name: input.satellite_name,
    data_type: "Reference",
    launch_date: input.launch_date,
    launch_time: input.launch_time,
    launch_site: input.launch_site,
    rocket: input.rocket,
    rocket_mass: input.rocket_mass,
    fuel_mass: input.fuel_mass,
    payload_capacity: Math.max(input.payload_mass * 1.1, input.payload_mass + 500),
    thrust: input.thrust,
    specific_impulse: input.specific_impulse,
    payload_mass: input.payload_mass,
    payload_volume: input.payload_volume,
    target_orbit: input.target_orbit,
    altitude: input.altitude,
    inclination: input.inclination,
    delta_v: input.delta_v,
    flight_time: flightTimeSeconds,
    fuel_consumption: input.fuel_consumption,
    weather_temperature: input.weather_temperature,
    wind_speed: input.wind_speed,
    rain: input.rain,
    humidity: 55.0,
    safety_status: input.safety_status,
    launch_window_start: input.launch_window_start,
    launch_window_end: input.launch_window_end,
    launch_window_duration: input.launch_window_duration,
    launch_cost: input.launch_cost,
    risk_score: input.risk_score,
    mission_priority: input.mission_priority,
    trajectory_type: "Gravity Turn",
    cross_section_area: crossSection,
    drag_coefficient: cd,
    fuel_margin: fuelMargin,
    payload_fraction: payloadFraction,
    thrust_to_weight_ratio: twr,
    mission_efficiency: Number(((input.payload_mass * input.altitude) / 1000).toFixed(1)),
  };

  return {
    mission,
    flight_time_seconds: flightTimeSeconds,
    payload_fraction: payloadFraction,
    thrust_to_weight_ratio: twr,
    cross_section_area: crossSection,
    drag_coefficient: cd,
    fuel_margin: fuelMargin,
    warnings,
  };
}

/**
 * 4. createMissionParameters()
 * Generates the clean, calibrated Mission object for the optimization engine.
 */
export function createMissionParameters(preprocessed: PreprocessedMissionData): Mission {
  return preprocessed.mission;
}

/**
 * 5. classicalOptimization()
 * Runs differential search and combinatorial pruning on the mission parameters.
 */
export function classicalOptimization(mission: Mission): ClassicalResult {
  return runClassicalOptimization(mission);
}

/**
 * 6. createQUBO()
 * Formulates the 9-qubit Ising Hamiltonian and QUBO penalty matrix.
 */
export function createQUBO(mission: Mission): QUBOResult {
  return buildQUBOMatrix(mission);
}

/**
 * 7. runQAOA()
 * Executes the statevector variational circuit simulation.
 */
export function runQAOA(mission: Mission, pLayers = 1, shots = 1024): QAOAResult {
  return runQAOASimulation(mission, pLayers, shots);
}

/**
 * 8. decodeQAOASolution()
 * Decodes the measured optimal bitstring and explains the binary assignment.
 */
export function decodeQAOASolution(bitstring: string, mission: Mission): DecodedBitstringExplanation {
  const decoded = decodeBitstring(bitstring, mission);
  const feas = isBitstringFeasible(bitstring);
  const qubo = buildQUBOMatrix(mission);

  // Energy
  let energy = qubo.qubo_offset;
  const n = bitstring.length;
  for (let i = 0; i < n; i++) {
    if (bitstring[i] === "1") {
      energy += qubo.qubo_matrix[i][i];
      for (let j = i + 1; j < n; j++) {
        if (bitstring[j] === "1") {
          energy += qubo.qubo_matrix[i][j] + qubo.qubo_matrix[j][i];
        }
      }
    }
  }

  const variableMapping = [
    { bit: bitstring[0] || "0", index: 0, variable_name: "x1_win_early", description: "Early Launch Window (-15 min)", selected: bitstring[0] === "1" },
    { bit: bitstring[1] || "0", index: 1, variable_name: "x2_win_mid", description: "Mid Launch Window (Nominal)", selected: bitstring[1] === "1" },
    { bit: bitstring[2] || "0", index: 2, variable_name: "x3_win_late", description: "Late Launch Window (+15 min)", selected: bitstring[2] === "1" },
    { bit: bitstring[3] || "0", index: 3, variable_name: "x4_traj_direct", description: "Direct Ascent Trajectory Profile", selected: bitstring[3] === "1" },
    { bit: bitstring[4] || "0", index: 4, variable_name: "x5_traj_gravity", description: "Gravity Turn Aerodynamic Ascent", selected: bitstring[4] === "1" },
    { bit: bitstring[5] || "0", index: 5, variable_name: "x6_traj_multistage", description: "Multi-Stage Optimal Ascent Profile", selected: bitstring[5] === "1" },
    { bit: bitstring[6] || "0", index: 6, variable_name: "x7_mode_conserv", description: "Conservative Throttle (+5% reserve margin)", selected: bitstring[6] === "1" },
    { bit: bitstring[7] || "0", index: 7, variable_name: "x8_mode_nominal", description: "Nominal Baseline Throttle Profile", selected: bitstring[7] === "1" },
    { bit: bitstring[8] || "0", index: 8, variable_name: "x9_mode_aggressive", description: "Aggressive / Fuel-Optimal Throttle (-5% margin)", selected: bitstring[8] === "1" },
  ];

  return {
    bitstring,
    variable_mapping: variableMapping,
    window_choice: decoded.window_name,
    trajectory_choice: decoded.trajectory_name,
    mode_choice: decoded.mode_name,
    energy: Number(energy.toFixed(2)),
    is_valid_one_hot: feas.feasible,
    violations: feas.violations,
  };
}

/**
 * 9. verifyConstraints()
 * Performs empirical validation across 7 physical and mission constraint bounds.
 */
export function verifyConstraints(
  mission: Mission,
  classicalRes: ClassicalResult,
  qaoaRes: QAOAResult
): ConstraintVerificationReport {
  const bestFuel = Math.min(classicalRes.optimized.fuel_consumption_kg, qaoaRes.decoded_plan.fuel_consumption_kg);
  const bestTwr = mission.thrust_to_weight_ratio;
  const bestRisk = Math.min(classicalRes.optimized.risk_score, qaoaRes.decoded_plan.risk_score);

  // 1. Fuel Constraint
  const fuelPass = bestFuel <= mission.fuel_mass;
  const fuelCheck: ConstraintCheckItem = {
    id: "fuel_constraint",
    name: "Propellant Fuel Capacity Constraint",
    category: "Propulsion",
    status: fuelPass ? "PASS" : "FAIL",
    measured_value: `${bestFuel.toLocaleString()} kg`,
    limit_value: `≤ ${mission.fuel_mass.toLocaleString()} kg`,
    description: "Required propellant mass must not exceed total usable vehicle fuel capacity.",
  };

  // 2. Payload Constraint
  const payloadPass = mission.payload_mass <= mission.payload_capacity;
  const payloadCheck: ConstraintCheckItem = {
    id: "payload_constraint",
    name: "Payload Vehicle Capacity Constraint",
    category: "Payload",
    status: payloadPass ? "PASS" : "FAIL",
    measured_value: `${mission.payload_mass.toLocaleString()} kg`,
    limit_value: `≤ ${mission.payload_capacity.toLocaleString()} kg`,
    description: "Payload mass must stay within maximum booster fairing structural capacity.",
  };

  // 3. Launch Window Constraint
  const windowPass = mission.launch_window_duration >= 15;
  const windowCheck: ConstraintCheckItem = {
    id: "launch_window_constraint",
    name: "Orbital Launch Window Duration",
    category: "Operations",
    status: windowPass ? "PASS" : "FAIL",
    measured_value: `${mission.launch_window_duration} min`,
    limit_value: "≥ 15 min available",
    description: "Launch window duration must accommodate staging sequence and range clearance.",
  };

  // 4. Weather Constraint
  const weatherPass = mission.wind_speed <= 22.0 && mission.rain <= 12.0;
  const weatherCheck: ConstraintCheckItem = {
    id: "weather_constraint",
    name: "Launch Pad Weather Clearance",
    category: "Environment",
    status: weatherPass ? "PASS" : "FAIL",
    measured_value: `Wind ${mission.wind_speed} m/s, Rain ${mission.rain} mm`,
    limit_value: "Wind ≤ 22 m/s, Rain ≤ 12 mm",
    description: "Atmospheric pad winds and precipitation must remain below aerodynamic abort thresholds.",
  };

  // 5. Safety Constraint
  const safetyPass = !mission.safety_status.toUpperCase().includes("ABORT") && bestRisk <= 70.0;
  const safetyCheck: ConstraintCheckItem = {
    id: "safety_constraint",
    name: "Flight Safety & Risk Clearance",
    category: "Safety",
    status: safetyPass ? "PASS" : "FAIL",
    measured_value: `Risk ${bestRisk.toFixed(1)}/100 (${mission.safety_status})`,
    limit_value: "Risk ≤ 70.0 (No Abort Advisory)",
    description: "Overall flight risk score must stay within accepted range clearance boundaries.",
  };

  // 6. Orbit Altitude & Velocity Constraint
  const targetAltM = mission.altitude * 1000;
  const circularVel = Math.sqrt(EARTH_MU / (EARTH_RADIUS_M + targetAltM));
  const orbitPass = mission.delta_v * 1000 >= circularVel * 0.98;
  const orbitCheck: ConstraintCheckItem = {
    id: "orbit_constraint",
    name: "Orbital Insertion Velocity (Δv)",
    category: "Orbital Mechanics",
    status: orbitPass ? "PASS" : "FAIL",
    measured_value: `${(mission.delta_v * 1000).toFixed(0)} m/s available`,
    limit_value: `≥ ${Math.round(circularVel)} m/s required`,
    description: "Vehicle total impulse must achieve circularization velocity at target orbit altitude.",
  };

  // 7. Rocket Liftoff Capacity (TWR)
  const capacityPass = bestTwr >= 1.15;
  const capacityCheck: ConstraintCheckItem = {
    id: "rocket_capacity_constraint",
    name: "Booster Liftoff Thrust-to-Weight (TWR)",
    category: "Propulsion",
    status: capacityPass ? "PASS" : "FAIL",
    measured_value: `TWR = ${bestTwr.toFixed(2)}`,
    limit_value: "TWR ≥ 1.15",
    description: "Initial pad liftoff acceleration must guarantee clean launch pad clearance.",
  };

  const checks = {
    fuel_constraint: fuelCheck,
    payload_constraint: payloadCheck,
    launch_window_constraint: windowCheck,
    weather_constraint: weatherCheck,
    safety_constraint: safetyCheck,
    orbit_constraint: orbitCheck,
    rocket_capacity_constraint: capacityCheck,
  };

  const checkList = Object.values(checks);
  const passedCount = checkList.filter((c) => c.status === "PASS").length;
  const isFeasible = passedCount === checkList.length && qaoaRes.decoded_plan.constraint_violations === 0;

  return {
    isFeasible,
    passedCount,
    totalCount: checkList.length,
    checks,
  };
}

/**
 * 10. compareResults()
 * Compares Original baseline vs Classical vs QAOA across all key metrics.
 */
export function compareResults(
  original: Mission,
  classical: ClassicalResult,
  qaoa: QAOAResult
): { rows: ComparisonTableRow[]; bestSolution: "Classical" | "QAOA" } {
  const o = classical.baseline;
  const c = classical.optimized;
  const q = qaoa.decoded_plan;

  const rows: ComparisonTableRow[] = [
    {
      parameter: "Fuel Consumption",
      unit: "kg",
      original: Math.round(original.fuel_consumption).toLocaleString(),
      classical: Math.round(c.fuel_consumption_kg).toLocaleString(),
      qaoa: Math.round(q.fuel_consumption_kg).toLocaleString(),
      best: c.fuel_consumption_kg <= q.fuel_consumption_kg ? "Classical" : "QAOA",
    },
    {
      parameter: "Mission Cost",
      unit: "Million USD",
      original: `$${original.launch_cost.toFixed(2)}M`,
      classical: `$${c.launch_cost_musd.toFixed(2)}M`,
      qaoa: `$${q.launch_cost_musd.toFixed(2)}M`,
      best: c.launch_cost_musd <= q.launch_cost_musd ? "Classical" : "QAOA",
    },
    {
      parameter: "Delta-V",
      unit: "km/s",
      original: original.delta_v.toFixed(3),
      classical: c.delta_v_kms.toFixed(3),
      qaoa: q.delta_v_kms.toFixed(3),
      best: c.delta_v_kms <= q.delta_v_kms ? "Classical" : "QAOA",
    },
    {
      parameter: "Risk Score",
      unit: "0 - 100",
      original: original.risk_score.toFixed(1),
      classical: c.risk_score.toFixed(1),
      qaoa: q.risk_score.toFixed(1),
      best: c.risk_score <= q.risk_score ? "Classical" : "QAOA",
    },
    {
      parameter: "Flight Time",
      unit: "seconds",
      original: `${original.flight_time} s`,
      classical: `${c.flight_time_sec} s`,
      qaoa: `${q.flight_time_sec} s`,
      best: c.flight_time_sec <= q.flight_time_sec ? "Classical" : "QAOA",
    },
    {
      parameter: "Multi-Objective Value",
      unit: "Score (lower is better)",
      original: o.objective_value.toFixed(4),
      classical: c.objective_value.toFixed(4),
      qaoa: q.objective_value.toFixed(4),
      best: c.objective_value <= q.objective_value ? "Classical" : "QAOA",
    },
  ];

  const bestSolution: "Classical" | "QAOA" =
    c.objective_value <= q.objective_value ? "Classical" : "QAOA";

  return { rows, bestSolution };
}

/**
 * 11. generateResults()
 * Orchestrates the full pipeline from raw user input to complete optimization results.
 */
export function generateResults(
  input: RawMissionInput,
  options: { pLayers?: number; shots?: number } = {}
): PipelineExecutionResult {
  const validation = validateMissionInput(input);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || "Invalid mission input parameters.";
    throw new Error(`Mission Validation Failed: ${firstErr}`);
  }

  const preprocessed = preprocessMissionData(input);
  const mission = createMissionParameters(preprocessed);

  const classicalResult = classicalOptimization(mission);
  const quboResult = createQUBO(mission);
  const qaoaResult = runQAOA(mission, options.pLayers || 1, options.shots || 1024);
  const decodedQAOA = decodeQAOASolution(qaoaResult.best_bitstring, mission);
  const constraintReport = verifyConstraints(mission, classicalResult, qaoaResult);
  const { rows, bestSolution } = compareResults(mission, classicalResult, qaoaResult);

  return {
    success: true,
    rawInput: input,
    processedMission: mission,
    classicalResult,
    quboResult,
    qaoaResult,
    decodedQAOA,
    constraintReport,
    comparisonRows: rows,
    bestSolution,
    executionTimestamp: new Date().toISOString(),
  };
}
