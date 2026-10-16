import React, { useState, useRef, useEffect } from "react";
import { SCIENTIFIC_METRICS, ScientificParameterDetail } from "../data/scientificParameters";
import { Info, HelpCircle, X, Sparkles, BookOpen, Layers } from "lucide-react";

interface ScientificMetricTooltipProps {
  metricKey: keyof typeof SCIENTIFIC_METRICS | string;
  customTitle?: string;
  className?: string;
  iconOnly?: boolean;
  align?: "left" | "right" | "center";
}

export const ScientificMetricTooltip: React.FC<ScientificMetricTooltipProps> = ({
  metricKey,
  customTitle,
  className = "",
  iconOnly = true,
  align = "left",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const data: ScientificParameterDetail | undefined = SCIENTIFIC_METRICS[metricKey];

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsHovered(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!data) return null;

  const showTooltip = isOpen || isHovered;

  const getAlignmentClasses = () => {
    switch (align) {
      case "right":
        return "right-0";
      case "center":
        return "left-1/2 -translate-x-1/2";
      case "left":
      default:
        return "left-0 sm:left-auto sm:-left-4";
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-0.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-950/40 transition-colors cursor-pointer inline-flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        title={`Scientific Significance of ${data.name}`}
        aria-label={`Learn about ${data.name}`}
        aria-expanded={showTooltip}
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        {!iconOnly && customTitle && (
          <span className="text-[10px] font-mono text-cyan-400 underline decoration-dotted">
            {customTitle}
          </span>
        )}
      </button>

      {/* Floating Interactive Scientific Tooltip Card */}
      {showTooltip && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-full mb-2 w-80 sm:w-96 p-4 rounded-xl bg-[#080d1a] border border-cyan-800/80 shadow-2xl text-left z-50 pointer-events-auto backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${getAlignmentClasses()}`}
          style={{ maxWidth: "calc(100vw - 32px)" }}
        >
          {/* Cyan Glow Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-t-xl" />

          {/* Card Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-white tracking-tight">
                  {data.name}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  {data.symbol}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  [{data.unit}]
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsHovered(false);
              }}
              className="text-slate-500 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Close tooltip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 text-xs">
            {/* Governing Physics Formula */}
            {data.formula && (
              <div className="p-2 rounded-lg bg-slate-950/90 border border-cyan-900/40 font-mono text-[11px] text-cyan-300 flex items-center justify-between shadow-inner">
                <span className="text-slate-500 text-[10px] uppercase font-sans">Formula:</span>
                <strong className="text-cyan-200 tracking-wide font-mono">{data.formula}</strong>
              </div>
            )}

            {/* Scientific Significance (Primary takeaway) */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Scientific Significance:
              </span>
              <p className="text-slate-200 text-xs leading-relaxed font-sans">
                {data.significance}
              </p>
            </div>

            {/* Governing Aerospace Principle */}
            <div className="space-y-1 pt-1 border-t border-slate-800/60">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-blue-400" />
                Physical Mechanism:
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                {data.governingPrinciple}
              </p>
            </div>

            {/* Typical Aerospace Range */}
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]">
              <div className="text-[10px] uppercase font-mono text-slate-500 font-semibold mb-0.5">
                Typical Flight Benchmark:
              </div>
              <div className="text-slate-300 font-mono text-[11px]">
                {data.typicalRange}
              </div>
            </div>

            {/* Role in Optimization */}
            <div className="pt-1 text-[11px] text-indigo-300 bg-indigo-950/30 p-2 rounded-lg border border-indigo-900/40">
              <span className="font-semibold text-indigo-200 block text-[10px] uppercase font-mono mb-0.5">
                Optimization Engine Impact:
              </span>
              <p className="leading-snug">{data.optimizationRole}</p>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Click icon to pin / Esc to close</span>
            <span className="text-cyan-400">AeroQuantum Physics</span>
          </div>
        </div>
      )}
    </div>
  );
};
