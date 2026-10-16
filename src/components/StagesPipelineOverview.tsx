import React, { useState } from "react";
import { STAGES_INFO, StageInfo } from "../data/stagesInfo";
import {
  Compass,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  Filter,
} from "lucide-react";

interface StagesPipelineOverviewProps {
  activeTab?: number;
  onNavigateToStage: (stageId: number) => void;
  defaultExpanded?: boolean;
}

export const StagesPipelineOverview: React.FC<StagesPipelineOverviewProps> = ({
  activeTab = 0,
  onNavigateToStage,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const categories = [
    "ALL",
    "Setup",
    "Physics Engine",
    "Classical Optimization",
    "Quantum Computing",
    "Analysis & Export",
  ];

  const filteredStages = STAGES_INFO.filter((s) => {
    if (selectedCategory === "ALL") return true;
    return s.category === selectedCategory;
  });

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-cyan-950/20 border border-cyan-800/40 p-5 shadow-xl space-y-4">
      {/* Overview Top Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-700/60 text-cyan-300 shadow-sm shadow-cyan-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Mission Workflow Pipeline: All 14 Stages Overview
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                14 Stages
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simple and brief descriptions for every stage in the end-to-end space launch optimization pipeline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle (Grid vs List) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Show stage grid cards"
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Show sequential pipeline list"
            >
              List
            </button>
          </div>

          {/* Expand / Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? "Collapse stages overview" : "Expand stages overview"}
          >
            <span>{isExpanded ? "Hide Details" : "Show All 14 Stages"}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* When collapsed, display a sleek quick summary bar */}
      {!isExpanded && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              All 14 stages configured: from <strong className="text-white">Stage 01 (Selection)</strong> to{" "}
              <strong className="text-white">Stage 14 (Atmospheric Re-entry)</strong>.
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Expand Full Stage Descriptions</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-150">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-cyan-400" />
              Filter Phase:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/20"
                    : "bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid View */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredStages.map((stage: StageInfo) => {
                const Icon = stage.icon;
                const isCurrentStage = activeTab === stage.id;

                return (
                  <div
                    key={stage.id}
                    onClick={() => onNavigateToStage(stage.id)}
                    className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrentStage
                        ? "bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/40"
                        : "bg-slate-950/70 hover:bg-slate-900 border-slate-800 hover:border-slate-700 hover:shadow-lg"
                    }`}
                  >
                    <div>
                      {/* Top line: Stage number and category */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isCurrentStage
                                ? "bg-cyan-500 text-slate-950"
                                : "bg-slate-900 text-slate-400 border border-slate-800"
                            }`}
                          >
                            STAGE {stage.step}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${stage.badgeColor}`}>
                            {stage.category}
                          </span>
                        </div>
                        {isCurrentStage && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-700/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Title and Icon */}
                      <div className="flex items-start gap-2.5 mb-2">
                        <div
                          className={`p-2 rounded-lg shrink-0 transition-colors ${
                            isCurrentStage
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-slate-900 text-cyan-400 border border-slate-800 group-hover:border-cyan-800/80"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-white leading-tight group-hover:text-cyan-300 transition-colors">
                            {stage.name}
                          </h3>
                        </div>
                      </div>

                      {/* Simple Brief Description (Primary takeaway) */}
                      <p className="text-xs text-slate-200 font-medium leading-relaxed mb-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                        {stage.simpleDescription}
                      </p>

                      {/* Detailed Brief Description */}
                      <p className="text-[11px] text-slate-400 leading-normal mb-3">
                        {stage.detailedBrief}
                      </p>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] mt-auto">
                      <span className="text-[10px] font-mono text-slate-500 truncate max-w-[130px]">
                        {stage.primaryKeyMetric}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToStage(stage.id);
                        }}
                        className={`font-mono text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                          isCurrentStage
                            ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                            : "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/60 border border-transparent hover:border-cyan-800/60"
                        }`}
                      >
                        <span>{isCurrentStage ? "Current" : "Open Stage"}</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Sequential Pipeline List View */
            <div className="space-y-2">
              {filteredStages.map((stage: StageInfo, idx: number) => {
                const Icon = stage.icon;
                const isCurrentStage = activeTab === stage.id;

                return (
                  <div
                    key={stage.id}
                    onClick={() => onNavigateToStage(stage.id)}
                    className={`group p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrentStage
                        ? "bg-cyan-950/40 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/40"
                        : "bg-slate-950/70 hover:bg-slate-900 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isCurrentStage
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-slate-900 text-slate-400 border border-slate-800"
                          }`}
                        >
                          {stage.step}
                        </span>
                      </div>

                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isCurrentStage
                            ? "bg-cyan-500 text-slate-950"
                            : "bg-slate-900 text-cyan-400 border border-slate-800"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {stage.name}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${stage.badgeColor}`}>
                            {stage.category}
                          </span>
                          {isCurrentStage && (
                            <span className="text-[9px] font-mono text-cyan-400 font-bold bg-cyan-950 px-1 rounded border border-cyan-700/60">
                              ACTIVE STAGE
                            </span>
                          )}
                        </div>

                        {/* Brief summary */}
                        <div className="text-xs text-slate-300 font-medium">
                          {stage.simpleDescription}
                        </div>
                        <div className="text-[11px] text-slate-400 hidden md:block">
                          {stage.detailedBrief}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className="text-[10px] font-mono text-slate-500 hidden lg:inline">
                        {stage.primaryKeyMetric}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToStage(stage.id);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
                          isCurrentStage
                            ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                            : "bg-slate-900 hover:bg-cyan-950 text-cyan-400 border border-slate-800 hover:border-cyan-800"
                        }`}
                      >
                        <span>{isCurrentStage ? "Viewing" : "Navigate"}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
