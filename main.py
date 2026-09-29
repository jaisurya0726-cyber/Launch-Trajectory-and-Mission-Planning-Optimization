#!/usr/bin/env python3
"""
Main Execution Script
Launch Trajectory and Mission-Planning Optimization using Quantum Computing

Runs the full academic pipeline:
1. Checks / auto-generates the launch missions dataset
2. Runs physics trajectory integration (RK4)
3. Solves classical optimization
4. Constructs the QUBO matrix and Ising formulation
5. Simulates QAOA quantum optimization
6. Generates Baseline vs Classical vs Quantum comparison table
7. Exports results to outputs/ directory
"""

import os
import sys
import csv
import json

from preprocessing.preprocess import ensure_dataset, load_missions
from simulation.trajectory_simulation import simulate_trajectory
from optimization.classical_optimizer import optimize_classical
from optimization.qubo_model import build_qubo_matrix
from optimization.qaoa_optimizer import run_qaoa_simulation
from evaluation.comparison import generate_comparison_table

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs")

def main():
    print("=" * 80)
    print("LAUNCH TRAJECTORY & MISSION-PLANNING OPTIMIZATION")
    print("Quantum Computing Simulation & Academic Benchmark")
    print("=" * 80)

    # 1. Dataset verification & auto-generation
    dataset_path = ensure_dataset(num_records=500)
    missions = load_missions()
    print(f"[OK] Dataset ready: {len(missions)} mission records loaded.")
    print(f"     File path: {dataset_path}")

    # Select representative mission
    target_mission = missions[0]
    print("\n" + "-" * 80)
    print(f"SELECTED MISSION: {target_mission.mission_id} - {target_mission.satellite_name}")
    print(f"Vehicle: {target_mission.rocket} | Orbit: {target_mission.target_orbit} ({target_mission.altitude} km)")
    print(f"Payload: {target_mission.payload_mass} kg | Site: {target_mission.launch_site}")
    print(f"Safety Status: {target_mission.safety_status} (Risk: {target_mission.risk_score}/100)")
    print("-" * 80)

    # 2. Trajectory numerical integration
    print("\n[1/4] Running 4th-Order Runge-Kutta Trajectory Simulation...")
    traj = simulate_trajectory(target_mission)
    print(f"      Burn time: {traj['summary']['burn_time_sec']} s")
    print(f"      Max altitude reached: {traj['summary']['max_altitude_km']} km")
    print(f"      Final velocity: {traj['summary']['final_velocity_ms']} m/s")
    print(f"      Max acceleration: {traj['summary']['max_acceleration_g']} g")
    print(f"      Max dynamic pressure: {traj['summary']['max_dynamic_pressure_kPa']} kPa")

    # 3. Classical optimization
    print("\n[2/4] Executing Classical Multi-Objective Optimizer...")
    classical_res = optimize_classical(target_mission)
    print(f"      Baseline objective:  {classical_res['baseline']['objective_value']}")
    print(f"      Optimized objective: {classical_res['optimized']['objective_value']} "
          f"({classical_res['objective_improvement_pct']}% improvement)")
    print(f"      Selected: {classical_res['selected_configuration']['window_name']} | "
          f"{classical_res['selected_configuration']['trajectory_name']} | "
          f"{classical_res['selected_configuration']['mode_name']}")
    print(f"      Execution time: {classical_res['execution_time_ms']} ms")

    # 4. QUBO Matrix construction
    print("\n[3/4] Formulating QUBO Matrix (9 binary variables)...")
    qubo = build_qubo_matrix(target_mission)
    print(f"      Variables: {qubo['variables']}")
    print(f"      Matrix size: {qubo['num_qubits']}x{qubo['num_qubits']} (Offset: {qubo['qubo_offset']})")

    # 5. QAOA Quantum Optimization
    print("\n[4/4] Simulating QAOA Quantum Circuit (p=1, 1024 shots)...")
    qaoa_res = run_qaoa_simulation(target_mission, p_layers=1, shots=1024)
    print(f"      Best sampled bitstring: {qaoa_res['best_bitstring']}")
    print(f"      QUBO ground state energy: {qaoa_res['best_candidate']['qubo_energy']}")
    print(f"      Feasible: {qaoa_res['best_candidate']['is_feasible']}")
    print(f"      Quantum decoded objective: {qaoa_res['decoded_plan']['objective_value']}")
    print(f"      Quantum execution time: {qaoa_res['execution_time_ms']} ms")

    # 6. Comparison Table
    print("\n" + "=" * 80)
    print("CLASSICAL vs QUANTUM PERFORMANCE COMPARISON MATRIX")
    print("=" * 80)
    comp = generate_comparison_table(
        baseline_metrics=classical_res["baseline"],
        classical_metrics=classical_res["optimized"],
        classical_exec_ms=classical_res["execution_time_ms"],
        quantum_plan=qaoa_res["decoded_plan"],
        quantum_exec_ms=qaoa_res["execution_time_ms"]
    )

    fmt_header = f"{'Metric':<25} | {'Baseline':<12} | {'Classical':<12} | {'Quantum':<12} | {'Best':<10}"
    print(fmt_header)
    print("-" * len(fmt_header))
    for row in comp["rows"]:
        print(f"{row['metric']:<25} | {str(row['baseline']):<12} | {str(row['classical']):<12} | {str(row['quantum']):<12} | {row['best_performer']:<10}")

    print("\nAcademic Evaluation Note:")
    print(comp["scientific_analysis"])

    # 7. Export outputs
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 7a. optimized_mission.csv
    opt_csv_path = os.path.join(OUTPUT_DIR, "optimized_mission.csv")
    with open(opt_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(qaoa_res["decoded_plan"].keys()))
        writer.writeheader()
        writer.writerow(qaoa_res["decoded_plan"])

    # 7b. comparison_results.csv
    comp_csv_path = os.path.join(OUTPUT_DIR, "comparison_results.csv")
    with open(comp_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["metric", "unit", "baseline", "classical", "quantum", "best_performer"])
        writer.writeheader()
        writer.writerows(comp["rows"])

    # 7c. trajectory_results.csv
    traj_csv_path = os.path.join(OUTPUT_DIR, "trajectory_results.csv")
    with open(traj_csv_path, "w", newline="", encoding="utf-8") as f:
        traj_fields = ["time", "altitude_km", "velocity_ms", "accel_g", "fuel_remaining_kg", "dynamic_pressure_kPa"]
        writer = csv.DictWriter(f, fieldnames=traj_fields)
        writer.writeheader()
        for i in range(len(traj["time"])):
            writer.writerow({
                "time": traj["time"][i],
                "altitude_km": traj["altitude_km"][i],
                "velocity_ms": traj["velocity_ms"][i],
                "accel_g": traj["accel_g"][i],
                "fuel_remaining_kg": traj["fuel_remaining_kg"][i],
                "dynamic_pressure_kPa": traj["dynamic_pressure_kPa"][i]
            })

    # 7d. qubo_matrix.csv
    qubo_csv_path = os.path.join(OUTPUT_DIR, "qubo_matrix.csv")
    with open(qubo_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(qubo["variables"])
        for row in qubo["qubo_matrix"]:
            writer.writerow(row)

    print(f"\n[OK] Successfully saved all 4 output CSV files to: {OUTPUT_DIR}")
    print("     - optimized_mission.csv")
    print("     - comparison_results.csv")
    print("     - trajectory_results.csv")
    print("     - qubo_matrix.csv")

    print("\n" + "=" * 80)
    print("DISCLAIMER:")
    print("This project is an academic simulation using simplified aerospace models")
    print("and synthetic/educational data. It is intended for research and demonstration")
    print("of optimization techniques and is not a flight-certified launch guidance system.")
    print("=" * 80)


if __name__ == "__main__":
    main()
