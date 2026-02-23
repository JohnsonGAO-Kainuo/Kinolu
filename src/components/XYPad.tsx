"use client";

import React, { useRef, useCallback, useState, useMemo } from "react";

interface XYPadProps {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  disabled?: boolean;
  /** Render as compact floating thumbnail (for overlay on image) */
  compact?: boolean;
}

const GRID = 10; // 10×10 dot grid

export default function XYPad({
  x,
  y,
  onChange,
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
      const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
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

  const onPointerUp = useCallback(() => setDragging(false), []);
  const onDoubleClick = useCallback(() => onChange(0.5, 0.5), [onChange]);

  /* Build dot grid */
  const dots = useMemo(() => {
    const arr: { cx: number; cy: number; dist: number }[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const cx = (col + 0.5) / GRID;
        const cy = (row + 0.5) / GRID;
        const dx = cx - x;
        const dy = cy - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        arr.push({ cx, cy, dist });
      }
    }
    return arr;
  }, [x, y]);

  const size = compact ? 110 : 140;

  return (
    <div
      ref={containerRef}
      className="relative select-none rounded-2xl overflow-hidden"
      style={{
        width: size,
        height: size,
        background: "rgba(20,20,20,0.85)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        touchAction: "none",
        cursor: dragging ? "grabbing" : "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {/* Dot grid — dots glow near the handle position */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 pointer-events-none"
      >
        {dots.map((d, i) => {
          const proximity = Math.max(0, 1 - d.dist * 2.5);
          const opacity = 0.15 + proximity * 0.65;
          const r = compact ? 1.6 : 2;
          const radius = r + proximity * 1.2;
          return (
            <circle
              key={i}
              cx={d.cx * size}
              cy={d.cy * size}
              r={radius}
              fill="white"
              opacity={opacity}
            />
          );
        })}
      </svg>

      {/* Handle dot — larger, bright */}
      <div
        className="absolute pointer-events-none z-10"
        style={{
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          transform: `translate(-50%, -50%) scale(${dragging ? 1.3 : 1})`,
          transition: dragging ? "none" : "transform 0.15s ease",
        }}
      >
        <div
          className="w-3.5 h-3.5 rounded-full bg-white"
          style={{
            boxShadow: "0 0 8px rgba(255,255,255,0.6), 0 0 20px rgba(255,255,255,0.2)",
          }}
        />
      </div>
    </div>
  );
}

