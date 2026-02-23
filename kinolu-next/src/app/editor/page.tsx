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

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [activeRefIdx, setActiveRefIdx] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasTransferred, setHasTransferred] = useState(false);

  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageData = useRef<ImageData | null>(null);
  const transferredImageData = useRef<ImageData | null>(null);
  const baseImageData = useRef<ImageData | null>(null);
  const rafId = useRef(0);
  const sourceFileRef = useRef<File | null>(null);
  const refFilesRef = useRef<File[]>([]);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

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

  const renderPreview = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const base = baseImageData.current;
      const canvas = displayCanvasRef.current;
      if (!base || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = base.width; canvas.height = base.height;
      ctx.putImageData(hasActiveEdits(params) ? applyEdits(base, params) : base, 0, 0);
    });
  }, [params]);

  useEffect(() => { if (baseImageData.current) renderPreview(); }, [params, renderPreview]);

  /* ── Preset apply ── */
  const runApplyPreset = useCallback(async (presetId: string) => {
    const source = sourceFileRef.current;
    if (!source || !presetId) return;
    setProcessing(true); setErrorMsg(null);
    try {
      const blob = await applyPresetToImage(source, presetId);
      const data = await loadImageToData(URL.createObjectURL(blob));
      transferredImageData.current = data; baseImageData.current = data; setHasTransferred(true);
    } catch (err) { setErrorMsg(`Preset failed: ${err}`); setTimeout(() => setErrorMsg(null), 4000); }
    finally { setProcessing(false); }
  }, [loadImageToData]);

  /* ── Uploads ── */
  const handleSourceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    sourceFileRef.current = file;
    const url = URL.createObjectURL(file); setSourceUrl(url);
    const data = await loadImageToData(url);
    sourceImageData.current = data; baseImageData.current = data;
    transferredImageData.current = null; setHasTransferred(false);
    if (pendingPresetId) { void runApplyPreset(pendingPresetId); setPendingPresetId(""); }
  }, [loadImageToData, pendingPresetId, runApplyPreset]);

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const arr = Array.from(files);
    refFilesRef.current = [...refFilesRef.current, ...arr];
    setRefImages((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    if (refImages.length === 0) setActiveRefIdx(0);
  }, [refImages.length]);

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
      transferredImageData.current = data; baseImageData.current = data; setHasTransferred(true);
      if (params.auto_xy) setParams((p) => ({ ...p, color_strength: resp.autoX, tone_strength: resp.autoY }));
    } catch (err) {
      setErrorMsg(err instanceof TypeError && String(err).includes("Failed to fetch") ? "Backend not reachable" : `Transfer failed: ${err}`);
      setTimeout(() => setErrorMsg(null), 4000);
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
  }, []);

  /* ── Export ── */
  const handleDownload = useCallback(async () => {
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `kinolu_${Date.now()}.jpg`; a.click();
  }, [getCurrentCanvasBlob]);

  const handleShare = useCallback(async () => {
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const file = new File([blob], `kinolu_${Date.now()}.jpg`, { type: "image/jpeg" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Kinolu" }); } catch { handleDownload(); }
    } else { handleDownload(); }
  }, [getCurrentCanvasBlob, handleDownload]);

  const handleSavePreset = useCallback(async () => {
    if (!sourceFileRef.current) return;
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const name = window.prompt("Preset name", `Look ${new Date().toLocaleDateString()}`)?.trim();
    if (!name) return;
    setSavingPreset(true);
    try { const p = await createPresetFromTransfer(sourceFileRef.current, blob, name); sessionStorage.setItem("kinolu_last_saved_preset", p.id); router.push("/presets"); }
    catch (err) { setErrorMsg(`Save failed: ${err}`); }
    finally { setSavingPreset(false); }
  }, [getCurrentCanvasBlob, router]);

  const handleExportLut = useCallback(async () => {
    if (!sourceFileRef.current) return;
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    setExportingLut(true);
    try { const cube = await exportLutFromTransfer(sourceFileRef.current, blob, 33); const a = document.createElement("a"); a.href = URL.createObjectURL(cube); a.download = `kinolu_${Date.now()}.cube`; a.click(); }
    catch (err) { setErrorMsg(`LUT export failed: ${err}`); }
    finally { setExportingLut(false); }
  }, [getCurrentCanvasBlob]);

  const hasImage = !!sourceUrl || hasTransferred;
  const canProcess = !!sourceUrl && refImages.length > 0 && !processing;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="flex flex-col w-full h-full bg-black">
      <input ref={sourceInputRef} type="file" accept="image/*" className="hidden" onChange={handleSourceUpload} />
      <input ref={refInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />

      {/* ── Header — thin, Lightroom-like ── */}
      <header className="flex items-center justify-between h-[44px] px-4 safe-top shrink-0 z-10">
        <button onClick={() => router.push("/")} className="w-8 h-8 flex items-center justify-center text-white/60">
          <IconBack size={20} />
        </button>
        {hasImage && (
          <div className="flex items-center">
            <button onClick={handleSavePreset} disabled={savingPreset} className="px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase text-white/50 hover:text-white disabled:opacity-30">{savingPreset ? "..." : "Save"}</button>
            <button onClick={handleExportLut} disabled={exportingLut} className="px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase text-white/50 hover:text-white disabled:opacity-30">{exportingLut ? "..." : "LUT"}</button>
            <button onClick={handleDownload} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white"><IconDownload size={17} /></button>
            <button onClick={handleShare} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white"><IconShare size={17} /></button>
          </div>
        )}
      </header>

      {/* ── Canvas — maximum real estate ── */}
      <div className="flex-1 min-h-0 relative">
        {hasImage ? (
          <>
            {/* Image */}
            <div className="absolute inset-0 flex items-center justify-center px-3 py-2">
              <canvas ref={displayCanvasRef} className={`max-w-full max-h-full object-contain rounded-sm ${comparing ? "hidden" : ""}`} />
              {comparing && sourceUrl && <img src={sourceUrl} alt="Original" className="max-w-full max-h-full object-contain rounded-sm" draggable={false} />}
            </div>

            {/* Ref thumbnails — top-right overlay */}
            {refImages.length > 0 && (
              <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                {refImages.map((src, i) => (
                  <button key={i} onClick={() => setActiveRefIdx(i)}
                    className={`w-9 h-9 rounded-md overflow-hidden transition-all ${i === activeRefIdx ? "ring-[1.5px] ring-white/70 shadow-lg" : "opacity-40"}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                <button onClick={() => refInputRef.current?.click()} className="w-9 h-9 rounded-md border border-dashed border-white/15 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                  <IconPlus size={12} className="text-white/40" />
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
            {comparing && <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-sm px-3 py-0.5 rounded-full"><span className="text-[9px] text-white/70 tracking-[2px] uppercase">Original</span></div>}
          </>
        ) : (
          /* Empty state */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <button onClick={() => sourceInputRef.current?.click()} className="w-20 h-20 rounded-2xl border border-dashed border-white/10 flex items-center justify-center hover:border-white/25 transition-colors">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-white/20">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <span className="text-[12px] text-white/30 tracking-wider">Import a photo</span>
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

        {/* Error */}
        {errorMsg && (
          <div className="absolute bottom-2 left-2 right-2 z-30 bg-red-900/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] text-red-100 flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-300 hover:text-white"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
          </div>
        )}
      </div>

      {/* ── Control tray ── */}
      <div className="shrink-0 bg-[#080808]" style={{ maxHeight: "40vh" }}>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(40vh - 52px)" }}>
          <div className="py-2">
            {activeTab === "transfer" && (
              <div className="flex flex-col gap-3">
                <XYPad x={params.color_strength} y={params.tone_strength} onChange={updateXY} />
                <div className="flex items-center gap-2 px-5 pb-1">
                  {!sourceUrl && (
                    <button onClick={() => sourceInputRef.current?.click()} className="flex-1 py-2.5 rounded-xl text-[11px] tracking-wider bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white/80 transition-colors">Import Photo</button>
                  )}
                  {sourceUrl && refImages.length === 0 && (
                    <button onClick={() => refInputRef.current?.click()} className="flex-1 py-2.5 rounded-xl text-[11px] tracking-wider bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white/80 transition-colors">Add Reference</button>
                  )}
                  {canProcess && (
                    <button onClick={runTransfer} className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold tracking-wider bg-white text-black active:scale-[0.98] transition-all">
                      {processing ? "Processing…" : "Apply"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeTab === "edit" && <AdjustmentPanel values={adjValues} activeTool={activeTool} onSelectTool={setActiveTool} onChangeValue={handleAdjChange} />}
            {activeTab === "curves" && <CurveEditor curves={params.curve_points} onChange={(c) => setParams((p) => ({ ...p, curve_points: c }))} />}
            {activeTab === "hsl" && <HSLPanel hsl7={params.hsl7} onChange={(h) => setParams((p) => ({ ...p, hsl7: h }))} />}
          </div>
        </div>
        <EditorTabBar active={activeTab} onSelect={setActiveTab} />
      </div>
    </div>
  );
}
