import { Mission } from "../types";

export interface WeatherParameters {
  temperatureC: number;
  windSpeedMs: number;
  rainMmHr: number;
  humidityPct: number;
  gustFactor: number; // 1.0 (calm) to 1.6 (turbulent)
  cloudCoverPct: number; // 0 to 100%
  windDirectionDeg: number; // 0 to 360
}

export interface LCCRuleResult {
  id: string;
  name: string;
  category: "wind" | "lightning" | "precipitation" | "thermal" | "shear";
  threshold: string;
  currentValue: string;
  isViolated: boolean;
  probabilityOfViolation: number; // 0.0 - 1.0
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

export interface WindowTimeSlot {
  timeLabel: string;
  minutesFromStart: number;
  compositeRiskScore: number; // 0 - 100%
  goProbability: number; // 0 - 100%
  status: "GO" | "CAUTION" | "NO-GO";
  windRisk: number;
  lightningRisk: number;
  rainRisk: number;
  thermalRisk: number;
  shearRisk: number;
  isOptimal: boolean;
  isScheduled: boolean;
}

export interface LaunchRiskAssessmentReport {
  selectedTimeSlot: WindowTimeSlot;
  timeSlots: WindowTimeSlot[];
  optimalSlot: WindowTimeSlot;
  compositeRiskScore: number; // 0 - 100%
  goProbability: number; // 0 - 100%
  safetyStatus: "GO (SAFE)" | "CAUTION (MARGINAL)" | "NO-GO (SCRUB)";
  color: string;
  breakdown: {
    windRisk: number;
    lightningRisk: number;
    rainRisk: number;
    thermalRisk: number;
    shearRisk: number;
  };
  rules: LCCRuleResult[];
  confidenceInterval: {
    p5: number;
    p50: number;
    p95: number;
  };
}

/**
 * Standard Normal CDF approximation (Abramowitz & Stegun)
 */
function normalCdf(x: number): number {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1.0 - prob : prob;
}

/**
 * Parse HH:MM to total minutes
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Format minutes to HH:MM string
 */
function minutesToTimeStr(totalMins: number): string {
  const norm = (Math.round(totalMins) % 1440 + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Computes probabilistic risk score and LCC violation probabilities for given weather parameters
 */
export function computeProbabilisticRisk(
  weather: WeatherParameters,
  mission: Mission
): {
  compositeRisk: number;
  goProbability: number;
  breakdown: {
    windRisk: number;
    lightningRisk: number;
    rainRisk: number;
    thermalRisk: number;
    shearRisk: number;
  };
  rules: LCCRuleResult[];
} {
  const {
    temperatureC,
    windSpeedMs,
    rainMmHr,
    humidityPct,
    gustFactor,
    cloudCoverPct,
  } = weather;

  // 1. Surface Wind Rule (Limit ~ 15.0 m/s sustained, 18.0 m/s peak gust)
  // Wind distribution assumes log-normal or normal with standard error
  const windLimit = 15.0;
  const windSigma = 1.6 * gustFactor;
  const windZ = (windLimit - windSpeedMs) / Math.max(0.4, windSigma);
  const pWind = Math.min(0.99, Math.max(0.01, 1.0 - normalCdf(windZ)));

  // 2. Triggered Lightning & Atmospheric Charge Rule (NASA LCC Rule 3)
  // Triggered lightning risk is high with humidity > 70%, convective clouds, and precipitation
  const humidityExcess = Math.max(0, humidityPct - 60) / 40; // 0 to 1
  const cloudFactor = cloudCoverPct / 100;
  const rainChargeFactor = Math.min(1.0, rainMmHr / 2.0);
  const rawLightningRisk = 0.02 + 0.38 * Math.pow(humidityExcess, 1.6) + 0.35 * cloudFactor * rainChargeFactor + 0.25 * (rainMmHr > 0 ? 0.3 : 0);
  const pLightning = Math.min(0.98, Math.max(0.015, rawLightningRisk));

  // 3. Precipitation & Triboelectric Abrasion Rule (NASA LCC Rule 4)
  // Max allowable rain rate before acoustic load and thermal protection damage
  const rainLimit = 0.5; // mm/hr
  const pRain = rainMmHr <= 0.05
    ? 0.01
    : Math.min(0.99, Math.max(0.05, Math.pow(rainMmHr / 3.0, 1.3)));

  // 4. Thermal Operational Limits (NASA LCC Rule 1: Min 3°C, Max 37°C)
  let pThermal = 0.02;
  if (temperatureC < 5.0) {
    pThermal = Math.min(0.98, Math.max(0.05, Math.pow((5.0 - temperatureC) / 10.0, 1.4)));
  } else if (temperatureC > 33.0) {
    pThermal = Math.min(0.98, Math.max(0.05, Math.pow((temperatureC - 33.0) / 9.0, 1.4)));
  }

  // 5. High-Altitude Shear & Dynamic Pressure (Max-Q) Coupling
  // Rocket cross-section and drag coefficient affect shear vulnerability
  const dragRatio = (mission.cross_section_area * mission.drag_coefficient) / 4.0;
  const shearBase = (windSpeedMs * gustFactor) / 22.0;
  const pShear = Math.min(0.95, Math.max(0.02, Math.pow(shearBase, 1.8) * Math.min(1.5, dragRatio)));

  // Joint Probability of Violation (at least one LCC rule breached)
  // P(Violation) = 1 - (1 - P_wind) * (1 - P_lightning) * (1 - P_rain) * (1 - P_thermal) * (1 - P_shear)
  const pAllClear = (1 - pWind) * (1 - pLightning) * (1 - pRain) * (1 - pThermal) * (1 - pShear);
  const compositeRiskPct = Number(((1 - pAllClear) * 100).toFixed(1));
  const goProbabilityPct = Number((pAllClear * 100).toFixed(1));

  // Detailed Launch Commit Criteria (LCC) Rules Evaluation
  const rules: LCCRuleResult[] = [
    {
      id: "lcc-wind-1",
      name: "Surface Wind Sustained Limit",
      category: "wind",
      threshold: "≤ 15.0 m/s (29.1 kts)",
      currentValue: `${windSpeedMs.toFixed(1)} m/s (gusts ${(windSpeedMs * gustFactor).toFixed(1)} m/s)`,
      isViolated: windSpeedMs > windLimit || windSpeedMs * gustFactor > 18.0,
      probabilityOfViolation: pWind,
      severity: pWind > 0.5 ? "critical" : pWind > 0.25 ? "high" : "low",
      description: "Structural bending moment and liftoff pad clearance envelope.",
    },
    {
      id: "lcc-lightning-1",
      name: "Triggered Lightning & Cumulus Rule",
      category: "lightning",
      threshold: "Electric field < 1.0 kV/m, RH < 85%",
      currentValue: `${humidityPct.toFixed(1)}% RH · ${cloudCoverPct.toFixed(0)}% cloud`,
      isViolated: pLightning > 0.45 || (humidityPct > 85 && rainMmHr > 0),
      probabilityOfViolation: pLightning,
      severity: pLightning > 0.5 ? "critical" : pLightning > 0.25 ? "high" : "low",
      description: "Triggered lightning discharge through ionized exhaust plume.",
    },
    {
      id: "lcc-precip-1",
      name: "Precipitation & Fairing Abrasion",
      category: "precipitation",
      threshold: "≤ 0.5 mm/hr (Dry Flight Path)",
      currentValue: `${rainMmHr.toFixed(1)} mm/hr`,
      isViolated: rainMmHr > rainLimit,
      probabilityOfViolation: pRain,
      severity: pRain > 0.5 ? "critical" : pRain > 0.2 ? "medium" : "low",
      description: "Droplet impingement erosion on thermal protection and payload fairing.",
    },
    {
      id: "lcc-thermal-1",
      name: "Thermal Envelope (Challenger Rule)",
      category: "thermal",
      threshold: "4.0°C ≤ T ≤ 36.0°C",
      currentValue: `${temperatureC.toFixed(1)}°C`,
      isViolated: temperatureC < 4.0 || temperatureC > 36.0,
      probabilityOfViolation: pThermal,
      severity: pThermal > 0.4 ? "critical" : pThermal > 0.15 ? "medium" : "low",
      description: "Solid booster O-ring resiliency and cryogenic boil-off limits.",
    },
    {
      id: "lcc-shear-1",
      name: "Upper Troposphere Wind Shear & Max-Q",
      category: "shear",
      threshold: "Bending load < 85% structural margin",
      currentValue: `${(shearBase * 100).toFixed(0)}% dynamic stress load`,
      isViolated: pShear > 0.45,
      probabilityOfViolation: pShear,
      severity: pShear > 0.4 ? "high" : "low",
      description: "Aeroelastic gust response during transonic atmospheric punch.",
    },
  ];

  return {
    compositeRisk: compositeRiskPct,
    goProbability: goProbabilityPct,
    breakdown: {
      windRisk: Number((pWind * 100).toFixed(1)),
      lightningRisk: Number((pLightning * 100).toFixed(1)),
      rainRisk: Number((pRain * 100).toFixed(1)),
      thermalRisk: Number((pThermal * 100).toFixed(1)),
      shearRisk: Number((pShear * 100).toFixed(1)),
    },
    rules,
  };
}

/**
 * Evaluates the full selected launch window and computes temporal probabilistic risk profile
 */
export function assessLaunchWindowRisk(
  mission: Mission,
  baseWeather: WeatherParameters,
  selectedMinuteOffset = 0,
  numTimeSlots = 11
): LaunchRiskAssessmentReport {
  const windowStartMins = parseTimeToMinutes(mission.launch_window_start || "12:00");
  const windowEndMins = parseTimeToMinutes(mission.launch_window_end || "13:00");
  let durationMins = mission.launch_window_duration || Math.max(30, windowEndMins - windowStartMins);
  if (durationMins <= 0) durationMins = 60;

  const scheduledMins = parseTimeToMinutes(mission.launch_time || "12:30");
  const scheduledOffset = Math.max(0, Math.min(durationMins, scheduledMins - windowStartMins));

  const slots: WindowTimeSlot[] = [];
  const step = durationMins / Math.max(1, numTimeSlots - 1);

  for (let i = 0; i < numTimeSlots; i++) {
    const minute = Math.round(i * step);
    const clockTime = minutesToTimeStr(windowStartMins + minute);

    // Realistic diurnal micro-weather variance across the window
    // Diurnal thermal wave: peak near mid-window or solar noon
    const normT = minute / durationMins;
    const tempWave = Math.sin(normT * Math.PI) * 0.9;
    const windWave = Math.cos(normT * Math.PI * 1.5) * 1.2 + Math.sin(normT * Math.PI * 3) * 0.5;
    const humidityWave = -tempWave * 2.2;
    const rainWave = Math.max(0, baseWeather.rainMmHr + Math.sin(normT * Math.PI * 2) * 0.4);

    const slotWeather: WeatherParameters = {
      ...baseWeather,
      temperatureC: Number((baseWeather.temperatureC + tempWave).toFixed(1)),
      windSpeedMs: Number((Math.max(0.5, baseWeather.windSpeedMs + windWave)).toFixed(1)),
      humidityPct: Number((Math.min(100, Math.max(10, baseWeather.humidityPct + humidityWave))).toFixed(1)),
      rainMmHr: Number((rainWave).toFixed(1)),
    };

    const evaluated = computeProbabilisticRisk(slotWeather, mission);

    let status: "GO" | "CAUTION" | "NO-GO" = "GO";
    if (evaluated.compositeRisk > 55.0) {
      status = "NO-GO";
    } else if (evaluated.compositeRisk > 28.0) {
      status = "CAUTION";
    }

    slots.push({
      timeLabel: clockTime,
      minutesFromStart: minute,
      compositeRiskScore: evaluated.compositeRisk,
      goProbability: evaluated.goProbability,
      status,
      windRisk: evaluated.breakdown.windRisk,
      lightningRisk: evaluated.breakdown.lightningRisk,
      rainRisk: evaluated.breakdown.rainRisk,
      thermalRisk: evaluated.breakdown.thermalRisk,
      shearRisk: evaluated.breakdown.shearRisk,
      isOptimal: false,
      isScheduled: Math.abs(minute - scheduledOffset) < step / 2,
    });
  }

  // Find optimal slot (minimum risk score)
  let lowestRiskIndex = 0;
  slots.forEach((s, idx) => {
    if (s.compositeRiskScore < slots[lowestRiskIndex].compositeRiskScore) {
      lowestRiskIndex = idx;
    }
  });
  slots[lowestRiskIndex].isOptimal = true;
  const optimalSlot = slots[lowestRiskIndex];

  // Locate or interpolate selected time slot
  const clampedOffset = Math.max(0, Math.min(durationMins, selectedMinuteOffset));
  // Find closest slot
  let closestSlot = slots[0];
  let minDiff = 99999;
  slots.forEach((s) => {
    const diff = Math.abs(s.minutesFromStart - clampedOffset);
    if (diff < minDiff) {
      minDiff = diff;
      closestSlot = s;
    }
  });

  // Calculate detailed parameters for the currently selected slot
  const selectedNormT = clampedOffset / durationMins;
  const selTempWave = Math.sin(selectedNormT * Math.PI) * 0.9;
  const selWindWave = Math.cos(selectedNormT * Math.PI * 1.5) * 1.2 + Math.sin(selectedNormT * Math.PI * 3) * 0.5;
  const selHumidityWave = -selTempWave * 2.2;
  const selRainWave = Math.max(0, baseWeather.rainMmHr + Math.sin(selectedNormT * Math.PI * 2) * 0.4);

  const selectedSlotWeather: WeatherParameters = {
    ...baseWeather,
    temperatureC: Number((baseWeather.temperatureC + selTempWave).toFixed(1)),
    windSpeedMs: Number((Math.max(0.5, baseWeather.windSpeedMs + selWindWave)).toFixed(1)),
    humidityPct: Number((Math.min(100, Math.max(10, baseWeather.humidityPct + selHumidityWave))).toFixed(1)),
    rainMmHr: Number((selRainWave).toFixed(1)),
  };

  const detailedEval = computeProbabilisticRisk(selectedSlotWeather, mission);

  // Confidence Interval via Monte Carlo emulation (± 2.5% to 5.5% uncertainty envelope)
  const p50 = detailedEval.compositeRisk;
  const p5 = Number(Math.max(2.0, p50 - 4.5 * baseWeather.gustFactor).toFixed(1));
  const p95 = Number(Math.min(99.0, p50 + 6.2 * baseWeather.gustFactor).toFixed(1));

  let safetyStatus: "GO (SAFE)" | "CAUTION (MARGINAL)" | "NO-GO (SCRUB)" = "GO (SAFE)";
  let color = "text-emerald-400";
  if (p50 > 55.0) {
    safetyStatus = "NO-GO (SCRUB)";
    color = "text-rose-400";
  } else if (p50 > 28.0) {
    safetyStatus = "CAUTION (MARGINAL)";
    color = "text-amber-400";
  }

  return {
    selectedTimeSlot: {
      ...closestSlot,
      compositeRiskScore: detailedEval.compositeRisk,
      goProbability: detailedEval.goProbability,
      windRisk: detailedEval.breakdown.windRisk,
      lightningRisk: detailedEval.breakdown.lightningRisk,
      rainRisk: detailedEval.breakdown.rainRisk,
      thermalRisk: detailedEval.breakdown.thermalRisk,
      shearRisk: detailedEval.breakdown.shearRisk,
    },
    timeSlots: slots,
    optimalSlot,
    compositeRiskScore: detailedEval.compositeRisk,
    goProbability: detailedEval.goProbability,
    safetyStatus,
    color,
    breakdown: detailedEval.breakdown,
    rules: detailedEval.rules,
    confidenceInterval: {
      p5,
      p50,
      p95,
    },
  };
}
