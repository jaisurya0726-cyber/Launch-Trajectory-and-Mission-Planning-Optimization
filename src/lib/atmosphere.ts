import { Mission } from "../types";

export type SeasonalProfileId = "auto" | "standard" | "monsoon" | "summer" | "winter" | "cyclone";

export interface SeasonalWeatherProfile {
  id: SeasonalProfileId;
  name: string;
  seasonLabel: string;
  description: string;
  surfaceTempC: number;
  surfacePressureHpa: number;
  relativeHumidityPct: number;
  scaleHeightM: number;
  surfaceDensityKgM3: number;
  lapseRateCPerKm: number;
}

export const SEASONAL_PROFILES: Record<SeasonalProfileId, SeasonalWeatherProfile> = {
  auto: {
    id: "auto",
    name: "Mission Weather (Dynamic)",
    seasonLabel: "Site-Synchronized",
    description: "Calculated from active launch site weather sensors & temperature readings.",
    surfaceTempC: 28.0,
    surfacePressureHpa: 1011.0,
    relativeHumidityPct: 70.0,
    scaleHeightM: 8650.0,
    surfaceDensityKgM3: 1.182,
    lapseRateCPerKm: 6.5,
  },
  standard: {
    id: "standard",
    name: "ISA Standard Atmosphere",
    seasonLabel: "ICAO / NASA Reference",
    description: "Standard international reference profile (15°C, 1013.25 hPa sea level).",
    surfaceTempC: 15.0,
    surfacePressureHpa: 1013.25,
    relativeHumidityPct: 0.0,
    scaleHeightM: 8500.0,
    surfaceDensityKgM3: 1.225,
    lapseRateCPerKm: 6.5,
  },
  monsoon: {
    id: "monsoon",
    name: "South Asian Monsoon",
    seasonLabel: "Hot & Saturated (Jun–Sep)",
    description: "High humidity, warm air mass expanding lower troposphere with reduced surface density.",
    surfaceTempC: 32.5,
    surfacePressureHpa: 1004.0,
    relativeHumidityPct: 92.0,
    scaleHeightM: 8900.0,
    surfaceDensityKgM3: 1.152,
    lapseRateCPerKm: 5.8,
  },
  summer: {
    id: "summer",
    name: "Tropical Summer",
    seasonLabel: "Peak Thermal Expansion (Mar–May)",
    description: "Thermal uplift raises scale height to 9,100 m, pushing density upward into Max-Q zone.",
    surfaceTempC: 38.0,
    surfacePressureHpa: 1008.0,
    relativeHumidityPct: 40.0,
    scaleHeightM: 9150.0,
    surfaceDensityKgM3: 1.132,
    lapseRateCPerKm: 7.2,
  },
  winter: {
    id: "winter",
    name: "Subtropical Winter",
    seasonLabel: "Dense & Cold (Dec–Feb)",
    description: "Cold, dense air mass increases aerodynamic skin friction and lower-altitude drag.",
    surfaceTempC: 12.0,
    surfacePressureHpa: 1018.5,
    relativeHumidityPct: 48.0,
    scaleHeightM: 8150.0,
    surfaceDensityKgM3: 1.246,
    lapseRateCPerKm: 6.2,
  },
  cyclone: {
    id: "cyclone",
    name: "Depressional / Cyclonic",
    seasonLabel: "Severe Barometric Drop",
    description: "Low-pressure cell with severe wind shear and turbulent barometric inversion layer.",
    surfaceTempC: 27.0,
    surfacePressureHpa: 988.0,
    relativeHumidityPct: 98.0,
    scaleHeightM: 8750.0,
    surfaceDensityKgM3: 1.138,
    lapseRateCPerKm: 6.0,
  },
};

/**
 * Derives dynamic profile from mission launch weather
 */
export function getActiveSeasonalProfile(
  profileId: SeasonalProfileId,
  mission: Mission
): SeasonalWeatherProfile {
  if (profileId !== "auto") {
    return SEASONAL_PROFILES[profileId];
  }

  // Derive dynamic properties from mission
  const tempC = mission.weather_temperature || 28.0;
  const rh = mission.humidity || 65.0;
  const tempK = tempC + 273.15;

  // Approximate barometric pressure based on weather and rain
  const p0Hpa = Math.max(985.0, 1013.25 - (mission.rain * 0.45) - (mission.wind_speed * 0.2));

  // Scale height H = (R * T) / (M * g0)
  const scaleHeightM = Number(((287.05 * tempK) / 9.80665).toFixed(0));

  // Dry air gas constant R = 287.05 J/(kg·K)
  // rho = P / (R * T)
  const p0Pa = p0Hpa * 100.0;
  const surfaceDensity = Number((p0Pa / (287.05 * tempK)).toFixed(3));

  return {
    id: "auto",
    name: `Mission Derived (${mission.launch_site.split(" ")[0] || "SDSC"})`,
    seasonLabel: `T=${tempC}°C · RH=${rh}% · P=${p0Hpa.toFixed(0)} hPa`,
    description: `Site-calibrated density profile derived from ${mission.launch_site} real-time sensors.`,
    surfaceTempC: tempC,
    surfacePressureHpa: Number(p0Hpa.toFixed(1)),
    relativeHumidityPct: rh,
    scaleHeightM,
    surfaceDensityKgM3: surfaceDensity,
    lapseRateCPerKm: 6.5,
  };
}

/**
 * Calculates atmospheric density at altitude h (in meters) given a seasonal profile
 */
export function calculateDensityAtAltitude(altM: number, profile: SeasonalWeatherProfile): number {
  if (altM > 130000) return 0;
  const altKm = altM / 1000;

  // Multi-layer piecewise density model
  if (altKm <= 11) {
    // Troposphere
    const T0 = profile.surfaceTempC + 273.15;
    const L = profile.lapseRateCPerKm / 1000;
    const T = T0 - L * altM;
    const pRatio = Math.pow(Math.max(0.01, T / T0), 9.80665 / (287.05 * L));
    return profile.surfaceDensityKgM3 * pRatio;
  } else if (altKm <= 20) {
    // Tropopause (isothermal layer)
    const rho11 = calculateDensityAtAltitude(11000, profile);
    const dh = altM - 11000;
    return rho11 * Math.exp(-dh / 6340);
  } else if (altKm <= 32) {
    // Stratosphere
    const rho20 = calculateDensityAtAltitude(20000, profile);
    const dh = altM - 20000;
    return rho20 * Math.exp(-dh / 6900);
  } else if (altKm <= 50) {
    // Upper Stratosphere
    const rho32 = calculateDensityAtAltitude(32000, profile);
    const dh = altM - 32000;
    return rho32 * Math.exp(-dh / 7800);
  } else if (altKm <= 85) {
    // Mesosphere
    const rho50 = calculateDensityAtAltitude(50000, profile);
    const dh = altM - 50000;
    return rho50 * Math.exp(-dh / 8300);
  } else {
    // Thermosphere boundary
    const rho85 = calculateDensityAtAltitude(85000, profile);
    const dh = altM - 85000;
    return rho85 * Math.exp(-dh / profile.scaleHeightM);
  }
}

/**
 * Color mapper for density heatmap:
 * Returns RGBA color based on normalized atmospheric density ratio (rho / rho_0)
 */
export function getDensityColor(
  normalizedDensity: number,
  opacity: number
): { r: number; g: number; b: number; a: number; hex: string } {
  // Clamp between 0 and 1
  const t = Math.max(0, Math.min(1, normalizedDensity));

  let r = 0, g = 0, b = 0;

  if (t > 0.6) {
    // Sea level to lower troposphere (dense indigo to cyan)
    const factor = (t - 0.6) / 0.4;
    r = Math.round(14 + factor * 20);
    g = Math.round(116 + factor * 50);
    b = Math.round(210 + factor * 45);
  } else if (t > 0.25) {
    // Mid troposphere to lower stratosphere (cyan to teal-green)
    const factor = (t - 0.25) / 0.35;
    r = Math.round(6 + factor * 8);
    g = Math.round(182 - factor * 40);
    b = Math.round(212 - factor * 80);
  } else if (t > 0.05) {
    // Stratosphere (greenish to amber)
    const factor = (t - 0.05) / 0.2;
    r = Math.round(16 + factor * 220);
    g = Math.round(185 - factor * 30);
    b = Math.round(129 - factor * 110);
  } else if (t > 0.005) {
    // Mesosphere (orange to rose-violet)
    const factor = (t - 0.005) / 0.045;
    r = Math.round(245 - factor * 40);
    g = Math.round(158 - factor * 100);
    b = Math.round(11 + factor * 80);
  } else {
    // Upper mesosphere to Kármán line (fading into dark space)
    const factor = t / 0.005;
    r = Math.round(180 * factor);
    g = Math.round(50 * factor);
    b = Math.round(140 * factor);
  }

  const alpha = Number((t * 0.85 * opacity).toFixed(3));
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

  return { r, g, b, a: alpha, hex };
}
