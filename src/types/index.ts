export interface Mission {
  mission_id: string;
  satellite_name: string;
  data_type: "Reference" | "Synthetic";
  launch_date: string;
  launch_time: string;
  launch_site: string;
  rocket: string;
  rocket_mass: number;
  fuel_mass: number;
  payload_capacity: number;
  thrust: number;
  specific_impulse: number;
  payload_mass: number;
  payload_volume: number;
  target_orbit: string;
  altitude: number;
  inclination: number;
  delta_v: number;
  flight_time: number;
  fuel_consumption: number;
  weather_temperature: number;
  wind_speed: number;
  rain: number;
  humidity: number;
  safety_status: string;
  launch_window_start: string;
  launch_window_end: string;
  launch_window_duration: number;
  launch_cost: number;
  risk_score: number;
  mission_priority: number;
  trajectory_type: string;
  cross_section_area: number;
  drag_coefficient: number;
  fuel_margin: number;
  payload_fraction: number;
  thrust_to_weight_ratio: number;
  mission_efficiency: number;
}

export interface TrajectoryData {
  time: number[];
  altitude_km: number[];
  velocity_ms: number[];
  acceleration_ms2: number[];
  accel_g: number[];
  mass_kg: number[];
  fuel_remaining_kg: number[];
  thrust_kN: number[];
  drag_kN: number[];
  dynamic_pressure_kPa: number[];
  flight_path_angle_deg: number[];
  downrange_km: number[];
  summary: {
    max_altitude_km: number;
    final_velocity_ms: number;
    max_acceleration_g: number;
    max_dynamic_pressure_kPa: number;
    burn_time_sec: number;
    final_mass_kg: number;
  };
}

export interface ClassicalResult {
  algorithm: string;
  iterations: number;
  execution_time_ms: number;
  baseline: {
    objective_value: number;
    fuel_consumption_kg: number;
    launch_cost_musd: number;
    risk_score: number;
    delta_v_kms: number;
    flight_time_sec: number;
    constraint_violations: number;
  };
  optimized: {
    fuel_consumption_kg: number;
    delta_v_kms: number;
    launch_cost_musd: number;
    risk_score: number;
    flight_time_sec: number;
    constraint_violations: number;
    violation_details: string[];
    objective_value: number;
  };
  selected_configuration: {
    window_index: number;
    window_name: string;
    window_offset_min: number;
    trajectory_index: number;
    trajectory_name: string;
    mode_index: number;
    mode_name: string;
  };
  objective_improvement_pct: number;
}

export interface QUBOResult {
  num_qubits: number;
  variables: string[];
  qubo_matrix: number[][];
  qubo_offset: number;
  ising_h: number[];
  ising_J: number[][];
  ising_offset: number;
  penalty_parameters: {
    penalty_window: number;
    penalty_trajectory: number;
    penalty_mode: number;
    penalty_risk: number;
  };
}

export interface QAOAResult {
  algorithm: string;
  execution_time_ms: number;
  circuit_summary: {
    num_qubits: number;
    layers_p: number;
    gamma_parameters: number[];
    beta_parameters: number[];
    gate_counts: {
      hadamard: number;
      rz_rotations: number;
      cnot_entanglers: number;
      rx_mixers: number;
      measurements: number;
    };
    circuit_depth?: number;
    two_qubit_gate_depth?: number;
    estimated_duration_us?: number;
  };
  best_bitstring: string;
  best_candidate: {
    bitstring: string;
    shots: number;
    probability: number;
    qubo_energy: number;
    is_feasible: boolean;
    violations: string[];
  };
  top_bitstrings: Array<{
    bitstring: string;
    shots: number;
    probability: number;
    qubo_energy: number;
    is_feasible: boolean;
    violations: string[];
  }>;
  decoded_plan: {
    bitstring: string;
    is_feasible: boolean;
    constraint_violations: number;
    violation_details: string[];
    window_name: string;
    window_offset_min: number;
    trajectory_name: string;
    mode_name: string;
    fuel_consumption_kg: number;
    delta_v_kms: number;
    launch_cost_musd: number;
    risk_score: number;
    flight_time_sec: number;
    objective_value: number;
  };
  convergence_history?: QAOAConvergenceStep[];
}

export interface QAOAConvergenceStep {
  step: number;
  cost_energy: number;
  best_energy: number;
  gamma: number;
  beta: number;
  variance: number;
  feasible_prob: number;
  noisy_cost_energy?: number;
  noisy_best_energy?: number;
  noisy_feasible_prob?: number;
  decoherence_loss?: number;
}

export type NoisePreset = "ideal" | "trapped_ion" | "superconducting" | "high_decoherence" | "custom";

export interface MeasuredEigenstate {
  state_index: number;
  bitstring: string;
  qubo_energy: number;
  probability: number;
  measured_shots: number;
  is_feasible: boolean;
  violations: string[];
  window_name: string;
  trajectory_name: string;
  mode_name: string;
  is_ground_state: boolean;
  rank: number;
}

export interface QuantumFidelityStatistics {
  ground_state_fidelity: number;
  ground_state_bitstring: string;
  ground_state_energy: number;
  first_excited_energy: number;
  energy_spectral_gap: number;
  ground_vs_excited_ratio: number;
  feasible_mass_pct: number;
  infeasible_mass_pct: number;
  shannon_entropy: number;
  max_entropy: number;
  normalized_entropy_pct: number;
  effective_dimension: number;
  confidence_score: number;
  confidence_tier: "High Confidence" | "Moderate Confidence" | "Low Confidence";
  confidence_summary: string;
  z_score_vs_uniform: number;
  decoherence_loss_pct: number;
  circuit_fidelity: number;
  total_shots: number;
  layers_p: number;
}

export interface QAOAFidelityAnalysis {
  eigenstates: MeasuredEigenstate[];
  statistics: QuantumFidelityStatistics;
}

export interface QuantumNoiseConfig {
  enabled: boolean;
  preset: NoisePreset;
  twoQubitGateError: number; // e.g. 0.015 = 1.5% CNOT gate error
  singleQubitGateError: number; // e.g. 0.002 = 0.2% single-qubit gate error
  dephasingTimeT2Us: number; // T2 in microseconds (e.g. 60 us)
  relaxationTimeT1Us: number; // T1 in microseconds (e.g. 80 us)
  readoutError: number; // e.g. 0.02 = 2.0% measurement readout error
}

export interface ComparisonRow {
  metric: string;
  unit: string;
  baseline: number | string;
  classical: number | string;
  quantum: number | string;
  best_performer: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  mission_id: string;
  satellite_name: string;
  rocket: string;
  target_orbit: string;
  altitude: number;
  payload_mass: number;
  selected_window: string;
  selected_trajectory: string;
  selected_mode: string;
  classical_objective: number;
  quantum_objective: number;
  best_bitstring: string;
  fuel_consumption_kg: number;
  fuel_saved_kg: number;
  launch_cost_musd: number;
  risk_score: number;
  mission: Mission;
  notes?: string;
  notes_updated_at?: string;
  tags?: string[];
}

export interface MissionInputFormData {
  mission_id: string;
  satellite_name: string;
  launch_date: string;
  launch_time: string;
  launch_site: string;
  rocket: string;
  target_orbit: string;
  altitude: number;
  inclination: number;
  rocket_mass: number;
  fuel_mass: number;
  thrust: number;
  specific_impulse: number;
  payload_mass: number;
  payload_volume: number;
  mission_priority: number;
  delta_v: number;
  flight_time: number; // in minutes
  fuel_consumption: number;
  weather_temperature: number;
  wind_speed: number;
  rain: number;
  weather_condition: string;
  safety_status: string;
  risk_score: number;
  launch_cost: number;
  available_launch_window: string;
  window_duration: number; // in minutes
}

export interface ConstraintCheckResult {
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  margin: string;
}

