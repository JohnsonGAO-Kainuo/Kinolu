"use client";

import React, { useRef, useCallback, useState } from "react";

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

  const onDoubleClick = useCallback(() => {
    onChange(0.5, 0.5);
  }, [onChange]);

  const xPct = Math.round(x * 100);
  const yPct = Math.round(y * 100);

  return (
    <div className="w-full px-5">
      {/* Compact XY pad — 2:1 ratio */}
      <div className="relative w-full mx-auto" style={{ maxWidth: 360 }}>
        <div
          ref={containerRef}
          className="relative w-full rounded-xl overflow-hidden select-none"
          style={{
            aspectRatio: "2 / 1",
            background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          {/* Subtle grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
              `,
              backgroundSize: "25% 50%",
            }}
          />

          {/* Center crosshair */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.03]" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.03]" />
          </div>

          {/* Handle */}
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: `translate(-50%, -50%) scale(${dragging ? 1.2 : 1})`,
              transition: dragging ? "none" : "all 0.2s ease",
            }}
          >
            {/* Crosshair lines through handle */}
            <div className="absolute top-1/2 -left-[200px] w-[400px] h-px bg-white/10 pointer-events-none" />
            <div className="absolute left-1/2 -top-[200px] h-[400px] w-px bg-white/10 pointer-events-none" />

            <div
              className="w-6 h-6 rounded-full border border-white/70 flex items-center justify-center"
              style={{
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(4px)",
                boxShadow: "0 1px 8px rgba(0,0,0,0.5)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" style={{ boxShadow: "0 0 4px rgba(255,255,255,0.5)" }} />
            </div>
          </div>
        </div>

        {/* Value readout — minimal */}
        <div className="flex items-center justify-center gap-5 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] tracking-[1.5px] text-white/25 uppercase">{labelX}</span>
            <span className="text-[11px] font-mono text-white/60 tabular-nums w-8 text-right">{xPct}</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] tracking-[1.5px] text-white/25 uppercase">{labelY}</span>
            <span className="text-[11px] font-mono text-white/60 tabular-nums w-8 text-right">{yPct}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
