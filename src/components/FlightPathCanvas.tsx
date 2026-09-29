import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Mission, TrajectoryData } from "../types";
import {
  SeasonalProfileId,
  SEASONAL_PROFILES,
  getActiveSeasonalProfile,
  calculateDensityAtAltitude,
  getDensityColor,
} from "../lib/atmosphere";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Gauge,
  Sparkles,
  Navigation,
  Layers,
  Compass,
  Wind,
  Thermometer,
  CloudRain,
  Sun,
  Snowflake,
  Eye,
  EyeOff,
  Sliders,
  Activity,
  GitCompare,
} from "lucide-react";

export interface ComparisonRunConfig {
  id: string;
  label: string;
  mission: Mission;
  trajectory: TrajectoryData;
  color: string;
}

export interface TrajectoryComparisonOverlay {
  enabled: boolean;
  runA: ComparisonRunConfig;
  runB: ComparisonRunConfig;
}

interface FlightPathCanvasProps {
  mission: Mission;
  trajectory: TrajectoryData;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  envelopeTrajectories?: Array<{
    deg: number;
    label: string;
    color: string;
    dashArray: string;
    data: TrajectoryData;
  }>;
  showEnvelope?: boolean;
  seasonalProfileId?: SeasonalProfileId;
  onSelectSeasonalProfile?: (id: SeasonalProfileId) => void;
  showDensityHeatmap?: boolean;
  onToggleDensityHeatmap?: () => void;
  densityHeatmapOpacity?: number;
  onChangeDensityHeatmapOpacity?: (opacity: number) => void;
  targetAltitudeKm?: number;
  onChangeTargetAltitudeKm?: (alt: number) => void;
  comparisonOverlay?: TrajectoryComparisonOverlay;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
}

export const FlightPathCanvas: React.FC<FlightPathCanvasProps> = ({
  mission,
  trajectory,
  currentIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  envelopeTrajectories = [],
  showEnvelope = true,
  seasonalProfileId,
  onSelectSeasonalProfile,
  showDensityHeatmap,
  onToggleDensityHeatmap,
  densityHeatmapOpacity,
  onChangeDensityHeatmapOpacity,
  targetAltitudeKm,
  onChangeTargetAltitudeKm,
  comparisonOverlay,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const particlesRef = useRef<Particle[]>([]);

  // Internal state fallbacks if not controlled by parent
  const [internalShowHeatmap, setInternalShowHeatmap] = useState<boolean>(true);
  const [internalProfileId, setInternalProfileId] = useState<SeasonalProfileId>("auto");
  const [internalOpacity, setInternalOpacity] = useState<number>(0.45);
  const [internalTargetAlt, setInternalTargetAlt] = useState<number>(mission.altitude);

  const activeShowHeatmap = showDensityHeatmap !== undefined ? showDensityHeatmap : internalShowHeatmap;
  const toggleHeatmap = onToggleDensityHeatmap || (() => setInternalShowHeatmap((prev) => !prev));

  const activeProfileId = seasonalProfileId !== undefined ? seasonalProfileId : internalProfileId;
  const setProfileId = onSelectSeasonalProfile || setInternalProfileId;

  const activeOpacity = densityHeatmapOpacity !== undefined ? densityHeatmapOpacity : internalOpacity;
  const setOpacity = onChangeDensityHeatmapOpacity || setInternalOpacity;

  const activeTargetAltitude = targetAltitudeKm !== undefined ? targetAltitudeKm : internalTargetAlt;
  const setTargetAltitude = onChangeTargetAltitudeKm || setInternalTargetAlt;

  // Active seasonal weather profile
  const activeProfile = useMemo(() => {
    return getActiveSeasonalProfile(activeProfileId, mission);
  }, [activeProfileId, mission]);

  // Track dimensions
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 900,
    height: 440,
  });

  // Keep currentIndex updated in ref for smooth animation loop
  const currentIndexRef = useRef<number>(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const nPoints = trajectory.time.length;

  // Current vehicle density
  const currentVehicleAltitudeKm = trajectory.altitude_km[currentIndex] || 0;
  const currentVehicleDensity = useMemo(() => {
    return calculateDensityAtAltitude(currentVehicleAltitudeKm * 1000, activeProfile);
  }, [currentVehicleAltitudeKm, activeProfile]);
  const currentDensityPct = activeProfile.surfaceDensityKgM3 > 0
    ? ((currentVehicleDensity / activeProfile.surfaceDensityKgM3) * 100).toFixed(2)
    : "0.00";

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        const targetHeight = Math.max(380, Math.min(500, Math.round(clientWidth * 0.46)));
        setDimensions({
          width: clientWidth,
          height: targetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Compute domain bounds (encompassing comparison runs if active)
  const maxDownrange = useMemo(() => {
    let nominalMax = Math.max(...trajectory.downrange_km, 50);
    if (comparisonOverlay?.enabled) {
      nominalMax = Math.max(
        nominalMax,
        ...comparisonOverlay.runA.trajectory.downrange_km,
        ...comparisonOverlay.runB.trajectory.downrange_km,
        50
      );
    }
    const envMax = envelopeTrajectories.length
      ? Math.max(...envelopeTrajectories.map((e) => Math.max(...e.data.downrange_km, 50)))
      : nominalMax;
    return Math.max(nominalMax, envMax, 80) * 1.08;
  }, [trajectory, envelopeTrajectories, comparisonOverlay]);

  const maxAltitude = useMemo(() => {
    let nominalMax = Math.max(...trajectory.altitude_km, activeTargetAltitude, mission.altitude, 100);
    if (comparisonOverlay?.enabled) {
      nominalMax = Math.max(
        nominalMax,
        ...comparisonOverlay.runA.trajectory.altitude_km,
        ...comparisonOverlay.runB.trajectory.altitude_km,
        comparisonOverlay.runA.mission.altitude,
        comparisonOverlay.runB.mission.altitude,
        100
      );
    }
    const envMax = envelopeTrajectories.length
      ? Math.max(...envelopeTrajectories.map((e) => Math.max(...e.data.altitude_km, 100)))
      : nominalMax;
    return Math.max(nominalMax, envMax, activeTargetAltitude * 1.15, 120);
  }, [trajectory, envelopeTrajectories, mission, activeTargetAltitude, comparisonOverlay]);

  // Coordinate transforms
  const padding = { left: 75, right: 65, top: 40, bottom: 55 };

  const getCanvasCoords = useCallback(
    (xKm: number, hKm: number, width: number, height: number) => {
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = height - padding.top - padding.bottom;

      const cx = padding.left + (Math.max(0, xKm) / maxDownrange) * plotWidth;
      const cy = height - padding.bottom - (Math.max(0, hKm) / maxAltitude) * plotHeight;
      return { cx, cy };
    },
    [maxDownrange, maxAltitude, padding.left, padding.right, padding.top, padding.bottom]
  );

  // Generate fixed background stars
  const stars = useMemo(() => {
    const list: Array<{ x: number; y: number; r: number; alpha: number }> = [];
    for (let i = 0; i < 70; i++) {
      list.push({
        x: Math.random(),
        y: Math.random() * 0.65, // upper space region
        r: Math.random() * 1.2 + 0.4,
        alpha: Math.random() * 0.6 + 0.2,
      });
    }
    return list;
  }, []);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localIdx = currentIndexRef.current;

    const render = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Handle continuous playback progression
      if (isPlaying && nPoints > 1) {
        // Step forward in time based on playback speed
        const stepRate = 12 * playbackSpeed; // points per second
        localIdx = localIdx + stepRate * dt;

        if (localIdx >= nPoints - 1) {
          localIdx = nPoints - 1;
          onTogglePlay(); // pause at end
        }
        currentIndexRef.current = localIdx;
        onIndexChange(Math.min(nPoints - 1, Math.floor(localIdx)));
      }

      const activeIdx = Math.min(nPoints - 1, Math.floor(currentIndexRef.current));
      const width = dimensions.width;
      const height = dimensions.height;
      const dpr = window.devicePixelRatio || 1;

      // Scale canvas for retina display
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Space & Atmosphere Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#030712"); // vacuum deep space
      bgGrad.addColorStop(0.45, "#060e24"); // thermosphere
      bgGrad.addColorStop(0.7, "#0c1f42"); // stratosphere
      bgGrad.addColorStop(0.9, "#0e345c"); // troposphere
      bgGrad.addColorStop(1, "#07172b"); // Earth ground
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Atmospheric Density Heatmap Overlay (Updates by Launch Altitude & Seasonal Weather Profile)
      if (activeShowHeatmap) {
        const plotWidth = width - padding.left - padding.right;
        const groundY = height - padding.bottom;
        const topY = padding.top;

        // Create vertical gradient representing atmospheric density decay
        // from y = groundY (alt = 0 km) up to y = topY (alt = maxAltitude)
        const densityGrad = ctx.createLinearGradient(0, groundY, 0, topY);

        // Sample altitudes along vertical axis to construct high-fidelity non-linear gradient
        const sampleCount = 28;
        for (let i = 0; i <= sampleCount; i++) {
          const ratio = i / sampleCount; // 0 is ground (bottom), 1 is top (maxAltitude)
          const altKm = ratio * maxAltitude;
          const altM = altKm * 1000;
          const rho = calculateDensityAtAltitude(altM, activeProfile);
          const normalizedRho = Math.min(1.0, rho / Math.max(0.0001, activeProfile.surfaceDensityKgM3));

          const { r, g, b, a } = getDensityColor(normalizedRho, activeOpacity);
          densityGrad.addColorStop(ratio, `rgba(${r}, ${g}, ${b}, ${a})`);
        }

        ctx.fillStyle = densityGrad;
        ctx.fillRect(padding.left, topY, plotWidth, groundY - topY);

        // Density Isoline Contours
        const isolines = [
          { rho: 1.0, label: "ρ = 1.0 kg/m³ (Boundary Layer)", color: "rgba(56, 189, 248, 0.45)" },
          { rho: 0.5, label: "ρ = 0.5 kg/m³ (Troposphere ~7 km)", color: "rgba(34, 197, 94, 0.45)" },
          { rho: 0.1, label: "ρ = 0.1 kg/m³ (Max-Q Corridor ~19 km)", color: "rgba(234, 179, 8, 0.55)" },
          { rho: 0.01, label: "ρ = 0.01 kg/m³ (Upper Stratosphere ~35 km)", color: "rgba(249, 115, 22, 0.45)" },
          { rho: 0.001, label: "ρ = 0.001 kg/m³ (Mesosphere ~50 km)", color: "rgba(244, 63, 94, 0.35)" },
        ];

        isolines.forEach((iso) => {
          let lowM = 0;
          let highM = 90000;
          for (let iter = 0; iter < 12; iter++) {
            const midM = (lowM + highM) / 2;
            const rhoMid = calculateDensityAtAltitude(midM, activeProfile);
            if (rhoMid > iso.rho) {
              lowM = midM;
            } else {
              highM = midM;
            }
          }
          const isoAltKm = (lowM + highM) / 2000;

          if (isoAltKm <= maxAltitude) {
            const { cy } = getCanvasCoords(0, isoAltKm, width, height);
            ctx.beginPath();
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = iso.color;
            ctx.lineWidth = 1;
            ctx.moveTo(padding.left, cy);
            ctx.lineTo(width - padding.right, cy);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = iso.color;
            ctx.font = "9px monospace";
            ctx.textAlign = "left";
            ctx.fillText(iso.label, padding.left + 6, cy - 3);
          }
        });
      }

      // 3. Stars in Upper Thermosphere / Space
      stars.forEach((s) => {
        const sx = s.x * width;
        const sy = s.y * height;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fill();
      });

      // 4. Atmosphere Layer Band Guides
      // Kármán Line (100 km)
      if (100 <= maxAltitude) {
        const { cy: karmanY } = getCanvasCoords(0, 100, width, height);
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
        ctx.lineWidth = 1;
        ctx.moveTo(padding.left, karmanY);
        ctx.lineTo(width - padding.right, karmanY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
        ctx.font = "10px monospace";
        ctx.fillText("Kármán Line · 100 km (Boundary of Space)", padding.left + 8, karmanY - 4);
      }

      // Target Orbit (e.g. activeTargetAltitude or dual comparison targets)
      if (comparisonOverlay?.enabled) {
        const altA = comparisonOverlay.runA.mission.altitude;
        const altB = comparisonOverlay.runB.mission.altitude;

        // Target Orbit A
        if (altA <= maxAltitude) {
          const { cy: targetYA } = getCanvasCoords(0, altA, width, height);
          ctx.beginPath();
          ctx.setLineDash([6, 3]);
          ctx.strokeStyle = comparisonOverlay.runA.color;
          ctx.lineWidth = 1.5;
          ctx.moveTo(padding.left, targetYA);
          ctx.lineTo(width - padding.right, targetYA);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = comparisonOverlay.runA.color;
          ctx.font = "10px monospace";
          ctx.fillText(`Target Orbit A [${comparisonOverlay.runA.label}] · ${altA} km`, width - padding.right - 230, targetYA - 5);
        }

        // Target Orbit B (if different)
        if (altB <= maxAltitude && Math.abs(altB - altA) > 5) {
          const { cy: targetYB } = getCanvasCoords(0, altB, width, height);
          ctx.beginPath();
          ctx.setLineDash([6, 3]);
          ctx.strokeStyle = comparisonOverlay.runB.color;
          ctx.lineWidth = 1.5;
          ctx.moveTo(padding.left, targetYB);
          ctx.lineTo(width - padding.right, targetYB);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = comparisonOverlay.runB.color;
          ctx.font = "10px monospace";
          ctx.fillText(`Target Orbit B [${comparisonOverlay.runB.label}] · ${altB} km`, width - padding.right - 230, targetYB - 5);
        }
      } else if (activeTargetAltitude <= maxAltitude) {
        const { cy: targetY } = getCanvasCoords(0, activeTargetAltitude, width, height);
        ctx.beginPath();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(padding.left, targetY);
        ctx.lineTo(width - padding.right, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(245, 158, 11, 0.85)";
        ctx.font = "10px monospace";
        ctx.fillText(`Target Orbit · ${mission.target_orbit} (${activeTargetAltitude} km)`, width - padding.right - 210, targetY - 5);
      }

      // 4. Ground Curvature & Launch Pad
      const { cy: groundY } = getCanvasCoords(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.moveTo(padding.left, groundY);
      ctx.lineTo(width - padding.right, groundY);
      ctx.stroke();

      // Launch Pad Tower
      const { cx: padX } = getCanvasCoords(0, 0, width, height);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(padX - 3, groundY - 14, 6, 14);
      ctx.fillRect(padX - 8, groundY - 2, 16, 2);

      // 5. Grid Axes & Labels
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;

      // Vertical Altitude Ticks
      const altStep = maxAltitude > 400 ? 100 : maxAltitude > 150 ? 50 : 25;
      for (let alt = altStep; alt <= maxAltitude; alt += altStep) {
        const { cy } = getCanvasCoords(0, alt, width, height);
        ctx.beginPath();
        ctx.moveTo(padding.left - 5, cy);
        ctx.lineTo(width - padding.right, cy);
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${alt} km`, padding.left - 8, cy + 3);
      }

      // Horizontal Downrange Ticks
      const downrangeStep = maxDownrange > 600 ? 150 : maxDownrange > 300 ? 100 : 50;
      for (let dr = downrangeStep; dr <= maxDownrange; dr += downrangeStep) {
        const { cx } = getCanvasCoords(dr, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(cx, groundY);
        ctx.lineTo(cx, groundY + 5);
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${dr} km`, cx, groundY + 18);
      }
      ctx.textAlign = "left";

      // Axes Titles
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.fillText("Altitude (km)", padding.left, padding.top - 12);
      ctx.textAlign = "right";
      ctx.fillText("Downrange Distance (km)", width - padding.right, groundY + 36);
      ctx.textAlign = "left";

      // 6. Stability Envelope Trajectories (Faint ghosted corridors)
      if (showEnvelope && envelopeTrajectories.length > 0) {
        envelopeTrajectories.forEach((env) => {
          if (env.deg === 0) return; // Nominal drawn separately
          const pts = env.data;
          ctx.beginPath();
          ctx.strokeStyle = env.color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.globalAlpha = 0.45;

          for (let i = 0; i < pts.time.length; i++) {
            const { cx, cy } = getCanvasCoords(pts.downrange_km[i], pts.altitude_km[i], width, height);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
          ctx.globalAlpha = 1.0;
          ctx.setLineDash([]);
        });
      }

      // 7. Future & Traveled Trajectory Arcs
      if (comparisonOverlay?.enabled) {
        const { runA, runB } = comparisonOverlay;
        const ptsA = runA.trajectory;
        const ptsB = runB.trajectory;

        // Run A Future Arc (Dashed Line)
        ctx.beginPath();
        ctx.strokeStyle = `${runA.color}40`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        for (let i = 0; i < ptsA.time.length; i++) {
          const { cx, cy } = getCanvasCoords(ptsA.downrange_km[i], ptsA.altitude_km[i], width, height);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Run A Traveled Arc (Glowing Solid Line)
        const curIdxA = Math.min(ptsA.time.length - 1, activeIdx);
        if (curIdxA > 0) {
          ctx.beginPath();
          ctx.strokeStyle = runA.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = runA.color;
          ctx.shadowBlur = 8;
          for (let i = 0; i <= curIdxA; i++) {
            const { cx, cy } = getCanvasCoords(ptsA.downrange_km[i], ptsA.altitude_km[i], width, height);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Run A Apogee Marker
        const apogeeIdxA = ptsA.altitude_km.indexOf(ptsA.summary.max_altitude_km);
        if (apogeeIdxA >= 0) {
          const { cx: aX, cy: aY } = getCanvasCoords(ptsA.downrange_km[apogeeIdxA], ptsA.altitude_km[apogeeIdxA], width, height);
          ctx.fillStyle = runA.color;
          ctx.beginPath();
          ctx.arc(aX, aY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`▲ Apogee A (${ptsA.summary.max_altitude_km.toFixed(1)} km)`, aX, aY - 8);
        }

        // Run B Future Arc (Dashed Line)
        ctx.beginPath();
        ctx.strokeStyle = `${runB.color}50`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        for (let i = 0; i < ptsB.time.length; i++) {
          const { cx, cy } = getCanvasCoords(ptsB.downrange_km[i], ptsB.altitude_km[i], width, height);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Run B Traveled Arc (Solid Amber/Rose Line)
        const progressRatio = nPoints > 1 ? activeIdx / (nPoints - 1) : 0;
        const curIdxB = Math.min(ptsB.time.length - 1, Math.round(progressRatio * (ptsB.time.length - 1)));
        if (curIdxB > 0) {
          ctx.beginPath();
          ctx.strokeStyle = runB.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = runB.color;
          ctx.shadowBlur = 8;
          for (let i = 0; i <= curIdxB; i++) {
            const { cx, cy } = getCanvasCoords(ptsB.downrange_km[i], ptsB.altitude_km[i], width, height);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Run B Apogee Marker
        const apogeeIdxB = ptsB.altitude_km.indexOf(ptsB.summary.max_altitude_km);
        if (apogeeIdxB >= 0) {
          const { cx: bX, cy: bY } = getCanvasCoords(ptsB.downrange_km[apogeeIdxB], ptsB.altitude_km[apogeeIdxB], width, height);
          ctx.fillStyle = runB.color;
          ctx.beginPath();
          ctx.arc(bX, bY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`▲ Apogee B (${ptsB.summary.max_altitude_km.toFixed(1)} km)`, bX, bY - 8);
        }

        // Run B Vehicle Dot Marker & Callout
        const curXB = ptsB.downrange_km[curIdxB] || 0;
        const curHB = ptsB.altitude_km[curIdxB] || 0;
        const { cx: rxB, cy: ryB } = getCanvasCoords(curXB, curHB, width, height);

        ctx.fillStyle = runB.color;
        ctx.beginPath();
        ctx.arc(rxB, ryB, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = runB.color;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`Run B: ${runB.mission.rocket} (${curHB.toFixed(1)} km)`, rxB + 8, ryB + 3);
      } else {
        // Nominal Future Trajectory Arc (Dashed Line)
        ctx.beginPath();
        ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        for (let i = 0; i < nPoints; i++) {
          const { cx, cy } = getCanvasCoords(trajectory.downrange_km[i], trajectory.altitude_km[i], width, height);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Flight Trajectory Traveled Arc (Glowing Solid Line)
        if (activeIdx > 0) {
          ctx.beginPath();
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 3;
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 8;
          for (let i = 0; i <= activeIdx; i++) {
            const { cx, cy } = getCanvasCoords(trajectory.downrange_km[i], trajectory.altitude_km[i], width, height);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        }
      }

      // 9. Current Rocket Position & Dynamics
      const curX = trajectory.downrange_km[activeIdx] || 0;
      const curH = trajectory.altitude_km[activeIdx] || 0;
      const curGamma = trajectory.flight_path_angle_deg[activeIdx] || 89.8;
      const curThrust = trajectory.thrust_kN[activeIdx] || 0;
      const curVel = trajectory.velocity_ms[activeIdx] || 0;
      const curTime = trajectory.time[activeIdx] || 0;
      const isBurning = curThrust > 0;

      const { cx: rx, cy: ry } = getCanvasCoords(curX, curH, width, height);

      // Rocket Pitch Orientation angle in screen coordinates
      // gamma is flight path angle from horizontal (deg): 90° = vertical up, 0° = horizontal right
      const screenAngleRad = -((curGamma * Math.PI) / 180);

      // 10. Exhaust Plume & Particle Emission
      if (isBurning) {
        // Emit 2-4 flame particles backwards per frame
        const count = Math.min(4, Math.max(1, Math.round(playbackSpeed)));
        for (let p = 0; p < count; p++) {
          const spread = (Math.random() - 0.5) * 0.4;
          const speed = (Math.random() * 25 + 20) * (curH > 60 ? 1.6 : 1.0); // plume expands in vacuum
          const emitAngle = screenAngleRad + Math.PI + spread;

          particlesRef.current.push({
            x: rx,
            y: ry,
            vx: Math.cos(emitAngle) * speed,
            vy: Math.sin(emitAngle) * speed,
            size: Math.random() * (curH > 60 ? 5 : 3.5) + 2,
            alpha: 1.0,
            color: Math.random() > 0.3 ? "#f59e0b" : "#ef4444",
            life: Math.random() * 0.25 + 0.15,
          });
        }
      }

      // Update and draw exhaust particles
      const activeParticles: Particle[] = [];
      particlesRef.current.forEach((part) => {
        part.x += part.vx * dt;
        part.y += part.vy * dt;
        part.alpha -= dt / part.life;
        part.size += dt * 8; // plume expansion

        if (part.alpha > 0) {
          ctx.beginPath();
          ctx.arc(part.x, part.y, Math.max(0.5, part.size), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${part.color === "#f59e0b" ? "245, 158, 11" : "239, 68, 68"}, ${Math.max(0, part.alpha)})`;
          ctx.fill();
          activeParticles.push(part);
        }
      });
      particlesRef.current = activeParticles;

      // 11. Draw Sleek Aerospace Rocket Body
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(screenAngleRad + Math.PI / 2); // align nose along direction of flight

      // Rocket shadow/glow
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 10;

      // Main cylindrical body
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-3, -12, 6, 20);

      // Payload Fairing Nosecone
      ctx.beginPath();
      ctx.moveTo(-3, -12);
      ctx.lineTo(0, -20);
      ctx.lineTo(3, -12);
      ctx.closePath();
      ctx.fillStyle = "#38bdf8";
      ctx.fill();

      // Body stripes
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(-3, -4, 6, 3);

      // Stabilizing Fins
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(-7, 10);
      ctx.lineTo(-3, 8);
      ctx.closePath();
      ctx.fillStyle = "#64748b";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(3, 4);
      ctx.lineTo(7, 10);
      ctx.lineTo(3, 8);
      ctx.closePath();
      ctx.fillStyle = "#64748b";
      ctx.fill();

      // Engine Nozzle Bell
      ctx.beginPath();
      ctx.moveTo(-2, 8);
      ctx.lineTo(-3.5, 12);
      ctx.lineTo(3.5, 12);
      ctx.lineTo(2, 8);
      ctx.closePath();
      ctx.fillStyle = "#334155";
      ctx.fill();

      // Engine Core Fire Glow if burning
      if (isBurning) {
        ctx.beginPath();
        ctx.moveTo(-2.5, 12);
        ctx.lineTo(0, 20 + Math.sin(now * 0.05) * 4);
        ctx.lineTo(2.5, 12);
        ctx.closePath();
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
      }

      ctx.restore();
      ctx.shadowBlur = 0; // reset

      // 12. Floating Telemetry Callout Box over Rocket
      const calloutX = Math.min(width - 150, Math.max(padding.left + 10, rx + 14));
      const calloutY = Math.max(padding.top + 30, Math.min(height - 80, ry - 30));

      ctx.fillStyle = "rgba(2, 6, 23, 0.88)";
      ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      ctx.lineWidth = 1;

      // Rounded rect
      ctx.beginPath();
      ctx.roundRect(calloutX, calloutY - 24, 135, 48, 6);
      ctx.fill();
      ctx.stroke();

      // Connecting pointer line
      ctx.beginPath();
      ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
      ctx.moveTo(rx, ry);
      ctx.lineTo(calloutX, calloutY);
      ctx.stroke();

      // Text inside callout
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`${mission.rocket}`, calloutX + 8, calloutY - 10);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "10px monospace";
      ctx.fillText(`Alt: ${curH.toFixed(1)} km`, calloutX + 8, calloutY + 4);

      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Vel: ${curVel.toFixed(0)} m/s`, calloutX + 8, calloutY + 16);

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    dimensions,
    isPlaying,
    playbackSpeed,
    trajectory,
    nPoints,
    mission,
    maxDownrange,
    maxAltitude,
    padding,
    stars,
    envelopeTrajectories,
    showEnvelope,
    getCanvasCoords,
    onIndexChange,
    onTogglePlay,
    activeShowHeatmap,
    activeOpacity,
    activeProfile,
    activeTargetAltitude,
    comparisonOverlay,
  ]);

  // Current active flight phase label
  const flightPhase = useMemo(() => {
    const curTime = trajectory.time[currentIndex] || 0;
    const curAlt = trajectory.altitude_km[currentIndex] || 0;
    const burnTime = trajectory.summary.burn_time_sec;

    if (curTime <= 2) return { name: "LIFTOFF & ENGINE IGNITION", color: "text-amber-400" };
    if (curAlt < 15 && curTime < 70) return { name: "MAX-Q TRANSIENT", color: "text-rose-400" };
    if (curTime < burnTime) return { name: "ASCENT PROPULSION BURN", color: "text-cyan-400" };
    if (curAlt >= mission.altitude * 0.95) return { name: "ORBITAL INJECTION COMPLETE", color: "text-emerald-400" };
    return { name: "COASTING / ORBITAL INSERTION", color: "text-indigo-400" };
  }, [trajectory, currentIndex, mission]);

  // Granular key flight stages for stage-by-stage observation
  const stages = useMemo(() => {
    if (!trajectory || nPoints === 0) return [];
    
    // Find index of maximum dynamic pressure (Max-Q)
    let maxQIdx = 0;
    let maxQVal = -1;
    for (let i = 0; i < nPoints; i++) {
      const q = trajectory.dynamic_pressure_kPa[i] || 0;
      if (q > maxQVal) {
        maxQVal = q;
        maxQIdx = i;
      }
    }
    const maxQTime = trajectory.time[maxQIdx] || 65;
    const burnTime = trajectory.summary.burn_time_sec || 120;
    const fairingTime = Math.min(burnTime * 1.35, (trajectory.time[nPoints - 1] || 350) * 0.55);

    const findClosestIdx = (t: number) => {
      let bestI = 0;
      let minDiff = 999999;
      for (let i = 0; i < nPoints; i++) {
        const diff = Math.abs(trajectory.time[i] - t);
        if (diff < minDiff) {
          minDiff = diff;
          bestI = i;
        }
      }
      return bestI;
    };

    const stagingIdx = findClosestIdx(burnTime);
    const fairingIdx = findClosestIdx(fairingTime);

    return [
      { name: "Liftoff", time: 0, alt: 0, idx: 0, icon: "🚀" },
      { name: "Max-Q", time: Math.round(maxQTime), alt: trajectory.altitude_km[maxQIdx] || 15, idx: maxQIdx, icon: "🌪️" },
      { name: "Staging / MECO", time: Math.round(burnTime), alt: trajectory.altitude_km[stagingIdx] || 70, idx: stagingIdx, icon: "⚡" },
      { name: "Fairing Sep", time: Math.round(fairingTime), alt: trajectory.altitude_km[fairingIdx] || 115, idx: fairingIdx, icon: "🛡️" },
      { name: "Orbital Injection", time: Math.round(trajectory.time[nPoints - 1] || 0), alt: trajectory.altitude_km[nPoints - 1] || 0, idx: nPoints - 1, icon: "🎯" },
    ];
  }, [trajectory, nPoints]);

  return (
    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
      {/* Header & Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Dynamic Ascent Flight Path Animation</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-700/60 bg-slate-950 ${flightPhase.color}`}>
                {flightPhase.name}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans">
              2D Runge-Kutta numerical integration showing altitude vs downrange trajectory
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Speed Selector (0.5x, 1x, 2x, 5x) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {[0.5, 1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                title={
                  spd === 0.5
                    ? "0.5x Slow Motion: Granular observation of flight stages & separation"
                    : spd === 1
                    ? "1x Normal Flight Playback"
                    : spd === 2
                    ? "2x Accelerated Playback"
                    : "5x High Speed Scrub"
                }
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  playbackSpeed === spd
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Reset Button */}
          <button
            onClick={() => onIndexChange(0)}
            title="Restart Flight Simulation"
            className="p-1.5 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              isPlaying
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                : "bg-cyan-400 hover:bg-cyan-300 text-slate-950"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Flight</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* HTML5 Canvas Container */}
      <div
        ref={containerRef}
        className="w-full relative rounded-xl overflow-hidden border border-slate-800 bg-[#030712] shadow-2xl"
      >
        <canvas
          ref={canvasRef}
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
          className="block cursor-crosshair"
          onClick={(e) => {
            // Click to scrub position along downrange
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const plotWidth = dimensions.width - padding.left - padding.right;
            const ratio = Math.max(0, Math.min(1, (clickX - padding.left) / plotWidth));
            const targetIdx = Math.round(ratio * (nPoints - 1));
            onIndexChange(targetIdx);
          }}
        />

        {/* Live HUD Telemetry Overlay on Bottom-Left */}
        <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-lg p-2.5 text-xs font-mono space-y-1 shadow-lg pointer-events-none">
          <div className="text-[10px] uppercase text-cyan-400 font-bold">Flight Telemetry HUD</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-300 tabular-nums">
            <div>
              <span className="text-slate-500">MET:</span> T+{trajectory.time[currentIndex]} s
            </div>
            <div>
              <span className="text-slate-500">Alt:</span> {trajectory.altitude_km[currentIndex]} km
            </div>
            <div>
              <span className="text-slate-500">Downrange:</span> {trajectory.downrange_km[currentIndex]} km
            </div>
            <div>
              <span className="text-slate-500">Velocity:</span> {trajectory.velocity_ms[currentIndex]} m/s
            </div>
            <div>
              <span className="text-slate-500">Pitch (γ):</span> {trajectory.flight_path_angle_deg[currentIndex]}°
            </div>
            <div>
              <span className="text-slate-500">G-Load:</span> {trajectory.accel_g[currentIndex]} g
            </div>
          </div>
        </div>

        {/* Vehicle Mass & Thrust Status on Bottom-Right */}
        <div className="absolute bottom-3 right-3 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-lg p-2.5 text-xs font-mono space-y-1 shadow-lg pointer-events-none text-right">
          <div className="text-[10px] uppercase text-slate-400 font-bold">{mission.rocket} Systems</div>
          <div className="text-slate-300 tabular-nums">
            <span className="text-slate-500">Thrust:</span>{" "}
            {trajectory.thrust_kN[currentIndex] > 0 ? (
              <span className="text-amber-400 font-bold">{trajectory.thrust_kN[currentIndex]} kN</span>
            ) : (
              <span className="text-slate-500">0.0 kN (MECO)</span>
            )}
          </div>
          <div className="text-slate-300 tabular-nums">
            <span className="text-slate-500">Propellant:</span>{" "}
            <span className="text-blue-400">{trajectory.fuel_remaining_kg[currentIndex].toLocaleString()} kg</span>
          </div>
        </div>

        {/* Floating Comparative Trajectory Overlay HUD */}
        {comparisonOverlay?.enabled && (
          <div className="absolute top-3 right-3 max-w-sm bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-xs font-mono space-y-2 shadow-2xl pointer-events-none">
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800 font-sans">
              <span className="font-bold text-white flex items-center gap-1.5">
                <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Trajectory Comparison Mode</span>
              </span>
              <span className="text-[10px] text-slate-400">Dual Arc Overlay</span>
            </div>

            <div className="space-y-1.5">
              {/* Run A Info */}
              <div className="p-1.5 rounded bg-slate-900/80 border border-cyan-800/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                  <span className="font-semibold text-cyan-300 truncate max-w-[120px]">{comparisonOverlay.runA.label}</span>
                  <span className="text-[10px] text-slate-400">({comparisonOverlay.runA.mission.rocket})</span>
                </div>
                <div className="text-right text-[10px] tabular-nums">
                  <span className="text-white font-bold">{comparisonOverlay.runA.trajectory.altitude_km[currentIndex]?.toFixed(1)} km</span>
                  <span className="text-slate-400 ml-1.5">Apogee: {comparisonOverlay.runA.trajectory.summary.max_altitude_km.toFixed(1)} km</span>
                </div>
              </div>

              {/* Run B Info */}
              <div className="p-1.5 rounded bg-slate-900/80 border border-amber-800/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span className="font-semibold text-amber-300 truncate max-w-[120px]">{comparisonOverlay.runB.label}</span>
                  <span className="text-[10px] text-slate-400">({comparisonOverlay.runB.mission.rocket})</span>
                </div>
                {(() => {
                  const bIdx = Math.min(
                    comparisonOverlay.runB.trajectory.time.length - 1,
                    Math.round((currentIndex / Math.max(1, nPoints - 1)) * (comparisonOverlay.runB.trajectory.time.length - 1))
                  );
                  return (
                    <div className="text-right text-[10px] tabular-nums">
                      <span className="text-white font-bold">{comparisonOverlay.runB.trajectory.altitude_km[bIdx]?.toFixed(1)} km</span>
                      <span className="text-slate-400 ml-1.5">Apogee: {comparisonOverlay.runB.trajectory.summary.max_altitude_km.toFixed(1)} km</span>
                    </div>
                  );
                })()}
              </div>

              {/* Delta Comparison */}
              {(() => {
                const altDiff = Number(
                  (comparisonOverlay.runA.trajectory.summary.max_altitude_km - comparisonOverlay.runB.trajectory.summary.max_altitude_km).toFixed(1)
                );
                const velDiff = Math.round(
                  comparisonOverlay.runA.trajectory.summary.final_velocity_ms - comparisonOverlay.runB.trajectory.summary.final_velocity_ms
                );
                return (
                  <div className="flex items-center justify-between text-[10px] text-slate-300 pt-0.5 px-1">
                    <span>Δ Apogee: <strong className={altDiff >= 0 ? "text-cyan-400" : "text-amber-400"}>{altDiff >= 0 ? `+${altDiff}` : altDiff} km</strong></span>
                    <span>Δ Final Vel: <strong className={velDiff >= 0 ? "text-cyan-400" : "text-amber-400"}>{velDiff >= 0 ? `+${velDiff}` : velDiff} m/s</strong></span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* GRANULAR FLIGHT STAGE TIMELINE & PLAYBACK SPEED CONTROL (0.5x, 1x, 2x) */}
      <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Playback Controls & Speed Toggle (0.5x, 1x, 2x) */}
          <div className="flex items-center gap-3">
            <button
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                isPlaying
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              onClick={() => onIndexChange(0)}
              title="Reset to Pad T+0s"
              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Playback Speed Control (0.5x, 1x, 2x) */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase px-1 font-bold">Speed:</span>
              {[
                { spd: 0.5, label: "0.5x", desc: "Granular Slow-Motion Stage Observation" },
                { spd: 1, label: "1x", desc: "Standard Real-Time Playback" },
                { spd: 2, label: "2x", desc: "2x Fast Playback" },
              ].map(({ spd, label, desc }) => (
                <button
                  key={spd}
                  onClick={() => onChangeSpeed(spd)}
                  title={desc}
                  className={`px-2.5 py-0.5 rounded text-xs font-mono transition-all cursor-pointer ${
                    playbackSpeed === spd
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/25"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Flight Time & Phase Tag */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">MET:</span>
            <span className="text-white font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              T+{trajectory.time[currentIndex] ?? 0}s
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Alt:</span>
            <span className="text-cyan-400 font-bold">
              {trajectory.altitude_km[currentIndex]?.toFixed(1) ?? 0} km
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Vel:</span>
            <span className="text-amber-400 font-bold">
              {Math.round(trajectory.velocity_ms[currentIndex] ?? 0)} m/s
            </span>
          </div>
        </div>

        {/* Timeline Slider with High Precision */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={nPoints - 1}
            value={currentIndex}
            onChange={(e) => onIndexChange(Number(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>T+0s (Liftoff)</span>
            <span>T+{Math.round((trajectory.time[nPoints - 1] || 0) / 2)}s (Mid-Course)</span>
            <span>T+{trajectory.time[nPoints - 1] || 0}s (Target Orbit Injection)</span>
          </div>
        </div>

        {/* Granular Flight Stage Jump Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
          <span className="text-[10px] uppercase text-slate-500 font-semibold mr-1">Inspect Stages:</span>
          {stages.map((stg) => {
            const isNear = Math.abs(currentIndex - stg.idx) <= Math.max(2, Math.round(nPoints * 0.04));
            return (
              <button
                key={stg.name}
                onClick={() => onIndexChange(stg.idx)}
                title={`Jump to ${stg.name} at T+${stg.time}s (${stg.alt.toFixed(1)} km)`}
                className={`px-2 py-1 rounded text-[11px] border transition-all cursor-pointer flex items-center gap-1 ${
                  isNear
                    ? "bg-cyan-950 text-cyan-200 border-cyan-500 font-bold shadow-sm"
                    : "bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{stg.icon}</span>
                <span>{stg.name}</span>
                <span className="text-[9px] text-slate-500 font-mono">T+{stg.time}s</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ATMOSPHERIC DENSITY HEATMAP OVERLAY & SEASONAL WEATHER CONTROLS */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3.5 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Atmospheric Density Heatmap Overlay</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/70 text-cyan-300">
                  Scale Height H={activeProfile.scaleHeightM.toLocaleString()} m · ρ₀={activeProfile.surfaceDensityKgM3} kg/m³
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Dynamic barometric density gradient mapped across altitude range with seasonal lapse rates and Max-Q corridor
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Heatmap Button */}
            <button
              onClick={toggleHeatmap}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                activeShowHeatmap
                  ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm shadow-cyan-500/20"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              {activeShowHeatmap ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Density Heatmap: ON</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Density Heatmap: OFF</span>
                </>
              )}
            </button>

            {/* Heatmap Opacity Scrubber */}
            {activeShowHeatmap && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800 text-slate-400">
                <span className="text-[10px]">Opacity:</span>
                <input
                  type="range"
                  min={0.15}
                  max={0.8}
                  step={0.05}
                  value={activeOpacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-16 accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                  title={`Heatmap opacity: ${Math.round(activeOpacity * 100)}%`}
                />
                <span className="text-[10px] text-cyan-400 w-7 tabular-nums">{Math.round(activeOpacity * 100)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Seasonal Weather Profile & Launch Altitude Selection Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Seasonal Profile Selector */}
          <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/70">
            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span className="flex items-center gap-1 text-cyan-300 font-semibold font-sans">
                <Thermometer className="w-3.5 h-3.5" />
                <span>Seasonal Atmosphere Model:</span>
              </span>
              <span className="text-[10px] text-slate-400">{activeProfile.seasonLabel}</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {[
                { id: "auto", label: "Site Weather", desc: "Live Auto" },
                { id: "monsoon", label: "Monsoon", desc: "Hot / Humid" },
                { id: "summer", label: "Summer", desc: "Thermal Uplift" },
                { id: "winter", label: "Winter", desc: "Cold / Dense" },
                { id: "standard", label: "ISA Standard", desc: "ICAO Ref" },
                { id: "cyclone", label: "Cyclonic", desc: "Low Pressure" },
              ].map((p) => {
                const isSelected = activeProfileId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProfileId(p.id as any)}
                    className={`p-1.5 rounded text-left transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-cyan-950/80 text-cyan-300 border-cyan-700/80 shadow-sm shadow-cyan-500/10 font-bold"
                        : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="text-[11px] truncate">{p.label}</div>
                    <div className="text-[9px] text-slate-400 truncate">{p.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-400 font-sans pt-0.5">
              {activeProfile.description} (Surface Temp: {activeProfile.surfaceTempC}°C · Pressure: {activeProfile.surfacePressureHpa} hPa)
            </div>
          </div>

          {/* Launch Altitude Scaling Scrubber */}
          <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/70">
            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span className="flex items-center gap-1 text-amber-300 font-semibold font-sans">
                <Compass className="w-3.5 h-3.5" />
                <span>Target Launch Orbit Altitude:</span>
              </span>
              <span className="text-amber-400 font-bold text-xs tabular-nums">
                {activeTargetAltitude} km
              </span>
            </div>

            <div className="pt-1">
              <input
                type="range"
                min={120}
                max={900}
                step={10}
                value={activeTargetAltitude}
                onChange={(e) => setTargetAltitude(Number(e.target.value))}
                className="w-full accent-amber-400 bg-slate-800 h-2 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>120 km (Sub-Orbital)</span>
                <span>350 km (LEO)</span>
                <span>500 km (SSO)</span>
                <span>800 km (High LEO)</span>
              </div>
            </div>

            {/* Quick Altitude Presets */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {[
                { label: "Nominal (Mission)", alt: mission.altitude },
                { label: "LEO 300 km", alt: 300 },
                { label: "SSO 500 km", alt: 500 },
                { label: "Polar 700 km", alt: 700 },
              ].map((preset) => (
                <button
                  key={preset.alt}
                  onClick={() => setTargetAltitude(preset.alt)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                    activeTargetAltitude === preset.alt
                      ? "bg-amber-950 text-amber-300 border-amber-700/80 font-bold"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Continuous Colorbar Spectrum & Real-Time Vehicle Density Readout */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between text-[11px] gap-2">
            <span className="text-slate-400 font-sans">Atmospheric Density Spectrum:</span>
            <div className="flex items-center gap-4 text-[10px] text-slate-300 tabular-nums">
              <span>
                <strong className="text-white">Vehicle Altitude:</strong> {currentVehicleAltitudeKm.toFixed(1)} km
              </span>
              <span>
                <strong className="text-cyan-300">Local Density (ρ):</strong> {currentVehicleDensity.toFixed(4)} kg/m³ ({currentDensityPct}% of sea level)
              </span>
              <span>
                <strong className="text-amber-400">Dynamic Drag:</strong> {(trajectory.drag_kN[currentIndex] || 0).toFixed(1)} kN
              </span>
            </div>
          </div>

          {/* Color Gradient Strip */}
          <div className="h-3 w-full rounded-md border border-slate-800 overflow-hidden relative" style={{
            background: "linear-gradient(to right, #0e345c 0%, #06b6d4 25%, #10b981 50%, #f59e0b 75%, #030712 100%)",
          }}>
            {/* Vehicle Altitude Marker along gradient */}
            {(() => {
              const markerRatio = Math.max(0, Math.min(1, currentVehicleAltitudeKm / 100)); // normalized to 100km karman line
              return (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-md shadow-white/80 transition-all pointer-events-none"
                  style={{ left: `${(1 - markerRatio) * 100}%` }}
                  title={`Vehicle at ${currentVehicleAltitudeKm.toFixed(1)} km`}
                />
              );
            })()}
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span className="text-blue-300">Sea Level (ρ₀={activeProfile.surfaceDensityKgM3} kg/m³)</span>
            <span className="text-cyan-300">Troposphere (0.5 kg/m³)</span>
            <span className="text-emerald-300">Max-Q Corridor (0.1 kg/m³)</span>
            <span className="text-amber-300">Stratosphere (0.01 kg/m³)</span>
            <span className="text-slate-400">Space Boundary (Kármán 100 km · ~0 kg/m³)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
