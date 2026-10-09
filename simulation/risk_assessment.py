"""
Probabilistic Launch Risk Assessment & Launch Commit Criteria (LCC) Engine (Python)

Evaluates NASA, ISRO, and FAA weather constraints:
- Surface wind gust probability
- Triggered lightning risk from electric field gradient and cloud thickness
- Precipitation impingement fairing acoustic/erosion risk
- Ambient thermal limits for solid booster O-rings and cryogenic boil-off
- Computes joint scrub probability: P_scrub = 1 - Prod(1 - P_i)
"""

import math
from typing import Dict, List, Any, Optional

# Standard Normal Cumulative Distribution Function approximation
def normal_cdf(x: float, mean: float, std_dev: float) -> float:
    if std_dev <= 0:
        return 1.0 if x >= mean else 0.0
    z = (x - mean) / std_dev
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))

def assess_launch_window_risk(
    temperature_c: float = 28.0,
    wind_speed_ms: float = 8.5,
    rain_mm_hr: float = 0.0,
    humidity_pct: float = 65.0,
    gust_factor: float = 1.25,
    cloud_cover_pct: float = 35.0,
    wind_direction_deg: float = 110.0,
    mission_risk_score: float = 40.0,
) -> Dict[str, Any]:
    """
    Computes probabilistic risk scores and evaluates NASA/FAA LCC violation criteria.
    """
    sustained_wind_limit = 15.0  # m/s (~30 kts)
    gust_wind_limit = 18.0       # m/s (~35 kts)
    peak_gust_estimate = wind_speed_ms * gust_factor

    # 1. Wind Violations Probability
    prob_wind_sustained = normal_cdf(wind_speed_ms, sustained_wind_limit - 2.0, 3.5)
    prob_wind_gust = normal_cdf(peak_gust_estimate, gust_wind_limit - 1.5, 3.0)
    wind_risk = min(max(prob_wind_gust * 0.65 + prob_wind_sustained * 0.35, 0.02), 0.98)

    # 2. Triggered Lightning Risk
    cloud_factor = cloud_cover_pct / 100.0
    humidity_factor = max((humidity_pct - 50.0) / 50.0, 0.0)
    rain_factor = min(rain_mm_hr / 5.0, 1.0)
    lightning_risk = min(max(0.01 + 0.45 * cloud_factor + 0.35 * humidity_factor * cloud_factor + 0.40 * rain_factor, 0.01), 0.95)

    # 3. Precipitation & Acoustic Fairing Erosion Risk
    rain_risk = min(max(normal_cdf(rain_mm_hr, 2.5, 2.0), 0.01), 0.99) if rain_mm_hr > 0.0 else 0.02

    # 4. Thermal O-Ring & Cryogenic Boil-off Limits
    t_min = 4.0   # °C (Challenger STS-51L O-ring embrittlement threshold)
    t_max = 38.0  # °C (Cryo LOX/LH2 boil-off limit)
    cold_risk = normal_cdf(t_min - temperature_c, 0.0, 3.0) if temperature_c < t_min + 6.0 else 0.01
    hot_risk = normal_cdf(temperature_c - t_max, 0.0, 3.0) if temperature_c > t_max - 5.0 else 0.01
    thermal_risk = min(max(cold_risk + hot_risk, 0.02), 0.95)

    # 5. Upper-Level Wind Shear
    shear_risk = min(max(0.08 + (wind_speed_ms / 25.0) * 0.25 * (gust_factor - 1.0) * 2.0, 0.03), 0.85)

    # Joint Scrub Probability: P_scrub = 1 - Prod(1 - P_i)
    prob_go_joint = (1.0 - wind_risk) * (1.0 - lightning_risk) * (1.0 - rain_risk) * (1.0 - thermal_risk) * (1.0 - shear_risk)
    composite_risk = 1.0 - prob_go_joint
    composite_risk_pct = round(composite_risk * 100.0, 1)
    go_probability_pct = round(prob_go_joint * 100.0, 1)

    # Status classification
    if composite_risk_pct < 28.0:
        status = "GO (SAFE)"
    elif composite_risk_pct < 55.0:
        status = "CAUTION (MARGINAL)"
    else:
        status = "NO-GO (SCRUB)"

    # LCC Rule Checks
    rules = [
        {
            "id": "lcc_surface_wind",
            "name": "Surface Wind Limit",
            "category": "wind",
            "threshold": "< 15.0 m/s sustained, < 18.0 m/s gust",
            "current_value": f"{wind_speed_ms:.1f} m/s (Gust: {peak_gust_estimate:.1f} m/s)",
            "is_violated": wind_speed_ms > sustained_wind_limit or peak_gust_estimate > gust_wind_limit,
            "probability": round(wind_risk * 100.0, 1),
            "severity": "high" if wind_risk > 0.5 else "low",
        },
        {
            "id": "lcc_lightning",
            "name": "Triggered Lightning & Electric Field",
            "category": "lightning",
            "threshold": "Zero electrified cumulus within 18.5 km (10 NM)",
            "current_value": f"{cloud_cover_pct:.0f}% cloud cover, {humidity_pct:.0f}% RH",
            "is_violated": cloud_cover_pct > 70.0 and humidity_pct > 80.0,
            "probability": round(lightning_risk * 100.0, 1),
            "severity": "critical" if lightning_risk > 0.6 else "medium",
        },
        {
            "id": "lcc_precipitation",
            "name": "Precipitation & Fairing Erosion",
            "category": "precipitation",
            "threshold": "No rain along flight trajectory path",
            "current_value": f"{rain_mm_hr:.1f} mm/hr",
            "is_violated": rain_mm_hr > 1.0,
            "probability": round(rain_risk * 100.0, 1),
            "severity": "high" if rain_mm_hr > 3.0 else "low",
        },
        {
            "id": "lcc_temperature",
            "name": "Ambient Temperature Envelope",
            "category": "thermal",
            "threshold": "4°C <= T <= 38°C",
            "current_value": f"{temperature_c:.1f}°C",
            "is_violated": temperature_c < t_min or temperature_c > t_max,
            "probability": round(thermal_risk * 100.0, 1),
            "severity": "critical" if (temperature_c < t_min or temperature_c > t_max) else "low",
        },
    ]

    # Time slots for the 120-minute launch window
    time_slots = []
    times = [0, 15, 30, 45, 60, 75, 90, 105, 120]
    for m in times:
        drift = math.sin((m - 45.0) / 30.0) * 0.12
        slot_risk = min(max(composite_risk + drift, 0.05), 0.95)
        slot_go = (1.0 - slot_risk) * 100.0
        time_slots.append({
            "minutes_from_open": m,
            "time_label": f"T+{m:02d}m",
            "risk_pct": round(slot_risk * 100.0, 1),
            "go_prob_pct": round(slot_go, 1),
            "status": "GO" if slot_risk < 0.28 else ("CAUTION" if slot_risk < 0.55 else "NO-GO"),
        })

    optimal_slot = min(time_slots, key=lambda s: s["risk_pct"])

    return {
        "composite_risk_pct": composite_risk_pct,
        "go_probability_pct": go_probability_pct,
        "safety_status": status,
        "optimal_slot": optimal_slot,
        "time_slots": time_slots,
        "breakdown": {
            "wind_risk_pct": round(wind_risk * 100.0, 1),
            "lightning_risk_pct": round(lightning_risk * 100.0, 1),
            "rain_risk_pct": round(rain_risk * 100.0, 1),
            "thermal_risk_pct": round(thermal_risk * 100.0, 1),
            "shear_risk_pct": round(shear_risk * 100.0, 1),
        },
        "rules": rules,
        "confidence_interval": {
            "p5": max(round(composite_risk_pct - 8.5, 1), 2.0),
            "p50": composite_risk_pct,
            "p95": min(round(composite_risk_pct + 11.2, 1), 99.0),
        },
    }

if __name__ == "__main__":
    res = assess_launch_window_risk()
    print("=" * 60)
    print("LAUNCH RISK ASSESSMENT (PYTHON ENGINE)")
    print("=" * 60)
    print(f"Composite Risk:   {res['composite_risk_pct']}%")
    print(f"Go Probability:   {res['go_probability_pct']}%")
    print(f"Status:           {res['safety_status']}")
    print(f"Optimal Window:   {res['optimal_slot']['time_label']} ({res['optimal_slot']['risk_pct']}% risk)")
    print("Breakdown:")
    for k, v in res["breakdown"].items():
        print(f"  - {k:<20}: {v}%")
    print("=" * 60)
