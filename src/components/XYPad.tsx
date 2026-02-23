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
  /** Axis labels (like ColorBy: "色彩强度" / "影调强度") */
  xLabel?: string;
  yLabel?: string;
  /** Help tooltip */
  helpText?: string;
}

const GRID = 10;

export default function XYPad({
  x,
  y,
  onChange,
  onCommit,
  disabled = false,
  compact = false,
  xLabel,
  yLabel,
  helpText,
}: XYPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Y axis is inverted in display: top of pad = high value (1), bottom = low value (0)
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

  const displayY = 1 - y; // invert for screen coords

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

  const padSize = compact ? 120 : 150;
  const handleLeftPct = x * 100;
  const handleTopPct = displayY * 100;
  const xPct = Math.round(x * 100);
  const yPct = Math.round(y * 100);

  return (
    <div className="relative flex flex-col items-end gap-0.5">
      {/* Help tooltip overlay */}
      {showHelp && helpText && (
        <div className="absolute bottom-full right-0 mb-2 z-50 max-w-[200px] px-3 py-2 rounded-xl bg-black/90 backdrop-blur-xl border border-white/10 shadow-xl">
          <p className="text-[10px] text-white/70 leading-relaxed whitespace-pre-line">{helpText}</p>
          <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-black/90 border-r border-b border-white/10 rotate-45" />
        </div>
      )}

      <div className="flex items-end gap-1">
        {/* Y-axis label (vertical, left side) */}
        {yLabel && (
          <div className="flex flex-col items-center gap-0.5 pb-0.5">
            <svg width="7" height="7" viewBox="0 0 8 8" className="text-white/25 shrink-0">
              <path d="M4 1L7 5H1Z" fill="currentColor" />
            </svg>
            <span className="text-[7px] text-white/30 tracking-wider font-medium leading-none"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "1.5px" }}>
              {yLabel}
            </span>
          </div>
        )}

        <div className="flex flex-col items-center gap-0.5">
          {/* The pad itself */}
          <div
            ref={containerRef}
            className="relative select-none rounded-2xl overflow-hidden"
            style={{
              width: padSize,
              height: padSize,
              background: "rgba(20,20,20,0.85)",
              backdropFilter: "blur(12px)",
              border: dragging ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)",
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
            {/* Subtle warm gradient (origin bottom-left) */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(315deg, rgba(255,180,50,0.05) 0%, transparent 60%)" }} />

            {/* Dot grid */}
            <svg width={padSize} height={padSize} viewBox={`0 0 ${padSize} ${padSize}`}
              className="absolute inset-0 pointer-events-none">
              {dots.map((d, i) => {
                const proximity = Math.max(0, 1 - d.dist * 2.5);
                const opacity = 0.12 + proximity * 0.55;
                const baseR = compact ? 1.4 : 1.7;
                return (
                  <circle key={i} cx={d.cx * padSize} cy={d.cy * padSize}
                    r={baseR + proximity * 1.2} fill="white" opacity={opacity} />
                );
              })}
            </svg>

            {/* Subtle crosshair lines at handle position */}
            <div className="absolute pointer-events-none" style={{
              left: `${handleLeftPct}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.05)",
            }} />
            <div className="absolute pointer-events-none" style={{
              top: `${handleTopPct}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.05)",
            }} />

            {/* Handle */}
            <div className="absolute pointer-events-none z-10" style={{
              left: `${handleLeftPct}%`, top: `${handleTopPct}%`,
              transform: `translate(-50%, -50%) scale(${dragging ? 1.35 : 1})`,
              transition: dragging ? "none" : "transform 0.15s ease",
            }}>
              <div className="w-4 h-4 rounded-full bg-white border-2 border-white/80"
                style={{ boxShadow: "0 0 8px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.15)" }} />
              {/* Value tooltip while dragging */}
              {dragging && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm whitespace-nowrap">
                  <span className="text-[8px] text-white/80 font-mono tabular-nums">{xPct},{yPct}</span>
                </div>
              )}
            </div>

            {/* Origin label */}
            <span className="absolute bottom-1 left-1.5 text-[7px] text-white/12 pointer-events-none font-mono">0</span>
          </div>

          {/* X-axis label (below pad) */}
          {xLabel && (
            <div className="flex items-center gap-0.5">
              <span className="text-[7px] text-white/30 tracking-wider font-medium">{xLabel}</span>
              <svg width="7" height="7" viewBox="0 0 8 8" className="text-white/25 shrink-0">
                <path d="M3 1L7 4L3 7Z" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>

        {/* Right column: help button + numeric display */}
        <div className="flex flex-col items-center gap-1 pb-0.5">
          {helpText && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowHelp((v) => !v); }}
              onBlur={() => setShowHelp(false)}
              className="w-5 h-5 rounded-full border border-white/12 flex items-center justify-center text-[9px] text-white/30 hover:text-white/60 hover:border-white/25 transition-colors"
            >
              ?
            </button>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] text-white/25 font-mono tabular-nums leading-none">{xPct}</span>
            <div className="w-px h-1 bg-white/10" />
            <span className="text-[8px] text-white/25 font-mono tabular-nums leading-none">{yPct}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
