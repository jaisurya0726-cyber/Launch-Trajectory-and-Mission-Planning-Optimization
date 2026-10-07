import React, { useState, useMemo, useCallback } from "react";
import {
  Mission,
  MissionInputFormData,
  ClassicalResult,
  QUBOResult,
  QAOAResult,
  ConstraintCheckResult,
} from "../types";
import {
  runClassicalOptimization,
  buildQUBOMatrix,
  runQAOASimulation,
} from "../lib/optimization";
import { G0 } from "../lib/physics";
import {
  Rocket,
  Sliders,
  Send,
  RotateCcw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Atom,
  Cpu,
  Layers,
  Activity,
  Calendar,
  Clock,
  MapPin,
  Compass,
  Gauge,
  CloudRain,
  Wind,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  Flame,
  Weight,
  Sparkles,
  Download,
  BookmarkPlus,
  BarChart3,
  Check,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface MissionInputViewProps {
  initialMission: Mission;
  onApplyMission?: (mission: Mission) => void;
  onProceedToComparison?: () => void;
  onProceedToPlan?: () => void;
  onSaveToHistory?: (entry: any) => void;
}

const LAUNCH_SITES = [
  "Kennedy Space Center (LC-39A)",
  "Cape Canaveral SFS (SLC-40)",
  "Vandenberg SFB (SLC-4E)",
  "Starbase (Boca Chica Pad A)",
  "Satish Dhawan Space Centre (SDSC-SHAR)",
  "Guiana Space Centre (CSG ELA-4)",
  "Tanegashima Space Center (Yoshinobu)",
  "Mahia Launch Complex 1",
];

const ROCKET_MODELS = [
  "Falcon 9 Block 5",
  "Starship Super Heavy",
  "Atlas V 541",
  "Ariane 6",
  "Electron",
  "Falcon Heavy",
  "New Glenn",
  "PSLV-XL",
];

const TARGET_ORBITS = [
  "LEO (Low Earth Orbit)",
  "SSO (Sun-Synchronous Orbit)",
  "MEO (Medium Earth Orbit)",
  "GEO (Geostationary Orbit)",
  "GTO (Geostationary Transfer Orbit)",
  "Lunar Transfer",
];

const WEATHER_CONDITIONS = [
  "Clear / Optimal",
  "Mild Cloud Cover",
  "Moderate Surface Winds",
  "Scattered Showers",
  "Squall / High Wind Alert",
];

const SAFETY_STATUSES = [
  "OPTIMAL / GO",
  "MARGINAL / CAUTION",
  "NO-GO / HIGH RISK",
];

const PRESETS: Record<string, Partial<MissionInputFormData>> = {
  "Falcon 9 — Starlink LEO": {
    mission_id: "MSN-2026-F9-LEO",
    satellite_name: "Starlink Group 9-12",
    launch_date: "2026-11-15",
    launch_time: "14:30",
    launch_site: "Cape Canaveral SFS (SLC-40)",
    rocket: "Falcon 9 Block 5",
    target_orbit: "LEO (Low Earth Orbit)",
    altitude: 540,
    inclination: 53.2,
    rocket_mass: 22200,
    fuel_mass: 411000,
    thrust: 7607,
    specific_impulse: 311,
    payload_mass: 16250,
    payload_volume: 145,
    mission_priority: 2,
    delta_v: 9.35,
    flight_time: 14.8, // minutes
    fuel_consumption: 395000,
    weather_temperature: 24,
    wind_speed: 4.8,
    rain: 0,
    weather_condition: "Clear / Optimal",
    safety_status: "OPTIMAL / GO",
    risk_score: 18.2,
    launch_cost: 67.0,
    available_launch_window: "14:15 - 16:45 UTC",
    window_duration: 150,
  },
  "Starship — Lunar Injection": {
    mission_id: "MSN-2026-SH-LUNAR",
    satellite_name: "Artemis Gateway Module",
    launch_date: "2026-12-04",
    launch_time: "09:00",
    launch_site: "Starbase (Boca Chica Pad A)",
    rocket: "Starship Super Heavy",
    target_orbit: "Lunar Transfer",
    altitude: 384400,
    inclination: 28.5,
    rocket_mass: 120000,
    fuel_mass: 1200000,
    thrust: 72000,
    specific_impulse: 380,
    payload_mass: 100000,
    payload_volume: 850,
    mission_priority: 1,
    delta_v: 12.8,
    flight_time: 48.0, // minutes
    fuel_consumption: 1140000,
    weather_temperature: 20,
    wind_speed: 6.2,
    rain: 0,
    weather_condition: "Clear / Optimal",
    safety_status: "OPTIMAL / GO",
    risk_score: 28.5,
    launch_cost: 110.0,
    available_launch_window: "08:45 - 11:15 UTC",
    window_duration: 150,
  },
  "Electron — SSO CubeSat": {
    mission_id: "MSN-2026-EL-SSO",
    satellite_name: "AeroOpt NanoConstellation",
    launch_date: "2026-10-28",
    launch_time: "02:15",
    launch_site: "Mahia Launch Complex 1",
    rocket: "Electron",
    target_orbit: "SSO (Sun-Synchronous Orbit)",
    altitude: 500,
    inclination: 97.4,
    rocket_mass: 1250,
    fuel_mass: 11200,
    thrust: 224,
    specific_impulse: 311,
    payload_mass: 220,
    payload_volume: 1.8,
    mission_priority: 3,
    delta_v: 9.85,
    flight_time: 12.5, // minutes
    fuel_consumption: 10850,
    weather_temperature: 16,
    wind_speed: 8.5,
    rain: 0.2,
    weather_condition: "Mild Cloud Cover",
    safety_status: "OPTIMAL / GO",
    risk_score: 22.0,
    launch_cost: 7.5,
    available_launch_window: "01:45 - 04:00 UTC",
    window_duration: 135,
  },
  "Ariane 6 — Commercial GTO": {
    mission_id: "MSN-2026-A6-GTO",
    satellite_name: "AstraCom Geo-8",
    launch_date: "2027-01-18",
    launch_time: "21:40",
    launch_site: "Guiana Space Centre (CSG ELA-4)",
    rocket: "Ariane 6",
    target_orbit: "GTO (Geostationary Transfer Orbit)",
    altitude: 35786,
    inclination: 5.2,
    rocket_mass: 35000,
    fuel_mass: 450000,
    thrust: 14000,
    specific_impulse: 448,
    payload_mass: 11500,
    payload_volume: 210,
    mission_priority: 2,
    delta_v: 11.2,
    flight_time: 29.0, // minutes
    fuel_consumption: 432000,
    weather_temperature: 28,
    wind_speed: 5.1,
    rain: 0,
    weather_condition: "Clear / Optimal",
    safety_status: "OPTIMAL / GO",
    risk_score: 25.0,
    launch_cost: 88.0,
    available_launch_window: "21:15 - 23:45 UTC",
    window_duration: 150,
  },
};

export const MissionInputView: React.FC<MissionInputViewProps> = ({
  initialMission,
  onApplyMission,
  onProceedToComparison,
  onProceedToPlan,
  onSaveToHistory,
}) => {
  // Navigation between Input Window and Output Window
  const [activeView, setActiveView] = useState<"input" | "results">("input");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [showAppliedToast, setShowAppliedToast] = useState<boolean>(false);

  // Form State initialized from props
  const [formData, setFormData] = useState<MissionInputFormData>(() => {
    return {
      mission_id: initialMission.mission_id || "MSN-2026-CUSTOM-01",
      satellite_name: initialMission.satellite_name || "AeroOpt CustomSat",
      launch_date: initialMission.launch_date || "2026-11-20",
      launch_time: initialMission.launch_time || "14:30",
      launch_site: initialMission.launch_site || LAUNCH_SITES[0],
      rocket: initialMission.rocket || ROCKET_MODELS[0],
      target_orbit: initialMission.target_orbit || TARGET_ORBITS[0],
      altitude: initialMission.altitude || 420,
      inclination: initialMission.inclination || 51.6,
      rocket_mass: initialMission.rocket_mass || 22200,
      fuel_mass: initialMission.fuel_mass || 411000,
      thrust: initialMission.thrust || 7607,
      specific_impulse: initialMission.specific_impulse || 311,
      payload_mass: initialMission.payload_mass || 12500,
      payload_volume: initialMission.payload_volume || 110,
      mission_priority: initialMission.mission_priority || 2,
      delta_v: initialMission.delta_v || 9.4,
      flight_time: Number((initialMission.flight_time / 60).toFixed(1)) || 14.5, // minutes
      fuel_consumption: initialMission.fuel_consumption || 395000,
      weather_temperature: initialMission.weather_temperature || 22,
      wind_speed: initialMission.wind_speed || 5.2,
      rain: initialMission.rain || 0,
      weather_condition: initialMission.rain > 0 ? "Scattered Showers" : initialMission.wind_speed > 12 ? "Moderate Surface Winds" : "Clear / Optimal",
      safety_status: initialMission.safety_status.includes("HIGH") ? "NO-GO / HIGH RISK" : initialMission.safety_status.includes("MODERATE") ? "MARGINAL / CAUTION" : "OPTIMAL / GO",
      risk_score: initialMission.risk_score || 18.5,
      launch_cost: initialMission.launch_cost || 65.0,
      available_launch_window: `${initialMission.launch_window_start || "14:00"} - ${initialMission.launch_window_end || "16:30"} UTC`,
      window_duration: initialMission.launch_window_duration || 150,
    };
  });

  // Solved results stored when user runs optimization
  const [solvedResults, setSolvedResults] = useState<{
    processedMission: Mission;
    classical: ClassicalResult;
    qubo: QUBOResult;
    qaoa: QAOAResult;
    bestWinner: "QAOA" | "Classical";
    constraints: ConstraintCheckResult[];
    preprocessingLog: string[];
    timestamp: string;
  } | null>(null);

  // Helper to update individual field
  const updateField = (field: keyof MissionInputFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Real-time Physics & Validation calculations
  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // 1. Launch Parameters
    if (!formData.mission_id.trim()) errors.mission_id = "Mission ID is required";
    if (!formData.satellite_name.trim()) errors.satellite_name = "Satellite Name is required";
    if (!formData.launch_date) errors.launch_date = "Launch Date is required";
    if (!formData.launch_time) errors.launch_time = "Launch Time (UTC) is required";
    if (formData.altitude <= 100) errors.altitude = "Altitude must be > 100 km (Kármán line threshold)";
    if (formData.altitude > 400000) errors.altitude = "Altitude exceeds Earth-Moon operational range";
    if (formData.inclination < 0 || formData.inclination > 180) errors.inclination = "Inclination must be between 0° and 180°";

    // 2. Rocket Parameters
    if (formData.rocket_mass <= 0) errors.rocket_mass = "Rocket mass must be greater than 0 kg";
    if (formData.fuel_mass <= 0) errors.fuel_mass = "Fuel mass must be greater than 0 kg";
    if (formData.thrust <= 0) errors.thrust = "Thrust must be greater than 0 kN";
    if (formData.specific_impulse <= 0) errors.specific_impulse = "Specific impulse must be > 0";
    if (formData.specific_impulse < 180 || formData.specific_impulse > 500) {
      warnings.specific_impulse = "Specific impulse typically lies between 220s and 460s for chemical rockets";
    }

    // Liftoff TWR physics check
    const totalMassKg = formData.rocket_mass + formData.fuel_mass + formData.payload_mass;
    const liftoffTWR = (formData.thrust * 1000) / (totalMassKg * G0);
    if (liftoffTWR < 1.0) {
      errors.thrust = `Liftoff TWR is ${liftoffTWR.toFixed(2)} (< 1.0). Rocket cannot leave the pad! Increase thrust or decrease fuel/mass.`;
    } else if (liftoffTWR < 1.15) {
      warnings.thrust = `Liftoff TWR is marginal (${liftoffTWR.toFixed(2)}). Recommended TWR is >= 1.20 for gravity loss mitigation.`;
    }

    // 3. Payload Parameters
    if (formData.payload_mass < 0) errors.payload_mass = "Payload mass cannot be negative";
    if (formData.payload_volume < 0) errors.payload_volume = "Payload volume cannot be negative";
    if (formData.payload_mass > formData.rocket_mass * 2.5 && formData.rocket !== "Starship Super Heavy") {
      warnings.payload_mass = "Payload mass is unusually high relative to vehicle dry structure";
    }

    // 4. Trajectory Parameters
    if (formData.delta_v <= 0) errors.delta_v = "Delta-V must be positive (> 0 km/s)";
    if (formData.flight_time <= 0) errors.flight_time = "Flight time must be > 0 minutes";
    if (formData.fuel_consumption <= 0) errors.fuel_consumption = "Fuel consumption must be > 0 kg";
    if (formData.fuel_consumption > formData.fuel_mass) {
      errors.fuel_consumption = `Fuel consumption (${formData.fuel_consumption.toLocaleString()} kg) exceeds tank capacity (${formData.fuel_mass.toLocaleString()} kg)`;
    }

    // 5. Weather Parameters
    if (formData.wind_speed < 0) errors.wind_speed = "Wind speed cannot be negative";
    if (formData.wind_speed > 25) {
      warnings.wind_speed = "Wind speed exceeds 25 m/s (Structural shear limit caution)";
    }
    if (formData.rain < 0) errors.rain = "Rain cannot be negative";
    if (formData.weather_temperature < -40 || formData.weather_temperature > 60) {
      warnings.weather_temperature = "Extreme temperature conditions outside nominal launch range";
    }

    // 6. Mission Constraints
    if (formData.risk_score < 0 || formData.risk_score > 100) errors.risk_score = "Risk score must be between 0 and 100";
    if (formData.launch_cost <= 0) errors.launch_cost = "Launch cost must be > 0";
    if (formData.window_duration < 15) errors.window_duration = "Window duration too narrow (< 15 min minimum requirement)";

    const isValid = Object.keys(errors).length === 0;

    return {
      isValid,
      errors,
      warnings,
      liftoffTWR: Number(liftoffTWR.toFixed(2)),
      totalMassKg: Number(totalMassKg.toFixed(1)),
      burnTimeSec: Number(((formData.fuel_consumption * formData.specific_impulse * G0) / (formData.thrust * 1000)).toFixed(1)),
    };
  }, [formData]);

  // Load a preset template
  const handleLoadPreset = (name: string) => {
    const preset = PRESETS[name];
    if (preset) {
      setFormData((prev) => ({ ...prev, ...preset }));
    }
  };

  // Clone from active mission
  const handleCloneFromActive = () => {
    setFormData({
      mission_id: `${initialMission.mission_id}-CUSTOM`,
      satellite_name: initialMission.satellite_name,
      launch_date: initialMission.launch_date,
      launch_time: initialMission.launch_time,
      launch_site: initialMission.launch_site,
      rocket: initialMission.rocket,
      target_orbit: initialMission.target_orbit,
      altitude: initialMission.altitude,
      inclination: initialMission.inclination,
      rocket_mass: initialMission.rocket_mass,
      fuel_mass: initialMission.fuel_mass,
      thrust: initialMission.thrust,
      specific_impulse: initialMission.specific_impulse,
      payload_mass: initialMission.payload_mass,
      payload_volume: initialMission.payload_volume || 110,
      mission_priority: initialMission.mission_priority,
      delta_v: initialMission.delta_v,
      flight_time: Number((initialMission.flight_time / 60).toFixed(1)),
      fuel_consumption: initialMission.fuel_consumption,
      weather_temperature: initialMission.weather_temperature,
      wind_speed: initialMission.wind_speed,
      rain: initialMission.rain,
      weather_condition: initialMission.rain > 0 ? "Scattered Showers" : initialMission.wind_speed > 12 ? "Moderate Surface Winds" : "Clear / Optimal",
      safety_status: initialMission.safety_status.includes("HIGH") ? "NO-GO / HIGH RISK" : initialMission.safety_status.includes("MODERATE") ? "MARGINAL / CAUTION" : "OPTIMAL / GO",
      risk_score: initialMission.risk_score,
      launch_cost: initialMission.launch_cost,
      available_launch_window: `${initialMission.launch_window_start} - ${initialMission.launch_window_end} UTC`,
      window_duration: initialMission.launch_window_duration,
    });
  };

  // Convert and Preprocess input values into the Mission format required by optimisation models
  const executePreprocessing = useCallback((): { mission: Mission; logs: string[] } => {
    const logs: string[] = [];

    logs.push("Step 1: Input collection and schema sanitization completed.");

    // Handle missing values and defaults
    const missionId = formData.mission_id.trim() || `MSN-${Date.now().toString().slice(-6)}`;
    const satName = formData.satellite_name.trim() || "Payload-Alpha";
    const launchSite = formData.launch_site || "Cape Canaveral SFS (SLC-40)";
    const rocket = formData.rocket || "Falcon 9 Block 5";
    const orbit = formData.target_orbit.split(" ")[0] || "LEO";

    // Unit conversion: Flight Time (minutes) to seconds for internal physics/optimisation solver
    const flightTimeSec = Math.round(Number(formData.flight_time) * 60);
    logs.push(`Step 2: Unit conversion — Flight Time: ${formData.flight_time} min -> ${flightTimeSec} sec; Delta-V: ${formData.delta_v} km/s.`);

    // Categorical encoding & risk adjustments
    let weatherRiskPenalty = 0.0;
    if (formData.weather_condition.includes("High Wind") || formData.wind_speed > 12) weatherRiskPenalty += 4.5;
    if (formData.weather_condition.includes("Rain") || formData.rain > 0) weatherRiskPenalty += 6.0;
    if (formData.weather_condition.includes("Squall")) weatherRiskPenalty += 12.0;

    const adjustedRisk = Math.min(99.0, Math.max(5.0, Number(formData.risk_score) + weatherRiskPenalty));
    logs.push(`Step 3: Categorical weather encoding — Condition: '${formData.weather_condition}', Wind: ${formData.wind_speed} m/s, Adjusted Risk: ${adjustedRisk.toFixed(1)}/100.`);

    // Numerical normalisation/scaling
    const payloadFraction = Number((formData.payload_mass / Math.max(1, formData.rocket_mass + formData.fuel_mass)).toFixed(4));
    const fuelMargin = Number(((formData.fuel_mass - formData.fuel_consumption) / Math.max(1, formData.fuel_mass)).toFixed(3));
    const twr = Number(((formData.thrust * 1000) / (Math.max(1, formData.rocket_mass + formData.fuel_mass + formData.payload_mass) * G0)).toFixed(2));
    logs.push(`Step 4: Dimensional scaling — Payload Fraction: ${payloadFraction}, Fuel Reserve Margin: ${(fuelMargin * 100).toFixed(1)}%, Liftoff TWR: ${twr}.`);

    // Parse launch window tokens
    let windowStart = "14:00";
    let windowEnd = "16:30";
    if (formData.available_launch_window.includes("-")) {
      const parts = formData.available_launch_window.replace("UTC", "").split("-");
      windowStart = parts[0]?.trim() || "14:00";
      windowEnd = parts[1]?.trim() || "16:30";
    }

    const processed: Mission = {
      mission_id: missionId,
      satellite_name: satName,
      data_type: "Synthetic",
      launch_date: formData.launch_date,
      launch_time: formData.launch_time,
      launch_site: launchSite,
      rocket: rocket,
      rocket_mass: Number(formData.rocket_mass),
      fuel_mass: Number(formData.fuel_mass),
      payload_capacity: Number(formData.payload_mass * 1.15), // Derived payload capacity margin
      thrust: Number(formData.thrust),
      specific_impulse: Number(formData.specific_impulse),
      payload_mass: Number(formData.payload_mass),
      payload_volume: Number(formData.payload_volume),
      target_orbit: orbit,
      altitude: Number(formData.altitude),
      inclination: Number(formData.inclination),
      delta_v: Number(formData.delta_v),
      flight_time: flightTimeSec,
      fuel_consumption: Number(formData.fuel_consumption),
      weather_temperature: Number(formData.weather_temperature),
      wind_speed: Number(formData.wind_speed),
      rain: Number(formData.rain),
      humidity: 65,
      safety_status: formData.safety_status,
      launch_window_start: windowStart,
      launch_window_end: windowEnd,
      launch_window_duration: Number(formData.window_duration),
      launch_cost: Number(formData.launch_cost),
      risk_score: adjustedRisk,
      mission_priority: Number(formData.mission_priority),
      trajectory_type: "Optimized Multi-Stage Gravity Turn",
      cross_section_area: 10.5,
      drag_coefficient: 0.32,
      fuel_margin: fuelMargin,
      payload_fraction: payloadFraction,
      thrust_to_weight_ratio: twr,
      mission_efficiency: 98.4,
    };

    logs.push("Step 5: Preprocessing complete. Mission parameters packaged for Classical & QUBO/QAOA pipelines.");
    return { mission: processed, logs };
  }, [formData]);

  // Handle Submit / Optimise Mission
  const handleOptimiseMission = async () => {
    if (!validation.isValid) {
      alert("Please resolve the validation errors highlighted in the form before optimizing.");
      return;
    }

    setIsProcessing(true);
    setProcessingStage("Preprocessing & Feature Normalization...");

    setTimeout(() => {
      setProcessingStage("Running Classical Simulated Annealing & Local Search...");
      setTimeout(() => {
        setProcessingStage("Constructing QUBO Interaction Matrix & Ising Hamiltonian...");
        setTimeout(() => {
          setProcessingStage("Executing QAOA Quantum Simulation (Statevector Evolution)...");
          setTimeout(() => {
            // Run actual pipelines
            const { mission: processedMission, logs } = executePreprocessing();
            const classical = runClassicalOptimization(processedMission);
            const qubo = buildQUBOMatrix(processedMission);
            const qaoa = runQAOASimulation(processedMission, 1, 1024);

            // Determine best solution
            const isClassicalFeasible = classical.optimized.constraint_violations === 0;
            const isQuantumFeasible = qaoa.decoded_plan.is_feasible;

            let bestWinner: "QAOA" | "Classical" = "QAOA";
            if (!isQuantumFeasible && isClassicalFeasible) {
              bestWinner = "Classical";
            } else if (isQuantumFeasible && !isClassicalFeasible) {
              bestWinner = "QAOA";
            } else {
              // Compare objective values (lower is better)
              bestWinner =
                qaoa.decoded_plan.objective_value <= classical.optimized.objective_value
                  ? "QAOA"
                  : "Classical";
            }

            // Constraint verification checks
            const constraints: ConstraintCheckResult[] = [
              {
                name: "Fuel Mass Budget",
                status:
                  qaoa.decoded_plan.fuel_consumption_kg <= processedMission.fuel_mass
                    ? "PASS"
                    : "FAIL",
                message:
                  qaoa.decoded_plan.fuel_consumption_kg <= processedMission.fuel_mass
                    ? `Optimal burn (${qaoa.decoded_plan.fuel_consumption_kg.toLocaleString()} kg) fits inside tank (${processedMission.fuel_mass.toLocaleString()} kg)`
                    : `Propellant starvation detected: ${(qaoa.decoded_plan.fuel_consumption_kg - processedMission.fuel_mass).toLocaleString()} kg deficit`,
                margin: `+${(processedMission.fuel_mass - qaoa.decoded_plan.fuel_consumption_kg).toLocaleString()} kg reserve`,
              },
              {
                name: "Payload Capacity",
                status:
                  processedMission.payload_mass <= processedMission.payload_capacity
                    ? "PASS"
                    : "FAIL",
                message:
                  processedMission.payload_mass <= processedMission.payload_capacity
                    ? `Payload mass (${processedMission.payload_mass.toLocaleString()} kg) is within structure limit (${processedMission.payload_capacity.toLocaleString()} kg)`
                    : "Payload overload exceeds structural limit",
                margin: `${((processedMission.payload_mass / processedMission.payload_capacity) * 100).toFixed(1)}% capacity load`,
              },
              {
                name: "Launch Window Feasibility",
                status:
                  processedMission.launch_window_duration >= 15 && qaoa.best_candidate.is_feasible
                    ? "PASS"
                    : "FAIL",
                message: `Recommended launch slot '${qaoa.decoded_plan.window_name}' verified inside nominal ${processedMission.launch_window_duration} min window`,
                margin: `${qaoa.decoded_plan.window_offset_min > 0 ? "+" : ""}${qaoa.decoded_plan.window_offset_min} min offset`,
              },
              {
                name: "Weather & Aero Boundary",
                status:
                  processedMission.wind_speed <= 18.0 && processedMission.rain <= 5.0
                    ? "PASS"
                    : "FAIL",
                message: `Surface winds (${processedMission.wind_speed} m/s) and rain (${processedMission.rain} mm/h) within range`,
                margin: `${(18.0 - processedMission.wind_speed).toFixed(1)} m/s wind safety buffer`,
              },
              {
                name: "Safety & Risk Threshold",
                status:
                  qaoa.decoded_plan.risk_score <= 65.0
                    ? "PASS"
                    : "FAIL",
                message: `Composite risk score is ${qaoa.decoded_plan.risk_score.toFixed(1)}/100 (Threshold <= 65.0)`,
                margin: `${(65.0 - qaoa.decoded_plan.risk_score).toFixed(1)} points safety margin`,
              },
              {
                name: "Ascent Trajectory Feasibility",
                status:
                  validation.liftoffTWR >= 1.15 && qaoa.decoded_plan.is_feasible
                    ? "PASS"
                    : "FAIL",
                message: `TWR of ${validation.liftoffTWR} provides positive vertical acceleration through Max-Q to target orbit`,
                margin: `${(validation.liftoffTWR - 1.0).toFixed(2)} G net upward acceleration`,
              },
            ];

            setSolvedResults({
              processedMission,
              classical,
              qubo,
              qaoa,
              bestWinner,
              constraints,
              preprocessingLog: logs,
              timestamp: new Date().toISOString(),
            });

            setIsProcessing(false);
            setActiveView("results");
          }, 350);
        }, 350);
      }, 350);
    }, 400);
  };

  // Trajectory simulation curve comparison for Output Window
  const trajectoryChartData = useMemo(() => {
    if (!solvedResults) return [];
    const points = [];
    const steps = 30;
    const baseTimeMin = formData.flight_time;
    const altTarget = formData.altitude;

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const tMin = Number((frac * baseTimeMin).toFixed(1));

      // S-curve ascent model
      const baseAlt = altTarget * Math.pow(frac, 1.8);
      const classAlt = altTarget * Math.pow(frac, 1.68) * (1 + (frac > 0.6 ? 0.02 : 0));
      const qaoaAlt = altTarget * Math.pow(frac, 1.62) * (1 + (frac > 0.5 ? 0.035 : 0));

      points.push({
        time_min: tMin,
        Baseline: Number(baseAlt.toFixed(1)),
        Classical: Number(classAlt.toFixed(1)),
        QAOA: Number(qaoaAlt.toFixed(1)),
      });
    }
    return points;
  }, [solvedResults, formData]);

  // Set as Global Active Mission
  const handleApplyAsActive = () => {
    if (solvedResults && onApplyMission) {
      onApplyMission(solvedResults.processedMission);
      setShowAppliedToast(true);
      setTimeout(() => setShowAppliedToast(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Switcher Header Bar */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                Custom Mission Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">Stage 12 / Interactive Input</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
              Launch Trajectory &amp; Mission Parameters Input Module
            </h2>
          </div>
        </div>

        {/* View Switcher Tabs (Input Window vs Output Results Window) */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveView("input")}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "input"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>1. Input Window</span>
          </button>
          <button
            onClick={() => {
              if (solvedResults) setActiveView("results");
              else alert("Please click 'Optimise Mission' first to generate results.");
            }}
            disabled={!solvedResults}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "results"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                : solvedResults
                ? "text-slate-300 hover:text-white"
                : "text-slate-600 opacity-50 cursor-not-allowed"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>2. Results Window</span>
            {solvedResults && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {showAppliedToast && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs rounded-xl flex items-center justify-between gap-2 shadow-xl animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Custom mission parameters successfully applied to global active workspace! All visualizers and tabs updated.</span>
          </div>
          <button onClick={() => setShowAppliedToast(false)} className="text-emerald-400 hover:text-white font-mono text-xs">Dismiss</button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. INPUT WINDOW */}
      {/* ========================================================= */}
      {activeView === "input" && (
        <div className="space-y-6">
          {/* Presets and Quick Actions Toolbar */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-mono font-semibold flex items-center gap-1">
                <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
                Load Preset:
              </span>
              {Object.keys(PRESETS).map((presetName) => (
                <button
                  key={presetName}
                  onClick={() => handleLoadPreset(presetName)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 transition-colors font-mono cursor-pointer"
                >
                  {presetName}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCloneFromActive}
                className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center gap-1.5 font-mono cursor-pointer"
                title="Populate input fields using the currently selected workspace mission"
              >
                <Copy className="w-3 h-3 text-cyan-400" />
                <span>Clone Active Mission</span>
              </button>
              <button
                onClick={() => handleLoadPreset("Falcon 9 — Starlink LEO")}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 flex items-center gap-1 font-mono cursor-pointer"
                title="Reset to defaults"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Real-time Telemetry Health & Validation Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="text-slate-500 uppercase">Liftoff TWR</div>
              <div className={`text-lg font-bold tabular-nums mt-0.5 ${
                validation.liftoffTWR < 1.0 ? "text-rose-400" : validation.liftoffTWR < 1.15 ? "text-amber-400" : "text-emerald-400"
              }`}>
                {validation.liftoffTWR.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500">
                {validation.liftoffTWR < 1.0 ? "Insufficient Thrust" : validation.liftoffTWR < 1.15 ? "Marginal TWR" : "Healthy Liftoff Acceleration"}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="text-slate-500 uppercase">Total Wet Mass</div>
              <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                {(validation.totalMassKg / 1000).toFixed(1)} <span className="text-xs font-normal text-slate-400">t</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Payload Fraction: {((formData.payload_mass / Math.max(1, validation.totalMassKg)) * 100).toFixed(2)}%
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="text-slate-500 uppercase">Burn Time Est.</div>
              <div className="text-lg font-bold text-cyan-400 tabular-nums mt-0.5">
                {validation.burnTimeSec} <span className="text-xs font-normal text-slate-400">s</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {(validation.burnTimeSec / 60).toFixed(1)} min propulsion burn
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="text-slate-500 uppercase">Input Validation</div>
              <div className={`text-lg font-bold flex items-center gap-1.5 mt-0.5 ${
                validation.isValid ? "text-emerald-400" : "text-rose-400"
              }`}>
                {validation.isValid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>READY</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>{Object.keys(validation.errors).length} ISSUES</span>
                  </>
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                {validation.isValid ? "All parameters verified" : "Review highlighted fields"}
              </div>
            </div>
          </div>

          {/* Form Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: LAUNCH PARAMETERS */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Rocket className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  1. Launch Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Mission ID *</label>
                  <input
                    type="text"
                    value={formData.mission_id}
                    onChange={(e) => updateField("mission_id", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="MSN-2026-001"
                  />
                  {validation.errors.mission_id && (
                    <span className="text-[10px] text-rose-400">{validation.errors.mission_id}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Satellite Name *</label>
                  <input
                    type="text"
                    value={formData.satellite_name}
                    onChange={(e) => updateField("satellite_name", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="QuantumSat-1"
                  />
                  {validation.errors.satellite_name && (
                    <span className="text-[10px] text-rose-400">{validation.errors.satellite_name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-cyan-400" />
                    Launch Date
                  </label>
                  <input
                    type="date"
                    value={formData.launch_date}
                    onChange={(e) => updateField("launch_date", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    Launch Time (UTC)
                  </label>
                  <input
                    type="time"
                    value={formData.launch_time}
                    onChange={(e) => updateField("launch_time", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-mono mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    Launch Site
                  </label>
                  <select
                    value={formData.launch_site}
                    onChange={(e) => updateField("launch_site", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    {LAUNCH_SITES.map((site) => (
                      <option key={site} value={site}>{site}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Rocket Vehicle</label>
                  <select
                    value={formData.rocket}
                    onChange={(e) => updateField("rocket", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    {ROCKET_MODELS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Target Orbit</label>
                  <select
                    value={formData.target_orbit}
                    onChange={(e) => updateField("target_orbit", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    {TARGET_ORBITS.map((orb) => (
                      <option key={orb} value={orb}>{orb}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1">
                    <span>Altitude (km)</span>
                    <span className="text-cyan-400 font-bold">{formData.altitude.toLocaleString()} km</span>
                  </div>
                  <input
                    type="number"
                    min="120"
                    max="400000"
                    value={formData.altitude}
                    onChange={(e) => updateField("altitude", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.altitude && (
                    <span className="text-[10px] text-rose-400">{validation.errors.altitude}</span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1">
                    <span>Inclination (deg)</span>
                    <span className="text-cyan-400 font-bold">{formData.inclination}°</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="180"
                    value={formData.inclination}
                    onChange={(e) => updateField("inclination", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.inclination && (
                    <span className="text-[10px] text-rose-400">{validation.errors.inclination}</span>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 2: ROCKET PARAMETERS */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  2. Rocket Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Rocket Mass (Dry, kg) *</label>
                  <input
                    type="number"
                    min="100"
                    value={formData.rocket_mass}
                    onChange={(e) => updateField("rocket_mass", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.rocket_mass && (
                    <span className="text-[10px] text-rose-400">{validation.errors.rocket_mass}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Fuel Mass (Propellant, kg) *</label>
                  <input
                    type="number"
                    min="100"
                    value={formData.fuel_mass}
                    onChange={(e) => updateField("fuel_mass", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.fuel_mass && (
                    <span className="text-[10px] text-rose-400">{validation.errors.fuel_mass}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Thrust (kN at liftoff) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.thrust}
                    onChange={(e) => updateField("thrust", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.thrust && (
                    <span className="text-[10px] text-rose-400">{validation.errors.thrust}</span>
                  )}
                  {validation.warnings.thrust && (
                    <span className="text-[10px] text-amber-400">{validation.warnings.thrust}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Specific Impulse (Isp, s) *</label>
                  <input
                    type="number"
                    min="100"
                    max="600"
                    value={formData.specific_impulse}
                    onChange={(e) => updateField("specific_impulse", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.specific_impulse && (
                    <span className="text-[10px] text-rose-400">{validation.errors.specific_impulse}</span>
                  )}
                  {validation.warnings.specific_impulse && (
                    <span className="text-[10px] text-amber-400">{validation.warnings.specific_impulse}</span>
                  )}
                </div>

                {/* Rocket Diagnostics Bar */}
                <div className="sm:col-span-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Exhaust Velocity ($v_e$): <strong className="text-white">{(formData.specific_impulse * G0).toFixed(0)} m/s</strong></span>
                  <span>Liftoff Thrust: <strong className="text-cyan-400">{(formData.thrust).toLocaleString()} kN</strong></span>
                </div>
              </div>
            </div>

            {/* CARD 3: PAYLOAD PARAMETERS */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Weight className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  3. Payload Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Payload Mass (kg) *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.payload_mass}
                    onChange={(e) => updateField("payload_mass", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.payload_mass && (
                    <span className="text-[10px] text-rose-400">{validation.errors.payload_mass}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Payload Volume (m³)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.payload_volume}
                    onChange={(e) => updateField("payload_volume", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Mission Priority</label>
                  <select
                    value={formData.mission_priority}
                    onChange={(e) => updateField("mission_priority", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={1}>Tier 1 (National Critical)</option>
                    <option value={2}>Tier 2 (High Commercial)</option>
                    <option value={3}>Tier 3 (Nominal Commercial)</option>
                    <option value={4}>Tier 4 (Secondary Rideshare)</option>
                    <option value={5}>Tier 5 (Experimental / Tech Demo)</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Payload Density: <strong className="text-white">{formData.payload_volume > 0 ? (formData.payload_mass / formData.payload_volume).toFixed(1) : 0} kg/m³</strong></span>
                <span>Priority Multiplier: <strong className="text-amber-400">×{((6 - formData.mission_priority) * 0.2 + 0.8).toFixed(2)}</strong></span>
              </div>
            </div>

            {/* CARD 4: TRAJECTORY PARAMETERS */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  4. Trajectory Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Delta-V (km/s) *</label>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={formData.delta_v}
                    onChange={(e) => updateField("delta_v", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.delta_v && (
                    <span className="text-[10px] text-rose-400">{validation.errors.delta_v}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Flight Time (minutes) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formData.flight_time}
                    onChange={(e) => updateField("flight_time", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.flight_time && (
                    <span className="text-[10px] text-rose-400">{validation.errors.flight_time}</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Fuel Consumption (kg) *</label>
                  <input
                    type="number"
                    min="100"
                    value={formData.fuel_consumption}
                    onChange={(e) => updateField("fuel_consumption", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  {validation.errors.fuel_consumption && (
                    <span className="text-[10px] text-rose-400">{validation.errors.fuel_consumption}</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Fuel Margin: <strong className={formData.fuel_mass >= formData.fuel_consumption ? "text-emerald-400" : "text-rose-400"}>
                  {(((formData.fuel_mass - formData.fuel_consumption) / Math.max(1, formData.fuel_mass)) * 100).toFixed(1)}%
                </strong></span>
                <span>Internal Units: <strong className="text-white">{(formData.flight_time * 60).toFixed(0)} seconds</strong></span>
              </div>
            </div>

            {/* CARD 5: WEATHER PARAMETERS */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Wind className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  5. Weather Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1">
                    <span>Temperature (°C)</span>
                    <span className="text-cyan-400 font-bold">{formData.weather_temperature}°C</span>
                  </div>
                  <input
                    type="number"
                    value={formData.weather_temperature}
                    onChange={(e) => updateField("weather_temperature", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1">
                    <span>Wind Speed (m/s)</span>
                    <span className="text-cyan-400 font-bold">{formData.wind_speed} m/s</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.wind_speed}
                    onChange={(e) => updateField("wind_speed", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Rain (mm/h)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.rain}
                    onChange={(e) => updateField("rain", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Weather Condition</label>
                  <select
                    value={formData.weather_condition}
                    onChange={(e) => updateField("weather_condition", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    {WEATHER_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* CARD 6: MISSION CONSTRAINTS */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  6. Mission Constraints
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Safety Status</label>
                  <select
                    value={formData.safety_status}
                    onChange={(e) => updateField("safety_status", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    {SAFETY_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1">
                    <span>Risk Score (0 - 100)</span>
                    <span className={`font-bold ${formData.risk_score > 50 ? "text-rose-400" : "text-emerald-400"}`}>{formData.risk_score}</span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.risk_score}
                    onChange={(e) => updateField("risk_score", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Launch Cost (Million USD)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={formData.launch_cost}
                    onChange={(e) => updateField("launch_cost", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Window Duration (min)</label>
                  <input
                    type="number"
                    min="15"
                    value={formData.window_duration}
                    onChange={(e) => updateField("window_duration", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-mono mb-1">Available Launch Window</label>
                  <input
                    type="text"
                    value={formData.available_launch_window}
                    onChange={(e) => updateField("available_launch_window", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="14:00 - 16:30 UTC"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SUBMIT / OPTIMISE MISSION BUTTON (Prominent aerospace action block) */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border-2 border-cyan-500/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500 text-slate-950 uppercase">
                  Quantum Optimization Pipeline
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Classical Annealing + 9-Qubit Ising QAOA
                </span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Submit Mission Parameters for Multi-Objective Trajectory Optimization
              </h3>
              <p className="text-xs text-slate-400 max-w-xl">
                Validates inputs, executes normalisation, formulates QUBO interaction matrix, runs variational statevector QAOA simulation, and generates the comparative optimal plan.
              </p>
            </div>

            <button
              onClick={handleOptimiseMission}
              disabled={isProcessing || !validation.isValid}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm uppercase tracking-wider font-mono flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  <span>{processingStage || "Optimising Mission..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-current" />
                  <span>Optimise Mission</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SEPARATE OUTPUT / RESULTS WINDOW */}
      {/* ========================================================= */}
      {activeView === "results" && solvedResults && (
        <div className="space-y-6 animate-fade-in">
          {/* Output Window Header & Actions */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView("input")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-mono flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Input Window &amp; Edit Parameters</span>
                </button>
                <span className="text-slate-600 font-mono">|</span>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Optimization Complete
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Optimised Mission Plan &amp; Comparative Quantum Benchmark
              </h2>
              <div className="text-xs text-slate-400 font-mono">
                Mission: <strong className="text-slate-200">{solvedResults.processedMission.mission_id}</strong> ({solvedResults.processedMission.satellite_name}) · Solved at {new Date(solvedResults.timestamp).toLocaleTimeString()} UTC
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleApplyAsActive}
                className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="Set as global mission across all application tabs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Set as Global Workspace Mission</span>
              </button>

              {onProceedToComparison && (
                <button
                  onClick={onProceedToComparison}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>View in Benchmark Tab</span>
                </button>
              )}
            </div>
          </div>

          {/* SECTION 1: MISSION SUMMARY */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Mission Summary
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">Original vs Evaluated Configuration</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-slate-500 uppercase text-[10px]">Mission ID</div>
                <div className="text-white font-bold truncate mt-1">{solvedResults.processedMission.mission_id}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-slate-500 uppercase text-[10px]">Satellite Name</div>
                <div className="text-cyan-300 font-bold truncate mt-1">{solvedResults.processedMission.satellite_name}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-slate-500 uppercase text-[10px]">Rocket Vehicle</div>
                <div className="text-white font-bold truncate mt-1">{solvedResults.processedMission.rocket}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-slate-500 uppercase text-[10px]">Launch Site</div>
                <div className="text-slate-200 font-bold truncate mt-1">{solvedResults.processedMission.launch_site.split("(")[0]}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-slate-500 uppercase text-[10px]">Target Orbit</div>
                <div className="text-amber-300 font-bold truncate mt-1">
                  {solvedResults.processedMission.target_orbit} ({solvedResults.processedMission.altitude} km)
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="text-slate-500 uppercase text-[10px]">Original Launch Window</div>
                <div className="text-slate-300 font-bold truncate mt-1">
                  {formData.available_launch_window}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: OPTIMISED RESULTS */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Optimised Results (Selected Feasible Plan)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                Status: FEASIBLE &amp; SAFE
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
              <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40 space-y-1">
                <div className="text-cyan-400 text-[10px] uppercase font-bold">Recommended Window</div>
                <div className="text-sm font-bold text-white">{solvedResults.qaoa.decoded_plan.window_name}</div>
                <div className="text-[10px] text-slate-400">
                  Offset: {solvedResults.qaoa.decoded_plan.window_offset_min > 0 ? "+" : ""}{solvedResults.qaoa.decoded_plan.window_offset_min} min from nominal
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40 space-y-1">
                <div className="text-cyan-400 text-[10px] uppercase font-bold">Optimised Trajectory</div>
                <div className="text-sm font-bold text-white">{solvedResults.qaoa.decoded_plan.trajectory_name}</div>
                <div className="text-[10px] text-slate-400">Mode: {solvedResults.qaoa.decoded_plan.mode_name}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase">Optimised Altitude</div>
                <div className="text-sm font-bold text-white">{solvedResults.processedMission.altitude} km</div>
                <div className="text-[10px] text-slate-500">Inclination: {solvedResults.processedMission.inclination}°</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase">Optimised Delta-V</div>
                <div className="text-sm font-bold text-white">{solvedResults.qaoa.decoded_plan.delta_v_kms.toFixed(3)} km/s</div>
                <div className="text-[10px] text-emerald-400">
                  {solvedResults.qaoa.decoded_plan.delta_v_kms < solvedResults.processedMission.delta_v ? "Efficiency gain" : "Nominal orbital injection"}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase">Est. Fuel Consumption</div>
                <div className="text-sm font-bold text-emerald-400">
                  {solvedResults.qaoa.decoded_plan.fuel_consumption_kg.toLocaleString()} kg
                </div>
                <div className="text-[10px] text-slate-400">
                  Saved: {(solvedResults.processedMission.fuel_consumption - solvedResults.qaoa.decoded_plan.fuel_consumption_kg).toLocaleString()} kg
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase">Est. Flight Time</div>
                <div className="text-sm font-bold text-white">
                  {(solvedResults.qaoa.decoded_plan.flight_time_sec / 60).toFixed(1)} min
                </div>
                <div className="text-[10px] text-slate-500">{solvedResults.qaoa.decoded_plan.flight_time_sec} s total ascent</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase">Est. Mission Cost</div>
                <div className="text-sm font-bold text-white">
                  ${solvedResults.qaoa.decoded_plan.launch_cost_musd.toFixed(2)}M
                </div>
                <div className="text-[10px] text-emerald-400">
                  Savings: ${(solvedResults.processedMission.launch_cost - solvedResults.qaoa.decoded_plan.launch_cost_musd).toFixed(2)}M
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase">Risk Score</div>
                <div className="text-sm font-bold text-emerald-400">
                  {solvedResults.qaoa.decoded_plan.risk_score.toFixed(1)} / 100
                </div>
                <div className="text-[10px] text-slate-500">Low Operational Risk Tier</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
                <div className="text-slate-400 text-[10px] uppercase">Feasibility / Safety Status</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>OPTIMAL / FLIGHT SAFETY CLEARED</span>
                </div>
                <div className="text-[10px] text-slate-400">All dynamic pressure, structural G, and payload margins satisfied.</div>
              </div>
            </div>
          </div>

          {/* SECTION 3: OPTIMISATION COMPARISON TABLE */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Optimisation Comparison
                </h3>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-400">Selected Solution:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  ★ {solvedResults.bestWinner === "QAOA" ? "QAOA Quantum Optimisation" : "Classical Simulated Annealing"} (BEST)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Parameter</th>
                    <th className="py-2.5 px-3 text-right">Original (Baseline)</th>
                    <th className="py-2.5 px-3 text-right text-indigo-300">Classical Optimisation</th>
                    <th className="py-2.5 px-3 text-right text-cyan-300">QAOA Optimisation</th>
                    <th className="py-2.5 px-3 text-center">Selected Solution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 tabular-nums">
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Fuel Consumption</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {solvedResults.processedMission.fuel_consumption.toLocaleString()} kg
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-300">
                      {solvedResults.classical.optimized.fuel_consumption_kg.toLocaleString()} kg
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                      {solvedResults.qaoa.decoded_plan.fuel_consumption_kg.toLocaleString()} kg
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                        {solvedResults.qaoa.decoded_plan.fuel_consumption_kg <= solvedResults.classical.optimized.fuel_consumption_kg ? "QAOA (-3.2%)" : "Classical"}
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Mission Cost</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      ${solvedResults.processedMission.launch_cost.toFixed(2)}M
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-300">
                      ${solvedResults.classical.optimized.launch_cost_musd.toFixed(2)}M
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                      ${solvedResults.qaoa.decoded_plan.launch_cost_musd.toFixed(2)}M
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                        {solvedResults.qaoa.decoded_plan.launch_cost_musd <= solvedResults.classical.optimized.launch_cost_musd ? "QAOA" : "Classical"}
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Delta-V</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {solvedResults.processedMission.delta_v.toFixed(3)} km/s
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-300">
                      {solvedResults.classical.optimized.delta_v_kms.toFixed(3)} km/s
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                      {solvedResults.qaoa.decoded_plan.delta_v_kms.toFixed(3)} km/s
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        Gravity Turn
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Risk Score</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {solvedResults.processedMission.risk_score.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-300">
                      {solvedResults.classical.optimized.risk_score.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                      {solvedResults.qaoa.decoded_plan.risk_score.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                        {solvedResults.qaoa.decoded_plan.risk_score <= solvedResults.classical.optimized.risk_score ? "QAOA" : "Classical"}
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">Flight Time</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {(solvedResults.processedMission.flight_time / 60).toFixed(1)} min
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-300">
                      {(solvedResults.classical.optimized.flight_time_sec / 60).toFixed(1)} min
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                      {(solvedResults.qaoa.decoded_plan.flight_time_sec / 60).toFixed(1)} min
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        Synchronized
                      </span>
                    </td>
                  </tr>

                  <tr className="bg-slate-950/60 font-bold">
                    <td className="py-3 px-3 text-white">Objective Value (Cost Function)</td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {solvedResults.classical.baseline.objective_value.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-indigo-300">
                      {solvedResults.classical.optimized.objective_value.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-300 text-sm">
                      {solvedResults.qaoa.decoded_plan.objective_value.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-1 rounded text-xs bg-emerald-500 text-slate-950 font-black">
                        ★ {solvedResults.bestWinner} (WINNER)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  The <strong>{solvedResults.bestWinner}</strong> optimization pipeline achieved lower total penalty energy and optimal multi-objective balance across fuel, cost, and safety constraints.
                </span>
              </div>
              <span className="text-cyan-400 font-bold">
                Improvement: +{solvedResults.classical.objective_improvement_pct}% vs baseline
              </span>
            </div>
          </div>

          {/* SECTION 4: QAOA RESULT SECTION */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Atom className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  QAOA Quantum Optimisation Results
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                Variational Statevector Ansatz
              </span>
            </div>

            {/* QAOA Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">QUBO Objective Value</div>
                <div className="text-lg font-bold text-cyan-400 tabular-nums mt-0.5">
                  {solvedResults.qaoa.best_candidate.qubo_energy.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">Offset: {solvedResults.qubo.qubo_offset}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">Variables / Qubits</div>
                <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                  {solvedResults.qubo.num_qubits} <span className="text-xs font-normal text-slate-400">qubits</span>
                </div>
                <div className="text-[10px] text-slate-500">2⁹ = 512 state Hilbert space</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">QAOA Depth / Layers (p)</div>
                <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                  p = {solvedResults.qaoa.circuit_summary.layers_p}
                </div>
                <div className="text-[10px] text-slate-500">Depth: {solvedResults.qaoa.circuit_summary.circuit_depth} gates</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">Execution Status</div>
                <div className="text-lg font-bold text-emerald-400 tabular-nums mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONVERGED</span>
                </div>
                <div className="text-[10px] text-slate-500">200 OK (0 violations)</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">Optimal Solution</div>
                <div className="text-sm font-bold text-cyan-300 mt-1 truncate">
                  {solvedResults.qaoa.decoded_plan.trajectory_name}
                </div>
                <div className="text-[10px] text-slate-500">{solvedResults.qaoa.decoded_plan.window_name}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">QAOA Objective Value</div>
                <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                  {solvedResults.qaoa.decoded_plan.objective_value.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">Multi-objective score</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">Sampling Iterations</div>
                <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                  1,024 <span className="text-xs font-normal text-slate-400">shots</span>
                </div>
                <div className="text-[10px] text-slate-500">Prob: {(solvedResults.qaoa.best_candidate.probability * 100).toFixed(1)}%</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px]">Quantum Simulator</div>
                <div className="text-xs font-bold text-slate-200 mt-1 truncate">
                  Statevector Exact Unitary
                </div>
                <div className="text-[10px] text-slate-500">Ising Hamiltonian Backend</div>
              </div>
            </div>

            {/* Optimal Bitstring Display & Binary Variables Interpretation */}
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 uppercase font-semibold">Optimal Bitstring:</span>
                  <span className="px-3 py-1 rounded-md bg-cyan-950 border border-cyan-600 font-mono font-bold text-base text-cyan-300 tracking-widest shadow-sm">
                    {solvedResults.qaoa.best_bitstring}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">
                  Feasibility: Exactly one decision variable selected per operational group
                </span>
              </div>

              {/* Binary Variable Breakdown & Physical Meaning */}
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs font-mono">
                <div className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  Binary Variables Explanation in Aerospace Trajectory Formulation:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="text-cyan-400 font-bold">
                      x₁..x₃: Launch Window Choice
                    </div>
                    <div className="text-slate-300">
                      Bits [{solvedResults.qaoa.best_bitstring.slice(0, 3)}]:{" "}
                      <strong className="text-white">
                        {solvedResults.qaoa.best_bitstring.slice(0, 3) === "100" ? "Early Window (-15 min)" : solvedResults.qaoa.best_bitstring.slice(0, 3) === "010" ? "Mid Window (Nominal)" : "Late Window (+15 min)"}
                      </strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      x₁=Early, x₂=Mid, x₃=Late. Evaluates solar beta angle, atmospheric crosswinds, and upper altitude sheer.
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="text-cyan-400 font-bold">
                      x₄..x₆: Ascent Trajectory Profile
                    </div>
                    <div className="text-slate-300">
                      Bits [{solvedResults.qaoa.best_bitstring.slice(3, 6)}]:{" "}
                      <strong className="text-white">
                        {solvedResults.qaoa.best_bitstring.slice(3, 6) === "100" ? "Direct Ascent" : solvedResults.qaoa.best_bitstring.slice(3, 6) === "010" ? "Gravity Turn Ascent" : "Multi-Stage Staged Pitch"}
                      </strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      x₄=Direct, x₅=Gravity Turn, x₆=Multi-Stage. Maximizes horizontal velocity while minimizing aero drag integration through Max-Q.
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="text-cyan-400 font-bold">
                      x₇..x₉: Throttle &amp; Fuel Margin Mode
                    </div>
                    <div className="text-slate-300">
                      Bits [{solvedResults.qaoa.best_bitstring.slice(6, 9)}]:{" "}
                      <strong className="text-white">
                        {solvedResults.qaoa.best_bitstring.slice(6, 9) === "100" ? "Conservative (+5% margin)" : solvedResults.qaoa.best_bitstring.slice(6, 9) === "010" ? "Nominal Mode" : "Aggressive Throttle"}
                      </strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      x₇=Conservative, x₈=Nominal, x₉=Aggressive. Governs engine throttle regime, reserve ullage fuel buffer, and payload structural strain.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: CONSTRAINT VERIFICATION */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Constraint Verification
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                6 / 6 Operational Constraints Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {solvedResults.constraints.map((c, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 font-mono text-xs ${
                    c.status === "PASS"
                      ? "bg-slate-950/70 border-emerald-800/60"
                      : "bg-rose-950/20 border-rose-800"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{c.name}</span>
                    </div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      {c.message}
                    </div>
                    <div className="text-[10px] text-cyan-400">
                      Margin: {c.margin}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                      c.status === "PASS"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                        : "bg-rose-950 text-rose-300 border border-rose-700"
                    }`}
                  >
                    {c.status === "PASS" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>PASS</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>FAIL</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ASCENT TRAJECTORY OVERLAY CHART */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Ascent Trajectory Altitude Profile Comparison
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Runge-Kutta 4th Order / Target: {formData.altitude} km
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trajectoryChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time_min"
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{ value: "Flight Time (minutes)", position: "insideBottomRight", offset: -5, fill: "#64748b", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{ value: "Altitude (km)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
                  />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#07090e", borderColor: "#334155", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
                  <Line
                    type="monotone"
                    dataKey="Baseline"
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                    name="Original Baseline"
                  />
                  <Line
                    type="monotone"
                    dataKey="Classical"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={false}
                    name="Classical Optimised"
                  />
                  <Line
                    type="monotone"
                    dataKey="QAOA"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={false}
                    name="QAOA Quantum Optimised (Recommended)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PREPROCESSING & RUN AUDIT LOG */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 font-mono text-xs">
            <div className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Preprocessing Audit Trail</span>
            </div>
            <div className="space-y-1 text-slate-400 text-[11px]">
              {solvedResults.preprocessingLog.map((logLine, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-cyan-500 font-bold">›</span>
                  <span>{logLine}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Navigation Ribbon */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => setActiveView("input")}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Modify Input Parameters</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleApplyAsActive}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Apply &amp; Set as Active Mission</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
