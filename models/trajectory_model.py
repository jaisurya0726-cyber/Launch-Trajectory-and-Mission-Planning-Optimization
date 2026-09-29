"""
Trajectory Model
Physics equations of motion, atmospheric modeling, aerodynamic drag,
and gravity for launch vehicles.
"""

import math
from typing import Dict, Any, Tuple

# Physical constants
G0 = 9.80665              # m/s^2
EARTH_RADIUS_M = 6371000.0  # m
EARTH_MU = 3.986004418e14   # m^3/s^2
RHO_0 = 1.225             # kg/m^3 (sea-level density)
SCALE_HEIGHT = 8500.0     # m (troposphere/stratosphere mean scale height)


def gravity_at_altitude(altitude_m: float) -> float:
    """Compute local gravitational acceleration g(h) = mu / (R + h)^2."""
    r = EARTH_RADIUS_M + max(0.0, altitude_m)
    return EARTH_MU / (r * r)


def atmospheric_density(altitude_m: float) -> float:
    """Barometric exponential density model rho(h) = rho0 * exp(-h / H)."""
    if altitude_m > 140000.0:  # Above 140 km, drag is negligible for initial ascent
        return 0.0
    return RHO_0 * math.exp(-altitude_m / SCALE_HEIGHT)


def atmospheric_pressure_ratio(altitude_m: float) -> float:
    """Atmospheric pressure relative to sea level for Isp variation."""
    if altitude_m > 100000.0:
        return 0.0
    return math.exp(-altitude_m / SCALE_HEIGHT)


def aerodynamic_drag(velocity_ms: float, altitude_m: float, cd: float, area_m2: float) -> float:
    """Compute drag force F_d = 0.5 * rho * v^2 * Cd * A."""
    rho = atmospheric_density(altitude_m)
    return 0.5 * rho * (velocity_ms ** 2) * cd * area_m2


def trajectory_derivatives(
    t: float,
    state: Tuple[float, float, float, float, float],
    thrust_n: float,
    mass_flow_rate: float,
    cd: float,
    area_m2: float,
    pitchover_alt: float = 1200.0,
    target_orbit_alt_m: float = 500000.0
) -> Tuple[float, float, float, float, float]:
    """
    Computes state derivatives [dh/dt, dx/dt, dv/dt, dgamma/dt, dm/dt]
    state:
      h: altitude (m)
      x: downrange distance (m)
      v: velocity magnitude (m/s)
      gamma: flight path angle (rad, relative to local horizontal)
      m: current rocket mass (kg)
    """
    h, x, v, gamma, m = state

    # Ensure non-negative mass
    if m <= 0.0:
        return 0.0, 0.0, 0.0, 0.0, 0.0

    g = gravity_at_altitude(h)
    fd = aerodynamic_drag(v, h, cd, area_m2)

    # Altitude and downrange derivatives
    dh_dt = v * math.sin(gamma)
    r = EARTH_RADIUS_M + h
    dx_dt = (EARTH_RADIUS_M / r) * v * math.cos(gamma)

    # Acceleration along velocity vector
    dv_dt = (thrust_n - fd) / m - g * math.sin(gamma)

    # Flight path angle rate
    # Pitchover initiation after initial vertical ascent
    if h < pitchover_alt:
        # Near vertical ascent
        dgamma_dt = -0.001
    else:
        # Gravity turn dynamics: dgamma/dt = - (g - v^2 / r) * cos(gamma) / v
        if v > 15.0:
            centrifugal_term = (v * v) / r
            dgamma_dt = - (g - centrifugal_term) * math.cos(gamma) / v
        else:
            dgamma_dt = 0.0

    # Prevent pitching down below horizontal during initial ascent
    if gamma <= 0.02 and h < target_orbit_alt_m * 0.7:
        gamma = 0.02
        dgamma_dt = max(0.0, dgamma_dt)

    dm_dt = -mass_flow_rate

    return dh_dt, dx_dt, dv_dt, dgamma_dt, dm_dt
