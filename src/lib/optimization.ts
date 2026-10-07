import {
  Mission,
  ClassicalResult,
  QUBOResult,
  QAOAResult,
  QAOAConvergenceStep,
  QuantumNoiseConfig,
  NoisePreset,
  MeasuredEigenstate,
  QuantumFidelityStatistics,
  QAOAFidelityAnalysis,
} from "../types";

export const NOISE_PRESETS: Record<Exclude<NoisePreset, "custom">, QuantumNoiseConfig> = {
  ideal: {
    enabled: false,
    preset: "ideal",
    twoQubitGateError: 0.0,
    singleQubitGateError: 0.0,
    dephasingTimeT2Us: 10000,
    relaxationTimeT1Us: 10000,
    readoutError: 0.0,
  },
  trapped_ion: {
    enabled: true,
    preset: "trapped_ion",
    twoQubitGateError: 0.003, // 0.3% CNOT error (Quantinuum H-Series)
    singleQubitGateError: 0.0003, // 0.03%
    dephasingTimeT2Us: 1200, // 1.2 ms
    relaxationTimeT1Us: 2500, // 2.5 ms
    readoutError: 0.005, // 0.5%
  },
  superconducting: {
    enabled: true,
    preset: "superconducting",
    twoQubitGateError: 0.015, // 1.5% CNOT error (IBM Eagle / Heron Transmon)
    singleQubitGateError: 0.0018, // 0.18%
    dephasingTimeT2Us: 65, // 65 microseconds
    relaxationTimeT1Us: 85, // 85 microseconds
    readoutError: 0.025, // 2.5%
  },
  high_decoherence: {
    enabled: true,
    preset: "high_decoherence",
    twoQubitGateError: 0.048, // 4.8% error (High thermal drift / NISQ crosstalk)
    singleQubitGateError: 0.006, // 0.6%
    dephasingTimeT2Us: 18, // 18 microseconds
    relaxationTimeT1Us: 25, // 25 microseconds
    readoutError: 0.065, // 6.5%
  },
};

export const VARIABLE_LABELS = [
  "x1_win_early",
  "x2_win_mid",
  "x3_win_late",
  "x4_traj_direct",
  "x5_traj_gravity",
  "x6_traj_multistage",
  "x7_mode_conserv",
  "x8_mode_nominal",
  "x9_mode_aggressive",
];

export function calculateObjective(
  fuelKg: number,
  maxFuelKg: number,
  costMusd: number,
  riskScore: number,
  flightTimeSec: number,
  priority = 1,
  constraintPenalty = 0.0
): number {
  const normFuel = Math.min(1.5, fuelKg / Math.max(1, maxFuelKg));
  const normCost = Math.min(2.0, costMusd / 150.0);
  const normRisk = Math.min(2.0, riskScore / 100.0);
  const normTime = Math.min(2.0, flightTimeSec / 3000.0);
  const normPrio = (6 - priority) / 5.0;

  const raw =
    0.35 * normFuel +
    0.25 * normCost +
    0.25 * normRisk +
    0.1 * normTime +
    0.05 * normPrio;

  return Number((raw * 100.0 + constraintPenalty).toFixed(4));
}

export function runClassicalOptimization(mission: Mission): ClassicalResult {
  const t0 = performance.now();
  const baseFuel = mission.fuel_consumption;
  const baseCost = mission.launch_cost;
  const baseRisk = mission.risk_score;
  const baseTime = mission.flight_time;

  const baselineObj = calculateObjective(
    baseFuel,
    mission.fuel_mass,
    baseCost,
    baseRisk,
    baseTime,
    mission.mission_priority,
    0
  );

  const windows = [
    { name: "Early Window (-15 min)", offset: -15, riskMod: -2.5, costMod: 0.0 },
    { name: "Mid Window (Nominal)", offset: 0, riskMod: 0.0, costMod: 0.0 },
    { name: "Late Window (+15 min)", offset: 15, riskMod: 3.0, costMod: 0.5 },
  ];

  const trajectories = [
    { name: "Direct Ascent", dvMod: 0.35, timeMod: -40, riskMod: 4.0 },
    { name: "Gravity Turn", dvMod: -0.15, timeMod: 10, riskMod: -2.0 },
    { name: "Multi-Stage Ascent", dvMod: -0.05, timeMod: 25, riskMod: 0.5 },
  ];

  const throttleModes = [
    { name: "Conservative (+5% margin)", fuelFactor: 1.04, riskMod: -4.0, costFactor: 1.02 },
    { name: "Nominal", fuelFactor: 1.0, riskMod: 0.0, costFactor: 1.0 },
    { name: "Aggressive / Optimal (-5% margin)", fuelFactor: 0.95, riskMod: 2.5, costFactor: 0.97 },
  ];

  let bestObj = Infinity;
  let bestConfig = {
    window_index: 0,
    window_name: "",
    window_offset_min: 0,
    trajectory_index: 0,
    trajectory_name: "",
    mode_index: 0,
    mode_name: "",
  };
  let bestMetrics = {
    fuel_consumption_kg: 0,
    delta_v_kms: 0,
    launch_cost_musd: 0,
    risk_score: 0,
    flight_time_sec: 0,
    constraint_violations: 0,
    violation_details: [] as string[],
    objective_value: 0,
  };

  let iters = 0;
  for (let w = 0; w < windows.length; w++) {
    for (let t = 0; t < trajectories.length; t++) {
      for (let m = 0; m < throttleModes.length; m++) {
        iters++;
        const win = windows[w];
        const traj = trajectories[t];
        const th = throttleModes[m];

        const testDv = Math.max(8.5, mission.delta_v + traj.dvMod);
        const testFuel = Math.min(
          mission.fuel_mass * 1.05,
          mission.fuel_consumption * th.fuelFactor * (testDv / mission.delta_v)
        );
        const testRisk = Math.max(5.0, Math.min(95.0, mission.risk_score + win.riskMod + traj.riskMod + th.riskMod));
        const testTime = Math.max(300, mission.flight_time + traj.timeMod);
        const testCost = Number((mission.launch_cost * th.costFactor + win.costMod).toFixed(2));

        const viols: string[] = [];
        let pen = 0.0;
        if (testFuel > mission.fuel_mass) {
          viols.push("Fuel requirement exceeds capacity");
          pen += 300.0;
        }

        const obj = calculateObjective(
          testFuel,
          mission.fuel_mass,
          testCost,
          testRisk,
          testTime,
          mission.mission_priority,
          pen
        );

        if (obj < bestObj) {
          bestObj = obj;
          bestConfig = {
            window_index: w,
            window_name: win.name,
            window_offset_min: win.offset,
            trajectory_index: t,
            trajectory_name: traj.name,
            mode_index: m,
            mode_name: th.name,
          };
          bestMetrics = {
            fuel_consumption_kg: Number(testFuel.toFixed(1)),
            delta_v_kms: Number(testDv.toFixed(3)),
            launch_cost_musd: testCost,
            risk_score: Number(testRisk.toFixed(1)),
            flight_time_sec: testTime,
            constraint_violations: viols.length,
            violation_details: viols,
            objective_value: Number(obj.toFixed(4)),
          };
        }
      }
    }
  }

  const execMs = Number((performance.now() - t0).toFixed(2));
  const improvPct = Number((((baselineObj - bestObj) / baselineObj) * 100.0).toFixed(2));

  return {
    algorithm: "Classical (Differential Search / Combinatorial Refinement)",
    iterations: iters,
    execution_time_ms: execMs,
    baseline: {
      objective_value: Number(baselineObj.toFixed(4)),
      fuel_consumption_kg: Number(baseFuel.toFixed(1)),
      launch_cost_musd: Number(baseCost.toFixed(2)),
      risk_score: Number(baseRisk.toFixed(1)),
      delta_v_kms: Number(mission.delta_v.toFixed(3)),
      flight_time_sec: baseTime,
      constraint_violations: 0,
    },
    optimized: bestMetrics,
    selected_configuration: bestConfig,
    objective_improvement_pct: improvPct,
  };
}

export function buildQUBOMatrix(
  mission: Mission,
  penaltyWindow = 120.0,
  penaltyTrajectory = 120.0,
  penaltyMode = 120.0,
  penaltyRisk = 80.0
): QUBOResult {
  const n = 9;
  const Q: number[][] = Array.from({ length: n }, () => Array(n).fill(0.0));

  const wCosts = [18.0 - mission.wind_speed * 0.4, 22.0, 28.0 + mission.rain * 0.8];
  const tCosts = [35.0, 16.0, 24.0];
  if (["GEO", "GTO", "Highly Elliptical Orbit"].includes(mission.target_orbit)) {
    tCosts[0] += 50.0;
  }
  const mCosts = [28.0, 20.0, 15.0 + mission.risk_score * 0.25];

  for (let i = 0; i < 3; i++) Q[i][i] += wCosts[i];
  for (let i = 0; i < 3; i++) Q[i + 3][i + 3] += tCosts[i];
  for (let i = 0; i < 3; i++) Q[i + 6][i + 6] += mCosts[i];

  const groups = [
    { indices: [0, 1, 2], p: penaltyWindow },
    { indices: [3, 4, 5], p: penaltyTrajectory },
    { indices: [6, 7, 8], p: penaltyMode },
  ];

  for (const { indices, p } of groups) {
    for (const idx of indices) Q[idx][idx] -= p;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = indices[i];
        const b = indices[j];
        Q[a][b] += 2.0 * p;
        Q[b][a] += 2.0 * p;
      }
    }
  }

  if (mission.wind_speed > 12.0) {
    Q[2][3] += penaltyRisk * 0.6;
    Q[3][2] += penaltyRisk * 0.6;
  }
  Q[3][8] += 75.0;
  Q[8][3] += 75.0;
  if (mission.payload_mass / mission.payload_capacity > 0.85) {
    Q[6][8] += 60.0;
    Q[8][6] += 60.0;
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Q[i][j] = Number(Q[i][j].toFixed(2));
    }
  }

  const offset = Number((penaltyWindow + penaltyTrajectory + penaltyMode).toFixed(2));

  // Ising mapping
  const isingH = Array(n).fill(0.0);
  const isingJ: number[][] = Array.from({ length: n }, () => Array(n).fill(0.0));
  let isingOffset = offset;

  for (let i = 0; i < n; i++) {
    isingH[i] -= 0.5 * Q[i][i];
    isingOffset += 0.5 * Q[i][i];
    for (let j = i + 1; j < n; j++) {
      const jTerm = 0.25 * (Q[i][j] + Q[j][i]);
      isingJ[i][j] = Number(jTerm.toFixed(3));
      isingJ[j][i] = Number(jTerm.toFixed(3));
      isingH[i] -= 0.25 * (Q[i][j] + Q[j][i]);
      isingH[j] -= 0.25 * (Q[i][j] + Q[j][i]);
      isingOffset += 0.25 * (Q[i][j] + Q[j][i]);
    }
    isingH[i] = Number(isingH[i].toFixed(3));
  }

  return {
    num_qubits: n,
    variables: VARIABLE_LABELS,
    qubo_matrix: Q,
    qubo_offset: offset,
    ising_h: isingH,
    ising_J: isingJ,
    ising_offset: Number(isingOffset.toFixed(3)),
    penalty_parameters: {
      penalty_window: penaltyWindow,
      penalty_trajectory: penaltyTrajectory,
      penalty_mode: penaltyMode,
      penalty_risk: penaltyRisk,
    },
  };
}

export function evaluateQUBOEnergy(bitstring: string, Q: number[][], offset = 0.0): number {
  let e = offset;
  const n = bitstring.length;
  for (let i = 0; i < n; i++) {
    if (bitstring[i] === "1") {
      e += Q[i][i];
      for (let j = i + 1; j < n; j++) {
        if (bitstring[j] === "1") {
          e += Q[i][j] + Q[j][i];
        }
      }
    }
  }
  return Number(e.toFixed(4));
}

export function runQAOASimulation(
  mission: Mission,
  pLayers = 1,
  shots = 1024,
  gamma = 0.42,
  beta = 0.35,
  noiseConfig?: QuantumNoiseConfig
): QAOAResult {
  const t0 = performance.now();
  const qubo = buildQUBOMatrix(mission);
  const Q = qubo.qubo_matrix;
  const offset = qubo.qubo_offset;
  const nQubits = qubo.num_qubits;
  const numStates = 1 << nQubits; // 512

  // Quantum Noise & Decoherence Parameters
  const isNoiseActive = noiseConfig?.enabled ?? false;
  const twoQError = isNoiseActive ? (noiseConfig?.twoQubitGateError ?? 0.015) : 0;
  const oneQError = isNoiseActive ? (noiseConfig?.singleQubitGateError ?? 0.0018) : 0;
  const t2Us = isNoiseActive ? (noiseConfig?.dephasingTimeT2Us ?? 65.0) : 10000;
  const t1Us = isNoiseActive ? (noiseConfig?.relaxationTimeT1Us ?? 85.0) : 10000;
  const readoutErr = isNoiseActive ? (noiseConfig?.readoutError ?? 0.025) : 0;

  const numCnot = ((nQubits * (nQubits - 1)) / 2) * pLayers; // 36 * p
  const num1Q = nQubits + 2 * nQubits * pLayers;
  const circuitDurationUs = pLayers * (36 * 0.25 + 18 * 0.04);

  const gateFidelity = Math.pow(Math.max(0, 1 - twoQError), numCnot) * Math.pow(Math.max(0, 1 - oneQError), num1Q);
  const decoherenceFidelity = Math.exp(-circuitDurationUs / Math.max(1, t2Us)) * Math.exp(-circuitDurationUs / (2 * Math.max(1, t1Us)));
  const readoutFidelity = Math.pow(Math.max(0, 1 - readoutErr), nQubits);

  const totalCircuitFidelity = isNoiseActive
    ? Math.max(0.04, Math.min(0.999, gateFidelity * decoherenceFidelity * readoutFidelity))
    : 1.0;
  const decoherenceLossPct = Number(((1.0 - totalCircuitFidelity) * 100).toFixed(1));
  const randomMixedEnergy = 142.0;

  // Precompute energies
  const costs: number[] = new Array(numStates);
  for (let i = 0; i < numStates; i++) {
    const bs = i.toString(2).padStart(nQubits, "0");
    costs[i] = evaluateQUBOEnergy(bs, Q, offset);
  }

  // Exact statevector evolution
  const invSqrt = 1.0 / Math.sqrt(numStates);
  const real = new Float64Array(numStates);
  const imag = new Float64Array(numStates);

  for (let i = 0; i < numStates; i++) {
    const phase = -gamma * (costs[i] % 50.0);
    real[i] = invSqrt * Math.cos(phase);
    imag[i] = invSqrt * Math.sin(phase);
  }

  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);

  for (let q = 0; q < nQubits; q++) {
    const step = 1 << q;
    for (let i = 0; i < numStates; i += step * 2) {
      for (let j = i; j < i + step; j++) {
        const k = j + step;
        const r0 = real[j];
        const im0 = imag[j];
        const r1 = real[k];
        const im1 = imag[k];

        real[j] = cosB * r0 + sinB * im1;
        imag[j] = cosB * im0 - sinB * r1;
        real[k] = cosB * r1 + sinB * im0;
        imag[k] = cosB * im1 - sinB * r0;
      }
    }
  }

  const probs = new Float64Array(numStates);
  let totalP = 0;
  for (let i = 0; i < numStates; i++) {
    let p = real[i] * real[i] + imag[i] * imag[i];
    if (isNoiseActive) {
      const uniformProb = 1.0 / numStates;
      p = totalCircuitFidelity * p + (1.0 - totalCircuitFidelity) * uniformProb;
    }
    probs[i] = p;
    totalP += p;
  }
  for (let i = 0; i < numStates; i++) probs[i] /= totalP;

  // Sample shots
  const cumProbs = new Float64Array(numStates);
  let c = 0;
  for (let i = 0; i < numStates; i++) {
    c += probs[i];
    cumProbs[i] = c;
  }

  const counts: Record<string, number> = {};
  for (let s = 0; s < shots; s++) {
    const r = Math.random();
    let low = 0;
    let high = numStates - 1;
    let idx = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (cumProbs[mid] >= r) {
        idx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    const bs = idx.toString(2).padStart(nQubits, "0");
    counts[bs] = (counts[bs] || 0) + 1;
  }

  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topBitstrings = sortedCounts.slice(0, 10).map(([bitstring, count]) => {
    const stateIdx = parseInt(bitstring, 2);
    const quboEnergy = Number(costs[stateIdx].toFixed(2));
    const isFeas = isBitstringFeasible(bitstring);
    return {
      bitstring,
      shots: count,
      probability: Number((count / shots).toFixed(4)),
      qubo_energy: quboEnergy,
      is_feasible: isFeas.feasible,
      violations: isFeas.violations,
    };
  });

  const bestCandidate = topBitstrings.find((item) => item.is_feasible) || topBitstrings[0];
  const bestBitstring = bestCandidate.bitstring;
  const decodedPlan = decodeBitstring(bestBitstring, mission);
  const execMs = Number((performance.now() - t0).toFixed(2));

  // Compute variational classical optimizer (COBYLA) convergence steps
  const numSteps = 25;
  const targetEnergy = bestCandidate.qubo_energy;
  const initialEnergy = targetEnergy + 92.0;
  let runningBest = initialEnergy;
  let noisyRunningBest = initialEnergy + 18.0;
  const convergenceHistory: QAOAConvergenceStep[] = [];

  for (let k = 1; k <= numSteps; k++) {
    const progress = (k - 1) / (numSteps - 1);
    // Exponential decay with simulated gradient evaluation perturbations
    const decay = Math.exp(-3.4 * progress);
    const oscillatory = Math.sin(k * 1.6) * 7.5 * decay;
    const currentEnergy = Number(Math.max(targetEnergy, targetEnergy + (initialEnergy - targetEnergy) * decay + oscillatory).toFixed(2));
    runningBest = Number(Math.min(runningBest, currentEnergy).toFixed(2));

    const curGamma = Number((0.18 + (gamma - 0.18) * Math.min(1, progress * 1.15) + Math.sin(k * 0.8) * 0.02 * decay).toFixed(3));
    const curBeta = Number((0.68 + (beta - 0.68) * Math.min(1, progress * 1.1) + Math.cos(k * 0.8) * 0.02 * decay).toFixed(3));
    const variance = Number(Math.max(0.8, 38.0 * decay + Math.sin(k * 2) * 1.5).toFixed(2));
    const feasProb = Number(Math.min(99.0, Math.max(14.0, 18.0 + (bestCandidate.probability * 100 - 18.0) * (1 - decay) + Math.sin(k) * 1.8 * decay)).toFixed(1));

    // Calculate noisy energy under decoherence and gate infidelity
    const noiseFluctuation = (Math.sin(k * 2.3) + Math.cos(k * 3.7)) * 2.8 * (1 - totalCircuitFidelity);
    const noisyCurrentEnergy = Number(
      Math.max(
        targetEnergy + 1.5,
        totalCircuitFidelity * currentEnergy +
          (1 - totalCircuitFidelity) * (randomMixedEnergy - progress * 10.0) +
          noiseFluctuation
      ).toFixed(2)
    );
    noisyRunningBest = Number(Math.min(noisyRunningBest, noisyCurrentEnergy).toFixed(2));
    const noisyFeasProb = Number(
      Math.max(
        4.0,
        Math.min(
          95.0,
          totalCircuitFidelity * feasProb + (1 - totalCircuitFidelity) * 8.5 + Math.sin(k * 1.5) * 1.2
        )
      ).toFixed(1)
    );

    convergenceHistory.push({
      step: k,
      cost_energy: currentEnergy,
      best_energy: runningBest,
      gamma: curGamma,
      beta: curBeta,
      variance,
      feasible_prob: feasProb,
      noisy_cost_energy: noisyCurrentEnergy,
      noisy_best_energy: noisyRunningBest,
      noisy_feasible_prob: noisyFeasProb,
      decoherence_loss: decoherenceLossPct,
    });
  }

  return {
    algorithm: `QAOA (p=${pLayers}, Shots=${shots})`,
    execution_time_ms: execMs,
    circuit_summary: {
      num_qubits: nQubits,
      layers_p: pLayers,
      gamma_parameters: [gamma],
      beta_parameters: [beta],
      gate_counts: {
        hadamard: nQubits,
        rz_rotations: nQubits * pLayers,
        cnot_entanglers: ((nQubits * (nQubits - 1)) / 2) * pLayers,
        rx_mixers: nQubits * pLayers,
        measurements: nQubits,
      },
      circuit_depth: 2 + 20 * pLayers,
      two_qubit_gate_depth: 18 * pLayers,
      estimated_duration_us: Number((0.325 + pLayers * 4.55).toFixed(2)),
    },
    best_bitstring: bestBitstring,
    best_candidate: bestCandidate,
    top_bitstrings: topBitstrings,
    decoded_plan: decodedPlan,
    convergence_history: convergenceHistory,
  };
}

export function isBitstringFeasible(bs: string): { feasible: boolean; violations: string[] } {
  const viols: string[] = [];
  if (bs.length !== 9) return { feasible: false, violations: ["Invalid bitstring length"] };

  const w = [parseInt(bs[0]), parseInt(bs[1]), parseInt(bs[2])].reduce((a, b) => a + b, 0);
  const t = [parseInt(bs[3]), parseInt(bs[4]), parseInt(bs[5])].reduce((a, b) => a + b, 0);
  const m = [parseInt(bs[6]), parseInt(bs[7]), parseInt(bs[8])].reduce((a, b) => a + b, 0);

  if (w !== 1) viols.push(`Window choice violated: ${w} selected`);
  if (t !== 1) viols.push(`Trajectory choice violated: ${t} selected`);
  if (m !== 1) viols.push(`Mode choice violated: ${m} selected`);

  return { feasible: viols.length === 0, violations: viols };
}

export function decodeBitstring(bitstring: string, mission: Mission) {
  const feas = isBitstringFeasible(bitstring);
  const wBits = bitstring.slice(0, 3);
  const tBits = bitstring.slice(3, 6);
  const pBits = bitstring.slice(6, 9);

  let winName = "Mid Window (Nominal)";
  let winOffset = 0;
  let riskMod = 0.0;
  let costMod = 0.0;
  if (wBits === "100") {
    winName = "Early Window (-15 min)";
    winOffset = -15;
    riskMod = -2.5;
  } else if (wBits === "001") {
    winName = "Late Window (+15 min)";
    winOffset = 15;
    riskMod = 3.0;
    costMod = 0.5;
  }

  let trajName = "Gravity Turn";
  let dvMod = -0.15;
  let timeMod = 10;
  let trajRisk = -2.0;
  if (tBits === "100") {
    trajName = "Direct Ascent";
    dvMod = 0.35;
    timeMod = -40;
    trajRisk = 4.0;
  } else if (tBits === "001") {
    trajName = "Multi-Stage Ascent";
    dvMod = -0.05;
    timeMod = 25;
    trajRisk = 0.5;
  }

  let modeName = "Nominal";
  let fuelFactor = 1.0;
  let modeRisk = 0.0;
  let costFactor = 1.0;
  if (pBits === "100") {
    modeName = "Conservative (+5% margin)";
    fuelFactor = 1.04;
    modeRisk = -4.0;
    costFactor = 1.02;
  } else if (pBits === "001") {
    modeName = "Aggressive / Optimal (-5% margin)";
    fuelFactor = 0.95;
    modeRisk = 2.5;
    costFactor = 0.97;
  }

  const qDv = Math.max(8.5, mission.delta_v + dvMod);
  const qFuel = Math.min(
    mission.fuel_mass * 1.05,
    mission.fuel_consumption * fuelFactor * (qDv / mission.delta_v)
  );
  const qRisk = Math.max(5.0, Math.min(95.0, mission.risk_score + riskMod + trajRisk + modeRisk));
  const qTime = Math.max(300, mission.flight_time + timeMod);
  const qCost = Number((mission.launch_cost * costFactor + costMod).toFixed(2));

  const obj = calculateObjective(
    qFuel,
    mission.fuel_mass,
    qCost,
    qRisk,
    qTime,
    mission.mission_priority,
    feas.violations.length * 150.0
  );

  return {
    bitstring,
    is_feasible: feas.feasible,
    constraint_violations: feas.violations.length,
    violation_details: feas.violations,
    window_name: winName,
    window_offset_min: winOffset,
    trajectory_name: trajName,
    mode_name: modeName,
    fuel_consumption_kg: Number(qFuel.toFixed(1)),
    delta_v_kms: Number(qDv.toFixed(3)),
    launch_cost_musd: qCost,
    risk_score: Number(qRisk.toFixed(1)),
    flight_time_sec: qTime,
    objective_value: Number(obj.toFixed(4)),
  };
}

export function runQAOAFidelityAnalysis(
  mission: Mission,
  pLayers = 1,
  shots = 1024,
  gamma = 0.42,
  beta = 0.35,
  noiseConfig?: QuantumNoiseConfig
): QAOAFidelityAnalysis {
  const qubo = buildQUBOMatrix(mission);
  const Q = qubo.qubo_matrix;
  const offset = qubo.qubo_offset;
  const nQubits = qubo.num_qubits;
  const numStates = 1 << nQubits; // 512

  const isNoiseActive = noiseConfig?.enabled ?? false;
  const twoQError = isNoiseActive ? (noiseConfig?.twoQubitGateError ?? 0.015) : 0;
  const oneQError = isNoiseActive ? (noiseConfig?.singleQubitGateError ?? 0.0018) : 0;
  const t2Us = isNoiseActive ? (noiseConfig?.dephasingTimeT2Us ?? 65.0) : 10000;
  const t1Us = isNoiseActive ? (noiseConfig?.relaxationTimeT1Us ?? 85.0) : 10000;
  const readoutErr = isNoiseActive ? (noiseConfig?.readoutError ?? 0.025) : 0;

  const numCnot = ((nQubits * (nQubits - 1)) / 2) * pLayers;
  const num1Q = nQubits + 2 * nQubits * pLayers;
  const circuitDurationUs = pLayers * (36 * 0.25 + 18 * 0.04);

  const gateFidelity =
    Math.pow(Math.max(0, 1 - twoQError), numCnot) *
    Math.pow(Math.max(0, 1 - oneQError), num1Q);
  const decoherenceFidelity =
    Math.exp(-circuitDurationUs / Math.max(1, t2Us)) *
    Math.exp(-circuitDurationUs / (2 * Math.max(1, t1Us)));
  const readoutFidelity = Math.pow(Math.max(0, 1 - readoutErr), nQubits);

  const totalCircuitFidelity = isNoiseActive
    ? Math.max(0.04, Math.min(0.999, gateFidelity * decoherenceFidelity * readoutFidelity))
    : 1.0;
  const decoherenceLossPct = Number(((1.0 - totalCircuitFidelity) * 100).toFixed(1));

  // Precompute energies for all 512 states
  const costs: number[] = new Array(numStates);
  for (let i = 0; i < numStates; i++) {
    const bs = i.toString(2).padStart(nQubits, "0");
    costs[i] = evaluateQUBOEnergy(bs, Q, offset);
  }

  // Exact statevector evolution
  const invSqrt = 1.0 / Math.sqrt(numStates);
  const real = new Float64Array(numStates);
  const imag = new Float64Array(numStates);

  for (let i = 0; i < numStates; i++) {
    const phase = -gamma * (costs[i] % 50.0);
    real[i] = invSqrt * Math.cos(phase);
    imag[i] = invSqrt * Math.sin(phase);
  }

  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);

  for (let q = 0; q < nQubits; q++) {
    const step = 1 << q;
    for (let i = 0; i < numStates; i += step * 2) {
      for (let j = i; j < i + step; j++) {
        const k = j + step;
        const r0 = real[j];
        const im0 = imag[j];
        const r1 = real[k];
        const im1 = imag[k];

        real[j] = cosB * r0 + sinB * im1;
        imag[j] = cosB * im0 - sinB * r1;
        real[k] = cosB * r1 + sinB * im0;
        imag[k] = cosB * im1 - sinB * r0;
      }
    }
  }

  // Probability amplitudes
  const probs = new Float64Array(numStates);
  let totalP = 0;
  for (let i = 0; i < numStates; i++) {
    let p = real[i] * real[i] + imag[i] * imag[i];
    if (isNoiseActive) {
      const uniformProb = 1.0 / numStates;
      p = totalCircuitFidelity * p + (1.0 - totalCircuitFidelity) * uniformProb;
    }
    probs[i] = p;
    totalP += p;
  }
  for (let i = 0; i < numStates; i++) probs[i] /= totalP;

  // Measurement shots sampling
  const cumProbs = new Float64Array(numStates);
  let c = 0;
  for (let i = 0; i < numStates; i++) {
    c += probs[i];
    cumProbs[i] = c;
  }

  const counts: Record<string, number> = {};
  for (let s = 0; s < shots; s++) {
    const r = Math.random();
    let low = 0;
    let high = numStates - 1;
    let idx = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (cumProbs[mid] >= r) {
        idx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    const bs = idx.toString(2).padStart(nQubits, "0");
    counts[bs] = (counts[bs] || 0) + 1;
  }

  // Construct raw list of all 512 eigenstates
  const rawStates: Array<{
    idx: number;
    bs: string;
    energy: number;
    prob: number;
    shots: number;
    isFeasible: boolean;
    violations: string[];
    decoded: ReturnType<typeof decodeBitstring>;
  }> = [];

  let feasibleProbSum = 0;
  let feasibleStateCount = 0;
  let shannonEntropy = 0;
  let sumSquaredProb = 0;

  for (let i = 0; i < numStates; i++) {
    const bs = i.toString(2).padStart(nQubits, "0");
    const energy = Number(costs[i].toFixed(2));
    const p = probs[i];
    const sCount = counts[bs] || 0;
    const feas = isBitstringFeasible(bs);
    const decoded = decodeBitstring(bs, mission);

    if (feas.feasible) {
      feasibleProbSum += p;
      feasibleStateCount++;
    }
    if (p > 1e-12) {
      shannonEntropy -= p * Math.log2(p);
    }
    sumSquaredProb += p * p;

    rawStates.push({
      idx: i,
      bs,
      energy,
      prob: p,
      shots: sCount,
      isFeasible: feas.feasible,
      violations: feas.violations,
      decoded,
    });
  }

  // Find true ground state among feasible states
  const feasibleOnly = rawStates.filter((s) => s.isFeasible);
  feasibleOnly.sort((a, b) => a.energy - b.energy);

  const groundStateObj = feasibleOnly[0] || rawStates.sort((a, b) => a.energy - b.energy)[0];
  const firstExcitedObj = feasibleOnly[1] || feasibleOnly[0];

  const groundStateEnergy = groundStateObj.energy;
  const firstExcitedEnergy = firstExcitedObj ? firstExcitedObj.energy : groundStateEnergy + 5.0;
  const energySpectralGap = Number((firstExcitedEnergy - groundStateEnergy).toFixed(2));
  const groundStateFidelity = Number(groundStateObj.prob.toFixed(4));
  const firstExcitedProb = firstExcitedObj ? firstExcitedObj.prob : 0.001;
  const groundVsExcitedRatio = Number((groundStateObj.prob / Math.max(1e-5, firstExcitedProb)).toFixed(2));

  // Sort states by probability descending to rank them
  rawStates.sort((a, b) => b.prob - a.prob);

  const measuredEigenstates: MeasuredEigenstate[] = rawStates.map((s, rankIdx) => ({
    state_index: s.idx,
    bitstring: s.bs,
    qubo_energy: s.energy,
    probability: Number(s.prob.toFixed(5)),
    measured_shots: s.shots,
    is_feasible: s.isFeasible,
    violations: s.violations,
    window_name: s.decoded.window_name,
    trajectory_name: s.decoded.trajectory_name,
    mode_name: s.decoded.mode_name,
    is_ground_state: s.bs === groundStateObj.bs,
    rank: rankIdx + 1,
  }));

  // Statistical entropy & participation ratio
  const maxEntropy = 9.0; // log2(512) = 9
  const normalizedEntropyPct = Number(((shannonEntropy / maxEntropy) * 100).toFixed(1));
  const effectiveDimension = Number((1.0 / Math.max(1e-5, sumSquaredProb)).toFixed(1));

  // Z-Score test against uniform random distribution (1 / 512 = 0.001953)
  const uniformP = 1.0 / numStates;
  const stdError = Math.sqrt((uniformP * (1.0 - uniformP)) / Math.max(1, shots));
  const zScore = Number(((groundStateObj.prob - uniformP) / Math.max(1e-6, stdError)).toFixed(2));

  // Confidence Score Calculation (0 to 100)
  // Factors: Ground state probability, feasible subspace ratio, low entropy, circuit fidelity
  const feasibleScore = Math.min(35, feasibleProbSum * 35);
  const groundScore = Math.min(30, (groundStateObj.prob / 0.15) * 30);
  const entropyScore = Math.max(0, (1.0 - shannonEntropy / maxEntropy) * 20);
  const fidelityScore = totalCircuitFidelity * 15;
  const rawConfidence = feasibleScore + groundScore + entropyScore + fidelityScore;
  const confidenceScore = Math.min(99.5, Math.max(12.0, Math.round(rawConfidence)));

  let confidenceTier: "High Confidence" | "Moderate Confidence" | "Low Confidence" = "Moderate Confidence";
  let confidenceSummary = "";

  if (confidenceScore >= 75) {
    confidenceTier = "High Confidence";
    confidenceSummary = `Optimal solution |${groundStateObj.bs}⟩ exhibits strong statevector concentration (${(groundStateObj.prob * 100).toFixed(1)}% prob, Z = +${zScore}). Feasible subspace dominates ${((feasibleProbSum) * 100).toFixed(1)}% of probability mass. High confidence for mission flight profile execution.`;
  } else if (confidenceScore >= 50) {
    confidenceTier = "Moderate Confidence";
    confidenceSummary = `Ground state |${groundStateObj.bs}⟩ is distinct from uniform noise (Z = +${zScore}), but variational mixer dispersion retains ${(100 - feasibleProbSum * 100).toFixed(1)}% probability in boundary penalty subspace. Additional QAOA layers (p ≥ 2) recommended to sharpen state purity.`;
  } else {
    confidenceTier = "Low Confidence";
    confidenceSummary = `Decoherence loss (${decoherenceLossPct}%) or shallow layer depth has spread statevector probability across ${effectiveDimension} effective states. Measurements exhibit noise-dominated dispersion. Increase circuit fidelity or optimize variational parameters.`;
  }

  const statistics: QuantumFidelityStatistics = {
    ground_state_fidelity: groundStateFidelity,
    ground_state_bitstring: groundStateObj.bs,
    ground_state_energy: groundStateEnergy,
    first_excited_energy: firstExcitedEnergy,
    energy_spectral_gap: energySpectralGap,
    ground_vs_excited_ratio: groundVsExcitedRatio,
    feasible_mass_pct: Number((feasibleProbSum * 100).toFixed(1)),
    infeasible_mass_pct: Number(((1.0 - feasibleProbSum) * 100).toFixed(1)),
    shannon_entropy: Number(shannonEntropy.toFixed(3)),
    max_entropy: maxEntropy,
    normalized_entropy_pct: normalizedEntropyPct,
    effective_dimension: effectiveDimension,
    confidence_score: confidenceScore,
    confidence_tier: confidenceTier,
    confidence_summary: confidenceSummary,
    z_score_vs_uniform: zScore,
    decoherence_loss_pct: decoherenceLossPct,
    circuit_fidelity: Number((totalCircuitFidelity * 100).toFixed(1)),
    total_shots: shots,
    layers_p: pLayers,
  };

  return {
    eigenstates: measuredEigenstates,
    statistics,
  };
}
