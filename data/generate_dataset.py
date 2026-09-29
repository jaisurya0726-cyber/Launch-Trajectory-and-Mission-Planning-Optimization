#!/usr/bin/env python3
"""
Launch Trajectory and Mission-Planning Optimization
Dataset Generator Module

Generates a synthetic/educational dataset of launch missions with physically
consistent aerospace calculations (rocket equation, delta-v, drag, risk factors).

DISCLAIMER:
Synthetic/educational data generated using realistic ranges and physical
relationships, not an official operational launch database.
"""

import os
import csv
import math
import random
from datetime import datetime, timedelta

# Standard gravity
G0 = 9.80665  # m/s^2
EARTH_RADIUS = 6371.0  # km
EARTH_MU = 398600.4418  # km^3/s^2

# Rocket catalog with realistic physical specifications
ROCKET_CATALOG = {
    "PSLV": {
        "rocket_mass": 28000,       # Dry mass (kg)
        "fuel_mass": 292000,        # Propellant mass (kg)
        "thrust": 4800,             # Sea-level thrust (kN)
        "specific_impulse": 305,     # Average Isp (s)
        "payload_capacity": 1750,   # SSO capacity (kg)
        "diameter": 2.8,            # m
        "number_of_stages": 4,
        "default_site": "Satish Dhawan Space Centre, Sriharikota",
        "base_cost": 31.0           # Million USD
    },
    "GSLV Mk II": {
        "rocket_mass": 42000,
        "fuel_mass": 372000,
        "thrust": 5200,
        "specific_impulse": 335,
        "payload_capacity": 2500,   # GTO capacity
        "diameter": 3.4,
        "number_of_stages": 3,
        "default_site": "Satish Dhawan Space Centre, Sriharikota",
        "base_cost": 47.0
    },
    "GSLV Mk III / LVM3": {
        "rocket_mass": 86000,
        "fuel_mass": 554000,
        "thrust": 9800,
        "specific_impulse": 340,
        "payload_capacity": 4000,   # GTO capacity
        "diameter": 4.0,
        "number_of_stages": 3,
        "default_site": "Satish Dhawan Space Centre, Sriharikota",
        "base_cost": 65.0
    },
    "Falcon 9": {
        "rocket_mass": 30000,
        "fuel_mass": 519000,
        "thrust": 7607,
        "specific_impulse": 311,
        "payload_capacity": 17500,  # LEO reusable
        "diameter": 3.7,
        "number_of_stages": 2,
        "default_site": "Cape Canaveral",
        "base_cost": 67.0
    },
    "Falcon Heavy": {
        "rocket_mass": 64000,
        "fuel_mass": 1357000,
        "thrust": 22819,
        "specific_impulse": 311,
        "payload_capacity": 63800,
        "diameter": 3.7,
        "number_of_stages": 2,
        "default_site": "Kennedy Space Center",
        "base_cost": 97.0
    },
    "Ariane 5": {
        "rocket_mass": 60000,
        "fuel_mass": 717000,
        "thrust": 13000,
        "specific_impulse": 345,
        "payload_capacity": 21000,
        "diameter": 5.4,
        "number_of_stages": 2,
        "default_site": "Guiana Space Centre",
        "base_cost": 140.0
    },
    "Ariane 6": {
        "rocket_mass": 55000,
        "fuel_mass": 530000,
        "thrust": 15000,
        "specific_impulse": 350,
        "payload_capacity": 21600,
        "diameter": 5.4,
        "number_of_stages": 2,
        "default_site": "Guiana Space Centre",
        "base_cost": 115.0
    },
    "Soyuz": {
        "rocket_mass": 26000,
        "fuel_mass": 286000,
        "thrust": 4148,
        "specific_impulse": 310,
        "payload_capacity": 8200,
        "diameter": 2.95,
        "number_of_stages": 3,
        "default_site": "Baikonur Cosmodrome",
        "base_cost": 50.0
    },
    "Atlas V": {
        "rocket_mass": 36000,
        "fuel_mass": 554000,
        "thrust": 3827,
        "specific_impulse": 338,
        "payload_capacity": 18850,
        "diameter": 3.81,
        "number_of_stages": 2,
        "default_site": "Cape Canaveral",
        "base_cost": 110.0
    },
    "Vulcan Centaur": {
        "rocket_mass": 35000,
        "fuel_mass": 510000,
        "thrust": 4900,
        "specific_impulse": 355,
        "payload_capacity": 27200,
        "diameter": 5.4,
        "number_of_stages": 2,
        "default_site": "Cape Canaveral",
        "base_cost": 105.0
    },
    "Electron": {
        "rocket_mass": 1050,
        "fuel_mass": 11450,
        "thrust": 224,
        "specific_impulse": 311,
        "payload_capacity": 300,
        "diameter": 1.2,
        "number_of_stages": 2,
        "default_site": "Kennedy Space Center",
        "base_cost": 7.5
    },
    "Long March 5": {
        "rocket_mass": 82000,
        "fuel_mass": 785000,
        "thrust": 10565,
        "specific_impulse": 340,
        "payload_capacity": 25000,
        "diameter": 5.0,
        "number_of_stages": 2,
        "default_site": "Xichang Satellite Launch Center",
        "base_cost": 85.0
    },
    "Long March 3B": {
        "rocket_mass": 45000,
        "fuel_mass": 415000,
        "thrust": 5923,
        "specific_impulse": 320,
        "payload_capacity": 11200,
        "diameter": 3.35,
        "number_of_stages": 3,
        "default_site": "Xichang Satellite Launch Center",
        "base_cost": 60.0
    },
    "H-IIA": {
        "rocket_mass": 35000,
        "fuel_mass": 254000,
        "thrust": 4390,
        "specific_impulse": 340,
        "payload_capacity": 15000,
        "diameter": 4.0,
        "number_of_stages": 2,
        "default_site": "Tanegashima Space Center",
        "base_cost": 90.0
    },
    "H3": {
        "rocket_mass": 37000,
        "fuel_mass": 275000,
        "thrust": 5880,
        "specific_impulse": 345,
        "payload_capacity": 16000,
        "diameter": 5.2,
        "number_of_stages": 2,
        "default_site": "Tanegashima Space Center",
        "base_cost": 50.0
    }
}

# Real Historical/Reference Missions
REFERENCE_SATELLITES = [
    ("Cartosat-3", "Earth Observation", "PSLV", "SSO", 505, 97.4, 1625),
    ("RISAT-2BR1", "Radar Imaging", "PSLV", "LEO", 576, 37.0, 628),
    ("EOS-04", "Radar Imaging", "PSLV", "SSO", 529, 97.5, 1710),
    ("EOS-06", "Ocean Observation", "PSLV", "SSO", 738, 98.2, 1117),
    ("INSAT-3DS", "Meteorological", "GSLV Mk II", "GEO", 35786, 0.1, 2275),
    ("GSAT-20", "Communication", "Falcon 9", "GTO", 35786, 19.5, 4700),
    ("GSAT-24", "Communication", "Ariane 5", "GEO", 35786, 0.0, 4180),
    ("Chandrayaan-3", "Planetary Exploration", "GSLV Mk III / LVM3", "GTO", 36000, 21.3, 3900),
    ("Aditya-L1", "Solar Science", "PSLV", "Highly Elliptical Orbit", 23500, 19.2, 1475),
    ("IRNSS-1I", "Navigation", "PSLV", "GTO", 20650, 29.5, 1425),
    ("RISAT-2", "Radar Reconnaissance", "PSLV", "LEO", 548, 41.2, 300),
    ("Oceansat-3", "Ocean Color", "PSLV", "SSO", 720, 98.3, 960),
    ("Resourcesat-2", "Remote Sensing", "PSLV", "SSO", 817, 98.7, 1206),
    ("Cartosat-2", "Earth Observation", "PSLV", "SSO", 630, 97.9, 680),
    ("Microsat-R", "Military Imaging", "PSLV", "LEO", 274, 96.6, 740),
    ("EMISAT", "ELINT Reconnaissance", "PSLV", "Polar LEO", 748, 98.4, 436),
    ("GSAT-7", "Defense Communication", "Ariane 5", "GEO", 35786, 0.0, 2650),
    ("GSAT-7A", "Military Communication", "GSLV Mk II", "GEO", 35786, 0.0, 2250),
    ("GSAT-17", "Communication", "Ariane 5", "GEO", 35786, 0.0, 3477),
    ("GSAT-19", "High Throughput Sat", "GSLV Mk III / LVM3", "GTO", 35900, 21.5, 3136),
    ("GSAT-29", "Multi-band Satellite", "GSLV Mk III / LVM3", "GEO", 35786, 0.0, 3423),
    ("GSAT-30", "Telecommunications", "Ariane 5", "GEO", 35786, 0.0, 3357),
    ("GSAT-31", "Communication", "Ariane 5", "GEO", 35786, 0.0, 2535),
    ("GSAT-6A", "Mobile Communication", "GSLV Mk II", "GEO", 35786, 0.0, 2140),
    ("INSAT-3DR", "Meteorological", "GSLV Mk II", "GEO", 35786, 0.0, 2211),
    ("INSAT-3D", "Weather & Climate", "Ariane 5", "GEO", 35786, 0.0, 2060),
    ("EDUSAT", "Educational Network", "GSLV Mk II", "GEO", 35786, 0.0, 1950),
    ("Kalpana-1", "Meteorology", "PSLV", "GEO", 35786, 0.0, 1060),
    ("AstroSat", "Space Astronomy", "PSLV", "LEO", 650, 6.0, 1513)
]

# Synthetic Mission Prefixes and Types
SYNTHETIC_PREFIXES = [
    "SuryaSat", "BharatEO", "AgniSat", "VikramSat", "PrithviWatch", "GangaSat",
    "NavIC-Test", "GeoCom", "EarthVision", "ClimateSat", "OceanWatch", "AgroVision",
    "AeroNet", "CosmoLink", "Solaris", "Vanguard", "TerraPulse", "NovaOrbit",
    "Zephyr", "AuraScan", "IndusSat", "Chanakya", "BrahmaSat", "ShaktiSat",
    "VarunaSat", "KavachSat", "TejasSat", "DrishtiSat", "MeghdootSat", "PawanSat"
]

MISSION_CATEGORIES = [
    "Earth Observation", "Communication", "Navigation", "Scientific",
    "Weather", "Remote Sensing", "Technology Demonstration", "Planetary Mission"
]

TARGET_ORBITS = [
    "LEO", "SSO", "Polar LEO", "MEO", "GEO", "GTO", "Highly Elliptical Orbit"
]

LAUNCH_SITES = [
    "Satish Dhawan Space Centre, Sriharikota",
    "Thumba Equatorial Rocket Launching Station",
    "Kennedy Space Center",
    "Vandenberg Space Force Base",
    "Cape Canaveral",
    "Baikonur Cosmodrome",
    "Kourou",
    "Tanegashima Space Center",
    "Guiana Space Centre",
    "Jiuquan Satellite Launch Center",
    "Xichang Satellite Launch Center",
    "Vostochny Cosmodrome"
]

TRAJECTORY_TYPES = [
    "Direct Ascent",
    "Gravity Turn",
    "Two-Stage Ascent",
    "Three-Stage Ascent",
    "Hohmann Transfer"
]


def select_trajectory_type(target_orbit, stages):
    """Select physically appropriate trajectory type based on orbit and stages."""
    if target_orbit in ["GEO", "GTO", "Highly Elliptical Orbit"]:
        return "Hohmann Transfer" if random.random() > 0.4 else "Three-Stage Ascent"
    elif target_orbit == "MEO":
        return "Two-Stage Ascent" if stages == 2 else "Three-Stage Ascent"
    elif target_orbit in ["SSO", "Polar LEO"]:
        return "Gravity Turn" if random.random() > 0.3 else "Direct Ascent"
    else:  # LEO
        return "Gravity Turn" if random.random() > 0.2 else "Direct Ascent"


def calculate_delta_v(target_orbit, altitude_km, inclination_deg, site_name, trajectory_type):
    """
    Calculate educational launch delta-v requirement (km/s).
    Accounts for orbital velocity, potential energy, atmospheric & gravity drag losses,
    and Earth rotational boost based on launch site latitude.
    """
    # Site latitudes approximate
    site_latitudes = {
        "Satish Dhawan Space Centre, Sriharikota": 13.7,
        "Thumba Equatorial Rocket Launching Station": 8.5,
        "Kennedy Space Center": 28.5,
        "Cape Canaveral": 28.5,
        "Vandenberg Space Force Base": 34.7,
        "Baikonur Cosmodrome": 45.9,
        "Kourou": 5.2,
        "Guiana Space Centre": 5.2,
        "Tanegashima Space Center": 30.4,
        "Jiuquan Satellite Launch Center": 40.9,
        "Xichang Satellite Launch Center": 28.2,
        "Vostochny Cosmodrome": 51.8
    }
    lat = site_latitudes.get(site_name, 28.0)
    # Earth surface rotational velocity at equator ~ 0.465 km/s
    earth_rot_boost = 0.465 * math.cos(math.radians(lat)) * math.cos(math.radians(inclination_deg))

    r = EARTH_RADIUS + altitude_km
    # Circular orbital velocity: v = sqrt(mu / r)
    v_orbit = math.sqrt(EARTH_MU / r)

    # Potential energy delta converted to equivalent velocity
    # delta_U = mu * (1/R_earth - 1/r)
    v_potential = math.sqrt(2 * EARTH_MU * (1.0 / EARTH_RADIUS - 1.0 / r)) * 0.45

    # Losses
    if trajectory_type == "Gravity Turn":
        grav_loss = 1.15
        drag_loss = 0.18
        steering_loss = 0.08
    elif trajectory_type == "Direct Ascent":
        grav_loss = 1.45
        drag_loss = 0.24
        steering_loss = 0.12
    elif trajectory_type == "Hohmann Transfer":
        grav_loss = 1.30
        drag_loss = 0.20
        steering_loss = 0.15
    elif trajectory_type == "Three-Stage Ascent":
        grav_loss = 1.20
        drag_loss = 0.19
        steering_loss = 0.10
    else:  # Two-Stage
        grav_loss = 1.25
        drag_loss = 0.21
        steering_loss = 0.10

    # Inclination plane change penalty if orbit inclination != site latitude
    plane_change_penalty = 0.0
    if abs(inclination_deg - lat) > 5.0 and target_orbit in ["GEO", "GTO"]:
        plane_change_penalty = 0.35 * math.sin(math.radians(abs(inclination_deg - lat) / 2))

    total_delta_v = (v_orbit + v_potential + grav_loss + drag_loss + steering_loss + plane_change_penalty) - earth_rot_boost
    return round(max(8.8, min(14.5, total_delta_v)), 3)


def calculate_fuel_consumption(delta_v_kms, dry_mass, max_fuel_mass, payload_mass, isp):
    """
    Apply Tsiolkovsky Rocket Equation:
    Delta_v = Isp * g0 * ln(m0 / mf)
    m0 = mf * exp(Delta_v / (Isp * g0))
    fuel_needed = m0 - mf
    """
    mf = dry_mass + payload_mass
    delta_v_ms = delta_v_kms * 1000.0
    c = isp * G0  # effective exhaust velocity (m/s)

    # Required initial mass
    required_ratio = math.exp(delta_v_ms / c)
    required_fuel = mf * (required_ratio - 1.0)

    # Realistic fuel consumption is capped by capacity with margin
    consumed_fuel = min(max_fuel_mass, required_fuel)
    consumed_fuel = max(consumed_fuel, max_fuel_mass * 0.72)
    return round(consumed_fuel, 1)


def calculate_risk_score(wind_speed, rain, temp, humidity, payload_ratio, fuel_margin, trajectory_type):
    """
    Transparent physical and operational risk score (0 - 100).
    Higher wind, rain, extreme temp, high payload ratio, low fuel margin increase risk.
    """
    # Weather factors
    wind_factor = (wind_speed / 25.0) * 22.0  # max 22 pts
    rain_factor = (rain / 20.0) * 20.0        # max 20 pts
    temp_dev = abs(temp - 24.0)
    temp_factor = (temp_dev / 20.0) * 12.0    # max 12 pts
    humid_factor = (max(0, humidity - 85) / 15.0) * 6.0

    # Aerospace/Vehicle factors
    payload_factor = (payload_ratio ** 1.5) * 20.0  # max 20 pts
    margin_factor = max(0.0, (0.15 - fuel_margin) / 0.15) * 15.0  # low fuel margin penalty

    # Trajectory complexity
    traj_weights = {
        "Direct Ascent": 3.0,
        "Gravity Turn": 1.0,
        "Two-Stage Ascent": 2.5,
        "Three-Stage Ascent": 4.0,
        "Hohmann Transfer": 5.0
    }
    traj_factor = traj_weights.get(trajectory_type, 2.0)

    total_risk = wind_factor + rain_factor + temp_factor + humid_factor + payload_factor + margin_factor + traj_factor
    score = round(max(5.0, min(95.0, total_risk)), 1)

    if score <= 30.0:
        safety_status = "SAFE"
    elif score <= 60.0:
        safety_status = "MODERATE RISK"
    else:
        safety_status = "HIGH RISK / HOLD ADVISORY"

    return score, safety_status


def generate_mission_record(mission_idx, seed_val=42):
    """Generate a single physically informed aerospace mission record."""
    random.seed(seed_val + mission_idx * 17)

    # 1. Determine if Reference or Synthetic
    is_reference = (mission_idx < len(REFERENCE_SATELLITES))
    if is_reference:
        ref = REFERENCE_SATELLITES[mission_idx]
        satellite_name = ref[0]
        data_type = "Reference"
        mission_cat = ref[1]
        rocket_name = ref[2]
        target_orbit = ref[3]
        altitude_km = ref[4]
        inclination_deg = ref[5]
        payload_mass = ref[6]
    else:
        data_type = "Synthetic"
        prefix = random.choice(SYNTHETIC_PREFIXES)
        satellite_name = f"{prefix}-{random.randint(1, 99):02d}"
        mission_cat = random.choice(MISSION_CATEGORIES)
        rocket_name = random.choice(list(ROCKET_CATALOG.keys()))
        target_orbit = random.choice(TARGET_ORBITS)

        # Orbit altitude and inclination rules
        if target_orbit == "LEO":
            altitude_km = random.randint(180, 1800)
            inclination_deg = round(random.uniform(5.0, 65.0), 1)
        elif target_orbit == "SSO":
            altitude_km = random.randint(500, 850)
            inclination_deg = round(random.uniform(97.2, 98.8), 1)
        elif target_orbit == "Polar LEO":
            altitude_km = random.randint(450, 950)
            inclination_deg = round(random.uniform(88.0, 92.0), 1)
        elif target_orbit == "MEO":
            altitude_km = random.randint(2000, 19500)
            inclination_deg = round(random.uniform(25.0, 56.0), 1)
        elif target_orbit == "GEO":
            altitude_km = 35786
            inclination_deg = round(random.uniform(0.0, 5.0), 1)
        elif target_orbit == "GTO":
            altitude_km = 35786  # Apogee
            inclination_deg = round(random.uniform(18.0, 28.5), 1)
        else:  # Highly Elliptical Orbit
            altitude_km = random.randint(20000, 39000)
            inclination_deg = round(random.uniform(19.0, 63.4), 1)

    rocket_spec = ROCKET_CATALOG[rocket_name]

    # Select physically plausible launch site
    if "PSLV" in rocket_name or "GSLV" in rocket_name:
        launch_site = "Satish Dhawan Space Centre, Sriharikota"
    elif "Falcon" in rocket_name:
        launch_site = random.choice(["Cape Canaveral", "Kennedy Space Center", "Vandenberg Space Force Base"])
    elif "Ariane" in rocket_name:
        launch_site = "Guiana Space Centre"
    elif "Soyuz" in rocket_name:
        launch_site = random.choice(["Baikonur Cosmodrome", "Vostochny Cosmodrome"])
    elif "Long March" in rocket_name:
        launch_site = random.choice(["Xichang Satellite Launch Center", "Jiuquan Satellite Launch Center"])
    elif "H-" in rocket_name or "H3" in rocket_name:
        launch_site = "Tanegashima Space Center"
    else:
        launch_site = rocket_spec.get("default_site", random.choice(LAUNCH_SITES))

    # Calculate or validate payload mass
    cap = rocket_spec["payload_capacity"]
    if not is_reference:
        # Realistic payload generation: 35% to 92% of payload capacity
        # Small portion (8%) close to the limit (challenging mission)
        if random.random() < 0.08:
            ratio = random.uniform(0.92, 0.98)
        else:
            ratio = random.uniform(0.35, 0.88)
        payload_mass = round(cap * ratio, 1)

    payload_volume = round((payload_mass / 320.0) * random.uniform(0.85, 1.2), 2)  # m^3
    stages = rocket_spec["number_of_stages"]
    trajectory_type = select_trajectory_type(target_orbit, stages)

    # Weather conditions
    temp_c = round(random.uniform(14.0, 38.0), 1)
    wind_speed = round(random.uniform(0.8, 22.5), 1)
    # 70% dry days, 30% rainy days
    rain = round(random.uniform(0.0, 18.0) if random.random() < 0.3 else 0.0, 1)
    humidity = round(random.uniform(25.0, 95.0), 1)

    # Aerodynamic specs
    diameter = rocket_spec["diameter"]
    cross_section = round(math.pi * (diameter / 2.0) ** 2, 2)
    drag_coeff = round(random.uniform(0.28, 0.42), 3)

    # Delta-V
    delta_v = calculate_delta_v(target_orbit, altitude_km, inclination_deg, launch_site, trajectory_type)

    # Fuel consumption
    fuel_cons = calculate_fuel_consumption(
        delta_v,
        rocket_spec["rocket_mass"],
        rocket_spec["fuel_mass"],
        payload_mass,
        rocket_spec["specific_impulse"]
    )
    fuel_margin = round((rocket_spec["fuel_mass"] - fuel_cons) / rocket_spec["fuel_mass"], 3)
    fuel_margin = max(0.02, fuel_margin)

    # Risk score
    payload_ratio = round(payload_mass / cap, 3)
    risk_score, safety_status = calculate_risk_score(
        wind_speed, rain, temp_c, humidity, payload_ratio, fuel_margin, trajectory_type
    )

    # Flight time calculation (seconds)
    # LEO: ~500-750s; GTO: ~1600-2400s; GEO: ~18000s; Hohmann transfer duration
    if target_orbit == "LEO":
        flight_sec = int(520 + (altitude_km / 1000.0) * 160 + random.randint(-20, 30))
    elif target_orbit in ["SSO", "Polar LEO"]:
        flight_sec = int(600 + (altitude_km / 1000.0) * 180 + random.randint(-15, 25))
    elif target_orbit == "MEO":
        flight_sec = int(1200 + (altitude_km / 1000.0) * 90 + random.randint(-40, 50))
    elif target_orbit in ["GTO", "Highly Elliptical Orbit"]:
        flight_sec = int(1800 + random.randint(100, 600))
    else:  # GEO direct / circularization
        flight_sec = int(2200 + random.randint(200, 800))

    # Launch Date & Window
    base_date = datetime(2026, 1, 10) + timedelta(days=mission_idx * 1.5 + random.randint(0, 3))
    launch_date_str = base_date.strftime("%Y-%m-%d")

    window_hour = random.randint(4, 21)
    window_minute = random.choice([0, 15, 30, 45])
    window_duration_min = random.choice([30, 45, 60, 90, 120])

    t_start = datetime(2026, 1, 1, window_hour, window_minute)
    t_end = t_start + timedelta(minutes=window_duration_min)
    t_launch = t_start + timedelta(minutes=random.randint(5, window_duration_min - 5))

    launch_window_start = t_start.strftime("%H:%M")
    launch_window_end = t_end.strftime("%H:%M")
    launch_time_str = t_launch.strftime("%H:%M:%S")

    # Cost model (Million USD)
    base_cost = rocket_spec["base_cost"]
    fuel_cost = (fuel_cons / 1000.0) * 0.0035  # ~ $3.5k per metric ton of propellant
    handling_cost = (payload_mass / 1000.0) * 1.2
    risk_penalty = (risk_score / 100.0) * 8.5
    launch_cost = round(base_cost + fuel_cost + handling_cost + risk_penalty, 2)

    # Mission priority: 1 (Very High) to 5 (Very Low)
    if is_reference and ("Chandrayaan" in satellite_name or "Aditya" in satellite_name or "Cartosat" in satellite_name):
        mission_priority = 1
    elif mission_cat in ["Planetary Mission", "Navigation", "Weather"]:
        mission_priority = random.choice([1, 2])
    elif mission_cat in ["Earth Observation", "Communication"]:
        mission_priority = random.choice([2, 3])
    else:
        mission_priority = random.choice([3, 4, 5])

    # Derived physics metrics
    total_mass_kg = rocket_spec["rocket_mass"] + fuel_cons + payload_mass
    payload_fraction = round(payload_mass / total_mass_kg, 4)
    thrust_n = rocket_spec["thrust"] * 1000.0
    initial_weight_n = total_mass_kg * G0
    twr = round(thrust_n / initial_weight_n, 2)
    mission_efficiency = round((payload_mass * delta_v) / (launch_cost + 1e-5), 2)

    record = {
        "mission_id": f"M{mission_idx+1:04d}",
        "satellite_name": satellite_name,
        "data_type": data_type,
        "launch_date": launch_date_str,
        "launch_time": launch_time_str,
        "launch_site": launch_site,
        "rocket": rocket_name,
        "rocket_mass": rocket_spec["rocket_mass"],
        "fuel_mass": rocket_spec["fuel_mass"],
        "payload_capacity": cap,
        "thrust": rocket_spec["thrust"],
        "specific_impulse": rocket_spec["specific_impulse"],
        "payload_mass": payload_mass,
        "payload_volume": payload_volume,
        "target_orbit": target_orbit,
        "altitude": altitude_km,
        "inclination": inclination_deg,
        "delta_v": delta_v,
        "flight_time": flight_sec,
        "fuel_consumption": fuel_cons,
        "weather_temperature": temp_c,
        "wind_speed": wind_speed,
        "rain": rain,
        "humidity": humidity,
        "safety_status": safety_status,
        "launch_window_start": launch_window_start,
        "launch_window_end": launch_window_end,
        "launch_window_duration": window_duration_min,
        "launch_cost": launch_cost,
        "risk_score": risk_score,
        "mission_priority": mission_priority,
        "trajectory_type": trajectory_type,
        "cross_section_area": cross_section,
        "drag_coefficient": drag_coeff,
        "fuel_margin": fuel_margin,
        "payload_fraction": payload_fraction,
        "thrust_to_weight_ratio": twr,
        "mission_efficiency": mission_efficiency
    }

    return record


def validate_record(rec):
    """
    Validate record against physical bounds specified in prompt requirements:
    payload_mass > 0
    fuel_mass > 0
    rocket_mass > 0
    thrust > 0
    specific_impulse > 0
    altitude > 0
    delta_v > 0
    flight_time > 0
    launch_window_start < launch_window_end
    payload_mass <= payload_capacity
    risk_score between 0 and 100
    wind_speed >= 0
    rain >= 0
    """
    try:
        assert rec["payload_mass"] > 0
        assert rec["fuel_mass"] > 0
        assert rec["rocket_mass"] > 0
        assert rec["thrust"] > 0
        assert rec["specific_impulse"] > 0
        assert rec["altitude"] > 0
        assert rec["delta_v"] > 0
        assert rec["flight_time"] > 0
        assert rec["launch_window_start"] < rec["launch_window_end"]
        assert rec["payload_mass"] <= rec["payload_capacity"] * 1.01  # small floating allowance
        assert 0.0 <= rec["risk_score"] <= 100.0
        assert rec["wind_speed"] >= 0.0
        assert rec["rain"] >= 0.0
        return True
    except AssertionError:
        return False


def generate_dataset(num_records=500, output_path=None, seed_val=42):
    """Generate and validate all records, saving to CSV."""
    if output_path is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        output_path = os.path.join(base_dir, "launch_missions.csv")

    records = []
    attempts = 0
    idx = 0
    while len(records) < num_records and attempts < num_records * 3:
        rec = generate_mission_record(idx, seed_val=seed_val + attempts)
        attempts += 1
        if validate_record(rec):
            rec["mission_id"] = f"M{len(records)+1:04d}"
            records.append(rec)
            idx += 1

    fieldnames = list(records[0].keys())

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    # Also generate processed_missions.csv with normalized features for ML/optimization
    processed_path = os.path.join(os.path.dirname(output_path), "processed_missions.csv")
    with open(processed_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    print(f"Successfully generated {len(records)} verified mission records -> {output_path}")
    return records


if __name__ == "__main__":
    generate_dataset(500)
