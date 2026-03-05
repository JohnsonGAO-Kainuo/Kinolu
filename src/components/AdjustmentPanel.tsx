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
  /** Called when a slider drag ends — use for committing undo boundary */
  onDragEnd?: () => void;
  /** Which category to show — controlled externally by parent sub-tabs */
  category?: EditCategory;
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

/* ── Single slider row ──
 *
 * Hybrid approach: label row on top, full-width slider track below.
 * The slider has a visible thumb (like before) but the TRACK area is
 * tall enough (28px touch target) that you can start dragging directly
 * without needing to precisely hit the thumb.
 *
 * Key UX fixes:
 * - Vertical dead-zone: if finger moves more vertically than horizontally
 *   in the first 8px of movement, the drag is cancelled so scrolling works.
 * - Horizontal drag commits immediately once past 4px dead-zone.
 * - touch-action: pan-y — lets the browser handle vertical scrolling
 *   unless we explicitly capture the pointer for horizontal drag.
 */
const SliderRow = React.memo(function SliderRow({
  tool,
  label,
  value,
  isActive,
  onSelect,
  onChange,
  onDragEnd,
}: {
  tool: ToolDef;
  label: string;
  value: number;
  isActive: boolean;
  onSelect: () => void;
  onChange: (v: number) => void;
  onDragEnd?: () => void;
}) {
  const isBipolar = tool.min < 0;
  const pct = isBipolar
    ? 50 + (value / (value >= 0 ? tool.max : -tool.min)) * 50
    : (value / tool.max) * 100;

  const Icon = tool.icon;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const captured = useRef(false);
  const pendingX = useRef(0);
  const moveRafId = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const decided = useRef(false); // Have we decided drag vs scroll?

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
      // Don't prevent default yet — let browser decide scroll vs drag
      dragging.current = true;
      captured.current = false;
      decided.current = false;
      startX.current = e.clientX;
      startY.current = e.clientY;
      pendingX.current = e.clientX;
      onSelect();
    },
    [onSelect]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = Math.abs(e.clientX - startX.current);
      const dy = Math.abs(e.clientY - startY.current);

      if (!decided.current) {
        // Need at least 6px of movement to decide direction
        if (dx < 6 && dy < 6) return;
        decided.current = true;

        if (dy > dx) {
          // User is scrolling vertically — abort drag completely
          dragging.current = false;
          return;
        }
        // Horizontal drag confirmed — capture pointer
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch { /* ignore */ }
        captured.current = true;
      }

      if (!captured.current) return;

      pendingX.current = e.clientX;
      if (!moveRafId.current) {
        moveRafId.current = requestAnimationFrame(() => {
          moveRafId.current = 0;
          updateFromPointer(pendingX.current);
        });
      }
    },
    [updateFromPointer]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (moveRafId.current) {
        cancelAnimationFrame(moveRafId.current);
        moveRafId.current = 0;
      }
      if (dragging.current && captured.current) {
        updateFromPointer(pendingX.current);
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
      }
      dragging.current = false;
      captured.current = false;
      decided.current = false;
      onDragEnd?.();
    },
    [onDragEnd, updateFromPointer]
  );

  const hasGradient = !!tool.gradient;
  const isNonZero = value !== 0;

  return (
    <div
      className={`rounded-lg px-3 py-2 select-none transition-colors ${isActive ? "bg-white/[0.04]" : ""}`}
      onClick={onSelect}
    >
      {/* Label row: icon + name + value */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon
          size={14}
          className={`shrink-0 transition-colors ${
            isActive ? "text-white/80" : isNonZero ? "text-white/50" : "text-white/30"
          }`}
        />
        <span
          className={`text-[12px] flex-1 transition-colors ${
            isActive ? "text-white font-medium" : isNonZero ? "text-white/65" : "text-white/45"
          }`}
        >
          {label}
        </span>
        <span className={`text-[11px] font-mono tabular-nums min-w-[32px] text-right transition-colors ${isNonZero ? "text-white/50" : "text-white/20"}`}>
          {isBipolar && value > 0 ? "+" : ""}
          {value}
        </span>
      </div>

      {/* Slider track — tall touch target with visible thumb */}
      <div
        ref={trackRef}
        className="relative h-7 flex items-center cursor-pointer"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Visual track bar (thin line centered in the touch area) */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[5px] rounded-full"
          style={{
            background: hasGradient ? tool.gradient : "rgba(255,255,255,0.08)",
          }}
        >
          {/* Fill (only for non-gradient tracks) */}
          {!hasGradient && (
            <>
              {isBipolar ? (
                <div
                  className="absolute top-0 h-full rounded-full bg-white/35"
                  style={{
                    left: value >= 0 ? "50%" : `${pct}%`,
                    width: `${Math.abs(pct - 50)}%`,
                  }}
                />
              ) : (
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-white/35"
                  style={{ width: `${pct}%` }}
                />
              )}
            </>
          )}

          {/* Center tick for bipolar */}
          {isBipolar && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-3 bg-white/20 rounded-full" />
          )}
        </div>

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full border-[2px] border-white bg-[#111] shadow-[0_1px_4px_rgba(0,0,0,0.5)] pointer-events-none"
          style={{ left: `calc(${pct}% - 9px)` }}
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
  onDragEnd,
  category: externalCategory,
}: AdjustmentPanelProps) {
  const { t } = useI18n();
  const [internalCategory, setInternalCategory] = useState<EditCategory>("light");
  const activeCategory = externalCategory ?? internalCategory;
  const categoryTools = CATEGORY_TOOLS[activeCategory];

  return (
    <div className="w-full flex flex-col pb-2">
      {/* Category tabs — only shown when NOT controlled externally */}
      {!externalCategory && (
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-1">
            {CATEGORIES.map((cat) => {
              const isActive = cat.key === internalCategory;
              const hasChanges = CATEGORY_TOOLS[cat.key].some(
                (t) => values[t.key] !== 0
              );
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setInternalCategory(cat.key);
                    const first = CATEGORY_TOOLS[cat.key][0];
                    if (first) onSelectTool(first.key);
                  }}
                  className={`relative px-3 py-1.5 rounded-full text-[11px] tracking-[0.5px] font-medium transition-all ${
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
        </div>
      )}

      {/* Reset — always visible */}
      <div className="flex justify-end px-4 pb-1">
        <button
          onClick={() => {
            categoryTools.forEach((tl) => onChangeValue(tl.key, 0));
            onDragEnd?.();
          }}
          className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] text-white/35 tracking-wider hover:text-white/60 hover:bg-white/10 transition-colors shrink-0"
        >
          {t("adj_resetCategory", { category: t(CATEGORIES.find((c) => c.key === activeCategory)?.labelKey ?? "adj_light") })}
        </button>
      </div>

      {/* Slider list */}
      <div className="flex flex-col gap-0.5 px-1">
        {categoryTools.map((tl) => (
          <SliderRow
            key={tl.key}
            tool={tl}
            label={t(tl.labelKey)}
            value={values[tl.key]}
            isActive={tl.key === activeTool}
            onSelect={() => onSelectTool(tl.key)}
            onChange={(v) => onChangeValue(tl.key, v)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

