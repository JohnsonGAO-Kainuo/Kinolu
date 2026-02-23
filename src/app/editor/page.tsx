"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EditParams, AdjustmentTool, EditorTab } from "@/lib/types";
import { DEFAULT_EDIT_PARAMS } from "@/lib/types";
import {
  applyPresetToImage,
  createPresetFromTransfer,
  exportLutFromTransfer,
  transferImage,
} from "@/lib/api";
import { applyEdits, hasActiveEdits } from "@/lib/imageProcessor";
import {
  IconBack,
  IconShare,
  IconCompare,
  IconReset,
  IconDownload,
  IconPlus,
} from "@/components/icons";
import XYPad from "@/components/XYPad";
import AdjustmentPanel from "@/components/AdjustmentPanel";
import CurveEditor from "@/components/CurveEditor";
import HSLPanel from "@/components/HSLPanel";
import EditorTabBar from "@/components/EditorTabBar";

const TOOL_TO_PARAM: Record<AdjustmentTool, keyof EditParams> = {
  exposure: "exposure", contrast: "contrast",
  highlights: "highlights", shadows: "shadows",
  saturation: "sat", vibrance: "vib",
  warmth: "temp", tint: "tint",
  grain: "grain", sharpen: "sharpen",
  vignette: "vignette", bloom: "bloom",
};

export default function EditorPage() {
  const router = useRouter();

  const [params, setParams] = useState<EditParams>(DEFAULT_EDIT_PARAMS);
  const [activeTab, setActiveTab] = useState<EditorTab>("transfer");
  const [activeTool, setActiveTool] = useState<AdjustmentTool>("exposure");
  const [processing, setProcessing] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [exportingLut, setExportingLut] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [activeRefIdx, setActiveRefIdx] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasTransferred, setHasTransferred] = useState(false);
  const [renderTick, setRenderTick] = useState(0);

  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageData = useRef<ImageData | null>(null);
  const transferredImageData = useRef<ImageData | null>(null);
  const baseImageData = useRef<ImageData | null>(null);
  const rafId = useRef(0);
  const sourceFileRef = useRef<File | null>(null);
  const refFilesRef = useRef<File[]>([]);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  /* ── Helpers ── */
  const loadImageToData = useCallback(
    (url: string): Promise<ImageData> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const MAX = 1200;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX || h > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
          resolve(ctx.getImageData(0, 0, w, h));
        };
        img.onerror = reject;
        img.src = url;
      }),
    []
  );

  /* Paint canvas directly — called after any data change */
  const paintCanvas = useCallback((data: ImageData) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = data.width;
    canvas.height = data.height;
    ctx.putImageData(data, 0, 0);
  }, []);

  const renderPreview = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const base = baseImageData.current;
      if (!base) return;
      paintCanvas(hasActiveEdits(params) ? applyEdits(base, params) : base);
    });
  }, [params, paintCanvas]);

  useEffect(() => { if (baseImageData.current) renderPreview(); }, [params, renderPreview, renderTick]);

  /* ── Preset apply ── */
  const runApplyPreset = useCallback(async (presetId: string) => {
    const source = sourceFileRef.current;
    if (!source || !presetId) return;
    setProcessing(true); setErrorMsg(null);
    try {
      const blob = await applyPresetToImage(source, presetId);
      const data = await loadImageToData(URL.createObjectURL(blob));
      transferredImageData.current = data; baseImageData.current = data;
      setHasTransferred(true);
      setRenderTick((t) => t + 1);
      showToast("Preset applied");
    } catch (err) { setErrorMsg(`Preset failed: ${err}`); setTimeout(() => setErrorMsg(null), 4000); }
    finally { setProcessing(false); }
  }, [loadImageToData, showToast]);

  /* ── Uploads ── */
  const handleSourceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    sourceFileRef.current = file;
    const url = URL.createObjectURL(file); setSourceUrl(url);
    const data = await loadImageToData(url);
    sourceImageData.current = data; baseImageData.current = data;
    transferredImageData.current = null; setHasTransferred(false);
    setRenderTick((t) => t + 1);
    if (pendingPresetId) { void runApplyPreset(pendingPresetId); setPendingPresetId(""); }
  }, [loadImageToData, pendingPresetId, runApplyPreset]);

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const arr = Array.from(files);
    refFilesRef.current = [...refFilesRef.current, ...arr];
    setRefImages((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    if (refImages.length === 0) setActiveRefIdx(0);
  }, [refImages.length]);

  const removeRef = useCallback((idx: number) => {
    refFilesRef.current = refFilesRef.current.filter((_, i) => i !== idx);
    setRefImages((prev) => prev.filter((_, i) => i !== idx));
    if (activeRefIdx >= idx && activeRefIdx > 0) setActiveRefIdx((p) => p - 1);
  }, [activeRefIdx]);

  const getCurrentCanvasBlob = useCallback(async (): Promise<Blob | null> => {
    const c = displayCanvasRef.current; if (!c) return null;
    return new Promise((r) => c.toBlob((b) => r(b), "image/jpeg", 0.95));
  }, []);

  /* ── Session handoff (camera → editor) ── */
  const loadSourceFromObjectUrl = useCallback(async (url: string, fileName = "source.jpg") => {
    const res = await fetch(url); const blob = await res.blob();
    sourceFileRef.current = new File([blob], fileName, { type: blob.type || "image/jpeg" });
    setSourceUrl(url);
    const data = await loadImageToData(url);
    sourceImageData.current = data; baseImageData.current = data;
    transferredImageData.current = null; setHasTransferred(false);
    setRenderTick((t) => t + 1);
    const sp = sessionStorage.getItem("kinolu_capture_preset_id") || "";
    if (sp) { void runApplyPreset(sp); sessionStorage.removeItem("kinolu_capture_preset_id"); }
  }, [loadImageToData, runApplyPreset]);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("preset") || "";
    const sp = sessionStorage.getItem("kinolu_capture_preset_id") || "";
    const cap = sessionStorage.getItem("kinolu_captured");
    if (qp) setPendingPresetId(qp); else if (sp) setPendingPresetId(sp);
    if (cap) { void loadSourceFromObjectUrl(cap, "captured.jpg").finally(() => sessionStorage.removeItem("kinolu_captured")); }
  }, [loadSourceFromObjectUrl]);

  useEffect(() => {
    if (!pendingPresetId || !sourceFileRef.current) return;
    void runApplyPreset(pendingPresetId); setPendingPresetId("");
  }, [pendingPresetId, runApplyPreset]);

  /* ── Transfer ── */
  const runTransfer = useCallback(async () => {
    const source = sourceFileRef.current; const ref = refFilesRef.current[activeRefIdx];
    if (!source || !ref) return;
    setProcessing(true); setErrorMsg(null);
    try {
      const resp = await transferImage(ref, source, params);
      const data = await loadImageToData(URL.createObjectURL(resp.imageBlob));
      transferredImageData.current = data; baseImageData.current = data;
      setHasTransferred(true);
      setRenderTick((t) => t + 1);
      if (params.auto_xy) setParams((p) => ({ ...p, color_strength: resp.autoX, tone_strength: resp.autoY }));
    } catch (err) {
      setErrorMsg(err instanceof TypeError && String(err).includes("Failed to fetch") ? "Backend not reachable — run start.sh first" : `Transfer failed: ${err}`);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally { setProcessing(false); }
  }, [activeRefIdx, params, loadImageToData]);

  const updateXY = useCallback((x: number, y: number) => {
    setParams((p) => ({ ...p, color_strength: x, tone_strength: y, auto_xy: false }));
  }, []);

  /* ── Adjustments ── */
  const adjValues: Record<AdjustmentTool, number> = {
    exposure: params.exposure, contrast: params.contrast,
    highlights: params.highlights, shadows: params.shadows,
    saturation: params.sat, vibrance: params.vib,
    warmth: params.temp, tint: params.tint,
    grain: params.grain, sharpen: params.sharpen,
    vignette: params.vignette, bloom: params.bloom,
  };
  const handleAdjChange = useCallback((tool: AdjustmentTool, value: number) => {
    setParams((p) => ({ ...p, [TOOL_TO_PARAM[tool]]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_EDIT_PARAMS);
    baseImageData.current = transferredImageData.current || sourceImageData.current;
    setRenderTick((t) => t + 1);
  }, []);

  /* ── Export ── */
  const handleDownload = useCallback(async () => {
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `kinolu_${Date.now()}.jpg`; a.click();
    showToast("Image saved");
  }, [getCurrentCanvasBlob, showToast]);

  const handleShare = useCallback(async () => {
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const file = new File([blob], `kinolu_${Date.now()}.jpg`, { type: "image/jpeg" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Kinolu" }); } catch { handleDownload(); }
    } else { handleDownload(); }
  }, [getCurrentCanvasBlob, handleDownload]);

  const handleSavePreset = useCallback(async () => {
    if (!sourceFileRef.current) { showToast("Import a photo first"); return; }
    if (!hasTransferred) { showToast("Apply a transfer first"); return; }
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const name = window.prompt("Preset name", `Look ${new Date().toLocaleDateString()}`)?.trim();
    if (!name) return;
    setSavingPreset(true);
    try {
      await createPresetFromTransfer(sourceFileRef.current, blob, name);
      showToast(`Preset "${name}" saved`);
    } catch (err) { setErrorMsg(`Save failed — is the backend running? ${err}`); }
    finally { setSavingPreset(false); }
  }, [getCurrentCanvasBlob, showToast, hasTransferred]);

  const handleExportLut = useCallback(async () => {
    if (!sourceFileRef.current) { showToast("Import a photo first"); return; }
    if (!hasTransferred) { showToast("Apply a transfer first"); return; }
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    setExportingLut(true);
    try {
      const cube = await exportLutFromTransfer(sourceFileRef.current, blob, 33);
      const a = document.createElement("a"); a.href = URL.createObjectURL(cube);
      a.download = `kinolu_${Date.now()}.cube`; a.click();
      showToast("LUT exported as .cube");
    } catch (err) { setErrorMsg(`LUT export failed — is the backend running? ${err}`); }
    finally { setExportingLut(false); }
  }, [getCurrentCanvasBlob, showToast, hasTransferred]);

  const hasImage = !!sourceUrl || hasTransferred;
  const canProcess = !!sourceUrl && refImages.length > 0 && !processing;

  /* ── Flow step ── */
  const step = !sourceUrl ? 1 : refImages.length === 0 ? 2 : !hasTransferred ? 3 : 4;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="flex flex-col w-full h-full bg-black">
      <input ref={sourceInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSourceUpload} />
      <input ref={refInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />

      {/* ── Header ── */}
      <header className="flex items-center justify-between h-[44px] px-4 safe-top shrink-0 z-10">
        <button onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/");
          }} className="w-8 h-8 flex items-center justify-center text-white/60 active:text-white">
          <IconBack size={20} />
        </button>
        <div className="flex items-center gap-0.5">
          <button onClick={handleSavePreset} disabled={savingPreset}
            className={`px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase transition-colors ${hasTransferred ? "text-white/60 hover:text-white" : "text-white/20"} disabled:opacity-30`}>
            {savingPreset ? "…" : "Save"}
          </button>
          <button onClick={handleExportLut} disabled={exportingLut}
            className={`px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase transition-colors ${hasTransferred ? "text-white/60 hover:text-white" : "text-white/20"} disabled:opacity-30`}>
            {exportingLut ? "…" : "LUT"}
          </button>
          <button onClick={handleDownload} disabled={!hasImage} className={`w-8 h-8 flex items-center justify-center transition-colors ${hasImage ? "text-white/50 hover:text-white" : "text-white/15"}`}>
            <IconDownload size={17} />
          </button>
          <button onClick={handleShare} disabled={!hasImage} className={`w-8 h-8 flex items-center justify-center transition-colors ${hasImage ? "text-white/50 hover:text-white" : "text-white/15"}`}>
            <IconShare size={17} />
          </button>
        </div>
      </header>

      {/* ── Canvas area ── */}
      <div className="flex-1 min-h-0 relative">
        {hasImage ? (
          <>
            {/* Image display */}
            <div className="absolute inset-0 flex items-center justify-center px-3 py-2">
              <canvas ref={displayCanvasRef} className={`max-w-full max-h-full object-contain rounded-sm ${comparing ? "hidden" : ""}`} />
              {comparing && sourceUrl && <img src={sourceUrl} alt="Original" className="max-w-full max-h-full object-contain rounded-sm" draggable={false} />}
            </div>

            {/* Step 2 hint — "add reference" (small floating pill) */}
            {step === 2 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full">
                <span className="text-[10px] text-white/50 tracking-[1px]">Add a reference image below</span>
              </div>
            )}

            {/* Step 3 hint — "tap apply" */}
            {step === 3 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full">
                <span className="text-[10px] text-white/50 tracking-[1px]">Tap Apply to transfer colors</span>
              </div>
            )}

            {/* XY Pad — floating over image, bottom-right (like ColorBy) */}
            {activeTab === "transfer" && hasImage && (
              <div className="absolute bottom-3 right-3 z-10 flex items-end gap-2">
                <XYPad x={params.color_strength} y={params.tone_strength} onChange={updateXY} compact />
                <button
                  onClick={() => {
                    setParams((p) => ({ ...p, auto_xy: true, color_strength: 0.88, tone_strength: 0.78 }));
                    if (canProcess) runTransfer();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-[10px] text-white/60 tracking-wider active:text-white transition-colors"
                >
                  Auto
                </button>
              </div>
            )}

            {/* Compare + Reset — bottom-left floating */}
            <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
              {hasTransferred && (
                <button onPointerDown={() => setComparing(true)} onPointerUp={() => setComparing(false)} onPointerLeave={() => setComparing(false)}
                  className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/50 active:text-white">
                  <IconCompare size={15} />
                </button>
              )}
              <button onClick={handleReset} className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/30 active:text-white">
                <IconReset size={15} />
              </button>
            </div>

            {/* Comparing badge */}
            {comparing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-sm px-3 py-0.5 rounded-full">
                <span className="text-[9px] text-white/70 tracking-[2px] uppercase">Original</span>
              </div>
            )}
          </>
        ) : (
          /* ── Empty state — step 1 ── */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
            <button onClick={() => sourceInputRef.current?.click()}
              className="w-24 h-24 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-white/25 hover:bg-white/[0.02] transition-all active:scale-95">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-white/25">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-[10px] text-white/25 tracking-[1px]">Import</span>
            </button>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[13px] text-white/50 font-medium">Import a photo to start</span>
              <span className="text-[10px] text-white/25 leading-relaxed text-center max-w-[220px]">
                Then add a reference image whose colors you want to transfer
              </span>
            </div>
          </div>
        )}

        {/* Processing spinner */}
        {processing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-[10px] text-white/50 tracking-[2px]">Processing…</span>
            </div>
          </div>
        )}

        {/* Error toast */}
        {errorMsg && (
          <div className="absolute bottom-2 left-2 right-2 z-30 bg-red-900/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] text-red-100 flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-300 hover:text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        )}

        {/* Success toast */}
        {toast && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5">
            <span className="text-[10px] text-white/80 tracking-[1px]">{toast}</span>
          </div>
        )}
      </div>

      {/* ── Control tray ── */}
      <div className="shrink-0 bg-[#080808]" style={{ maxHeight: "40vh" }}>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(40vh - 52px)" }}>
          <div className="py-2">
            {activeTab === "transfer" && (
              <div className="flex flex-col gap-2 px-5 py-1">
                {/* Reference thumbnails strip */}
                {refImages.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1 -mx-1 px-1 no-scrollbar">
                    {refImages.map((src, i) => (
                      <button key={i} onClick={() => setActiveRefIdx(i)} onDoubleClick={() => removeRef(i)}
                        className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          i === activeRefIdx
                            ? "border-white/70 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                            : "border-white/10 hover:border-white/25"
                        }`}>
                        <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
                        {i === activeRefIdx && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent h-4 flex items-end justify-center pb-0.5">
                            <div className="w-1 h-1 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    ))}
                    <button onClick={() => refInputRef.current?.click()}
                      className="shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/15 flex items-center justify-center hover:border-white/30 transition-colors">
                      <IconPlus size={12} className="text-white/30" />
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pb-1">
                  {step === 1 && (
                    <button onClick={() => sourceInputRef.current?.click()}
                      className="flex-1 py-2.5 rounded-xl text-[11px] tracking-wider bg-white text-black font-semibold active:scale-[0.98] transition-all">
                      Import Photo
                    </button>
                  )}
                  {step === 2 && (
                    <button onClick={() => refInputRef.current?.click()}
                      className="flex-1 py-2.5 rounded-xl text-[11px] tracking-wider bg-white text-black font-semibold active:scale-[0.98] transition-all">
                      Add Reference
                    </button>
                  )}
                  {step >= 3 && (
                    <>
                      <button onClick={runTransfer} disabled={!canProcess}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold tracking-wider bg-white text-black active:scale-[0.98] transition-all disabled:opacity-40">
                        {processing ? "Processing…" : hasTransferred ? "Re-apply" : "Apply"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            {activeTab === "edit" && <AdjustmentPanel values={adjValues} activeTool={activeTool} onSelectTool={setActiveTool} onChangeValue={handleAdjChange} />}
            {activeTab === "curves" && <CurveEditor curves={params.curve_points} onChange={(c) => setParams((p) => ({ ...p, curve_points: c }))} />}
            {activeTab === "hsl" && <HSLPanel hsl7={params.hsl7} onChange={(h) => setParams((p) => ({ ...p, hsl7: h }))} />}
            {activeTab === "crop" && (
              <div className="flex flex-col items-center gap-4 px-5 py-3">
                {/* Aspect ratio pills */}
                <div className="flex items-center gap-2">
                  {[
                    { label: "Free", value: "free" },
                    { label: "1:1", value: "1:1" },
                    { label: "4:3", value: "4:3" },
                    { label: "16:9", value: "16:9" },
                    { label: "3:2", value: "3:2" },
                    { label: "9:16", value: "9:16" },
                  ].map((r) => (
                    <button
                      key={r.value}
                      className="px-3 py-1.5 rounded-full text-[10px] tracking-[0.5px] text-white/40 bg-white/[0.04] border border-white/[0.06] hover:text-white/70 hover:bg-white/[0.08] transition-colors"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {/* Rotate + Flip */}
                <div className="flex items-center gap-4">
                  <button className="flex flex-col items-center gap-1 group">
                    <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50">
                        <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    </div>
                    <span className="text-[9px] text-white/30 tracking-wider">Rotate</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 group">
                    <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50">
                        <line x1="12" y1="2" x2="12" y2="22" /><polyline points="5 12 2 9 5 6" /><polyline points="19 6 22 9 19 12" /><path d="M2 9h20" />
                      </svg>
                    </div>
                    <span className="text-[9px] text-white/30 tracking-wider">Flip H</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 group">
                    <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50 rotate-90">
                        <line x1="12" y1="2" x2="12" y2="22" /><polyline points="5 12 2 9 5 6" /><polyline points="19 6 22 9 19 12" /><path d="M2 9h20" />
                      </svg>
                    </div>
                    <span className="text-[9px] text-white/30 tracking-wider">Flip V</span>
                  </button>
                </div>
                <span className="text-[10px] text-white/20 tracking-wider">Crop preview coming soon</span>
              </div>
            )}
          </div>
        </div>
        <EditorTabBar active={activeTab} onSelect={setActiveTab} />
      </div>
    </div>
  );
}
