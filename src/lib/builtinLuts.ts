/**
 * Built-in LUT presets — classic film simulations bundled with Kinolu.
 *
 * On first app launch these are fetched from /luts/builtin/*.cube,
 * parsed, and saved into IndexedDB so they appear alongside user presets.
 * A localStorage flag prevents re-importing on subsequent visits.
 *
 * Naming follows international photography conventions:
 *   Fuji simulations: official Fuji names / abbreviations (CC, CN)
 *   Kodak stocks: classic film stock designations
 */

import { parseCubeFile, importCubeFileLocal, listLocalLuts, applyLutToPixels, type LutEntry } from "./lutStore";

/* ── Curated preset manifest ── */
export interface BuiltinLutMeta {
  /** Filename in /luts/builtin/ */
  file: string;
  /** Display name shown to users */
  name: string;
  /** Category for grouping */
  category: "fuji" | "kodak" | "classic";
  /** Short description */
  desc: string;
  /** Available in free tier */
  isFree: boolean;
}

export const BUILTIN_LUTS: BuiltinLutMeta[] = [
  // ── Fuji Film Simulations ──
  { file: "fuji_provia.cube",         name: "PROVIA",     category: "fuji",    desc: "Standard / faithful color reproduction",   isFree: true },
  { file: "fuji_velvia.cube",         name: "Velvia",     category: "fuji",    desc: "Vivid saturated landscapes",               isFree: false },
  { file: "fuji_astia.cube",          name: "ASTIA",      category: "fuji",    desc: "Soft flattering portraits",                isFree: false },
  { file: "fuji_classic_chrome.cube", name: "CC",         category: "fuji",    desc: "Classic Chrome / muted documentary tone",   isFree: true },
  { file: "fuji_classic_neg.cube",    name: "CN",         category: "fuji",    desc: "Classic Neg / nostalgic film negative",     isFree: true },
  { file: "fuji_acros.cube",          name: "ACROS",      category: "fuji",    desc: "Fine-grain monochrome",                    isFree: false },
  { file: "fuji_eterna.cube",         name: "ETERNA",     category: "fuji",    desc: "Cinematic subdued color",                  isFree: false },

  // ── Kodak Film Stocks ──
  { file: "kodak_portra_400.cube",    name: "Portra 400", category: "kodak",   desc: "Natural skin tones / fine grain portrait", isFree: true },
  { file: "kodak_ektar_100.cube",     name: "Ektar 100",  category: "kodak",   desc: "Ultra-vivid punchy landscape",             isFree: false },
  { file: "kodak_gold_200.cube",      name: "Gold 200",   category: "kodak",   desc: "Warm everyday film classic",               isFree: true },

  // ── Classic ──
  { file: "kodachrome.cube",          name: "Kodachrome", category: "classic", desc: "Legendary warm slide film",                isFree: false },
  { file: "polaroid_600.cube",        name: "Polaroid",   category: "classic", desc: "Instant film character",                   isFree: false },
];

/** Names of free-tier builtins for quick lookup */
export const FREE_BUILTIN_NAMES = new Set(
  BUILTIN_LUTS.filter((m) => m.isFree).map((m) => m.name),
);

const LS_KEY = "kinolu_builtin_luts_v2"; // bumped to force re-import with new names

/**
 * Generate a preview thumbnail by applying the LUT to a sample image.
 */
async function generatePreviewThumb(
  lutData: Float32Array,
  lutSize: number,
): Promise<Blob | null> {
  try {
    const resp = await fetch("/luts/sample.jpg");
    if (!resp.ok) return null;
    const imgBlob = await resp.blob();
    const bmp = await createImageBitmap(imgBlob, { resizeWidth: 96, resizeHeight: 96 });
    const c = document.createElement("canvas");
    c.width = 96; c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, 96, 96);
    const imgData = ctx.getImageData(0, 0, 96, 96);
    applyLutToPixels(imgData.data, lutData, lutSize);
    ctx.putImageData(imgData, 0, 0);
    return new Promise((r) => c.toBlob((b) => r(b), "image/jpeg", 0.85));
  } catch {
    return null;
  }
}

/**
 * Check and install built-in LUTs if not already done.
 * Should be called once on app startup (e.g., in a layout effect).
 * Returns the IDs of the installed built-in LUTs.
 */
export async function ensureBuiltinLuts(): Promise<string[]> {
  // Quick check — already installed?
  if (typeof window === "undefined") return [];
  const flag = localStorage.getItem(LS_KEY);
  if (flag) {
    try {
      return JSON.parse(flag) as string[];
    } catch {
      // corrupted flag, re-install
    }
  }

  // Clean up old version entries
  const oldKey = "kinolu_builtin_luts_v1";
  if (localStorage.getItem(oldKey)) {
    // Delete old builtins from IndexedDB so names get refreshed
    const oldIds = JSON.parse(localStorage.getItem(oldKey) || "[]") as string[];
    const { deleteLocalLut } = await import("./lutStore");
    for (const id of oldIds) {
      try { await deleteLocalLut(id); } catch { /* ignore */ }
    }
    localStorage.removeItem(oldKey);
  }

  const existing = await listLocalLuts();
  const existingNames = new Set(existing.map((e) => e.name));
  const ids: string[] = [];

  for (const meta of BUILTIN_LUTS) {
    if (existingNames.has(meta.name)) {
      const match = existing.find((e) => e.name === meta.name);
      if (match) ids.push(match.id);
      continue;
    }

    try {
      const resp = await fetch(`/luts/builtin/${meta.file}`);
      if (!resp.ok) continue;
      const text = await resp.text();
      const parsed = parseCubeFile(text);

      const blob = new Blob([text], { type: "text/plain" });
      const file = new File([blob], meta.file, { type: "text/plain" });

      const entry = await importCubeFileLocal(file, {
        sourceType: "imported",
      });
      ids.push(entry.id);

      // Rename to the friendly display name
      const { renameLocalLut, updateLutThumbnail } = await import("./lutStore");
      await renameLocalLut(entry.id, meta.name);

      // Generate preview thumbnail from sample image
      const thumb = await generatePreviewThumb(parsed.data, parsed.size);
      if (thumb) await updateLutThumbnail(entry.id, thumb);
    } catch (err) {
      console.warn(`[Kinolu] Failed to install builtin LUT: ${meta.name}`, err);
    }
  }

  localStorage.setItem(LS_KEY, JSON.stringify(ids));
  return ids;
}

/**
 * Get the category and description for a built-in LUT by name.
 */
export function getBuiltinMeta(name: string): BuiltinLutMeta | undefined {
  return BUILTIN_LUTS.find((m) => m.name === name);
}
