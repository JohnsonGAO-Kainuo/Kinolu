/**
 * Built-in LUT presets — classic film simulations bundled with Kinolu.
 *
 * On first app launch these are fetched from /luts/builtin/*.cube,
 * parsed, and saved into IndexedDB so they appear alongside user presets.
 * A localStorage flag prevents re-importing on subsequent visits.
 */

import { parseCubeFile, importCubeFileLocal, listLocalLuts, type LutEntry } from "./lutStore";

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
}

export const BUILTIN_LUTS: BuiltinLutMeta[] = [
  // ── Fuji Film Simulations ──
  { file: "fuji_provia.cube",         name: "PROVIA",         category: "fuji",    desc: "Standard, faithful color" },
  { file: "fuji_velvia.cube",         name: "Velvia",         category: "fuji",    desc: "Vivid, saturated landscape" },
  { file: "fuji_astia.cube",          name: "ASTIA",          category: "fuji",    desc: "Soft, flattering portrait" },
  { file: "fuji_classic_chrome.cube", name: "Classic Chrome", category: "fuji",    desc: "Muted, documentary tone" },
  { file: "fuji_classic_neg.cube",    name: "Classic Neg",    category: "fuji",    desc: "Nostalgic film negative" },
  { file: "fuji_acros.cube",          name: "ACROS",          category: "fuji",    desc: "Fine-grain black & white" },
  { file: "fuji_eterna.cube",         name: "ETERNA",         category: "fuji",    desc: "Cinematic, low saturation" },

  // ── Kodak Film Stocks ──
  { file: "kodak_portra_400.cube",    name: "Portra 400",     category: "kodak",   desc: "Warm portrait skin tones" },
  { file: "kodak_ektar_100.cube",     name: "Ektar 100",      category: "kodak",   desc: "Vivid, punchy landscape" },
  { file: "kodak_gold_200.cube",      name: "Gold 200",       category: "kodak",   desc: "Warm consumer classic" },

  // ── Classics ──
  { file: "kodachrome.cube",          name: "Kodachrome",     category: "classic", desc: "Legendary slide film" },
  { file: "polaroid_600.cube",        name: "Polaroid 600",   category: "classic", desc: "Instant film warmth" },
];

const LS_KEY = "kinolu_builtin_luts_v1";

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

  // Check if any builtins already exist by name (avoid duplicates)
  const existing = await listLocalLuts();
  const existingNames = new Set(existing.map((e) => e.name));
  const ids: string[] = [];

  for (const meta of BUILTIN_LUTS) {
    if (existingNames.has(meta.name)) {
      // Already exists — find its ID
      const match = existing.find((e) => e.name === meta.name);
      if (match) ids.push(match.id);
      continue;
    }

    try {
      const resp = await fetch(`/luts/builtin/${meta.file}`);
      if (!resp.ok) continue;
      const text = await resp.text();
      const { size, data } = parseCubeFile(text);

      // Create a File-like blob for importCubeFileLocal
      const blob = new Blob([text], { type: "text/plain" });
      const file = new File([blob], meta.file, { type: "text/plain" });

      const entry = await importCubeFileLocal(file, {
        sourceType: "imported",
      });
      // Rename to our friendly name
      ids.push(entry.id);

      // Update the name in IndexedDB
      const { renameLocalLut } = await import("./lutStore");
      await renameLocalLut(entry.id, meta.name);
    } catch (err) {
      console.warn(`[Kinolu] Failed to install builtin LUT: ${meta.name}`, err);
    }
  }

  // Mark as installed
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
  return ids;
}

/**
 * Get the category and description for a built-in LUT by name.
 */
export function getBuiltinMeta(name: string): BuiltinLutMeta | undefined {
  return BUILTIN_LUTS.find((m) => m.name === name);
}
