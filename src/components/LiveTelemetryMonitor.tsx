import React, { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Radio, Play, Pause, RotateCcw, AlertTriangle, Zap, Gauge, Thermometer, Wind, Wifi } from "lucide-react";
import { Mission } from "../types";

interface TelemetryPoint {
  timeStr: string;
  timestamp: number;
  pressure: number;     // kPa (Dynamic & Chamber Pressure)
  temperature: number;  // °C (Skin & Exhaust Heat)
  speed: number;        // m/s (Pitot & Inertial Airspeed)
  mach: number;         // Mach Number
}

interface LiveTelemetryMonitorProps {
  mission: Mission;
  baseAltitudeKm?: number;
  baseVelocityMs?: number;
}

export const LiveTelemetryMonitor: React.FC<LiveTelemetryMonitorProps> = ({
  mission,
  baseAltitudeKm = 45,
  baseVelocityMs = 1650,
}) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamRateMs, setStreamRateMs] = useState<number>(750); // 750ms interval
  const [selectedChannel, setSelectedChannel] = useState<"all" | "pressure" | "temperature" | "speed">("all");
  const [turbulenceActive, setTurbulenceActive] = useState<boolean>(false);

  // Time tracker
  const elapsedSecRef = useRef<number>(68.4); // Typical Max-Q transonic region

  // Generate initial history buffer
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>(() => {
    const list: TelemetryPoint[] = [];
    let t = 50.0;
    for (let i = 0; i < 20; i++) {
      const pNoise = (Math.sin(i * 0.8) * 3.5) + (Math.random() - 0.5) * 2.0;
      const tNoise = (Math.cos(i * 0.6) * 12.0) + (Math.random() - 0.5) * 8.0;
      const sNoise = (Math.sin(i * 0.4) * 25.0) + (Math.random() - 0.5) * 15.0;

      const pVal = Number((68.5 + pNoise).toFixed(1));
      const tVal = Number((540.0 + tNoise + i * 4.5).toFixed(1));
      const sVal = Number((baseVelocityMs - 200 + i * 18.0 + sNoise).toFixed(0));

      list.push({
        timeStr: `T+${t.toFixed(1)}s`,
        timestamp: t,
        pressure: pVal,
        temperature: tVal,
        speed: sVal,
        mach: Number((sVal / 310.0).toFixed(2)),
      });
      t += 1.0;
    }
    elapsedSecRef.current = t;
    return list;
  });

  // Current latest reading
  const latest = telemetryHistory[telemetryHistory.length - 1] || {
    timeStr: "T+70.0s",
    timestamp: 70.0,
    pressure: 68.5,
    temperature: 580.0,
    speed: baseVelocityMs,
    mach: Number((baseVelocityMs / 310.0).toFixed(2)),
  };

  // Live polling streaming effect
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      elapsedSecRef.current = Number((elapsedSecRef.current + streamRateMs / 1000).toFixed(1));
      const curT = elapsedSecRef.current;

      setTelemetryHistory((prev) => {
        const last = prev[prev.length - 1];
        const mult = turbulenceActive ? 3.0 : 1.0;

        // Dynamic fluctuations with mean reversion
        const pFluct = ((Math.random() - 0.48) * 3.2 * mult) + (Math.sin(curT * 1.5) * 1.8);
        const tFluct = ((Math.random() - 0.46) * 8.5 * mult) + (Math.cos(curT * 0.8) * 4.0);
        const sFluct = ((Math.random() - 0.45) * 18.0 * mult) + 4.5; // slight continuous acceleration

        const newPressure = Math.max(12.0, Number((last.pressure * 0.94 + 72.0 * 0.06 + pFluct).toFixed(1)));
        const newTemp = Math.max(120.0, Number((last.temperature * 0.96 + 620.0 * 0.04 + tFluct).toFixed(1)));
        const newSpeed = Math.max(300.0, Number((last.speed + sFluct).toFixed(0)));
        const newMach = Number((newSpeed / 305.0).toFixed(2));

        const newPoint: TelemetryPoint = {
          timeStr: `T+${curT.toFixed(1)}s`,
          timestamp: curT,
          pressure: newPressure,
          temperature: newTemp,
          speed: newSpeed,
          mach: newMach,
        };

        // Maintain fixed sliding window buffer of 22 data points
        const updated = [...prev.slice(prev.length >= 22 ? 1 : 0), newPoint];
        return updated;
      });
    }, streamRateMs);

    return () => clearInterval(interval);
  }, [isStreaming, streamRateMs, turbulenceActive]);

  // Status limits check
  const isPressureHigh = latest.pressure > 78.0;
  const isTempHigh = latest.temperature > 720.0;

  return (
    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
      {/* Telemetry Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
            {isStreaming && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Real-Time Vehicle Telemetry Monitor</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-800/80 bg-emerald-950/70 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {isStreaming ? "PCM DOWNLINK ACTIVE (2.4 GHz)" : "STREAM PAUSED"}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans">
              Live streaming sensor telemetry simulating dynamic pressure, skin temperature, and airspeed fluctuations
            </div>
          </div>
        </div>

        {/* Stream Rate & Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Polling Rate */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {[
              { label: "1.0s", ms: 1000 },
              { label: "0.5s", ms: 500 },
              { label: "0.25s", ms: 250 },
            ].map((rate) => (
              <button
                key={rate.ms}
                onClick={() => setStreamRateMs(rate.ms)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  streamRateMs === rate.ms
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {rate.label}
              </button>
            ))}
          </div>

          {/* Turbulence Spike Trigger */}
          <button
            onClick={() => setTurbulenceActive(!turbulenceActive)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
              turbulenceActive
                ? "bg-amber-950/80 text-amber-300 border-amber-700/80"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="Inject atmospheric buffeting / sensor turbulence"
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{turbulenceActive ? "Turbulence ON" : "Turbulence"}</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              isStreaming
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Sensor Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Dynamic & Chamber Pressure */}
        <div
          onClick={() => setSelectedChannel(selectedChannel === "pressure" ? "all" : "pressure")}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            selectedChannel === "pressure" || selectedChannel === "all"
              ? "bg-slate-950/80 border-cyan-800/80 shadow-sm shadow-cyan-500/10"
              : "bg-slate-950/40 border-slate-800/60 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Gauge className="w-4 h-4" />
              <span>DYNAMIC PRESSURE (q)</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
              isPressureHigh ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-cyan-950 text-cyan-300 border-cyan-800/60"
            }`}>
              {isPressureHigh ? "HIGH BUFFET" : "NOMINAL"}
            </span>
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {latest.pressure.toFixed(1)} <span className="text-xs text-slate-400 font-sans">kPa</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
            <span>Range: 60.0 – 85.0 kPa</span>
            <span className="text-cyan-400">Sensor: PITOT-Q1</span>
          </div>
        </div>

        {/* Skin & Aerodynamic Temperature */}
        <div
          onClick={() => setSelectedChannel(selectedChannel === "temperature" ? "all" : "temperature")}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            selectedChannel === "temperature" || selectedChannel === "all"
              ? "bg-slate-950/80 border-rose-800/80 shadow-sm shadow-rose-500/10"
              : "bg-slate-950/40 border-slate-800/60 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-rose-400">
              <Thermometer className="w-4 h-4" />
              <span>SKIN / FAIRING TEMP</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
              isTempHigh ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-emerald-950 text-emerald-300 border-emerald-800/60"
            }`}>
              {isTempHigh ? "THERMAL PEAK" : "STABLE"}
            </span>
          </div>
          <div className="text-2xl font-mono font-bold text-rose-400 mt-1 tabular-nums">
            {latest.temperature.toFixed(1)} <span className="text-xs text-slate-400 font-sans">°C</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
            <span>Limit: 950.0 °C</span>
            <span className="text-rose-400">TC-NOZ-04</span>
          </div>
        </div>

        {/* Airspeed & Mach Number */}
        <div
          onClick={() => setSelectedChannel(selectedChannel === "speed" ? "all" : "speed")}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            selectedChannel === "speed" || selectedChannel === "all"
              ? "bg-slate-950/80 border-emerald-800/80 shadow-sm shadow-emerald-500/10"
              : "bg-slate-950/40 border-slate-800/60 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Zap className="w-4 h-4" />
              <span>AIRSPEED / INERTIAL</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded border bg-emerald-950 text-emerald-300 border-emerald-800/60 font-mono">
              Mach {latest.mach.toFixed(1)}
            </span>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
            {latest.speed.toLocaleString()} <span className="text-xs text-slate-400 font-sans">m/s</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
            <span>IMU Filtered Velocity</span>
            <span className="text-emerald-400">INS-PRIMARY</span>
          </div>
        </div>
      </div>

      {/* Channel Selector Filter Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs font-mono border-t border-slate-800/80 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 mr-1">Display Channel:</span>
          {[
            { id: "all", label: "Multi-Sensor Stream (All)" },
            { id: "pressure", label: "Pressure Only (kPa)" },
            { id: "temperature", label: "Temperature Only (°C)" },
            { id: "speed", label: "Airspeed Only (m/s)" },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id as any)}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedChannel === ch.id
                  ? "bg-slate-800 text-cyan-300 font-bold border border-slate-700"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span>Downlink RSSI: -67 dBm · Packet Loss: 0.01% · Buffer: {telemetryHistory.length} pts</span>
        </div>
      </div>

      {/* Recharts Streaming Line Chart */}
      <div className="h-64 w-full bg-slate-950/70 rounded-xl border border-slate-800/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={telemetryHistory} margin={{ top: 10, right: 25, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

            <XAxis
              dataKey="timeStr"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
            />

            {/* Left Y-Axis for Pressure or Single Channels */}
            {selectedChannel === "pressure" ? (
              <YAxis
                stroke="#06b6d4"
                domain={[50, 95]}
                tick={{ fill: "#06b6d4", fontSize: 10, fontFamily: "monospace" }}
                tickFormatter={(v) => `${v} kPa`}
              />
            ) : selectedChannel === "temperature" ? (
              <YAxis
                stroke="#f43f5e"
                domain={[450, 850]}
                tick={{ fill: "#f43f5e", fontSize: 10, fontFamily: "monospace" }}
                tickFormatter={(v) => `${v} °C`}
              />
            ) : selectedChannel === "speed" ? (
              <YAxis
                stroke="#10b981"
                domain={["auto", "auto"]}
                tick={{ fill: "#10b981", fontSize: 10, fontFamily: "monospace" }}
                tickFormatter={(v) => `${v} m/s`}
              />
            ) : (
              // Multi-Channel Normalized View
              <YAxis
                stroke="#64748b"
                domain={["auto", "auto"]}
                tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as TelemetryPoint;
                  return (
                    <div className="p-3 bg-slate-950/95 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-md text-xs font-mono space-y-1.5 min-w-[210px]">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1 text-slate-300">
                        <span className="font-bold text-emerald-400">{d.timeStr}</span>
                        <span className="text-[10px] text-slate-500">Mach {d.mach}</span>
                      </div>
                      <div className="flex justify-between items-center text-cyan-300">
                        <span>Pressure (q):</span>
                        <span className="font-bold tabular-nums">{d.pressure} kPa</span>
                      </div>
                      <div className="flex justify-between items-center text-rose-400">
                        <span>Skin Temp:</span>
                        <span className="font-bold tabular-nums">{d.temperature} °C</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400">
                        <span>Airspeed:</span>
                        <span className="font-bold tabular-nums">{d.speed.toLocaleString()} m/s</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "5px" }} />

            {(selectedChannel === "all" || selectedChannel === "pressure") && (
              <Line
                type="monotone"
                dataKey="pressure"
                name="Pressure (kPa)"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {(selectedChannel === "all" || selectedChannel === "temperature") && (
              <Line
                type="monotone"
                dataKey="temperature"
                name="Temperature (°C)"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {(selectedChannel === "all" || selectedChannel === "speed") && (
              <Line
                type="monotone"
                dataKey="speed"
                name="Speed (m/s)"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
