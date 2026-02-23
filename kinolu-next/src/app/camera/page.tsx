"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IconBack,
  IconFlash,
  IconFlashOff,
  IconGrid,
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
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [zoom, setZoom] = useState<1 | 2 | 3>(1);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("");

  /* ── Start camera ── */
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotFoundError" ? "No camera found on this device"
        : err instanceof DOMException && err.name === "NotAllowedError" ? "Camera permission denied"
        : "Unable to access camera";
      setCameraError(msg);
    }
  }, [facingMode]);

  useEffect(() => { void listPresets().then((items) => setPresets(items)).catch(() => {}); }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => { await Promise.resolve(); if (!cancelled) await startCamera(); };
    void boot();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [startCamera]);

  const flipCamera = useCallback(() => setFacingMode((p) => (p === "environment" ? "user" : "environment")), []);
  const cycleZoom = useCallback(() => setZoom((p) => (p === 1 ? 2 : p === 2 ? 3 : 1)), []);

  /* ── Capture ── */
  const capture = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const sw = video.videoWidth / zoom, sh = video.videoHeight / zoom;
    const sx = (video.videoWidth - sw) / 2, sy = (video.videoHeight - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (flash) { ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    canvas.toBlob((blob) => { if (blob) setCapturedUrl(URL.createObjectURL(blob)); }, "image/jpeg", 0.95);
  }, [zoom, flash]);

  const goEditorWithCapture = useCallback(() => {
    if (!capturedUrl) return;
    sessionStorage.setItem("kinolu_captured", capturedUrl);
    if (activePresetId) sessionStorage.setItem("kinolu_capture_preset_id", activePresetId);
    else sessionStorage.removeItem("kinolu_capture_preset_id");
    router.push("/editor");
  }, [capturedUrl, activePresetId, router]);

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
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
            Go to Editor
          </button>
        </div>
      )}

      {/* ── Full viewfinder ── */}
      <video ref={videoRef} autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: `scale(${zoom})`, transition: "transform 0.3s ease" }} />

      {/* ── Grid overlay ── */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/15" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/15" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/15" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/15" />
        </div>
      )}

      {/* ── UI overlay ── */}
      <div className="absolute inset-0 z-20 flex flex-col safe-top safe-bottom pointer-events-none">

        {/* Top bar — minimal floating controls */}
        <div className="flex items-center justify-between px-4 pt-1 pointer-events-auto">
          <button onClick={() => router.push("/")} className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-white/90">
            <IconBack size={18} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setFlash(!flash)} className={`w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center transition-colors ${flash ? "text-yellow-300" : "text-white/50"}`}>
              {flash ? <IconFlash size={16} /> : <IconFlashOff size={16} />}
            </button>
            <button onClick={() => setShowGrid(!showGrid)} className={`w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center transition-colors ${showGrid ? "text-white" : "text-white/40"}`}>
              <IconGrid size={16} />
            </button>
          </div>
        </div>

        {/* Spacer — pushes bottom area down */}
        <div className="flex-1" />

        {/* Preset strip */}
        {presets.length > 0 && (
          <div className="pointer-events-auto px-4 pb-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button onClick={() => setActivePresetId("")}
                className={`shrink-0 h-7 rounded-full px-3.5 text-[10px] tracking-[1px] border transition-all ${
                  activePresetId === "" ? "border-white/50 text-white bg-white/15 backdrop-blur-md" : "border-white/10 text-white/45 bg-black/25 backdrop-blur-md"
                }`}>
                Original
              </button>
              {presets.map((p) => (
                <button key={p.id} onClick={() => setActivePresetId(p.id)}
                  className={`shrink-0 h-7 rounded-full px-3.5 text-[10px] tracking-[1px] border transition-all ${
                    activePresetId === p.id ? "border-white/50 text-white bg-white/15 backdrop-blur-md" : "border-white/10 text-white/45 bg-black/25 backdrop-blur-md"
                  }`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zoom pill */}
        <div className="flex justify-center pb-3 pointer-events-auto">
          <button onClick={cycleZoom} className="h-7 px-3 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/80 text-[12px] font-medium tracking-wide">
            {zoom}×
          </button>
        </div>

        {/* Bottom bar — gallery · shutter · flip */}
        <div className="flex items-center justify-center gap-10 pb-4 pointer-events-auto">
          {/* Gallery / Last capture */}
          <button onClick={() => capturedUrl && goEditorWithCapture()} className="w-11 h-11 rounded-xl overflow-hidden border border-white/15">
            {capturedUrl ? (
              <img src={capturedUrl} alt="Last" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center"><IconImage size={17} className="text-white/25" /></div>
            )}
          </button>

          {/* Shutter */}
          <button onClick={capture} className="w-[68px] h-[68px] rounded-full border-[3px] border-white/90 flex items-center justify-center active:scale-95 transition-transform">
            <div className="w-[56px] h-[56px] rounded-full bg-white active:bg-white/80 transition-colors" />
          </button>

          {/* Flip camera */}
          <button onClick={flipCamera} className="w-11 h-11 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-white/70">
            <IconFlip size={18} />
          </button>
        </div>
      </div>

      {/* ── Capture preview overlay ── */}
      {capturedUrl && (
        <div className="absolute inset-0 z-30 bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 h-[44px] safe-top">
            <button onClick={() => setCapturedUrl(null)} className="text-white/70 text-[13px] font-medium tracking-wider">Retake</button>
            <button onClick={goEditorWithCapture} className="text-white text-[13px] font-semibold tracking-wider">Use Photo →</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={capturedUrl} alt="Captured" className="max-w-full max-h-full object-contain rounded-sm" />
          </div>
        </div>
      )}
    </div>
  );
}
