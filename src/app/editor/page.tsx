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
import { applyEdits, hasActiveEdits, cropImageData, rotateImageData90CW, flipImageDataH, flipImageDataV } from "@/lib/imageProcessor";
import { saveRefImage, listRefImages, deleteRefImage } from "@/lib/refStore";
import { listLocalLuts, type LutEntry } from "@/lib/lutStore";
import CropOverlay, { type CropRect } from "@/components/CropOverlay";
import { preloadSegmentationModels } from "@/lib/segmentation";
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
import { useI18n } from "@/lib/i18n";

const TOOL_TO_PARAM: Record<AdjustmentTool, keyof EditParams> = {
  exposure: "exposure", contrast: "contrast",
  highlights: "highlights", shadows: "shadows",
  whites: "whites", blacks: "blacks",
  warmth: "temp", tint: "tint",
  vibrance: "vib", saturation: "sat",
  texture: "texture", clarity: "clarity",
  dehaze: "dehaze", grain: "grain",
  vignette: "vignette", bloom: "bloom",
  sharpen: "sharpen", noise: "noise",
};

/* ── Undo/Redo history hook (atomic state to prevent race conditions) ── */
function useHistory<T>(initial: T) {
  const [state, setState] = useState({ stack: [initial] as T[], idx: 0 });

  const current = state.stack[state.idx] ?? initial;

  const push = useCallback((val: T) => {
    setState((prev) => {
      const trimmed = prev.stack.slice(0, prev.idx + 1);
      const next = [...trimmed, val];
      if (next.length > 30) next.shift();
      return { stack: next, idx: next.length - 1 };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => ({ ...prev, idx: Math.max(0, prev.idx - 1) }));
  }, []);

  const redo = useCallback(() => {
    setState((prev) => ({ ...prev, idx: Math.min(prev.stack.length - 1, prev.idx + 1) }));
  }, []);

  const reset = useCallback((val: T) => {
    setState({ stack: [val], idx: 0 });
  }, []);

  return {
    current,
    push,
    undo,
    redo,
    reset,
    canUndo: state.idx > 0,
    canRedo: state.idx < state.stack.length - 1,
  };
}

export default function EditorPage() {
  const router = useRouter();
  const { t } = useI18n();

  const history = useHistory<EditParams>(DEFAULT_EDIT_PARAMS);
  const params = history.current;
  const setParams = useCallback((updater: EditParams | ((p: EditParams) => EditParams)) => {
    const next = typeof updater === "function" ? updater(history.current) : updater;
    history.push(next);
  }, [history]);

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

  /* Crop state */
  const [cropAspect, setCropAspect] = useState("free");

  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageData = useRef<ImageData | null>(null);
  const transferredImageData = useRef<ImageData | null>(null);
  const baseImageData = useRef<ImageData | null>(null);
  const rafId = useRef(0);
  const sourceFileRef = useRef<File | null>(null);
  const refFilesRef = useRef<File[]>([]);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const refIdsRef = useRef<string[]>([]);

  /* Batch state */
  const [batchFiles, setBatchFiles] = useState<Array<{ file: File; url: string; resultUrl: string | null; status: "idle" | "processing" | "done" | "error" }>>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

  /* Preset/LUT strip */
  const [availableLuts, setAvailableLuts] = useState<Omit<LutEntry, "data">[]>([]);
  const [lutThumbUrls, setLutThumbUrls] = useState<Record<string, string>>({});

  /* Crop region */
  const [cropRegion, setCropRegion] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });

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

  /* ── Preload segmentation models (warm up GPU) ── */
  useEffect(() => { void preloadSegmentationModels(); }, []);

  /* ── Restore saved reference images ── */
  useEffect(() => {
    void (async () => {
      try {
        const saved = await listRefImages();
        if (saved.length > 0 && refImages.length === 0) {
          const urls: string[] = [];
          const files: File[] = [];
          const ids: string[] = [];
          for (const entry of saved) {
            urls.push(URL.createObjectURL(entry.blob));
            files.push(new File([entry.blob], entry.name, { type: entry.blob.type || "image/jpeg" }));
            ids.push(entry.id);
          }
          refFilesRef.current = files;
          refIdsRef.current = ids;
          setRefImages(urls);
          setActiveRefIdx(0);
        }
      } catch { /* ignore */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      showToast(t("editor_presetApplied"));
    } catch (err) { setErrorMsg(`${t("editor_presetFailed")}: ${err}`); setTimeout(() => setErrorMsg(null), 4000); }
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

  const handleRefUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const arr = Array.from(files);
    refFilesRef.current = [...refFilesRef.current, ...arr];
    setRefImages((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    if (refImages.length === 0) setActiveRefIdx(0);
    // Persist references to IndexedDB
    for (const f of arr) {
      const entry = await saveRefImage(f.name, f);
      refIdsRef.current.push(entry.id);
    }
  }, [refImages.length]);

  const removeRef = useCallback((idx: number) => {
    const dbId = refIdsRef.current[idx];
    if (dbId) void deleteRefImage(dbId);
    refFilesRef.current = refFilesRef.current.filter((_, i) => i !== idx);
    refIdsRef.current = refIdsRef.current.filter((_, i) => i !== idx);
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
    const localLut = new URLSearchParams(window.location.search).get("localLut") || "";
    const sp = sessionStorage.getItem("kinolu_capture_preset_id") || "";
    const cap = sessionStorage.getItem("kinolu_captured");
    if (localLut) setPendingPresetId(localLut);
    else if (qp) setPendingPresetId(qp);
    else if (sp) setPendingPresetId(sp);
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
      setErrorMsg(`${t("editor_transferFailed")}: ${err}`);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally { setProcessing(false); }
  }, [activeRefIdx, params, loadImageToData]);

  const updateXY = useCallback((x: number, y: number) => {
    setParams((p) => ({ ...p, color_strength: x, tone_strength: y, auto_xy: false }));
  }, []);

  /** Re-run transfer with new XY values (called on pointer-up from XYPad) */
  const commitXY = useCallback((_x: number, _y: number) => {
    const source = sourceFileRef.current;
    const ref = refFilesRef.current[activeRefIdx];
    if (!source || !ref) return;
    void runTransfer();
  }, [activeRefIdx, runTransfer]);

  /* ── Adjustments ── */
  const adjValues: Record<AdjustmentTool, number> = {
    exposure: params.exposure, contrast: params.contrast,
    highlights: params.highlights, shadows: params.shadows,
    whites: params.whites, blacks: params.blacks,
    warmth: params.temp, tint: params.tint,
    vibrance: params.vib, saturation: params.sat,
    texture: params.texture, clarity: params.clarity,
    dehaze: params.dehaze, grain: params.grain,
    vignette: params.vignette, bloom: params.bloom,
    sharpen: params.sharpen, noise: params.noise,
  };
  const handleAdjChange = useCallback((tool: AdjustmentTool, value: number) => {
    setParams((p) => ({ ...p, [TOOL_TO_PARAM[tool]]: value }));
  }, []);

  const handleReset = useCallback(() => {
    if (!window.confirm(t("editor_resetConfirm"))) return;
    history.reset(DEFAULT_EDIT_PARAMS);
    baseImageData.current = transferredImageData.current || sourceImageData.current;
    setRenderTick((t) => t + 1);
  }, [history]);

  /* ── Export ── */
  const handleDownload = useCallback(async () => {
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `kinolu_${Date.now()}.jpg`; a.click();
    showToast(t("editor_imageSaved"));
  }, [getCurrentCanvasBlob, showToast]);

  const handleShare = useCallback(async () => {
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const file = new File([blob], `kinolu_${Date.now()}.jpg`, { type: "image/jpeg" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Kinolu" }); } catch { handleDownload(); }
    } else { handleDownload(); }
  }, [getCurrentCanvasBlob, handleDownload]);

  const handleSavePreset = useCallback(async () => {
    if (!sourceFileRef.current) { showToast(t("editor_importPhotoFirst")); return; }
    if (!hasTransferred) { showToast(t("editor_applyTransferFirst")); return; }
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const name = window.prompt("Preset name", `Look ${new Date().toLocaleDateString()}`)?.trim();
    if (!name) return;
    setSavingPreset(true);
    try {
      // Pass current canvas as thumbnail for the preset library
      await createPresetFromTransfer(sourceFileRef.current, blob, name, blob);
      showToast(`Preset "${name}" saved`);
    } catch (err) { setErrorMsg(`${t("editor_saveFailed")} ${err}`); }
    finally { setSavingPreset(false); }
  }, [getCurrentCanvasBlob, showToast, hasTransferred]);

  const handleExportLut = useCallback(async () => {
    if (!sourceFileRef.current) { showToast(t("editor_importPhotoFirst")); return; }
    if (!hasTransferred) { showToast(t("editor_applyTransferFirst")); return; }
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    setExportingLut(true);
    try {
      const cube = await exportLutFromTransfer(sourceFileRef.current, blob, 33);
      const a = document.createElement("a"); a.href = URL.createObjectURL(cube);
      a.download = `kinolu_${Date.now()}.cube`; a.click();
      showToast(t("editor_lutExported"));
    } catch (err) { setErrorMsg(`${t("editor_lutExportFailed")} ${err}`); }
    finally { setExportingLut(false); }
  }, [getCurrentCanvasBlob, showToast, hasTransferred]);

  const hasImage = !!sourceUrl || hasTransferred;
  const canProcess = !!sourceUrl && refImages.length > 0 && !processing;

  /* ── Flow step ── */
  const step = !sourceUrl ? 1 : refImages.length === 0 ? 2 : !hasTransferred ? 3 : 4;

  /* ── Load available LUTs for preset strip ── */
  useEffect(() => {
    void listLocalLuts().then((luts) => {
      setAvailableLuts(luts);
      const urls: Record<string, string> = {};
      for (const l of luts) {
        if (l.thumbnail) urls[l.id] = URL.createObjectURL(l.thumbnail);
      }
      setLutThumbUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return urls;
      });
    }).catch(() => {});
  }, []);

  /* ── Apply LUT from preset strip ── */
  const applyLutInline = useCallback(async (lutId: string) => {
    const source = sourceFileRef.current;
    if (!source) { showToast(t("editor_importPhotoFirst")); return; }
    setProcessing(true); setErrorMsg(null);
    try {
      const blob = await applyPresetToImage(source, lutId);
      const data = await loadImageToData(URL.createObjectURL(blob));
      transferredImageData.current = data; baseImageData.current = data;
      setHasTransferred(true);
      setRenderTick((t) => t + 1);
      showToast(t("editor_presetApplied"));
    } catch (err) { setErrorMsg(`Preset failed: ${err}`); }
    finally { setProcessing(false); }
  }, [loadImageToData, showToast]);

  /* ── Batch import & process ── */
  const handleBatchImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    setBatchFiles(
      Array.from(files).slice(0, 9).map((f) => ({
        file: f, url: URL.createObjectURL(f), resultUrl: null, status: "idle" as const,
      })),
    );
    e.target.value = "";
  }, []);

  const runBatchTransfer = useCallback(async () => {
    const ref = refFilesRef.current[activeRefIdx];
    if (!ref || batchFiles.length === 0) return;
    setBatchProcessing(true);
    for (let i = 0; i < batchFiles.length; i++) {
      setBatchFiles((prev) => prev.map((f, j) => (j === i ? { ...f, status: "processing" } : f)));
      try {
        const resp = await transferImage(ref, batchFiles[i].file, params);
        const url = URL.createObjectURL(resp.imageBlob);
        setBatchFiles((prev) => prev.map((f, j) => (j === i ? { ...f, resultUrl: url, status: "done" } : f)));
      } catch {
        setBatchFiles((prev) => prev.map((f, j) => (j === i ? { ...f, status: "error" } : f)));
      }
    }
    setBatchProcessing(false);
    showToast(t("batch_complete"));
  }, [batchFiles, activeRefIdx, params, showToast]);

  const downloadBatchAll = useCallback(() => {
    batchFiles.forEach((f, i) => {
      if (!f.resultUrl) return;
      const a = document.createElement("a");
      a.href = f.resultUrl;
      a.download = `kinolu_batch_${i + 1}.jpg`;
      a.click();
    });
  }, [batchFiles]);

  /* ── Crop operations (real ImageData transforms) ── */
  const applyTransformToAll = useCallback((fn: (d: ImageData) => ImageData) => {
    for (const ref of [baseImageData, sourceImageData, transferredImageData]) {
      if (ref.current) ref.current = fn(ref.current);
    }
    setRenderTick((t) => t + 1);
  }, []);

  const handleCropApply = useCallback(() => {
    const base = baseImageData.current;
    if (!base) return;
    const r = cropRegion;
    const px = Math.max(0, Math.round(r.x * base.width));
    const py = Math.max(0, Math.round(r.y * base.height));
    const pw = Math.max(1, Math.min(base.width - px, Math.round(r.w * base.width)));
    const ph = Math.max(1, Math.min(base.height - py, Math.round(r.h * base.height)));
    applyTransformToAll((d) => cropImageData(d, Math.round(r.x * d.width), Math.round(r.y * d.height), Math.max(1, Math.round(r.w * d.width)), Math.max(1, Math.round(r.h * d.height))));
    setCropRegion({ x: 0, y: 0, w: 1, h: 1 });
    showToast(t("crop_applied"));
  }, [cropRegion, applyTransformToAll, showToast]);

  const handleRotateCW = useCallback(() => {
    applyTransformToAll(rotateImageData90CW);
  }, [applyTransformToAll]);

  const handleFlipH = useCallback(() => {
    applyTransformToAll(flipImageDataH);
  }, [applyTransformToAll]);

  const handleFlipV = useCallback(() => {
    applyTransformToAll(flipImageDataV);
  }, [applyTransformToAll]);

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="flex flex-col w-full h-full bg-black">
      <input ref={sourceInputRef} type="file" accept="image/*" className="hidden" onChange={handleSourceUpload} />
      <input ref={refInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />
      <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBatchImport} />

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
            {savingPreset ? "…" : t("editor_save")}
          </button>
          <button onClick={handleExportLut} disabled={exportingLut}
            className={`px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase transition-colors ${hasTransferred ? "text-white/60 hover:text-white" : "text-white/20"} disabled:opacity-30`}>
            {exportingLut ? "…" : t("editor_lut")}
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
              <canvas
                ref={displayCanvasRef}
                className={`max-w-full max-h-full object-contain rounded-sm ${comparing ? "hidden" : ""}`}
              />
              {comparing && sourceUrl && <img src={sourceUrl} alt="Original" className="max-w-full max-h-full object-contain rounded-sm" draggable={false} />}
            </div>

            {/* Crop overlay — shown when crop tab is active */}
            {activeTab === "crop" && (
              <CropOverlay
                canvasEl={displayCanvasRef.current}
                aspect={cropAspect}
                onChange={setCropRegion}
              />
            )}

            {/* Source replace button — top-left, tappable */}
            {hasImage && !comparing && activeTab === "transfer" && (
              <button
                onClick={() => sourceInputRef.current?.click()}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/40 active:text-white transition-colors"
                title={t("editor_replaceSource")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            )}

            {/* Step 2 hint — "add reference" (small floating pill) */}
            {step === 2 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full">
                <span className="text-[10px] text-white/50 tracking-[1px]">{t("editor_addRefHint")}</span>
              </div>
            )}

            {/* Step 3 hint — "tap apply" */}
            {step === 3 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full">
                <span className="text-[10px] text-white/50 tracking-[1px]">{t("editor_tapApplyHint")}</span>
              </div>
            )}

            {/* XY Pad — floating over image, bottom-right (like ColorBy) — only after transfer */}
            {activeTab === "transfer" && hasTransferred && (
              <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end gap-1.5">
                <XYPad
                  x={params.color_strength}
                  y={params.tone_strength}
                  onChange={updateXY}
                  onCommit={commitXY}
                  compact
                  xLabel={t("xy_colorAxis")}
                  yLabel={t("xy_toneAxis")}
                  helpText={t("xy_helpText")}
                />
                <button
                  onClick={() => {
                    setParams((p) => ({ ...p, auto_xy: true, color_strength: 0.88, tone_strength: 0.78 }));
                    if (canProcess) runTransfer();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-[10px] text-white/50 tracking-[1.5px] active:text-white transition-colors"
                >
                  {t("editor_autoXY")}
                </button>
              </div>
            )}

            {/* ── Bottom-left floating toolbar: Compare + Undo + Redo + Reset ── */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
              {/* Compare (hold) */}
              {hasTransferred && (
                <button
                  onPointerDown={() => setComparing(true)}
                  onPointerUp={() => setComparing(false)}
                  onPointerLeave={() => setComparing(false)}
                  className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/50 active:text-white"
                  title="Hold to compare original"
                >
                  <IconCompare size={16} />
                </button>
              )}
              {/* Undo */}
              <button
                onClick={history.undo}
                disabled={!history.canUndo}
                className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center transition-colors disabled:opacity-20"
                title="Undo"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
              {/* Redo */}
              <button
                onClick={history.redo}
                disabled={!history.canRedo}
                className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center transition-colors disabled:opacity-20"
                title="Redo"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
                </svg>
              </button>
              {/* Global reset with confirmation */}
              <button
                onClick={handleReset}
                className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/30 active:text-white"
                title="Reset all adjustments"
              >
                <IconReset size={14} />
              </button>
            </div>

            {/* Comparing badge */}
            {comparing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-sm px-3 py-0.5 rounded-full">
                <span className="text-[9px] text-white/70 tracking-[2px] uppercase">{t("editor_original")}</span>
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
              <span className="text-[10px] text-white/25 tracking-[1px]">{t("editor_importPhoto")}</span>
            </button>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[13px] text-white/50 font-medium">{t("editor_importFirst")}</span>
              <span className="text-[10px] text-white/25 leading-relaxed text-center max-w-[220px]">
                {t("editor_importHint")}
              </span>
            </div>
          </div>
        )}

        {/* Processing spinner */}
        {processing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-[10px] text-white/50 tracking-[2px]">{t("editor_processing")}</span>
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
                      <div key={i} className="relative shrink-0">
                        <button onClick={() => setActiveRefIdx(i)}
                          className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
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
                        <button onClick={() => removeRef(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/60 active:text-white z-10">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
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
                      {t("editor_importPhoto")}
                    </button>
                  )}
                  {step === 2 && (
                    <button onClick={() => refInputRef.current?.click()}
                      className="flex-1 py-2.5 rounded-xl text-[11px] tracking-wider bg-white text-black font-semibold active:scale-[0.98] transition-all">
                      {t("editor_addReference")}
                    </button>
                  )}
                  {step >= 3 && (
                    <>
                      <button onClick={runTransfer} disabled={!canProcess}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold tracking-wider bg-white text-black active:scale-[0.98] transition-all disabled:opacity-40">
                        {processing ? t("editor_processing") : hasTransferred ? t("editor_reApply") : t("editor_apply")}
                      </button>
                      {hasTransferred && refImages.length > 0 && (
                        <button onClick={() => batchInputRef.current?.click()}
                          className="px-4 py-2.5 rounded-xl text-[11px] font-semibold tracking-wider border border-white/15 text-white/60 active:scale-[0.98] transition-all">
                          {t("batch_import")}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* ── Batch grid ── */}
                {batchFiles.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] text-white/30 tracking-[1.5px] uppercase">{t("batch_title")} ({batchFiles.filter((f) => f.status === "done").length}/{batchFiles.length})</span>
                      <div className="flex gap-1.5">
                        {!batchProcessing && batchFiles.some((f) => f.status === "idle" || f.status === "error") && (
                          <button onClick={runBatchTransfer} className="text-[9px] text-white/60 bg-white/10 px-2.5 py-1 rounded-lg active:bg-white/20">{t("batch_applyAll")}</button>
                        )}
                        {batchFiles.some((f) => f.status === "done") && (
                          <button onClick={downloadBatchAll} className="text-[9px] text-white/60 bg-white/10 px-2.5 py-1 rounded-lg active:bg-white/20">{t("batch_downloadAll")}</button>
                        )}
                        <button onClick={() => setBatchFiles([])} className="text-[9px] text-white/30 px-1.5 py-1">✕</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {batchFiles.map((bf, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                          <img src={bf.resultUrl || bf.url} alt="" className="w-full h-full object-cover" />
                          {bf.status === "processing" && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                          )}
                          {bf.status === "done" && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500/80 flex items-center justify-center">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                            </div>
                          )}
                          {bf.status === "error" && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center">
                              <span className="text-[8px] text-white">!</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── LUT/Preset strip ── */}
                {availableLuts.length > 0 && sourceUrl && (
                  <div className="mt-2">
                    <span className="text-[9px] text-white/30 tracking-[1.5px] uppercase mb-1 block">{t("editor_presets")}</span>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {availableLuts.map((lut) => (
                        <button key={lut.id} onClick={() => applyLutInline(lut.id)}
                          className="shrink-0 flex flex-col items-center gap-0.5">
                          <div className="w-12 h-12 rounded-lg border border-white/10 overflow-hidden bg-black/40">
                            {lutThumbUrls[lut.id] ? (
                              <img src={lutThumbUrls[lut.id]} alt={lut.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><span className="text-[7px] text-white/20">LUT</span></div>
                            )}
                          </div>
                          <span className="text-[8px] text-white/35 max-w-[48px] truncate">{lut.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === "edit" && <AdjustmentPanel values={adjValues} activeTool={activeTool} onSelectTool={setActiveTool} onChangeValue={handleAdjChange} />}
            {activeTab === "curves" && <CurveEditor curves={params.curve_points} onChange={(c) => setParams((p) => ({ ...p, curve_points: c }))} />}
            {activeTab === "hsl" && <HSLPanel hsl7={params.hsl7} onChange={(h) => setParams((p) => ({ ...p, hsl7: h }))} />}
            {activeTab === "crop" && (
              <div className="flex flex-col items-center gap-4 px-5 py-3">
                {/* Aspect ratio pills */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {[
                    { label: t("crop_free"), value: "free" },
                    { label: "1:1", value: "1:1" },
                    { label: "4:3", value: "4:3" },
                    { label: "16:9", value: "16:9" },
                    { label: "3:2", value: "3:2" },
                    { label: "9:16", value: "9:16" },
                  ].map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setCropAspect(r.value)}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] tracking-[0.5px] font-medium transition-all ${
                        cropAspect === r.value
                          ? "bg-white/10 text-white"
                          : "text-white/35 bg-white/[0.03] hover:text-white/60"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {/* Rotate + Flip — real ImageData operations */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={handleRotateCW}
                    className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center group-active:bg-white/15 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    </div>
                    <span className="text-[10px] text-white/40 tracking-wider font-medium">90°</span>
                  </button>
                  <button
                    onClick={handleFlipH}
                    className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center group-active:bg-white/15 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                        <path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 20V4M15 7l-3-3-3 3M9 17l3 3 3-3" />
                      </svg>
                    </div>
                    <span className="text-[10px] text-white/40 tracking-wider font-medium">{t("crop_flipH")}</span>
                  </button>
                  <button
                    onClick={handleFlipV}
                    className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center group-active:bg-white/15 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60 rotate-90">
                        <path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 20V4M15 7l-3-3-3 3M9 17l3 3 3-3" />
                      </svg>
                    </div>
                    <span className="text-[10px] text-white/40 tracking-wider font-medium">{t("crop_flipV")}</span>
                  </button>
                  <button
                    onClick={() => { setCropAspect("free"); }}
                    className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center group-active:bg-white/15 transition-colors">
                      <IconReset size={18} className="text-white/40" />
                    </div>
                    <span className="text-[10px] text-white/40 tracking-wider font-medium">{t("crop_reset")}</span>
                  </button>
                </div>
                {/* Apply Crop button */}
                {hasImage && (
                  <button
                    onClick={handleCropApply}
                    className="w-full py-2.5 rounded-xl text-[11px] font-semibold tracking-wider bg-white text-black active:scale-[0.98] transition-all"
                  >
                    {t("crop_apply")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <EditorTabBar active={activeTab} onSelect={setActiveTab} />
      </div>
    </div>
  );
}
