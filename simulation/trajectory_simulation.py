"""
Trajectory Simulation Module
Performs numerical integration of rocket flight equations of motion
using Runge-Kutta 4th-order integration.
"""

import math
from typing import Dict, Any, List
from models.mission_model import Mission
from models.trajectory_model import (
    gravity_at_altitude,
    atmospheric_density,
    aerodynamic_drag,
    trajectory_derivatives,
    EARTH_RADIUS_M,
    G0
)

def simulate_trajectory(
    mission: Mission,
    time_step: float = 2.0,
    max_duration: float = None,
    pitchover_altitude: float = 1200.0
) -> Dict[str, Any]:
    """
    Run 4th-order Runge-Kutta integration of the ascent trajectory.
    Returns full time-series telemetry.
    """
    if max_duration is None:
        max_duration = min(float(mission.flight_time), 1200.0)

    # Initial state
    # state = [h, x, v, gamma, m]
    initial_mass = mission.rocket_mass + mission.fuel_consumption + mission.payload_mass
    dry_plus_payload = mission.rocket_mass + mission.payload_mass

    # Initial launch parameters
    h = 0.0          # m
    x = 0.0          # m
    v = 0.5          # m/s (slight initial velocity to avoid zero division)
    gamma = math.radians(89.8)  # near vertical launch (rad)
    m = initial_mass

    thrust_n = mission.thrust * 1000.0
    cd = mission.drag_coefficient
    area_m2 = mission.cross_section_area
    mass_flow = (mission.thrust * 1000.0) / (mission.specific_impulse * G0)

    # Burn duration until available fuel is spent
    available_fuel = mission.fuel_consumption
    burn_time = available_fuel / mass_flow

    target_alt_m = mission.altitude * 1000.0

    times = []
    altitudes = []      # km
    velocities = []     # m/s
    accelerations = []  # m/s^2
    accel_g = []        # g
    masses = []         # kg
    fuel_remaining = [] # kg
    thrusts = []        # kN
    drags = []          # kN
    dynamic_pressures = [] # kPa
    gammas_deg = []     # degrees
    downranges = []     # km

    t = 0.0
    while t <= max_duration:
        # Current active thrust & mass flow
        if t <= burn_time:
            current_thrust = thrust_n
            current_mdot = mass_flow
        else:
            current_thrust = 0.0
            current_mdot = 0.0

        # Telemetry sample
        g_local = gravity_at_altitude(h)
        rho = atmospheric_density(h)
        fd = aerodynamic_drag(v, h, cd, area_m2)
        q = 0.5 * rho * (v ** 2) / 1000.0  # Dynamic pressure in kPa

        total_accel = ((current_thrust - fd) / m) - (g_local * math.sin(gamma))

        times.append(round(t, 1))
        altitudes.append(round(h / 1000.0, 2))
        velocities.append(round(v, 1))
        accelerations.append(round(total_accel, 2))
        accel_g.append(round(abs(total_accel) / G0, 2))
        masses.append(round(m, 0))
        fuel_rem = max(0.0, m - dry_plus_payload)
        fuel_remaining.append(round(fuel_rem, 0))
        thrusts.append(round(current_thrust / 1000.0, 1))
        drags.append(round(fd / 1000.0, 2))
        dynamic_pressures.append(round(q, 2))
        gammas_deg.append(round(math.degrees(gamma), 2))
        downranges.append(round(x / 1000.0, 2))

        # Check orbital insertion / apogee condition
        if h >= target_alt_m and v >= 7500.0:
            break

        # RK4 Step
        state = (h, x, v, gamma, m)
        k1 = trajectory_derivatives(t, state, current_thrust, current_mdot, cd, area_m2, pitchover_altitude, target_alt_m)

        state_k2 = tuple(state[i] + 0.5 * time_step * k1[i] for i in range(5))
        k2 = trajectory_derivatives(t + 0.5 * time_step, state_k2, current_thrust, current_mdot, cd, area_m2, pitchover_altitude, target_alt_m)

        state_k3 = tuple(state[i] + 0.5 * time_step * k2[i] for i in range(5))
        k3 = trajectory_derivatives(t + 0.5 * time_step, state_k3, current_thrust, current_mdot, cd, area_m2, pitchover_altitude, target_alt_m)

        state_k4 = tuple(state[i] + time_step * k3[i] for i in range(5))
        k4 = trajectory_derivatives(t + time_step, state_k4, current_thrust, current_mdot, cd, area_m2, pitchover_altitude, target_alt_m)

        h_new = state[0] + (time_step / 6.0) * (k1[0] + 2*k2[0] + 2*k3[0] + k4[0])
        x_new = state[1] + (time_step / 6.0) * (k1[1] + 2*k2[1] + 2*k3[1] + k4[1])
        v_new = state[2] + (time_step / 6.0) * (k1[2] + 2*k2[2] + 2*k3[2] + k4[2])
        gamma_new = state[3] + (time_step / 6.0) * (k1[3] + 2*k2[3] + 2*k3[3] + k4[3])
        m_new = max(dry_plus_payload, state[4] + (time_step / 6.0) * (k1[4] + 2*k2[4] + 2*k3[4] + k4[4]))

        h = max(0.0, h_new)
        x = x_new
        v = max(0.1, v_new)
        gamma = max(0.0, min(math.pi / 2, gamma_new))
        m = m_new

        t += time_step

    max_q = max(dynamic_pressures) if dynamic_pressures else 0.0
    max_accel = max(accel_g) if accel_g else 0.0

    return {
        "time": times,
        "altitude_km": altitudes,
        "velocity_ms": velocities,
        "acceleration_ms2": accelerations,
        "accel_g": accel_g,
        "mass_kg": masses,
        "fuel_remaining_kg": fuel_remaining,
        "thrust_kN": thrusts,
        "drag_kN": drags,
        "dynamic_pressure_kPa": dynamic_pressures,
        "flight_path_angle_deg": gammas_deg,
        "downrange_km": downranges,
        "summary": {
            "max_altitude_km": max(altitudes) if altitudes else 0.0,
            "final_velocity_ms": velocities[-1] if velocities else 0.0,
            "max_acceleration_g": max_accel,
            "max_dynamic_pressure_kPa": max_q,
            "burn_time_sec": round(burn_time, 1),
            "final_mass_kg": masses[-1] if masses else dry_plus_payload
        }
    }
