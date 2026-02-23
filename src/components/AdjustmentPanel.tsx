"use client";

import React, { useState, useCallback, useRef } from "react";
import type { AdjustmentTool } from "@/lib/types";
import type { TranslationKeys } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import {
  IconExposure,
  IconContrast,
  IconHighlights,
  IconShadows,
  IconWhites,
  IconBlacks,
  IconWarmth,
  IconTint,
  IconVibrance,
  IconSaturation,
  IconTexture,
  IconClarity,
  IconDehaze,
  IconGrain,
  IconVignette,
  IconBloom,
  IconSharpen,
  IconNoise,
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
  labelKey: TranslationKeys;
  icon: React.FC<{ size?: number; className?: string }>;
  min: number;
  max: number;
  /** CSS gradient for the slider track — like Lightroom's colored sliders */
  gradient?: string;
}

/* ── Lightroom-style tool definitions per category ── */
const CATEGORY_TOOLS: Record<EditCategory, ToolDef[]> = {
  light: [
    { key: "exposure", labelKey: "adj_exposure", icon: IconExposure, min: -100, max: 100 },
    { key: "contrast", labelKey: "adj_contrast", icon: IconContrast, min: -100, max: 100 },
    { key: "highlights", labelKey: "adj_highlights", icon: IconHighlights, min: -100, max: 100 },
    { key: "shadows", labelKey: "adj_shadows", icon: IconShadows, min: -100, max: 100 },
    { key: "whites", labelKey: "adj_whites", icon: IconWhites, min: -100, max: 100 },
    { key: "blacks", labelKey: "adj_blacks", icon: IconBlacks, min: -100, max: 100 },
  ],
  color: [
    {
      key: "warmth", labelKey: "adj_temperature", icon: IconWarmth, min: -100, max: 100,
      gradient: "linear-gradient(to right, #3b82f6, #94a3b8, #f59e0b)",
    },
    {
      key: "tint", labelKey: "adj_tint", icon: IconTint, min: -100, max: 100,
      gradient: "linear-gradient(to right, #22c55e, #94a3b8, #d946ef)",
    },
    {
      key: "vibrance", labelKey: "adj_vibrance", icon: IconVibrance, min: -100, max: 100,
      gradient: "linear-gradient(to right, #64748b, #8b5cf6)",
    },
    {
      key: "saturation", labelKey: "adj_saturation", icon: IconSaturation, min: -100, max: 100,
      gradient: "linear-gradient(to right, #94a3b8, #ef4444)",
    },
  ],
  effects: [
    { key: "texture", labelKey: "adj_texture", icon: IconTexture, min: -100, max: 100 },
    { key: "clarity", labelKey: "adj_clarity", icon: IconClarity, min: -100, max: 100 },
    { key: "dehaze", labelKey: "adj_dehaze", icon: IconDehaze, min: -100, max: 100 },
    { key: "grain", labelKey: "adj_grain", icon: IconGrain, min: 0, max: 100 },
    { key: "vignette", labelKey: "adj_vignette", icon: IconVignette, min: -100, max: 100 },
    { key: "bloom", labelKey: "adj_bloom", icon: IconBloom, min: 0, max: 100 },
  ],
  detail: [
    { key: "sharpen", labelKey: "adj_sharpening", icon: IconSharpen, min: 0, max: 100 },
    { key: "noise", labelKey: "adj_noiseReduction", icon: IconNoise, min: 0, max: 100 },
  ],
};

const CATEGORIES: { key: EditCategory; labelKey: TranslationKeys }[] = [
  { key: "light", labelKey: "adj_light" },
  { key: "color", labelKey: "adj_color" },
  { key: "effects", labelKey: "adj_effects" },
  { key: "detail", labelKey: "adj_detail" },
];

/* ── Single slider row — memoized for performance ── */
const SliderRow = React.memo(function SliderRow({
  tool,
  label,
  value,
  isActive,
  onSelect,
  onChange,
}: {
  tool: ToolDef;
  label: string;
  value: number;
  isActive: boolean;
  onSelect: () => void;
  onChange: (v: number) => void;
}) {
  const isBipolar = tool.min < 0;
  const pct = isBipolar
    ? 50 + (value / (value >= 0 ? tool.max : -tool.min)) * 50
    : (value / tool.max) * 100;

  const Icon = tool.icon;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = tool.min + ratio * (tool.max - tool.min);
      onChange(Math.round(raw));
    },
    [onChange, tool.min, tool.max]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
      onSelect();
      updateFromPointer(e.clientX);
    },
    [onSelect, updateFromPointer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      updateFromPointer(e.clientX);
    },
    [updateFromPointer]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const hasGradient = !!tool.gradient;

  return (
    <div
      className={`rounded-lg px-3 py-2.5 transition-colors ${isActive ? "bg-white/[0.04]" : ""}`}
      onClick={onSelect}
    >
      {/* Label row: icon + name + value */}
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={isActive ? "text-white/80" : "text-white/35"} />
        <span
          className={`text-[12px] flex-1 transition-colors ${
            isActive ? "text-white font-medium" : "text-white/55"
          }`}
        >
          {label}
        </span>
        <span className="text-[11px] text-white/40 font-mono tabular-nums min-w-[32px] text-right">
          {isBipolar && value > 0 ? "+" : ""}
          {value}
        </span>
      </div>

      {/* Slider track — pointer-based for smooth performance */}
      <div
        ref={trackRef}
        className="relative h-[6px] rounded-full select-none touch-none cursor-pointer"
        style={{
          background: hasGradient ? tool.gradient : "rgba(255,255,255,0.08)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Fill (only for non-gradient tracks) */}
        {!hasGradient && (
          <>
            {isBipolar ? (
              <div
                className="absolute top-0 h-full rounded-full bg-white/40"
                style={{
                  left: value >= 0 ? "50%" : `${pct}%`,
                  width: `${Math.abs(pct - 50)}%`,
                }}
              />
            ) : (
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-white/40"
                style={{ width: `${pct}%` }}
              />
            )}
          </>
        )}

        {/* Center tick for bipolar */}
        {isBipolar && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-3 bg-white/20 rounded-full" />
        )}

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[2.5px] border-white bg-[#111] shadow-[0_1px_4px_rgba(0,0,0,0.5)] pointer-events-none"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
      </div>
    </div>
  );
});

export default function AdjustmentPanel({
  values,
  activeTool,
  onSelectTool,
  onChangeValue,
}: AdjustmentPanelProps) {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<EditCategory>("light");
  const categoryTools = CATEGORY_TOOLS[activeCategory];

  return (
    <div className="w-full flex flex-col">
      {/* Category tabs — Light / Color / Effects / Detail */}
      <div className="flex items-center gap-1 px-4 pb-2">
        {CATEGORIES.map((cat) => {
          const isActive = cat.key === activeCategory;
          const hasChanges = CATEGORY_TOOLS[cat.key].some(
            (t) => values[t.key] !== 0
          );
          return (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                const first = CATEGORY_TOOLS[cat.key][0];
                if (first) onSelectTool(first.key);
              }}
              className={`relative px-3.5 py-1.5 rounded-full text-[11px] tracking-[0.5px] font-medium transition-all ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/30 hover:text-white/55"
              }`}
            >
              {t(cat.labelKey)}
              {hasChanges && !isActive && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/50" />
              )}
            </button>
          );
        })}
      </div>

      {/* Slider list */}
      <div className="flex flex-col gap-0">
        {categoryTools.map((tl) => (
          <SliderRow
            key={tl.key}
            tool={tl}
            label={t(tl.labelKey)}
            value={values[tl.key]}
            isActive={tl.key === activeTool}
            onSelect={() => onSelectTool(tl.key)}
            onChange={(v) => onChangeValue(tl.key, v)}
          />
        ))}
      </div>

      {/* Reset category */}
      <div className="flex justify-center pt-1.5 pb-1">
        <button
          onClick={() =>
            categoryTools.forEach((tl) => onChangeValue(tl.key, 0))
          }
          className="text-[10px] text-white/25 tracking-[1.5px] uppercase hover:text-white/55 transition-colors"
        >
          {t("adj_resetCategory", { category: t(CATEGORIES.find((c) => c.key === activeCategory)?.labelKey ?? "adj_light") })}
        </button>
      </div>
    </div>
  );
}

