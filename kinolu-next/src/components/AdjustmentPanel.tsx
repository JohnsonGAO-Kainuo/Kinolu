"use client";

import React from "react";
import type { AdjustmentTool } from "@/lib/types";
import {
  IconExposure,
  IconContrast,
  IconHighlights,
  IconShadows,
  IconSaturation,
  IconVibrance,
  IconWarmth,
  IconTint,
  IconGrain,
  IconSharpen,
  IconVignette,
  IconBloom,
} from "./icons";

interface AdjustmentPanelProps {
  values: Record<AdjustmentTool, number>;
  activeTool: AdjustmentTool;
  onSelectTool: (tool: AdjustmentTool) => void;
  onChangeValue: (tool: AdjustmentTool, value: number) => void;
}

const TOOLS: { key: AdjustmentTool; label: string; icon: React.FC<{ size?: number; className?: string }>; min: number; max: number }[] = [
  { key: "exposure", label: "Exposure", icon: IconExposure, min: -100, max: 100 },
  { key: "contrast", label: "Contrast", icon: IconContrast, min: -100, max: 100 },
  { key: "highlights", label: "Highlights", icon: IconHighlights, min: -100, max: 100 },
  { key: "shadows", label: "Shadows", icon: IconShadows, min: -100, max: 100 },
  { key: "saturation", label: "Saturation", icon: IconSaturation, min: -100, max: 100 },
  { key: "vibrance", label: "Vibrance", icon: IconVibrance, min: -100, max: 100 },
  { key: "warmth", label: "Warmth", icon: IconWarmth, min: -100, max: 100 },
  { key: "tint", label: "Tint", icon: IconTint, min: -100, max: 100 },
  { key: "grain", label: "Grain", icon: IconGrain, min: 0, max: 100 },
  { key: "sharpen", label: "Sharpen", icon: IconSharpen, min: 0, max: 100 },
  { key: "vignette", label: "Vignette", icon: IconVignette, min: 0, max: 100 },
  { key: "bloom", label: "Bloom", icon: IconBloom, min: 0, max: 100 },
];

export default function AdjustmentPanel({
  values,
  activeTool,
  onSelectTool,
  onChangeValue,
}: AdjustmentPanelProps) {
  const tool = TOOLS.find((t) => t.key === activeTool)!;
  const val = values[activeTool];
  const isBipolar = tool.min < 0;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Tool grid */}
      <div className="grid grid-cols-4 gap-x-4 gap-y-3 px-5">
        {TOOLS.map((t) => {
          const isActive = t.key === activeTool;
          const hasValue = values[t.key] !== 0;
          const Icon = t.icon;

          return (
            <button
              key={t.key}
              onClick={() => onSelectTool(t.key)}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-white/10 border border-white/60"
                    : "bg-k-surface border border-k-border"
                }`}
              >
                <Icon
                  size={20}
                  className={`transition-colors ${
                    isActive
                      ? "text-white"
                      : hasValue
                      ? "text-k-text-secondary"
                      : "text-k-muted"
                  }`}
                />
              </div>
              <span
                className={`text-[9px] font-medium tracking-wider transition-colors ${
                  isActive ? "text-white" : "text-k-text-secondary"
                }`}
              >
                {t.label}
              </span>
              {/* Dot indicator for non-zero value */}
              {hasValue && !isActive && (
                <div className="w-1 h-1 rounded-full bg-white/50 -mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active tool slider */}
      <div className="px-5 pt-2 border-t border-k-border">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[12px] font-semibold text-white">
            {tool.label}
          </span>
          <span className="text-[12px] text-k-text-secondary font-mono">
            {val > 0 && isBipolar ? "+" : ""}
            {val}
          </span>
        </div>
        <input
          type="range"
          className={isBipolar ? "k-slider-center" : "k-slider"}
          min={tool.min}
          max={tool.max}
          value={val}
          onChange={(e) =>
            onChangeValue(activeTool, Number(e.target.value))
          }
        />
        {/* Reset tap target */}
        <div className="flex justify-center mt-3">
          <button
            onClick={() => onChangeValue(activeTool, 0)}
            className="text-[10px] text-k-text-secondary tracking-wider uppercase hover:text-white transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
