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
}: XYPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

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
      {/* Dot grid */}
      <svg width={padSize} height={padSize} viewBox={`0 0 ${padSize} ${padSize}`}
        className="absolute inset-0 pointer-events-none">
        {dots.map((d, i) => {
          const proximity = Math.max(0, 1 - d.dist * 2.8);
          const opacity = 0.08 + proximity * 0.5;
          const r = 1.2 + proximity * 1;
          return (
            <circle key={i} cx={d.cx * padSize} cy={d.cy * padSize}
              r={r} fill="white" opacity={opacity} />
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
          style={{ boxShadow: "0 0 6px rgba(255,255,255,0.45), 0 0 14px rgba(255,255,255,0.1)" }} />
      </div>
    </div>
  );
}
