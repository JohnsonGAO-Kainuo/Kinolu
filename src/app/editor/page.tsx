"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EditParams, AdjustmentTool, EditorTab, EditSubTab } from "@/lib/types";
import { DEFAULT_EDIT_PARAMS } from "@/lib/types";
import {
  applyPresetToImage,
  createPresetFromTransfer,
  exportLutFromTransfer,
  transferImage,
} from "@/lib/api";
import { applyEdits, hasActiveEdits } from "@/lib/imageProcessor";
import { workerApplyEdits, warmupWorker } from "@/lib/workerBridge";
import { saveRefImage, listRefImages, deleteRefImage } from "@/lib/refStore";
import { listLocalLuts, type LutEntry } from "@/lib/lutStore";
import { getBuiltinMeta } from "@/lib/builtinLuts";
import { ensureBuiltinLuts } from "@/lib/builtinLuts";
import { useAuth } from "@/components/AuthProvider";
import {
  IconBack,
  IconShare,
  IconCompare,
  IconReset,
  IconDownload,
  IconPlus,
  IconLight,
  IconColor,
  IconEffects,
  IconDetail,
  IconCurves,
  IconHSL,
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

  const replace = useCallback((val: T) => {
    setState((prev) => {
      const stack = [...prev.stack];
      stack[prev.idx] = val;
      return { ...prev, stack };
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
    replace,
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
  const { isPro } = useAuth();

  const history = useHistory<EditParams>(DEFAULT_EDIT_PARAMS);
  const params = history.current;
  const historyRef = useRef(history);
  historyRef.current = history;
  const setParams = useCallback((updater: EditParams | ((p: EditParams) => EditParams)) => {
    const h = historyRef.current;
    const next = typeof updater === "function" ? updater(h.current) : updater;
    h.push(next);
  }, []);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [activeTab, setActiveTab] = useState<EditorTab>("transfer");
  const [editSubTab, setEditSubTab] = useState<EditSubTab>("light");
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
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [transferUsedXY, setTransferUsedXY] = useState(false);
  const [pendingAutoTransfer, setPendingAutoTransfer] = useState(false);

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
  const [activeLutId, setActiveLutId] = useState<string>("");

  /* LUT strip toggle: film vs user presets */
  const [lutStripTab, setLutStripTab] = useState<"film" | "presets">("film");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  /* ── Helpers ── */
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const loadImageToData = useCallback(
    (url: string): Promise<ImageData> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          // Scale down very large images — but keep high enough for sharp preview
          // Mobile: 1600px (sharp on retina, ~5MP working data — well within RAM budget)
          // Desktop: 2400px (~11MP — fast enough with Web Worker)
          const MAX = isMobile ? 1600 : 2400;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX || h > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const ctx = c.getContext("2d")!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          resolve(ctx.getImageData(0, 0, w, h));
        };
        img.onerror = reject;
        img.src = url;
      }),
    [isMobile]
  );

  /* Paint canvas directly — called after any data change */
  const paintCanvas = useCallback((data: ImageData) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Only resize when dimensions change — resizing clears GPU buffer & forces realloc
    if (canvas.width !== data.width || canvas.height !== data.height) {
      canvas.width = data.width;
      canvas.height = data.height;
    }
    ctx.putImageData(data, 0, 0);
  }, []);

  /* Half-res preview cache for responsive mobile slider drag */
  const previewSmallCache = useRef<{ base: ImageData; data: ImageData } | null>(null);
  const upscaleTmpCanvas = useRef<HTMLCanvasElement | null>(null);
  const workerRenderGenRef = useRef(0);

  const renderPreview = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const base = baseImageData.current;
      const p = paramsRef.current;
      const live = adjDraggingRef.current;
      if (!base) return;
      if (!hasActiveEdits(p)) { paintCanvas(base); return; }

      // Mobile fast-path: process at half resolution during slider drag
      // Saves ~75% processing time (640K→160K pixels) + skips spatial filters
      if (live && isMobile && base.width > 600) {
        let small: ImageData;
        if (previewSmallCache.current?.base === base) {
          small = previewSmallCache.current.data;
        } else {
          const c = document.createElement("canvas");
          c.width = base.width; c.height = base.height;
          c.getContext("2d")!.putImageData(base, 0, 0);
          const sw = Math.round(base.width / 2);
          const sh = Math.round(base.height / 2);
          const c2 = document.createElement("canvas");
          c2.width = sw; c2.height = sh;
          c2.getContext("2d")!.drawImage(c, 0, 0, sw, sh);
          small = c2.getContext("2d")!.getImageData(0, 0, sw, sh);
          previewSmallCache.current = { base, data: small };
        }
        const result = applyEdits(small, p, true);
        // Upscale result to display canvas
        const canvas = displayCanvasRef.current;
        if (canvas) {
          if (canvas.width !== base.width || canvas.height !== base.height) {
            canvas.width = base.width; canvas.height = base.height;
          }
          if (!upscaleTmpCanvas.current) upscaleTmpCanvas.current = document.createElement("canvas");
          const tmp = upscaleTmpCanvas.current;
          tmp.width = result.width; tmp.height = result.height;
          tmp.getContext("2d")!.putImageData(result, 0, 0);
          const ctx = canvas.getContext("2d")!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(tmp, 0, 0, base.width, base.height);
        }
      } else if (live) {
        // Desktop live drag — synchronous main-thread (liveMode skips spatial filters)
        paintCanvas(applyEdits(base, p, true));
      } else {
        // Full-quality render (not dragging) — offload to Web Worker
        const gen = ++workerRenderGenRef.current;
        void workerApplyEdits(base, p, false).then((result) => {
          // Only apply if this is still the latest render request
          if (gen === workerRenderGenRef.current) paintCanvas(result);
        });
      }
    });
  }, [paintCanvas, isMobile]);

  useEffect(() => { if (baseImageData.current) renderPreview(); }, [params, renderPreview, renderTick]);

  /* ── Warm up Web Worker (fast), defer segmentation models until needed ── */
  useEffect(() => { warmupWorker(); }, []);

  /* ── Restore saved reference images ── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = await listRefImages();
        if (cancelled) return;
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
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Preset apply ── */
  const runApplyPreset = useCallback(async (presetId: string) => {
    const source = sourceFileRef.current;
    if (!source || !presetId) return;
    setProcessing(true); setErrorMsg(null);
    try {
      const blob = await applyPresetToImage(source, presetId);
      const u = URL.createObjectURL(blob);
      const data = await loadImageToData(u);
      URL.revokeObjectURL(u);
      transferredImageData.current = data; baseImageData.current = data;
      setHasTransferred(true);
      setActiveLutId(presetId);
      setRenderTick((t) => t + 1);
      showToast(t("editor_presetApplied"));
    } catch (err) { setErrorMsg(`${t("editor_presetFailed")}: ${err}`); setTimeout(() => setErrorMsg(null), 4000); }
    finally { setProcessing(false); }
  }, [loadImageToData, showToast]);

  /* ── Uploads ── */
  const handleSourceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return;
    const arr = Array.from(files);

    // First file → source image
    const file = arr[0];
    sourceFileRef.current = file;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file); setSourceUrl(url);
    setProcessing(true);
    const data = await loadImageToData(url);
    setProcessing(false);
    sourceImageData.current = data; baseImageData.current = data;
    transferredImageData.current = null; setHasTransferred(false);
    setRenderTick((t) => t + 1);

    // If multiple files selected → rest become batch queue (Pro only)
    if (arr.length > 1) {
      if (!isPro) {
        showToast(t("batch_proOnly"));
      } else {
        setBatchFiles(
          arr.slice(1, 10).map((f) => ({
            file: f, url: URL.createObjectURL(f), resultUrl: null, status: "idle" as const,
          })),
        );
      }
    }

    if (pendingPresetId) { void runApplyPreset(pendingPresetId); setPendingPresetId(""); }
  }, [loadImageToData, pendingPresetId, runApplyPreset, sourceUrl, isPro, showToast, t]);

  const handleRefUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const arr = Array.from(files);
    const isFirstRef = refImages.length === 0;
    refFilesRef.current = [...refFilesRef.current, ...arr];
    setRefImages((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    if (isFirstRef) setActiveRefIdx(0);
    // Persist references to IndexedDB
    for (const f of arr) {
      const entry = await saveRefImage(f.name, f);
      refIdsRef.current.push(entry.id);
    }
    // Flag to auto-apply when runTransfer becomes available
    if (isFirstRef && sourceFileRef.current) {
      setPendingAutoTransfer(true);
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
    setProcessing(true);
    const data = await loadImageToData(url);
    setProcessing(false);
    sourceImageData.current = data; baseImageData.current = data;
    transferredImageData.current = null; setHasTransferred(false);
    setRenderTick((t) => t + 1);
    const sp = sessionStorage.getItem("kinolu_capture_preset_id") || "";
    if (sp) {
      setActiveLutId(sp);
      void runApplyPreset(sp);
      sessionStorage.removeItem("kinolu_capture_preset_id");
    }
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

  /* ── Daily transfer limit — per source image (client-side, localStorage) ── */
  const getDailyTransferData = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const stored = localStorage.getItem("kinolu_daily_transfers");
    if (!stored) return { date: today, sources: [] as string[] };
    try {
      const data = JSON.parse(stored);
      if (data.date === today && Array.isArray(data.sources)) return data as { date: string; sources: string[] };
      return { date: today, sources: [] as string[] };
    } catch { return { date: today, sources: [] as string[] }; }
  }, []);

  const getDailyTransferCount = useCallback(() => {
    return getDailyTransferData().sources.length;
  }, [getDailyTransferData]);

  const isSourceAlreadyCounted = useCallback((fileName: string) => {
    return getDailyTransferData().sources.includes(fileName);
  }, [getDailyTransferData]);

  const incrementDailyTransfer = useCallback((fileName: string) => {
    const data = getDailyTransferData();
    if (!data.sources.includes(fileName)) {
      data.sources.push(fileName);
      localStorage.setItem("kinolu_daily_transfers", JSON.stringify(data));
    }
  }, [getDailyTransferData]);

  /* ── Transfer ── */
  const runTransfer = useCallback(async (overrideRefIdx?: number) => {
    const idx = overrideRefIdx ?? activeRefIdx;
    const source = sourceFileRef.current; const ref = refFilesRef.current[idx];
    if (!source || !ref) return;
    // Free user daily limit — per source image, 5/day
    const srcName = source.name || "unnamed";
    if (!isPro && !isSourceAlreadyCounted(srcName) && getDailyTransferCount() >= 5) {
      showToast(t("editor_dailyLimitReached"));
      return;
    }
    setProcessing(true); setErrorMsg(null); setComparing(false);
    try {
      const resp = await transferImage(ref, source, params);
      const resultObjUrl = URL.createObjectURL(resp.imageBlob);
      const data = await loadImageToData(resultObjUrl);
      URL.revokeObjectURL(resultObjUrl);
      transferredImageData.current = data; baseImageData.current = data;
      setHasTransferred(true);
      setTransferUsedXY(true);
      // Transfer and preset are mutually exclusive — clear LUT state
      setActiveLutId("");
      setRenderTick((t) => t + 1);
      if (!isPro) incrementDailyTransfer(srcName);
      if (params.auto_xy) setParams((p) => ({ ...p, color_strength: resp.autoX, tone_strength: resp.autoY }));
    } catch (err) {
      setErrorMsg(`${t("editor_transferFailed")}: ${err}`);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally { setProcessing(false); }
  }, [activeRefIdx, params, loadImageToData, isPro, showToast, t, isSourceAlreadyCounted, getDailyTransferCount, incrementDailyTransfer]);

  // Auto-apply transfer when first ref is uploaded
  useEffect(() => {
    if (pendingAutoTransfer && sourceFileRef.current && refFilesRef.current[0]) {
      setPendingAutoTransfer(false);
      void runTransfer(0);
    }
  }, [pendingAutoTransfer, runTransfer]);

  /* ── XY Pad: live blend preview during drag ── */
  const xyDraggingRef = useRef(false);
  const xyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fast client-side blend between original source and transferred result.
   *  blend = average of x,y → alpha between source & transfer.
   *  ~2ms for 1600×1200 — fully real-time at 60fps. */
  const blendXYPreview = useCallback((x: number, y: number) => {
    const src = sourceImageData.current;
    const xfr = transferredImageData.current;
    if (!src || !xfr || src.data.length !== xfr.data.length) return;
    // Blend factor: average of color_strength (x) and tone_strength (y)
    const alpha = (x + y) / 2;
    const sd = src.data, td = xfr.data;
    const out = new Uint8ClampedArray(sd.length);
    for (let i = 0; i < sd.length; i += 4) {
      out[i]     = sd[i]     + (td[i]     - sd[i])     * alpha;
      out[i + 1] = sd[i + 1] + (td[i + 1] - sd[i + 1]) * alpha;
      out[i + 2] = sd[i + 2] + (td[i + 2] - sd[i + 2]) * alpha;
      out[i + 3] = 255;
    }
    const blended = new ImageData(out, src.width, src.height);
    baseImageData.current = blended;
    paintCanvas(hasActiveEdits(paramsRef.current) ? applyEdits(blended, paramsRef.current, true) : blended);
  }, [paintCanvas]);

  const updateXY = useCallback((x: number, y: number) => {
    setParams((p) => ({ ...p, color_strength: x, tone_strength: y, auto_xy: false }));
    // Live preview: fast client-side blend
    if (!xyDraggingRef.current) xyDraggingRef.current = true;
    blendXYPreview(x, y);
    // Debounced server re-transfer (600ms after last drag movement)
    if (xyDebounceRef.current) clearTimeout(xyDebounceRef.current);
    xyDebounceRef.current = setTimeout(() => {
      const source = sourceFileRef.current;
      const ref = refFilesRef.current[activeRefIdx];
      if (source && ref) void runTransfer();
    }, 600);
  }, [blendXYPreview, activeRefIdx, runTransfer]);

  /** Final commit on pointer-up — cancel debounce, do immediate re-transfer */
  const commitXY = useCallback((_x: number, _y: number) => {
    xyDraggingRef.current = false;
    if (xyDebounceRef.current) { clearTimeout(xyDebounceRef.current); xyDebounceRef.current = null; }
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

  const replaceParams = useCallback((updater: EditParams | ((p: EditParams) => EditParams)) => {
    const h = historyRef.current;
    const next = typeof updater === "function" ? updater(h.current) : updater;
    h.replace(next);
  }, []);

  const adjDraggingRef = useRef(false);
  const handleAdjChange = useCallback((tool: AdjustmentTool, value: number) => {
    const paramKey = TOOL_TO_PARAM[tool];
    if (!adjDraggingRef.current) {
      adjDraggingRef.current = true;
      setParams((p) => ({ ...p, [paramKey]: value })); // push — creates undo boundary
    } else {
      replaceParams((p) => ({ ...p, [paramKey]: value })); // replace — update in-place
    }
  }, [setParams, replaceParams]);

  const handleAdjCommit = useCallback(() => {
    adjDraggingRef.current = false;
    renderPreview(); // full-quality re-render with spatial filters
  }, [renderPreview]);

  const handleResetCategory = useCallback((tools: AdjustmentTool[]) => {
    // Build a single param update that zeros all tools in the category
    setParams((p) => {
      const next = { ...p };
      for (const tool of tools) {
        (next as Record<string, unknown>)[TOOL_TO_PARAM[tool]] = 0;
      }
      return next;
    }); // single push — one undo boundary
    adjDraggingRef.current = false;
    renderPreview();
  }, [setParams, renderPreview]);

  const handleReset = useCallback(() => {
    if (!window.confirm(t("editor_resetConfirm"))) return;
    history.reset(DEFAULT_EDIT_PARAMS);
    // Revert to untouched source
    baseImageData.current = sourceImageData.current;
    transferredImageData.current = null;
    // Clear all active selections
    setActiveLutId("");
    setHasTransferred(false);
    setTransferUsedXY(false);
    setComparing(false);
    setRenderTick((t) => t + 1);
  }, [history]);

  /* ── Export ── */
  const handleDownload = useCallback(async () => {
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = objUrl;
    a.download = `kinolu_${Date.now()}.jpg`; a.click();
    URL.revokeObjectURL(objUrl);
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
    // Free users: max 5 user presets
    if (!isPro) {
      const allLuts = await listLocalLuts();
      const userPresets = allLuts.filter((l) => !getBuiltinMeta(l.name));
      if (userPresets.length >= 5) {
        showToast(t("editor_freePresetLimit"));
        return;
      }
    }
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
  }, [getCurrentCanvasBlob, showToast, hasTransferred, isPro]);

  const handleExportLut = useCallback(async () => {
    if (!sourceFileRef.current) { showToast(t("editor_importPhotoFirst")); return; }
    if (!hasTransferred) { showToast(t("editor_applyTransferFirst")); return; }
    const blob = await getCurrentCanvasBlob(); if (!blob) return;
    setExportingLut(true);
    try {
      const cube = await exportLutFromTransfer(sourceFileRef.current, blob, 33);
      const cubeUrl = URL.createObjectURL(cube);
      const a = document.createElement("a"); a.href = cubeUrl;
      a.download = `kinolu_${Date.now()}.cube`; a.click();
      URL.revokeObjectURL(cubeUrl);
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
    // Ensure built-in LUTs are installed before listing —
    // fixes race where editor loads before BuiltinLutsInit finishes.
    void ensureBuiltinLuts().then(() => listLocalLuts()).then((luts) => {
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

    // Check if the LUT is a Pro-only builtin
    const lutEntry = availableLuts.find((l) => l.id === lutId);
    if (lutEntry && !isPro) {
      const meta = getBuiltinMeta(lutEntry.name);
      if (meta && !meta.isFree) {
        showToast(t("editor_proOnly"));
        return;
      }
    }

    // If tapping the already-active LUT, deselect and revert to original
    if (lutId === activeLutId) {
      setActiveLutId("");
      if (sourceImageData.current) {
        baseImageData.current = sourceImageData.current;
        transferredImageData.current = null;
        setHasTransferred(false);
        setRenderTick((t) => t + 1);
      }
      return;
    }
    setProcessing(true); setErrorMsg(null);
    try {
      const blob = await applyPresetToImage(source, lutId);
      const u = URL.createObjectURL(blob);
      const data = await loadImageToData(u);
      URL.revokeObjectURL(u);
      transferredImageData.current = data; baseImageData.current = data;
      setHasTransferred(true);
      setActiveLutId(lutId);
      // Preset and transfer are mutually exclusive — clear transfer state
      setTransferUsedXY(false);
      setRenderTick((t) => t + 1);
      showToast(t("editor_presetApplied"));
    } catch (err) { setErrorMsg(`Preset failed: ${err}`); }
    finally { setProcessing(false); }
  }, [loadImageToData, showToast, activeLutId, isPro, availableLuts]);

  /* ── Batch add more (appends to existing batch) ── */
  const handleBatchAddMore = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    if (!isPro) { showToast(t("batch_proOnly")); e.target.value = ""; return; }
    setBatchFiles((prev) => [
      ...prev,
      ...Array.from(files).slice(0, Math.max(0, 9 - prev.length)).map((f) => ({
        file: f, url: URL.createObjectURL(f), resultUrl: null, status: "idle" as const,
      })),
    ]);
    e.target.value = "";
  }, [isPro, showToast, t]);

  const runBatchTransfer = useCallback(async () => {
    if (!isPro) { showToast(t("batch_proOnly")); return; }
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
  }, [isPro, batchFiles, activeRefIdx, params, showToast, t]);

  const downloadBatchAll = useCallback(() => {
    batchFiles.forEach((f, i) => {
      if (!f.resultUrl) return;
      const a = document.createElement("a");
      a.href = f.resultUrl;
      a.download = `kinolu_batch_${i + 1}.jpg`;
      a.click();
    });
  }, [batchFiles]);

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="flex flex-col w-full h-full bg-black">
      <input ref={sourceInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSourceUpload} />
      <input ref={refInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />
      <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBatchAddMore} />

      {/* ── Header — hidden in fullscreen ── */}
      {!previewFullscreen && (
      <header className="flex items-center justify-between min-h-[44px] px-4 safe-top shrink-0 z-10">
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
      )}

      {/* ── Batch source strip (top, below header) ── */}
      {!previewFullscreen && batchFiles.length > 0 && (
        <div className="shrink-0 bg-[#080808] px-3 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-white/5">
          {/* Main source (active) */}
          {sourceUrl && (
            <div className="shrink-0 w-11 h-11 rounded-2xl overflow-hidden border-2 border-cyan-400/40 ring-1 ring-cyan-400/10">
              <img src={sourceUrl} alt="" className="w-full h-full object-cover" draggable={false} />
            </div>
          )}
          {/* Batch items */}
          {batchFiles.map((bf, i) => (
            <button key={i} onClick={() => {
              // Switch to this batch file as active source
              sourceFileRef.current = bf.file;
              setSourceUrl(bf.url);
              void loadImageToData(bf.url).then((data) => {
                sourceImageData.current = data; baseImageData.current = data;
                transferredImageData.current = null; setHasTransferred(false);
                setRenderTick((t) => t + 1);
              });
            }} className="shrink-0 relative w-11 h-11 rounded-2xl overflow-hidden border border-white/8">
              <img src={bf.resultUrl || bf.url} alt="" className="w-full h-full object-cover" draggable={false} />
              {bf.status === "done" && (
                <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500/80 flex items-center justify-center">
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
              )}
              {bf.status === "processing" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-3 h-3 border border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
          {/* Add more */}
          <button onClick={() => batchInputRef.current?.click()}
            className="shrink-0 w-11 h-11 rounded-2xl border border-dashed border-white/12 flex items-center justify-center">
            <IconPlus size={10} className="text-white/25" />
          </button>
          {/* Batch actions */}
          <div className="shrink-0 flex items-center gap-1 ml-auto">
            {!batchProcessing && batchFiles.some((f) => f.status === "idle" || f.status === "error") && (
              <button onClick={runBatchTransfer} className="text-[8px] text-white/60 bg-white/8 px-2.5 py-1 rounded-full active:bg-white/15 whitespace-nowrap">{t("batch_applyAll")}</button>
            )}
            {batchFiles.some((f) => f.status === "done") && (
              <button onClick={downloadBatchAll} className="text-[8px] text-white/60 bg-white/8 px-2.5 py-1 rounded-full active:bg-white/15 whitespace-nowrap">{t("batch_downloadAll")}</button>
            )}
            <button onClick={() => { batchFiles.forEach((f) => { URL.revokeObjectURL(f.url); if (f.resultUrl) URL.revokeObjectURL(f.resultUrl); }); setBatchFiles([]); }} className="text-[8px] text-white/30 px-1 py-1">✕</button>
          </div>
        </div>
      )}

      {/* ── Canvas area ── */}
      <div className="flex-1 min-h-0 relative">
        {hasImage ? (
          <>
            {/* Image display — tap to toggle fullscreen, long-press (300ms) to compare original */}
            <div
              className="absolute inset-0 flex items-center justify-center px-3 py-2 cursor-pointer select-none"
              style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" } as React.CSSProperties}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                const canCompare = hasTransferred || hasActiveEdits(params);
                // Start a 300ms timer — if held long enough, show original
                const timer = setTimeout(() => {
                  if (canCompare) setComparing(true);
                  (e.currentTarget as HTMLElement).dataset.didCompare = "1";
                }, 300);
                (e.currentTarget as HTMLElement).dataset.pressTimer = String(timer);
                (e.currentTarget as HTMLElement).dataset.didCompare = "";
              }}
              onPointerUp={(e) => {
                const el = e.currentTarget as HTMLElement;
                clearTimeout(Number(el.dataset.pressTimer || 0));
                if (el.dataset.didCompare === "1") {
                  // Was a long-press compare — just release, don't toggle fullscreen
                  setComparing(false);
                } else if (!(e.target as HTMLElement).closest("button")) {
                  // Short tap — toggle fullscreen
                  setPreviewFullscreen((f) => !f);
                }
                el.dataset.didCompare = "";
              }}
              onPointerLeave={(e) => {
                clearTimeout(Number((e.currentTarget as HTMLElement).dataset.pressTimer || 0));
                setComparing(false);
              }}
              onPointerCancel={(e) => {
                clearTimeout(Number((e.currentTarget as HTMLElement).dataset.pressTimer || 0));
                setComparing(false);
              }}
            >
              <canvas
                ref={displayCanvasRef}
                className="max-w-full max-h-full object-contain rounded-sm select-none"
                style={comparing ? { opacity: 0, position: 'absolute', pointerEvents: 'none' } : { WebkitTouchCallout: 'none' } as React.CSSProperties}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
              {comparing && sourceUrl && <img src={sourceUrl} alt="Original" className="max-w-full max-h-full object-contain rounded-sm" draggable={false} />}
            </div>

            {/* Reference image overlay — circular thumbnail, bottom-left — only for transfer (not LUT presets) */}
            {!previewFullscreen && hasTransferred && refImages[activeRefIdx] && !activeLutId && (
              <div className="absolute bottom-14 left-3 z-10 w-[56px] h-[56px] rounded-full overflow-hidden border-2 border-white/20 shadow-lg bg-black/30 ring-1 ring-black/40">
                <img src={refImages[activeRefIdx]} alt="Reference" className="w-full h-full object-cover" draggable={false} />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                  <span className="text-[7px] text-white/50 font-semibold tracking-[1.5px] drop-shadow-sm">REF</span>
                </div>
              </div>
            )}

            {/* Source replace button — top-right, tappable */}
            {!previewFullscreen && hasImage && !comparing && activeTab === "transfer" && (
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
            {!previewFullscreen && step === 2 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full">
                <span className="text-[10px] text-white/50 tracking-[1px]">{t("editor_addRefHint")}</span>
              </div>
            )}

            {/* Step 3 hint — "tap apply" */}
            {!previewFullscreen && step === 3 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full">
                <span className="text-[10px] text-white/50 tracking-[1px]">{t("editor_tapApplyHint")}</span>
              </div>
            )}

            {/* XY Pad — floating over image, bottom-right — only after XY transfer (not camera/LUT) */}
            {!previewFullscreen && activeTab === "transfer" && transferUsedXY && (
              <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end gap-1.5">
                <XYPad
                  x={params.color_strength}
                  y={params.tone_strength}
                  onChange={updateXY}
                  onCommit={commitXY}
                  compact
                  xLabel={t("xy_colorAxis")}
                  yLabel={t("xy_toneAxis")}
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

            {/* ── Bottom-left floating toolbar: Compare + Undo + Redo + Reset — hidden in fullscreen ── */}
            {!previewFullscreen && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
              {/* Original — press-and-hold to preview original, release to return */}
              {(hasTransferred || hasActiveEdits(params)) && (
                <button
                  onPointerDown={() => setComparing(true)}
                  onPointerUp={() => setComparing(false)}
                  onPointerLeave={() => setComparing(false)}
                  onPointerCancel={() => setComparing(false)}
                  className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center border transition-colors ${
                    comparing
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-black/50 text-white/60 border-white/10"
                  }`}
                  title="Hold to view original"
                >
                  <IconCompare size={15} />
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
            )}

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
              className="w-32 h-32 rounded-3xl border-[1.5px] border-dashed border-white/15 flex flex-col items-center justify-center gap-3 hover:border-white/30 hover:bg-white/[0.02] transition-all active:scale-95">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-white/30">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-[12px] text-white/30 tracking-[1px]">{t("editor_importPhoto")}</span>
            </button>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[15px] text-white/50 font-medium">{t("editor_importFirst")}</span>
              <span className="text-[11px] text-white/30 leading-relaxed text-center max-w-[240px]">
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

      {/* ── Control tray — hidden in fullscreen ── */}
      {!previewFullscreen && (
      <div className="shrink-0 bg-[#080808]" style={{ maxHeight: "45vh" }}>
        {/* Scrollable panel content — fixed height with nav bar outside */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(45vh - 56px)" }}>
          <div className="pt-2 pb-3">
            {activeTab === "transfer" && (
              <div className="flex flex-col gap-2 px-5 py-1">
                {/* Reference thumbnails strip */}
                {refImages.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1 -mx-1 px-1 no-scrollbar">
                    {refImages.map((src, i) => {
                      // When a LUT preset is active, no ref should appear selected
                      const isRefSelected = i === activeRefIdx && !activeLutId;
                      return (
                      <div key={i} className="relative shrink-0">
                        <button onClick={() => {
                          setActiveRefIdx(i);
                          // Tapping a ref clears any active LUT (mutual exclusion)
                          if (activeLutId) setActiveLutId("");
                          // Auto-apply transfer when tapping a ref (no Apply button needed)
                          if (sourceFileRef.current && refFilesRef.current[i]) {
                            void runTransfer(i);
                          }
                        }}
                          className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                            isRefSelected
                              ? "border-white/70 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                              : "border-white/10 hover:border-white/25"
                          }`}>
                          <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
                          {isRefSelected && (
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
                    );
                    })}
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
                    <button onClick={() => runTransfer()} disabled={!canProcess}
                      className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold tracking-wider bg-white text-black active:scale-[0.98] transition-all disabled:opacity-40">
                      {processing ? t("editor_processing") : hasTransferred ? t("editor_reApply") : t("editor_apply")}
                    </button>
                  )}
                </div>

                {/* ── LUT/Preset strip with Film / Presets toggle ── */}
                {availableLuts.length > 0 && sourceUrl && (() => {
                  const builtins = availableLuts.filter((l) => getBuiltinMeta(l.name))
                    .sort((a, b) => {
                      const aFree = getBuiltinMeta(a.name)?.isFree ? 0 : 1;
                      const bFree = getBuiltinMeta(b.name)?.isFree ? 0 : 1;
                      return aFree - bFree;
                    });
                  const userLuts = availableLuts.filter((l) => !getBuiltinMeta(l.name));
                  const showItems = lutStripTab === "film" ? builtins : userLuts;
                  return (
                    <div className="mt-2 flex flex-col gap-2">
                      {/* Toggle: Film | Presets */}
                      <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 self-start">
                        <button onClick={() => setLutStripTab("film")}
                          className={`px-3.5 py-1 rounded-md text-[11px] font-medium tracking-wider transition-all ${lutStripTab === "film" ? "bg-white/10 text-white" : "text-white/35"}`}>
                          {t("editor_filmTab")}
                        </button>
                        <button onClick={() => setLutStripTab("presets")}
                          className={`px-3.5 py-1 rounded-md text-[11px] font-medium tracking-wider transition-all ${lutStripTab === "presets" ? "bg-white/10 text-white" : "text-white/35"}`}>
                          {t("editor_presetsTab")} {userLuts.length > 0 && <span className="text-white/25 ml-0.5">{userLuts.length}</span>}
                        </button>
                      </div>
                      {/* LUT strip */}
                      {showItems.length > 0 ? (
                        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2 pt-1 px-0.5">
                          {showItems.map((lut) => {
                            const meta = getBuiltinMeta(lut.name);
                            const locked = !isPro && meta && !meta.isFree;
                            const isActive = activeLutId === lut.id;
                            return (
                              <button key={lut.id} onClick={() => applyLutInline(lut.id)}
                                className={`shrink-0 flex flex-col items-center gap-1 ${locked ? "opacity-60" : ""}`}>
                                <div className={`relative w-16 h-16 rounded-xl bg-black/40 transition-all ${isActive ? "ring-[2.5px] ring-white scale-[1.06]" : "border border-white/10"}`}>
                                  <div className="w-full h-full rounded-xl overflow-hidden">
                                  {lutThumbUrls[lut.id] ? (
                                    <img src={lutThumbUrls[lut.id]} alt={lut.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full flex items-center justify-center ${
                                      meta?.category === "fuji" ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/15"
                                      : meta?.category === "kodak" ? "bg-gradient-to-br from-amber-500/15 to-yellow-500/15"
                                      : meta ? "bg-gradient-to-br from-rose-500/15 to-purple-500/15"
                                      : "bg-gradient-to-br from-purple-500/15 to-blue-500/15"
                                    }`}>
                                      <span className="text-[8px] text-white/30">{meta ? (meta.category === "fuji" ? "F" : meta.category === "kodak" ? "K" : "✦") : "LUT"}</span>
                                    </div>
                                  )}
                                  </div>
                                  {locked && (
                                    <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0110 0v4" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[8px] max-w-[64px] truncate transition-colors ${isActive ? "text-white/80 font-medium" : locked ? "text-white/25" : "text-white/40"}`}>
                                  {meta?.i18nKey ? t(meta.i18nKey as Parameters<typeof t>[0]) : lut.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-[11px] text-white/25">
                          {lutStripTab === "presets" ? t("lib_noLuts") : ""}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            {activeTab === "edit" && (
              <div className="flex flex-col">
                {/* ── Lightroom-style sub-tab bar ── */}
                <div className="flex items-center gap-0.5 px-3 pb-2 overflow-x-auto no-scrollbar">
                  {([
                    { key: "light" as EditSubTab, label: t("adj_light"), Icon: IconLight },
                    { key: "color" as EditSubTab, label: t("adj_color"), Icon: IconColor },
                    { key: "effects" as EditSubTab, label: t("adj_effects"), Icon: IconEffects },
                    { key: "detail" as EditSubTab, label: t("adj_detail"), Icon: IconDetail },
                    { key: "curves" as EditSubTab, label: t("tab_curves"), Icon: IconCurves },
                    { key: "hsl" as EditSubTab, label: t("tab_hsl"), Icon: IconHSL },
                  ]).map((sub) => (
                    <button
                      key={sub.key}
                      onClick={() => setEditSubTab(sub.key)}
                      className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                        editSubTab === sub.key
                          ? "bg-white/[0.08] text-white"
                          : "text-white/35 active:bg-white/[0.04]"
                      }`}
                    >
                      <sub.Icon size={16} className={editSubTab === sub.key ? "text-white" : "text-white/35"} />
                      <span className="text-[9px] tracking-[0.5px] font-medium whitespace-nowrap">{sub.label}</span>
                    </button>
                  ))}
                </div>

                {/* ── Sub-tab content ── */}
                {(editSubTab === "light" || editSubTab === "color" || editSubTab === "effects" || editSubTab === "detail") && (
                  <AdjustmentPanel
                    values={adjValues}
                    activeTool={activeTool}
                    onSelectTool={setActiveTool}
                    onChangeValue={handleAdjChange}
                    onDragEnd={handleAdjCommit}
                    onResetCategory={handleResetCategory}
                    category={editSubTab}
                  />
                )}
                {editSubTab === "curves" && (
                  <CurveEditor curves={params.curve_points} onChange={(c) => setParams((p) => ({ ...p, curve_points: c }))} />
                )}
                {editSubTab === "hsl" && (
                  <HSLPanel hsl7={params.hsl7} onChange={(h) => setParams((p) => ({ ...p, hsl7: h }))} />
                )}
              </div>
            )}
          </div>
        </div>
        <EditorTabBar active={activeTab} onSelect={setActiveTab} />
      </div>
      )}
    </div>
  );
}
