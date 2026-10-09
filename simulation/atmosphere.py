"""
Seasonal Atmospheric Models & Scale Height Profile (Python)
Implements International Standard Atmosphere (ISA) and regional atmospheric profiles.
"""

from typing import Dict, Any

SEASONAL_PROFILES: Dict[str, Dict[str, Any]] = {
    "standard": {
        "id": "standard",
        "name": "ISA Standard Atmosphere",
        "season_label": "ICAO / NASA Reference",
        "description": "Standard international reference profile (15°C, 1013.25 hPa sea level).",
        "surface_temp_c": 15.0,
        "surface_pressure_hpa": 1013.25,
        "relative_humidity_pct": 0.0,
        "scale_height_m": 8500.0,
        "surface_density_kg_m3": 1.225,
        "lapse_rate_c_per_km": 6.5,
    },
    "monsoon": {
        "id": "monsoon",
        "name": "South Asian Monsoon",
        "season_label": "Hot & Saturated (Jun–Sep)",
        "description": "High humidity, warm air mass expanding lower troposphere with reduced surface density.",
        "surface_temp_c": 32.5,
        "surface_pressure_hpa": 1004.0,
        "relative_humidity_pct": 92.0,
        "scale_height_m": 8900.0,
        "surface_density_kg_m3": 1.152,
        "lapse_rate_c_per_km": 5.8,
    },
    "summer": {
        "id": "summer",
        "name": "Tropical Summer",
        "season_label": "Peak Thermal Expansion (Mar–May)",
        "description": "Thermal uplift raises scale height to 9,100 m, pushing density upward into Max-Q zone.",
        "surface_temp_c": 38.0,
        "surface_pressure_hpa": 1008.0,
        "relative_humidity_pct": 55.0,
        "scale_height_m": 9100.0,
        "surface_density_kg_m3": 1.131,
        "lapse_rate_c_per_km": 7.2,
    },
    "winter": {
        "id": "winter",
        "name": "Subtropical Winter Inversion",
        "season_label": "Cold Dense Surface (Dec–Feb)",
        "description": "Thermal inversion traps cool, highly dense air in the first 2 km, increasing liftoff drag.",
        "surface_temp_c": 18.0,
        "surface_pressure_hpa": 1016.5,
        "relative_humidity_pct": 48.0,
        "scale_height_m": 8200.0,
        "surface_density_kg_m3": 1.217,
        "lapse_rate_c_per_km": 5.2,
    },
    "cyclone": {
        "id": "cyclone",
        "name": "Bay of Bengal Depressive Storm",
        "season_label": "Extreme Low Pressure Front",
        "description": "Violent barometric drop with massive cloud water loading and high boundary layer turbulence.",
        "surface_temp_c": 26.0,
        "surface_pressure_hpa": 988.0,
        "relative_humidity_pct": 98.0,
        "scale_height_m": 8750.0,
        "surface_density_kg_m3": 1.150,
        "lapse_rate_c_per_km": 6.0,
    },
}

def get_profile(profile_id: str = "standard") -> Dict[str, Any]:
    return SEASONAL_PROFILES.get(profile_id, SEASONAL_PROFILES["standard"])
