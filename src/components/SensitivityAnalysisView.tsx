import React, { useState, useMemo, useCallback } from "react";
import { Mission } from "../types";
import {
  simulateAscentTrajectory,
  EARTH_RADIUS_M,
  EARTH_MU,
  G0,
} from "../lib/physics";
import {
  D3SensitivityScatterPlot,
  SensitivityPoint,
  XAxisMetric,
  YAxisMetric,
  ColorMetric,
  SizeMetric,
  METRIC_LABELS,
} from "./D3SensitivityScatterPlot";
import { SensitivityHeatmap } from "./SensitivityHeatmap";
import {
  TrendingUp,
  Sliders,
  Gauge,
  Zap,
  Flame,
  ShieldAlert,
  CheckCircle2,
  Target,
  Info,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Activity,
  Layers,
  BarChart3,
  Compass,
} from "lucide-react";

interface SensitivityAnalysisViewProps {
  mission: Mission;
  onUpdateMission?: (updated: Mission) => void;
  onProceedToOptimization?: () => void;
}

export const SensitivityAnalysisView: React.FC<SensitivityAnalysisViewProps> = ({
  mission,
  onUpdateMission,
  onProceedToOptimization,
}) => {
  // Sub-view mode: D3 Scatter Plot vs 2D Parametric Heatmap
  const [activeSubView, setActiveSubView] = useState<"scatter" | "heatmap">("scatter");

  // Simulation parameters
  const [sweepMode, setSweepMode] = useState<"grid" | "monte_carlo">("grid");
  const [thrustRangePct, setThrustRangePct] = useState<number>(15); // ±15%
  const [fuelMarginRangePct, setFuelMarginRangePct] = useState<number>(20); // ±20%
  const [gridSteps, setGridSteps] = useState<number>(9); // 9x9 = 81 points
  const [monteCarloCount, setMonteCarloCount] = useState<number>(85); // 85 points
  const [randomSeed, setRandomSeed] = useState<number>(1);

  // Scatter Plot Axes and Encodings
  const [xAxis, setXAxis] = useState<XAxisMetric>("thrustPct");
  const [yAxis, setYAxis] = useState<YAxisMetric>("finalVelocityMs");
  const [colorBy, setColorBy] = useState<ColorMetric>("status");
  const [sizeBy, setSizeBy] = useState<SizeMetric>("uniform");
  const [showTrendline, setShowTrendline] = useState<boolean>(true);
  const [showSafeEnvelope, setShowSafeEnvelope] = useState<boolean>(true);

  // Selected Scatter Point for Inspector
  const [selectedPoint, setSelectedPoint] = useState<SensitivityPoint | null>(null);

  // Required circular orbital velocity at mission target altitude
  const targetAltM = mission.altitude * 1000;
  const targetVelocityMs = Math.sqrt(EARTH_MU / (EARTH_RADIUS_M + targetAltM));

  // Run the batch simulation to generate scatter points
  const scatterPoints = useMemo<SensitivityPoint[]>(() => {
    const points: SensitivityPoint[] = [];

    // Helper to evaluate a specific parameter set
    const evaluatePoint = (
      id: string,
      tPct: number,
      fMarginPct: number,
      fMassPct: number,
      ispPct: number,
      angleDev: number,
      isNominal = false
    ): SensitivityPoint => {
      const simThrust = mission.thrust * (1 + tPct / 100);
      const simFuelMargin = Math.max(0, mission.fuel_margin * (1 + fMarginPct / 100));
      // Usable fuel consumption varies slightly with fuel mass perturbation
      const simFuelConsumption = mission.fuel_consumption * (1 + fMassPct / 100);
      const simIsp = mission.specific_impulse * (1 + ispPct / 100);
      const initialMass = mission.rocket_mass + simFuelConsumption + mission.payload_mass;
      const simTwr = (simThrust * 1000) / (initialMass * G0);

      const testMission: Mission = {
        ...mission,
        thrust: simThrust,
        fuel_margin: simFuelMargin,
        fuel_consumption: simFuelConsumption,
        specific_impulse: simIsp,
        thrust_to_weight_ratio: simTwr,
      };

      // Run ascent trajectory integration
      const traj = simulateAscentTrajectory(testMission, 2.5, undefined, angleDev);
      const finalAlt = traj.altitude_km[traj.altitude_km.length - 1] || 0;
      const finalVel = traj.summary.final_velocity_ms || 0;
      const maxAlt = traj.summary.max_altitude_km || 0;
      const maxQ = traj.summary.max_dynamic_pressure_kPa || 0;
      const maxG = traj.summary.max_acceleration_g || 0;
      const burnTime = traj.summary.burn_time_sec || 0;

      const velMargin = finalVel - targetVelocityMs;
      const altMargin = finalAlt - mission.altitude;

      // Classify insertion outcome
      let status: SensitivityPoint["status"] = "Nominal";
      if (maxQ > 44 || maxG > 4.5) {
        status = "Overstressed";
      } else if (velMargin < -120 || altMargin < -45) {
        status = "Shortfall";
      } else if (velMargin > 280 || altMargin > 75) {
        status = "Overboost";
      } else if (velMargin >= -20 && Math.abs(altMargin) <= 25 && maxQ <= 40 && maxG <= 4.2) {
        status = "Optimal";
      } else {
        status = "Nominal";
      }

      return {
        id,
        thrustPct: tPct,
        fuelMarginPct: fMarginPct,
        fuelMassPct: fMassPct,
        ispPct: ispPct,
        angleDeviationDeg: angleDev,
        finalAltitudeKm: Number(finalAlt.toFixed(1)),
        maxAltitudeKm: Number(maxAlt.toFixed(1)),
        finalVelocityMs: Number(finalVel.toFixed(1)),
        velocityMarginMs: Number(velMargin.toFixed(1)),
        altitudeMarginKm: Number(altMargin.toFixed(1)),
        maxDynamicPressureKPa: Number(maxQ.toFixed(1)),
        maxAccelerationG: Number(maxG.toFixed(2)),
        burnTimeSec: Number(burnTime.toFixed(1)),
        status,
        isNominal,
      };
    };

    // Always include Nominal Baseline Point (0%, 0%)
    points.push(evaluatePoint("nominal", 0, 0, 0, 0, 0, true));

    if (sweepMode === "grid") {
      // Bivariate Grid Sweep across Thrust and Fuel Margin
      const tStep = (2 * thrustRangePct) / (gridSteps - 1);
      const fStep = (2 * fuelMarginRangePct) / (gridSteps - 1);

      let idx = 1;
      for (let i = 0; i < gridSteps; i++) {
        const tVal = -thrustRangePct + i * tStep;
        for (let j = 0; j < gridSteps; j++) {
          const fVal = -fuelMarginRangePct + j * fStep;
          if (Math.abs(tVal) < 0.2 && Math.abs(fVal) < 0.2) continue; // Skip near-zero as nominal is included
          // Slight secondary coupling: fuel mass fluctuation correlates with margin
          const fMassVal = fVal * 0.45;
          points.push(evaluatePoint(String(idx++), tVal, fVal, fMassVal, 0, 0));
        }
      }
    } else {
      // Monte Carlo Stochastic Dispersion
      // Simple pseudo-random generator with seed for reproducible jitter
      let s = randomSeed * 12345;
      const pseudoRandom = () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
      // Box-Muller Gaussian
      const gaussian = (mean: number, stdDev: number) => {
        const u1 = Math.max(1e-6, pseudoRandom());
        const u2 = pseudoRandom();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return mean + z0 * stdDev;
      };

      for (let i = 1; i <= monteCarloCount; i++) {
        // Thrust tolerance: Gaussian with 1σ = thrustRangePct / 2.5
        const tVal = Math.max(-thrustRangePct * 1.3, Math.min(thrustRangePct * 1.3, gaussian(0, thrustRangePct / 2.5)));
        // Fuel margin tolerance: Gaussian
        const fVal = Math.max(-fuelMarginRangePct * 1.3, Math.min(fuelMarginRangePct * 1.3, gaussian(0, fuelMarginRangePct / 2.5)));
        // Fuel mass deviation (±5%)
        const fMassVal = fVal * 0.4 + gaussian(0, 1.5);
        // Isp thermal/chamber variation (±2%)
        const ispVal = gaussian(0, 1.2);
        // Atmospheric pitch disturbance (±0.8°)
        const angleDev = gaussian(0, 0.4);

        points.push(evaluatePoint(String(i), tVal, fVal, fMassVal, ispVal, angleDev));
      }
    }

    return points;
  }, [
    mission,
    sweepMode,
    thrustRangePct,
    fuelMarginRangePct,
    gridSteps,
    monteCarloCount,
    randomSeed,
    targetVelocityMs,
  ]);

  // Aggregate Statistical Metrics across simulated population
  const populationStats = useMemo(() => {
    const total = scatterPoints.length;
    if (total === 0) return null;

    const optimalCount = scatterPoints.filter((p) => p.status === "Optimal").length;
    const nominalCount = scatterPoints.filter((p) => p.status === "Nominal").length;
    const shortfallCount = scatterPoints.filter((p) => p.status === "Shortfall").length;
    const overstressedCount = scatterPoints.filter((p) => p.status === "Overstressed").length;

    const successPct = Number((((optimalCount + nominalCount) / total) * 100).toFixed(1));

    // Elasticity estimates:
    // dV / dThrust: average slope
    const thrustPoints = scatterPoints.filter((p) => Math.abs(p.fuelMarginPct) < 3);
    let dV_dThrust = 0;
    if (thrustPoints.length >= 2) {
      const minT = thrustPoints.reduce((prev, curr) => (curr.thrustPct < prev.thrustPct ? curr : prev));
      const maxT = thrustPoints.reduce((prev, curr) => (curr.thrustPct > prev.thrustPct ? curr : prev));
      if (maxT.thrustPct !== minT.thrustPct) {
        dV_dThrust = (maxT.finalVelocityMs - minT.finalVelocityMs) / (maxT.thrustPct - minT.thrustPct);
      }
    }

    // dV / dFuelMargin
    const fuelPoints = scatterPoints.filter((p) => Math.abs(p.thrustPct) < 3);
    let dV_dFuel = 0;
    if (fuelPoints.length >= 2) {
      const minF = fuelPoints.reduce((prev, curr) => (curr.fuelMarginPct < prev.fuelMarginPct ? curr : prev));
      const maxF = fuelPoints.reduce((prev, curr) => (curr.fuelMarginPct > prev.fuelMarginPct ? curr : prev));
      if (maxF.fuelMarginPct !== minF.fuelMarginPct) {
        dV_dFuel = (maxF.finalVelocityMs - minF.finalVelocityMs) / (maxF.fuelMarginPct - minF.fuelMarginPct);
      }
    }

    // Max Q sensitivity to Thrust
    let dQ_dThrust = 0;
    if (thrustPoints.length >= 2) {
      const minT = thrustPoints.reduce((prev, curr) => (curr.thrustPct < prev.thrustPct ? curr : prev));
      const maxT = thrustPoints.reduce((prev, curr) => (curr.thrustPct > prev.thrustPct ? curr : prev));
      if (maxT.thrustPct !== minT.thrustPct) {
        dQ_dThrust = (maxT.maxDynamicPressureKPa - minT.maxDynamicPressureKPa) / (maxT.thrustPct - minT.thrustPct);
      }
    }

    // Determine primary risk bottleneck
    let primaryBottleneck = "Thrust Deficit";
    let bottleneckDesc = "Insufficient booster thrust degrades gravity turn apogee raising.";
    if (Math.abs(dV_dFuel) > Math.abs(dV_dThrust)) {
      primaryBottleneck = "Propellant Margin (Fuel Starvation)";
      bottleneckDesc = "Fuel reserves dominate orbital insertion: each -1% propellant loss induces ~" + Math.round(Math.abs(dV_dFuel)) + " m/s velocity deficit.";
    } else {
      primaryBottleneck = "Booster Thrust / TWR";
      bottleneckDesc = "Thrust fluctuations dictate gravity losses during early atmospheric climb.";
    }

    return {
      total,
      optimalCount,
      nominalCount,
      shortfallCount,
      overstressedCount,
      successPct,
      dV_dThrust: Number(dV_dThrust.toFixed(1)),
      dV_dFuel: Number(dV_dFuel.toFixed(1)),
      dQ_dThrust: Number(dQ_dThrust.toFixed(2)),
      primaryBottleneck,
      bottleneckDesc,
    };
  }, [scatterPoints]);

  // Handler to apply selected perturbation to the active mission
  const handleApplyScenarioToMission = useCallback(
    (point: SensitivityPoint) => {
      if (!onUpdateMission) return;
      const updated: Mission = {
        ...mission,
        thrust: Number((mission.thrust * (1 + point.thrustPct / 100)).toFixed(1)),
        fuel_margin: Number(Math.max(0, mission.fuel_margin * (1 + point.fuelMarginPct / 100)).toFixed(3)),
        fuel_consumption: Number((mission.fuel_consumption * (1 + point.fuelMassPct / 100)).toFixed(0)),
        specific_impulse: Number((mission.specific_impulse * (1 + point.ispPct / 100)).toFixed(1)),
      };
      onUpdateMission(updated);
    },
    [mission, onUpdateMission]
  );

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-white flex items-center gap-2.5">
                <span>Trajectory Parameter Sensitivity &amp; Dispersion Analysis</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/70 text-cyan-300">
                  D3.js Scatter Engine
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-sans">
                Quantify how physical fluctuations in booster thrust, fuel reserve margins, and propellant loading impact final orbit insertion velocity and apogee
              </div>
            </div>
          </div>

          {/* Sub-view switcher and Next Step */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setActiveSubView("scatter")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeSubView === "scatter"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>D3 Scatter Plot</span>
              </button>
              <button
                onClick={() => setActiveSubView("heatmap")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeSubView === "heatmap"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Parametric Heatmap</span>
              </button>
            </div>

            {onProceedToOptimization && (
              <button
                onClick={onProceedToOptimization}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-sm shadow-cyan-500/20 cursor-pointer"
              >
                <span>Proceed to Optimization</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4 HIGH-IMPACT SENSITIVITY KPI CARDS */}
        {populationStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            {/* KPI 1: Insertion Corridor Success Rate */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Orbit Insertion Feasibility</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{populationStats.total} Runs</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-1.5">
                <span className={populationStats.successPct >= 80 ? "text-emerald-400" : "text-amber-400"}>
                  {populationStats.successPct}%
                </span>
                <span className="text-xs text-slate-400 font-normal">in corridor</span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                {populationStats.optimalCount} Optimal · {populationStats.nominalCount} Nominal · {populationStats.shortfallCount} Shortfall
              </div>
            </div>

            {/* KPI 2: Primary Risk Bottleneck */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Primary Risk Driver</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono">Governing</span>
              </div>
              <div className="text-sm font-bold text-amber-300 mt-1 truncate" title={populationStats.primaryBottleneck}>
                {populationStats.primaryBottleneck}
              </div>
              <div className="text-[11px] text-slate-400 font-sans line-clamp-1" title={populationStats.bottleneckDesc}>
                {populationStats.bottleneckDesc}
              </div>
            </div>

            {/* KPI 3: Velocity Elasticity (Fuel Margin) */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <Flame className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Fuel Margin Elasticity</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">∂v / ∂Fuel</span>
              </div>
              <div className="text-2xl font-bold text-cyan-300 tracking-tight flex items-baseline gap-1">
                <span>{populationStats.dV_dFuel > 0 ? `+${populationStats.dV_dFuel}` : populationStats.dV_dFuel}</span>
                <span className="text-xs text-slate-400 font-normal">m/s per 1%</span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Δv sensitivity to reserve propellant loading
              </div>
            </div>

            {/* KPI 4: Thrust Elasticity & Max Q Impact */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-sans">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Thrust Elasticity</span>
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">∂v / ∂Thrust</span>
              </div>
              <div className="text-2xl font-bold text-indigo-300 tracking-tight flex items-baseline gap-1">
                <span>{populationStats.dV_dThrust > 0 ? `+${populationStats.dV_dThrust}` : populationStats.dV_dThrust}</span>
                <span className="text-xs text-slate-400 font-normal">m/s per 1%</span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                ∂Q_max / ∂Thrust: {populationStats.dQ_dThrust > 0 ? `+${populationStats.dQ_dThrust}` : populationStats.dQ_dThrust} kPa per 1%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: D3 SCATTER PLOT MODE */}
      {activeSubView === "scatter" && (
        <div className="space-y-6">
          {/* INTERACTIVE CONTROLS TOOLBAR */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4 text-xs font-mono">
            {/* Top row: Mode Selection & Sweep Parameters */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Sweep Mode Selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-sans">Dispersion Generator:</span>
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setSweepMode("grid")}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                      sweepMode === "grid"
                        ? "bg-cyan-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Bivariate Grid Sweep
                  </button>
                  <button
                    onClick={() => setSweepMode("monte_carlo")}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                      sweepMode === "monte_carlo"
                        ? "bg-cyan-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Monte Carlo Stochastic
                  </button>
                </div>

                {sweepMode === "monte_carlo" && (
                  <button
                    onClick={() => setRandomSeed((s) => s + 1)}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    title="Reseed Monte Carlo Gaussian Dispersion"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Stress Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 font-sans mr-1">Stress Presets:</span>
                <button
                  onClick={() => {
                    const pt = scatterPoints.find((p) => p.isNominal) || null;
                    setSelectedPoint(pt);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
                >
                  Nominal (0,0)
                </button>
                <button
                  onClick={() => {
                    // Find point near -10% thrust, 0% fuel
                    const pt = scatterPoints.reduce((best, curr) => {
                      const dCurr = Math.hypot(curr.thrustPct - -10, curr.fuelMarginPct - 0);
                      const dBest = Math.hypot(best.thrustPct - -10, best.fuelMarginPct - 0);
                      return dCurr < dBest ? curr : best;
                    }, scatterPoints[0]);
                    setSelectedPoint(pt);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-amber-800/60 text-amber-300 transition-colors cursor-pointer"
                >
                  -10% Thrust Derating
                </button>
                <button
                  onClick={() => {
                    // Find point near 0% thrust, -15% fuel margin
                    const pt = scatterPoints.reduce((best, curr) => {
                      const dCurr = Math.hypot(curr.thrustPct - 0, curr.fuelMarginPct - -15);
                      const dBest = Math.hypot(best.thrustPct - 0, best.fuelMarginPct - -15);
                      return dCurr < dBest ? curr : best;
                    }, scatterPoints[0]);
                    setSelectedPoint(pt);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-rose-800/60 text-rose-300 transition-colors cursor-pointer"
                >
                  -15% Fuel Starvation
                </button>
                <button
                  onClick={() => {
                    // Find point near +10% thrust, +15% fuel margin
                    const pt = scatterPoints.reduce((best, curr) => {
                      const dCurr = Math.hypot(curr.thrustPct - 10, curr.fuelMarginPct - 15);
                      const dBest = Math.hypot(best.thrustPct - 10, best.fuelMarginPct - 15);
                      return dCurr < dBest ? curr : best;
                    }, scatterPoints[0]);
                    setSelectedPoint(pt);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-emerald-800/60 text-emerald-300 transition-colors cursor-pointer"
                >
                  +10% Boost Surplus
                </button>
              </div>
            </div>

            {/* Middle Row: Parameter Fluctuation Range Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
              {/* Thrust Range Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Thrust Fluctuation Range:</span>
                  <span className="text-cyan-400 font-bold">±{thrustRangePct}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={25}
                  step={1}
                  value={thrustRangePct}
                  onChange={(e) => setThrustRangePct(Number(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>±5% (Precision)</span>
                  <span>±25% (High Turbulence)</span>
                </div>
              </div>

              {/* Fuel Margin Range Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Fuel Margin Range:</span>
                  <span className="text-amber-400 font-bold">±{fuelMarginRangePct}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={fuelMarginRangePct}
                  onChange={(e) => setFuelMarginRangePct(Number(e.target.value))}
                  className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>±5% (Tight Tanking)</span>
                  <span>±30% (Wide Contingency)</span>
                </div>
              </div>

              {/* Sample Density Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">
                    {sweepMode === "grid" ? "Grid Resolution:" : "Monte Carlo Samples:"}
                  </span>
                  <span className="text-indigo-400 font-bold">
                    {sweepMode === "grid" ? `${gridSteps} × ${gridSteps} (${gridSteps * gridSteps} runs)` : `${monteCarloCount} runs`}
                  </span>
                </div>
                {sweepMode === "grid" ? (
                  <input
                    type="range"
                    min={5}
                    max={13}
                    step={2}
                    value={gridSteps}
                    onChange={(e) => setGridSteps(Number(e.target.value))}
                    className="w-full accent-indigo-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                  />
                ) : (
                  <input
                    type="range"
                    min={40}
                    max={150}
                    step={15}
                    value={monteCarloCount}
                    onChange={(e) => setMonteCarloCount(Number(e.target.value))}
                    className="w-full accent-indigo-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                  />
                )}
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Fast</span>
                  <span>High Fidelity</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Plot Mapping & Visual Overlays */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-3">
                {/* X-Axis Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-sans">X-Axis:</span>
                  <select
                    value={xAxis}
                    onChange={(e) => setXAxis(e.target.value as XAxisMetric)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="thrustPct">Thrust Fluctuation (%)</option>
                    <option value="fuelMarginPct">Fuel Margin Fluctuation (%)</option>
                    <option value="fuelMassPct">Fuel Mass Fluctuation (%)</option>
                    <option value="ispPct">Specific Impulse (Isp) (%)</option>
                    <option value="angleDeviationDeg">Pitch Angle (deg)</option>
                  </select>
                </div>

                {/* Y-Axis Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-sans">Y-Axis:</span>
                  <select
                    value={yAxis}
                    onChange={(e) => setYAxis(e.target.value as YAxisMetric)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="finalVelocityMs">Final Velocity (m/s)</option>
                    <option value="velocityMarginMs">Δv Margin vs Orbit (m/s)</option>
                    <option value="finalAltitudeKm">Final Altitude (km)</option>
                    <option value="altitudeMarginKm">Altitude Margin vs Target (km)</option>
                    <option value="maxDynamicPressureKPa">Max Dynamic Pressure (kPa)</option>
                    <option value="maxAccelerationG">Max G-Force Load (g)</option>
                    <option value="burnTimeSec">Burn Time (s)</option>
                  </select>
                </div>

                {/* Color By Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-sans">Color:</span>
                  <select
                    value={colorBy}
                    onChange={(e) => setColorBy(e.target.value as ColorMetric)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="status">Flight Feasibility Status</option>
                    <option value="maxDynamicPressureKPa">Max Dynamic Q (Stress)</option>
                    <option value="maxAccelerationG">Max G-Force Load</option>
                    <option value="thrustPct">Thrust Deviation</option>
                    <option value="fuelMarginPct">Fuel Margin</option>
                  </select>
                </div>

                {/* Size By Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-sans">Size:</span>
                  <select
                    value={sizeBy}
                    onChange={(e) => setSizeBy(e.target.value as SizeMetric)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="uniform">Uniform</option>
                    <option value="maxDynamicPressureKPa">Max Q Magnitude</option>
                    <option value="maxAccelerationG">G-Load Peak</option>
                    <option value="burnTimeSec">Burn Time</option>
                  </select>
                </div>
              </div>

              {/* Toggles: Trendline & Safe Corridor */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white font-sans">
                  <input
                    type="checkbox"
                    checked={showTrendline}
                    onChange={(e) => setShowTrendline(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Regression Trendline</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white font-sans">
                  <input
                    type="checkbox"
                    checked={showSafeEnvelope}
                    onChange={(e) => setShowSafeEnvelope(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Target Corridor Band</span>
                </label>
              </div>
            </div>
          </div>

          {/* MAIN D3 SCATTER PLOT CONTAINER */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-semibold font-sans">
                  Simulation Outcome Dispersion: {METRIC_LABELS[yAxis].name} vs {METRIC_LABELS[xAxis].name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                  {scatterPoints.length} Trajectories Evaluated
                </span>
              </div>

              {/* Color Legend */}
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>Optimal</span>
                </span>
                <span className="flex items-center gap-1 text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                  <span>Nominal</span>
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                  <span>Shortfall</span>
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <span>Overstressed (Max Q / G)</span>
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                  <span>Overboost</span>
                </span>
              </div>
            </div>

            {/* D3 Render Area */}
            <div className="w-full bg-slate-950/70 rounded-xl border border-slate-800/80 p-2">
              <D3SensitivityScatterPlot
                data={scatterPoints}
                xAxis={xAxis}
                yAxis={yAxis}
                colorBy={colorBy}
                sizeBy={sizeBy}
                targetAltitudeKm={mission.altitude}
                targetVelocityMs={targetVelocityMs}
                selectedPoint={selectedPoint}
                onSelectPoint={setSelectedPoint}
                showTrendline={showTrendline}
                showSafeEnvelope={showSafeEnvelope}
              />
            </div>

            {/* SELECTED POINT INSPECTOR / COMPARISON PANEL */}
            {selectedPoint && (
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/60 shadow-xl space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white text-sm">
                      {selectedPoint.isNominal ? "Nominal Baseline Point" : `Selected Run: Run #${selectedPoint.id}`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedPoint.status === "Optimal"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : selectedPoint.status === "Nominal"
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                          : selectedPoint.status === "Shortfall"
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : "bg-amber-950 text-amber-300 border border-amber-800"
                      }`}
                    >
                      {selectedPoint.status} Insertion
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onUpdateMission && !selectedPoint.isNominal && (
                      <button
                        onClick={() => handleApplyScenarioToMission(selectedPoint)}
                        className="px-3 py-1 text-xs font-mono rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer"
                        title="Set active mission thrust & fuel parameters to match this perturbation"
                      >
                        Apply Parameters to Active Mission
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedPoint(null)}
                      className="px-2 py-1 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                    >
                      Close ✕
                    </button>
                  </div>
                </div>

                {/* Perturbation vs Outcome Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 font-sans">Thrust Shift:</span>
                    <div className={`font-bold mt-0.5 ${selectedPoint.thrustPct >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                      {selectedPoint.thrustPct > 0 ? "+" : ""}
                      {selectedPoint.thrustPct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {(mission.thrust * (1 + selectedPoint.thrustPct / 100)).toFixed(0)} kN
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 font-sans">Fuel Margin:</span>
                    <div className={`font-bold mt-0.5 ${selectedPoint.fuelMarginPct >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                      {selectedPoint.fuelMarginPct > 0 ? "+" : ""}
                      {selectedPoint.fuelMarginPct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {(mission.fuel_margin * (1 + selectedPoint.fuelMarginPct / 100) * 100).toFixed(1)}% reserve
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 font-sans">Final Velocity:</span>
                    <div className="font-bold text-white mt-0.5">
                      {Math.round(selectedPoint.finalVelocityMs).toLocaleString()} m/s
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Target: {Math.round(targetVelocityMs).toLocaleString()} m/s
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 font-sans">Δv Margin:</span>
                    <div
                      className={`font-bold mt-0.5 ${
                        selectedPoint.velocityMarginMs >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {selectedPoint.velocityMarginMs > 0 ? "+" : ""}
                      {Math.round(selectedPoint.velocityMarginMs)} m/s
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {selectedPoint.velocityMarginMs >= 0 ? "Velocity surplus" : "Insertion deficit"}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 font-sans">Achieved Apogee:</span>
                    <div className="font-bold text-white mt-0.5">
                      {selectedPoint.finalAltitudeKm.toFixed(1)} km
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Target: {mission.altitude} km ({selectedPoint.altitudeMarginKm > 0 ? "+" : ""}
                      {selectedPoint.altitudeMarginKm.toFixed(1)} km)
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 font-sans">Max Q / G-Load:</span>
                    <div
                      className={`font-bold mt-0.5 ${
                        selectedPoint.maxDynamicPressureKPa > 42 || selectedPoint.maxAccelerationG > 4.5
                          ? "text-rose-400"
                          : "text-slate-300"
                      }`}
                    >
                      {selectedPoint.maxDynamicPressureKPa.toFixed(1)} kPa / {selectedPoint.maxAccelerationG.toFixed(1)}g
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Burn Time: {selectedPoint.burnTimeSec.toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: PARAMETRIC HEATMAP MODE (Integrated SensitivityHeatmap) */}
      {activeSubView === "heatmap" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Parametric 2D Stability Heatmap: Ascent Pitch Angle vs Propellant Loading Variation</span>
            </span>
            <span className="text-slate-500">
              Evaluates cross-coupling between aerodynamic gravity turn angle and stage propellant margins
            </span>
          </div>

          <SensitivityHeatmap
            mission={mission}
            onApplyScenario={(scenario) => {
              if (onUpdateMission) {
                const updated: Mission = {
                  ...mission,
                  fuel_consumption: Number((mission.fuel_consumption * (1 + scenario.fuelDeltaPct / 100)).toFixed(0)),
                };
                onUpdateMission(updated);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
