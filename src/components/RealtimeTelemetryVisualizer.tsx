import React, { useState, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  LineChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Activity,
  Gauge,
  Flame,
  Zap,
  Target,
  Layers,
  ChevronRight,
  Radio,
  Sliders,
  TrendingUp,
  Maximize2,
} from "lucide-react";
import { Mission, TrajectoryData } from "../types";

export interface RealtimeTelemetryVisualizerProps {
  mission: Mission;
  trajectory: TrajectoryData;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const RealtimeTelemetryVisualizer: React.FC<RealtimeTelemetryVisualizerProps> = ({
  mission,
  trajectory,
  currentIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
}) => {
  // View mode options:
  // "dual" -> Single unified chart with Left Y-Axis (Altitude) and Right Y-Axis (Velocity)
  // "split" -> Two stacked synchronized charts (Altitude above, Velocity below)
  // "stream" -> Progressive reveal only up to current flight timestamp (simulating live telemetry downlink)
  const [chartMode, setChartMode] = useState<"dual" | "split" | "stream">("dual");
  const [showTargetOrbitLine, setShowTargetOrbitLine] = useState<boolean>(true);
  const [showMilestoneMarkers, setShowMilestoneMarkers] = useState<boolean>(true);

  const nPoints = trajectory.time.length;
  const currentIdx = Math.max(0, Math.min(currentIndex, nPoints - 1));

  const currentTime = trajectory.time[currentIdx] || 0;
  const currentAlt = trajectory.altitude_km[currentIdx] || 0;
  const currentVel = trajectory.velocity_ms[currentIdx] || 0;
  const currentAccel = trajectory.accel_g[currentIdx] || 0;
  const currentQ = trajectory.dynamic_pressure_kPa[currentIdx] || 0;
  const currentDownrange = trajectory.downrange_km[currentIdx] || 0;

  // Rate of climb (vertical velocity estimate)
  const climbRateMs = useMemo(() => {
    if (currentIdx === 0) return 0;
    const prevAlt = trajectory.altitude_km[currentIdx - 1];
    const prevTime = trajectory.time[currentIdx - 1];
    const dt = currentTime - prevTime;
    if (dt <= 0) return 0;
    return Number((((currentAlt - prevAlt) * 1000) / dt).toFixed(1));
  }, [currentIdx, trajectory, currentAlt, currentTime]);

  // Max-Q point detection
  const maxQValue = trajectory.summary.max_dynamic_pressure_kPa;
  const maxQIdx = useMemo(() => {
    return trajectory.dynamic_pressure_kPa.indexOf(maxQValue);
  }, [trajectory, maxQValue]);
  const maxQTime = maxQIdx >= 0 ? trajectory.time[maxQIdx] : 65;

  // Pre-calculate full flight dataset for Recharts
  const fullChartData = useMemo(() => {
    return trajectory.time.map((t, i) => {
      const alt = trajectory.altitude_km[i] || 0;
      const vel = trajectory.velocity_ms[i] || 0;
      const accel = trajectory.accel_g[i] || 0;
      const q = trajectory.dynamic_pressure_kPa[i] || 0;
      const downrange = trajectory.downrange_km[i] || 0;
      const mach = Number((vel / 320.0).toFixed(2));
      const velKmh = Math.round(vel * 3.6);

      let milestoneTag = "";
      if (i === 0) milestoneTag = "Liftoff";
      else if (i === maxQIdx) milestoneTag = "Max-Q";
      else if (i === nPoints - 1) milestoneTag = "Burnout";

      return {
        index: i,
        time: t,
        timeStr: `T+${t.toFixed(0)}s`,
        altitudeKm: Number(alt.toFixed(2)),
        velocityMs: Number(vel.toFixed(1)),
        velocityKmh: velKmh,
        mach: mach,
        accelG: Number(accel.toFixed(2)),
        dynamicPressureKpa: Number(q.toFixed(2)),
        downrangeKm: Number(downrange.toFixed(1)),
        milestoneTag: milestoneTag,
      };
    });
  }, [trajectory, maxQIdx, nPoints]);

  // Visible data based on chartMode (if "stream", only up to currentIdx)
  const visibleChartData = useMemo(() => {
    if (chartMode === "stream") {
      return fullChartData.slice(0, Math.max(1, currentIdx + 1));
    }
    return fullChartData;
  }, [chartMode, fullChartData, currentIdx]);

  // Domain calculations
  const maxAltAll = useMemo(() => {
    const rawMax = trajectory.summary.max_altitude_km;
    return Math.max(rawMax, mission.altitude, 100);
  }, [trajectory, mission]);

  const maxVelAll = useMemo(() => {
    return Math.max(trajectory.summary.final_velocity_ms, 2000);
  }, [trajectory]);

  // Handle clicking on Recharts chart to scrub
  const handleChartClick = (e: any) => {
    if (e && e.activePayload && e.activePayload.length > 0) {
      const clickedData = e.activePayload[0].payload;
      if (clickedData && typeof clickedData.index === "number") {
        onIndexChange(clickedData.index);
      }
    }
  };

  // Jump to specific milestone
  const jumpToMilestone = (idx: number) => {
    onIndexChange(Math.max(0, Math.min(idx, nPoints - 1)));
  };

  return (
    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
      {/* =========================================================================
          HEADER & REAL-TIME TELEMETRY CONTROLS
          ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Real-Time Ascent Telemetry (Recharts Engine)
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                <span>{isPlaying ? "LIVE DOWNLINK" : "READY / PAUSED"}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Simultaneous high-precision tracking of altitude (km) and velocity (m/s) across flight duration
            </p>
          </div>
        </div>

        {/* View Mode & Overlay Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Display Mode Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setChartMode("dual")}
              className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                chartMode === "dual"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Dual-Axis Overlay: Altitude & Velocity on one synchronized viewport"
            >
              Dual-Axis
            </button>
            <button
              onClick={() => setChartMode("split")}
              className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                chartMode === "split"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Split View: Individual charts for Altitude and Velocity"
            >
              Split View
            </button>
            <button
              onClick={() => setChartMode("stream")}
              className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                chartMode === "stream"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Live Stream: Reveal telemetry packets progressively as vehicle ascends"
            >
              Live Stream
            </button>
          </div>

          {/* Target Orbit Toggle */}
          <button
            onClick={() => setShowTargetOrbitLine(!showTargetOrbitLine)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
              showTargetOrbitLine
                ? "bg-emerald-950/70 border-emerald-800/80 text-emerald-400"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Toggle Target Mission Orbit Reference Line"
          >
            <Target className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Target Orbit</span>
          </button>

          {/* Milestones Toggle */}
          <button
            onClick={() => setShowMilestoneMarkers(!showMilestoneMarkers)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
              showMilestoneMarkers
                ? "bg-amber-950/70 border-amber-800/80 text-amber-400"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Toggle Flight Milestones Reference Lines"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Milestones</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          LIVE TELEMETRY HUD SENSOR RIBBON (REAL-TIME READOUTS)
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Elapsed Flight Time */}
        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>Elapsed Time</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div className="text-lg font-bold font-mono text-white mt-0.5">
            T+{currentTime.toFixed(1)} <span className="text-xs text-slate-400">s</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
            Step {currentIdx + 1} / {nPoints}
          </div>
        </div>

        {/* Metric 2: Altitude */}
        <div className="p-3 rounded-lg bg-slate-950/90 border border-cyan-900/40">
          <div className="text-[10px] uppercase font-mono text-cyan-400 flex items-center justify-between">
            <span>Altitude</span>
            <TrendingUp className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
            {currentAlt.toFixed(2)} <span className="text-xs font-normal">km</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Climb: {climbRateMs > 0 ? `+${climbRateMs}` : climbRateMs} m/s
          </div>
        </div>

        {/* Metric 3: Velocity */}
        <div className="p-3 rounded-lg bg-slate-950/90 border border-amber-900/40">
          <div className="text-[10px] uppercase font-mono text-amber-400 flex items-center justify-between">
            <span>Velocity</span>
            <FastForward className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
            {currentVel.toFixed(0)} <span className="text-xs font-normal">m/s</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Mach {(currentVel / 320.0).toFixed(2)} · {Math.round(currentVel * 3.6).toLocaleString()} km/h
          </div>
        </div>

        {/* Metric 4: Acceleration Load */}
        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>G-Force</span>
            <Gauge className="w-3 h-3 text-rose-400" />
          </div>
          <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
            {currentAccel.toFixed(2)} <span className="text-xs font-normal">g</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
            {(currentAccel * 9.80665).toFixed(1)} m/s²
          </div>
        </div>

        {/* Metric 5: Dynamic Pressure (q) */}
        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>Dynamic Press.</span>
            <Flame className="w-3 h-3 text-orange-400" />
          </div>
          <div className="text-lg font-bold font-mono text-orange-300 mt-0.5">
            {currentQ.toFixed(1)} <span className="text-xs font-normal">kPa</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
            Max-Q: {maxQValue.toFixed(1)} kPa
          </div>
        </div>

        {/* Metric 6: Downrange Distance */}
        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>Downrange</span>
            <Target className="w-3 h-3 text-indigo-400" />
          </div>
          <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5">
            {currentDownrange.toFixed(1)} <span className="text-xs font-normal">km</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
            Target: {mission.target_orbit}
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECHARTS TELEMETRY CHARTS
          ========================================================================= */}
      {chartMode === "dual" || chartMode === "stream" ? (
        /* DUAL-AXIS SYNCHRONIZED RECHARTS VIEW */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono px-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>Altitude (km) — Left Axis</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Velocity (m/s) — Right Axis</span>
              </span>
            </div>
            <div className="text-slate-400 text-[11px] hidden md:block">
              Click anywhere on chart to seek flight time
            </div>
          </div>

          <div className="h-80 w-full bg-slate-950/90 rounded-xl border border-slate-800/80 p-2 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={visibleChartData}
                onClick={handleChartClick}
                margin={{ top: 15, right: 25, left: 10, bottom: 5 }}
              >
                <defs>
                  {/* Cyan Gradient for Altitude Area */}
                  <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>

                  {/* Amber Gradient for Velocity Area */}
                  <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" opacity={0.6} />

                {/* X Axis: Flight Time */}
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, trajectory.time[nPoints - 1]]}
                  tickFormatter={(t) => `T+${t}s`}
                  stroke="#64748b"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                  tickLine={{ stroke: "#334155" }}
                />

                {/* Left Y Axis: Altitude (km) */}
                <YAxis
                  yAxisId="altAxis"
                  orientation="left"
                  domain={[0, Math.ceil(maxAltAll * 1.1)]}
                  tickFormatter={(val) => `${val}km`}
                  stroke="#06b6d4"
                  tick={{ fill: "#22d3ee", fontSize: 11, fontFamily: "monospace" }}
                  tickLine={{ stroke: "#0891b2" }}
                />

                {/* Right Y Axis: Velocity (m/s) */}
                <YAxis
                  yAxisId="velAxis"
                  orientation="right"
                  domain={[0, Math.ceil(maxVelAll * 1.08)]}
                  tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
                  stroke="#f59e0b"
                  tick={{ fill: "#fbbf24", fontSize: 11, fontFamily: "monospace" }}
                  tickLine={{ stroke: "#d97706" }}
                />

                {/* Custom Interactive Tooltip */}
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 shadow-xl backdrop-blur-md text-xs font-mono space-y-1.5 min-w-[200px]">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                            <span className="font-bold text-white text-sm">{data.timeStr}</span>
                            {data.milestoneTag && (
                              <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-300 rounded text-[10px] font-bold">
                                {data.milestoneTag}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-cyan-400">
                            <span>Altitude:</span>
                            <span className="font-bold">{data.altitudeKm} km</span>
                          </div>
                          <div className="flex items-center justify-between text-amber-400">
                            <span>Velocity:</span>
                            <span className="font-bold">{data.velocityMs} m/s</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300">
                            <span>Mach Number:</span>
                            <span>Mach {data.mach}</span>
                          </div>
                          <div className="flex items-center justify-between text-rose-400">
                            <span>Acceleration:</span>
                            <span>{data.accelG} g</span>
                          </div>
                          <div className="flex items-center justify-between text-orange-300">
                            <span>Dynamic Press:</span>
                            <span>{data.dynamicPressureKpa} kPa</span>
                          </div>
                          <div className="flex items-center justify-between text-indigo-300">
                            <span>Downrange:</span>
                            <span>{data.downrangeKm} km</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Target Orbit Altitude Reference Line */}
                {showTargetOrbitLine && (
                  <ReferenceLine
                    y={mission.altitude}
                    yAxisId="altAxis"
                    stroke="#10b981"
                    strokeDasharray="5 3"
                    strokeWidth={1.8}
                    label={{
                      value: `Target Orbit (${mission.altitude} km)`,
                      fill: "#34d399",
                      fontSize: 11,
                      position: "insideTopLeft",
                      fontFamily: "monospace",
                    }}
                  />
                )}

                {/* Max-Q Reference Line */}
                {showMilestoneMarkers && (
                  <ReferenceLine
                    x={maxQTime}
                    stroke="#fb923c"
                    strokeDasharray="4 2"
                    strokeWidth={1.4}
                    label={{
                      value: "Max-Q",
                      fill: "#fb923c",
                      fontSize: 10,
                      position: "insideTopRight",
                      fontFamily: "monospace",
                    }}
                  />
                )}

                {/* Live Current Time Cursor Line */}
                <ReferenceLine
                  x={currentTime}
                  stroke="#ffffff"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                />

                {/* Altitude Area & Line */}
                <Area
                  yAxisId="altAxis"
                  type="monotone"
                  dataKey="altitudeKm"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#altitudeGradient)"
                  isAnimationActive={false}
                />

                {/* Velocity Line & Subtle Fill */}
                <Area
                  yAxisId="velAxis"
                  type="monotone"
                  dataKey="velocityMs"
                  stroke="#f59e0b"
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill="url(#velocityGradient)"
                  isAnimationActive={false}
                />

                {/* Live Position Dots for current flight instant */}
                <ReferenceDot
                  x={currentTime}
                  y={currentAlt}
                  yAxisId="altAxis"
                  r={5}
                  fill="#06b6d4"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <ReferenceDot
                  x={currentTime}
                  y={currentVel}
                  yAxisId="velAxis"
                  r={5}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* SPLIT STACKED RECHARTS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart A: Altitude vs Flight Duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono px-1">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>Altitude Profile (0 → {maxAltAll.toFixed(0)} km)</span>
              </span>
              <span className="text-slate-400">Current: {currentAlt.toFixed(1)} km</span>
            </div>

            <div className="h-64 w-full bg-slate-950/90 rounded-xl border border-slate-800/80 p-2 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={visibleChartData}
                  onClick={handleChartClick}
                  margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="splitAltGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" opacity={0.6} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(t) => `T+${t}s`}
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                  />
                  <YAxis
                    domain={[0, Math.ceil(maxAltAll * 1.1)]}
                    tickFormatter={(val) => `${val}km`}
                    stroke="#06b6d4"
                    tick={{ fill: "#22d3ee", fontSize: 10, fontFamily: "monospace" }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow text-xs font-mono">
                            <div className="text-white font-bold">{d.timeStr}</div>
                            <div className="text-cyan-400 font-bold">{d.altitudeKm} km</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {showTargetOrbitLine && (
                    <ReferenceLine
                      y={mission.altitude}
                      stroke="#10b981"
                      strokeDasharray="4 2"
                      label={{ value: `Target Orbit: ${mission.altitude}km`, fill: "#34d399", fontSize: 10 }}
                    />
                  )}
                  <ReferenceLine x={currentTime} stroke="#ffffff" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="altitudeKm"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fill="url(#splitAltGrad)"
                    isAnimationActive={false}
                  />
                  <ReferenceDot x={currentTime} y={currentAlt} r={4.5} fill="#06b6d4" stroke="#ffffff" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart B: Velocity vs Flight Duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono px-1">
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Velocity Curve (0 → {maxVelAll.toFixed(0)} m/s)</span>
              </span>
              <span className="text-slate-400">Current: {currentVel.toFixed(0)} m/s (Mach {(currentVel / 320).toFixed(1)})</span>
            </div>

            <div className="h-64 w-full bg-slate-950/90 rounded-xl border border-slate-800/80 p-2 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={visibleChartData}
                  onClick={handleChartClick}
                  margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="splitVelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" opacity={0.6} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(t) => `T+${t}s`}
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                  />
                  <YAxis
                    domain={[0, Math.ceil(maxVelAll * 1.08)]}
                    tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
                    stroke="#f59e0b"
                    tick={{ fill: "#fbbf24", fontSize: 10, fontFamily: "monospace" }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow text-xs font-mono">
                            <div className="text-white font-bold">{d.timeStr}</div>
                            <div className="text-amber-400 font-bold">{d.velocityMs} m/s (Mach {d.mach})</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine x={currentTime} stroke="#ffffff" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="velocityMs"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#splitVelGrad)"
                    isAnimationActive={false}
                  />
                  <ReferenceDot x={currentTime} y={currentVel} r={4.5} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FLIGHT DURATION SCRUBBER & PLAYBACK CONTROLS
          ========================================================================= */}
      <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Play/Pause, Step & Speed Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                isPlaying
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20"
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Real-Time</span>
                </>
              )}
            </button>

            <button
              onClick={() => onIndexChange(0)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Reset to T+0s Liftoff"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Playback Speed Multipliers */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
              {[0.5, 1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onChangeSpeed(spd)}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Quick Jump to Key Milestones */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-500 text-[11px] mr-1 hidden sm:inline">Jump to:</span>
            <button
              onClick={() => jumpToMilestone(0)}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] transition-colors cursor-pointer"
            >
              Liftoff
            </button>
            <button
              onClick={() => jumpToMilestone(maxQIdx)}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[11px] transition-colors cursor-pointer"
            >
              Max-Q
            </button>
            <button
              onClick={() => jumpToMilestone(nPoints - 1)}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 text-[11px] transition-colors cursor-pointer"
            >
              Burnout
            </button>
          </div>
        </div>

        {/* Interactive Scrub Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span className="text-slate-500">Liftoff T+0.0s</span>
            <span className="text-cyan-400 font-bold">
              Flight Duration Scrubber: T+{currentTime.toFixed(1)}s ({((currentIdx / (nPoints - 1)) * 100).toFixed(0)}%)
            </span>
            <span className="text-slate-500">Burnout T+{trajectory.time[nPoints - 1].toFixed(1)}s</span>
          </div>

          <input
            type="range"
            min={0}
            max={nPoints - 1}
            value={currentIdx}
            onChange={(e) => onIndexChange(Number(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
