import React, { useState, useMemo } from "react";
import { Mission } from "../types";
import { G0 } from "../lib/physics";
import { Gauge, CloudRain, Wind, Thermometer, ShieldAlert, ArrowRight, Sliders, RefreshCw, Zap } from "lucide-react";

interface MissionParametersProps {
  mission: Mission;
  onProceedToTrajectory: () => void;
}

export const MissionParameters: React.FC<MissionParametersProps> = ({
  mission,
  onProceedToTrajectory,
}) => {
  // Sensitivity offset: -10% to +10%
  const [payloadOffsetPct, setPayloadOffsetPct] = useState<number>(0);

  // Dynamic sensitivity physical calculations
  const sensitivity = useMemo(() => {
    const nominalPayload = mission.payload_mass;
    const adjustedPayload = Number((nominalPayload * (1 + payloadOffsetPct / 100)).toFixed(1));
    const payloadDeltaKg = Number((adjustedPayload - nominalPayload).toFixed(1));

    const mDry = mission.rocket_mass;
    const mFuelMax = mission.fuel_mass;
    const isp = mission.specific_impulse;
    const deltaVReqMs = mission.delta_v * 1000;
    const exhaustV = isp * G0;

    // Tsiolkovsky mass ratio for mission delta-v requirement
    const massRatio = Math.exp(deltaVReqMs / exhaustV);
    const nominalFuel = mission.fuel_consumption;
    const calculatedFuel = (mDry + adjustedPayload) * (massRatio - 1);
    const adjustedFuel = Number(
      Math.min(mFuelMax * 1.05, Math.max(mFuelMax * 0.72, calculatedFuel)).toFixed(1)
    );
    const fuelDeltaKg = Number((adjustedFuel - nominalFuel).toFixed(1));
    const fuelDeltaPct = Number(((fuelDeltaKg / nominalFuel) * 100).toFixed(2));

    // Vehicle Delta-V Capability (Tsiolkovsky max delta-v with full propellant)
    const nominalMaxDv = (isp * G0 * Math.log((mDry + mFuelMax + nominalPayload) / (mDry + nominalPayload))) / 1000;
    const adjustedMaxDv = (isp * G0 * Math.log((mDry + mFuelMax + adjustedPayload) / (mDry + adjustedPayload))) / 1000;
    const dvDeltaKms = Number((adjustedMaxDv - nominalMaxDv).toFixed(3));
    const dvDeltaMs = Number((dvDeltaKms * 1000).toFixed(0));

    // Adjusted TWR at liftoff
    const adjustedLiftoffMass = mDry + adjustedFuel + adjustedPayload;
    const thrustN = mission.thrust * 1000;
    const adjustedTwr = Number((thrustN / (adjustedLiftoffMass * G0)).toFixed(2));
    const twrDelta = Number((adjustedTwr - mission.thrust_to_weight_ratio).toFixed(2));

    // Payload ratio & Fuel margin
    const adjustedPayloadRatio = Number(((adjustedPayload / mission.payload_capacity) * 100).toFixed(1));
    const adjustedFuelRatio = Number(((adjustedFuel / mFuelMax) * 100).toFixed(1));
    const adjustedFuelMargin = Number(((mFuelMax - adjustedFuel) / mFuelMax).toFixed(3));

    // Adjusted Risk
    const nominalRatio = mission.payload_mass / mission.payload_capacity;
    const newRatio = adjustedPayload / mission.payload_capacity;
    const payloadStrainDelta = (Math.pow(newRatio, 1.5) - Math.pow(nominalRatio, 1.5)) * 20;
    const adjustedRisk = Number(
      Math.max(5.0, Math.min(95.0, mission.risk_score + payloadStrainDelta)).toFixed(1)
    );

    return {
      nominalPayload,
      adjustedPayload,
      payloadDeltaKg,
      nominalFuel,
      adjustedFuel,
      fuelDeltaKg,
      fuelDeltaPct,
      nominalMaxDv: Number(nominalMaxDv.toFixed(3)),
      adjustedMaxDv: Number(adjustedMaxDv.toFixed(3)),
      dvDeltaKms,
      dvDeltaMs,
      adjustedTwr,
      twrDelta,
      adjustedPayloadRatio,
      adjustedFuelRatio,
      adjustedFuelMargin,
      adjustedRisk,
      adjustedLiftoffMass,
    };
  }, [mission, payloadOffsetPct]);

  const presetOffsets = [-10, -5, 0, 5, 10];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-mono text-cyan-400">Page 2 — Comprehensive Physics &amp; Flight Parameters</div>
          <div className="text-xl font-bold text-white mt-0.5">
            {mission.mission_id}: {mission.satellite_name} · {mission.rocket}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Site: {mission.launch_site} · Orbit: {mission.target_orbit} at {mission.altitude} km · Priority: Tier {mission.mission_priority}
          </div>
        </div>

        <button
          onClick={onProceedToTrajectory}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
        >
          <span>Run Trajectory Simulation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SENSITIVITY TOGGLE & DYNAMIC PHYSICS FEEDBACK CONTROL PANEL */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 border border-cyan-800/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Payload Sensitivity Analysis (±10% Range)</span>
                {payloadOffsetPct !== 0 && (
                  <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Active: {payloadOffsetPct > 0 ? `+${payloadOffsetPct}%` : `${payloadOffsetPct}%`}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-sans">
                Real-time Tsiolkovsky equation feedback on Δv capacity, fuel requirement &amp; liftoff acceleration
              </div>
            </div>
          </div>

          {payloadOffsetPct !== 0 && (
            <button
              onClick={() => setPayloadOffsetPct(0)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Nominal (0%)</span>
            </button>
          )}
        </div>

        {/* Segmented Preset Toggles & Fine Slider */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-1">
          {/* Segmented Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800/80">
            {presetOffsets.map((offset) => {
              const isActive = payloadOffsetPct === offset;
              const label = offset === 0 ? "Nominal (0%)" : offset > 0 ? `+${offset}%` : `${offset}%`;
              return (
                <button
                  key={offset}
                  onClick={() => setPayloadOffsetPct(offset)}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                    isActive
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/25"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Continuous Range Scrubber */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>-10% Payload</span>
              <span className="text-cyan-300 font-semibold tabular-nums">
                Current: {payloadOffsetPct > 0 ? `+${payloadOffsetPct}%` : `${payloadOffsetPct}%`} (
                {sensitivity.adjustedPayload.toLocaleString()} kg)
              </span>
              <span>+10% Payload</span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={payloadOffsetPct}
              onChange={(e) => setPayloadOffsetPct(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-2 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Dynamic Sensitivity Impact Readouts (Instant HUD) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono tabular-nums">
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 font-sans block text-[11px]">Payload Mass Shift</span>
            <div className="text-base font-bold text-white mt-0.5">
              {sensitivity.adjustedPayload.toLocaleString()} kg
            </div>
            <div className={`text-[11px] mt-0.5 ${sensitivity.payloadDeltaKg > 0 ? "text-amber-400" : sensitivity.payloadDeltaKg < 0 ? "text-emerald-400" : "text-slate-500"}`}>
              {sensitivity.payloadDeltaKg > 0 ? `+${sensitivity.payloadDeltaKg}` : sensitivity.payloadDeltaKg} kg ({payloadOffsetPct}%)
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 font-sans block text-[11px]">Fuel Consumption Impact</span>
            <div className="text-base font-bold text-white mt-0.5">
              {sensitivity.adjustedFuel.toLocaleString()} kg
            </div>
            <div className={`text-[11px] mt-0.5 ${sensitivity.fuelDeltaKg > 0 ? "text-rose-400" : sensitivity.fuelDeltaKg < 0 ? "text-emerald-400" : "text-slate-500"}`}>
              {sensitivity.fuelDeltaKg > 0 ? `+${sensitivity.fuelDeltaKg}` : sensitivity.fuelDeltaKg} kg ({sensitivity.fuelDeltaPct}%)
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 font-sans block text-[11px]">Vehicle Max Δv Margin</span>
            <div className="text-base font-bold text-white mt-0.5">
              {sensitivity.adjustedMaxDv} km/s
            </div>
            <div className={`text-[11px] mt-0.5 ${sensitivity.dvDeltaMs < 0 ? "text-amber-400" : sensitivity.dvDeltaMs > 0 ? "text-emerald-400" : "text-slate-500"}`}>
              {sensitivity.dvDeltaMs > 0 ? `+${sensitivity.dvDeltaMs}` : sensitivity.dvDeltaMs} m/s capacity
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 font-sans block text-[11px]">Liftoff TWR Shift</span>
            <div className="text-base font-bold text-white mt-0.5">
              {sensitivity.adjustedTwr.toFixed(2)}
            </div>
            <div className={`text-[11px] mt-0.5 ${sensitivity.twrDelta < 0 ? "text-amber-400" : sensitivity.twrDelta > 0 ? "text-emerald-400" : "text-slate-500"}`}>
              {sensitivity.twrDelta > 0 ? `+${sensitivity.twrDelta}` : sensitivity.twrDelta} TWR
            </div>
          </div>
        </div>
      </div>

      {/* Primary Dynamic Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-mono uppercase text-slate-400">Payload Capacity Usage</div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {sensitivity.adjustedPayloadRatio.toFixed(1)} %
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${sensitivity.adjustedPayloadRatio > 90 ? "bg-amber-400" : "bg-cyan-400"}`}
              style={{ width: `${Math.min(100, sensitivity.adjustedPayloadRatio)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {sensitivity.adjustedPayload.toLocaleString()} / {mission.payload_capacity.toLocaleString()} kg
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-mono uppercase text-slate-400">Propellant Burn Ratio</div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {sensitivity.adjustedFuelRatio.toFixed(1)} %
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(100, sensitivity.adjustedFuelRatio)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Margin: {(sensitivity.adjustedFuelMargin * 100).toFixed(1)}% remaining
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-mono uppercase text-slate-400">Thrust-to-Weight (Liftoff)</div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {sensitivity.adjustedTwr.toFixed(2)}
          </div>
          <div className="text-xs text-emerald-400 mt-2 font-mono">
            {sensitivity.adjustedTwr >= 1.2 ? "● NOMINAL LIFTOFF ACCEL" : "▲ MARGINAL TWR"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            Thrust: {mission.thrust.toLocaleString()} kN
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-mono uppercase text-slate-400">Dynamic Risk Score</div>
          <div
            className={`text-2xl font-mono font-bold mt-1 tabular-nums ${
              sensitivity.adjustedRisk > 60
                ? "text-rose-400"
                : sensitivity.adjustedRisk > 30
                ? "text-amber-400"
                : "text-emerald-400"
            }`}
          >
            {sensitivity.adjustedRisk.toFixed(1)} / 100
          </div>
          <div className="text-xs text-slate-300 mt-2 font-mono">
            {sensitivity.adjustedRisk > 60 ? "HIGH RISK / HOLD ADVISORY" : sensitivity.adjustedRisk > 30 ? "MODERATE RISK" : "SAFE"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            Est. Cost: ${mission.launch_cost}M
          </div>
        </div>
      </div>

      {/* Detailed Technical Tables with Dynamic Mass Budget */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Rocket & Mass Budget */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="text-sm font-semibold text-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span>Launch Vehicle Mass &amp; Propulsion Budget</span>
            </div>
            {payloadOffsetPct !== 0 && (
              <span className="text-[11px] font-mono text-cyan-400">Dynamically Adjusted</span>
            )}
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Launch Vehicle</span>
              <span className="text-slate-200">{mission.rocket}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Vehicle Dry Mass</span>
              <span className="text-slate-200">{mission.rocket_mass.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Total Propellant Loaded</span>
              <span className="text-slate-200">{mission.fuel_mass.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Payload Mass (Active)</span>
              <span className="text-cyan-300 font-bold">
                {sensitivity.adjustedPayload.toLocaleString()} kg{" "}
                {payloadOffsetPct !== 0 && (
                  <span className="text-[11px] text-slate-400">
                    ({payloadOffsetPct > 0 ? `+${payloadOffsetPct}%` : `${payloadOffsetPct}%`})
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Fuel Consumption (Calculated)</span>
              <span className="text-cyan-300 font-semibold">
                {sensitivity.adjustedFuel.toLocaleString()} kg
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Specific Impulse (Isp)</span>
              <span className="text-slate-200">{mission.specific_impulse} s</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Total Liftoff Mass (m₀)</span>
              <span className="text-slate-200">
                {sensitivity.adjustedLiftoffMass.toLocaleString()} kg
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400 font-sans">Payload Fraction</span>
              <span className="text-slate-200">
                {((sensitivity.adjustedPayload / sensitivity.adjustedLiftoffMass) * 100).toFixed(2)} %
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Atmospheric & Environmental Conditions */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-cyan-400" />
            <span>Atmospheric &amp; Launch Window Conditions</span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Launch Site</span>
              <span className="text-slate-200">{mission.launch_site}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Scheduled Launch Time</span>
              <span className="text-slate-200">{mission.launch_time} UTC</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Launch Window</span>
              <span className="text-slate-200">
                {mission.launch_window_start} – {mission.launch_window_end} ({mission.launch_window_duration} min)
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-slate-400" /> Ambient Temperature
              </span>
              <span className="text-slate-200">{mission.weather_temperature} °C</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-slate-400" /> Surface Wind Speed
              </span>
              <span className="text-slate-200">{mission.wind_speed} m/s</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Precipitation &amp; Humidity</span>
              <span className="text-slate-200">{mission.rain} mm/hr · {mission.humidity}% RH</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Aerodynamic Cross Section</span>
              <span className="text-slate-200">{mission.cross_section_area} m² (Cd = {mission.drag_coefficient})</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400 font-sans">Trajectory Profile</span>
              <span className="text-slate-200">{mission.trajectory_type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transparent Risk Formula Card */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Transparent Composite Risk Equation Formulation</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          The risk score is calculated deterministically from physical conditions without arbitrary scoring:
        </p>
        <div className="p-3 bg-slate-950 rounded-lg font-mono text-xs text-cyan-300 border border-slate-800 overflow-x-auto">
          Risk = (Wind / 25 × 22) + (Rain / 20 × 20) + (|T - 24| / 20 × 12) + (Humidity Penalty) + ((m_payload / m_cap)^1.5 × 20) + Margin_Penalty + Trajectory_Weight
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono pt-1 text-slate-400">
          <div>Wind Contrib: {((mission.wind_speed / 25) * 22).toFixed(1)} pts</div>
          <div>Rain Contrib: {((mission.rain / 20) * 20).toFixed(1)} pts</div>
          <div>Payload Strain: {((sensitivity.adjustedPayloadRatio / 100) ** 1.5 * 20).toFixed(1)} pts</div>
          <div className="text-slate-200 font-semibold">Total: {sensitivity.adjustedRisk.toFixed(1)} / 100</div>
        </div>
      </div>
    </div>
  );
};
