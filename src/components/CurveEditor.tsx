"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import type { CurvePoint, CurveChannels } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type Channel = "rgb" | "r" | "g" | "b";

const CHANNEL_COLORS: Record<Channel, string> = {
  rgb: "#ffffff",
  r: "#ff6b6b",
  g: "#51cf66",
  b: "#74c0fc",
};

interface CurveEditorProps {
  curves: CurveChannels;
  onChange: (curves: CurveChannels) => void;
}

/* Monotone cubic spline interpolation */
function splineInterpolate(
  pts: CurvePoint[],
  count: number
): { x: number; y: number }[] {
  if (pts.length < 2)
    return Array.from({ length: count }, (_, i) => ({
      x: i / (count - 1),
      y: i / (count - 1),
    }));

  const sorted = [...pts].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);

  // Simple cubic Hermite
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    dy.push(ys[i + 1] - ys[i]);
    m.push(dy[i] / (dx[i] || 1e-6));
  }

  const tangents: number[] = [m[0] || 0];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tangents.push(0);
    else tangents.push((m[i - 1] + m[i]) / 2);
  }
  tangents.push(m[n - 2] || 0);

  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    // Find segment
    let seg = 0;
    for (let j = 0; j < n - 1; j++) {
      if (t >= xs[j] && t <= xs[j + 1]) {
        seg = j;
        break;
      }
      if (j === n - 2) seg = j;
    }

    const h = dx[seg] || 1e-6;
    const s = (t - xs[seg]) / h;
    const s2 = s * s;
    const s3 = s2 * s;

    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;

    const y =
      h00 * ys[seg] +
      h10 * h * tangents[seg] +
      h01 * (ys[seg + 1] ?? ys[seg]) +
      h11 * h * (tangents[seg + 1] ?? tangents[seg]);

    result.push({ x: t, y: Math.max(0, Math.min(1, y)) });
  }
  return result;
}

export default function CurveEditor({ curves, onChange }: CurveEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [channel, setChannel] = useState<Channel>("rgb");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [size, setSize] = useState(280);
  const { t } = useI18n();

  const points = curves[channel];

  /* ── Resize observer ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 280;
      setSize(Math.round(w));
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  /* ── Draw ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const w = size;
    const h = size;

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const p = (i / 4) * w;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
      ctx.stroke();
    }

    // Diagonal (identity line)
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw inactive channels faintly
    const channels: Channel[] = ["rgb", "r", "g", "b"];
    for (const ch of channels) {
      if (ch === channel) continue;
      const interp = splineInterpolate(curves[ch], w);
      ctx.strokeStyle =
        CHANNEL_COLORS[ch].replace(")", ",0.15)").replace("rgb", "rgba") ||
        "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < interp.length; i++) {
        const px = interp[i].x * w;
        const py = (1 - interp[i].y) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Active channel curve
    const interp = splineInterpolate(points, w);
    ctx.strokeStyle = CHANNEL_COLORS[channel];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < interp.length; i++) {
      const px = interp[i].x * w;
      const py = (1 - interp[i].y) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Points
    for (let i = 0; i < points.length; i++) {
      const px = points[i].x * w;
      const py = (1 - points[i].y) * h;
      ctx.fillStyle = CHANNEL_COLORS[channel];
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [curves, channel, points, size]);

  /* ── Interaction helpers ── */
  const toNorm = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { nx: 0, ny: 0 };
      return {
        nx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        ny: Math.max(
          0,
          Math.min(1, 1 - (clientY - rect.top) / rect.height)
        ),
      };
    },
    []
  );

  const findNearest = useCallback(
    (nx: number, ny: number): number | null => {
      let closest = -1;
      let minDist = 0.05;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.hypot(points[i].x - nx, points[i].y - ny);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      return closest >= 0 ? closest : null;
    },
    [points]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const { nx, ny } = toNorm(e.clientX, e.clientY);
      const idx = findNearest(nx, ny);
      if (idx !== null) {
        setDragIdx(idx);
      } else {
        // Add new point
        const newPts = [...points, { x: nx, y: ny }].sort(
          (a, b) => a.x - b.x
        );
        onChange({ ...curves, [channel]: newPts });
        // find the index of the newly added point
        const newIdx = newPts.findIndex((p) => p.x === nx && p.y === ny);
        setDragIdx(newIdx >= 0 ? newIdx : null);
      }
    },
    [toNorm, findNearest, points, curves, channel, onChange]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragIdx === null) return;
      const { nx, ny } = toNorm(e.clientX, e.clientY);
      const newPts = [...points];
      // Prevent moving past adjacent points (except endpoints)
      if (dragIdx === 0) {
        newPts[0] = { x: 0, y: ny };
      } else if (dragIdx === points.length - 1) {
        newPts[dragIdx] = { x: 1, y: ny };
      } else {
        const minX = (newPts[dragIdx - 1]?.x ?? 0) + 0.01;
        const maxX = (newPts[dragIdx + 1]?.x ?? 1) - 0.01;
        newPts[dragIdx] = {
          x: Math.max(minX, Math.min(maxX, nx)),
          y: ny,
        };
      }
      onChange({ ...curves, [channel]: newPts });
    },
    [dragIdx, toNorm, points, curves, channel, onChange]
  );

  const onPointerUp = useCallback(() => setDragIdx(null), []);

  /* Double-click to remove a point */
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const { nx, ny } = toNorm(e.clientX, e.clientY);
      const idx = findNearest(nx, ny);
      if (idx !== null && idx !== 0 && idx !== points.length - 1) {
        const newPts = points.filter((_, i) => i !== idx);
        onChange({ ...curves, [channel]: newPts });
      }
    },
    [toNorm, findNearest, points, curves, channel, onChange]
  );

  /* Reset channel */
  const resetChannel = useCallback(() => {
    onChange({
      ...curves,
      [channel]: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
  }, [curves, channel, onChange]);

  const channelTabs: { key: Channel; label: string }[] = [
    { key: "rgb", label: "RGB" },
    { key: "r", label: "R" },
    { key: "g", label: "G" },
    { key: "b", label: "B" },
  ];

  return (
    <div className="w-full flex flex-col items-center gap-3 px-4 pb-4">
      {/* Channel tabs + Reset inline */}
      <div className="flex items-center gap-2 w-full justify-center">
        <div className="flex gap-1 bg-k-surface rounded-lg p-1">
          {channelTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setChannel(tab.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-colors ${
                channel === tab.key
                  ? "bg-k-raised text-white"
                  : "text-k-text-secondary hover:text-white"
              }`}
              style={
                channel === tab.key
                  ? { color: CHANNEL_COLORS[tab.key] }
                  : undefined
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{
          maxWidth: 260,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        />
      </div>

      {/* Reset — prominent pill button */}
      <button
        onClick={resetChannel}
        className="px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] text-white/40 tracking-wider hover:text-white/70 hover:bg-white/10 transition-colors"
      >
        {t("curves_reset", { channel: channel.toUpperCase() })}
      </button>
    </div>
  );
}
