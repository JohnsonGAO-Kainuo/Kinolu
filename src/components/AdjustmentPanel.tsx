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

/* ── Single slider row — Lightroom-style direct-drag interaction ──
 *
 * The ENTIRE row is the drag zone — touch anywhere on the row and drag
 * horizontally to adjust the value. No need to "select" first.
 *
 * Visual: icon + label on left, value on right, full-width slider bar
 * beneath that doubles as background fill.
 *
 * Touch-area is the full row height (~52px), not just the 6px track,
 * making it much easier to interact with on mobile.
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
  const rowRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pendingX = useRef(0);
  const moveRafId = useRef(0);
  // Track whether we've moved enough to be a drag vs. a tap
  const startX = useRef(0);
  const hasMoved = useRef(false);

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const el = rowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Use full row width as the slider range
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
      startX.current = e.clientX;
      hasMoved.current = false;
      pendingX.current = e.clientX;
      onSelect(); // Select immediately on touch — no delay
    },
    [onSelect]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      pendingX.current = e.clientX;
      // 4px dead zone before committing to drag (prevents accidental changes on tap)
      if (!hasMoved.current && Math.abs(e.clientX - startX.current) < 4) return;
      hasMoved.current = true;
      // Batch pointer events — at most 1 state update per animation frame
      if (!moveRafId.current) {
        moveRafId.current = requestAnimationFrame(() => {
          moveRafId.current = 0;
          updateFromPointer(pendingX.current);
        });
      }
    },
    [updateFromPointer]
  );

  const onPointerUp = useCallback(() => {
    // Flush pending RAF and apply final position synchronously
    if (moveRafId.current) {
      cancelAnimationFrame(moveRafId.current);
      moveRafId.current = 0;
    }
    if (dragging.current && hasMoved.current) {
      updateFromPointer(pendingX.current);
    }
    dragging.current = false;
    hasMoved.current = false;
    onDragEnd?.();
  }, [onDragEnd, updateFromPointer]);

  const hasGradient = !!tool.gradient;
  const isNonZero = value !== 0;

  return (
    <div
      ref={rowRef}
      className="relative rounded-lg select-none touch-none cursor-pointer overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Background fill — shows the current value as a colored bar behind the row */}
      {!hasGradient && isNonZero && (
        <div className="absolute inset-0 pointer-events-none">
          {isBipolar ? (
            <div
              className="absolute top-0 h-full bg-white/[0.06] rounded-lg"
              style={{
                left: value >= 0 ? "50%" : `${pct}%`,
                width: `${Math.abs(pct - 50)}%`,
              }}
            />
          ) : (
            <div
              className="absolute top-0 left-0 h-full bg-white/[0.06] rounded-lg"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      )}
      {hasGradient && isNonZero && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg opacity-15"
          style={{ background: tool.gradient }}
        />
      )}

      {/* Content layer */}
      <div className="relative px-3 py-3 flex items-center gap-2.5">
        <Icon
          size={15}
          className={`shrink-0 transition-colors ${
            isActive ? "text-white/90" : isNonZero ? "text-white/60" : "text-white/30"
          }`}
        />
        <span
          className={`text-[12px] flex-1 transition-colors ${
            isActive ? "text-white font-medium" : isNonZero ? "text-white/70" : "text-white/50"
          }`}
        >
          {label}
        </span>
        <span
          className={`text-[11px] font-mono tabular-nums min-w-[32px] text-right transition-colors ${
            isNonZero ? "text-white/60" : "text-white/25"
          }`}
        >
          {isBipolar && value > 0 ? "+" : ""}
          {value}
        </span>
      </div>

      {/* Thin track line — visual indicator at bottom of row */}
      <div className="absolute bottom-0 left-3 right-3 h-[2px]">
        {/* Track background */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: hasGradient ? tool.gradient : "rgba(255,255,255,0.06)",
          }}
        />

        {/* Fill on track */}
        {!hasGradient && isNonZero && (
          isBipolar ? (
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
          )
        )}

        {/* Center tick for bipolar */}
        {isBipolar && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-2 bg-white/15 rounded-full" />
        )}
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
      <div className="flex flex-col gap-px px-1">
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

