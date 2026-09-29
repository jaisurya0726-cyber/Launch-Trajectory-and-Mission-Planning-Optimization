"""
Mission Model
Represents complete launch mission specifications, environmental factors,
and evaluation metadata.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional

@dataclass
class Mission:
    mission_id: str
    satellite_name: str
    data_type: str
    launch_date: str
    launch_time: str
    launch_site: str
    rocket: str
    rocket_mass: float
    fuel_mass: float
    payload_capacity: float
    thrust: float
    specific_impulse: float
    payload_mass: float
    payload_volume: float
    target_orbit: str
    altitude: float
    inclination: float
    delta_v: float
    flight_time: int
    fuel_consumption: float
    weather_temperature: float
    wind_speed: float
    rain: float
    humidity: float
    safety_status: str
    launch_window_start: str
    launch_window_end: str
    launch_window_duration: int
    launch_cost: float
    risk_score: float
    mission_priority: int
    trajectory_type: str
    cross_section_area: float
    drag_coefficient: float
    fuel_margin: float
    payload_fraction: float
    thrust_to_weight_ratio: float
    mission_efficiency: float

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Mission":
        return cls(
            mission_id=str(data["mission_id"]),
            satellite_name=str(data["satellite_name"]),
            data_type=str(data.get("data_type", "Synthetic")),
            launch_date=str(data["launch_date"]),
            launch_time=str(data["launch_time"]),
            launch_site=str(data["launch_site"]),
            rocket=str(data["rocket"]),
            rocket_mass=float(data["rocket_mass"]),
            fuel_mass=float(data["fuel_mass"]),
            payload_capacity=float(data["payload_capacity"]),
            thrust=float(data["thrust"]),
            specific_impulse=float(data["specific_impulse"]),
            payload_mass=float(data["payload_mass"]),
            payload_volume=float(data.get("payload_volume", 0.0)),
            target_orbit=str(data["target_orbit"]),
            altitude=float(data["altitude"]),
            inclination=float(data["inclination"]),
            delta_v=float(data["delta_v"]),
            flight_time=int(float(data["flight_time"])),
            fuel_consumption=float(data["fuel_consumption"]),
            weather_temperature=float(data["weather_temperature"]),
            wind_speed=float(data["wind_speed"]),
            rain=float(data["rain"]),
            humidity=float(data["humidity"]),
            safety_status=str(data["safety_status"]),
            launch_window_start=str(data["launch_window_start"]),
            launch_window_end=str(data["launch_window_end"]),
            launch_window_duration=int(float(data["launch_window_duration"])),
            launch_cost=float(data["launch_cost"]),
            risk_score=float(data["risk_score"]),
            mission_priority=int(float(data["mission_priority"])),
            trajectory_type=str(data["trajectory_type"]),
            cross_section_area=float(data.get("cross_section_area", 10.0)),
            drag_coefficient=float(data.get("drag_coefficient", 0.32)),
            fuel_margin=float(data.get("fuel_margin", 0.05)),
            payload_fraction=float(data.get("payload_fraction", 0.02)),
            thrust_to_weight_ratio=float(data.get("thrust_to_weight_ratio", 1.3)),
            mission_efficiency=float(data.get("mission_efficiency", 100.0)),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
