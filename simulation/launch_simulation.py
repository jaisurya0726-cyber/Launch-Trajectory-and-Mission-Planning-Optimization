"""
Launch Simulation Module
Coordinates launch stages, environmental weather factors,
and telemetry event logs.
"""

from typing import Dict, Any, List
from models.mission_model import Mission
from simulation.trajectory_simulation import simulate_trajectory

def run_launch_simulation(mission: Mission) -> Dict[str, Any]:
    """Run complete launch simulation and generate mission flight log events."""
    traj_data = simulate_trajectory(mission)

    # Generate discrete flight milestones
    events = [
        {"time_s": 0.0, "event": "Ignition & Liftoff", "altitude_km": 0.0, "status": "NOMINAL"},
        {"time_s": 12.0, "event": "Pitchover Maneuver Initiated", "altitude_km": 1.2, "status": "NOMINAL"},
        {"time_s": 65.0, "event": "Max-Q (Maximum Dynamic Pressure)", "altitude_km": 11.5, "status": f"q = {traj_data['summary']['max_dynamic_pressure_kPa']} kPa"},
        {"time_s": round(traj_data['summary']['burn_time_sec'] * 0.45, 1), "event": "Stage 1 Separation", "altitude_km": 68.0, "status": "CONFIRMED"},
        {"time_s": round(traj_data['summary']['burn_time_sec'], 1), "event": "Main Engine Cutoff (MECO)", "altitude_km": round(traj_data['altitude_km'][-1] * 0.85, 1), "status": "NOMINAL"},
        {"time_s": float(mission.flight_time), "event": f"Orbital Insertion into {mission.target_orbit}", "altitude_km": mission.altitude, "status": "SUCCESS"}
    ]

    return {
        "mission_id": mission.mission_id,
        "satellite": mission.satellite_name,
        "rocket": mission.rocket,
        "target_orbit": mission.target_orbit,
        "trajectory_data": traj_data,
        "milestone_events": events,
        "safety_status": mission.safety_status,
        "risk_score": mission.risk_score
    }
