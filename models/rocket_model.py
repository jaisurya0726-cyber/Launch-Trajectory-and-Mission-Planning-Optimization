"""
Rocket Model
Contains physical data structures and properties for launch vehicles.
"""

from dataclasses import dataclass
from typing import Dict, Any

G0 = 9.80665  # m/s^2

@dataclass
class RocketStage:
    stage_number: int
    dry_mass: float       # kg
    fuel_mass: float      # kg
    thrust: float         # N
    specific_impulse: float  # s
    burn_time: float      # s

@dataclass
class Rocket:
    name: str
    dry_mass: float              # kg
    fuel_mass: float             # kg
    thrust_vac: float            # N
    thrust_sl: float             # N
    specific_impulse: float      # s
    payload_capacity: float      # kg
    diameter: float              # m
    number_of_stages: int
    drag_coefficient: float = 0.32
    simulation_parameter: bool = True

    @property
    def total_wet_mass(self) -> float:
        return self.dry_mass + self.fuel_mass

    @property
    def cross_section_area(self) -> float:
        import math
        return math.pi * (self.diameter / 2.0) ** 2

    def thrust_at_pressure(self, ambient_pressure_ratio: float) -> float:
        """Interpolate thrust between sea-level and vacuum based on pressure ratio."""
        return self.thrust_sl + (1.0 - ambient_pressure_ratio) * (self.thrust_vac - self.thrust_sl)

    def fuel_consumption_rate(self) -> float:
        """Mass flow rate m_dot = Thrust / (Isp * g0) in kg/s."""
        return self.thrust_sl / (self.specific_impulse * G0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "dry_mass": self.dry_mass,
            "fuel_mass": self.fuel_mass,
            "thrust_sl_kN": self.thrust_sl / 1000.0,
            "thrust_vac_kN": self.thrust_vac / 1000.0,
            "specific_impulse": self.specific_impulse,
            "payload_capacity": self.payload_capacity,
            "diameter": self.diameter,
            "number_of_stages": self.number_of_stages,
            "cross_section_area": round(self.cross_section_area, 3),
            "simulation_parameter": self.simulation_parameter
        }


def get_rocket_by_name(name: str) -> Rocket:
    from data.generate_dataset import ROCKET_CATALOG
    if name not in ROCKET_CATALOG:
        name = "PSLV"
    spec = ROCKET_CATALOG[name]
    thrust_n = spec["thrust"] * 1000.0
    return Rocket(
        name=name,
        dry_mass=float(spec["rocket_mass"]),
        fuel_mass=float(spec["fuel_mass"]),
        thrust_sl=thrust_n,
        thrust_vac=thrust_n * 1.12,  # vac thrust ~12% higher
        specific_impulse=float(spec["specific_impulse"]),
        payload_capacity=float(spec["payload_capacity"]),
        diameter=float(spec["diameter"]),
        number_of_stages=int(spec["number_of_stages"]),
        simulation_parameter=True
    )
