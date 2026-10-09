import React, { useState, useMemo } from "react";
import { Mission } from "../types";
import {
  WeatherParameters,
  assessLaunchWindowRisk,
} from "../lib/riskAssessment";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Wind,
  CloudRain,
  Thermometer,
  Zap,
  Clock,
  Compass,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";

interface LaunchRiskAssessmentProps {
  mission: Mission;
  className?: string;
  onSelectOptimalWindow?: (timeStr: string) => void;
}

export const LaunchRiskAssessment: React.FC<LaunchRiskAssessmentProps> = ({
  mission,
  className = "",
  onSelectOptimalWindow,
}) => {
  // Weather parameters state (initialized to current mission weather telemetry)
  const [weather, setWeather] = useState<WeatherParameters>({
    temperatureC: mission.weather_temperature ?? 24.0,
    windSpeedMs: mission.wind_speed ?? 6.0,
    rainMmHr: mission.rain ?? 0.0,
    humidityPct: mission.humidity ?? 65.0,
    gustFactor: 1.2,
    cloudCoverPct: mission.rain > 0 ? 80 : 35,
    windDirectionDeg: 120,
  });

  // Selected minute offset within the launch window (0 to duration)
  const windowDuration = mission.launch_window_duration || 60;
  const [selectedOffsetMins, setSelectedOffsetMins] = useState<number>(() => {
    // Default to scheduled launch time offset within window if possible
    if (mission.launch_time && mission.launch_window_start) {
      const [sh, sm] = mission.launch_time.split(":").map(Number);
      const [wh, wm] = mission.launch_window_start.split(":").map(Number);
      const diff = (sh * 60 + sm) - (wh * 60 + wm);
      return Math.max(0, Math.min(windowDuration, diff));
    }
    return Math.floor(windowDuration / 2);
  });

  // UI accordion / details toggles
  const [showFormula, setShowFormula] = useState<boolean>(false);
  const [showWhatIfTuner, setShowWhatIfTuner] = useState<boolean>(true);

  // Compute probabilistic risk assessment across the full window
  const assessment = useMemo(() => {
    return assessLaunchWindowRisk(mission, weather, selectedOffsetMins);
  }, [mission, weather, selectedOffsetMins]);

  // Reset sliders to telemetry sensors
  const handleResetToSensor = () => {
    setWeather({
      temperatureC: mission.weather_temperature ?? 24.0,
      windSpeedMs: mission.wind_speed ?? 6.0,
      rainMmHr: mission.rain ?? 0.0,
      humidityPct: mission.humidity ?? 65.0,
      gustFactor: 1.2,
      cloudCoverPct: mission.rain > 0 ? 80 : 35,
      windDirectionDeg: 120,
    });
  };

  // Jump to optimal window slot
  const handleApplyOptimalSlot = () => {
    setSelectedOffsetMins(assessment.optimalSlot.minutesFromStart);
    if (onSelectOptimalWindow) {
      onSelectOptimalWindow(assessment.optimalSlot.timeLabel);
    }
  };

  const isModifiedFromNominal =
    weather.temperatureC !== mission.weather_temperature ||
    weather.windSpeedMs !== mission.wind_speed ||
    weather.rainMmHr !== mission.rain ||
    weather.humidityPct !== mission.humidity ||
    weather.gustFactor !== 1.2;

  return (
    <div className={`p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6 ${className}`}>
      {/* =========================================================================
          1. HEADER & HIGH-LEVEL PROBABILISTIC STATUS
          ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            assessment.compositeRiskScore > 55
              ? "bg-rose-950/80 border-rose-800/80 text-rose-400"
              : assessment.compositeRiskScore > 28
              ? "bg-amber-950/80 border-amber-800/80 text-amber-400"
              : "bg-emerald-950/80 border-emerald-800/80 text-emerald-400"
          }`}>
            {assessment.compositeRiskScore > 55 ? (
              <ShieldAlert className="w-5 h-5" />
            ) : assessment.compositeRiskScore > 28 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">Launch Risk Assessment</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                NASA/ISRO LCC Evaluator
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Probabilistic launch commit criteria &amp; atmospheric volatility integration
            </div>
          </div>
        </div>

        {/* Status Callout Badge */}
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-slate-400">Launch Decision Status</div>
            <div className={`text-sm font-mono font-bold flex items-center gap-1.5 justify-end ${assessment.color}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span>{assessment.safetyStatus}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-slate-400">Probability of GO</div>
            <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
              {assessment.goProbability.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. LAUNCH WINDOW TIMELINE SCRUBBER & OPTIMAL TIME RECOMMENDER
          ========================================================================= */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">
              Selected Launch Window: {mission.launch_window_start} – {mission.launch_window_end} UTC ({windowDuration} min)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono">
              Selected: <span className="text-cyan-300 font-bold">{assessment.selectedTimeSlot.timeLabel} UTC</span> (+{assessment.selectedTimeSlot.minutesFromStart}m)
            </span>
            <button
              onClick={handleApplyOptimalSlot}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-[11px] font-mono cursor-pointer transition-colors shadow-xs"
              title="Jump to the lowest-risk launch time inside window"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Jump to Optimal ({assessment.optimalSlot.timeLabel})</span>
            </button>
          </div>
        </div>

        {/* Timeline Bar Distribution Chart */}
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-11 gap-1.5">
            {assessment.timeSlots.map((slot) => {
              const isSelected = Math.abs(slot.minutesFromStart - assessment.selectedTimeSlot.minutesFromStart) < (windowDuration / 11);
              const isOptimal = slot.isOptimal;

              return (
                <button
                  key={`slot_${slot.minutesFromStart}`}
                  onClick={() => setSelectedOffsetMins(slot.minutesFromStart)}
                  className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer text-center group ${
                    isSelected
                      ? "bg-slate-800/90 border-cyan-400 ring-1 ring-cyan-500/50 shadow-md"
                      : isOptimal
                      ? "bg-emerald-950/40 border-emerald-700/60 hover:bg-emerald-900/50"
                      : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700"
                  }`}
                  title={`${slot.timeLabel} UTC: ${slot.compositeRiskScore}% Risk (${slot.status})`}
                >
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-200">
                    {slot.timeLabel}
                  </span>

                  {/* Vertical mini risk bar */}
                  <div className="w-full h-8 bg-slate-950 rounded flex flex-col justify-end overflow-hidden my-1">
                    <div
                      className={`w-full transition-all duration-300 ${
                        slot.compositeRiskScore > 55
                          ? "bg-rose-500"
                          : slot.compositeRiskScore > 28
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      }`}
                      style={{ height: `${Math.max(10, Math.min(100, slot.compositeRiskScore))}%` }}
                    />
                  </div>

                  <span className={`text-[10px] font-mono tabular-nums font-bold ${
                    slot.compositeRiskScore > 55
                      ? "text-rose-400"
                      : slot.compositeRiskScore > 28
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}>
                    {slot.compositeRiskScore.toFixed(0)}%
                  </span>

                  {isOptimal && (
                    <span className="text-[8px] uppercase tracking-wider font-bold text-emerald-400 mt-0.5">
                      BEST
                    </span>
                  )}
                  {slot.isScheduled && !isOptimal && (
                    <span className="text-[8px] uppercase tracking-wider font-bold text-cyan-400 mt-0.5">
                      SCHED
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Interactive Window Range Slider */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-[10px] font-mono text-slate-500">T+{mission.launch_window_start}</span>
            <input
              type="range"
              min={0}
              max={windowDuration}
              value={selectedOffsetMins}
              onChange={(e) => setSelectedOffsetMins(Number(e.target.value))}
              className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-[10px] font-mono text-slate-500">T+{mission.launch_window_end}</span>
          </div>
        </div>

        {/* Optimal Recommendation Banner */}
        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/60 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Optimal Liftoff Slot: <strong>{assessment.optimalSlot.timeLabel} UTC</strong> (+{assessment.optimalSlot.minutesFromStart} min into window)
            </span>
          </div>
          <div className="text-emerald-400 font-bold">
            Risk: {assessment.optimalSlot.compositeRiskScore.toFixed(1)}% (GO Probability: {assessment.optimalSlot.goProbability.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN RISK SCORE GAUGE & COMPOSITE METRICS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Primary Circular/Radial Risk Indicator */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="text-xs uppercase font-mono text-slate-400 mb-2">Probabilistic Risk Score</div>
          
          <div className="relative w-36 h-36 flex items-center justify-center my-1">
            {/* SVG Radial Gauge */}
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-slate-800"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={
                  assessment.compositeRiskScore > 55
                    ? "#f43f5e"
                    : assessment.compositeRiskScore > 28
                    ? "#fbbf24"
                    : "#10b981"
                }
                strokeWidth="8"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * Math.min(100, assessment.compositeRiskScore)) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-3xl font-mono font-extrabold tabular-nums ${assessment.color}`}>
                {assessment.compositeRiskScore.toFixed(1)}%
              </span>
              <span className="text-[9px] uppercase font-mono text-slate-400 tracking-wider">
                Scrub / Hazard
              </span>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-400 mt-2">
            90% CI: [{assessment.confidenceInterval.p5}% – {assessment.confidenceInterval.p95}%]
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
            {assessment.goProbability.toFixed(1)}% Confidence of Weather GO
          </div>
        </div>

        {/* 4-Quadrant Category Risk Breakdown */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <span>Atmospheric Hazard Contributors</span>
            <span className="text-slate-400 font-mono text-[11px]">Independent Rule Probability</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {/* Wind Risk */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5 font-sans">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Surface &amp; Gust Wind</span>
                </span>
                <span className={`font-bold tabular-nums ${assessment.breakdown.windRisk > 30 ? "text-amber-400" : "text-slate-200"}`}>
                  {assessment.breakdown.windRisk.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, assessment.breakdown.windRisk)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Speed: {weather.windSpeedMs.toFixed(1)} m/s (Limit: 15.0 m/s)
              </div>
            </div>

            {/* Lightning Risk */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5 font-sans">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Triggered Lightning</span>
                </span>
                <span className={`font-bold tabular-nums ${assessment.breakdown.lightningRisk > 30 ? "text-amber-400" : "text-slate-200"}`}>
                  {assessment.breakdown.lightningRisk.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, assessment.breakdown.lightningRisk)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Humidity: {weather.humidityPct.toFixed(0)}% RH · Cloud: {weather.cloudCoverPct}%
              </div>
            </div>

            {/* Precipitation Risk */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5 font-sans">
                  <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                  <span>Rain &amp; Fairing Abrasion</span>
                </span>
                <span className={`font-bold tabular-nums ${assessment.breakdown.rainRisk > 20 ? "text-rose-400" : "text-slate-200"}`}>
                  {assessment.breakdown.rainRisk.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, assessment.breakdown.rainRisk)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Rain: {weather.rainMmHr.toFixed(1)} mm/hr (Dry path rule)
              </div>
            </div>

            {/* Thermal Risk */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5 font-sans">
                  <Thermometer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Thermal Envelope</span>
                </span>
                <span className={`font-bold tabular-nums ${assessment.breakdown.thermalRisk > 20 ? "text-amber-400" : "text-slate-200"}`}>
                  {assessment.breakdown.thermalRisk.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, assessment.breakdown.thermalRisk)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Temp: {weather.temperatureC.toFixed(1)}°C (Range 4°C – 36°C)
              </div>
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>High-Altitude Max-Q Wind Shear Coupling:</span>
            <span className="text-cyan-300 font-bold">{assessment.breakdown.shearRisk.toFixed(1)}% risk factor</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. WHAT-IF WEATHER TUNING SLIDERS (LIVE PROBABILISTIC SENSITIVITY)
          ========================================================================= */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">Interactive Weather Parameter Tuner (What-If Analysis)</span>
            {isModifiedFromNominal && (
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300">
                Modified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isModifiedFromNominal && (
              <button
                onClick={handleResetToSensor}
                className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer"
                title="Reset to mission sensor readings"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Sensors</span>
              </button>
            )}
            <button
              onClick={() => setShowWhatIfTuner(!showWhatIfTuner)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              {showWhatIfTuner ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showWhatIfTuner && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Wind Speed Slider */}
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1 font-sans">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" /> Wind Speed
                </span>
                <span className="text-cyan-300 font-bold tabular-nums">{weather.windSpeedMs.toFixed(1)} m/s</span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={0.5}
                value={weather.windSpeedMs}
                onChange={(e) => setWeather({ ...weather, windSpeedMs: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>0 m/s</span>
                <span className="text-amber-400 font-semibold">15 m/s Limit</span>
                <span>25 m/s</span>
              </div>
            </div>

            {/* Ambient Temperature Slider */}
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1 font-sans">
                  <Thermometer className="w-3.5 h-3.5 text-emerald-400" /> Ambient Temp
                </span>
                <span className="text-emerald-300 font-bold tabular-nums">{weather.temperatureC.toFixed(1)} °C</span>
              </div>
              <input
                type="range"
                min={-5}
                max={45}
                step={0.5}
                value={weather.temperatureC}
                onChange={(e) => setWeather({ ...weather, temperatureC: Number(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>-5 °C</span>
                <span className="text-slate-400">Nominal 24°C</span>
                <span>45 °C</span>
              </div>
            </div>

            {/* Rain / Precipitation Slider */}
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1 font-sans">
                  <CloudRain className="w-3.5 h-3.5 text-blue-400" /> Precipitation
                </span>
                <span className="text-blue-300 font-bold tabular-nums">{weather.rainMmHr.toFixed(1)} mm/h</span>
              </div>
              <input
                type="range"
                min={0}
                max={15}
                step={0.2}
                value={weather.rainMmHr}
                onChange={(e) => setWeather({ ...weather, rainMmHr: Number(e.target.value) })}
                className="w-full accent-blue-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>0 mm/h (Dry)</span>
                <span className="text-rose-400 font-semibold">0.5 Limit</span>
                <span>15 mm/h</span>
              </div>
            </div>

            {/* Relative Humidity Slider */}
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1 font-sans">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Humidity (RH)
                </span>
                <span className="text-amber-300 font-bold tabular-nums">{weather.humidityPct.toFixed(0)} %</span>
              </div>
              <input
                type="range"
                min={15}
                max={100}
                step={1}
                value={weather.humidityPct}
                onChange={(e) => setWeather({ ...weather, humidityPct: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>15%</span>
                <span className="text-slate-400">75% Convective</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          5. LAUNCH COMMIT CRITERIA (LCC) RULE COMPLIANCE CHECKLIST
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>Launch Commit Criteria (LCC) Aerospace Standards Verification</span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            {assessment.rules.filter((r) => !r.isViolated).length} / {assessment.rules.length} Rules Compliant
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {assessment.rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                rule.isViolated
                  ? "bg-rose-950/30 border-rose-800/60"
                  : rule.probabilityOfViolation > 0.25
                  ? "bg-amber-950/25 border-amber-800/60"
                  : "bg-slate-950/50 border-slate-800/80"
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  {rule.isViolated ? (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : rule.probabilityOfViolation > 0.25 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-200 truncate">{rule.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                  {rule.description}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono pl-6 pt-0.5 text-slate-400">
                  <span>Req: <strong className="text-slate-300">{rule.threshold}</strong></span>
                  <span>Observed: <strong className="text-cyan-300">{rule.currentValue}</strong></span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  rule.isViolated
                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                    : rule.probabilityOfViolation > 0.25
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                }`}>
                  {rule.isViolated ? "VIOLATION" : rule.probabilityOfViolation > 0.25 ? "WARNING" : "CLEAR"}
                </span>
                <div className="text-[9px] font-mono text-slate-500 mt-1">
                  P(Breach): {(rule.probabilityOfViolation * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          6. SCIENTIFIC EQUATION FORMULATION & TRANSPARENT AUDIT
          ========================================================================= */}
      <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono space-y-2">
        <button
          onClick={() => setShowFormula(!showFormula)}
          className="w-full flex items-center justify-between text-slate-400 hover:text-white cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Probabilistic Joint Risk Equation Formulation</span>
          </div>
          {showFormula ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showFormula && (
          <div className="space-y-2 pt-2 border-t border-slate-800 text-slate-400 text-[11px] leading-relaxed font-sans">
            <p>
              The composite probabilistic scrub risk is evaluated as the joint union of independent Poisson and logistic survival hazards across all physical Launch Commit Criteria:
            </p>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-cyan-300 overflow-x-auto text-[11px]">
              P(Scrub) = 1 - ∏ [1 - P_k] = 1 - (1 - P_wind) × (1 - P_lightning) × (1 - P_rain) × (1 - P_thermal) × (1 - P_shear)
            </div>
            <p>
              Where surface wind probability follows normal cumulative distribution Φ((V_limit - V_wind) / σ_wind), and lightning risk accounts for relative humidity, convective cloud thickness, and static charge buildup along the ionization plume path.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
