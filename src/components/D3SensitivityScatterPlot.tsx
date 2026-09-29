import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { useTheme } from "../context/ThemeContext";

export interface SensitivityPoint {
  id: string;
  thrustPct: number;
  fuelMarginPct: number;
  fuelMassPct: number;
  ispPct: number;
  angleDeviationDeg: number;
  // Trajectory results
  finalAltitudeKm: number;
  maxAltitudeKm: number;
  finalVelocityMs: number;
  velocityMarginMs: number;
  altitudeMarginKm: number;
  maxDynamicPressureKPa: number;
  maxAccelerationG: number;
  burnTimeSec: number;
  status: "Optimal" | "Nominal" | "Shortfall" | "Overstressed" | "Overboost";
  isNominal?: boolean;
}

export type XAxisMetric =
  | "thrustPct"
  | "fuelMarginPct"
  | "fuelMassPct"
  | "ispPct"
  | "angleDeviationDeg";

export type YAxisMetric =
  | "finalVelocityMs"
  | "finalAltitudeKm"
  | "velocityMarginMs"
  | "altitudeMarginKm"
  | "maxDynamicPressureKPa"
  | "maxAccelerationG"
  | "burnTimeSec";

export type ColorMetric = "status" | "maxDynamicPressureKPa" | "maxAccelerationG" | "fuelMarginPct" | "thrustPct";
export type SizeMetric = "uniform" | "maxDynamicPressureKPa" | "maxAccelerationG" | "burnTimeSec";

interface D3SensitivityScatterPlotProps {
  data: SensitivityPoint[];
  xAxis: XAxisMetric;
  yAxis: YAxisMetric;
  colorBy: ColorMetric;
  sizeBy: SizeMetric;
  targetAltitudeKm: number;
  targetVelocityMs: number;
  selectedPoint: SensitivityPoint | null;
  onSelectPoint: (point: SensitivityPoint | null) => void;
  showTrendline?: boolean;
  showSafeEnvelope?: boolean;
}

export const METRIC_LABELS: Record<XAxisMetric | YAxisMetric, { name: string; unit: string; format: (v: number) => string }> = {
  thrustPct: { name: "Thrust Fluctuation", unit: "%", format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%` },
  fuelMarginPct: { name: "Fuel Margin Fluctuation", unit: "%", format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%` },
  fuelMassPct: { name: "Fuel Mass Fluctuation", unit: "%", format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%` },
  ispPct: { name: "Specific Impulse (Isp)", unit: "%", format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%` },
  angleDeviationDeg: { name: "Pitch Angle Deviation", unit: "deg", format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°` },
  finalVelocityMs: { name: "Final Orbital Velocity", unit: "m/s", format: (v) => `${Math.round(v).toLocaleString()} m/s` },
  finalAltitudeKm: { name: "Final Orbital Altitude", unit: "km", format: (v) => `${v.toFixed(1)} km` },
  velocityMarginMs: { name: "Δv Margin relative to Orbit", unit: "m/s", format: (v) => `${v > 0 ? "+" : ""}${Math.round(v)} m/s` },
  altitudeMarginKm: { name: "Altitude Margin relative to Target", unit: "km", format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} km` },
  maxDynamicPressureKPa: { name: "Max Dynamic Pressure (Max Q)", unit: "kPa", format: (v) => `${v.toFixed(1)} kPa` },
  maxAccelerationG: { name: "Max G-Force Load", unit: "g", format: (v) => `${v.toFixed(2)} g` },
  burnTimeSec: { name: "Total Burn Time", unit: "s", format: (v) => `${v.toFixed(1)} s` },
};

const STATUS_COLORS: Record<SensitivityPoint["status"], string> = {
  Optimal: "#10b981", // Emerald
  Nominal: "#06b6d4", // Cyan
  Shortfall: "#f43f5e", // Rose
  Overstressed: "#f59e0b", // Amber
  Overboost: "#a855f7", // Purple
};

export const D3SensitivityScatterPlot: React.FC<D3SensitivityScatterPlotProps> = ({
  data,
  xAxis,
  yAxis,
  colorBy,
  sizeBy,
  targetAltitudeKm,
  targetVelocityMs,
  selectedPoint,
  onSelectPoint,
  showTrendline = true,
  showSafeEnvelope = true,
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<SensitivityPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 780, height: 460 });

  // Resize observer to make chart fluidly responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 200) {
          const calculatedHeight = Math.max(380, Math.min(520, Math.round(width * 0.52)));
          setDimensions({ width, height: calculatedHeight });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute linear regression statistics
  const regressionStats = useMemo(() => {
    if (data.length < 2) return null;
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    data.forEach((d) => {
      const x = d[xAxis];
      const y = d[yAxis];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    });

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-9) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // Pearson r
    const rNum = n * sumXY - sumX * sumY;
    const rDenom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const r = rDenom !== 0 ? rNum / rDenom : 0;
    const r2 = r * r;

    return { slope, intercept, r, r2 };
  }, [data, xAxis, yAxis]);

  // Main D3 Rendering Effect
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 35, right: 40, bottom: 65, left: 80 };
    const innerWidth = Math.max(50, width - margin.left - margin.right);
    const innerHeight = Math.max(50, height - margin.top - margin.bottom);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Background defs and gradients
    const defs = svg.append("defs");

    // Glow filter for highlighted/nominal points
    const filter = defs.append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "3.5").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Root Group
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Extents
    const xValues = data.map((d) => d[xAxis]);
    const yValues = data.map((d) => d[yAxis]);

    let xMin = d3.min(xValues) ?? -15;
    let xMax = d3.max(xValues) ?? 15;
    let yMin = d3.min(yValues) ?? 0;
    let yMax = d3.max(yValues) ?? 100;

    // Add padding to domain
    const xPad = (xMax - xMin) * 0.08 || 2;
    const yPad = (yMax - yMin) * 0.08 || 5;

    // Special handling for Y axis reference lines inclusion
    if (yAxis === "finalVelocityMs") {
      yMin = Math.min(yMin, targetVelocityMs - 200);
      yMax = Math.max(yMax, targetVelocityMs + 200);
    } else if (yAxis === "finalAltitudeKm") {
      yMin = Math.min(yMin, targetAltitudeKm * 0.85);
      yMax = Math.max(yMax, targetAltitudeKm * 1.15);
    } else if (yAxis === "velocityMarginMs" || yAxis === "altitudeMarginKm") {
      yMin = Math.min(yMin, -50);
      yMax = Math.max(yMax, 50);
    }

    // Scales
    const xScale = d3.scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, innerWidth]).nice();
    const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerHeight, 0]).nice();

    // Size Scale
    const sizeScale = (d: SensitivityPoint) => {
      if (sizeBy === "uniform") return d.isNominal ? 8 : 5.5;
      const val = d[sizeBy];
      if (sizeBy === "maxDynamicPressureKPa") {
        return Math.max(3.5, Math.min(12, 3.5 + (val / 45) * 6));
      } else if (sizeBy === "maxAccelerationG") {
        return Math.max(3.5, Math.min(12, 3.5 + (val / 5) * 6));
      } else if (sizeBy === "burnTimeSec") {
        return Math.max(3.5, Math.min(12, 4 + (val / 600) * 5));
      }
      return 5.5;
    };

    // Color Scale
    const colorScale = (d: SensitivityPoint): string => {
      if (colorBy === "status") {
        return STATUS_COLORS[d.status] || "#06b6d4";
      }
      const val = d[colorBy];
      if (colorBy === "maxDynamicPressureKPa") {
        // Safe: <35 (cyan/emerald), Moderate: 35-42 (amber), Danger: >42 (rose)
        if (val > 42) return "#f43f5e";
        if (val > 36) return "#f59e0b";
        return "#06b6d4";
      } else if (colorBy === "maxAccelerationG") {
        if (val > 4.5) return "#f43f5e";
        if (val > 3.8) return "#f59e0b";
        return "#10b981";
      } else if (colorBy === "thrustPct") {
        const c = d3.scaleDiverging(d3.interpolatePuOr).domain([-15, 0, 15]);
        return c(val);
      } else if (colorBy === "fuelMarginPct") {
        const c = d3.scaleDiverging(d3.interpolateRdYlGn).domain([-20, 0, 20]);
        return c(val);
      }
      return "#06b6d4";
    };

    // Colors matching theme
    const gridColor = isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(100, 116, 139, 0.15)";
    const axisTextColor = isDark ? "#94a3b8" : "#475569";
    const axisLineColor = isDark ? "#334155" : "#cbd5e1";

    // 1. Grid Lines
    // Horizontal Grid
    g.append("g")
      .attr("class", "grid-y")
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", gridColor)
      .attr("stroke-dasharray", "3,3");
    g.select(".grid-y").select(".domain").remove();

    // Vertical Grid
    g.append("g")
      .attr("class", "grid-x")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-innerHeight)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", gridColor)
      .attr("stroke-dasharray", "3,3");
    g.select(".grid-x").select(".domain").remove();

    // 2. Safe Corridor / Target Zone Shading
    if (showSafeEnvelope) {
      if (yAxis === "finalVelocityMs") {
        // Target velocity ±50 m/s green corridor
        const yTop = yScale(targetVelocityMs + 50);
        const yBottom = yScale(targetVelocityMs - 50);
        g.append("rect")
          .attr("x", 0)
          .attr("y", Math.min(yTop, yBottom))
          .attr("width", innerWidth)
          .attr("height", Math.abs(yBottom - yTop))
          .attr("fill", isDark ? "rgba(16, 185, 129, 0.07)" : "rgba(16, 185, 129, 0.12)")
          .attr("stroke", "rgba(16, 185, 129, 0.25)")
          .attr("stroke-dasharray", "4,2");
      } else if (yAxis === "velocityMarginMs" || yAxis === "altitudeMarginKm") {
        // Zero-margin corridor
        const yTop = yScale(15);
        const yBottom = yScale(-15);
        g.append("rect")
          .attr("x", 0)
          .attr("y", Math.min(yTop, yBottom))
          .attr("width", innerWidth)
          .attr("height", Math.abs(yBottom - yTop))
          .attr("fill", isDark ? "rgba(6, 182, 212, 0.08)" : "rgba(6, 182, 212, 0.12)")
          .attr("stroke", "rgba(6, 182, 212, 0.25)")
          .attr("stroke-dasharray", "4,2");
      } else if (yAxis === "finalAltitudeKm") {
        // Altitude corridor ±15 km
        const yTop = yScale(targetAltitudeKm + 15);
        const yBottom = yScale(targetAltitudeKm - 15);
        g.append("rect")
          .attr("x", 0)
          .attr("y", Math.min(yTop, yBottom))
          .attr("width", innerWidth)
          .attr("height", Math.abs(yBottom - yTop))
          .attr("fill", isDark ? "rgba(16, 185, 129, 0.07)" : "rgba(16, 185, 129, 0.12)")
          .attr("stroke", "rgba(16, 185, 129, 0.25)")
          .attr("stroke-dasharray", "4,2");
      }
    }

    // 3. Reference Lines
    // Reference Zero Line for X if domain spans zero
    if (xScale.domain()[0] <= 0 && xScale.domain()[1] >= 0) {
      g.append("line")
        .attr("x1", xScale(0))
        .attr("x2", xScale(0))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", isDark ? "rgba(203, 213, 225, 0.4)" : "rgba(71, 85, 105, 0.4)")
        .attr("stroke-dasharray", "5,4")
        .attr("stroke-width", 1.2);
    }

    // Reference Target Line for Y
    let refYVal: number | null = null;
    let refYLabel = "";

    if (yAxis === "finalVelocityMs") {
      refYVal = targetVelocityMs;
      refYLabel = `Target Orbit v = ${Math.round(targetVelocityMs)} m/s`;
    } else if (yAxis === "finalAltitudeKm") {
      refYVal = targetAltitudeKm;
      refYLabel = `Target Orbit = ${targetAltitudeKm} km`;
    } else if (yAxis === "velocityMarginMs" || yAxis === "altitudeMarginKm") {
      refYVal = 0;
      refYLabel = "Nominal Orbit Margin (0)";
    } else if (yAxis === "maxDynamicPressureKPa") {
      refYVal = 42; // Safety limit
      refYLabel = "Max Q Safety Envelope (42 kPa)";
    } else if (yAxis === "maxAccelerationG") {
      refYVal = 4.5;
      refYLabel = "Structural Load Limit (4.5g)";
    }

    if (refYVal !== null && refYVal >= yScale.domain()[0] && refYVal <= yScale.domain()[1]) {
      const yPos = yScale(refYVal);
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", yPos)
        .attr("y2", yPos)
        .attr("stroke", yAxis === "maxDynamicPressureKPa" || yAxis === "maxAccelerationG" ? "#f43f5e" : "#10b981")
        .attr("stroke-dasharray", "6,3")
        .attr("stroke-width", 1.5);

      // Label badge
      const labelGroup = g.append("g").attr("transform", `translate(${innerWidth - 8}, ${yPos - 6})`);
      labelGroup
        .append("text")
        .attr("text-anchor", "end")
        .attr("font-family", "monospace")
        .attr("font-size", "10px")
        .attr("font-weight", "600")
        .attr("fill", yAxis === "maxDynamicPressureKPa" || yAxis === "maxAccelerationG" ? "#f43f5e" : "#10b981")
        .text(refYLabel);
    }

    // 4. Trendline (Linear Regression)
    if (showTrendline && regressionStats) {
      const xDomain = xScale.domain();
      const y1 = regressionStats.slope * xDomain[0] + regressionStats.intercept;
      const y2 = regressionStats.slope * xDomain[1] + regressionStats.intercept;

      g.append("line")
        .attr("x1", xScale(xDomain[0]))
        .attr("y1", yScale(y1))
        .attr("x2", xScale(xDomain[1]))
        .attr("y2", yScale(y2))
        .attr("stroke", "#38bdf8")
        .attr("stroke-width", 1.8)
        .attr("stroke-dasharray", "6,4")
        .attr("opacity", 0.85);

      // Correlation / Slope badge on top
      g.append("text")
        .attr("x", 12)
        .attr("y", 18)
        .attr("font-family", "monospace")
        .attr("font-size", "11px")
        .attr("fill", isDark ? "#38bdf8" : "#0284c7")
        .attr("font-weight", "600")
        .text(
          `Trend Fit: y = ${regressionStats.slope > 0 ? "+" : ""}${regressionStats.slope.toFixed(2)}x · R² = ${regressionStats.r2.toFixed(3)} (r = ${regressionStats.r.toFixed(3)})`
        );
    }

    // 5. Axes
    const xAxisGenerator = d3
      .axisBottom(xScale)
      .ticks(Math.max(4, Math.floor(innerWidth / 90)))
      .tickFormat((d) => METRIC_LABELS[xAxis].format(d as number));

    const yAxisGenerator = d3
      .axisLeft(yScale)
      .ticks(Math.max(4, Math.floor(innerHeight / 50)))
      .tickFormat((d) => METRIC_LABELS[yAxis].format(d as number));

    const gx = g
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxisGenerator);

    gx.select(".domain").attr("stroke", axisLineColor);
    gx.selectAll(".tick line").attr("stroke", axisLineColor);
    gx.selectAll(".tick text").attr("fill", axisTextColor).attr("font-family", "monospace").attr("font-size", "11px");

    const gy = g.append("g").attr("class", "y-axis").call(yAxisGenerator);

    gy.select(".domain").attr("stroke", axisLineColor);
    gy.selectAll(".tick line").attr("stroke", axisLineColor);
    gy.selectAll(".tick text").attr("fill", axisTextColor).attr("font-family", "monospace").attr("font-size", "11px");

    // Axis Titles
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 46)
      .attr("text-anchor", "middle")
      .attr("fill", isDark ? "#e2e8f0" : "#1e293b")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("font-family", "sans-serif")
      .text(`${METRIC_LABELS[xAxis].name} (${METRIC_LABELS[xAxis].unit})`);

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -58)
      .attr("text-anchor", "middle")
      .attr("fill", isDark ? "#e2e8f0" : "#1e293b")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("font-family", "sans-serif")
      .text(`${METRIC_LABELS[yAxis].name} (${METRIC_LABELS[yAxis].unit})`);

    // 6. Crosshairs container (for hovered/selected point)
    const crosshairG = g.append("g").attr("class", "crosshairs").attr("pointer-events", "none");

    const renderCrosshairs = (point: SensitivityPoint | null) => {
      crosshairG.selectAll("*").remove();
      if (!point) return;

      const px = xScale(point[xAxis]);
      const py = yScale(point[yAxis]);

      // Horizontal crosshair to Y axis
      crosshairG
        .append("line")
        .attr("x1", 0)
        .attr("x2", px)
        .attr("y1", py)
        .attr("y2", py)
        .attr("stroke", "#38bdf8")
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 1.2);

      // Vertical crosshair to X axis
      crosshairG
        .append("line")
        .attr("x1", px)
        .attr("x2", px)
        .attr("y1", py)
        .attr("y2", innerHeight)
        .attr("stroke", "#38bdf8")
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 1.2);
    };

    // If a point is already selected, render crosshair initially
    if (selectedPoint) {
      renderCrosshairs(selectedPoint);
    }

    // 7. Scatter Points
    const pointsG = g.append("g").attr("class", "scatter-points");

    // Sort so nominal point renders on top
    const sortedData = [...data].sort((a, b) => {
      if (a.isNominal) return 1;
      if (b.isNominal) return -1;
      return 0;
    });

    const circles = pointsG
      .selectAll<SVGCircleElement, SensitivityPoint>("circle")
      .data(sortedData, (d) => d.id)
      .join("circle")
      .attr("cx", (d) => xScale(d[xAxis]))
      .attr("cy", (d) => yScale(d[yAxis]))
      .attr("r", (d) => sizeScale(d))
      .attr("fill", (d) => colorScale(d))
      .attr("fill-opacity", (d) => (d.isNominal ? 1 : selectedPoint && selectedPoint.id !== d.id ? 0.45 : 0.8))
      .attr("stroke", (d) => {
        if (selectedPoint && selectedPoint.id === d.id) return "#ffffff";
        if (d.isNominal) return "#06b6d4";
        return isDark ? "#0f172a" : "#ffffff";
      })
      .attr("stroke-width", (d) => {
        if (selectedPoint && selectedPoint.id === d.id) return 3;
        if (d.isNominal) return 2.5;
        return 1.2;
      })
      .attr("filter", (d) => (d.isNominal || (selectedPoint && selectedPoint.id === d.id) ? "url(#glow)" : null))
      .attr("cursor", "pointer")
      .style("transition", "fill-opacity 0.15s ease, r 0.15s ease");

    // 8. Nominal Beacon Ring Marker
    const nominalPt = data.find((d) => d.isNominal);
    if (nominalPt) {
      const nx = xScale(nominalPt[xAxis]);
      const ny = yScale(nominalPt[yAxis]);

      // Outer animated ring
      g.append("circle")
        .attr("cx", nx)
        .attr("cy", ny)
        .attr("r", 14)
        .attr("fill", "none")
        .attr("stroke", "#06b6d4")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,3")
        .attr("pointer-events", "none")
        .attr("opacity", 0.75);

      // Nominal text label
      g.append("text")
        .attr("x", nx + 16)
        .attr("y", ny - 6)
        .attr("font-family", "monospace")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "#06b6d4")
        .attr("pointer-events", "none")
        .text("Nominal (0, 0)");
    }

    // 9. Interactive Mouse Events
    circles
      .on("mouseenter", function (event: MouseEvent, d: SensitivityPoint) {
        d3.select(this)
          .attr("r", sizeScale(d) + 3)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 2.5)
          .attr("fill-opacity", 1);

        renderCrosshairs(d);
        setHoveredPoint(d);

        // Calculate tooltip coordinates relative to container
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        }
      })
      .on("mousemove", function (event: MouseEvent) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        }
      })
      .on("mouseleave", function (_event: MouseEvent, d: SensitivityPoint) {
        const strokeColor =
          selectedPoint && selectedPoint.id === d.id
            ? "#ffffff"
            : d.isNominal
            ? "#06b6d4"
            : isDark
            ? "#0f172a"
            : "#ffffff";
        const strokeW = selectedPoint && selectedPoint.id === d.id ? 3 : d.isNominal ? 2.5 : 1.2;
        const fillOp = d.isNominal ? 1 : selectedPoint && selectedPoint.id !== d.id ? 0.45 : 0.8;

        d3.select(this)
          .attr("r", sizeScale(d))
          .attr("stroke", strokeColor)
          .attr("stroke-width", strokeW)
          .attr("fill-opacity", fillOp);

        setHoveredPoint(null);
        setTooltipPos(null);

        if (selectedPoint) {
          renderCrosshairs(selectedPoint);
        } else {
          crosshairG.selectAll("*").remove();
        }
      })
      .on("click", function (_event: MouseEvent, d: SensitivityPoint) {
        onSelectPoint(selectedPoint?.id === d.id ? null : d);
      });
  }, [
    data,
    dimensions,
    xAxis,
    yAxis,
    colorBy,
    sizeBy,
    targetAltitudeKm,
    targetVelocityMs,
    selectedPoint,
    onSelectPoint,
    showTrendline,
    showSafeEnvelope,
    isDark,
    regressionStats,
  ]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden select-none">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-auto overflow-visible"
      />

      {/* Floating Dynamic Tooltip */}
      {hoveredPoint && tooltipPos && (
        <div
          className="absolute z-50 pointer-events-none p-3 rounded-xl bg-slate-950/95 border border-cyan-800/80 text-white shadow-2xl backdrop-blur-md text-xs font-mono transition-transform duration-75"
          style={{
            left: `${Math.min(dimensions.width - 240, Math.max(10, tooltipPos.x + 14))}px`,
            top: `${Math.min(dimensions.height - 180, Math.max(10, tooltipPos.y - 120))}px`,
            width: "230px",
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <span className="font-bold flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: STATUS_COLORS[hoveredPoint.status] }}
              />
              <span>{hoveredPoint.isNominal ? "Nominal Baseline" : `Run #${hoveredPoint.id}`}</span>
            </span>
            <span
              className="text-[10px] px-1.5 py-0.2 rounded font-bold"
              style={{
                backgroundColor: `${STATUS_COLORS[hoveredPoint.status]}20`,
                color: STATUS_COLORS[hoveredPoint.status],
                border: `1px solid ${STATUS_COLORS[hoveredPoint.status]}60`,
              }}
            >
              {hoveredPoint.status}
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Thrust Fluctuation:</span>
              <span className={`font-bold ${hoveredPoint.thrustPct >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                {hoveredPoint.thrustPct > 0 ? "+" : ""}
                {hoveredPoint.thrustPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Fuel Margin Fluctuation:</span>
              <span className={`font-bold ${hoveredPoint.fuelMarginPct >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
                {hoveredPoint.fuelMarginPct > 0 ? "+" : ""}
                {hoveredPoint.fuelMarginPct.toFixed(1)}%
              </span>
            </div>
            <div className="border-t border-slate-800/80 my-1 pt-1" />
            <div className="flex justify-between">
              <span className="text-slate-400">Final Velocity:</span>
              <span className="text-white font-bold">{Math.round(hoveredPoint.finalVelocityMs).toLocaleString()} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Δv vs Target Orbit:</span>
              <span
                className={`font-bold ${
                  hoveredPoint.velocityMarginMs >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {hoveredPoint.velocityMarginMs > 0 ? "+" : ""}
                {Math.round(hoveredPoint.velocityMarginMs)} m/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Max Altitude:</span>
              <span className="text-cyan-300 font-bold">{hoveredPoint.finalAltitudeKm.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Max Dynamic Q:</span>
              <span
                className={`font-bold ${
                  hoveredPoint.maxDynamicPressureKPa > 42 ? "text-rose-400" : "text-slate-300"
                }`}
              >
                {hoveredPoint.maxDynamicPressureKPa.toFixed(1)} kPa
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Max G-Force:</span>
              <span
                className={`font-bold ${
                  hoveredPoint.maxAccelerationG > 4.5 ? "text-rose-400" : "text-slate-300"
                }`}
              >
                {hoveredPoint.maxAccelerationG.toFixed(2)} g
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-sans mt-2 pt-1 border-t border-slate-800 text-center">
            Click point to pin details &amp; compare
          </div>
        </div>
      )}
    </div>
  );
};
