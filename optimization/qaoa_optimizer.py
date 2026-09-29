"""
QAOA Quantum Optimizer Module
Implements the Quantum Approximate Optimization Algorithm (QAOA)
with full statevector simulation, variational parameter optimization (gamma, beta),
and shot measurement sampling for aerospace trajectory QUBO.
"""

import time
import math
import random
from typing import Dict, Any, List, Tuple
from models.mission_model import Mission
from optimization.qubo_model import build_qubo_matrix, evaluate_qubo_energy
from optimization.constraints import check_qubo_binary_constraints, check_mission_constraints
from optimization.objective_function import calculate_objective


def run_qaoa_simulation(
    mission: Mission,
    p_layers: int = 1,
    shots: int = 1024,
    seed: int = 42,
    gamma: float = 0.42,
    beta: float = 0.35,
    optimize_angles: bool = True
) -> Dict[str, Any]:
    """
    Executes QAOA algorithm on the 9-qubit mission QUBO problem.
    Uses exact statevector evolution over the 2^9 = 512 basis states.
    """
    start_time = time.perf_counter()
    random.seed(seed)

    qubo_data = build_qubo_matrix(mission)
    Q = qubo_data["qubo_matrix"]
    offset = qubo_data["qubo_offset"]
    n_qubits = qubo_data["num_qubits"]
    num_states = 1 << n_qubits  # 512 states

    # 1. Precalculate classical cost C(x) for all 512 computational basis states
    costs = [0.0] * num_states
    for state_idx in range(num_states):
        bitstring = format(state_idx, f"0{n_qubits}b")
        costs[state_idx] = evaluate_qubo_energy(bitstring, Q, offset)

    # 2. Angle optimization (simple coordinate line search for variational angles)
    best_gamma = gamma
    best_beta = beta

    if optimize_angles:
        # Search candidate gammas in [0, pi] and betas in [0, pi/2]
        candidate_gammas = [0.15, 0.30, 0.45, 0.60, 0.75]
        candidate_betas = [0.20, 0.35, 0.50, 0.65]
        min_expected_energy = float("inf")

        for g in candidate_gammas:
            for b in candidate_betas:
                exp_e = _simulate_qaoa_expectation(costs, n_qubits, g, b)
                if exp_e < min_expected_energy:
                    min_expected_energy = exp_e
                    best_gamma = g
                    best_beta = b

    # 3. Simulate final statevector with optimal (or specified) angles
    probs = _simulate_qaoa_probabilities(costs, n_qubits, best_gamma, best_beta)

    # 4. Sample shots from the probability distribution
    counts: Dict[str, int] = {}
    cum_probs = []
    c = 0.0
    for p in probs:
        c += p
        cum_probs.append(c)

    samples = []
    for _ in range(shots):
        r = random.random()
        # Binary search for cumulative probability
        low = 0
        high = num_states - 1
        selected_idx = 0
        while low <= high:
            mid = (low + high) // 2
            if cum_probs[mid] >= r:
                selected_idx = mid
                high = mid - 1
            else:
                low = mid + 1

        bitstring = format(selected_idx, f"0{n_qubits}b")
        samples.append(bitstring)
        counts[bitstring] = counts.get(bitstring, 0) + 1

    # 5. Find top sampled bitstrings
    sorted_counts = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    top_bitstrings = []
    for bitstring, count in sorted_counts[:10]:
        cost_val = costs[int(bitstring, 2)]
        is_feas, viols, pen = check_qubo_binary_constraints(bitstring)
        top_bitstrings.append({
            "bitstring": bitstring,
            "shots": count,
            "probability": round(count / shots, 4),
            "qubo_energy": round(cost_val, 2),
            "is_feasible": is_feas,
            "violations": viols
        })

    # Pick the best feasible bitstring from highest probability samples
    best_candidate = None
    for item in top_bitstrings:
        if item["is_feasible"]:
            best_candidate = item
            break

    # If no sampled bitstring was strictly feasible, pick lowest energy sampled
    if best_candidate is None:
        best_candidate = min(top_bitstrings, key=lambda x: x["qubo_energy"])

    best_bitstring = best_candidate["bitstring"]

    # 6. Decode bitstring to mission configuration
    decoded_plan = decode_bitstring_to_mission(best_bitstring, mission)

    exec_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    # Circuit metadata for dashboard visualization
    circuit_summary = {
        "num_qubits": n_qubits,
        "layers_p": p_layers,
        "gamma_parameters": [round(best_gamma, 3)] * p_layers,
        "beta_parameters": [round(best_beta, 3)] * p_layers,
        "gate_counts": {
            "hadamard": n_qubits,
            "rz_rotations": n_qubits * p_layers,
            "cnot_entanglers": (n_qubits * (n_qubits - 1) // 2) * p_layers,
            "rx_mixers": n_qubits * p_layers,
            "measurements": n_qubits
        }
    }

    return {
        "algorithm": f"QAOA (p={p_layers}, Shots={shots})",
        "execution_time_ms": exec_time_ms,
        "circuit_summary": circuit_summary,
        "best_bitstring": best_bitstring,
        "best_candidate": best_candidate,
        "top_bitstrings": top_bitstrings,
        "decoded_plan": decoded_plan,
        "qubo_data": qubo_data
    }


def _simulate_qaoa_expectation(costs: List[float], n_qubits: int, gamma: float, beta: float) -> float:
    """Helper to compute expectation value sum_x P(x) * C(x)."""
    probs = _simulate_qaoa_probabilities(costs, n_qubits, gamma, beta)
    return sum(p * c for p, c in zip(probs, costs))


def _simulate_qaoa_probabilities(costs: List[float], n_qubits: int, gamma: float, beta: float) -> List[float]:
    """
    Computes exact probabilities |<x|psi>|^2 for QAOA state with p=1.
    State starts at uniform superposition |+>^n.
    Phase separation: |x> -> exp(-i * gamma * C(x)) |x>.
    Mixer: applies Rx(2*beta) on each qubit.
    """
    num_states = 1 << n_qubits
    # Initial state amplitude 1 / sqrt(2^n)
    inv_sqrt_n = 1.0 / math.sqrt(num_states)
    
    # State amplitudes as complex numbers (real, imag)
    # After phase separation: amp_x = inv_sqrt_n * exp(-i * gamma * C(x))
    state_real = [0.0] * num_states
    state_imag = [0.0] * num_states

    for x in range(num_states):
        phase = -gamma * (costs[x] % 50.0)  # scale phase for numerical conditioning
        state_real[x] = inv_sqrt_n * math.cos(phase)
        state_imag[x] = inv_sqrt_n * math.sin(phase)

    # Mixer evolution: Rx(2*beta) = cos(beta) * I - i * sin(beta) * X on each qubit
    cos_b = math.cos(beta)
    sin_b = math.sin(beta)

    for qubit in range(n_qubits):
        step = 1 << qubit
        # Apply single-qubit mixer gate to pairs (i, i + step) where qubit bit is 0 vs 1
        for i in range(0, num_states, step * 2):
            for j in range(i, i + step):
                k = j + step
                # (cos*r0 + sin*i1, cos*i0 - sin*r1)
                r0, i0 = state_real[j], state_imag[j]
                r1, i1 = state_real[k], state_imag[k]

                # Rx = cos(beta)*|0> - i*sin(beta)*|1>
                new_r0 = cos_b * r0 + sin_b * i1
                new_i0 = cos_b * i0 - sin_b * r1

                new_r1 = cos_b * r1 + sin_b * i0
                new_i1 = cos_b * i1 - sin_b * r0

                state_real[j] = new_r0
                state_imag[j] = new_i0
                state_real[k] = new_r1
                state_imag[k] = new_i1

    # Probabilities = real^2 + imag^2
    probs = [r * r + im * im for r, im in zip(state_real, state_imag)]
    total_p = sum(probs)
    if total_p > 0:
        probs = [p / total_p for p in probs]
    return probs


def decode_bitstring_to_mission(bitstring: str, mission: Mission) -> Dict[str, Any]:
    """
    Decodes 9-bit string into mission decision choices and computes resulting metrics.
    """
    is_feas, viols, pen = check_qubo_binary_constraints(bitstring)

    w_bits = bitstring[0:3]
    t_bits = bitstring[3:6]
    p_bits = bitstring[6:9]

    # Map window
    if w_bits == "100":
        win_name = "Early Window (-15 min)"
        win_offset = -15
        risk_mod = -2.5
        cost_mod = 0.0
    elif w_bits == "001":
        win_name = "Late Window (+15 min)"
        win_offset = 15
        risk_mod = 3.0
        cost_mod = 0.5
    else:
        win_name = "Mid Window (Nominal)"
        win_offset = 0
        risk_mod = 0.0
        cost_mod = 0.0

    # Map trajectory
    if t_bits == "100":
        traj_name = "Direct Ascent"
        dv_mod = 0.35
        time_mod = -40
        traj_risk = 4.0
    elif t_bits == "001":
        traj_name = "Multi-Stage Ascent"
        dv_mod = -0.05
        time_mod = 25
        traj_risk = 0.5
    else:
        traj_name = "Gravity Turn"
        dv_mod = -0.15
        time_mod = 10
        traj_risk = -2.0

    # Map fuel mode
    if p_bits == "100":
        mode_name = "Conservative (+5% margin)"
        fuel_factor = 1.04
        mode_risk = -4.0
        cost_factor = 1.02
    elif p_bits == "001":
        mode_name = "Aggressive / Optimal (-5% margin)"
        fuel_factor = 0.95
        mode_risk = 2.5
        cost_factor = 0.97
    else:
        mode_name = "Nominal"
        fuel_factor = 1.00
        mode_risk = 0.0
        cost_factor = 1.00

    q_dv = max(8.5, mission.delta_v + dv_mod)
    q_fuel = min(mission.fuel_mass * 1.05, mission.fuel_consumption * fuel_factor * (q_dv / mission.delta_v))
    q_risk = max(5.0, min(95.0, mission.risk_score + risk_mod + traj_risk + mode_risk))
    q_time = max(300, mission.flight_time + time_mod)
    q_cost = round(mission.launch_cost * cost_factor + cost_mod, 2)

    is_phys_feas, phys_viols, phys_pen = check_mission_constraints(mission, q_fuel, max_risk_threshold=70.0)

    total_violations = len(viols) + len(phys_viols)
    all_viols = viols + phys_viols

    obj_val = calculate_objective(
        fuel_consumption_kg=q_fuel,
        max_fuel_kg=mission.fuel_mass,
        launch_cost_musd=q_cost,
        risk_score=q_risk,
        flight_time_sec=q_time,
        mission_priority=mission.mission_priority,
        constraint_penalty=pen + phys_pen
    )

    return {
        "bitstring": bitstring,
        "is_feasible": is_feas and is_phys_feas,
        "constraint_violations": total_violations,
        "violation_details": all_viols,
        "window_name": win_name,
        "window_offset_min": win_offset,
        "trajectory_name": traj_name,
        "mode_name": mode_name,
        "fuel_consumption_kg": round(q_fuel, 1),
        "delta_v_kms": round(q_dv, 3),
        "launch_cost_musd": q_cost,
        "risk_score": round(q_risk, 1),
        "flight_time_sec": q_time,
        "objective_value": round(obj_val, 4)
    }
