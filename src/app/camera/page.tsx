"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconBack, IconFlip, IconGrid, IconFlash, IconFlashOff } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import {
  listLocalLuts,
  getLocalLut,
  applyLutToPixels,
  type LutEntry,
} from "@/lib/lutStore";
import { getBuiltinMeta } from "@/lib/builtinLuts";
import { useAuth } from "@/components/AuthProvider";
import { trackCameraOpen, trackCameraCapture } from "@/lib/analytics";

/* ── Focal-length presets ── */
const FOCAL_PRESETS = [
  { mm: 26, zoom: 1.0 },
  { mm: 50, zoom: 1.92 },
  { mm: 77, zoom: 2.96 },
] as const;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 5.0;
const zoomToMm = (z: number) => Math.round(26 * z);

export default function CameraPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { isPro } = useAuth();

  /* ── Refs ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lutCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const activeLutRef = useRef<{ data: Float32Array; size: number } | null>(null);
  const zoomRef = useRef(1.0);
  const brightnessRef = useRef(1.0);
  const facingRef = useRef<"environment" | "user">("environment");
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focalDragRef = useRef<{ startX: number; startZoom: number } | null>(null);
  const brightDragRef = useRef<{ startY: number; startVal: number } | null>(null);

  /* ── State ── */
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [flashMode, setFlashMode] = useState<"off" | "on" | "auto">("off");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [zoom, setZoom] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [localLutItems, setLocalLutItems] = useState<Omit<LutEntry, "data">[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [activePresetId, setActivePresetId] = useState<string>("");
  const [lutLoading, setLutLoading] = useState(false);
  const [lutReady, setLutReady] = useState(false);
  const [cameraLutTab, setCameraLutTab] = useState<"film" | "presets">("film");
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  /* keep refs in sync */
  useEffect(() => { trackCameraOpen(); }, []);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { brightnessRef.current = brightness; }, [brightness]);
  useEffect(() => { facingRef.current = facingMode; }, [facingMode]);

  const isSelfie = facingMode === "user";
  const hasLut = lutReady && !!activePresetId;
  const mirrorStyle = isSelfie ? "scaleX(-1)" : "none";

  /* ════════════════ CAMERA ════════════════ */

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());

      // Check permission state before prompting — avoids re-asking on every visit
      if (navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
          if (perm.state === "denied") {
            setCameraError(t("camera_permissionDenied"));
            return;
          }
        } catch { /* permissions API not supported on this browser, continue normally */ }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      // Check torch capability
      try {
        const track = stream.getVideoTracks()[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = track.getCapabilities?.() as any;
        setTorchAvailable(!!caps?.torch);
      } catch { setTorchAvailable(false); }
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotFoundError"
          ? t("camera_noCameraFound")
          : err instanceof DOMException && err.name === "NotAllowedError"
            ? t("camera_permissionDenied")
            : t("camera_unableAccess");
      setCameraError(msg);
    }
  }, [facingMode, t]);

  /* Load local LUTs */
  useEffect(() => {
    void listLocalLuts().then((luts) => {
      setLocalLutItems(luts);
      const urls: Record<string, string> = {};
      for (const lut of luts) {
        if (lut.thumbnail) urls[lut.id] = URL.createObjectURL(lut.thumbnail);
      }
      setThumbUrls(urls);
    }).catch(() => {});
  }, []);

  /* Boot camera */
  useEffect(() => {
    let cancelled = false;
    void (async () => { if (!cancelled) await startCamera(); })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((tr) => tr.stop()); if (focusTimerRef.current) clearTimeout(focusTimerRef.current); Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u)); };
  }, [startCamera]);

  const flipCamera = useCallback(
    () => { setFlashMode("off"); setFacingMode((p) => (p === "environment" ? "user" : "environment")); },
    [],
  );

  /* ── Load LUT data when preset changes ── */
  useEffect(() => {
    if (!activePresetId) {
      activeLutRef.current = null;
      setLutReady(false);
      return;
    }
    let cancelled = false;
    setLutLoading(true);
    setLutReady(false);
    void (async () => {
      try {
        const entry = await getLocalLut(activePresetId);
        if (!cancelled && entry) {
          activeLutRef.current = { data: entry.data, size: entry.size };
          setLutReady(true);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLutLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [activePresetId]);

  /* ════════════════ PREVIEW LOOP ════════════════
   *  VIDEO-FIRST approach:
   *  • No LUT → <video> shown directly (native 60fps, zero CPU)
   *  • LUT active → <canvas> overlays with rAF loop at 30fps
   *  This avoids the willReadFrequently CPU-backed canvas penalty.
   */
  useEffect(() => {
    const video = videoRef.current;
    const lutCanvas = lutCanvasRef.current;
    if (!video || !lutCanvas) return;
    /* No preset selected → no loop needed, <video> is visible natively */
    if (!activePresetId) return;
    const ctx = lutCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let running = true;
    let lastT = 0;
    const INTERVAL = 1000 / 30;

    const draw = (now: number) => {
      if (!running) return;
      const lut = activeLutRef.current;
      if (!lut) {
        /* No LUT data yet — keep loop alive so it starts drawing
         * as soon as the async LUT load completes */
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      /* Throttle to ~30 fps */
      if (now - lastT < INTERVAL) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      if (video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          /* Scale preview canvas — balance sharpness vs LUT processing cost.
           * Mobile: 960px gives sharp retina-quality preview on most phones
           * Desktop: 1280px (close to native 1080p)
           */
          const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          const maxDim = isMobileDevice ? 1280 : 1920;
          let cw = vw, ch = vh;
          if (Math.max(vw, vh) > maxDim) {
            const s = maxDim / Math.max(vw, vh);
            cw = Math.round(vw * s);
            ch = Math.round(vh * s);
          }

          if (lutCanvas.width !== cw || lutCanvas.height !== ch) {
            lutCanvas.width = cw;
            lutCanvas.height = ch;
          }

          /* Draw cropped (zoomed) video frame */
          const z = zoomRef.current;
          const sw = vw / z, sh = vh / z;
          const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

          /* Apply LUT */
          const imgData = ctx.getImageData(0, 0, cw, ch);
          applyLutToPixels(imgData.data, lut.data, lut.size);
          ctx.putImageData(imgData, 0, 0);

          lastT = now;
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [activePresetId]);

  /* ── Apple-style: after focus tap, any single-finger vertical drag adjusts brightness ── */
  const vfBrightDragRef = useRef<{ startY: number; startVal: number; moved: boolean } | null>(null);

  const handleVFBrightStart = useCallback((e: React.TouchEvent) => {
    // Only activate brightness drag if focus point is visible and single finger
    if (!focusPoint || e.touches.length !== 1) return;
    vfBrightDragRef.current = { startY: e.touches[0].clientY, startVal: brightnessRef.current, moved: false };
  }, [focusPoint]);

  const handleVFBrightMove = useCallback((e: React.TouchEvent) => {
    if (!vfBrightDragRef.current || e.touches.length !== 1) return;
    const dy = vfBrightDragRef.current.startY - e.touches[0].clientY;
    // Only start adjusting after 8px vertical movement (prevents accidental activation)
    if (!vfBrightDragRef.current.moved && Math.abs(dy) < 8) return;
    vfBrightDragRef.current.moved = true;
    e.stopPropagation();
    setBrightness(Math.min(2.0, Math.max(0.3, vfBrightDragRef.current.startVal + dy / 150)));
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => setFocusPoint(null), 3500);
  }, []);

  const handleVFBrightEnd = useCallback(() => { vfBrightDragRef.current = null; }, []);

  /* ════════════════ VIEWFINDER TOUCH ════════════════ */

  const handleVFTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoomRef.current };
      touchStartRef.current = null;
      vfBrightDragRef.current = null;
    } else if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
      handleVFBrightStart(e);
    }
  }, [handleVFBrightStart]);

  const handleVFTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.startZoom * (dist / pinchRef.current.startDist))));
    }
    // Apple-style: after focus tap, vertical drag anywhere adjusts brightness
    handleVFBrightMove(e);
    if (touchStartRef.current && e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      if (Math.hypot(dx, dy) > 10) touchStartRef.current = null;
    }
  }, [handleVFBrightMove]);

  const handleVFTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    const wasBrightDrag = vfBrightDragRef.current?.moved;
    handleVFBrightEnd();
    // Skip focus-tap if user was dragging to adjust brightness
    if (wasBrightDrag) { touchStartRef.current = null; return; }
    if (touchStartRef.current && e.touches.length === 0 && e.changedTouches.length === 1) {
      const elapsed = Date.now() - touchStartRef.current.time;
      if (elapsed < 300) {
        const rect = viewfinderRef.current?.getBoundingClientRect();
        if (rect) {
          const x = touchStartRef.current.x - rect.left;
          const y = touchStartRef.current.y - rect.top;
          setFocusPoint({ x, y });
          setFocusKey((k) => k + 1);
          setBrightness(1.0);
          /* try hardware focus */
          if (streamRef.current) {
            const track = streamRef.current.getVideoTracks()[0];
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cap = track.getCapabilities?.() as any;
              if (cap?.focusMode?.includes?.("manual")) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                void track.applyConstraints({ advanced: [{ pointOfInterest: { x: x / rect.width, y: y / rect.height } } as any] });
              }
            } catch { /* not supported */ }
          }
          if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
          focusTimerRef.current = setTimeout(() => setFocusPoint(null), 3500);
        }
      }
      touchStartRef.current = null;
    }
  }, [handleVFBrightEnd]);

  /* ════════════════ BRIGHTNESS DRAG ════════════════ */

  const handleBrightStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    brightDragRef.current = { startY: e.touches[0].clientY, startVal: brightnessRef.current };
  }, []);

  const handleBrightMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (!brightDragRef.current) return;
    const dy = brightDragRef.current.startY - e.touches[0].clientY;
    setBrightness(Math.min(2.0, Math.max(0.3, brightDragRef.current.startVal + dy / 120)));
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => setFocusPoint(null), 3500);
  }, []);

  const handleBrightEnd = useCallback(() => { brightDragRef.current = null; }, []);

  /* ════════════════ FOCAL STRIP DRAG ════════════════ */

  const handleFocalStart = useCallback((e: React.TouchEvent) => {
    focalDragRef.current = { startX: e.touches[0].clientX, startZoom: zoomRef.current };
  }, []);

  const handleFocalMove = useCallback((e: React.TouchEvent) => {
    if (!focalDragRef.current) return;
    e.stopPropagation();
    const dx = focalDragRef.current.startX - e.touches[0].clientX;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, focalDragRef.current.startZoom + dx * 0.012)));
  }, []);

  const handleFocalEnd = useCallback(() => { focalDragRef.current = null; }, []);

  /* ════════════════ FLASH HELPERS ════════════════ */

  const flashModeRef = useRef<"off" | "on" | "auto">("off");
  useEffect(() => { flashModeRef.current = flashMode; }, [flashMode]);

  /** Turn hardware torch on/off. Returns true if torch was actually toggled. */
  const setTorch = useCallback((on: boolean): boolean => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (track) { void track.applyConstraints({ advanced: [{ torch: on } as any] }); return true; }
    } catch { /* not supported */ }
    return false;
  }, []);

  /* ════════════════ CAPTURE ════════════════ */

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* Mirror for selfie */
    const selfie = facingRef.current === "user";
    if (selfie) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }

    /* Draw zoomed crop */
    const z = zoomRef.current;
    const sw = video.videoWidth / z, sh = video.videoHeight / z;
    const sx = (video.videoWidth - sw) / 2, sy = (video.videoHeight - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    /* Reset transform before pixel ops */
    if (selfie) ctx.setTransform(1, 0, 0, 1, 0, 0);

    /* Brightness + LUT in a single pass */
    const br = brightnessRef.current;
    const lut = activeLutRef.current;
    if (br !== 1.0 || lut) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      if (br !== 1.0) {
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * br);
          d[i + 1] = Math.min(255, d[i + 1] * br);
          d[i + 2] = Math.min(255, d[i + 2] * br);
        }
      }
      if (lut) applyLutToPixels(d, lut.data, lut.size);
      ctx.putImageData(imgData, 0, 0);
    }

    canvas.toBlob((blob) => { if (blob) { trackCameraCapture(); setCapturedUrl(URL.createObjectURL(blob)); } }, "image/jpeg", 0.95);
  }, []);

  /** Capture with flash: pre-flash (metering) → main flash (capture) → off
   *
   *  Real camera flash sequence:
   *  1. Pre-flash pulse: quick on/off so camera auto-exposure can meter
   *  2. Brief pause for AE to settle
   *  3. Main flash on + capture frame
   *  4. Flash off
   */
  const capture = useCallback(() => {
    const mode = flashModeRef.current;
    const shouldFlash = torchAvailable && (mode === "on" || (mode === "auto" && brightnessRef.current <= 0.8));

    if (shouldFlash) {
      // ① Pre-flash pulse for metering (50ms on → 80ms off)
      setTorch(true);
      setTimeout(() => {
        setTorch(false);
        setTimeout(() => {
          // ② Main flash on
          setTorch(true);
          setTimeout(() => {
            // ③ Capture after 120ms (camera AE has adjusted to flash)
            captureFrame();
            // ④ Brief hold then off (total flash visible ~200ms, feels natural)
            setTimeout(() => setTorch(false), 80);
          }, 120);
        }, 80);
      }, 50);
    } else {
      captureFrame();
    }
  }, [torchAvailable, setTorch, captureFrame]);

  const goEditorWithCapture = useCallback(() => {
    if (!capturedUrl) return;
    sessionStorage.setItem("kinolu_captured", capturedUrl);
    if (activePresetId) sessionStorage.setItem("kinolu_capture_preset_id", activePresetId);
    else sessionStorage.removeItem("kinolu_capture_preset_id");
    router.push("/editor");
  }, [capturedUrl, activePresetId, router]);

  /* ═══════════ DERIVED ═══════════ */
  const currentMm = zoomToMm(zoom);
  const isOnPreset = FOCAL_PRESETS.some((p) => Math.abs(zoom - p.zoom) < 0.1);

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Error fallback ── */}
      {cameraError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 px-8">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" /><line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <p className="text-white/40 text-[13px] text-center">{cameraError}</p>
          <button onClick={() => router.push("/editor")} className="mt-2 px-5 py-2 border border-white/15 rounded-full text-[11px] text-white/60 tracking-[1.5px] hover:bg-white/5 transition-colors">
            {t("camera_goToEditor")}
          </button>
        </div>
      )}

      {/* ══════ VIDEO-FIRST VIEWFINDER ══════
        • No LUT → <video> visible at native 60fps, zero CPU
        • LUT active → <canvas> overlays with 30fps rAF loop
      */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: `brightness(${brightness})`,
          transform: `${mirrorStyle}${zoom > 1 ? ` scale(${zoom})` : ""}`,
          opacity: hasLut ? 0 : 1,
          transition: "opacity 0.15s",
        }}
      />
      <canvas
        ref={lutCanvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: `brightness(${brightness})`,
          transform: mirrorStyle,
          opacity: hasLut ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      />

      {/* ── Grid overlay ── */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute left-1/3 top-0 bottom-0 w-[0.75px] bg-white/30" />
          <div className="absolute left-2/3 top-0 bottom-0 w-[0.75px] bg-white/30" />
          <div className="absolute top-1/3 left-0 right-0 h-[0.75px] bg-white/30" />
          <div className="absolute top-2/3 left-0 right-0 h-[0.75px] bg-white/30" />
        </div>
      )}

      {/* ── LUT loading ── */}
      {lutLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ── UI overlay ── */}
      <div className="absolute inset-0 z-20 flex flex-col safe-top safe-bottom pointer-events-none">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-1 pointer-events-auto">
          <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }}
            className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-white/90">
            <IconBack size={18} />
          </button>
          <div className="flex items-center gap-2">
            {torchAvailable && (
              <button onClick={() => {
                setFlashMode((m) => m === "off" ? "on" : m === "on" ? "auto" : "off");
              }}
                className={`relative w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center transition-colors ${
                  flashMode === "off" ? "text-white/40" : "text-yellow-300"
                }`}>
                {flashMode === "off" ? <IconFlashOff size={16} /> : <IconFlash size={16} />}
                {flashMode === "auto" && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-yellow-300 leading-none">A</span>
                )}
              </button>
            )}
            <button onClick={() => setShowGrid(!showGrid)}
              className={`w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center transition-colors ${showGrid ? "text-white" : "text-white/40"}`}>
              <IconGrid size={16} />
            </button>
          </div>
        </div>

        {/* Viewfinder touch area */}
        <div
          ref={viewfinderRef}
          className="flex-1 pointer-events-auto relative touch-none"
          onTouchStart={handleVFTouchStart}
          onTouchMove={handleVFTouchMove}
          onTouchEnd={handleVFTouchEnd}
        >
          {/* Focus square + brightness slider */}
          {focusPoint && (
            <div key={focusKey} className="absolute pointer-events-none camera-focus-square"
              style={{ left: focusPoint.x - 36, top: focusPoint.y - 36 }}>
              <div className="w-[72px] h-[72px] border-[1.5px] border-yellow-400/90 rounded-[2px]" />
              <div className="absolute -right-11 -top-6 bottom-[-24px] flex flex-col items-center pointer-events-auto touch-none"
                onTouchStart={handleBrightStart} onTouchMove={handleBrightMove} onTouchEnd={handleBrightEnd}>
                <div className="flex-1 w-[1.5px] bg-white/15 rounded-full relative min-h-[96px]">
                  <div className="absolute left-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full bg-yellow-400 shadow-sm transition-[bottom] duration-75"
                    style={{ bottom: `${Math.max(0, Math.min(100, ((brightness - 0.3) / 1.7) * 100))}%`, marginBottom: "-3.5px" }} />
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-yellow-400 mt-1.5 shrink-0">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Active preset label */}
        {activePresetId && (
          <div className="flex justify-center pb-1.5 pointer-events-none">
            <span className="text-[10px] text-white/50 bg-black/40 backdrop-blur-md rounded-full px-3 py-0.5 tracking-wider">
              {localLutItems.find((l) => l.id === activePresetId)?.name || "Preset"}
            </span>
          </div>
        )}

        {/* Preset strip with Film / My Presets toggle */}
        <div className="pointer-events-auto px-3 pb-2">
          {/* Toggle: Film Filters | My Presets */}
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 mb-2 self-start w-fit">
            <button onClick={() => setCameraLutTab("film")}
              className={`px-3 py-1 rounded-md text-[10px] font-medium tracking-wider transition-all ${cameraLutTab === "film" ? "bg-white/10 text-white" : "text-white/35"}`}>
              {t("editor_filmTab")}
            </button>
            <button onClick={() => setCameraLutTab("presets")}
              className={`px-3 py-1 rounded-md text-[10px] font-medium tracking-wider transition-all ${cameraLutTab === "presets" ? "bg-white/10 text-white" : "text-white/35"}`}>
              {t("editor_presetsTab")}
            </button>
          </div>
          {(() => {
            const builtins = localLutItems.filter((l) => getBuiltinMeta(l.name))
              .sort((a, b) => {
                const aFree = getBuiltinMeta(a.name)?.isFree ? 0 : 1;
                const bFree = getBuiltinMeta(b.name)?.isFree ? 0 : 1;
                return aFree - bFree;
              });
            const userLuts = localLutItems.filter((l) => !getBuiltinMeta(l.name));
            const showItems = cameraLutTab === "film" ? builtins : userLuts;
            return (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button onClick={() => setActivePresetId("")} className="shrink-0 flex flex-col items-center gap-1">
                  <div className={`w-[60px] h-[60px] rounded-xl border-2 overflow-hidden flex items-center justify-center transition-all ${
                    activePresetId === "" ? "border-white/60 bg-white/10" : "border-white/10 bg-black/30"}`}>
                    <span className="text-[9px] text-white/50 tracking-wider">{t("camera_original")}</span>
                  </div>
                </button>
                {showItems.length > 0 ? showItems.map((lut) => {
                  const meta = getBuiltinMeta(lut.name);
                  const locked = !isPro && meta && !meta.isFree;
                  return (
                    <button key={lut.id} onClick={() => {
                      if (locked) { showToast(t("editor_proOnly")); return; }
                      setActivePresetId(lut.id);
                    }} className={`shrink-0 flex flex-col items-center gap-1 ${locked ? "opacity-60" : ""}`}>
                      <div className={`relative w-[60px] h-[60px] rounded-xl border-2 overflow-hidden transition-all ${
                        activePresetId === lut.id ? "border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.12)]" : "border-white/10"}`}>
                        {thumbUrls[lut.id] ? (
                          <img src={thumbUrls[lut.id]} alt={lut.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${
                            meta?.category === "fuji" ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20"
                            : meta?.category === "kodak" ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/20"
                            : meta ? "bg-gradient-to-br from-rose-500/20 to-purple-500/20"
                            : "bg-gradient-to-br from-purple-500/20 to-blue-500/20"}`}>
                            <span className="text-[8px] text-white/30">LUT</span>
                          </div>
                        )}
                        {locked && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className={`text-[8px] max-w-[60px] truncate ${locked ? "text-white/25" : "text-white/40"}`}>{meta?.i18nKey ? t(meta.i18nKey as Parameters<typeof t>[0]) : lut.name}</span>
                    </button>
                  );
                }) : (
                  <div className="flex items-center justify-center h-[60px] px-4">
                    <span className="text-[10px] text-white/25">{cameraLutTab === "presets" ? t("lib_noLuts") : ""}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Focal-length strip */}
        <div className="flex justify-center pb-2 pointer-events-auto">
          <div className="flex items-center bg-black/30 backdrop-blur-md rounded-full h-8 px-1 gap-0.5 touch-none"
            onTouchStart={handleFocalStart} onTouchMove={handleFocalMove} onTouchEnd={handleFocalEnd}>
            {FOCAL_PRESETS.map((p) => {
              const active = Math.abs(zoom - p.zoom) < 0.1;
              return (
                <button key={p.mm} onClick={(e) => { e.stopPropagation(); setZoom(p.zoom); }}
                  className={`h-6 min-w-[34px] rounded-full text-[11px] font-semibold transition-all duration-200 ${
                    active ? "bg-yellow-500/90 text-black" : "text-white/50"}`}>
                  {p.mm}
                </button>
              );
            })}
            {!isOnPreset && (
              <span className="text-[11px] text-yellow-400/80 font-semibold pl-1.5 pr-1.5 tabular-nums">{currentMm}</span>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-center gap-12 pb-4 pointer-events-auto">
          <div className="w-11 h-11" />
          <button onClick={capture}
            className="w-[68px] h-[68px] rounded-full border-[3px] border-white/90 flex items-center justify-center active:scale-95 transition-transform">
            <div className="w-[56px] h-[56px] rounded-full bg-white active:bg-white/80 transition-colors" />
          </button>
          <button onClick={flipCamera}
            className="w-11 h-11 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-white/70">
            <IconFlip size={18} />
          </button>
        </div>
      </div>

      {/* Capture preview */}
      {capturedUrl && (
        <div className="absolute inset-0 z-30 bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 min-h-[44px] safe-top">
            <button onClick={() => { if (capturedUrl) URL.revokeObjectURL(capturedUrl); setCapturedUrl(null); }} className="text-white/70 text-[13px] font-medium tracking-wider">{t("camera_retake")}</button>
            <button onClick={goEditorWithCapture} className="text-white text-[13px] font-semibold tracking-wider">{t("camera_usePhoto")}</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={capturedUrl} alt="Captured" className="max-w-full max-h-full object-contain rounded-sm" />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-black/70 backdrop-blur-md text-white text-[12px] px-4 py-2 rounded-full pointer-events-none animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
