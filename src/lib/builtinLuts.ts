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
  /** Internal name (stored in IndexedDB) */
  name: string;
  /** i18n key for localized display name */
  i18nKey: string;
  /** Category for grouping */
  category: "fuji" | "kodak" | "classic";
  /** Short description */
  desc: string;
  /** Available in free tier */
  isFree: boolean;
}

export const BUILTIN_LUTS: BuiltinLutMeta[] = [
  // ── Free tier (5) ──
  { file: "fuji_provia.cube",         name: "Fuji PROVIA",  i18nKey: "lut_fuji_provia",  category: "fuji",    desc: "Standard / faithful color reproduction",   isFree: true },
  { file: "fuji_classic_chrome.cube", name: "Fuji CC",      i18nKey: "lut_fuji_cc",      category: "fuji",    desc: "Classic Chrome / muted documentary tone",   isFree: true },
  { file: "fuji_classic_neg.cube",    name: "Fuji NC",      i18nKey: "lut_fuji_nc",      category: "fuji",    desc: "Classic Neg / nostalgic film negative",     isFree: true },
  { file: "kodak_portra_400.cube",    name: "Kodak Portra",  i18nKey: "lut_kodak_portra", category: "kodak",   desc: "Natural skin tones / fine grain portrait", isFree: true },
  { file: "kodak_gold_200.cube",      name: "Kodak Gold",    i18nKey: "lut_kodak_gold",   category: "kodak",   desc: "Warm everyday film classic",               isFree: true },

  // ── Pro (7) ──
  { file: "fuji_velvia.cube",         name: "Fuji Velvia",  i18nKey: "lut_fuji_velvia",  category: "fuji",    desc: "Vivid saturated landscapes",               isFree: false },
  { file: "fuji_astia.cube",          name: "Fuji ASTIA",   i18nKey: "lut_fuji_astia",   category: "fuji",    desc: "Soft flattering portraits",                isFree: false },
  { file: "fuji_acros.cube",          name: "Fuji ACROS",   i18nKey: "lut_fuji_acros",   category: "fuji",    desc: "Fine-grain monochrome",                    isFree: false },
  { file: "fuji_eterna.cube",         name: "Fuji ETERNA",  i18nKey: "lut_fuji_eterna",  category: "fuji",    desc: "Cinematic subdued color",                  isFree: false },
  { file: "kodak_ektar_100.cube",     name: "Kodak Ektar",   i18nKey: "lut_kodak_ektar",  category: "kodak",   desc: "Ultra-vivid punchy landscape",             isFree: false },
  { file: "kodachrome.cube",          name: "Kodachrome",    i18nKey: "lut_kodachrome",   category: "classic", desc: "Legendary warm slide film",                isFree: false },
  { file: "polaroid_600.cube",        name: "Polaroid",      i18nKey: "lut_polaroid",     category: "classic", desc: "Instant film character",                   isFree: false },
];

/** Names of free-tier builtins for quick lookup */
export const FREE_BUILTIN_NAMES = new Set(
  BUILTIN_LUTS.filter((m) => m.isFree).map((m) => m.name),
);

const LS_KEY = "kinolu_builtin_luts_v9"; // v9: restored exact original car sample from 82b47c4

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
 *
 * Uses a singleton promise so multiple callers (layout + editor) share
 * the same in-flight work and never race.
 */
let _ensurePromise: Promise<string[]> | null = null;

export function ensureBuiltinLuts(): Promise<string[]> {
  if (!_ensurePromise) {
    _ensurePromise = _ensureBuiltinLutsImpl().catch((err) => {
      _ensurePromise = null; // allow retry on failure
      throw err;
    });
  }
  return _ensurePromise;
}

async function _ensureBuiltinLutsImpl(): Promise<string[]> {
  // Quick check — already installed?
  if (typeof window === "undefined") return [];
  const flag = localStorage.getItem(LS_KEY);
  if (flag) {
    try {
      const cached = JSON.parse(flag) as string[];
      // Only trust the cache if it actually has entries — empty means a
      // previous install failed mid-way and we should retry.
      if (cached.length > 0) return cached;
    } catch {
      // corrupted flag, re-install
    }
  }

  // ── Step 1: Install/find all builtins FIRST, before deleting old ones ──
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

  // ── Step 2: Only if we got at least SOME LUTs, clean up old versions ──
  // This prevents data loss if the server is down (503) — old presets
  // stay visible until new ones are confirmed installed.
  if (ids.length > 0) {
    for (const oldKey of ["kinolu_builtin_luts_v1", "kinolu_builtin_luts_v2", "kinolu_builtin_luts_v3", "kinolu_builtin_luts_v4", "kinolu_builtin_luts_v5", "kinolu_builtin_luts_v6", "kinolu_builtin_luts_v7", "kinolu_builtin_luts_v8"]) {
      if (localStorage.getItem(oldKey)) {
        const oldIds = JSON.parse(localStorage.getItem(oldKey) || "[]") as string[];
        const { deleteLocalLut } = await import("./lutStore");
        // Only delete old entries that are NOT in the new set (may share IDs if names matched)
        const newIdSet = new Set(ids);
        for (const id of oldIds) {
          if (!newIdSet.has(id)) {
            try { await deleteLocalLut(id); } catch { /* ignore */ }
          }
        }
        localStorage.removeItem(oldKey);
      }
    }
  }

  // Only persist the flag if installation was successful (got at least half)
  if (ids.length >= Math.floor(BUILTIN_LUTS.length / 2)) {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  }
  return ids;
}

/**
 * Get the category and description for a built-in LUT by name.
 */
export function getBuiltinMeta(name: string): BuiltinLutMeta | undefined {
  return BUILTIN_LUTS.find((m) => m.name === name);
}
