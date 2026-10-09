import React, { useState, useMemo, useEffect } from "react";
import { Mission } from "../types";
import {
  TPSMaterial,
  TPS_MATERIALS,
  REENTRY_PRESETS,
  ReentryPreset,
  ReentryConfig,
  ReentryDataPoint,
  runReentrySimulation,
} from "../lib/reentrySimulation";
import {
  Flame,
  Shield,
  Gauge,
  Thermometer,
  Wind,
  Layers,
  Sliders,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Info,
  Radio,
  Clock,
  Weight,
  Compass,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Activity,
  Play,
  Pause,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";

interface AtmosphericReentryViewProps {
  mission: Mission;
  onProceedToAscent?: () => void;
  onProceedToPlan?: () => void;
}

export const AtmosphericReentryView: React.FC<AtmosphericReentryViewProps> = ({
  mission,
  onProceedToAscent,
  onProceedToPlan,
}) => {
  // Active Preset or Custom
  const [selectedPresetId, setSelectedPresetId] = useState<string>("crew_dragon_leo");
  const defaultPreset = REENTRY_PRESETS[0];

  // Configurable Flight Dynamics & Vehicle Inputs
  const [entryVelocityKmS, setEntryVelocityKmS] = useState<number>(defaultPreset.entryVelocityKmS);
  const [entryFlightPathAngleDeg, setEntryFlightPathAngleDeg] = useState<number>(defaultPreset.entryFlightPathAngleDeg);
  const [entryAltitudeKm, setEntryAltitudeKm] = useState<number>(defaultPreset.entryAltitudeKm);
  const [vehicleMassKg, setVehicleMassKg] = useState<number>(defaultPreset.vehicleMassKg);
  const [noseRadiusM, setNoseRadiusM] = useState<number>(defaultPreset.noseRadiusM);
  const [baseDiameterM, setBaseDiameterM] = useState<number>(defaultPreset.baseDiameterM);
  const [dragCoefficientCd, setDragCoefficientCd] = useState<number>(defaultPreset.dragCoefficientCd);
  const [liftToDragRatio, setLiftToDragRatio] = useState<number>(defaultPreset.liftToDragRatio);
  const [tpsThicknessMm, setTpsThicknessMm] = useState<number>(defaultPreset.tpsThicknessMm);
  const [materialId, setMaterialId] = useState<string>(defaultPreset.materialId);

  // Active chart tab
  const [chartTab, setChartTab] = useState<"heatFlux" | "deceleration" | "temperature" | "trajectory" | "dynamicPressure">("heatFlux");

  // Interactive time playback scrubber
  const [playbackIdx, setPlaybackIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showFormulaDrawer, setShowFormulaDrawer] = useState<boolean>(false);

  // Apply Preset Helper
  const applyPreset = (preset: ReentryPreset) => {
    setSelectedPresetId(preset.id);
    setEntryVelocityKmS(preset.entryVelocityKmS);
    setEntryFlightPathAngleDeg(preset.entryFlightPathAngleDeg);
    setEntryAltitudeKm(preset.entryAltitudeKm);
    setVehicleMassKg(preset.vehicleMassKg);
    setNoseRadiusM(preset.noseRadiusM);
    setBaseDiameterM(preset.baseDiameterM);
    setDragCoefficientCd(preset.dragCoefficientCd);
    setLiftToDragRatio(preset.liftToDragRatio);
    setTpsThicknessMm(preset.tpsThicknessMm);
    setMaterialId(preset.materialId);
    setPlaybackIdx(0);
  };

  // Run simulation whenever configuration parameters change
  const { trajectory, summary } = useMemo(() => {
    const config: ReentryConfig = {
      entryVelocityKmS,
      entryFlightPathAngleDeg,
      entryAltitudeKm,
      vehicleMassKg,
      noseRadiusM,
      baseDiameterM,
      dragCoefficientCd,
      liftToDragRatio,
      tpsThicknessMm,
      materialId,
    };
    return runReentrySimulation(config);
  }, [
    entryVelocityKmS,
    entryFlightPathAngleDeg,
    entryAltitudeKm,
    vehicleMassKg,
    noseRadiusM,
    baseDiameterM,
    dragCoefficientCd,
    liftToDragRatio,
    tpsThicknessMm,
    materialId,
  ]);

  // Current scrubbed telemetry slice
  const currentPoint: ReentryDataPoint = useMemo(() => {
    if (!trajectory || trajectory.length === 0) {
      return {
        timeS: 0,
        altitudeKm: 120,
        velocityKmS: 7.8,
        machNumber: 25,
        decelerationG: 0,
        downrangeKm: 0,
        dynamicPressureKPa: 0,
        convectiveHeatFluxW_cm2: 0,
        radiativeHeatFluxW_cm2: 0,
        totalHeatFluxW_cm2: 0,
        cumulativeHeatLoadKJ_cm2: 0,
        surfaceTemperatureC: 20,
        bondlineTemperatureC: 20,
        ablationRecessionMm: 0,
        airDensityKgM3: 0,
        isBlackout: false,
      };
    }
    const idx = Math.min(Math.max(playbackIdx, 0), trajectory.length - 1);
    return trajectory[idx];
  }, [trajectory, playbackIdx]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackIdx((prev) => {
        if (prev >= trajectory.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying, trajectory.length]);

  // Current selected material
  const selectedMaterial = useMemo(() => {
    return TPS_MATERIALS.find((m) => m.id === materialId) || TPS_MATERIALS[0];
  }, [materialId]);

  // Comparative data for all TPS materials with current flight trajectory
  const materialsComparison = useMemo(() => {
    return TPS_MATERIALS.map((mat) => {
      const cfg: ReentryConfig = {
        entryVelocityKmS,
        entryFlightPathAngleDeg,
        entryAltitudeKm,
        vehicleMassKg,
        noseRadiusM,
        baseDiameterM,
        dragCoefficientCd,
        liftToDragRatio,
        tpsThicknessMm,
        materialId: mat.id,
      };
      const res = runReentrySimulation(cfg);
      return {
        material: mat,
        peakSurfaceTempC: res.summary.peakSurfaceTempC,
        tempMarginPct: res.summary.safetyMarginPct,
        peakBondlineTempC: res.summary.peakBondlineTempC,
        totalAblationMm: res.summary.totalAblationMm,
        shieldMassKg: res.summary.heatShieldMassKg,
        bondlineStatus: res.summary.bondlineSafetyStatus,
      };
    });
  }, [
    entryVelocityKmS,
    entryFlightPathAngleDeg,
    entryAltitudeKm,
    vehicleMassKg,
    noseRadiusM,
    baseDiameterM,
    dragCoefficientCd,
    liftToDragRatio,
    tpsThicknessMm,
  ]);

  // Download CSV Telemetry
  const exportTelemetryCSV = () => {
    const headers = [
      "Time_s",
      "Altitude_km",
      "Velocity_km_s",
      "Mach_Number",
      "Deceleration_G",
      "Downrange_km",
      "Dynamic_Pressure_kPa",
      "Convective_Heat_Flux_W_cm2",
      "Radiative_Heat_Flux_W_cm2",
      "Total_Heat_Flux_W_cm2",
      "Cumulative_Heat_Load_kJ_cm2",
      "Surface_Temp_C",
      "Bondline_Temp_C",
      "Ablation_Recession_mm",
      "Plasma_Blackout",
    ];

    const rows = trajectory.map((p) => [
      p.timeS,
      p.altitudeKm,
      p.velocityKmS,
      p.machNumber,
      p.decelerationG,
      p.downrangeKm,
      p.dynamicPressureKPa,
      p.convectiveHeatFluxW_cm2,
      p.radiativeHeatFluxW_cm2,
      p.totalHeatFluxW_cm2,
      p.cumulativeHeatLoadKJ_cm2,
      p.surfaceTemperatureC,
      p.bondlineTemperatureC,
      p.ablationRecessionMm,
      p.isBlackout ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Atmospheric_Reentry_Telemetry_${selectedMaterial.shortName}_${entryVelocityKmS}kms.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans animate-in fade-in duration-200">
      {/* =========================================================================
          HERO & HEADER BANNER
          ========================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-xl relative overflow-hidden">
        {/* Hypersonic Plasma Glow Aura */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />
        <div className="absolute right-32 top-8 w-48 h-48 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 rounded-lg bg-orange-950/80 border border-orange-500/50 text-orange-400 shadow-md">
                <Flame className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Atmospheric Re-entry & Aerothermal Analysis
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-orange-950 border border-orange-800 text-orange-300">
                    Sutton-Graves Formulation
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 border border-cyan-800 text-cyan-300">
                    Terminal Descent Dynamics
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Simulate hypersonic stagnation heat flux, thermal soak, ablation recession, and deceleration G-loads across custom TPS materials
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons & Presets Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg p-1 text-xs font-mono">
              <span className="text-slate-400 px-2 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Presets:</span>
              </span>
              {REENTRY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-[11px] font-semibold ${
                    selectedPresetId === p.id
                      ? "bg-orange-500 text-slate-950 shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                  title={p.description}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>

            <button
              onClick={exportTelemetryCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono transition-colors cursor-pointer shadow-sm"
              title="Download 1Hz Reentry Trajectory Telemetry as CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          KEY AEROTHERMAL PERFORMANCE INDICATORS (8 KPIs)
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono">
        {/* Peak Heat Flux */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-orange-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Peak Heat Flux</span>
            <Flame className="w-3 h-3 text-orange-400" />
          </div>
          <div className="text-lg font-bold text-orange-400 mt-1 tabular-nums">
            {summary.peakHeatFluxW_cm2}
            <span className="text-[10px] font-normal text-slate-400 ml-1">W/cm²</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">@ T+{summary.timeOfPeakHeatFluxS}s</div>
        </div>

        {/* Peak Deceleration */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-red-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Peak Decel</span>
            <Gauge className="w-3 h-3 text-rose-400" />
          </div>
          <div className={`text-lg font-bold mt-1 tabular-nums ${
            summary.peakDecelerationG > 10 ? "text-rose-400" : summary.peakDecelerationG > 6 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {summary.peakDecelerationG}
            <span className="text-[10px] font-normal text-slate-400 ml-1">G</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">@ T+{summary.timeOfPeakDecelS}s</div>
        </div>

        {/* Peak Surface Skin Temp */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Peak Skin Temp</span>
            <Thermometer className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 mt-1 tabular-nums">
            {summary.peakSurfaceTempC.toLocaleString()}
            <span className="text-[10px] font-normal text-slate-400 ml-1">°C</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Limit: {selectedMaterial.maxServiceTempC}°C
          </div>
        </div>

        {/* Substructure Bondline Temp */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Bondline Temp</span>
            <Shield className="w-3 h-3 text-cyan-400" />
          </div>
          <div className={`text-lg font-bold mt-1 tabular-nums ${
            summary.bondlineSafetyStatus === "NOMINAL"
              ? "text-cyan-400"
              : summary.bondlineSafetyStatus === "WARNING"
              ? "text-amber-400"
              : "text-rose-400"
          }`}>
            {summary.peakBondlineTempC}
            <span className="text-[10px] font-normal text-slate-400 ml-1">°C</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Max limit: 250°C</div>
        </div>

        {/* Cumulative Heat Load */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Heat Load</span>
            <Activity className="w-3 h-3 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-300 mt-1 tabular-nums">
            {summary.totalHeatLoadKJ_cm2}
            <span className="text-[10px] font-normal text-slate-400 ml-1">kJ/cm²</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total absorbed</div>
        </div>

        {/* Ablation Recession */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Ablation Depth</span>
            <Layers className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-1 tabular-nums">
            {summary.totalAblationMm}
            <span className="text-[10px] font-normal text-slate-400 ml-1">mm</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Of {tpsThicknessMm}mm TPS</div>
        </div>

        {/* Radio Blackout Duration */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-sky-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>RF Blackout</span>
            <Radio className="w-3 h-3 text-sky-400" />
          </div>
          <div className="text-lg font-bold text-sky-300 mt-1 tabular-nums">
            {summary.blackoutDurationS}
            <span className="text-[10px] font-normal text-slate-400 ml-1">sec</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Plasma sheath</div>
        </div>

        {/* Heat Shield Mass */}
        <div className="rounded-xl p-3 border border-slate-800 bg-slate-900/80 relative overflow-hidden group hover:border-yellow-500/40 transition-colors">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>TPS Shield Mass</span>
            <Weight className="w-3 h-3 text-yellow-400" />
          </div>
          <div className="text-lg font-bold text-yellow-400 mt-1 tabular-nums">
            {summary.heatShieldMassKg.toLocaleString()}
            <span className="text-[10px] font-normal text-slate-400 ml-1">kg</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">β: {summary.ballisticCoefficientKgM2} kg/m²</div>
        </div>
      </div>

      {/* =========================================================================
          HEAT SHIELD MATERIAL PROPERTIES SELECTION CARDS
          ========================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Thermal Protection System (TPS) Material Selection
            </h2>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Active: <span className="text-cyan-300 font-semibold">{selectedMaterial.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TPS_MATERIALS.map((mat) => {
            const isSelected = mat.id === materialId;
            return (
              <div
                key={mat.id}
                onClick={() => setMaterialId(mat.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative font-mono flex flex-col justify-between ${
                  isSelected
                    ? "bg-slate-900/90 border-cyan-400 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-950/50"
                    : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: mat.color }}
                      />
                      <span className="text-xs font-bold text-white">{mat.shortName}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      mat.type === "ablative"
                        ? "bg-orange-950/70 text-orange-300 border-orange-800"
                        : mat.type === "reusable_tile"
                        ? "bg-blue-950/70 text-blue-300 border-blue-800"
                        : mat.type === "carbon_composite"
                        ? "bg-yellow-950/70 text-yellow-300 border-yellow-800"
                        : "bg-pink-950/70 text-pink-300 border-pink-800"
                    }`}>
                      {mat.reusability}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans line-clamp-2 mb-3">
                    {mat.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80 text-[10px]">
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/60">
                    <span className="text-slate-500 block text-[9px]">Density</span>
                    <span className="text-slate-200 font-bold">{mat.densityKgM3} kg/m³</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/60">
                    <span className="text-slate-500 block text-[9px]">Max Temp</span>
                    <span className="text-amber-300 font-bold">{mat.maxServiceTempC}°C</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/60">
                    <span className="text-slate-500 block text-[9px]">Conductivity</span>
                    <span className="text-cyan-300 font-bold">{mat.thermalConductivityW_mK} W/mK</span>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 mt-2 truncate">
                  Heritage: {mat.heritageVehicles}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE DESCENT CONTROLS & PHYSICAL FLIGHT PARAMETERS
          ========================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Terminal Descent & Trajectory Control Knobs
            </h2>
          </div>
          <button
            onClick={() => applyPreset(defaultPreset)}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            <span>Reset to LEO Default</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          {/* Entry Velocity Slider */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Entry Velocity (v_E)</span>
              <span className="font-bold text-orange-400">{entryVelocityKmS} km/s</span>
            </div>
            <input
              type="range"
              min="3.5"
              max="13.0"
              step="0.1"
              value={entryVelocityKmS}
              onChange={(e) => setEntryVelocityKmS(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>3.5 (Suborbital)</span>
              <span>7.8 (LEO)</span>
              <span>11.2 (Lunar)</span>
            </div>
          </div>

          {/* Flight Path Angle Slider */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Flight Path Angle (γ_E)</span>
              <span className="font-bold text-rose-400">{entryFlightPathAngleDeg}°</span>
            </div>
            <input
              type="range"
              min="-7.5"
              max="-1.0"
              step="0.05"
              value={entryFlightPathAngleDeg}
              onChange={(e) => setEntryFlightPathAngleDeg(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>-7.5° (Steep)</span>
              <span>-3.0° (Nominal)</span>
              <span>-1.0° (Skip)</span>
            </div>
          </div>

          {/* Vehicle Mass Slider */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Vehicle Mass (m)</span>
              <span className="font-bold text-cyan-400">{vehicleMassKg.toLocaleString()} kg</span>
            </div>
            <input
              type="range"
              min="500"
              max="85000"
              step="500"
              value={vehicleMassKg}
              onChange={(e) => setVehicleMassKg(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>500 kg</span>
              <span>7,800 kg (Dragon)</span>
              <span>85,000 kg</span>
            </div>
          </div>

          {/* TPS Layer Thickness Slider */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">TPS Thickness (L)</span>
              <span className="font-bold text-emerald-400">{tpsThicknessMm} mm</span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              step="1"
              value={tpsThicknessMm}
              onChange={(e) => setTpsThicknessMm(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>15 mm (Light)</span>
              <span>45 mm (Standard)</span>
              <span>90 mm (Heavy)</span>
            </div>
          </div>

          {/* Aerodynamic Parameters (Row 2) */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Nose Radius (R_n)</span>
              <span className="font-bold text-amber-400">{noseRadiusM} m</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="3.5"
              step="0.1"
              value={noseRadiusM}
              onChange={(e) => setNoseRadiusM(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.3 m (Sharp)</span>
              <span>1.8 m (Blunt)</span>
              <span>3.5 m</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Base Diameter (D)</span>
              <span className="font-bold text-indigo-400">{baseDiameterM} m</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="9.0"
              step="0.1"
              value={baseDiameterM}
              onChange={(e) => setBaseDiameterM(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.8 m</span>
              <span>4.0 m (Dragon)</span>
              <span>9.0 m (Starship)</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Lift-to-Drag (L/D)</span>
              <span className="font-bold text-purple-400">{liftToDragRatio}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.3"
              step="0.02"
              value={liftToDragRatio}
              onChange={(e) => setLiftToDragRatio(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.0 (Ballistic)</span>
              <span>0.3 (Apollo/Dragon)</span>
              <span>1.2 (Shuttle)</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Drag Coeff (C_D)</span>
              <span className="font-bold text-sky-400">{dragCoefficientCd}</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.8"
              step="0.05"
              value={dragCoefficientCd}
              onChange={(e) => setDragCoefficientCd(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.6 (Slender)</span>
              <span>1.3 (Blunt Capsule)</span>
              <span>1.8</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE REAL-TIME DESCENT SCRUBBER & PLASMA VISUALIZER
          ========================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Terminal Descent Playback & Ionization Plasma Telemetry
            </h3>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                isPlaying
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                  : "bg-slate-900 text-slate-300 border-slate-700 hover:text-white"
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? "Pause" : "Play Descent"}</span>
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setPlaybackIdx(0);
              }}
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Reset scrubber to Entry Interface (T=0)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visual Plasma Heating Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
          {/* Animated Re-entry Capsule Silhouette */}
          <div className="relative h-44 rounded-xl border border-slate-800 bg-[#030712] overflow-hidden flex items-center justify-center p-4">
            {/* Plasma shock wave glow aura */}
            <div
              className="absolute inset-0 transition-opacity duration-200 pointer-events-none"
              style={{
                background: currentPoint.surfaceTemperatureC > 1200
                  ? "radial-gradient(circle at 65% 50%, rgba(254, 240, 138, 0.35) 0%, rgba(249, 115, 22, 0.25) 40%, rgba(220, 38, 38, 0.15) 70%, transparent 100%)"
                  : currentPoint.surfaceTemperatureC > 400
                  ? "radial-gradient(circle at 65% 50%, rgba(249, 115, 22, 0.2) 0%, rgba(220, 38, 38, 0.1) 50%, transparent 100%)"
                  : "transparent",
              }}
            />

            {/* Shock wave bow curvature */}
            <div
              className="absolute w-24 h-36 border-r-4 rounded-r-full transition-all duration-150 pointer-events-none"
              style={{
                borderColor: currentPoint.surfaceTemperatureC > 1500
                  ? "#fef08a"
                  : currentPoint.surfaceTemperatureC > 800
                  ? "#fb923c"
                  : "rgba(56, 189, 248, 0.2)",
                filter: currentPoint.surfaceTemperatureC > 1000 ? "blur(1px) drop-shadow(0 0 12px #f97316)" : "none",
                transform: `translateX(${currentPoint.machNumber > 5 ? 12 : 24}px)`,
              }}
            />

            {/* Capsule Body */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className="w-16 h-20 rounded-t-2xl border-2 transition-colors duration-200 flex flex-col items-center justify-center shadow-2xl relative"
                style={{
                  backgroundColor: "#0f172a",
                  borderColor: currentPoint.surfaceTemperatureC > 1200
                    ? "#f97316"
                    : currentPoint.surfaceTemperatureC > 600
                    ? "#eab308"
                    : "#38bdf8",
                }}
              >
                {/* Heat Shield Base at the bottom facing oncoming airstream */}
                <div
                  className="w-18 h-3 rounded-b-md absolute -bottom-1.5 transition-colors duration-150"
                  style={{
                    backgroundColor: currentPoint.surfaceTemperatureC > 1400
                      ? "#fef08a"
                      : currentPoint.surfaceTemperatureC > 800
                      ? "#ea580c"
                      : selectedMaterial.color,
                    boxShadow: currentPoint.surfaceTemperatureC > 1000
                      ? "0 4px 20px rgba(249, 115, 22, 0.9)"
                      : "none",
                  }}
                />
                <span className="text-[9px] font-mono text-slate-300 font-bold">CAPSULE</span>
                <span className="text-[8px] font-mono text-cyan-400">M{currentPoint.machNumber}</span>
              </div>
            </div>

            {/* Plasma Status Overlay */}
            <div className="absolute bottom-2 inset-x-3 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">Ionized Shock Layer:</span>
              {currentPoint.isBlackout ? (
                <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse">
                  <Radio className="w-3 h-3" />
                  <span>COMM BLACKOUT</span>
                </span>
              ) : currentPoint.surfaceTemperatureC > 400 ? (
                <span className="text-orange-400 font-bold">HYPERSONIC HEATING</span>
              ) : (
                <span className="text-emerald-400 font-bold">TERMINAL SUBSONIC</span>
              )}
            </div>
          </div>

          {/* Instantaneous Telemetry Panel */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Current Altitude</span>
              <span className="text-base font-bold text-white tabular-nums">{currentPoint.altitudeKm} km</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Downrange: {currentPoint.downrangeKm} km</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Velocity / Mach</span>
              <span className="text-base font-bold text-cyan-400 tabular-nums">
                {currentPoint.velocityKmS} <span className="text-[10px] font-normal text-slate-400">km/s</span>
              </span>
              <span className="text-[9px] text-cyan-300 block mt-0.5">Mach {currentPoint.machNumber}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Instant Heat Flux</span>
              <span className="text-base font-bold text-orange-400 tabular-nums">
                {currentPoint.totalHeatFluxW_cm2} <span className="text-[10px] font-normal text-slate-400">W/cm²</span>
              </span>
              <span className="text-[9px] text-orange-300 block mt-0.5">
                Conv: {currentPoint.convectiveHeatFluxW_cm2} | Rad: {currentPoint.radiativeHeatFluxW_cm2}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">G-Force Deceleration</span>
              <span className={`text-base font-bold tabular-nums ${
                currentPoint.decelerationG > 8 ? "text-rose-400" : "text-emerald-400"
              }`}>
                {currentPoint.decelerationG} <span className="text-[10px] font-normal text-slate-400">G</span>
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                q_dyn: {currentPoint.dynamicPressureKPa} kPa
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Skin Surface Temp</span>
              <span className="text-base font-bold text-amber-300 tabular-nums">
                {currentPoint.surfaceTemperatureC}°C
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {(currentPoint.surfaceTemperatureC + 273.15)} K
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Substructure Bondline</span>
              <span className={`text-base font-bold tabular-nums ${
                currentPoint.bondlineTemperatureC > 180 ? "text-amber-400" : "text-cyan-400"
              }`}>
                {currentPoint.bondlineTemperatureC}°C
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Adhesive limit: 250°C</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Cumulative Heat Load</span>
              <span className="text-base font-bold text-purple-300 tabular-nums">
                {currentPoint.cumulativeHeatLoadKJ_cm2} <span className="text-[10px] font-normal text-slate-400">kJ/cm²</span>
              </span>
              <span className="text-[9px] text-purple-400 block mt-0.5">Integrated energy</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Ablation Recession</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                {currentPoint.ablationRecessionMm} <span className="text-[10px] font-normal text-slate-400">mm</span>
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                Remaining: {(tpsThicknessMm - currentPoint.ablationRecessionMm).toFixed(1)} mm
              </span>
            </div>
          </div>
        </div>

        {/* Time Scrubber Slider */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>Entry Interface (T=0s)</span>
            <span className="text-cyan-300 font-bold">
              Current Time: T+{currentPoint.timeS}s ({(currentPoint.timeS / 60).toFixed(1)} min)
            </span>
            <span>Terminal Descent (T+{summary.flightTimeS}s)</span>
          </div>
          <input
            type="range"
            min="0"
            max={trajectory.length - 1}
            value={playbackIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setPlaybackIdx(parseInt(e.target.value));
            }}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* =========================================================================
          DYNAMIC CHARTS & PROFILES SECTION
          ========================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 shadow-lg space-y-4">
        {/* Chart Segmented Control Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono">
            <button
              onClick={() => setChartTab("heatFlux")}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 font-semibold ${
                chartTab === "heatFlux"
                  ? "bg-orange-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Heat Flux Profile</span>
            </button>
            <button
              onClick={() => setChartTab("deceleration")}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 font-semibold ${
                chartTab === "deceleration"
                  ? "bg-rose-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Deceleration (G-Load)</span>
            </button>
            <button
              onClick={() => setChartTab("temperature")}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 font-semibold ${
                chartTab === "temperature"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" />
              <span>Thermal Soak & Bondline</span>
            </button>
            <button
              onClick={() => setChartTab("trajectory")}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 font-semibold ${
                chartTab === "trajectory"
                  ? "bg-cyan-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Altitude vs Downrange</span>
            </button>
            <button
              onClick={() => setChartTab("dynamicPressure")}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 font-semibold ${
                chartTab === "dynamicPressure"
                  ? "bg-sky-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span>Dynamic Pressure (q)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {chartTab === "heatFlux" && "Stagnation Convective & Radiative Shock Wave Flux (W/cm²)"}
            {chartTab === "deceleration" && "Vehicle Aerodynamic Drag Deceleration vs Human Tolerance Limit"}
            {chartTab === "temperature" && "Radiative Equilibrium Surface Temperature vs Substructure Bondline"}
            {chartTab === "trajectory" && "Descent Trajectory Corridor with RF Blackout Plasma Zone"}
            {chartTab === "dynamicPressure" && "Hypersonic Dynamic Pressure (kPa) & Max-Q Stagnation Peak"}
          </div>
        </div>

        {/* 1. Heat Flux Profile Chart */}
        {chartTab === "heatFlux" && (
          <div className="h-80 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectory} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeS" stroke="#64748b" tickFormatter={(v) => `${v}s`} />
                <YAxis
                  yAxisId="left"
                  stroke="#f97316"
                  label={{ value: "Heat Flux (W/cm²)", angle: -90, position: "insideLeft", fill: "#f97316" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#a855f7"
                  label={{ value: "Heat Load (kJ/cm²)", angle: 90, position: "insideRight", fill: "#a855f7" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "8px" }}
                  formatter={(val: any, name: any) => [`${val}`, name]}
                />
                <Legend />
                <ReferenceLine
                  yAxisId="left"
                  y={selectedMaterial.maxHeatFluxLimitW_cm2}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `Max ${selectedMaterial.shortName} Limit`, fill: "#ef4444", position: "top" }}
                />
                <ReferenceLine
                  yAxisId="left"
                  x={currentPoint.timeS}
                  stroke="#38bdf8"
                  strokeDasharray="2 2"
                  label={{ value: "Scrubber T", fill: "#38bdf8", position: "insideTopLeft" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalHeatFluxW_cm2"
                  name="Total Stagnation Flux (W/cm²)"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="convectiveHeatFluxW_cm2"
                  name="Convective Flux (W/cm²)"
                  stroke="#eab308"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="radiativeHeatFluxW_cm2"
                  name="Radiative Shock Flux (W/cm²)"
                  stroke="#ec4899"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulativeHeatLoadKJ_cm2"
                  name="Total Integrated Load (kJ/cm²)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. Deceleration Profile Chart */}
        {chartTab === "deceleration" && (
          <div className="h-80 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectory} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="decelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeS" stroke="#64748b" tickFormatter={(v) => `${v}s`} />
                <YAxis
                  yAxisId="left"
                  stroke="#f43f5e"
                  label={{ value: "Deceleration (G)", angle: -90, position: "insideLeft", fill: "#f43f5e" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8"
                  label={{ value: "Velocity (km/s)", angle: 90, position: "insideRight", fill: "#38bdf8" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "8px" }}
                />
                <Legend />
                {/* 10G Crew Tolerance Threshold */}
                <ReferenceLine
                  yAxisId="left"
                  y={10.0}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: "10G Sustained Human Limit", fill: "#ef4444", position: "insideTopRight" }}
                />
                <ReferenceLine
                  yAxisId="left"
                  x={currentPoint.timeS}
                  stroke="#38bdf8"
                  strokeDasharray="2 2"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="decelerationG"
                  name="Deceleration G-Force (G)"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#decelGrad)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="velocityKmS"
                  name="Velocity (km/s)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. Temperature & Bondline Soak Chart */}
        {chartTab === "temperature" && (
          <div className="h-80 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectory} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeS" stroke="#64748b" tickFormatter={(v) => `${v}s`} />
                <YAxis
                  stroke="#f59e0b"
                  label={{ value: "Temperature (°C)", angle: -90, position: "insideLeft", fill: "#f59e0b" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "8px" }}
                />
                <Legend />
                <ReferenceLine
                  y={selectedMaterial.maxServiceTempC}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `Max ${selectedMaterial.shortName} Limit (${selectedMaterial.maxServiceTempC}°C)`, fill: "#ef4444", position: "top" }}
                />
                <ReferenceLine
                  y={250}
                  stroke="#e11d48"
                  strokeDasharray="3 3"
                  label={{ value: "Adhesive Bondline Limit (250°C)", fill: "#e11d48", position: "insideBottomLeft" }}
                />
                <ReferenceLine
                  x={currentPoint.timeS}
                  stroke="#38bdf8"
                  strokeDasharray="2 2"
                />
                <Line
                  type="monotone"
                  dataKey="surfaceTemperatureC"
                  name="TPS Outer Surface Temp (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bondlineTemperatureC"
                  name="Substructure Bondline Temp (°C)"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. Altitude vs Downrange Trajectory Corridor */}
        {chartTab === "trajectory" && (
          <div className="h-80 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectory} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="downrangeKm" stroke="#64748b" label={{ value: "Downrange Distance (km)", position: "insideBottom", fill: "#64748b" }} />
                <YAxis
                  stroke="#38bdf8"
                  label={{ value: "Altitude (km)", angle: -90, position: "insideLeft", fill: "#38bdf8" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "8px" }}
                />
                <Legend />
                {/* Blackout Ionization Band */}
                <ReferenceLine
                  y={85}
                  stroke="#ec4899"
                  strokeDasharray="3 3"
                  label={{ value: "Upper Blackout Interface (85 km)", fill: "#ec4899", position: "top" }}
                />
                <ReferenceLine
                  y={38}
                  stroke="#ec4899"
                  strokeDasharray="3 3"
                  label={{ value: "Lower Blackout Interface (38 km)", fill: "#ec4899", position: "bottom" }}
                />
                <Line
                  type="monotone"
                  dataKey="altitudeKm"
                  name="Altitude Profile (km)"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 5. Dynamic Pressure (q) Chart */}
        {chartTab === "dynamicPressure" && (
          <div className="h-80 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectory} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeS" stroke="#64748b" tickFormatter={(v) => `${v}s`} />
                <YAxis
                  stroke="#0ea5e9"
                  label={{ value: "Dynamic Pressure (kPa)", angle: -90, position: "insideLeft", fill: "#0ea5e9" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "8px" }}
                />
                <Legend />
                <ReferenceLine
                  y={summary.peakDynamicPressureKPa}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{ value: `Max-Q Peak: ${summary.peakDynamicPressureKPa} kPa`, fill: "#f59e0b", position: "insideTopRight" }}
                />
                <Area
                  type="monotone"
                  dataKey="dynamicPressureKPa"
                  name="Dynamic Pressure q (kPa)"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#qGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* =========================================================================
          CROSS-MATERIAL PERFORMANCE MATRIX & TRADE STUDY TABLE
          ========================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 shadow-lg space-y-3 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              TPS Material Trade Study & Comparison Matrix
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Current Trajectory Evaluated Across All 6 TPS Materials
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Material</th>
                <th className="px-3 py-2.5">Classification</th>
                <th className="px-3 py-2.5">Peak Temp (°C)</th>
                <th className="px-3 py-2.5">Temp Margin</th>
                <th className="px-3 py-2.5">Bondline Temp</th>
                <th className="px-3 py-2.5">Recession</th>
                <th className="px-3 py-2.5">Shield Mass</th>
                <th className="px-3 py-2.5">Heritage / Suitability</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {materialsComparison.map((row) => {
                const isCurrent = row.material.id === materialId;
                const isOverheated = row.peakSurfaceTempC > row.material.maxServiceTempC;
                return (
                  <tr
                    key={row.material.id}
                    className={`transition-colors ${
                      isCurrent
                        ? "bg-cyan-950/20 font-semibold"
                        : "hover:bg-slate-900/40"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.material.color }}
                        />
                        <span className="text-white font-bold">{row.material.name}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{row.material.reusability}</td>
                    <td className={`px-3 py-3 tabular-nums ${isOverheated ? "text-rose-400 font-bold" : "text-amber-300"}`}>
                      {row.peakSurfaceTempC}°C
                      <span className="text-[10px] text-slate-500 block">Limit: {row.material.maxServiceTempC}°C</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        row.tempMarginPct > 20
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                          : row.tempMarginPct > 0
                          ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                          : "bg-rose-950/80 text-rose-300 border border-rose-800"
                      }`}>
                        {row.tempMarginPct > 0 ? `+${row.tempMarginPct}%` : `${row.tempMarginPct}% (FAIL)`}
                      </span>
                    </td>
                    <td className={`px-3 py-3 tabular-nums ${
                      row.peakBondlineTempC > 180 ? "text-amber-400 font-bold" : "text-cyan-400"
                    }`}>
                      {row.peakBondlineTempC}°C
                    </td>
                    <td className="px-3 py-3 text-emerald-300 tabular-nums">
                      {row.totalAblationMm > 0 ? `${row.totalAblationMm} mm` : "0 mm (Non-Ablative)"}
                    </td>
                    <td className="px-3 py-3 text-yellow-300 tabular-nums font-bold">
                      {row.shieldMassKg.toLocaleString()} kg
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-[11px]">
                      {row.material.heritageVehicles.split(",")[0]}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => setMaterialId(row.material.id)}
                        disabled={isCurrent}
                        className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                          isCurrent
                            ? "bg-slate-800 text-slate-500 cursor-default"
                            : "bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800 hover:border-cyan-600"
                        }`}
                      >
                        {isCurrent ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          THEORETICAL EQUATIONS & AEROTHERMAL DRAWER
          ========================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden font-mono">
        <button
          onClick={() => setShowFormulaDrawer(!showFormulaDrawer)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Mathematical Formulations & Sutton-Graves Stagnation Mechanics
            </span>
          </div>
          {showFormulaDrawer ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showFormulaDrawer && (
          <div className="p-5 border-t border-slate-800 bg-slate-900/30 text-xs text-slate-300 space-y-4 font-sans leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px]">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-orange-400 font-bold block">1. Sutton-Graves Convective Heat Flux</span>
                <p className="text-slate-400 font-mono text-xs">
                  q_conv = K_sg · √(ρ / R_n) · v³
                </p>
                <p className="text-slate-500 text-[10px]">
                  K_sg = 1.7415×10⁻⁴ kg^0.5/m. Dependent on the square-root of air density ρ and cubic hypersonic flight velocity v³.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-pink-400 font-bold block">2. Shock Layer Radiative Heating</span>
                <p className="text-slate-400 font-mono text-xs">
                  q_rad = C_rad · R_n^0.5 · ρ^1.22 · (v / 10,000)^8.5
                </p>
                <p className="text-slate-500 text-[10px]">
                  Accounts for non-equilibrium shock dissociation and high-temperature ionization at velocities v &gt; 7.5 km/s.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-amber-400 font-bold block">3. Stefan-Boltzmann Radiative Equilibrium</span>
                <p className="text-slate-400 font-mono text-xs">
                  T_surf = [ q_total / (ε · σ) ]^(1/4)
                </p>
                <p className="text-slate-500 text-[10px]">
                  σ = 5.67037×10⁻⁸ W/(m²K⁴). Equates incident stagnation heat flux with re-radiated blackbody surface radiation.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-cyan-400 font-bold block">4. 1D Fourier Substructure Thermal Soak</span>
                <p className="text-slate-400 font-mono text-xs">
                  τ_diff = L² / (π² · α_thermal), where α = k / (ρ · c_p)
                </p>
                <p className="text-slate-500 text-[10px]">
                  Determines the thermal delay and heat conducted through TPS thickness L to the titanium/composite airframe bondline.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        {onProceedToAscent && (
          <button
            onClick={onProceedToAscent}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            ← Back to Ascent Trajectory
          </button>
        )}
        {onProceedToPlan && (
          <button
            onClick={onProceedToPlan}
            className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-colors cursor-pointer shadow-md ml-auto"
          >
            Proceed to Final Mission Plan →
          </button>
        )}
      </div>
    </div>
  );
};
