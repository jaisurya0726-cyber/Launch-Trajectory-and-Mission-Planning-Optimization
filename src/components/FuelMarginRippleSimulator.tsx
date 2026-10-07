import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Mission, TrajectoryData } from "../types";
import { simulateAscentTrajectory, G0, EARTH_RADIUS_M, EARTH_MU } from "../lib/physics";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  Sliders,
  Flame,
  Clock,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Gauge,
  Rocket,
  TrendingUp,
  TrendingDown,
  Info,
  Check,
} from "lucide-react";

interface FuelMarginRippleSimulatorProps {
  mission: Mission;
  onUpdateMission?: (updated: Mission) => void;
}

export const FuelMarginRippleSimulator: React.FC<FuelMarginRippleSimulatorProps> = ({
  mission,
  onUpdateMission,
}) => {
  // Nominal fuel margin as a percentage (e.g. 0.02 -> 2.0%)
  const nominalMarginPct = Number(((mission.fuel_margin || 0.02) * 100).toFixed(1));

  // Current interactive slider state (percentage, e.g. 0.0% to 25.0%)
  const [sliderMarginPct, setSliderMarginPct] = useState<number>(nominalMarginPct);
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);

  // Sync slider if active mission changes
  useEffect(() => {
    setSliderMarginPct(Number(((mission.fuel_margin || 0.02) * 100).toFixed(1)));
  }, [mission.mission_id, mission.fuel_margin]);

  // Real-time physics and economic ripple simulation
  const simulation = useMemo(() => {
    const nominalMargin = mission.fuel_margin || 0.02;
    const currentMargin = Math.max(0, sliderMarginPct / 100);
    const deltaMargin = currentMargin - nominalMargin;
    const deltaMarginPct = Number((sliderMarginPct - nominalMarginPct).toFixed(1));

    // Propellant mass shift:
    // When margin changes, extra reserve fuel must be tanked in contingency
    const nominalFuel = mission.fuel_consumption;
    const deltaFuelKg = Math.round(nominalFuel * deltaMargin);
    const simulatedFuelConsumption = Math.max(1000, nominalFuel + deltaFuelKg);
    const nominalLiftoffMass = mission.rocket_mass + nominalFuel + mission.payload_mass;
    const simulatedLiftoffMass = mission.rocket_mass + simulatedFuelConsumption + mission.payload_mass;

    const thrustN = mission.thrust * 1000;
    const specificImpulse = mission.specific_impulse || 305;
    const massFlow = thrustN / (specificImpulse * G0);

    // Liftoff Thrust-to-Weight Ratio
    const nominalTwr = (thrustN / (nominalLiftoffMass * G0));
    const simulatedTwr = (thrustN / (simulatedLiftoffMass * G0));
    const twrDelta = Number((simulatedTwr - nominalTwr).toFixed(3));

    // Engine burn times
    const nominalBurnTime = nominalFuel / massFlow;
    const simulatedBurnTime = simulatedFuelConsumption / massFlow;
    const deltaBurnTimeSec = Number((simulatedBurnTime - nominalBurnTime).toFixed(1));

    // Trajectory ascent simulation with simulated parameters
    const simTestMission: Mission = {
      ...mission,
      fuel_margin: currentMargin,
      fuel_consumption: simulatedFuelConsumption,
      thrust_to_weight_ratio: Number(simulatedTwr.toFixed(2)),
    };

    // Run real-time trajectory integration
    const nominalTraj = simulateAscentTrajectory(mission, 2.5);
    const simulatedTraj = simulateAscentTrajectory(simTestMission, 2.5);

    // Gravity loss penalty on flight time:
    // Heavier propellant loading lowers acceleration, requiring extra ascent time through dense atmosphere
    const twrRatio = nominalTwr / Math.max(0.5, simulatedTwr);
    const gravityLossFactor = Math.pow(twrRatio, 0.45);
    const burnTimeRatio = simulatedBurnTime / Math.max(1, nominalBurnTime);

    // Flight time calculation:
    // If deltaMargin is zero, exactly equals nominal flight time
    let simulatedFlightTime = mission.flight_time;
    if (Math.abs(deltaMargin) > 0.0001) {
      const flightTimeDeltaSec = deltaBurnTimeSec * 1.08 + (mission.flight_time * 0.06 * (twrRatio - 1));
      simulatedFlightTime = Math.max(180, Math.round(mission.flight_time + flightTimeDeltaSec));
    }
    const deltaFlightTimeSec = simulatedFlightTime - mission.flight_time;
    const deltaFlightTimePct = Number(((deltaFlightTimeSec / Math.max(1, mission.flight_time)) * 100).toFixed(1));

    // Mission cost ripple effects:
    // 1. Cryogenic/hypergolic propellant loading, chilldown & boiloff logistics ($26/kg)
    const deltaCostPropellantMusd = (deltaFuelKg * 26.0) / 1_000_000;

    // 2. Structural vehicle integration, hold-down rating & staging margin
    const deltaCostStructuralMusd = mission.launch_cost * 0.25 * (deltaFuelKg / Math.max(1, nominalFuel));

    // 3. Insurance underwriter risk contingency surcharge / discount:
    // Below 2% margin, starvation hazard causes steep insurance premium hike (+15% to +28%)
    // Above 2% margin, generous reserve yields a slight risk discount
    let deltaCostRiskMusd = 0;
    if (currentMargin < 0.02) {
      const starvationSeverity = (0.02 - currentMargin) / 0.02;
      deltaCostRiskMusd = mission.launch_cost * 0.22 * starvationSeverity;
    } else {
      const reserveSurplus = Math.min(1.0, (currentMargin - 0.02) / 0.08);
      deltaCostRiskMusd = -mission.launch_cost * 0.035 * reserveSurplus;
    }

    const totalDeltaCostMusd = deltaCostPropellantMusd + deltaCostStructuralMusd + deltaCostRiskMusd;
    const simulatedCost = Number(Math.max(5.0, mission.launch_cost + totalDeltaCostMusd).toFixed(2));
    const deltaCostMusd = Number((simulatedCost - mission.launch_cost).toFixed(2));
    const deltaCostPct = Number(((deltaCostMusd / Math.max(1, mission.launch_cost)) * 100).toFixed(1));

    // Risk score ripple effect (0 to 100)
    let riskDelta = 0;
    if (currentMargin < 0.02) {
      riskDelta = ((0.02 - currentMargin) / 0.02) * 38; // Up to +38 risk points for starvation
    } else if (currentMargin > 0.16) {
      riskDelta = ((currentMargin - 0.16) / 0.10) * 8; // Slight structural penalty for overload
    } else {
      riskDelta = -Math.min(12, ((currentMargin - 0.02) / 0.06) * 12); // Buffer safety dividend
    }
    const simulatedRiskScore = Number(Math.max(5.0, Math.min(98.0, mission.risk_score + riskDelta)).toFixed(1));
    const deltaRiskScore = Number((simulatedRiskScore - mission.risk_score).toFixed(1));

    // Orbital insertion status
    const targetAltM = mission.altitude * 1000;
    const targetVelMs = Math.sqrt(EARTH_MU / (EARTH_RADIUS_M + targetAltM));
    const simFinalVel = simulatedTraj.summary.final_velocity_ms || 0;
    const velMarginMs = Math.round(simFinalVel - targetVelMs);

    let corridorStatus: "optimal" | "nominal" | "starvation" | "heavy";
    let corridorBadgeText: string;
    let corridorBadgeColor: string;

    if (currentMargin < 0.015) {
      corridorStatus = "starvation";
      corridorBadgeText = "Propellant Starvation Hazard";
      corridorBadgeColor = "bg-rose-950 text-rose-300 border-rose-800";
    } else if (currentMargin > 0.15) {
      corridorStatus = "heavy";
      corridorBadgeText = "Heavy Reserve · TWR Degraded";
      corridorBadgeColor = "bg-purple-950 text-purple-300 border-purple-800";
    } else if (currentMargin >= 0.035 && currentMargin <= 0.10) {
      corridorStatus = "optimal";
      corridorBadgeText = "Optimal Insertion Corridor";
      corridorBadgeColor = "bg-emerald-950 text-emerald-300 border-emerald-800";
    } else {
      corridorStatus = "nominal";
      corridorBadgeText = "Nominal Contingency Buffer";
      corridorBadgeColor = "bg-cyan-950 text-cyan-300 border-cyan-800";
    }

    // Prepare sampled comparison chart data (Altitude vs Time)
    const chartData: Array<{ time: number; nominalAlt: number; simAlt: number }> = [];
    const maxChartTime = Math.min(
      900,
      Math.max(
        Math.max(...nominalTraj.time),
        Math.max(...simulatedTraj.time)
      )
    );
    const step = 8;
    const numPoints = Math.floor(maxChartTime / step) + 1;

    for (let i = 0; i < numPoints; i++) {
      const t = i * step;
      // Interpolate nominal
      let nomAlt = 0;
      for (let j = 0; j < nominalTraj.time.length; j++) {
        if (nominalTraj.time[j] >= t) {
          nomAlt = nominalTraj.altitude_km[j];
          break;
        }
      }
      if (t > nominalTraj.time[nominalTraj.time.length - 1]) {
        nomAlt = nominalTraj.summary.max_altitude_km;
      }

      // Interpolate simulated
      let simAlt = 0;
      for (let j = 0; j < simulatedTraj.time.length; j++) {
        if (simulatedTraj.time[j] >= t) {
          simAlt = simulatedTraj.altitude_km[j];
          break;
        }
      }
      if (t > simulatedTraj.time[simulatedTraj.time.length - 1]) {
        simAlt = simulatedTraj.summary.max_altitude_km;
      }

      chartData.push({
        time: t,
        nominalAlt: Number(nomAlt.toFixed(1)),
        simAlt: Number(simAlt.toFixed(1)),
      });
    }

    return {
      nominalMarginPct,
      currentMargin,
      currentMarginPct: sliderMarginPct,
      deltaMarginPct,
      deltaFuelKg,
      simulatedFuelConsumption,
      nominalLiftoffMass,
      simulatedLiftoffMass,
      nominalTwr: Number(nominalTwr.toFixed(2)),
      simulatedTwr: Number(simulatedTwr.toFixed(2)),
      twrDelta,
      nominalBurnTime: Number(nominalBurnTime.toFixed(1)),
      simulatedBurnTime: Number(simulatedBurnTime.toFixed(1)),
      deltaBurnTimeSec,
      nominalFlightTime: mission.flight_time,
      simulatedFlightTime,
      deltaFlightTimeSec,
      deltaFlightTimePct,
      nominalCost: mission.launch_cost,
      simulatedCost,
      deltaCostMusd,
      deltaCostPct,
      deltaCostPropellantMusd: Number(deltaCostPropellantMusd.toFixed(3)),
      deltaCostStructuralMusd: Number(deltaCostStructuralMusd.toFixed(3)),
      deltaCostRiskMusd: Number(deltaCostRiskMusd.toFixed(3)),
      nominalRiskScore: mission.risk_score,
      simulatedRiskScore,
      deltaRiskScore,
      velMarginMs,
      targetVelMs: Math.round(targetVelMs),
      corridorStatus,
      corridorBadgeText,
      corridorBadgeColor,
      chartData,
      nominalMaxAlt: nominalTraj.summary.max_altitude_km,
      simulatedMaxAlt: simulatedTraj.summary.max_altitude_km,
    };
  }, [mission, sliderMarginPct, nominalMarginPct]);

  // Apply to active mission
  const handleApplyToActiveMission = useCallback(() => {
    if (!onUpdateMission) return;
    const updated: Mission = {
      ...mission,
      fuel_margin: simulation.currentMargin,
      fuel_consumption: simulation.simulatedFuelConsumption,
      flight_time: simulation.simulatedFlightTime,
      launch_cost: simulation.simulatedCost,
      risk_score: simulation.simulatedRiskScore,
      thrust_to_weight_ratio: simulation.simulatedTwr,
    };
    onUpdateMission(updated);
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 2500);
  }, [mission, simulation, onUpdateMission]);

  // Helper format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const presetMargins = [
    { label: "Starvation", val: 0.5, desc: "0.5% (High Risk)" },
    { label: "Nominal", val: nominalMarginPct, desc: `${nominalMarginPct}% (Default)` },
    { label: "ISRO / Commercial", val: 5.0, desc: "5.0% (Standard)" },
    { label: "Deep Space", val: 10.0, desc: "10.0% (Contingency)" },
    { label: "Max Reserve", val: 18.0, desc: "18.0% (Heavy)" },
  ];

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
      {/* HEADER & BADGE */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-800/60 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono text-amber-400 font-semibold tracking-wider">
                Real-Time Sensitivity Ripple Engine
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${simulation.corridorBadgeColor}`}>
                {simulation.corridorBadgeText}
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              Interactive Fuel Margin Simulator &amp; Ripple Effects
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Drag the slider to dynamically perturb the propellant contingency margin (<code className="text-amber-300 font-mono">fuel_margin</code>)
              and observe immediate ripple effects on liftoff mass, burn duration, ascent flight time, and overall mission cost.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSliderMarginPct(nominalMarginPct)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Reset margin slider to nominal baseline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Baseline</span>
          </button>

          {onUpdateMission && (
            <button
              onClick={handleApplyToActiveMission}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-semibold rounded-lg transition-all cursor-pointer shadow-sm ${
                appliedSuccess
                  ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 shadow-cyan-500/20"
              }`}
            >
              {appliedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Applied to Mission!</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Apply to Active Mission</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* INTERACTIVE SLIDER CONTROLLER & PRESET CHIPS */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white font-sans">Propellant Contingency Fuel Margin:</span>
            <span className="text-lg font-bold font-mono text-amber-300 ml-1">
              {simulation.currentMarginPct.toFixed(1)}%
            </span>
            <span className="text-xs font-mono text-slate-500">
              (fraction: {simulation.currentMargin.toFixed(3)})
            </span>
            <span
              className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                simulation.deltaMarginPct === 0
                  ? "bg-slate-900 text-slate-400 border border-slate-800"
                  : simulation.deltaMarginPct > 0
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                  : "bg-rose-950/80 text-rose-300 border border-rose-800"
              }`}
            >
              {simulation.deltaMarginPct > 0 ? `+${simulation.deltaMarginPct}` : simulation.deltaMarginPct}% vs nominal
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
            <span className="text-slate-500 mr-1 hidden sm:inline">Presets:</span>
            {presetMargins.map((p) => {
              const isActive = Math.abs(simulation.currentMarginPct - p.val) < 0.2;
              return (
                <button
                  key={p.label}
                  onClick={() => setSliderMarginPct(p.val)}
                  className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-xs"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                  }`}
                  title={p.desc}
                >
                  {p.label} ({p.val}%)
                </button>
              );
            })}
          </div>
        </div>

        {/* Continuous Slider Track */}
        <div className="space-y-1.5 pt-1">
          <div className="relative">
            <input
              type="range"
              min={0.0}
              max={22.0}
              step={0.1}
              value={sliderMarginPct}
              onChange={(e) => setSliderMarginPct(Number(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            {/* Visual marker for nominal position */}
            <div
              className="absolute top-0 w-1 h-3.5 bg-cyan-400 pointer-events-none rounded -translate-y-1"
              style={{ left: `${Math.min(100, Math.max(0, (nominalMarginPct / 22.0) * 100))}%` }}
              title={`Nominal Baseline: ${nominalMarginPct}%`}
            />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span className="text-rose-400 font-semibold">0.0% (Exhaustion Risk)</span>
            <span className="text-cyan-400">Nominal: {nominalMarginPct}%</span>
            <span>5.0% (Commercial Std)</span>
            <span>10.0% (High Margin)</span>
            <span className="text-purple-400">22.0% (Max Reserve)</span>
          </div>
        </div>
      </div>

      {/* 2 MAIN RIPPLE CARDS: FLIGHT TIME & MISSION COST (Side-by-Side Highlight) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RIPPLE EFFECT 1: FLIGHT TIME & BURN DURATION */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Ripple Effect: Flight Time &amp; Burn Duration
              </span>
            </div>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                simulation.deltaFlightTimeSec === 0
                  ? "bg-slate-900 text-slate-400 border-slate-800"
                  : simulation.deltaFlightTimeSec > 0
                  ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                  : "bg-indigo-950 text-indigo-300 border-indigo-800"
              }`}
            >
              {simulation.deltaFlightTimeSec > 0 ? `+${simulation.deltaFlightTimeSec}` : simulation.deltaFlightTimeSec}s
              {" "}({simulation.deltaFlightTimePct > 0 ? `+${simulation.deltaFlightTimePct}` : simulation.deltaFlightTimePct}%)
            </span>
          </div>

          {/* Comparative Metrics Display */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block uppercase">Baseline Ascent Time</span>
              <div className="text-lg font-bold text-slate-300 mt-0.5">
                {simulation.nominalFlightTime}s
              </div>
              <div className="text-[10px] text-slate-500 font-sans">
                {formatTime(simulation.nominalFlightTime)} · MECO at {simulation.nominalBurnTime}s
              </div>
            </div>

            <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/60">
              <span className="text-[10px] text-cyan-300 block uppercase">Simulated Ascent Time</span>
              <div className="text-lg font-bold text-cyan-300 mt-0.5">
                {simulation.simulatedFlightTime}s
              </div>
              <div className="text-[10px] text-cyan-400/80 font-sans">
                {formatTime(simulation.simulatedFlightTime)} · MECO at {simulation.simulatedBurnTime}s
              </div>
            </div>
          </div>

          {/* Physical Mechanism Description */}
          <div className="text-xs text-slate-300 font-sans leading-relaxed space-y-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
            <div className="font-semibold text-white flex items-center gap-1.5 text-[11px]">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Aerospace Physics Ripple Mechanism:</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {simulation.deltaFuelKg > 0 ? (
                <>
                  Loading <strong className="text-white">+{simulation.deltaFuelKg.toLocaleString()} kg</strong> of reserve propellant
                  increases liftoff wet mass to <strong className="text-white">{(simulation.simulatedLiftoffMass / 1000).toFixed(1)}t</strong>,
                  reducing initial TWR from <strong className="text-white">{simulation.nominalTwr}</strong> to <strong className="text-cyan-300">{simulation.simulatedTwr}</strong>.
                  Lower early vertical acceleration extends atmospheric climb and increases engine burn duration by <strong className="text-cyan-300">+{simulation.deltaBurnTimeSec}s</strong>.
                </>
              ) : simulation.deltaFuelKg < 0 ? (
                <>
                  Shaving <strong className="text-white">{Math.abs(simulation.deltaFuelKg).toLocaleString()} kg</strong> of propellant
                  reduces wet mass to <strong className="text-white">{(simulation.simulatedLiftoffMass / 1000).toFixed(1)}t</strong>,
                  boosting initial TWR to <strong className="text-emerald-300">{simulation.simulatedTwr}</strong>.
                  Engine cutoff occurs <strong className="text-amber-300">{Math.abs(simulation.deltaBurnTimeSec)}s earlier</strong>,
                  reducing total flight time by <strong className="text-white">{Math.abs(simulation.deltaFlightTimeSec)}s</strong>.
                </>
              ) : (
                <>
                  Propellant loading matches nominal flight plan at <strong className="text-white">{simulation.nominalMarginPct}%</strong> reserve.
                  Burn duration and flight time remain exactly at calibrated baseline parameters.
                </>
              )}
            </p>
          </div>
        </div>

        {/* RIPPLE EFFECT 2: MISSION COST & ECONOMIC IMPACT */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Ripple Effect: Mission Launch Cost
              </span>
            </div>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                simulation.deltaCostMusd === 0
                  ? "bg-slate-900 text-slate-400 border-slate-800"
                  : simulation.deltaCostMusd > 0
                  ? "bg-amber-950 text-amber-300 border-amber-800"
                  : "bg-emerald-950 text-emerald-300 border-emerald-800"
              }`}
            >
              {simulation.deltaCostMusd > 0 ? `+$${simulation.deltaCostMusd}M` : `-$${Math.abs(simulation.deltaCostMusd)}M`}
              {" "}({simulation.deltaCostPct > 0 ? `+${simulation.deltaCostPct}` : simulation.deltaCostPct}%)
            </span>
          </div>

          {/* Comparative Metrics Display */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block uppercase">Baseline Launch Cost</span>
              <div className="text-lg font-bold text-slate-300 mt-0.5">
                ${simulation.nominalCost.toFixed(2)}M
              </div>
              <div className="text-[10px] text-slate-500 font-sans">
                ${Math.round((simulation.nominalCost * 1_000_000) / Math.max(1, mission.payload_mass)).toLocaleString()}/kg payload
              </div>
            </div>

            <div className="p-3 bg-emerald-950/30 rounded-lg border border-emerald-800/60">
              <span className="text-[10px] text-emerald-300 block uppercase">Simulated Launch Cost</span>
              <div className="text-lg font-bold text-emerald-300 mt-0.5">
                ${simulation.simulatedCost.toFixed(2)}M
              </div>
              <div className="text-[10px] text-emerald-400/80 font-sans">
                ${Math.round((simulation.simulatedCost * 1_000_000) / Math.max(1, mission.payload_mass)).toLocaleString()}/kg payload
              </div>
            </div>
          </div>

          {/* Cost Driver Breakdown */}
          <div className="text-xs text-slate-300 font-sans leading-relaxed space-y-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
            <div className="font-semibold text-white flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Economic Ripple Cost Drivers:</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">Total Δ: {simulation.deltaCostMusd >= 0 ? `+$${simulation.deltaCostMusd}M` : `-$${Math.abs(simulation.deltaCostMusd)}M`}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-0.5">
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block truncate">Propellant GSE</span>
                <span className={simulation.deltaCostPropellantMusd >= 0 ? "text-amber-300 font-bold" : "text-emerald-300 font-bold"}>
                  {simulation.deltaCostPropellantMusd >= 0 ? `+$${simulation.deltaCostPropellantMusd}M` : `-$${Math.abs(simulation.deltaCostPropellantMusd)}M`}
                </span>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block truncate">Wet Mass Sizing</span>
                <span className={simulation.deltaCostStructuralMusd >= 0 ? "text-amber-300 font-bold" : "text-emerald-300 font-bold"}>
                  {simulation.deltaCostStructuralMusd >= 0 ? `+$${simulation.deltaCostStructuralMusd}M` : `-$${Math.abs(simulation.deltaCostStructuralMusd)}M`}
                </span>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block truncate">Risk Insurance</span>
                <span className={simulation.deltaCostRiskMusd >= 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                  {simulation.deltaCostRiskMusd >= 0 ? `+$${simulation.deltaCostRiskMusd}M` : `-$${Math.abs(simulation.deltaCostRiskMusd)}M`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECONDARY ROW: REAL-TIME TRAJECTORY PROFILE CHART & VEHICLE DYNAMICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Dynamic Trajectory Comparison Chart (7 Cols) */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white font-sans">
                Live Trajectory Ascent Profile: Altitude vs Time
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block" />
                <span>Baseline ({nominalMarginPct}%)</span>
              </span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                <span>Simulated ({simulation.currentMarginPct.toFixed(1)}%)</span>
              </span>
            </div>
          </div>

          <div className="w-full h-48 bg-slate-900/50 rounded-lg p-1 border border-slate-800/60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simulation.chartData} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  unit="s"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  unit="km"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs font-mono shadow-xl space-y-1">
                        <div className="text-cyan-400 font-bold border-b border-slate-800 pb-0.5">
                          t = {label}s
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-400">
                          <span>Baseline Altitude:</span>
                          <span className="text-white font-bold">{payload[0]?.value} km</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-amber-400">
                          <span>Simulated Altitude:</span>
                          <span className="text-amber-300 font-bold">{payload[1]?.value} km</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={mission.altitude}
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                  label={{ value: `Target: ${mission.altitude} km`, fill: "#38bdf8", fontSize: 10, position: "insideTopLeft" }}
                />
                <Line
                  type="monotone"
                  dataKey="nominalAlt"
                  name="Baseline"
                  stroke="#64748b"
                  strokeWidth={1.8}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="simAlt"
                  name="Simulated"
                  stroke="#f59e0b"
                  strokeWidth={2.4}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Burnout Apogee: {simulation.simulatedMaxAlt} km (vs {simulation.nominalMaxAlt} km nom)</span>
            <span>Orbital Velocity Insertion Margin: {simulation.velMarginMs > 0 ? `+${simulation.velMarginMs}` : simulation.velMarginMs} m/s</span>
          </div>
        </div>

        {/* Vehicle Dynamics & Risk Breakdown (5 Cols) */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white font-sans flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-400" />
              <span>Vehicle Dynamics &amp; Risk Shift</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Propellant: {simulation.deltaFuelKg >= 0 ? `+${simulation.deltaFuelKg.toLocaleString()} kg` : `${simulation.deltaFuelKg.toLocaleString()} kg`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
            {/* Propellant Loading */}
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/80 space-y-0.5">
              <span className="text-[10px] text-slate-500 block">Total Propellant</span>
              <div className="font-bold text-white">
                {(simulation.simulatedFuelConsumption / 1000).toFixed(1)}t
              </div>
              <div className="text-[10px] text-slate-400">
                Nominal: {(mission.fuel_consumption / 1000).toFixed(1)}t
              </div>
            </div>

            {/* Thrust-to-Weight Ratio */}
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/80 space-y-0.5">
              <span className="text-[10px] text-slate-500 block">Liftoff TWR</span>
              <div className={`font-bold ${simulation.simulatedTwr >= 1.25 ? "text-emerald-400" : "text-amber-400"}`}>
                {simulation.simulatedTwr}
              </div>
              <div className="text-[10px] text-slate-400">
                Δ TWR: {simulation.twrDelta >= 0 ? `+${simulation.twrDelta}` : simulation.twrDelta}
              </div>
            </div>

            {/* Risk Score */}
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/80 space-y-0.5">
              <span className="text-[10px] text-slate-500 block">Mission Risk Index</span>
              <div className={`font-bold ${simulation.simulatedRiskScore > 60 ? "text-rose-400" : simulation.simulatedRiskScore > 40 ? "text-amber-400" : "text-emerald-400"}`}>
                {simulation.simulatedRiskScore}/100
              </div>
              <div className="text-[10px] text-slate-400">
                Δ Risk: {simulation.deltaRiskScore >= 0 ? `+${simulation.deltaRiskScore}` : simulation.deltaRiskScore}
              </div>
            </div>

            {/* Burn Duration */}
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/80 space-y-0.5">
              <span className="text-[10px] text-slate-500 block">MECO Burnout</span>
              <div className="font-bold text-cyan-300">
                {simulation.simulatedBurnTime}s
              </div>
              <div className="text-[10px] text-slate-400">
                Δ Burn: {simulation.deltaBurnTimeSec >= 0 ? `+${simulation.deltaBurnTimeSec}` : simulation.deltaBurnTimeSec}s
              </div>
            </div>
          </div>

          {/* Quick Guidance Box */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] font-sans text-slate-400 space-y-1">
            <span className="text-slate-300 font-semibold block">Guidance &amp; Operational Recommendation:</span>
            {simulation.currentMargin < 0.02 ? (
              <p className="text-rose-300/90">
                ⚠️ Margin is below the 2.0% safe threshold. High probability of premature burnout before circularization.
                Increase margin to at least 3.5% to avoid mission shortfall.
              </p>
            ) : simulation.currentMargin > 0.15 ? (
              <p className="text-purple-300/90">
                ℹ️ Margin is excessive (&gt;15%). While safety is very high, mission launch cost increases by +${simulation.deltaCostMusd}M and liftoff TWR drops to {simulation.simulatedTwr}.
              </p>
            ) : (
              <p className="text-emerald-300/90">
                ✓ Fuel margin is within the optimal aerospace flight corridor ({simulation.currentMarginPct.toFixed(1)}%).
                Risk is well-mitigated while cost inflation remains modest.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
