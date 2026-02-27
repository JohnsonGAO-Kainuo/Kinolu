"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

export interface CropRect {
  x: number; // 0..1 normalized to image
  y: number;
  w: number;
  h: number;
}

interface Props {
  canvasEl: HTMLCanvasElement | null;
  aspect: string; // "free" | "1:1" | "4:3" | "16:9" | "3:2" | "9:16"
  onChange: (r: CropRect) => void;
}

const MIN_FRAC = 0.08;

function parseAR(s: string): number | null {
  if (s === "free") return null;
  const p = s.split(":").map(Number);
  return p[0] && p[1] ? p[0] / p[1] : null;
}

/** Visible corner / edge handle dot */
function Handle({ x, y, active, kind }: { x: number; y: number; active: boolean; kind: string }) {
  const isCorner = ["nw", "ne", "sw", "se"].includes(kind);
  const size = isCorner ? 14 : 10;
  const activeSize = isCorner ? 20 : 14;
  const r = active ? activeSize : size;
  return (
    <div
      className="absolute pointer-events-none transition-all duration-150 ease-out"
      style={{
        left: x - r / 2,
        top: y - r / 2,
        width: r,
        height: r,
        borderRadius: "50%",
        background: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)",
        boxShadow: active
          ? "0 0 8px rgba(255,255,255,0.4), 0 0 0 2px rgba(0,0,0,0.2)"
          : "0 1px 3px rgba(0,0,0,0.4)",
        transform: active ? "scale(1.1)" : "scale(1)",
      }}
    />
  );
}

export default function CropOverlay({ canvasEl, aspect, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cv, setCv] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const [region, setRegionRaw] = useState<CropRect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [dragging, setDragging] = useState(false);
  const [dragKind, setDragKind] = useState("");
  const drag = useRef<{ kind: string; sx: number; sy: number; orig: CropRect } | null>(null);

  const setRegion = useCallback(
    (r: CropRect) => {
      setRegionRaw(r);
      onChange(r);
    },
    [onChange],
  );

  /* ── measure canvas rect inside wrapper ── */
  useEffect(() => {
    const measure = () => {
      if (!canvasEl || !wrapRef.current) return;
      const cr = canvasEl.getBoundingClientRect();
      const pr = wrapRef.current.getBoundingClientRect();
      setCv({ l: cr.left - pr.left, t: cr.top - pr.top, w: cr.width, h: cr.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (canvasEl) ro.observe(canvasEl);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [canvasEl]);

  /* ── reset region on aspect change ── */
  useEffect(() => {
    const ar = parseAR(aspect);
    if (!canvasEl) return;
    const imgAR = canvasEl.width / canvasEl.height;
    let w: number, h: number;
    if (!ar) {
      w = 0.9;
      h = 0.9;
    } else if (ar / imgAR > 1) {
      w = 0.9;
      h = (0.9 * imgAR) / ar;
    } else {
      h = 0.9;
      w = (0.9 * ar) / imgAR;
    }
    w = Math.min(0.95, w);
    h = Math.min(0.95, h);
    const r = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
    setRegion(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, canvasEl]);

  const toNorm = useCallback(
    (e: React.PointerEvent): [number, number] | null => {
      if (!cv || !wrapRef.current) return null;
      const pr = wrapRef.current.getBoundingClientRect();
      return [(e.clientX - pr.left - cv.l) / cv.w, (e.clientY - pr.top - cv.t) / cv.h];
    },
    [cv],
  );

  const clampR = useCallback(
    (r: CropRect): CropRect => {
      let { x, y, w, h } = r;
      w = Math.max(MIN_FRAC, Math.min(1, w));
      h = Math.max(MIN_FRAC, Math.min(1, h));
      const ar = parseAR(aspect);
      if (ar && canvasEl) {
        const imgAR = canvasEl.width / canvasEl.height;
        h = (w * imgAR) / ar;
        if (h > 1) {
          h = 1;
          w = (ar * h) / imgAR;
        }
        w = Math.max(MIN_FRAC, Math.min(1, w));
        h = Math.max(MIN_FRAC, Math.min(1, h));
      }
      x = Math.max(0, Math.min(1 - w, x));
      y = Math.max(0, Math.min(1 - h, y));
      return { x, y, w, h };
    },
    [aspect, canvasEl],
  );

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      const n = toNorm(e);
      if (!n || !cv) return;
      const [mx, my] = n;
      const { x, y, w, h } = region;
      // 48px touch zones for comfortable mobile interaction
      const hr = 48 / cv.w;
      const vr = 48 / cv.h;
      let kind = "";
      const aL = Math.abs(mx - x) < hr,
        aR = Math.abs(mx - (x + w)) < hr;
      const aT = Math.abs(my - y) < vr,
        aB = Math.abs(my - (y + h)) < vr;
      if (aT && aL) kind = "nw";
      else if (aT && aR) kind = "ne";
      else if (aB && aL) kind = "sw";
      else if (aB && aR) kind = "se";
      else if (aT && mx > x && mx < x + w) kind = "n";
      else if (aB && mx > x && mx < x + w) kind = "s";
      else if (aL && my > y && my < y + h) kind = "w";
      else if (aR && my > y && my < y + h) kind = "e";
      else if (mx >= x && mx <= x + w && my >= y && my <= y + h) kind = "move";
      if (!kind) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      drag.current = { kind, sx: mx, sy: my, orig: { ...region } };
      setDragging(true);
      setDragKind(kind);
    },
    [region, cv, toNorm],
  );

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const n = toNorm(e);
      if (!n) return;
      const [mx, my] = n;
      const { kind, sx, sy, orig } = drag.current;
      const dx = mx - sx,
        dy = my - sy;
      let next: CropRect;
      switch (kind) {
        case "move":
          next = { ...orig, x: orig.x + dx, y: orig.y + dy };
          break;
        case "nw":
          next = { x: orig.x + dx, y: orig.y + dy, w: orig.w - dx, h: orig.h - dy };
          break;
        case "ne":
          next = { x: orig.x, y: orig.y + dy, w: orig.w + dx, h: orig.h - dy };
          break;
        case "sw":
          next = { x: orig.x + dx, y: orig.y, w: orig.w - dx, h: orig.h + dy };
          break;
        case "se":
          next = { x: orig.x, y: orig.y, w: orig.w + dx, h: orig.h + dy };
          break;
        case "n":
          next = { ...orig, y: orig.y + dy, h: orig.h - dy };
          break;
        case "s":
          next = { ...orig, h: orig.h + dy };
          break;
        case "w":
          next = { ...orig, x: orig.x + dx, w: orig.w - dx };
          break;
        case "e":
          next = { ...orig, w: orig.w + dx };
          break;
        default:
          return;
      }
      setRegion(clampR(next));
    },
    [toNorm, clampR, setRegion],
  );

  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
    setDragKind("");
  }, []);

  if (!cv) return null;

  const sx = cv.l + region.x * cv.w;
  const sy = cv.t + region.y * cv.h;
  const sw = region.w * cv.w;
  const sh = region.h * cv.h;
  const maskAlpha = dragging ? 0.65 : 0.45;
  const gridAlpha = dragging ? 0.35 : 0;
  const borderAlpha = dragging ? 0.9 : 0.6;

  /* corner / edge handle positions */
  const handles: { kind: string; x: number; y: number }[] = [
    { kind: "nw", x: sx, y: sy },
    { kind: "ne", x: sx + sw, y: sy },
    { kind: "sw", x: sx, y: sy + sh },
    { kind: "se", x: sx + sw, y: sy + sh },
    { kind: "n", x: sx + sw / 2, y: sy },
    { kind: "s", x: sx + sw / 2, y: sy + sh },
    { kind: "w", x: sx, y: sy + sh / 2 },
    { kind: "e", x: sx + sw, y: sy + sh / 2 },
  ];

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-20 touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* ── dark mask (4 rects around crop) ── */}
      <div className="absolute transition-[background] duration-150" style={{ left: cv.l, top: cv.t, width: cv.w, height: region.y * cv.h, background: `rgba(0,0,0,${maskAlpha})` }} />
      <div className="absolute transition-[background] duration-150" style={{ left: cv.l, top: sy + sh, width: cv.w, height: Math.max(0, (1 - region.y - region.h) * cv.h), background: `rgba(0,0,0,${maskAlpha})` }} />
      <div className="absolute transition-[background] duration-150" style={{ left: cv.l, top: sy, width: region.x * cv.w, height: sh, background: `rgba(0,0,0,${maskAlpha})` }} />
      <div className="absolute transition-[background] duration-150" style={{ left: sx + sw, top: sy, width: Math.max(0, (1 - region.x - region.w) * cv.w), height: sh, background: `rgba(0,0,0,${maskAlpha})` }} />

      {/* ── crop border ── */}
      <div className="absolute pointer-events-none transition-[border-color] duration-150" style={{ left: sx, top: sy, width: sw, height: sh, border: `1.5px solid rgba(255,255,255,${borderAlpha})` }}>
        {/* rule-of-thirds grid — only visible while dragging */}
        <div className="absolute left-1/3 top-0 bottom-0 w-px transition-opacity duration-200" style={{ background: "rgba(255,255,255,0.35)", opacity: gridAlpha > 0 ? 1 : 0 }} />
        <div className="absolute left-2/3 top-0 bottom-0 w-px transition-opacity duration-200" style={{ background: "rgba(255,255,255,0.35)", opacity: gridAlpha > 0 ? 1 : 0 }} />
        <div className="absolute top-1/3 left-0 right-0 h-px transition-opacity duration-200" style={{ background: "rgba(255,255,255,0.35)", opacity: gridAlpha > 0 ? 1 : 0 }} />
        <div className="absolute top-2/3 left-0 right-0 h-px transition-opacity duration-200" style={{ background: "rgba(255,255,255,0.35)", opacity: gridAlpha > 0 ? 1 : 0 }} />
      </div>

      {/* ── draggable handle dots ── */}
      {handles.map((h) => (
        <Handle key={h.kind} x={h.x} y={h.y} active={dragKind === h.kind} kind={h.kind} />
      ))}

      {/* ── dimension label ── */}
      {canvasEl && (
        <div
          className="absolute pointer-events-none transition-opacity duration-200"
          style={{ left: sx + sw / 2 - 40, top: sy + sh + 10, width: 80, textAlign: "center", opacity: dragging ? 1 : 0.5 }}
        >
          <span className="bg-black/60 text-[9px] text-white/70 rounded-full px-2.5 py-0.5 tabular-nums backdrop-blur-sm">
            {Math.round(region.w * canvasEl.width)}×{Math.round(region.h * canvasEl.height)}
          </span>
        </div>
      )}
    </div>
  );
}
