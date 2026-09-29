import React, { useState, useMemo } from "react";
import { Mission } from "../types";
import {
  SeasonalProfileId,
  getActiveSeasonalProfile,
} from "../lib/atmosphere";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Wind,
  Compass,
  Sliders,
  Thermometer,
  CloudRain,
  Eye,
  Crosshair,
  Zap,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface StabilityMapProps {
  mission: Mission;
  activeAngleDeviation: number;
  onSelectAngleDeviation?: (deg: number) => void;
  seasonalProfileId?: SeasonalProfileId;
}

export type StabilityRegion = "safe" | "caution" | "critical";

interface StabilityCell {
  angleDeg: number;
  windSpeedMs?: number;
  fuelPct?: number;
  safetyScore: number; // 0 - 100
  region: StabilityRegion;
  reasons: string[];
  maxQkPa: number;
  tvcGimbalDeg: number;
  isCurrentOperatingPoint: boolean;
}

const ANGLE_POINTS = [-5.0, -3.5, -2.0, -1.0, 0.0, 1.0, 2.0, 3.5, 5.0];
const WIND_POINTS = [24, 20, 16, 12, 8, 4, 0]; // m/s from high to calm
const FUEL_POINTS = [15, 10, 5, 0, -5, -10, -15]; // % from excess to deficit

export const StabilityMap: React.FC<StabilityMapProps> = ({
  mission,
  activeAngleDeviation,
  onSelectAngleDeviation,
  seasonalProfileId = "auto",
}) => {
  const [mapMode, setMapMode] = useState<"angle_wind" | "angle_fuel">("angle_wind");
  const [filterRegion, setFilterRegion] = useState<"all" | "safe" | "caution" | "critical">("all");
  const [weatherStressMode, setWeatherStressMode] = useState<"nominal" | "gust" | "storm">("nominal");
  const [hoveredCell, setHoveredCell] = useState<StabilityCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<StabilityCell | null>(null);

  const activeProfile = useMemo(() => {
    return getActiveSeasonalProfile(seasonalProfileId, mission);
  }, [seasonalProfileId, mission]);

  // Derived environmental stress factors based on current profile and stress test mode
  const effectiveWind = useMemo(() => {
    const base = mission.wind_speed || 6.5;
    if (weatherStressMode === "gust") return base + 6.0;
    if (weatherStressMode === "storm") return base + 11.0;
    return base;
  }, [mission.wind_speed, weatherStressMode]);

  const effectiveRain = useMemo(() => {
    const base = mission.rain || 0.0;
    if (weatherStressMode === "storm") return base + 8.5;
    if (seasonalProfileId === "monsoon") return base + 4.0;
    if (seasonalProfileId === "cyclone") return base + 10.0;
    return base;
  }, [mission.rain, weatherStressMode, seasonalProfileId]);

  // Compute stability grid
  const { grid, safeCount, cautionCount, criticalCount, currentOpCell } = useMemo(() => {
    const rows: StabilityCell[][] = [];
    let safeC = 0;
    let cautionC = 0;
    let criticalC = 0;
    let currentCell: StabilityCell | null = null;

    const yPoints = mapMode === "angle_wind" ? WIND_POINTS : FUEL_POINTS;

    yPoints.forEach((yVal) => {
      const row: StabilityCell[] = [];

      ANGLE_POINTS.forEach((angle) => {
        let safetyScore = 100;
        const reasons: string[] = [];

        const windSpeed = mapMode === "angle_wind" ? yVal : effectiveWind;
        const fuelPct = mapMode === "angle_fuel" ? yVal : 0;

        // 1. Aerodynamic Dynamic Pressure (Max-Q) stress calculation
        // Base nominal max-Q is ~68 kPa. Steeper angles in cold/dense air elevate dynamic pressure.
        const densityFactor = activeProfile.surfaceDensityKgM3 / 1.225;
        const anglePitchLoad = angle * 2.8; // steep ascent increases ram air resistance
        const estimatedMaxQ = Math.max(
          45.0,
          Math.min(96.0, 68.0 * densityFactor + anglePitchLoad + (windSpeed * 0.45))
        );

        if (estimatedMaxQ > 82.0) {
          safetyScore -= (estimatedMaxQ - 82.0) * 3.5;
          reasons.push(`High Max-Q Dynamic Pressure (${estimatedMaxQ.toFixed(1)} kPa exceeds 82 kPa limit)`);
        } else if (estimatedMaxQ > 76.0) {
          safetyScore -= 8;
          reasons.push(`Elevated Aerodynamic Load (${estimatedMaxQ.toFixed(1)} kPa)`);
        }

        // 2. Thrust Vector Control (TVC) Gimbal Slew Requirement
        // Crosswinds exert aerodynamic side moments requiring corrective engine deflection
        const crosswindShearDeg = (windSpeed / 20.0) * 3.2;
        const angleGimbalReq = Math.abs(angle) * 0.55;
        const totalGimbalDeg = Number((crosswindShearDeg + angleGimbalReq).toFixed(1));

        if (totalGimbalDeg > 4.5) {
          safetyScore -= 38;
          reasons.push(`TVC Gimbal Saturation Risk (${totalGimbalDeg}° required exceeds 4.5° limit)`);
        } else if (totalGimbalDeg > 3.2) {
          safetyScore -= 18;
          reasons.push(`Reduced TVC Steering Authority Margin (${totalGimbalDeg}° gimbal)`);
        }

        // 3. Environmental Weather Violations (Launch Commit Criteria / LCC)
        if (windSpeed >= 18.0) {
          safetyScore -= 45;
          reasons.push(`Surface Wind Exceeds Range Safety Max limit (18.0 m/s SDSC threshold)`);
        } else if (windSpeed >= 13.0) {
          safetyScore -= 16;
          reasons.push(`High Crosswind Velocity (${windSpeed} m/s)`);
        }

        if (effectiveRain > 8.0) {
          safetyScore -= 28;
          reasons.push(`Heavy Precipitation (${effectiveRain.toFixed(1)} mm) - Fairing erosion risk`);
        }

        // 4. Propellant starvation / trajectory dispersion
        if (fuelPct < -8) {
          safetyScore -= 35;
          reasons.push(`Propellant Deficit (${fuelPct}%) - Pre-insertion engine cutoff`);
        } else if (fuelPct < -3) {
          safetyScore -= 14;
          reasons.push(`Tight Propellant Margin (${fuelPct}%)`);
        }

        if (angle <= -4.0 && windSpeed > 10) {
          safetyScore -= 22;
          reasons.push("Shallow Re-entry / Atmospheric Trajectory Skimming");
        }

        safetyScore = Math.max(5, Math.min(99, Math.round(safetyScore)));

        let region: StabilityRegion = "safe";
        if (safetyScore < 58) {
          region = "critical";
          criticalC++;
        } else if (safetyScore < 78) {
          region = "caution";
          cautionC++;
        } else {
          region = "safe";
          safeC++;
        }

        // Is this the current active simulation operating point?
        const isCurrentAngle = Math.abs(angle - activeAngleDeviation) <= 0.8;
        const isCurrentY =
          mapMode === "angle_wind"
            ? Math.abs(yVal - effectiveWind) <= 2.5
            : Math.abs(yVal - 0) <= 2.5;

        const isCurrentOperatingPoint = isCurrentAngle && isCurrentY;

        const cell: StabilityCell = {
          angleDeg: angle,
          windSpeedMs: mapMode === "angle_wind" ? yVal : undefined,
          fuelPct: mapMode === "angle_fuel" ? yVal : undefined,
          safetyScore,
          region,
          reasons,
          maxQkPa: Number(estimatedMaxQ.toFixed(1)),
          tvcGimbalDeg: totalGimbalDeg,
          isCurrentOperatingPoint,
        };

        row.push(cell);

        if (isCurrentOperatingPoint && !currentCell) {
          currentCell = cell;
        }
      });

      rows.push(row);
    });

    return {
      grid: rows,
      safeCount: safeC,
      cautionCount: cautionC,
      criticalCount: criticalC,
      currentOpCell: currentCell || rows[3][4],
    };
  }, [mapMode, effectiveWind, effectiveRain, activeProfile, activeAngleDeviation]);

  const activeInspector = hoveredCell || selectedCell || currentOpCell;

  // Determine cell color
  const getCellClasses = (cell: StabilityCell) => {
    const isMuted = filterRegion !== "all" && cell.region !== filterRegion;
    if (isMuted) {
      return "opacity-20 bg-slate-900 border-slate-800 text-slate-600";
    }

    if (cell.region === "safe") {
      return "bg-emerald-500/90 text-slate-950 font-bold hover:brightness-110 shadow-sm shadow-emerald-500/10";
    }
    if (cell.region === "caution") {
      return "bg-amber-500/90 text-slate-950 font-semibold hover:brightness-110 shadow-sm shadow-amber-500/10";
    }
    return "bg-rose-600/90 text-white font-bold hover:brightness-110 shadow-sm shadow-rose-500/10";
  };

  return (
    <div className="p-5 rounded-xl bg-slate-900/85 border border-slate-800 space-y-4 shadow-2xl">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Launch Parameter Stability Map</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-800/80 bg-emerald-950/70 text-emerald-300">
                LCC Range Safety Envelope
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans">
              Color-coded parameter boundary identifying Safe (Go), Caution (Marginal), and Critical (No-Go) regions based on weather profiles
            </div>
          </div>
        </div>

        {/* View Projection Mode Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setMapMode("angle_wind")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                mapMode === "angle_wind"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Angle vs. Wind Speed
            </button>
            <button
              onClick={() => setMapMode("angle_fuel")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                mapMode === "angle_fuel"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Angle vs. Propellant
            </button>
          </div>
        </div>
      </div>

      {/* Weather Stress Conditions Strip & Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs font-mono">
        {/* Active Weather Parameter Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-slate-400 font-sans">Active Weather Profile:</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
            <Wind className="w-3 h-3 text-cyan-400" />
            <span>Wind: {effectiveWind.toFixed(1)} m/s</span>
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
            <Thermometer className="w-3 h-3 text-amber-400" />
            <span>Temp: {activeProfile.surfaceTempC}°C</span>
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-blue-300">
            <CloudRain className="w-3 h-3 text-blue-400" />
            <span>Precipitation: {effectiveRain.toFixed(1)} mm</span>
          </span>
          <span className="text-[10px] text-slate-500 font-sans">
            (Air Density: {activeProfile.surfaceDensityKgM3} kg/m³)
          </span>
        </div>

        {/* Weather Stress Injector */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-400">Stress Test:</span>
          {[
            { id: "nominal", label: "Nominal" },
            { id: "gust", label: "+6 m/s Gust" },
            { id: "storm", label: "Rain Storm" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setWeatherStressMode(s.id as any)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                weatherStressMode === s.id
                  ? "bg-amber-950 text-amber-300 border-amber-700/80 font-bold"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid & Scenario Telemetry Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Stability Grid Table (8 Columns on LG) */}
        <div className="lg:col-span-8 overflow-x-auto space-y-2">
          <div className="flex items-center justify-between text-xs font-mono px-1">
            <span className="text-cyan-400 font-semibold">
              X-Axis: Launch Angle Deviation (Δγ in Degrees)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">Filter:</span>
              {(["all", "safe", "caution", "critical"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRegion(r)}
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-colors cursor-pointer border ${
                    filterRegion === r
                      ? r === "safe"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-700 font-bold"
                        : r === "caution"
                        ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                        : r === "critical"
                        ? "bg-rose-950 text-rose-300 border-rose-700 font-bold"
                        : "bg-cyan-950 text-cyan-300 border-cyan-700 font-bold"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="inline-block min-w-full bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
            <table className="w-full border-collapse text-xs font-mono">
              <thead>
                <tr>
                  <th className="p-1.5 text-[10px] text-slate-500 text-left font-normal border-b border-slate-800">
                    {mapMode === "angle_wind" ? "Wind \\ Angle" : "Fuel \\ Angle"}
                  </th>
                  {ANGLE_POINTS.map((deg) => (
                    <th
                      key={deg}
                      className={`p-1.5 text-center font-mono text-[11px] border-b border-slate-800 ${
                        deg === 0 ? "text-cyan-400 font-bold" : "text-slate-400"
                      }`}
                    >
                      {deg > 0 ? `+${deg}°` : `${deg}°`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, rIdx) => {
                  const yVal = mapMode === "angle_wind" ? WIND_POINTS[rIdx] : FUEL_POINTS[rIdx];
                  return (
                    <tr key={yVal}>
                      {/* Y-Axis Label */}
                      <td className="p-1.5 text-[11px] text-slate-400 whitespace-nowrap font-mono border-r border-slate-800">
                        {mapMode === "angle_wind" ? (
                          <span className={yVal <= 12 ? "text-emerald-400" : yVal <= 16 ? "text-amber-400" : "text-rose-400 font-bold"}>
                            {yVal} m/s
                          </span>
                        ) : (
                          <span className={yVal === 0 ? "text-cyan-400 font-bold" : ""}>
                            {yVal > 0 ? `+${yVal}%` : `${yVal}%`}
                          </span>
                        )}
                      </td>

                      {/* Stability Cells */}
                      {row.map((cell) => {
                        const isHovered =
                          hoveredCell &&
                          cell.angleDeg === hoveredCell.angleDeg &&
                          ((mapMode === "angle_wind" && cell.windSpeedMs === hoveredCell.windSpeedMs) ||
                            (mapMode === "angle_fuel" && cell.fuelPct === hoveredCell.fuelPct));
                        const isSelected =
                          selectedCell &&
                          cell.angleDeg === selectedCell.angleDeg &&
                          ((mapMode === "angle_wind" && cell.windSpeedMs === selectedCell.windSpeedMs) ||
                            (mapMode === "angle_fuel" && cell.fuelPct === selectedCell.fuelPct));

                        return (
                          <td
                            key={`${cell.angleDeg}_${cell.windSpeedMs ?? cell.fuelPct}`}
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => setSelectedCell(cell)}
                            className="p-1 text-center cursor-pointer relative"
                          >
                            <div
                              className={`h-9 w-full rounded flex items-center justify-center text-[11px] transition-all transform ${getCellClasses(
                                cell
                              )} ${
                                isSelected
                                  ? "ring-2 ring-white scale-105 z-20 shadow-lg"
                                  : isHovered
                                  ? "scale-105 z-10 brightness-125"
                                  : ""
                              } ${cell.isCurrentOperatingPoint ? "ring-2 ring-cyan-400 font-black" : ""}`}
                            >
                              <span>{cell.safetyScore}</span>

                              {/* Active Mission Operating Point Marker */}
                              {cell.isCurrentOperatingPoint && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 border border-slate-950"></span>
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Region Counts & Legend Ribbon */}
            <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-300 pt-3 border-t border-slate-800/80 mt-2 gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                  <strong className="text-emerald-400">Safe / Go:</strong> {safeCount} regions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                  <strong className="text-amber-400">Caution / Marginal:</strong> {cautionCount} regions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-600 inline-block" />
                  <strong className="text-rose-400">Critical / No-Go:</strong> {criticalCount} regions
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-cyan-300 text-[10px]">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>Pulsing Dot: Current Operating Point</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected / Hovered Region Telemetry Inspector (4 Columns on LG) */}
        <div className="lg:col-span-4 bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Stability Inspector</span>
            </div>

            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                activeInspector.region === "safe"
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : activeInspector.region === "caution"
                  ? "bg-amber-950 text-amber-300 border-amber-800"
                  : "bg-rose-950 text-rose-300 border-rose-800"
              }`}
            >
              {activeInspector.region === "safe" ? "Go (Safe Region)" : activeInspector.region === "caution" ? "Caution (Marginal)" : "No-Go (Critical Violation)"}
            </span>
          </div>

          {/* Configuration Coordinates */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-900/70 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">LAUNCH ANGLE Δγ</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {activeInspector.angleDeg > 0 ? `+${activeInspector.angleDeg}°` : `${activeInspector.angleDeg}°`}
              </span>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {activeInspector.angleDeg === 0 ? "Nominal Gravity Turn" : activeInspector.angleDeg > 0 ? "Steep Pitch" : "Shallow Pitch"}
              </div>
            </div>

            <div className="p-2 bg-slate-900/70 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {mapMode === "angle_wind" ? "CROSSWIND SPEED" : "PROPELLANT DELTA"}
              </span>
              <span className="text-sm font-bold text-amber-400 tabular-nums">
                {mapMode === "angle_wind" ? `${activeInspector.windSpeedMs} m/s` : `${activeInspector.fuelPct}%`}
              </span>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {mapMode === "angle_wind"
                  ? activeInspector.windSpeedMs! >= 18
                    ? "Severe Crosswind"
                    : activeInspector.windSpeedMs! >= 12
                    ? "Moderate Crosswind"
                    : "Low Surface Wind"
                  : "Liftoff Loading"}
              </div>
            </div>
          </div>

          {/* Safety Score Meter */}
          <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Launch Safety Index:</span>
              <span
                className={`text-base font-bold tabular-nums ${
                  activeInspector.safetyScore >= 78
                    ? "text-emerald-400"
                    : activeInspector.safetyScore >= 58
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {activeInspector.safetyScore} / 100
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  activeInspector.safetyScore >= 78
                    ? "bg-emerald-500"
                    : activeInspector.safetyScore >= 58
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${activeInspector.safetyScore}%` }}
              />
            </div>
          </div>

          {/* Physical Constraint Breakdown */}
          <div className="space-y-1.5 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Peak Max-Q Load</span>
                <span className="font-bold text-white tabular-nums">{activeInspector.maxQkPa} kPa</span>
                <span className={`text-[10px] block ${activeInspector.maxQkPa > 82 ? "text-rose-400" : "text-emerald-400"}`}>
                  {activeInspector.maxQkPa > 82 ? "Exceeds Limit" : "Nominal (<82 kPa)"}
                </span>
              </div>

              <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block">TVC Gimbal Req.</span>
                <span className="font-bold text-white tabular-nums">{activeInspector.tvcGimbalDeg}°</span>
                <span className={`text-[10px] block ${activeInspector.tvcGimbalDeg > 4.5 ? "text-rose-400" : "text-emerald-400"}`}>
                  {activeInspector.tvcGimbalDeg > 4.5 ? "Gimbal Limit Exceeded" : "Authority OK (<4.5°)"}
                </span>
              </div>
            </div>
          </div>

          {/* Constraints & Critical Risk Factors */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1 text-[11px] font-sans">
            <div className="font-semibold text-slate-300 flex items-center gap-1">
              <span>Constraint Diagnostics:</span>
            </div>
            {activeInspector.reasons.length > 0 ? (
              <ul className="space-y-1 text-slate-400 text-[10px] pt-0.5">
                {activeInspector.reasons.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-rose-300">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] pt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All Range Safety &amp; LCC weather limits fully satisfied.</span>
              </div>
            )}
          </div>

          {/* Apply Launch Angle Button */}
          {onSelectAngleDeviation && (
            <button
              onClick={() => onSelectAngleDeviation(activeInspector.angleDeg)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Apply Δγ={activeInspector.angleDeg}° to Active Flight Trajectory</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
