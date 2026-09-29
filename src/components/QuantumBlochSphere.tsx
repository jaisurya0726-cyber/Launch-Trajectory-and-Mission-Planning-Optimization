import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { QAOAResult } from "../types";
import {
  Atom,
  Rotate3d,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Activity,
  Sliders,
  Compass,
  CheckCircle2,
  Info,
  Maximize2,
  HelpCircle,
} from "lucide-react";

interface QuantumBlochSphereProps {
  qaoaResult: QAOAResult;
  layersP: number;
  gamma: number;
  beta: number;
}

const REGISTER_LABELS = [
  { index: 0, id: "q0", label: "q₀ · Win 1", group: "Launch Window", desc: "Window 1 (T+0 min)" },
  { index: 1, id: "q1", label: "q₁ · Win 2", group: "Launch Window", desc: "Window 2 (T+30 min)" },
  { index: 2, id: "q2", label: "q₂ · Win 3", group: "Launch Window", desc: "Window 3 (T+60 min)" },
  { index: 3, id: "q3", label: "q₃ · Traj 1", group: "Trajectory", desc: "Direct Ascent" },
  { index: 4, id: "q4", label: "q₄ · Traj 2", group: "Trajectory", desc: "Gravity Turn" },
  { index: 5, id: "q5", label: "q₅ · Traj 3", group: "Trajectory", desc: "Multi-Stage Transfer" },
  { index: 6, id: "q6", label: "q₆ · Mode 1", group: "Flight Mode", desc: "Nominal Throttle" },
  { index: 7, id: "q7", label: "q₇ · Mode 2", group: "Flight Mode", desc: "Max-Q Eco Throttle" },
  { index: 8, id: "q8", label: "q₈ · Mode 3", group: "Flight Mode", desc: "Fuel-Reserve Mode" },
];

export const QuantumBlochSphere: React.FC<QuantumBlochSphereProps> = ({
  qaoaResult,
  layersP,
  gamma,
  beta,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction State
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [activeStep, setActiveStep] = useState<number>(19); // Defaults to final converged step
  const [isPlayingOptimization, setIsPlayingOptimization] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [sphereRotation, setSphereRotation] = useState<{ rotX: number; rotY: number }>({
    rotX: 20, // Elevation angle in deg
    rotY: -35, // Azimuth angle in deg
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; rotX: number; rotY: number }>({
    x: 0,
    y: 0,
    rotX: 20,
    rotY: -35,
  });

  const bestBitstring = qaoaResult.best_bitstring || "100100100";
  const convergenceHistory = qaoaResult.convergence_history || [];
  const totalSteps = Math.max(1, convergenceHistory.length);

  // Compute Bloch Vector (theta, phi) for selected qubit at active step
  const stateVector = useMemo(() => {
    const targetBit = bestBitstring[selectedQubit] === "1" ? 1 : 0;
    const progress = totalSteps > 1 ? activeStep / (totalSteps - 1) : 1;

    // Initial state at step 0 is uniform superposition |+> with theta = pi/2, phi = 0
    // As QAOA converges, theta rotates towards target pole:
    // targetBit === 1 -> South pole |1> (theta -> pi)
    // targetBit === 0 -> North pole |0> (theta -> 0)
    const targetTheta = targetBit === 1 ? Math.PI * 0.92 : Math.PI * 0.08;
    const initialTheta = Math.PI / 2;

    // Smooth sigmoidal transition shaped by mixer parameter beta and layer count
    const easeProgress = (1 - Math.cos(progress * Math.PI)) / 2;
    const mixerFluctuation = Math.sin((activeStep + 1) * beta * 3.5) * (1 - progress) * 0.22;
    const theta = Math.max(0.04, Math.min(Math.PI - 0.04, initialTheta + (targetTheta - initialTheta) * easeProgress + mixerFluctuation));

    // Phase angle phi precesses driven by cost Hamiltonian parameter gamma
    const phi = (activeStep * gamma * 1.8 + selectedQubit * 0.65) % (Math.PI * 2);

    // Pauli Expectation Values
    // <X> = sin(theta) * cos(phi)
    // <Y> = sin(theta) * sin(phi)
    // <Z> = cos(theta)
    const expX = Math.sin(theta) * Math.cos(phi);
    const expY = Math.sin(theta) * Math.sin(phi);
    const expZ = Math.cos(theta);

    // Measurement Probabilities
    // P(|0>) = cos^2(theta/2)
    // P(|1>) = sin^2(theta/2)
    const prob0 = Math.cos(theta / 2) ** 2;
    const prob1 = Math.sin(theta / 2) ** 2;

    return {
      theta,
      phi,
      thetaDeg: Math.round((theta * 180) / Math.PI),
      phiDeg: Math.round((phi * 180) / Math.PI),
      expX: Number(expX.toFixed(3)),
      expY: Number(expY.toFixed(3)),
      expZ: Number(expZ.toFixed(3)),
      prob0: Number((prob0 * 100).toFixed(1)),
      prob1: Number((prob1 * 100).toFixed(1)),
      targetBit,
    };
  }, [selectedQubit, activeStep, bestBitstring, totalSteps, gamma, beta]);

  // Compute optimization trajectory history trail on the Bloch sphere
  const trajectoryTrail = useMemo(() => {
    const targetBit = bestBitstring[selectedQubit] === "1" ? 1 : 0;
    const targetTheta = targetBit === 1 ? Math.PI * 0.92 : Math.PI * 0.08;
    const initialTheta = Math.PI / 2;

    const points: Array<{ x: number; y: number; z: number }> = [];

    for (let k = 0; k <= activeStep; k++) {
      const p = totalSteps > 1 ? k / (totalSteps - 1) : 1;
      const easeP = (1 - Math.cos(p * Math.PI)) / 2;
      const mFluc = Math.sin((k + 1) * beta * 3.5) * (1 - p) * 0.22;
      const th = Math.max(0.04, Math.min(Math.PI - 0.04, initialTheta + (targetTheta - initialTheta) * easeP + mFluc));
      const ph = (k * gamma * 1.8 + selectedQubit * 0.65) % (Math.PI * 2);

      points.push({
        x: Math.sin(th) * Math.cos(ph),
        y: Math.sin(th) * Math.sin(ph),
        z: Math.cos(th),
      });
    }

    return points;
  }, [selectedQubit, activeStep, bestBitstring, totalSteps, gamma, beta]);

  // Step Animation Playback
  useEffect(() => {
    if (!isPlayingOptimization) return;

    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= totalSteps - 1) {
          setIsPlayingOptimization(false);
          return totalSteps - 1;
        }
        return prev + 1;
      });
    }, 280);

    return () => clearInterval(timer);
  }, [isPlayingOptimization, totalSteps]);

  // Auto-Rotate Sphere
  useEffect(() => {
    if (!autoRotate || isDragging) return;

    let animId: number;
    const animate = () => {
      setSphereRotation((prev) => ({
        ...prev,
        rotY: (prev.rotY + 0.35) % 360,
      }));
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [autoRotate, isDragging]);

  // 3D Canvas Projection Function
  const project3D = useCallback(
    (
      x: number,
      y: number,
      z: number,
      centerX: number,
      centerY: number,
      radius: number,
      rotX: number,
      rotY: number
    ) => {
      const radX = (rotX * Math.PI) / 180;
      const radY = (rotY * Math.PI) / 180;

      // Rotate around Y axis
      const x1 = x * Math.cos(radY) + y * Math.sin(radY);
      const y1 = -x * Math.sin(radY) + y * Math.cos(radY);
      const z1 = z;

      // Rotate around X axis
      const x2 = x1;
      const y2 = y1 * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y1 * Math.sin(radX) + z1 * Math.cos(radX);

      // Depth perspective projection
      const cameraDistance = 3.2;
      const scale = cameraDistance / (cameraDistance - y2);

      return {
        px: centerX + x2 * radius * scale,
        py: centerY - z2 * radius * scale,
        depth: y2, // For back-to-front rendering order
      };
    },
    []
  );

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.72;

    ctx.clearRect(0, 0, width, height);

    const { rotX, rotY } = sphereRotation;

    // 1. Draw Sphere Outer Rim & Atmospheric Glow
    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * 1.15);
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.08)");
    gradient.addColorStop(0.7, "rgba(14, 165, 233, 0.04)");
    gradient.addColorStop(1, "rgba(2, 6, 23, 0.0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Sphere Boundary Circle
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Draw Equator Circle (XY plane where z = 0)
    const equatorSegments = 64;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (let i = 0; i <= equatorSegments; i++) {
      const angle = (i / equatorSegments) * Math.PI * 2;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const { px, py } = project3D(x, y, 0, centerX, centerY, radius, rotX, rotY);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Prime Meridian Circle (XZ plane where y = 0)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (let i = 0; i <= equatorSegments; i++) {
      const angle = (i / equatorSegments) * Math.PI * 2;
      const x = Math.sin(angle);
      const z = Math.cos(angle);
      const { px, py } = project3D(x, 0, z, centerX, centerY, radius, rotX, rotY);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Draw Coordinate Axes (X, Y, Z)
    const axes = [
      { name: "|+⟩ (+X)", x: 1.15, y: 0, z: 0, color: "#38bdf8" },
      { name: "|-⟩ (-X)", x: -1.15, y: 0, z: 0, color: "rgba(148, 163, 184, 0.5)" },
      { name: "|+i⟩ (+Y)", x: 0, y: 1.15, z: 0, color: "#a855f7" },
      { name: "|-i⟩ (-Y)", x: 0, y: -1.15, z: 0, color: "rgba(148, 163, 184, 0.5)" },
      { name: "|0⟩ (+Z)", x: 0, y: 0, z: 1.18, color: "#10b981", isPole: true },
      { name: "|1⟩ (-Z)", x: 0, y: 0, z: -1.18, color: "#f59e0b", isPole: true },
    ];

    axes.forEach((axis) => {
      const { px: originX, py: originY } = project3D(0, 0, 0, centerX, centerY, radius, rotX, rotY);
      const { px: endX, py: endY, depth } = project3D(axis.x, axis.y, axis.z, centerX, centerY, radius, rotX, rotY);

      ctx.beginPath();
      ctx.strokeStyle = depth < -0.2 ? "rgba(100, 116, 139, 0.25)" : "rgba(100, 116, 139, 0.55)";
      ctx.lineWidth = axis.isPole ? 1.5 : 1;
      ctx.moveTo(originX, originY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Axis endpoint dot
      ctx.fillStyle = axis.color;
      ctx.beginPath();
      ctx.arc(endX, endY, axis.isPole ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Axis label
      ctx.fillStyle = axis.color;
      ctx.font = axis.isPole ? "bold 11px monospace" : "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(axis.name, endX, endY - 6);
    });

    // 5. Draw Optimization Trajectory Trail on Bloch Sphere
    if (trajectoryTrail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(6, 182, 212, 0.45)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 2]);

      trajectoryTrail.forEach((pt, idx) => {
        const { px, py } = project3D(pt.x, pt.y, pt.z, centerX, centerY, radius, rotX, rotY);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 6. Draw Current State Vector |ψ⟩
    const stateX = Math.sin(stateVector.theta) * Math.cos(stateVector.phi);
    const stateY = Math.sin(stateVector.theta) * Math.sin(stateVector.phi);
    const stateZ = Math.cos(stateVector.theta);

    const { px: originX, py: originY } = project3D(0, 0, 0, centerX, centerY, radius, rotX, rotY);
    const { px: tipX, py: tipY } = project3D(stateX, stateY, stateZ, centerX, centerY, radius, rotX, rotY);

    // Equatorial Plane Shadow Projection
    const { px: shadowX, py: shadowY } = project3D(stateX, stateY, 0, centerX, centerY, radius, rotX, rotY);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
    ctx.setLineDash([2, 3]);
    ctx.moveTo(originX, originY);
    ctx.lineTo(shadowX, shadowY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Vector Shaft with Glow
    ctx.beginPath();
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#06b6d4";
    ctx.shadowBlur = 10;
    ctx.moveTo(originX, originY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Vector Tip Sphere (Bright glowing indicator)
    ctx.fillStyle = stateVector.targetBit === 1 ? "#f59e0b" : "#10b981";
    ctx.beginPath();
    ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Callout Label over Tip
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`|ψ⟩`, tipX + 9, tipY + 4);
  }, [sphereRotation, stateVector, trajectoryTrail, project3D]);

  // Mouse / Touch Drag to Rotate Sphere in 3D
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX: sphereRotation.rotX,
      rotY: sphereRotation.rotY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    setSphereRotation({
      rotX: Math.max(-85, Math.min(85, dragStartRef.current.rotX - deltaY * 0.4)),
      rotY: (dragStartRef.current.rotY + deltaX * 0.4) % 360,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setSphereRotation({ rotX: 20, rotY: -35 });
  };

  const activeQubitMeta = REGISTER_LABELS[selectedQubit];

  return (
    <div className="p-5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-4 shadow-2xl">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <Atom className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Quantum State Bloch Sphere Visualizer</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/70 bg-cyan-950/60 text-cyan-300">
                SU(2) Qubit Superposition Space
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans">
              Interactive 3D Bloch sphere representation of single-qubit density operators across the QAOA variational optimization phase
            </div>
          </div>
        </div>

        {/* View Controls & Auto-Rotation Toggle */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              autoRotate
                ? "bg-cyan-950 text-cyan-300 border-cyan-700/80 font-bold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <Rotate3d className="w-3.5 h-3.5" />
            <span>Auto-Spin: {autoRotate ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={resetView}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Reset sphere 3D orientation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* 9-Qubit Register Selector Pills */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Select Qubit Register (Decision Variable):</span>
          <span className="text-cyan-400 font-semibold">{activeQubitMeta.desc} ({activeQubitMeta.group})</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
          {REGISTER_LABELS.map((q) => {
            const isSelected = selectedQubit === q.index;
            const targetBit = bestBitstring[q.index] === "1" ? "1" : "0";
            return (
              <button
                key={q.id}
                onClick={() => setSelectedQubit(q.index)}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-cyan-950 text-cyan-200 border-cyan-500 shadow-md shadow-cyan-500/10 font-bold"
                    : "bg-slate-950/70 text-slate-400 border-slate-800/80 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>{q.id}</span>
                  <span
                    className={`text-[9px] px-1 rounded ${
                      targetBit === "1" ? "bg-amber-950 text-amber-300 font-bold" : "bg-emerald-950 text-emerald-300"
                    }`}
                  >
                    |{targetBit}⟩
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5 font-sans">{q.label.split("· ")[1]}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: 3D Bloch Canvas & State Telemetry Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 3D Canvas Column (7 Cols on LG) */}
        <div className="lg:col-span-7 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono px-2">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D Bloch Sphere [Drag to rotate view]</span>
            </span>
            <span className="text-[10px] text-slate-500">
              RotX: {Math.round(sphereRotation.rotX)}° · RotY: {Math.round(sphereRotation.rotY)}°
            </span>
          </div>

          {/* Interactive Canvas Container */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-80 flex items-center justify-center cursor-grab active:cursor-grabbing select-none relative"
          >
            <canvas
              ref={canvasRef}
              width={480}
              height={320}
              className="max-w-full max-h-full"
            />

            {/* Canvas Bottom Legend Overlay */}
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-slate-400 pointer-events-none">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span>North: |0⟩ Basis</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span>South: |1⟩ Basis</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                <span>Vector: |ψ({activeQubitMeta.id})⟩</span>
              </span>
            </div>
          </div>

          {/* Optimization Step Scrubber & Playback Controls */}
          <div className="p-2.5 bg-slate-900/70 rounded-lg border border-slate-800/80 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlayingOptimization(!isPlayingOptimization)}
                  className="p-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors cursor-pointer"
                  title={isPlayingOptimization ? "Pause step animation" : "Play step convergence"}
                >
                  {isPlayingOptimization ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <span className="text-slate-300">
                  Optimization Step: <strong>k={activeStep + 1}</strong> / {totalSteps}
                </span>
              </div>

              <span className="text-[10px] text-cyan-300">
                {activeStep === 0
                  ? "Hadamard Initial Superposition |+⟩"
                  : activeStep === totalSteps - 1
                  ? "Converged Quantum Ground State"
                  : "Variational Unitary Evolution"}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              value={activeStep}
              onChange={(e) => setActiveStep(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Quantum Statevector Telemetry Column (5 Cols on LG) */}
        <div className="lg:col-span-5 bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 space-y-3.5 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                <span>Statevector Diagnostics</span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans">
                Register {activeQubitMeta.id} · {activeQubitMeta.desc}
              </span>
            </div>

            <span
              className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${
                stateVector.targetBit === 1
                  ? "bg-amber-950 text-amber-300 border-amber-800"
                  : "bg-emerald-950 text-emerald-300 border-emerald-800"
              }`}
            >
              Target State: |{stateVector.targetBit}⟩
            </span>
          </div>

          {/* Mathematical State Representation */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[10px] block">SUPERPOSITION STATE FORMULA</span>
            <div className="text-sm text-cyan-300 font-bold tabular-nums">
              |ψ⟩ = {Math.cos(stateVector.theta / 2).toFixed(3)}|0⟩ + {Math.sin(stateVector.theta / 2).toFixed(3)}e<sup>i{stateVector.phiDeg}°</sup>|1⟩
            </div>
            <div className="text-[10px] text-slate-500 font-sans mt-0.5">
              Parameterized polar angle θ and azimuthal phase angle φ
            </div>
          </div>

          {/* Spherical Coordinates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block">POLAR ANGLE θ</span>
              <span className="text-base font-bold text-white tabular-nums">{stateVector.thetaDeg}°</span>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {stateVector.thetaDeg < 45 ? "North Pole (|0⟩ bias)" : stateVector.thetaDeg > 135 ? "South Pole (|1⟩ bias)" : "Equatorial Superposition"}
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block">PHASE ANGLE φ</span>
              <span className="text-base font-bold text-amber-400 tabular-nums">{stateVector.phiDeg}°</span>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Phase unitary rotation
              </div>
            </div>
          </div>

          {/* Measurement Basis Probabilities */}
          <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800/70 space-y-2">
            <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center justify-between">
              <span>Z-Basis Measurement Probabilities</span>
              <span className="text-slate-500">P = |⟨i|ψ⟩|²</span>
            </div>

            {/* P(|0>) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-400 font-semibold">P(|0⟩): {stateVector.prob0}%</span>
                <span className="text-slate-400">cos²(θ/2)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-200"
                  style={{ width: `${stateVector.prob0}%` }}
                />
              </div>
            </div>

            {/* P(|1>) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-amber-400 font-semibold">P(|1⟩): {stateVector.prob1}%</span>
                <span className="text-slate-400">sin²(θ/2)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-200"
                  style={{ width: `${stateVector.prob1}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pauli Expectation Values <X>, <Y>, <Z> */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block">⟨X⟩</span>
              <span className="text-xs font-bold text-sky-400 tabular-nums">{stateVector.expX}</span>
            </div>
            <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block">⟨Y⟩</span>
              <span className="text-xs font-bold text-purple-400 tabular-nums">{stateVector.expY}</span>
            </div>
            <div className="p-2 bg-slate-900/50 rounded border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block">⟨Z⟩</span>
              <span className="text-xs font-bold text-emerald-400 tabular-nums">{stateVector.expZ}</span>
            </div>
          </div>

          {/* Theoretical Physics Insight Box */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1 text-[11px] font-sans text-slate-400">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quantum Adiabatic &amp; QAOA Mechanics:</span>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Under layers p={layersP}, the alternating application of the problem Hamiltonian U(C, γ) and transverse mixer U(B, β)
              drives constructive interference along the optimal flight configuration trajectory, rotating the state vector from
              maximum uncertainty at the equator (|0⟩ + |1⟩) towards the deterministic ground state pole |{stateVector.targetBit}⟩.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
