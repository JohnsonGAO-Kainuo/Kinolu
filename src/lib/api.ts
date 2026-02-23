/* ── Kinolu API Client ── */

import type {
  EditParams,
  PresetItem,
  TransferResponse,
  Capabilities,
} from "./types";
import { clientTransfer, fitLutFromPair, lutDataToCubeBlob } from "./colorTransfer";
import { importCubeFileLocal, applyLutToImage, getLocalLut } from "./lutStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function toPercent(value: number): number {
  // UI 层是 0..1，后端是 0..100；兼容两种输入。
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

function toBackendBool(value: boolean): string {
  return value ? "1" : "0";
}

/* ─── Transfer ─── */
export async function transferImage(
  reference: File,
  source: File,
  params: EditParams
): Promise<TransferResponse> {
  // Try server first
  try {
    const fd = new FormData();
    fd.append("reference", reference);
    fd.append("source", source);
    fd.append("method", params.method);
    fd.append("color_strength", String(toPercent(params.color_strength)));
    fd.append("tone_strength", String(toPercent(params.tone_strength)));
    fd.append("auto_xy", toBackendBool(params.auto_xy));
    fd.append("cinematic_enhance", toBackendBool(params.cinematic_enhance));
    fd.append("cinematic_strength", String(toPercent(params.cinematic_strength)));
    fd.append("skin_protect", toBackendBool(params.skin_protect));
    fd.append("semantic_regions", toBackendBool(params.semantic_regions));
    fd.append("skin_strength", "70");

    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) throw new Error(`Server ${res.status}`);

    const imageBlob = await res.blob();
    const colorUsed = parseFloat(
      res.headers.get("X-Kinolu-Color-Strength-Used") ||
        res.headers.get("X-Kinolu-Auto-X") ||
        "50"
    );
    const toneUsed = parseFloat(
      res.headers.get("X-Kinolu-Tone-Strength-Used") ||
        res.headers.get("X-Kinolu-Auto-Y") ||
        "50"
    );
    const selectedMethod =
      res.headers.get("X-Kinolu-Selected-Method") ||
      res.headers.get("X-Kinolu-Method") ||
      params.method;
    const ranking =
      res.headers.get("X-Kinolu-Auto-Ranking") ||
      res.headers.get("X-Kinolu-Ranking") ||
      "";

    return {
      imageBlob,
      autoX: Math.max(0, Math.min(1, colorUsed / 100)),
      autoY: Math.max(0, Math.min(1, toneUsed / 100)),
      selectedMethod,
      ranking,
    };
  } catch {
    // ── Client-side fallback (Reinhard LAB) ──
    return clientTransfer(
      source,
      reference,
      params.color_strength,
      params.tone_strength,
      params.auto_xy,
    );
  }
}

/* ─── Capabilities ─── */
export async function getCapabilities(): Promise<Capabilities> {
  const res = await fetch(`${API_BASE}/api/capabilities`);
  if (!res.ok) throw new Error("Failed to fetch capabilities");
  return res.json();
}

/* ─── Health ─── */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/* ─── Presets ─── */
export async function listPresets(): Promise<PresetItem[]> {
  const res = await fetch(`${API_BASE}/api/presets`);
  if (!res.ok) throw new Error("Failed to list presets");
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

export async function importCubePreset(file: File, name?: string): Promise<PresetItem> {
  const fd = new FormData();
  fd.append("cube_file", file);
  fd.append("name", name || file.name.replace(/\.cube$/i, "") || "Imported CUBE");
  const res = await fetch(`${API_BASE}/api/presets/import-cube`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`Import CUBE failed: ${res.status}`);
  return res.json();
}

export async function createPresetFromTransfer(
  source: File,
  styled: Blob,
  name: string
): Promise<PresetItem> {
  // Try server
  try {
    const fd = new FormData();
    fd.append("source", source);
    fd.append("styled", new File([styled], "styled.jpg", { type: "image/jpeg" }));
    fd.append("name", name || "Generated Look");
    fd.append("cube_size", "33");
    const res = await fetch(`${API_BASE}/api/presets/from-transfer`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return res.json();
  } catch {
    // ── Client-side fallback: fit LUT + save to IndexedDB ──
    const { size, data } = await fitLutFromPair(source, styled);
    const cubeBlob = lutDataToCubeBlob(name || "Generated Look", size, data);
    const cubeFile = new File([cubeBlob], `${name}.cube`, { type: "text/plain" });
    const entry = await importCubeFileLocal(cubeFile);
    return {
      id: entry.id,
      name: entry.name,
      source_type: "generated",
      cube_file: "",
      created_at: entry.createdAt,
      updated_at: entry.createdAt,
    };
  }
}

export async function applyPresetToImage(source: File, presetId: string): Promise<Blob> {
  // If it's a local LUT ID, use client-side application directly
  if (presetId.startsWith("lut_")) {
    return applyLutToImage(presetId, source);
  }
  // Try server
  try {
    const fd = new FormData();
    fd.append("source", source);
    fd.append("preset_id", presetId);
    const res = await fetch(`${API_BASE}/api/presets/apply`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return res.blob();
  } catch {
    // Try as local LUT fallback
    const local = await getLocalLut(presetId);
    if (local) return applyLutToImage(presetId, source);
    throw new Error("Preset not found (backend unavailable)");
  }
}

export async function renamePreset(presetId: string, name: string): Promise<PresetItem> {
  const res = await fetch(`${API_BASE}/api/presets/${presetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Rename preset failed: ${res.status}`);
  return res.json();
}

export async function deletePresetById(presetId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/presets/${presetId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete preset failed: ${res.status}`);
}

export function presetCubeDownloadUrl(presetId: string): string {
  return `${API_BASE}/api/presets/${presetId}/cube`;
}

export async function exportLutFromTransfer(source: File, styled: Blob, cubeSize = 33): Promise<Blob> {
  // Try server
  try {
    const fd = new FormData();
    fd.append("source", source);
    fd.append("styled", new File([styled], "styled.jpg", { type: "image/jpeg" }));
    fd.append("cube_size", String(cubeSize));
    const res = await fetch(`${API_BASE}/api/export/lut`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return res.blob();
  } catch {
    // ── Client-side fallback: fit LUT from pair ──
    const { size, data } = await fitLutFromPair(source, styled, cubeSize);
    return lutDataToCubeBlob(`kinolu_export_${Date.now()}`, size, data);
  }
}
