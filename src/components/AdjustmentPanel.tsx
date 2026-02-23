"use client";

import React, { useState } from "react";
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

type EditCategory = "light" | "color" | "effects" | "detail";

interface ToolDef {
  key: AdjustmentTool;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  min: number;
  max: number;
  category: EditCategory;
}

const TOOLS: ToolDef[] = [
  { key: "exposure", label: "Exposure", icon: IconExposure, min: -100, max: 100, category: "light" },
  { key: "contrast", label: "Contrast", icon: IconContrast, min: -100, max: 100, category: "light" },
  { key: "highlights", label: "Highlights", icon: IconHighlights, min: -100, max: 100, category: "light" },
  { key: "shadows", label: "Shadows", icon: IconShadows, min: -100, max: 100, category: "light" },
  { key: "saturation", label: "Saturation", icon: IconSaturation, min: -100, max: 100, category: "color" },
  { key: "vibrance", label: "Vibrance", icon: IconVibrance, min: -100, max: 100, category: "color" },
  { key: "warmth", label: "Warmth", icon: IconWarmth, min: -100, max: 100, category: "color" },
  { key: "tint", label: "Tint", icon: IconTint, min: -100, max: 100, category: "color" },
  { key: "grain", label: "Grain", icon: IconGrain, min: 0, max: 100, category: "effects" },
  { key: "vignette", label: "Vignette", icon: IconVignette, min: 0, max: 100, category: "effects" },
  { key: "bloom", label: "Bloom", icon: IconBloom, min: 0, max: 100, category: "effects" },
  { key: "sharpen", label: "Sharpen", icon: IconSharpen, min: 0, max: 100, category: "detail" },
];

const CATEGORIES: { key: EditCategory; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "color", label: "Color" },
  { key: "effects", label: "Effects" },
  { key: "detail", label: "Detail" },
];

export default function AdjustmentPanel({
  values,
  activeTool,
  onSelectTool,
  onChangeValue,
}: AdjustmentPanelProps) {
  const [activeCategory, setActiveCategory] = useState<EditCategory>("light");
  const categoryTools = TOOLS.filter((t) => t.category === activeCategory);

  return (
    <div className="w-full flex flex-col">
      {/* Category tabs — like Lightroom's Light/Color/Effects/Detail */}
      <div className="flex items-center gap-1 px-4 pb-3">
        {CATEGORIES.map((cat) => {
          const isActive = cat.key === activeCategory;
          const hasChanges = TOOLS.filter((t) => t.category === cat.key).some((t) => values[t.key] !== 0);
          return (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                const first = TOOLS.find((t) => t.category === cat.key);
                if (first) onSelectTool(first.key);
              }}
              className={`relative px-3 py-1.5 rounded-full text-[11px] tracking-[0.5px] font-medium transition-all ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              {cat.label}
              {hasChanges && !isActive && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/50" />
              )}
            </button>
          );
        })}
      </div>

      {/* Sliders list for the active category — Lightroom-style stacked sliders */}
      <div className="flex flex-col gap-0.5 px-4">
        {categoryTools.map((t) => {
          const val = values[t.key];
          const isBipolar = t.min < 0;
          const isActive = t.key === activeTool;
          const pct = isBipolar
            ? 50 + (val / (val >= 0 ? t.max : -t.min)) * 50
            : (val / t.max) * 100;

          return (
            <div
              key={t.key}
              className={`rounded-lg px-3 py-2 transition-colors ${isActive ? "bg-white/[0.04]" : ""}`}
              onClick={() => onSelectTool(t.key)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[12px] transition-colors ${isActive ? "text-white font-medium" : "text-white/60"}`}>
                  {t.label}
                </span>
                <span className="text-[12px] text-white/50 font-mono tabular-nums min-w-[32px] text-right">
                  {isBipolar && val > 0 ? "+" : ""}{val}
                </span>
              </div>
              {/* Slider track */}
              <div className="relative h-[3px] rounded-full bg-white/[0.08]">
                {isBipolar ? (
                  <>
                    <div className="absolute top-0 h-full rounded-full bg-white/30 transition-all"
                      style={{
                        left: val >= 0 ? "50%" : `${pct}%`,
                        width: `${Math.abs(pct - 50)}%`,
                      }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-2 bg-white/15" />
                  </>
                ) : (
                  <div className="absolute top-0 left-0 h-full rounded-full bg-white/30 transition-all"
                    style={{ width: `${pct}%` }} />
                )}
                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white bg-black transition-all"
                  style={{ left: `calc(${pct}% - 8px)` }}
                />
              </div>
              <input
                type="range"
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                style={{ position: "relative", height: 24, marginTop: -10 }}
                min={t.min}
                max={t.max}
                value={val}
                onChange={(e) => onChangeValue(t.key, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>

      {/* Reset button */}
      <div className="flex justify-center pt-2 pb-1">
        <button
          onClick={() => categoryTools.forEach((t) => onChangeValue(t.key, 0))}
          className="text-[10px] text-white/30 tracking-[1.5px] uppercase hover:text-white/60 transition-colors"
        >
          Reset {CATEGORIES.find((c) => c.key === activeCategory)?.label}
        </button>
      </div>
    </div>
  );
}

