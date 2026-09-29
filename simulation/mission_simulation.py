"""
Mission Simulation Module
Top-level pipeline coordinating Baseline -> Classical -> QUBO -> QAOA.
"""

from typing import Dict, Any
from models.mission_model import Mission
from simulation.trajectory_simulation import simulate_trajectory
from optimization.classical_optimizer import optimize_classical
from optimization.qubo_model import build_qubo_matrix
from optimization.qaoa_optimizer import run_qaoa_simulation
from evaluation.comparison import generate_comparison_table

def run_full_mission_optimization(
    mission: Mission,
    qaoa_layers: int = 1,
    qaoa_shots: int = 1024,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Executes the entire aerospace quantum-classical pipeline:
    1. Trajectory numerical integration
    2. Classical optimization
    3. QUBO & Ising formulation
    4. QAOA quantum optimization
    5. Comparison matrix generation
    """
    # 1. Physics Trajectory
    trajectory_results = simulate_trajectory(mission)

    # 2. Classical Optimization
    classical_results = optimize_classical(mission)

    # 3. QUBO
    qubo_data = build_qubo_matrix(mission)

    # 4. QAOA Quantum Optimization
    qaoa_results = run_qaoa_simulation(
        mission=mission,
        p_layers=qaoa_layers,
        shots=qaoa_shots,
        seed=seed
    )

    # 5. Direct Comparison
    comparison = generate_comparison_table(
        baseline_metrics=classical_results["baseline"],
        classical_metrics=classical_results["optimized"],
        classical_exec_ms=classical_results["execution_time_ms"],
        quantum_plan=qaoa_results["decoded_plan"],
        quantum_exec_ms=qaoa_results["execution_time_ms"]
    )

    return {
        "mission": mission.to_dict(),
        "trajectory": trajectory_results,
        "classical": classical_results,
        "qubo": qubo_data,
        "qaoa": qaoa_results,
        "comparison": comparison
    }
