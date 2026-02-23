"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EditParams, AdjustmentTool, EditorTab } from "@/lib/types";
import { DEFAULT_EDIT_PARAMS } from "@/lib/types";
import { applyPresetToImage, createPresetFromTransfer, exportLutFromTransfer, transferImage } from "@/lib/api";
import { applyEdits, hasActiveEdits } from "@/lib/imageProcessor";
import {
  IconBack,
  IconShare,
  IconCompare,
  IconReset,
  IconDownload,
} from "@/components/icons";
import XYPad from "@/components/XYPad";
import AdjustmentPanel from "@/components/AdjustmentPanel";
import CurveEditor from "@/components/CurveEditor";
import HSLPanel from "@/components/HSLPanel";
import ThumbStrip from "@/components/ThumbStrip";
import EditorTabBar from "@/components/EditorTabBar";

const TOOL_TO_PARAM: Record<AdjustmentTool, keyof EditParams> = {
  exposure: "exposure",
  contrast: "contrast",
  highlights: "highlights",
  shadows: "shadows",
  saturation: "sat",
  vibrance: "vib",
  warmth: "temp",
  tint: "tint",
  grain: "grain",
  sharpen: "sharpen",
  vignette: "vignette",
  bloom: "bloom",
};

export default function EditorPage() {
  const router = useRouter();

  const [params, setParams] = useState<EditParams>(DEFAULT_EDIT_PARAMS);
  const [activeTab, setActiveTab] = useState<EditorTab>("transfer");
  const [activeTool, setActiveTool] = useState<AdjustmentTool>("exposure");
  const [processing, setProcessing] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [exportingLut, setExportingLut] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<string>("");

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [activeRefIdx, setActiveRefIdx] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasLoadedImage, setHasLoadedImage] = useState(false);

  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageData = useRef<ImageData | null>(null);
  const transferredImageData = useRef<ImageData | null>(null);
  const rafId = useRef<number>(0);
  const baseImageData = useRef<ImageData | null>(null);

  const sourceFileRef = useRef<File | null>(null);
  const refFilesRef = useRef<File[]>([]);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const loadImageToData = useCallback(
    (url: string): Promise<ImageData> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const MAX = 1200;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > MAX || h > MAX) {
            const scale = MAX / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(ctx.getImageData(0, 0, w, h));
        };
        img.onerror = reject;
        img.src = url;
      }),
    []
  );

  const renderPreview = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const base = baseImageData.current;
      const canvas = displayCanvasRef.current;
      if (!base || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = base.width;
      canvas.height = base.height;
      if (hasActiveEdits(params)) {
        const edited = applyEdits(base, params);
        ctx.putImageData(edited, 0, 0);
      } else {
        ctx.putImageData(base, 0, 0);
      }
    });
  }, [params]);

  useEffect(() => {
    if (baseImageData.current) renderPreview();
  }, [params, renderPreview]);

  const runApplyPreset = useCallback(async (presetId: string) => {
    const source = sourceFileRef.current;
    if (!source || !presetId) return;
    setProcessing(true);
    setErrorMsg(null);
    try {
      const blob = await applyPresetToImage(source, presetId);
      const url = URL.createObjectURL(blob);
      const data = await loadImageToData(url);
      transferredImageData.current = data;
      baseImageData.current = data;
      setHasLoadedImage(true);
    } catch (err) {
      setErrorMsg(`Apply preset failed: ${err}`);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setProcessing(false);
    }
  }, [loadImageToData]);

  const handleSourceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      sourceFileRef.current = file;
      const url = URL.createObjectURL(file);
      setSourceUrl(url);
      const data = await loadImageToData(url);
      sourceImageData.current = data;
      baseImageData.current = data;
      transferredImageData.current = null;
      setHasLoadedImage(true);
      if (pendingPresetId) {
        void runApplyPreset(pendingPresetId);
        setPendingPresetId("");
      }
    },
    [loadImageToData, pendingPresetId, runApplyPreset]
  );

  const getCurrentCanvasBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95));
  }, []);

  const loadSourceFromObjectUrl = useCallback(async (url: string, fileName = "source.jpg") => {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
    sourceFileRef.current = file;
    setSourceUrl(url);
    const data = await loadImageToData(url);
    sourceImageData.current = data;
    baseImageData.current = data;
    transferredImageData.current = null;
    setHasLoadedImage(true);
    const sessionPreset = sessionStorage.getItem("kinolu_capture_preset_id") || "";
    if (sessionPreset) {
      void runApplyPreset(sessionPreset);
      sessionStorage.removeItem("kinolu_capture_preset_id");
    }
  }, [loadImageToData, runApplyPreset]);

  useEffect(() => {
    const queryPreset = new URLSearchParams(window.location.search).get("preset") || "";
    const sessionPreset = sessionStorage.getItem("kinolu_capture_preset_id") || "";
    const captureUrl = sessionStorage.getItem("kinolu_captured");
    if (queryPreset) setPendingPresetId(queryPreset);
    else if (sessionPreset) setPendingPresetId(sessionPreset);

    if (captureUrl) {
      void loadSourceFromObjectUrl(captureUrl, "captured.jpg").finally(() => {
        sessionStorage.removeItem("kinolu_captured");
      });
    }
  }, [loadSourceFromObjectUrl]);

  useEffect(() => {
    if (!pendingPresetId || !sourceFileRef.current) return;
    void runApplyPreset(pendingPresetId);
    setPendingPresetId("");
  }, [pendingPresetId, runApplyPreset]);

  const handleRefUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      const newFiles = Array.from(files);
      refFilesRef.current = [...refFilesRef.current, ...newFiles];
      const newUrls = newFiles.map((f) => URL.createObjectURL(f));
      setRefImages((prev) => [...prev, ...newUrls]);
      if (refImages.length === 0) setActiveRefIdx(0);
    },
    [refImages.length]
  );

  const runTransfer = useCallback(async () => {
    const source = sourceFileRef.current;
    const ref = refFilesRef.current[activeRefIdx];
    if (!source || !ref) return;
    setProcessing(true);
    setErrorMsg(null);
    try {
      const response = await transferImage(ref, source, params);
      const url = URL.createObjectURL(response.imageBlob);
      const data = await loadImageToData(url);
      transferredImageData.current = data;
      baseImageData.current = data;
      setHasLoadedImage(true);
      if (params.auto_xy) {
        setParams((p) => ({
          ...p,
          color_strength: response.autoX,
          tone_strength: response.autoY,
        }));
      }
    } catch (err) {
      const msg =
        err instanceof TypeError && String(err).includes("Failed to fetch")
          ? "Backend not reachable \u2014 start the server at :8000"
          : `Transfer failed: ${err}`;
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setProcessing(false);
    }
  }, [activeRefIdx, params, loadImageToData]);

  const updateXY = useCallback((x: number, y: number) => {
    setParams((p) => ({ ...p, color_strength: x, tone_strength: y, auto_xy: false }));
  }, []);

  const adjValues: Record<AdjustmentTool, number> = {
    exposure: params.exposure, contrast: params.contrast,
    highlights: params.highlights, shadows: params.shadows,
    saturation: params.sat, vibrance: params.vib,
    warmth: params.temp, tint: params.tint,
    grain: params.grain, sharpen: params.sharpen,
    vignette: params.vignette, bloom: params.bloom,
  };

  const handleAdjChange = useCallback(
    (tool: AdjustmentTool, value: number) => {
      const paramKey = TOOL_TO_PARAM[tool];
      setParams((p) => ({ ...p, [paramKey]: value }));
    },
    []
  );

  const handleReset = useCallback(() => {
    setParams(DEFAULT_EDIT_PARAMS);
    if (transferredImageData.current) {
      baseImageData.current = transferredImageData.current;
    } else if (sourceImageData.current) {
      baseImageData.current = sourceImageData.current;
    }
  }, []);

  const handleDownload = useCallback(async () => {
    const blob = await getCurrentCanvasBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinolu_${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getCurrentCanvasBlob]);

  const handleShare = useCallback(async () => {
    const blob = await getCurrentCanvasBlob();
    if (!blob) return;
    const file = new File([blob], `kinolu_${Date.now()}.jpg`, { type: "image/jpeg" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Kinolu Edit" });
      } catch {
        handleDownload();
      }
    } else {
      handleDownload();
    }
  }, [getCurrentCanvasBlob, handleDownload]);

  const handleSavePreset = useCallback(async () => {
    const source = sourceFileRef.current;
    if (!source) {
      setErrorMsg("Please import a source image first.");
      return;
    }
    const blob = await getCurrentCanvasBlob();
    if (!blob) {
      setErrorMsg("Current preview is empty.");
      return;
    }
    const name = window.prompt("Preset name", `Look ${new Date().toLocaleDateString()}`)?.trim();
    if (!name) return;

    setSavingPreset(true);
    setErrorMsg(null);
    try {
      const preset = await createPresetFromTransfer(source, blob, name);
      sessionStorage.setItem("kinolu_last_saved_preset", preset.id);
      router.push("/presets");
    } catch (err) {
      setErrorMsg(`Save preset failed: ${err}`);
    } finally {
      setSavingPreset(false);
    }
  }, [getCurrentCanvasBlob, router]);

  const handleExportLut = useCallback(async () => {
    const source = sourceFileRef.current;
    if (!source) {
      setErrorMsg("Please import a source image first.");
      return;
    }
    const blob = await getCurrentCanvasBlob();
    if (!blob) {
      setErrorMsg("Current preview is empty.");
      return;
    }

    setExportingLut(true);
    setErrorMsg(null);
    try {
      const cube = await exportLutFromTransfer(source, blob, 33);
      const url = URL.createObjectURL(cube);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kinolu_${Date.now()}.cube`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(`Export LUT failed: ${err}`);
    } finally {
      setExportingLut(false);
    }
  }, [getCurrentCanvasBlob]);

  const hasSource = !!sourceUrl;
  const hasRef = refImages.length > 0;
  const canProcess = hasSource && hasRef && !processing;

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <input ref={sourceInputRef} type="file" accept="image/*" className="hidden" onChange={handleSourceUpload} />
      <input ref={refInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />

      {/* Header */}
      <div className="flex items-center justify-between h-[50px] px-4 safe-top shrink-0">
        <button onClick={() => router.push("/")} className="flex items-center gap-1 text-white text-[14px] font-semibold">
          <IconBack size={20} /><span>Done</span>
        </button>
        <div className="flex items-center gap-4">
          {hasLoadedImage && (
            <button
              onClick={handleSavePreset}
              disabled={savingPreset}
              className="text-white/70 hover:text-white transition-colors text-[11px] tracking-wider uppercase disabled:opacity-40"
              title="Save as preset"
            >
              {savingPreset ? "Saving..." : "Save"}
            </button>
          )}
          <button
            onClick={() => router.push("/presets")}
            className="text-white/70 hover:text-white transition-colors text-[11px] tracking-wider uppercase"
            title="Open presets"
          >
            Presets
          </button>
          {hasLoadedImage && (
            <button
              onClick={handleExportLut}
              disabled={exportingLut}
              className="text-white/70 hover:text-white transition-colors text-[11px] tracking-wider uppercase disabled:opacity-40"
              title="Export LUT"
            >
              {exportingLut ? "Exporting..." : "LUT"}
            </button>
          )}
          {hasLoadedImage && (
            <button onClick={handleDownload} className="text-white/70 hover:text-white transition-colors" title="Download">
              <IconDownload size={20} />
            </button>
          )}
          {hasLoadedImage && (
            <button
              onPointerDown={() => setComparing(true)}
              onPointerUp={() => setComparing(false)}
              onPointerLeave={() => setComparing(false)}
              className="text-white/70 hover:text-white transition-colors" title="Hold to compare"
            >
              <IconCompare size={22} />
            </button>
          )}
          <button onClick={handleReset} className="text-white/50 hover:text-white transition-colors" title="Reset">
            <IconReset size={20} />
          </button>
          <button onClick={handleShare} className="text-white/70 hover:text-white transition-colors" title="Share">
            <IconShare size={22} />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-3 relative overflow-hidden">
        {hasLoadedImage ? (
          <>
            <canvas
              ref={displayCanvasRef}
              className={`max-w-full max-h-full object-contain rounded-sm select-none ${comparing ? "hidden" : ""}`}
              style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
            />
            {comparing && sourceUrl && (
              <img src={sourceUrl} alt="Original" className="max-w-full max-h-full object-contain rounded-sm select-none" style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }} draggable={false} />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <button onClick={() => sourceInputRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-k-border-light flex items-center justify-center hover:border-white/40 transition-colors">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-k-muted">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <span className="text-[12px] text-k-text-secondary tracking-wider">Tap to import a photo</span>
          </div>
        )}

        {processing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-[12px] text-white/70 tracking-wider">Transferring\u2026</span>
            </div>
          </div>
        )}

        {comparing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-[11px] text-white/80 tracking-wider uppercase">Original</span>
          </div>
        )}

        {errorMsg && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-900/70 backdrop-blur-sm rounded-lg px-4 py-3 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-300 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-[12px] text-red-100 leading-snug">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-300 hover:text-white shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Tool content */}
      <div className="shrink-0 overflow-y-auto" style={{ maxHeight: "45vh" }}>
        <div className="py-4">
          {activeTab === "transfer" && (
            <div className="flex flex-col gap-4">
              <XYPad x={params.color_strength} y={params.tone_strength} onChange={updateXY} />
              <ThumbStrip images={refImages} activeIndex={activeRefIdx} onSelect={setActiveRefIdx} onAdd={() => refInputRef.current?.click()} />
              {hasSource && hasRef && (
                <div className="px-6 pb-2">
                  <button onClick={runTransfer} disabled={!canProcess}
                    className={`w-full py-3 rounded-xl text-[13px] font-semibold tracking-wider uppercase transition-all ${canProcess ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]" : "bg-k-raised text-k-muted cursor-not-allowed"}`}>
                    {processing ? "Processing\u2026" : "Apply Transfer"}
                  </button>
                </div>
              )}
              {!hasSource && (
                <div className="px-6">
                  <button onClick={() => sourceInputRef.current?.click()}
                    className="w-full py-3 rounded-xl text-[13px] font-medium tracking-wider bg-k-surface border border-k-border text-white/70 hover:bg-k-raised transition-colors">
                    Import Source Photo
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "edit" && (
            <AdjustmentPanel values={adjValues} activeTool={activeTool} onSelectTool={setActiveTool} onChangeValue={handleAdjChange} />
          )}

          {activeTab === "curves" && (
            <CurveEditor curves={params.curve_points} onChange={(curves) => setParams((p) => ({ ...p, curve_points: curves }))} />
          )}

          {activeTab === "hsl" && (
            <HSLPanel hsl7={params.hsl7} onChange={(hsl7) => setParams((p) => ({ ...p, hsl7 }))} />
          )}
        </div>
      </div>

      <EditorTabBar active={activeTab} onSelect={setActiveTab} />
    </div>
  );
}
