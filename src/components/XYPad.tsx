"use client";

import React, { useRef, useCallback, useState, useMemo } from "react";

interface XYPadProps {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  /** Called once on pointer-up — use for expensive ops like re-transfer */
  onCommit?: (x: number, y: number) => void;
  disabled?: boolean;
  /** Render as compact floating thumbnail (for overlay on image) */
  compact?: boolean;
  /** Axis labels */
  xLabel?: string;
  yLabel?: string;
  /** Help tooltip */
  helpText?: string;
}

const GRID = 8;

export default function XYPad({
  x,
  y,
  onChange,
  onCommit,
  disabled = false,
  compact = false,
  xLabel,
  yLabel,
}: XYPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const update = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      onChange(nx, ny);
    },
    [disabled, onChange]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setDragging(true);
      update(e.clientX, e.clientY);
    },
    [update]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      update(e.clientX, e.clientY);
    },
    [dragging, update]
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    onCommit?.(x, y);
  }, [onCommit, x, y]);

  const onDoubleClick = useCallback(() => {
    onChange(0.5, 0.5);
    onCommit?.(0.5, 0.5);
  }, [onChange, onCommit]);

  const displayY = 1 - y;

  const dots = useMemo(() => {
    const arr: { cx: number; cy: number; dist: number }[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const cx = (col + 0.5) / GRID;
        const cy = (row + 0.5) / GRID;
        const dx = cx - x;
        const dy = cy - displayY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        arr.push({ cx, cy, dist });
      }
    }
    return arr;
  }, [x, displayY]);

  const padSize = compact ? 110 : 140;
  const handleLeftPct = x * 100;
  const handleTopPct = displayY * 100;

  return (
    <div className="relative flex flex-col items-end gap-1">
      {/* The pad */}
      <div className="relative">
        {/* ? button — top-right corner */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowLabels((v) => !v); }}
          className="absolute -top-2 -right-2 z-20 w-5 h-5 rounded-full bg-black/60 border border-white/15 flex items-center justify-center text-[9px] text-white/40 hover:text-white/70 transition-colors"
        >
          ?
        </button>

        <div
          ref={containerRef}
          className="relative select-none overflow-hidden"
          style={{
            width: padSize,
            height: padSize,
            borderRadius: 16,
            background: "rgba(15,15,15,0.88)",
            backdropFilter: "blur(16px)",
            border: dragging ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.06)",
            touchAction: "none",
            cursor: dragging ? "grabbing" : "grab",
            transition: "border-color 0.2s",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          {/* Cool gradient — teal/blue tint for Kinolu identity */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, rgba(60,60,70,0.06) 0%, rgba(50,160,180,0.10) 100%)" }} />

          {/* Dot grid */}
          <svg width={padSize} height={padSize} viewBox={`0 0 ${padSize} ${padSize}`}
            className="absolute inset-0 pointer-events-none">
            {dots.map((d, i) => {
              const proximity = Math.max(0, 1 - d.dist * 2.8);
              const opacity = 0.08 + proximity * 0.5;
              const r = 1.2 + proximity * 1;
              const fill = proximity > 0.15 ? `rgba(180,230,235,${opacity})` : `rgba(255,255,255,${opacity})`;
              return (
                <circle key={i} cx={d.cx * padSize} cy={d.cy * padSize}
                  r={r} fill={fill} />
              );
            })}
          </svg>

          {/* Thin crosshair at handle */}
          <div className="absolute pointer-events-none" style={{
            left: `${handleLeftPct}%`, top: 0, bottom: 0, width: 1,
            background: "rgba(255,255,255,0.04)",
          }} />
          <div className="absolute pointer-events-none" style={{
            top: `${handleTopPct}%`, left: 0, right: 0, height: 1,
            background: "rgba(255,255,255,0.04)",
          }} />

          {/* Handle dot */}
          <div className="absolute pointer-events-none z-10" style={{
            left: `${handleLeftPct}%`, top: `${handleTopPct}%`,
            transform: `translate(-50%, -50%) scale(${dragging ? 1.3 : 1})`,
            transition: dragging ? "none" : "transform 0.15s ease",
          }}>
            <div className="w-3.5 h-3.5 rounded-full bg-white"
              style={{ boxShadow: "0 0 6px rgba(140,220,230,0.5), 0 0 14px rgba(80,200,220,0.15)" }} />
          </div>

          {/* Axis labels — only shown when ? is toggled on */}
          {showLabels && (
            <>
              {/* Y axis label (left side, vertical) */}
              {yLabel && (
                <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="text-[7px] text-white/40 tracking-wider font-medium"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
                    {yLabel}
                  </span>
                </div>
              )}
              {/* X axis label (bottom center) */}
              {xLabel && (
                <div className="absolute bottom-1 inset-x-0 pointer-events-none text-center">
                  <span className="text-[7px] text-white/40 tracking-wider font-medium">{xLabel}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
