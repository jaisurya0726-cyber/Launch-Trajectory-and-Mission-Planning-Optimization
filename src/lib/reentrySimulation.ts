/**
 * Atmospheric Re-entry Aerothermal & Terminal Descent Physics Engine
 * Implements Sutton-Graves convective heat flux, radiative shock ionization,
 * 1D transient TPS heat conduction, ablation recession, and deceleration dynamics.
 */

export interface TPSMaterial {
  id: string;
  name: string;
  shortName: string;
  type: "ablative" | "reusable_tile" | "carbon_composite" | "metallic";
  densityKgM3: number; // kg/m^3
  thermalConductivityW_mK: number; // W/(m*K)
  specificHeatJ_kgK: number; // J/(kg*K)
  emissivity: number; // 0.0 - 1.0
  maxServiceTempC: number; // Maximum operational skin temperature (°C)
  heatOfAblationMJ_kg: number; // Effective heat of ablation (MJ/kg, 0 if non-ablative)
  charTemperatureC: number; // Pyrolysis/charring onset temperature (°C)
  heritageVehicles: string;
  color: string;
  description: string;
  reusability: "Single-Use Ablative" | "Multi-Mission Refurbishable" | "100+ Flights Reusable" | "Actively Cooled Reusable";
  maxHeatFluxLimitW_cm2: number; // Maximum sustainable heat flux (W/cm^2)
}

export const TPS_MATERIALS: TPSMaterial[] = [
  {
    id: "pica_x",
    name: "PICA-X (Phenolic-Impregnated Carbon Ablator)",
    shortName: "PICA-X",
    type: "ablative",
    densityKgM3: 270,
    thermalConductivityW_mK: 0.072,
    specificHeatJ_kgK: 1250,
    emissivity: 0.88,
    maxServiceTempC: 1850,
    heatOfAblationMJ_kg: 32.0,
    charTemperatureC: 550,
    heritageVehicles: "SpaceX Dragon 1 & 2, OSIRIS-REx, Stardust",
    color: "#06b6d4", // Cyan
    description: "Low-density carbon fiber matrix infiltrated with phenolic resin. High heat of ablation, lightweight, resists lunar-return velocities up to 11.2 km/s.",
    reusability: "Multi-Mission Refurbishable",
    maxHeatFluxLimitW_cm2: 1200,
  },
  {
    id: "carbon_phenolic",
    name: "Carbon-Phenolic (High-Density Tape Wrap)",
    shortName: "Carbon-Phenolic",
    type: "ablative",
    densityKgM3: 1450,
    thermalConductivityW_mK: 0.82,
    specificHeatJ_kgK: 1420,
    emissivity: 0.92,
    maxServiceTempC: 3000,
    heatOfAblationMJ_kg: 45.0,
    charTemperatureC: 800,
    heritageVehicles: "Galileo Jupiter Probe, ICBM Reentry Vehicles, Pioneer Venus",
    color: "#f97316", // Orange
    description: "Ultra-heavy woven carbon cloth in phenolic binder. Withstands extreme stagnation pressures and massive hyper-velocity heat fluxes exceeding 3,000 W/cm².",
    reusability: "Single-Use Ablative",
    maxHeatFluxLimitW_cm2: 3500,
  },
  {
    id: "li_900_tiles",
    name: "LI-900 High-Purity Silica Ceramic Tiles",
    shortName: "LI-900 Tiles",
    type: "reusable_tile",
    densityKgM3: 144,
    thermalConductivityW_mK: 0.048,
    specificHeatJ_kgK: 960,
    emissivity: 0.89,
    maxServiceTempC: 1260,
    heatOfAblationMJ_kg: 0,
    charTemperatureC: 1260,
    heritageVehicles: "SpaceX Starship Thermal Tiles, Space Shuttle Orbiter, X-37B",
    color: "#3b82f6", // Blue
    description: "99.9% pure amorphous silica fiber with black Reaction Cured Glass (RCG) borosilicate coating. Radiates 90% of heat away without eroding or ablating.",
    reusability: "100+ Flights Reusable",
    maxHeatFluxLimitW_cm2: 450,
  },
  {
    id: "rcc_composite",
    name: "Reinforced Carbon-Carbon (RCC Composite)",
    shortName: "RCC Leading Edge",
    type: "carbon_composite",
    densityKgM3: 1980,
    thermalConductivityW_mK: 38.5,
    specificHeatJ_kgK: 1550,
    emissivity: 0.85,
    maxServiceTempC: 1650,
    heatOfAblationMJ_kg: 0,
    charTemperatureC: 1650,
    heritageVehicles: "Space Shuttle Wing Leading Edges & Nose Cap, Hypersonic Glide Vehicles",
    color: "#eab308", // Yellow
    description: "Graphitized 3D carbon matrix with silicon carbide anti-oxidation conversion coating. Retains exceptional structural strength at 1,600°C without geometry deformation.",
    reusability: "100+ Flights Reusable",
    maxHeatFluxLimitW_cm2: 850,
  },
  {
    id: "sla_561v",
    name: "SLA-561V Silicone Elastomeric Cork",
    shortName: "SLA-561V Cork",
    type: "ablative",
    densityKgM3: 264,
    thermalConductivityW_mK: 0.061,
    specificHeatJ_kgK: 1180,
    emissivity: 0.82,
    maxServiceTempC: 1400,
    heatOfAblationMJ_kg: 18.5,
    charTemperatureC: 400,
    heritageVehicles: "Mars Pathfinder, Mars Exploration Rovers (Spirit & Opportunity), MSL Backshell",
    color: "#10b981", // Emerald
    description: "Silicone elastomer filled with cork particles, microballoons, and silica. Engineered for moderate heating environments and direct planetary atmospheric entries.",
    reusability: "Single-Use Ablative",
    maxHeatFluxLimitW_cm2: 300,
  },
  {
    id: "inconel_metallic",
    name: "Inconel 718 Metallic Transpiration Shield",
    shortName: "Inconel 718",
    type: "metallic",
    densityKgM3: 8190,
    thermalConductivityW_mK: 11.4,
    specificHeatJ_kgK: 435,
    emissivity: 0.72,
    maxServiceTempC: 1100,
    heatOfAblationMJ_kg: 0,
    charTemperatureC: 1100,
    heritageVehicles: "North American X-15, Active Liquid Methane Cooled Starship Skin",
    color: "#ec4899", // Pink
    description: "High-strength nickel-chromium superalloy backed by active heat exchanger channels. High impact resistance, immune to tile spalling, rapid turn-around.",
    reusability: "Actively Cooled Reusable",
    maxHeatFluxLimitW_cm2: 550,
  },
];

export interface ReentryPreset {
  id: string;
  name: string;
  category: "LEO" | "Lunar" | "GTO" | "Interplanetary" | "Suborbital";
  entryVelocityKmS: number;
  entryFlightPathAngleDeg: number;
  entryAltitudeKm: number;
  vehicleMassKg: number;
  noseRadiusM: number;
  baseDiameterM: number;
  dragCoefficientCd: number;
  liftToDragRatio: number;
  tpsThicknessMm: number;
  materialId: string;
  description: string;
}

export const REENTRY_PRESETS: ReentryPreset[] = [
  {
    id: "crew_dragon_leo",
    name: "Crew Dragon (LEO Return)",
    category: "LEO",
    entryVelocityKmS: 7.75,
    entryFlightPathAngleDeg: -1.75,
    entryAltitudeKm: 120,
    vehicleMassKg: 7800,
    noseRadiusM: 1.8,
    baseDiameterM: 4.0,
    dragCoefficientCd: 1.25,
    liftToDragRatio: 0.28,
    tpsThicknessMm: 45,
    materialId: "pica_x",
    description: "Lifting re-entry from 400 km ISS orbit. Bank angle modulation controls peak G-force for astronaut safety.",
  },
  {
    id: "orion_lunar_skip",
    name: "Orion Artemis (Lunar Direct Return)",
    category: "Lunar",
    entryVelocityKmS: 11.05,
    entryFlightPathAngleDeg: -5.85,
    entryAltitudeKm: 125,
    vehicleMassKg: 9300,
    noseRadiusM: 2.2,
    baseDiameterM: 5.0,
    dragCoefficientCd: 1.30,
    liftToDragRatio: 0.32,
    tpsThicknessMm: 60,
    materialId: "pica_x",
    description: "Extreme velocity lunar direct atmospheric skip-entry with intense radiative shock ionization.",
  },
  {
    id: "shuttle_orbiter",
    name: "Space Shuttle (Orbital Crossrange Descent)",
    category: "LEO",
    entryVelocityKmS: 7.82,
    entryFlightPathAngleDeg: -1.25,
    entryAltitudeKm: 120,
    vehicleMassKg: 85000,
    noseRadiusM: 0.95,
    baseDiameterM: 7.5,
    dragCoefficientCd: 0.85,
    liftToDragRatio: 1.15,
    tpsThicknessMm: 50,
    materialId: "li_900_tiles",
    description: "Shallow lifting hypersonic glide at 40° angle of attack, relying purely on radiative cooling tiles.",
  },
  {
    id: "steep_ballistic_capsule",
    name: "Soyuz Emergency Ballistic Descent",
    category: "LEO",
    entryVelocityKmS: 7.80,
    entryFlightPathAngleDeg: -4.50,
    entryAltitudeKm: 120,
    vehicleMassKg: 3100,
    noseRadiusM: 1.1,
    baseDiameterM: 2.2,
    dragCoefficientCd: 1.45,
    liftToDragRatio: 0.05,
    tpsThicknessMm: 40,
    materialId: "carbon_phenolic",
    description: "Uncontrolled steep ballistic roll entry. High deceleration spikes producing up to 9–10 Gs.",
  },
  {
    id: "mars_sample_return",
    name: "Mars Planetary Earth Return Capsule",
    category: "Interplanetary",
    entryVelocityKmS: 12.20,
    entryFlightPathAngleDeg: -6.20,
    entryAltitudeKm: 130,
    vehicleMassKg: 120,
    noseRadiusM: 0.45,
    baseDiameterM: 0.9,
    dragCoefficientCd: 1.60,
    liftToDragRatio: 0.0,
    tpsThicknessMm: 55,
    materialId: "carbon_phenolic",
    description: "Passive ballistic blunt-cone entry from Mars transfer orbit at ultra-high convective & radiative heat flux.",
  },
];

export interface ReentryConfig {
  entryVelocityKmS: number;
  entryFlightPathAngleDeg: number;
  entryAltitudeKm: number;
  vehicleMassKg: number;
  noseRadiusM: number;
  baseDiameterM: number;
  dragCoefficientCd: number;
  liftToDragRatio: number;
  tpsThicknessMm: number;
  materialId: string;
}

export interface ReentryDataPoint {
  timeS: number;
  altitudeKm: number;
  velocityKmS: number;
  machNumber: number;
  decelerationG: number;
  downrangeKm: number;
  dynamicPressureKPa: number;
  convectiveHeatFluxW_cm2: number;
  radiativeHeatFluxW_cm2: number;
  totalHeatFluxW_cm2: number;
  cumulativeHeatLoadKJ_cm2: number;
  surfaceTemperatureC: number;
  bondlineTemperatureC: number;
  ablationRecessionMm: number;
  airDensityKgM3: number;
  isBlackout: boolean;
}

export interface ReentrySummary {
  peakHeatFluxW_cm2: number;
  timeOfPeakHeatFluxS: number;
  peakDecelerationG: number;
  timeOfPeakDecelS: number;
  peakSurfaceTempC: number;
  peakBondlineTempC: number;
  totalHeatLoadKJ_cm2: number;
  totalAblationMm: number;
  peakDynamicPressureKPa: number;
  flightTimeS: number;
  terminalVelocityMS: number;
  blackoutDurationS: number;
  heatShieldMassKg: number;
  ballisticCoefficientKgM2: number;
  safetyMarginPct: number;
  bondlineSafetyStatus: "NOMINAL" | "WARNING" | "CRITICAL_EXCEEDED";
  maxGStatus: "ACCEPTABLE" | "CREW_LIMIT_WARNING" | "FATAL_EXCEEDED";
  material: TPSMaterial;
}

// Stefan-Boltzmann constant (W / (m^2 * K^4))
const SIGMA_SB = 5.670374e-8;
const G0 = 9.80665;
const EARTH_RADIUS_M = 6371000;

// Sutton-Graves stagnation convective heating constant for Earth air atmosphere
// q_conv = k_sg * sqrt(rho / Rn) * v^3 [W/m^2]
const K_SUTTON_GRAVES = 1.7415e-4; // kg^0.5 / m

// Standard US Atmosphere exponential density model with multi-layer scale heights
function getAtmosphericDensity(altitudeKm: number): { rho: number; tempK: number; speedOfSound: number } {
  const hM = altitudeKm * 1000;
  if (hM > 120000) return { rho: 1e-11, tempK: 360, speedOfSound: 380 };

  // Stratified standard atmosphere table
  let rho = 0;
  let tempK = 288.15;

  if (hM < 11000) {
    // Troposphere
    tempK = 288.15 - 0.0065 * hM;
    rho = 1.225 * Math.pow(tempK / 288.15, 4.256);
  } else if (hM < 20000) {
    // Tropopause
    tempK = 216.65;
    rho = 0.3639 * Math.exp(-(hM - 11000) / 6340);
  } else if (hM < 32000) {
    // Stratosphere 1
    tempK = 216.65 + 0.001 * (hM - 20000);
    rho = 0.08803 * Math.pow(tempK / 216.65, -35.16);
  } else if (hM < 47000) {
    // Stratosphere 2
    tempK = 228.65 + 0.0028 * (hM - 32000);
    rho = 0.01322 * Math.pow(tempK / 228.65, -13.20);
  } else if (hM < 71000) {
    // Mesosphere 1
    tempK = 270.65 - 0.0028 * (hM - 47000);
    rho = 0.00143 * Math.pow(tempK / 270.65, 11.20);
  } else if (hM < 85000) {
    // Mesosphere 2
    tempK = 214.65 - 0.002 * (hM - 71000);
    rho = 0.000064 * Math.pow(tempK / 214.65, 16.08);
  } else {
    // Thermosphere
    tempK = 186.87 + 0.0035 * (hM - 85000);
    rho = 0.0000078 * Math.exp(-(hM - 85000) / 6850);
  }

  rho = Math.max(rho, 1e-12);
  const gamma = 1.4;
  const R_SPECIFIC = 287.05;
  const speedOfSound = Math.sqrt(gamma * R_SPECIFIC * Math.max(tempK, 150));

  return { rho, tempK, speedOfSound };
}

/**
 * Runs high-precision numerical flight dynamics and aerothermal simulation of atmospheric entry.
 */
export function runReentrySimulation(config: ReentryConfig): {
  trajectory: ReentryDataPoint[];
  summary: ReentrySummary;
} {
  const material = TPS_MATERIALS.find((m) => m.id === config.materialId) || TPS_MATERIALS[0];

  // Aerodynamic geometric reference
  const baseAreaM2 = Math.PI * Math.pow(config.baseDiameterM / 2, 2);
  const ballisticCoeff = config.vehicleMassKg / (config.dragCoefficientCd * baseAreaM2);
  const tpsThicknessM = config.tpsThicknessMm / 1000;
  const heatShieldVolumeM3 = baseAreaM2 * tpsThicknessM * 1.05; // 5% edge overlap
  const heatShieldMassKg = heatShieldVolumeM3 * material.densityKgM3;

  // Initial State Vector
  let h = config.entryAltitudeKm * 1000; // Altitude in meters
  let v = config.entryVelocityKmS * 1000; // Velocity in m/s
  let gamma = (config.entryFlightPathAngleDeg * Math.PI) / 180; // Entry flight path angle in radians (negative down)
  let s = 0; // Downrange distance in meters
  let t = 0; // Time in seconds

  const trajectory: ReentryDataPoint[] = [];

  let cumulativeHeatLoadJ_m2 = 0;
  let cumulativeAblationM = 0;

  // Substructure bondline thermal conduction model
  // Transient 1D Fourier thermal delay model
  const alphaThermal = material.thermalConductivityW_mK / (material.densityKgM3 * material.specificHeatJ_kgK);
  // Characteristic diffusion time scale tau = L^2 / (pi^2 * alpha)
  const tauDiff = Math.pow(tpsThicknessM, 2) / (Math.PI * Math.PI * Math.max(alphaThermal, 1e-9));

  let bondlineTempC = 20.0; // initial cabin/substructure temperature

  let peakHeatFluxW_cm2 = 0;
  let timeOfPeakHeatFluxS = 0;
  let peakDecelG = 0;
  let timeOfPeakDecelS = 0;
  let peakSurfaceTempC = 20;
  let peakBondlineTempC = 20;
  let peakDynamicPressureKPa = 0;
  let blackoutTimeCount = 0;

  const dt = 0.25; // 250 ms time step for high-frequency dynamic stability
  const maxTime = 1200; // 20 minutes maximum descent limit

  while (t <= maxTime && h > 2000 && v > 50) {
    const altitudeKm = h / 1000;
    const { rho, speedOfSound } = getAtmosphericDensity(altitudeKm);

    const mach = v / Math.max(speedOfSound, 100);
    const dynamicPressurePa = 0.5 * rho * v * v;
    const dynamicPressureKPa = dynamicPressurePa / 1000;
    if (dynamicPressureKPa > peakDynamicPressureKPa) {
      peakDynamicPressureKPa = dynamicPressureKPa;
    }

    // Gravity at altitude
    const r = EARTH_RADIUS_M + h;
    const g = G0 * Math.pow(EARTH_RADIUS_M / r, 2);

    // Aerodynamic Forces
    const dragForce = 0.5 * rho * v * v * config.dragCoefficientCd * baseAreaM2;
    const liftForce = dragForce * config.liftToDragRatio;

    // Deceleration in g's (felt by vehicle/crew)
    const decelMs2 = dragForce / config.vehicleMassKg;
    const decelG = decelMs2 / G0;
    if (decelG > peakDecelG) {
      peakDecelG = decelG;
      timeOfPeakDecelS = t;
    }

    // Aerothermal Stagnation Convective Heat Flux (Sutton-Graves)
    // q_conv [W/m^2] = K_sg * sqrt(rho / Rn) * v^3
    const rn = Math.max(config.noseRadiusM, 0.1);
    const qConvW_m2 = K_SUTTON_GRAVES * Math.sqrt(rho / rn) * Math.pow(v, 3);
    const qConvW_cm2 = qConvW_m2 * 1e-4;

    // Shock Layer Radiative Heat Flux (High hypersonic ionization shock layer)
    // Significant for v > 7,500 m/s in upper-middle stratosphere
    let qRadW_cm2 = 0;
    if (v > 7400) {
      const vRatio = v / 10000;
      qRadW_cm2 = 45.0 * Math.pow(rn, 0.5) * Math.pow(rho, 1.22) * Math.pow(vRatio, 8.5);
    }

    const totalHeatFluxW_cm2 = qConvW_cm2 + qRadW_cm2;
    if (totalHeatFluxW_cm2 > peakHeatFluxW_cm2) {
      peakHeatFluxW_cm2 = totalHeatFluxW_cm2;
      timeOfPeakHeatFluxS = t;
    }

    // Cumulative Heat Load (kJ/cm^2)
    const heatFluxJ_m2_sec = totalHeatFluxW_cm2 * 1e4;
    cumulativeHeatLoadJ_m2 += heatFluxJ_m2_sec * dt;
    const cumulativeHeatLoadKJ_cm2 = (cumulativeHeatLoadJ_m2 * 1e-4) / 1000;

    // Radiative Equilibrium Skin Surface Temperature
    // q_net = eps * sigma * T_surf^4
    const totalHeatFluxW_m2 = totalHeatFluxW_cm2 * 1e4;
    const eps = Math.max(material.emissivity, 0.5);
    const tEquilK = Math.pow(Math.max(totalHeatFluxW_m2, 0) / (eps * SIGMA_SB), 0.25);
    const surfaceTempC = Math.max(tEquilK - 273.15, 20);
    if (surfaceTempC > peakSurfaceTempC) {
      peakSurfaceTempC = surfaceTempC;
    }

    // Ablation recession calculation
    if (material.type === "ablative" && material.heatOfAblationMJ_kg > 0) {
      if (surfaceTempC > material.charTemperatureC) {
        const netAblationHeatFluxW_m2 = totalHeatFluxW_m2 * 0.75; // convective cooling through pyrolysis gas blowing
        const hAblationJ_kg = material.heatOfAblationMJ_kg * 1e6;
        const massRecessionRateKg_m2_s = netAblationHeatFluxW_m2 / hAblationJ_kg;
        const recessionRateM_s = massRecessionRateKg_m2_s / material.densityKgM3;
        cumulativeAblationM += recessionRateM_s * dt;
      }
    }

    // 1D Substructure Bondline Temperature Conduction Evolution
    // Rate of heat soak toward the bondline based on thermal relaxation tauDiff
    const bondlineTempRate = (surfaceTempC - bondlineTempC) / Math.max(tauDiff, 15.0);
    bondlineTempC += bondlineTempRate * dt;
    if (bondlineTempC > peakBondlineTempC) {
      peakBondlineTempC = bondlineTempC;
    }

    // Radio Frequency Plasma Blackout Detection
    // Electron plasma cutoff frequency exceeds S/X-band (2.2–8 GHz)
    const isBlackout = v > 3600 && altitudeKm >= 38 && altitudeKm <= 88 && dynamicPressureKPa > 1.2;
    if (isBlackout) {
      blackoutTimeCount += dt;
    }

    // Store trajectory telemetry point (subsampled at 1.0 s intervals for clean charting)
    if (Math.round(t / dt) % 4 === 0 || h <= 3000) {
      trajectory.push({
        timeS: Math.round(t * 10) / 10,
        altitudeKm: Math.round(altitudeKm * 100) / 100,
        velocityKmS: Math.round((v / 1000) * 100) / 100,
        machNumber: Math.round(mach * 10) / 10,
        decelerationG: Math.round(decelG * 100) / 100,
        downrangeKm: Math.round((s / 1000) * 10) / 10,
        dynamicPressureKPa: Math.round(dynamicPressureKPa * 10) / 10,
        convectiveHeatFluxW_cm2: Math.round(qConvW_cm2 * 10) / 10,
        radiativeHeatFluxW_cm2: Math.round(qRadW_cm2 * 10) / 10,
        totalHeatFluxW_cm2: Math.round(totalHeatFluxW_cm2 * 10) / 10,
        cumulativeHeatLoadKJ_cm2: Math.round(cumulativeHeatLoadKJ_cm2 * 10) / 10,
        surfaceTemperatureC: Math.round(surfaceTempC),
        bondlineTemperatureC: Math.round(bondlineTempC * 10) / 10,
        ablationRecessionMm: Math.round(cumulativeAblationM * 1000 * 100) / 100,
        airDensityKgM3: rho,
        isBlackout,
      });
    }

    // Equations of Motion Integration (Planar Entry)
    // dv/dt = -drag/m + g * sin(gamma)
    const dv_dt = -decelMs2 + g * Math.sin(gamma);

    // dgamma/dt = (v / r - g / v) * cos(gamma) + lift / (m * v)
    const dgamma_dt =
      (v / r - g / Math.max(v, 1)) * Math.cos(gamma) +
      liftForce / (config.vehicleMassKg * Math.max(v, 1));

    // dh/dt = v * sin(gamma) (negative for descent)
    const dh_dt = v * Math.sin(gamma);

    // ds/dt = (EARTH_RADIUS_M / r) * v * cos(gamma)
    const ds_dt = (EARTH_RADIUS_M / r) * v * Math.cos(gamma);

    // Update state vector
    v += dv_dt * dt;
    gamma += dgamma_dt * dt;
    h += dh_dt * dt;
    s += ds_dt * dt;
    t += dt;
  }

  // Safety margins
  const tempMargin = ((material.maxServiceTempC - peakSurfaceTempC) / material.maxServiceTempC) * 100;
  const bondlineStatus =
    peakBondlineTempC <= 180
      ? "NOMINAL"
      : peakBondlineTempC <= 250
      ? "WARNING"
      : "CRITICAL_EXCEEDED";

  const maxGStatus =
    peakDecelG <= 6.5
      ? "ACCEPTABLE"
      : peakDecelG <= 12.0
      ? "CREW_LIMIT_WARNING"
      : "FATAL_EXCEEDED";

  const summary: ReentrySummary = {
    peakHeatFluxW_cm2: Math.round(peakHeatFluxW_cm2 * 10) / 10,
    timeOfPeakHeatFluxS: Math.round(timeOfPeakHeatFluxS),
    peakDecelerationG: Math.round(peakDecelG * 100) / 100,
    timeOfPeakDecelS: Math.round(timeOfPeakDecelS),
    peakSurfaceTempC: Math.round(peakSurfaceTempC),
    peakBondlineTempC: Math.round(peakBondlineTempC * 10) / 10,
    totalHeatLoadKJ_cm2: Math.round((cumulativeHeatLoadJ_m2 * 1e-4) / 1000 * 10) / 10,
    totalAblationMm: Math.round(cumulativeAblationM * 1000 * 100) / 100,
    peakDynamicPressureKPa: Math.round(peakDynamicPressureKPa * 10) / 10,
    flightTimeS: Math.round(t),
    terminalVelocityMS: Math.round(v),
    blackoutDurationS: Math.round(blackoutTimeCount),
    heatShieldMassKg: Math.round(heatShieldMassKg),
    ballisticCoefficientKgM2: Math.round(ballisticCoeff),
    safetyMarginPct: Math.round(tempMargin * 10) / 10,
    bondlineSafetyStatus: bondlineStatus,
    maxGStatus,
    material,
  };

  return { trajectory, summary };
}
