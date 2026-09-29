"""
Objective Function Module
Calculates the multi-objective fitness value for launch trajectory
and mission planning optimization.
"""

from typing import Dict, Any, List

def calculate_objective(
    fuel_consumption_kg: float,
    max_fuel_kg: float,
    launch_cost_musd: float,
    risk_score: float,
    flight_time_sec: float,
    mission_priority: int = 1,
    constraint_penalty: float = 0.0,
    weights: Dict[str, float] = None
) -> float:
    """
    Computes scalarized multi-objective cost (lower is better):
    J = w_fuel * (fuel / max_fuel) +
        w_cost * (cost / 150) +
        w_risk * (risk / 100) +
        w_time * (time / 3000) +
        w_prio * (priority / 5) +
        constraint_penalty
    """
    if weights is None:
        weights = {
            "w_fuel": 0.35,
            "w_cost": 0.25,
            "w_risk": 0.25,
            "w_time": 0.10,
            "w_priority": 0.05
        }

    norm_fuel = min(1.5, fuel_consumption_kg / max(1.0, max_fuel_kg))
    norm_cost = min(2.0, launch_cost_musd / 150.0)
    norm_risk = min(2.0, risk_score / 100.0)
    norm_time = min(2.0, flight_time_sec / 3000.0)
    norm_prio = (6 - mission_priority) / 5.0  # higher priority missions get slight preferential scale

    raw_obj = (
        weights.get("w_fuel", 0.35) * norm_fuel +
        weights.get("w_cost", 0.25) * norm_cost +
        weights.get("w_risk", 0.25) * norm_risk +
        weights.get("w_time", 0.10) * norm_time +
        weights.get("w_priority", 0.05) * norm_prio
    )

    total_objective = raw_obj * 100.0 + constraint_penalty
    return round(total_objective, 4)
