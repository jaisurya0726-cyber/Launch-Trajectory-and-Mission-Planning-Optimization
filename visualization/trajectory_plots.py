"""
Trajectory Plots Module
Generates data structures and SVG/matplotlib trajectory charts.
"""

from typing import Dict, Any, List

def format_trajectory_plot_data(trajectory_data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepares structured series data for plotting altitude, velocity, mass, fuel, and drag."""
    return {
        "time": trajectory_data["time"],
        "series": {
            "altitude_km": trajectory_data["altitude_km"],
            "velocity_ms": trajectory_data["velocity_ms"],
            "acceleration_ms2": trajectory_data["acceleration_ms2"],
            "accel_g": trajectory_data["accel_g"],
            "fuel_remaining_kg": trajectory_data["fuel_remaining_kg"],
            "mass_kg": trajectory_data["mass_kg"],
            "drag_kN": trajectory_data["drag_kN"],
            "dynamic_pressure_kPa": trajectory_data["dynamic_pressure_kPa"]
        },
        "summary": trajectory_data["summary"]
    }
