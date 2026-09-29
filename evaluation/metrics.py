"""
Metrics Module
Defines performance and aerospace fidelity metrics for evaluating
classical and quantum optimization solutions.
"""

from typing import Dict, Any

def compute_aerospace_metrics(
    fuel_kg: float,
    max_fuel_kg: float,
    delta_v_kms: float,
    cost_musd: float,
    risk_score: float,
    flight_time_sec: float,
    payload_mass_kg: float
) -> Dict[str, Any]:
    """Calculate derived efficiency and operational metrics."""
    fuel_burn_ratio = round((fuel_kg / max(1.0, max_fuel_kg)) * 100.0, 2)
    payload_to_cost = round(payload_mass_kg / max(0.1, cost_musd), 2)  # kg / M$
    transport_efficiency = round((payload_mass_kg * delta_v_kms) / max(0.1, cost_musd), 2)

    return {
        "fuel_burn_ratio_pct": fuel_burn_ratio,
        "payload_to_cost_kg_per_musd": payload_to_cost,
        "transport_efficiency": transport_efficiency,
        "risk_category": "LOW" if risk_score <= 30 else ("MEDIUM" if risk_score <= 60 else "HIGH")
    }
