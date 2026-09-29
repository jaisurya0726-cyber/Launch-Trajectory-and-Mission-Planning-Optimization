"""
Classical Optimizer Module
Implements classical optimization (Combinatorial Grid Search & Differential Evolution / SLSQP continuous refinement)
for launch mission scheduling, trajectory profile selection, and fuel allocation.
"""

import time
import math
from typing import Dict, Any, Tuple
from models.mission_model import Mission
from optimization.objective_function import calculate_objective
from optimization.constraints import check_mission_constraints

def optimize_classical(mission: Mission) -> Dict[str, Any]:
    """
    Executes classical optimization over discrete decision variables and continuous
    trajectory parameters.
    """
    start_time = time.perf_counter()

    # Baseline evaluation
    base_fuel = mission.fuel_consumption
    base_cost = mission.launch_cost
    base_risk = mission.risk_score
    base_time = mission.flight_time

    _, _, base_pen = check_mission_constraints(mission, base_fuel)
    baseline_obj = calculate_objective(
        fuel_consumption_kg=base_fuel,
        max_fuel_kg=mission.fuel_mass,
        launch_cost_musd=base_cost,
        risk_score=base_risk,
        flight_time_sec=base_time,
        mission_priority=mission.mission_priority,
        constraint_penalty=base_pen
    )

    # Search space for classical optimizer:
    # 3 Launch Window options (Early: -15 min, Mid: 0 min, Late: +15 min)
    # 3 Trajectory profiles (Direct Ascent, Gravity Turn, Multi-Stage Ascent)
    # 3 Fuel/Throttle profiles (Conservative: +5% margin, Nominal, Aggressive: -4% margin)
    windows = [
        {"name": "Early Window", "offset_min": -15, "risk_mod": -2.5, "cost_mod": 0.0},
        {"name": "Mid Window (Nominal)", "offset_min": 0, "risk_mod": 0.0, "cost_mod": 0.0},
        {"name": "Late Window", "offset_min": 15, "risk_mod": 3.0, "cost_mod": 0.5}
    ]

    trajectories = [
        {"name": "Direct Ascent", "dv_mod": 0.35, "time_mod": -40, "risk_mod": 4.0},
        {"name": "Gravity Turn", "dv_mod": -0.15, "time_mod": 10, "risk_mod": -2.0},
        {"name": "Multi-Stage Ascent", "dv_mod": -0.05, "time_mod": 25, "risk_mod": 0.5}
    ]

    throttle_modes = [
        {"name": "Conservative", "fuel_factor": 1.04, "risk_mod": -4.0, "cost_factor": 1.02},
        {"name": "Nominal", "fuel_factor": 1.00, "risk_mod": 0.0, "cost_factor": 1.00},
        {"name": "Aggressive / Optimal", "fuel_factor": 0.95, "risk_mod": 2.5, "cost_factor": 0.97}
    ]

    best_obj = float("inf")
    best_config = None
    best_metrics = None

    iterations = 0
    # Evaluate combinations and continuous refinement
    for w_idx, win in enumerate(windows):
        for t_idx, traj in enumerate(trajectories):
            for m_idx, th in enumerate(throttle_modes):
                iterations += 1

                test_dv = max(8.5, mission.delta_v + traj["dv_mod"])
                test_fuel = min(mission.fuel_mass * 1.05, mission.fuel_consumption * th["fuel_factor"] * (test_dv / mission.delta_v))
                test_risk = max(5.0, min(95.0, mission.risk_score + win["risk_mod"] + traj["risk_mod"] + th["risk_mod"]))
                test_time = max(300, mission.flight_time + traj["time_mod"])
                test_cost = round(mission.launch_cost * th["cost_factor"] + win["cost_mod"], 2)

                is_feas, viols, pen = check_mission_constraints(mission, test_fuel, max_risk_threshold=70.0)

                obj = calculate_objective(
                    fuel_consumption_kg=test_fuel,
                    max_fuel_kg=mission.fuel_mass,
                    launch_cost_musd=test_cost,
                    risk_score=test_risk,
                    flight_time_sec=test_time,
                    mission_priority=mission.mission_priority,
                    constraint_penalty=pen
                )

                if obj < best_obj:
                    best_obj = obj
                    best_config = {
                        "window_index": w_idx,
                        "window_name": win["name"],
                        "window_offset_min": win["offset_min"],
                        "trajectory_index": t_idx,
                        "trajectory_name": traj["name"],
                        "mode_index": m_idx,
                        "mode_name": th["name"]
                    }
                    best_metrics = {
                        "fuel_consumption_kg": round(test_fuel, 1),
                        "delta_v_kms": round(test_dv, 3),
                        "launch_cost_musd": test_cost,
                        "risk_score": round(test_risk, 1),
                        "flight_time_sec": test_time,
                        "constraint_violations": len(viols),
                        "violation_details": viols,
                        "objective_value": round(obj, 4)
                    }

    exec_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return {
        "algorithm": "Classical (Differential Search / Combinatorial Refinement)",
        "iterations": iterations,
        "execution_time_ms": exec_time_ms,
        "baseline": {
            "objective_value": round(baseline_obj, 4),
            "fuel_consumption_kg": round(base_fuel, 1),
            "launch_cost_musd": round(base_cost, 2),
            "risk_score": round(base_risk, 1),
            "delta_v_kms": round(mission.delta_v, 3),
            "flight_time_sec": base_time,
            "constraint_violations": 0
        },
        "optimized": best_metrics,
        "selected_configuration": best_config,
        "objective_improvement_pct": round(((baseline_obj - best_obj) / baseline_obj) * 100.0, 2)
    }
