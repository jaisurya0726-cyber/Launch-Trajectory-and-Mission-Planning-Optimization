"""
Orbit Model
Calculates celestial mechanics, orbital periods, orbital velocities,
and Hohmann transfer requirements around Earth.
"""

import math
from dataclasses import dataclass
from typing import Dict, Any, Tuple

EARTH_RADIUS = 6371.0       # km
EARTH_MU = 398600.4418      # km^3/s^2
J2 = 1.08263e-3             # Earth oblateness harmonic
EARTH_ROT_RATE = 7.292115e-5 # rad/s

@dataclass
class Orbit:
    name: str
    altitude_perigee: float   # km
    altitude_apogee: float    # km
    inclination: float        # degrees
    eccentricity: float = 0.0

    @property
    def semi_major_axis(self) -> float:
        rp = EARTH_RADIUS + self.altitude_perigee
        ra = EARTH_RADIUS + self.altitude_apogee
        return (rp + ra) / 2.0

    @property
    def circular_velocity(self) -> float:
        """Circular velocity at perigee altitude in km/s."""
        r = EARTH_RADIUS + self.altitude_perigee
        return math.sqrt(EARTH_MU / r)

    @property
    def orbital_period_minutes(self) -> float:
        """Period T = 2 * pi * sqrt(a^3 / mu) in minutes."""
        a = self.semi_major_axis
        period_sec = 2.0 * math.pi * math.sqrt((a ** 3) / EARTH_MU)
        return period_sec / 60.0

    def hohmann_transfer_delta_v(self, initial_leo_alt: float = 200.0) -> Tuple[float, float, float]:
        """
        Calculate Hohmann transfer delta-v from LEO parking orbit to this orbit.
        Returns: (dv1, dv2, total_dv) in km/s.
        """
        r1 = EARTH_RADIUS + initial_leo_alt
        r2 = EARTH_RADIUS + self.altitude_apogee

        v1_park = math.sqrt(EARTH_MU / r1)
        v2_target = math.sqrt(EARTH_MU / r2)

        # Transfer ellipse velocities
        v_tx_perigee = math.sqrt(EARTH_MU * (2.0 / r1 - 2.0 / (r1 + r2)))
        v_tx_apogee = math.sqrt(EARTH_MU * (2.0 / r2 - 2.0 / (r1 + r2)))

        dv1 = abs(v_tx_perigee - v1_park)
        dv2 = abs(v2_target - v_tx_apogee)
        return round(dv1, 3), round(dv2, 3), round(dv1 + dv2, 3)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "perigee_km": self.altitude_perigee,
            "apogee_km": self.altitude_apogee,
            "inclination_deg": self.inclination,
            "semi_major_axis_km": round(self.semi_major_axis, 1),
            "orbital_period_min": round(self.orbital_period_minutes, 2),
            "circular_velocity_kms": round(self.circular_velocity, 3)
        }


def create_target_orbit(orbit_type: str, altitude: float = None, inclination: float = None) -> Orbit:
    if orbit_type == "GEO":
        alt = 35786.0
        inc = 0.0 if inclination is None else inclination
        return Orbit("GEO", alt, alt, inc, eccentricity=0.0)
    elif orbit_type == "GTO":
        inc = 21.5 if inclination is None else inclination
        return Orbit("GTO", 250.0, 35786.0, inc, eccentricity=0.72)
    elif orbit_type == "SSO":
        alt = 700.0 if altitude is None else altitude
        inc = 98.2 if inclination is None else inclination
        return Orbit("SSO", alt, alt, inc, eccentricity=0.001)
    elif orbit_type == "Polar LEO":
        alt = 600.0 if altitude is None else altitude
        inc = 90.0 if inclination is None else inclination
        return Orbit("Polar LEO", alt, alt, inc, eccentricity=0.001)
    elif orbit_type == "MEO":
        alt = 10000.0 if altitude is None else altitude
        inc = 55.0 if inclination is None else inclination
        return Orbit("MEO", alt, alt, inc, eccentricity=0.01)
    elif orbit_type == "Highly Elliptical Orbit":
        return Orbit("HEO", 500.0, 39000.0, 63.4 if inclination is None else inclination, eccentricity=0.74)
    else:  # LEO
        alt = 400.0 if altitude is None else altitude
        inc = 28.5 if inclination is None else inclination
        return Orbit("LEO", alt, alt, inc, eccentricity=0.001)
