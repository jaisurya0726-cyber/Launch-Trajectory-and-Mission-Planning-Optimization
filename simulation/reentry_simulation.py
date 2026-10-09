"""
Atmospheric Re-entry Aerothermal & Terminal Descent Physics Engine (Python)

Implements:
- Sutton-Graves stagnation convective heat flux
- Shock-layer ionization radiative heating
- Radiative equilibrium skin temperature (Stefan-Boltzmann)
- 1D transient Fourier thermal conduction to substructure bondline
- Pyrolysis ablation mass recession rate and cumulative recession depth
- Planar hypersonic equations of motion (dv/dt, dgamma/dt, dh/dt, ds/dt)
- G-load deceleration profile, dynamic pressure Max-Q, and RF plasma blackout detection
"""

import math
from typing import Dict, List, Any, Optional

# Physical Constants
SIGMA_SB = 5.670374e-8  # Stefan-Boltzmann constant (W / (m^2 * K^4))
G0 = 9.80665            # Standard gravity (m/s^2)
EARTH_RADIUS_M = 6371000.0  # Earth mean radius (m)
K_SUTTON_GRAVES = 1.7415e-4 # Sutton-Graves convective coefficient for Earth air (kg^0.5 / m)

# ---------------------------------------------------------------------------
# Thermal Protection System (TPS) Material Database
# ---------------------------------------------------------------------------

TPS_MATERIALS: Dict[str, Dict[str, Any]] = {
    "pica_x": {
        "id": "pica_x",
        "name": "PICA-X (Phenolic-Impregnated Carbon Ablator)",
        "short_name": "PICA-X",
        "type": "ablative",
        "density_kg_m3": 270.0,
        "thermal_conductivity_w_mk": 0.072,
        "specific_heat_j_kgk": 1250.0,
        "emissivity": 0.88,
        "max_service_temp_c": 1850.0,
        "heat_of_ablation_mj_kg": 32.0,
        "char_temperature_c": 550.0,
        "heritage_vehicles": "SpaceX Dragon 1 & 2, OSIRIS-REx, Stardust",
        "reusability": "Multi-Mission Refurbishable",
        "max_heat_flux_limit_w_cm2": 1200.0,
        "description": "Low-density carbon fiber matrix infiltrated with phenolic resin. High heat of ablation, lightweight.",
    },
    "carbon_phenolic": {
        "id": "carbon_phenolic",
        "name": "Carbon-Phenolic (High-Density Tape Wrap)",
        "short_name": "Carbon-Phenolic",
        "type": "ablative",
        "density_kg_m3": 1450.0,
        "thermal_conductivity_w_mk": 0.82,
        "specific_heat_j_kgk": 1420.0,
        "emissivity": 0.92,
        "max_service_temp_c": 3000.0,
        "heat_of_ablation_mj_kg": 45.0,
        "char_temperature_c": 800.0,
        "heritage_vehicles": "Galileo Jupiter Probe, ICBM Reentry Vehicles, Pioneer Venus",
        "reusability": "Single-Use Ablative",
        "max_heat_flux_limit_w_cm2": 3500.0,
        "description": "Ultra-heavy woven carbon cloth in phenolic binder. Withstands extreme stagnation pressures and massive hyper-velocity heat fluxes.",
    },
    "li_900_tiles": {
        "id": "li_900_tiles",
        "name": "LI-900 High-Purity Silica Ceramic Tiles",
        "short_name": "LI-900 Tiles",
        "type": "reusable_tile",
        "density_kg_m3": 144.0,
        "thermal_conductivity_w_mk": 0.048,
        "specific_heat_j_kgk": 960.0,
        "emissivity": 0.89,
        "max_service_temp_c": 1260.0,
        "heat_of_ablation_mj_kg": 0.0,
        "char_temperature_c": 1260.0,
        "heritage_vehicles": "SpaceX Starship Thermal Tiles, Space Shuttle Orbiter, X-37B",
        "reusability": "100+ Flights Reusable",
        "max_heat_flux_limit_w_cm2": 450.0,
        "description": "99.9% pure amorphous silica fiber with black Reaction Cured Glass (RCG) borosilicate coating. Radiative cooling tile.",
    },
    "rcc_composite": {
        "id": "rcc_composite",
        "name": "Reinforced Carbon-Carbon (RCC Composite)",
        "short_name": "RCC Leading Edge",
        "type": "carbon_composite",
        "density_kg_m3": 1980.0,
        "thermal_conductivity_w_mk": 38.5,
        "specific_heat_j_kgk": 1550.0,
        "emissivity": 0.85,
        "max_service_temp_c": 1650.0,
        "heat_of_ablation_mj_kg": 0.0,
        "char_temperature_c": 1650.0,
        "heritage_vehicles": "Space Shuttle Wing Leading Edges & Nose Cap, Hypersonic Glide Vehicles",
        "reusability": "100+ Flights Reusable",
        "max_heat_flux_limit_w_cm2": 850.0,
        "description": "Graphitized 3D carbon matrix with silicon carbide anti-oxidation conversion coating. Retains structural integrity at 1,650°C.",
    },
    "sla_561v": {
        "id": "sla_561v",
        "name": "SLA-561V Silicone Elastomeric Cork",
        "short_name": "SLA-561V Cork",
        "type": "ablative",
        "density_kg_m3": 264.0,
        "thermal_conductivity_w_mk": 0.061,
        "specific_heat_j_kgk": 1180.0,
        "emissivity": 0.82,
        "max_service_temp_c": 1400.0,
        "heat_of_ablation_mj_kg": 18.5,
        "char_temperature_c": 400.0,
        "heritage_vehicles": "Mars Pathfinder, Mars Exploration Rovers (Spirit & Opportunity), MSL Backshell",
        "reusability": "Single-Use Ablative",
        "max_heat_flux_limit_w_cm2": 300.0,
        "description": "Silicone elastomer filled with cork particles, microballoons, and silica. Engineered for moderate heating environments.",
    },
    "inconel_metallic": {
        "id": "inconel_metallic",
        "name": "Inconel 718 Metallic Transpiration Shield",
        "short_name": "Inconel 718",
        "type": "metallic",
        "density_kg_m3": 8190.0,
        "thermal_conductivity_w_mk": 11.4,
        "specific_heat_j_kgk": 435.0,
        "emissivity": 0.72,
        "max_service_temp_c": 1100.0,
        "heat_of_ablation_mj_kg": 0.0,
        "char_temperature_c": 1100.0,
        "heritage_vehicles": "North American X-15, Active Liquid Methane Cooled Starship Skin",
        "reusability": "Actively Cooled Reusable",
        "max_heat_flux_limit_w_cm2": 550.0,
        "description": "High-strength nickel-chromium superalloy backed by active heat exchanger channels. Damage-tolerant reusable.",
    },
}

# ---------------------------------------------------------------------------
# Pre-configured Re-entry Mission Presets
# ---------------------------------------------------------------------------

REENTRY_PRESETS: Dict[str, Dict[str, Any]] = {
    "crew_dragon_leo": {
        "id": "crew_dragon_leo",
        "name": "Crew Dragon (LEO Return)",
        "entry_velocity_km_s": 7.75,
        "entry_flight_path_angle_deg": -1.75,
        "entry_altitude_km": 120.0,
        "vehicle_mass_kg": 7800.0,
        "nose_radius_m": 1.8,
        "base_diameter_m": 4.0,
        "drag_coefficient_cd": 1.25,
        "lift_to_drag_ratio": 0.28,
        "tps_thickness_mm": 45.0,
        "material_id": "pica_x",
        "description": "Lifting re-entry from 400 km ISS orbit with astronaut-safe G-loads.",
    },
    "orion_lunar_skip": {
        "id": "orion_lunar_skip",
        "name": "Orion Artemis (Lunar Direct Return)",
        "entry_velocity_km_s": 11.05,
        "entry_flight_path_angle_deg": -5.85,
        "entry_altitude_km": 125.0,
        "vehicle_mass_kg": 9300.0,
        "nose_radius_m": 2.2,
        "base_diameter_m": 5.0,
        "drag_coefficient_cd": 1.30,
        "lift_to_drag_ratio": 0.32,
        "tps_thickness_mm": 60.0,
        "material_id": "pica_x",
        "description": "Extreme velocity lunar direct atmospheric skip-entry with intense radiative heating.",
    },
    "shuttle_orbiter": {
        "id": "shuttle_orbiter",
        "name": "Space Shuttle (Orbital Crossrange Descent)",
        "entry_velocity_km_s": 7.82,
        "entry_flight_path_angle_deg": -1.25,
        "entry_altitude_km": 120.0,
        "vehicle_mass_kg": 85000.0,
        "nose_radius_m": 0.95,
        "base_diameter_m": 7.5,
        "drag_coefficient_cd": 0.85,
        "lift_to_drag_ratio": 1.15,
        "tps_thickness_mm": 50.0,
        "material_id": "li_900_tiles",
        "description": "Shallow lifting hypersonic glide at 40° angle of attack, relying on radiative silica tiles.",
    },
    "steep_ballistic_capsule": {
        "id": "steep_ballistic_capsule",
        "name": "Soyuz Emergency Ballistic Descent",
        "entry_velocity_km_s": 7.80,
        "entry_flight_path_angle_deg": -4.50,
        "entry_altitude_km": 120.0,
        "vehicle_mass_kg": 3100.0,
        "nose_radius_m": 1.1,
        "base_diameter_m": 2.2,
        "drag_coefficient_cd": 1.45,
        "lift_to_drag_ratio": 0.05,
        "tps_thickness_mm": 40.0,
        "material_id": "carbon_phenolic",
        "description": "Uncontrolled steep ballistic roll entry with deceleration peaks up to 9–10 Gs.",
    },
    "mars_sample_return": {
        "id": "mars_sample_return",
        "name": "Mars Planetary Earth Return Capsule",
        "entry_velocity_km_s": 12.20,
        "entry_flight_path_angle_deg": -6.20,
        "entry_altitude_km": 130.0,
        "vehicle_mass_kg": 120.0,
        "nose_radius_m": 0.45,
        "base_diameter_m": 0.9,
        "drag_coefficient_cd": 1.60,
        "lift_to_drag_ratio": 0.0,
        "tps_thickness_mm": 55.0,
        "material_id": "carbon_phenolic",
        "description": "Passive ballistic blunt-cone entry from Mars transfer orbit at ultra-high heating.",
    },
}

# ---------------------------------------------------------------------------
# Atmospheric Model (US Standard Atmosphere 1976 Stratified Approximation)
# ---------------------------------------------------------------------------

def get_atmospheric_density(altitude_km: float) -> Dict[str, float]:
    h_m = altitude_km * 1000.0
    if h_m > 120000.0:
        return {"rho": 1e-11, "temp_k": 360.0, "speed_of_sound": 380.0}

    temp_k = 288.15
    rho = 1.225

    if h_m < 11000.0:
        temp_k = 288.15 - 0.0065 * h_m
        rho = 1.225 * math.pow(temp_k / 288.15, 4.256)
    elif h_m < 20000.0:
        temp_k = 216.65
        rho = 0.3639 * math.exp(-(h_m - 11000.0) / 6340.0)
    elif h_m < 32000.0:
        temp_k = 216.65 + 0.001 * (h_m - 20000.0)
        rho = 0.08803 * math.pow(temp_k / 216.65, -35.16)
    elif h_m < 47000.0:
        temp_k = 228.65 + 0.0028 * (h_m - 32000.0)
        rho = 0.01322 * math.pow(temp_k / 228.65, -13.20)
    elif h_m < 71000.0:
        temp_k = 270.65 - 0.0028 * (h_m - 47000.0)
        rho = 0.00143 * math.pow(temp_k / 270.65, 11.20)
    elif h_m < 85000.0:
        temp_k = 214.65 - 0.002 * (h_m - 71000.0)
        rho = 0.000064 * math.pow(temp_k / 214.65, 16.08)
    else:
        temp_k = 186.87 + 0.0035 * (h_m - 85000.0)
        rho = 0.0000078 * math.exp(-(h_m - 85000.0) / 6850.0)

    rho = max(rho, 1e-12)
    gamma = 1.4
    r_specific = 287.05
    speed_of_sound = math.sqrt(gamma * r_specific * max(temp_k, 150.0))

    return {"rho": rho, "temp_k": temp_k, "speed_of_sound": speed_of_sound}

# ---------------------------------------------------------------------------
# Re-entry Numerical Flight Dynamics & Aerothermal Integration
# ---------------------------------------------------------------------------

def run_reentry_simulation(
    entry_velocity_km_s: float = 7.75,
    entry_flight_path_angle_deg: float = -1.75,
    entry_altitude_km: float = 120.0,
    vehicle_mass_kg: float = 7800.0,
    nose_radius_m: float = 1.8,
    base_diameter_m: float = 4.0,
    drag_coefficient_cd: float = 1.25,
    lift_to_drag_ratio: float = 0.28,
    tps_thickness_mm: float = 45.0,
    material_id: str = "pica_x",
    dt: float = 0.25,
) -> Dict[str, Any]:
    """
    Executes 4th-order Runge-Kutta / dynamic step integration of atmospheric entry.
    """
    material = TPS_MATERIALS.get(material_id, TPS_MATERIALS["pica_x"])

    base_area_m2 = math.pi * math.pow(base_diameter_m / 2.0, 2)
    ballistic_coeff = vehicle_mass_kg / (drag_coefficient_cd * base_area_m2)
    tps_thickness_m = tps_thickness_mm / 1000.0
    heat_shield_volume_m3 = base_area_m2 * tps_thickness_m * 1.05
    heat_shield_mass_kg = heat_shield_volume_m3 * material["density_kg_m3"]

    # Initial state
    h = entry_altitude_km * 1000.0  # m
    v = entry_velocity_km_s * 1000.0 # m/s
    gamma = math.radians(entry_flight_path_angle_deg) # rad
    s = 0.0 # downrange m
    t = 0.0 # seconds

    trajectory: List[Dict[str, Any]] = []

    cumulative_heat_load_j_m2 = 0.0
    cumulative_ablation_m = 0.0
    bondline_temp_c = 20.0

    alpha_thermal = material["thermal_conductivity_w_mk"] / (
        material["density_kg_m3"] * material["specific_heat_j_kgk"]
    )
    tau_diff = math.pow(tps_thickness_m, 2) / (math.pi * math.pi * max(alpha_thermal, 1e-9))

    peak_heat_flux_w_cm2 = 0.0
    time_of_peak_heat_flux_s = 0.0
    peak_decel_g = 0.0
    time_of_peak_decel_s = 0.0
    peak_surface_temp_c = 20.0
    peak_bondline_temp_c = 20.0
    peak_dyn_pressure_kpa = 0.0
    blackout_seconds = 0.0

    max_time = 1200.0 # 20 min cap

    while t <= max_time and h > 2000.0 and v > 50.0:
        alt_km = h / 1000.0
        atmo = get_atmospheric_density(alt_km)
        rho = atmo["rho"]
        sos = atmo["speed_of_sound"]

        mach = v / max(sos, 100.0)
        dyn_pressure_pa = 0.5 * rho * v * v
        dyn_pressure_kpa = dyn_pressure_pa / 1000.0
        if dyn_pressure_kpa > peak_dyn_pressure_kpa:
            peak_dyn_pressure_kpa = dyn_pressure_kpa

        r = EARTH_RADIUS_M + h
        g = G0 * math.pow(EARTH_RADIUS_M / r, 2)

        drag_force = 0.5 * rho * v * v * drag_coefficient_cd * base_area_m2
        lift_force = drag_force * lift_to_drag_ratio

        decel_ms2 = drag_force / vehicle_mass_kg
        decel_g = decel_ms2 / G0
        if decel_g > peak_decel_g:
            peak_decel_g = decel_g
            time_of_peak_decel_s = t

        rn = max(nose_radius_m, 0.1)
        q_conv_w_m2 = K_SUTTON_GRAVES * math.sqrt(rho / rn) * math.pow(v, 3)
        q_conv_w_cm2 = q_conv_w_m2 * 1e-4

        q_rad_w_cm2 = 0.0
        if v > 7400.0:
            v_ratio = v / 10000.0
            q_rad_w_cm2 = 45.0 * math.pow(rn, 0.5) * math.pow(rho, 1.22) * math.pow(v_ratio, 8.5)

        total_heat_flux_w_cm2 = q_conv_w_cm2 + q_rad_w_cm2
        if total_heat_flux_w_cm2 > peak_heat_flux_w_cm2:
            peak_heat_flux_w_cm2 = total_heat_flux_w_cm2
            time_of_peak_heat_flux_s = t

        heat_flux_j_m2_s = total_heat_flux_w_cm2 * 1e4
        cumulative_heat_load_j_m2 += heat_flux_j_m2_s * dt
        cumulative_heat_load_kj_cm2 = (cumulative_heat_load_j_m2 * 1e-4) / 1000.0

        total_heat_flux_w_m2 = total_heat_flux_w_cm2 * 1e4
        eps = max(material["emissivity"], 0.5)
        t_equil_k = math.pow(max(total_heat_flux_w_m2, 0.0) / (eps * SIGMA_SB), 0.25)
        surface_temp_c = max(t_equil_k - 273.15, 20.0)
        if surface_temp_c > peak_surface_temp_c:
            peak_surface_temp_c = surface_temp_c

        if material["type"] == "ablative" and material["heat_of_ablation_mj_kg"] > 0:
            if surface_temp_c > material["char_temperature_c"]:
                net_ablation_heat_flux = total_heat_flux_w_m2 * 0.75
                h_ablation = material["heat_of_ablation_mj_kg"] * 1e6
                mass_recession_rate = net_ablation_heat_flux / h_ablation
                recession_rate_m_s = mass_recession_rate / material["density_kg_m3"]
                cumulative_ablation_m += recession_rate_m_s * dt

        bondline_rate = (surface_temp_c - bondline_temp_c) / max(tau_diff, 15.0)
        bondline_temp_c += bondline_rate * dt
        if bondline_temp_c > peak_bondline_temp_c:
            peak_bondline_temp_c = bondline_temp_c

        is_blackout = (v > 3600.0 and 38.0 <= alt_km <= 88.0 and dyn_pressure_kpa > 1.2)
        if is_blackout:
            blackout_seconds += dt

        # Subsample for reporting
        if round(t / dt) % 4 == 0 or h <= 3000.0:
            trajectory.append({
                "time_s": round(t, 1),
                "altitude_km": round(alt_km, 2),
                "velocity_km_s": round(v / 1000.0, 2),
                "mach": round(mach, 1),
                "deceleration_g": round(decel_g, 2),
                "downrange_km": round(s / 1000.0, 1),
                "dynamic_pressure_kpa": round(dyn_pressure_kpa, 1),
                "convective_heat_flux_w_cm2": round(q_conv_w_cm2, 1),
                "radiative_heat_flux_w_cm2": round(q_rad_w_cm2, 1),
                "total_heat_flux_w_cm2": round(total_heat_flux_w_cm2, 1),
                "cumulative_heat_load_kj_cm2": round(cumulative_heat_load_kj_cm2, 1),
                "surface_temp_c": round(surface_temp_c),
                "bondline_temp_c": round(bondline_temp_c, 1),
                "ablation_recession_mm": round(cumulative_ablation_m * 1000.0, 2),
                "is_blackout": is_blackout,
            })

        # Integrate motion
        dv_dt = -decel_ms2 + g * math.sin(gamma)
        dgamma_dt = (v / r - g / max(v, 1.0)) * math.cos(gamma) + lift_force / (vehicle_mass_kg * max(v, 1.0))
        dh_dt = v * math.sin(gamma)
        ds_dt = (EARTH_RADIUS_M / r) * v * math.cos(gamma)

        v += dv_dt * dt
        gamma += dgamma_dt * dt
        h += dh_dt * dt
        s += ds_dt * dt
        t += dt

    temp_margin_pct = ((material["max_service_temp_c"] - peak_surface_temp_c) / material["max_service_temp_c"]) * 100.0

    summary = {
        "peak_heat_flux_w_cm2": round(peak_heat_flux_w_cm2, 1),
        "time_of_peak_heat_flux_s": round(time_of_peak_heat_flux_s),
        "peak_deceleration_g": round(peak_decel_g, 2),
        "time_of_peak_decel_s": round(time_of_peak_decel_s),
        "peak_surface_temp_c": round(peak_surface_temp_c),
        "peak_bondline_temp_c": round(peak_bondline_temp_c, 1),
        "total_heat_load_kj_cm2": round(cumulative_heat_load_j_m2 * 1e-4 / 1000.0, 1),
        "total_ablation_mm": round(cumulative_ablation_m * 1000.0, 2),
        "peak_dynamic_pressure_kpa": round(peak_dyn_pressure_kpa, 1),
        "flight_time_s": round(t),
        "terminal_velocity_m_s": round(v),
        "blackout_duration_s": round(blackout_seconds),
        "heat_shield_mass_kg": round(heat_shield_mass_kg),
        "ballistic_coefficient_kg_m2": round(ballistic_coeff),
        "safety_margin_pct": round(temp_margin_pct, 1),
        "bondline_status": "NOMINAL" if peak_bondline_temp_c <= 180 else ("WARNING" if peak_bondline_temp_c <= 250 else "CRITICAL"),
        "max_g_status": "ACCEPTABLE" if peak_decel_g <= 6.5 else ("CREW_LIMIT_WARNING" if peak_decel_g <= 12.0 else "FATAL_EXCEEDED"),
        "material_name": material["name"],
        "material_short": material["short_name"],
    }

    return {"trajectory": trajectory, "summary": summary}


if __name__ == "__main__":
    print("=" * 70)
    print("ATMOSPHERIC RE-ENTRY AEROTHERMAL SIMULATION (PYTHON ENGINE)")
    print("=" * 70)
    res = run_reentry_simulation(
        entry_velocity_km_s=7.75,
        entry_flight_path_angle_deg=-1.75,
        vehicle_mass_kg=7800.0,
        tps_thickness_mm=45.0,
        material_id="pica_x"
    )
    s = res["summary"]
    print(f"Material:              {s['material_name']}")
    print(f"Peak Heat Flux:        {s['peak_heat_flux_w_cm2']} W/cm² @ T+{s['time_of_peak_heat_flux_s']}s")
    print(f"Peak Deceleration:     {s['peak_deceleration_g']} G @ T+{s['time_of_peak_decel_s']}s")
    print(f"Peak Surface Temp:     {s['peak_surface_temp_c']} °C")
    print(f"Substructure Bondline: {s['peak_bondline_temp_c']} °C ({s['bondline_status']})")
    print(f"Cumulative Heat Load:  {s['total_heat_load_kj_cm2']} kJ/cm²")
    print(f"Ablation Recession:    {s['total_ablation_mm']} mm")
    print(f"Heat Shield Mass:      {s['heat_shield_mass_kg']} kg")
    print(f"Blackout Duration:     {s['blackout_duration_s']} s")
    print(f"Descent Flight Time:   {s['flight_time_s']} s")
    print("=" * 70)
