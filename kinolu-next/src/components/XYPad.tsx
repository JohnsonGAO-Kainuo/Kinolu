"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";

interface XYPadProps {
  /** 0‒1, default 0.5 */
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  labelX?: string;
  labelY?: string;
  disabled?: boolean;
}

export default function XYPad({
  x,
  y,
  onChange,
  labelX = "COLOR",
  labelY = "TONE",
  disabled = false,
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

  /* ── Pointer events ── */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
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

  /* Reset on double-tap */
  const onDoubleClick = useCallback(() => {
    onChange(0.5, 0.5);
  }, [onChange]);

  /* Animated pulse for the handle when idle */
  const handleScale = dragging ? "scale(1.15)" : "scale(1)";

  return (
    <div className="w-full flex flex-col items-center gap-3 px-6">
      {/* Section label */}
      <div className="text-[10px] font-semibold tracking-[3px] text-k-text-secondary uppercase">
        TONE MATCH
      </div>

      {/* Pad */}
      <div className="relative w-full" style={{ maxWidth: 300 }}>
        {/* Y-axis label */}
        <div
          className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-semibold tracking-[2px] text-k-muted uppercase whitespace-nowrap"
        >
          {labelY}
        </div>

        <div
          ref={containerRef}
          className="relative w-full aspect-square rounded-2xl overflow-hidden select-none"
          style={{
            background: "linear-gradient(180deg, #141414 0%, #050505 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          {/* 4×4 grid lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
              `,
              backgroundSize: "25% 25%",
            }}
          />

          {/* Center crosshair */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.04]" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.04]" />
          </div>

          {/* Handle */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: `translate(-50%, -50%) ${handleScale}`,
              transition: dragging ? "none" : "transform 0.2s ease",
            }}
          >
            {/* Outer ring */}
            <div
              className="w-9 h-9 rounded-full border-[1.5px] border-white/80 flex items-center justify-center"
              style={{
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "blur(4px)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
              }}
            >
              {/* Inner dot */}
              <div
                className="w-2 h-2 rounded-full bg-white"
                style={{
                  boxShadow: "0 0 6px rgba(255,255,255,0.6)",
                }}
              />
            </div>
          </div>

          {/* Corner labels */}
          <div className="absolute top-2 left-3 text-[8px] text-white/20 font-medium tracking-wider">
            SOFT
          </div>
          <div className="absolute top-2 right-3 text-[8px] text-white/20 font-medium tracking-wider">
            VIVID
          </div>
          <div className="absolute bottom-2 left-3 text-[8px] text-white/20 font-medium tracking-wider">
            LIGHT
          </div>
          <div className="absolute bottom-2 right-3 text-[8px] text-white/20 font-medium tracking-wider">
            DEEP
          </div>
        </div>

        {/* X-axis label */}
        <div className="text-center mt-1.5 text-[9px] font-semibold tracking-[2px] text-k-muted uppercase">
          {labelX}
        </div>
      </div>

      {/* Value readout */}
      <div className="flex gap-6 text-[10px] text-k-text-secondary font-mono">
        <span>X {(x * 100).toFixed(0)}%</span>
        <span>Y {(y * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
