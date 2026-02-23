"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IconBack,
  IconFlash,
  IconFlashOff,
  IconGrid,
  IconTimer,
  IconFlip,
  IconImage,
} from "@/components/icons";
import { listPresets } from "@/lib/api";
import type { PresetItem } from "@/lib/types";

export default function CameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [zoom, setZoom] = useState<1 | 2 | 3>(1);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("");

  /* ── Start camera ── */
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotFoundError"
        ? "No camera found on this device"
        : err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera permission denied"
        : "Unable to access camera";
      setCameraError(msg);
    }
  }, [facingMode]);

  useEffect(() => {
    void listPresets()
      .then((items) => {
        setPresets(items);
        if (items[0]) setActivePresetId(items[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      // avoid sync setState-in-effect warning: run camera start in async turn
      await Promise.resolve();
      if (!cancelled) {
        await startCamera();
      }
    };
    void boot();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  /* ── Flip camera ── */
  const flipCamera = useCallback(() => {
    setFacingMode((prev) =>
      prev === "environment" ? "user" : "environment"
    );
  }, []);

  /* ── Zoom cycle ── */
  const cycleZoom = useCallback(() => {
    setZoom((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 1));
  }, []);

  /* ── Capture ── */
  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Apply zoom crop
    const sw = video.videoWidth / zoom;
    const sh = video.videoHeight / zoom;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    // Flash effect
    if (flash) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedUrl(URL.createObjectURL(blob));
      }
    }, "image/jpeg", 0.95);
  }, [zoom, flash]);

  /* ── Go to editor with captured image ── */
  const goEditorWithCapture = useCallback(() => {
    if (capturedUrl) {
      // Store in sessionStorage for the editor to pick up
      sessionStorage.setItem("kinolu_captured", capturedUrl);
      if (activePresetId) {
        sessionStorage.setItem("kinolu_capture_preset_id", activePresetId);
      } else {
        sessionStorage.removeItem("kinolu_capture_preset_id");
      }
      router.push("/editor");
    }
  }, [capturedUrl, activePresetId, router]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Camera error fallback ── */}
      {cameraError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 px-8">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <p className="text-white/50 text-[14px] text-center">{cameraError}</p>
          <button
            onClick={() => router.push("/editor")}
            className="mt-2 px-5 py-2 border border-white/20 rounded-full text-[12px] text-white/70 tracking-wider hover:bg-white/5 transition-colors"
          >
            Go to Editor instead
          </button>
        </div>
      )}

      {/* ── Video preview ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: `scale(${zoom})`,
          transition: "transform 0.3s ease",
        }}
      />

      {/* ── Grid overlay ── */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Vertical lines */}
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
          {/* Horizontal lines */}
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
        </div>
      )}

      {/* ── Focus brackets (center) ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 pointer-events-none z-10">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/60" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/60" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/60" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/60" />
      </div>

      {/* ── UI Layer ── */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between safe-top safe-bottom pointer-events-none">
        {/* Top controls */}
        <div className="flex items-center justify-between px-5 pt-2 pointer-events-auto">
          <button
            onClick={() => router.push("/")}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white"
          >
            <IconBack size={20} />
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFlash(!flash)}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white"
            >
              {flash ? (
                <IconFlash size={18} />
              ) : (
                <IconFlashOff size={18} />
              )}
            </button>

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center transition-colors ${
                showGrid ? "text-white" : "text-white/50"
              }`}
            >
              <IconGrid size={18} />
            </button>

            <button
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/50"
            >
              <IconTimer size={18} />
            </button>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-between px-8 pb-6 pointer-events-auto">
          {/* Gallery / Last capture */}
          <button
            onClick={() => capturedUrl && goEditorWithCapture()}
            className="w-12 h-12 rounded-xl overflow-hidden border border-white/20"
          >
            {capturedUrl ? (
              <img
                src={capturedUrl}
                alt="Last capture"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-k-surface flex items-center justify-center">
                <IconImage size={20} className="text-k-muted" />
              </div>
            )}
          </button>

          {/* Shutter */}
          <button
            onClick={capture}
            className="w-[72px] h-[72px] rounded-full border-[3px] border-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <div className="w-[60px] h-[60px] rounded-full bg-white active:bg-white/80 transition-colors" />
          </button>

          {/* Flip camera */}
          <button
            onClick={flipCamera}
            className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white"
          >
            <IconFlip size={20} />
          </button>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={cycleZoom}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white text-[13px] font-semibold"
          >
            {zoom}×
          </button>
        </div>

        {presets.length > 0 && (
          <div className="pointer-events-auto px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActivePresetId("")}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] tracking-wider border transition-colors ${
                  activePresetId === ""
                    ? "border-white/50 text-white bg-white/15 backdrop-blur-md"
                    : "border-white/15 text-white/60 bg-black/30 backdrop-blur-md"
                }`}
              >
                None
              </button>
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePresetId(p.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] tracking-wider border transition-colors ${
                    activePresetId === p.id
                      ? "border-white/50 text-white bg-white/15 backdrop-blur-md"
                      : "border-white/15 text-white/60 bg-black/30 backdrop-blur-md"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Capture preview overlay ── */}
      {capturedUrl && (
        <div className="absolute inset-0 z-30 bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 pt-2 safe-top">
            <button
              onClick={() => setCapturedUrl(null)}
              className="text-white text-[14px] font-semibold"
            >
              Retake
            </button>
            <button
              onClick={goEditorWithCapture}
              className="text-white text-[14px] font-semibold"
            >
              Use Photo →
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-5">
            <img
              src={capturedUrl}
              alt="Captured"
              className="max-w-full max-h-full object-contain rounded-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
