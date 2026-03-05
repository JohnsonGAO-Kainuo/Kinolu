/**
 * Client-side .cube LUT storage (IndexedDB) + parser + image applicator.
 * Works entirely in the browser — no backend needed.
 */

/* ─── Types ─── */
export interface LutEntry {
  id: string;
  name: string;
  size: number; // LUT_3D_SIZE
  data: Float32Array; // flattened R,G,B triplets  (size^3 * 3)
  createdAt: string;
  /** JPEG thumbnail blob for library display */
  thumbnail?: Blob;
  /** Source type: 'generated' (from transfer) | 'imported' (cube file) */
  sourceType?: "generated" | "imported";
}

/* ─── IndexedDB helpers ─── */
const DB_NAME = "kinolu_luts";
const DB_VERSION = 1;
const STORE = "luts";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txStore(
  db: IDBDatabase,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/* ─── CRUD ─── */

export async function listLocalLuts(): Promise<Omit<LutEntry, "data">[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readonly");
    const req = store.getAll();
    req.onsuccess = () => {
      // Return metadata + thumbnail (skip heavy Float32Array)
      const entries: Omit<LutEntry, "data">[] = (req.result as LutEntry[]).map(
        ({ id, name, size, createdAt, thumbnail, sourceType }) => ({
          id, name, size, createdAt, thumbnail, sourceType,
        })
      );
      entries.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(entries);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalLut(id: string): Promise<LutEntry | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readonly");
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalLut(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function renameLocalLut(
  id: string,
  newName: string
): Promise<void> {
  const db = await openDB();
  const entry = await getLocalLut(id);
  if (!entry) throw new Error("LUT not found");
  entry.name = newName;
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateLutThumbnail(
  id: string,
  thumbnail: Blob,
): Promise<void> {
  const db = await openDB();
  const entry = await getLocalLut(id);
  if (!entry) throw new Error("LUT not found");
  entry.thumbnail = thumbnail;
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ─── .cube parser ─── */

export function parseCubeFile(text: string): { size: number; data: Float32Array; title: string } {
  let size = 0;
  let title = "";
  const values: number[] = [];

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("TITLE")) {
      title = line.replace(/^TITLE\s*/, "").replace(/^"|"$/g, "").trim();
      continue;
    }
    if (line.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    // Skip domain lines
    if (line.startsWith("DOMAIN_MIN") || line.startsWith("DOMAIN_MAX")) continue;
    if (line.startsWith("LUT_1D_SIZE")) {
      throw new Error("1D LUTs are not supported — please use a 3D .cube file");
    }

    // Data line: three floats
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && !parts.some(isNaN)) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }

  if (!size || size < 2) throw new Error("Missing or invalid LUT_3D_SIZE");
  const expected = size * size * size * 3;
  if (values.length !== expected) {
    throw new Error(
      `LUT data mismatch: expected ${expected} values (size=${size}), got ${values.length}`
    );
  }

  return { size, data: new Float32Array(values), title };
}

export async function importCubeFileLocal(
  file: File,
  options?: { thumbnail?: Blob; sourceType?: "generated" | "imported" },
): Promise<Omit<LutEntry, "data">> {
  const text = await file.text();
  const { size, data, title } = parseCubeFile(text);
  const id = `lut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const name = title || file.name.replace(/\.cube$/i, "") || "Imported LUT";
  const createdAt = new Date().toISOString();
  const thumbnail = options?.thumbnail;
  const sourceType = options?.sourceType || "imported";

  const entry: LutEntry = { id, name, size, data, createdAt, thumbnail, sourceType };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const req = store.put(entry);
    req.onsuccess = () => resolve({ id, name, size, createdAt, thumbnail, sourceType });
    req.onerror = () => reject(req.error);
  });
}

/* ─── Export .cube from stored LUT ─── */

export async function exportCubeFile(id: string): Promise<Blob> {
  const entry = await getLocalLut(id);
  if (!entry) throw new Error("LUT not found");

  const lines: string[] = [
    `TITLE "${entry.name}"`,
    `LUT_3D_SIZE ${entry.size}`,
    "",
  ];

  const d = entry.data;
  const total = entry.size ** 3;
  for (let i = 0; i < total; i++) {
    const r = d[i * 3].toFixed(6);
    const g = d[i * 3 + 1].toFixed(6);
    const b = d[i * 3 + 2].toFixed(6);
    lines.push(`${r} ${g} ${b}`);
  }

  return new Blob([lines.join("\n")], { type: "text/plain" });
}

/* ─── Apply LUT to an image (trilinear interpolation) ─── */

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function trilinearSample(
  data: Float32Array,
  size: number,
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const maxIdx = size - 1;
  const rS = clamp01(r) * maxIdx;
  const gS = clamp01(g) * maxIdx;
  const bS = clamp01(b) * maxIdx;

  const r0 = Math.floor(rS);
  const g0 = Math.floor(gS);
  const b0 = Math.floor(bS);
  const r1 = Math.min(r0 + 1, maxIdx);
  const g1 = Math.min(g0 + 1, maxIdx);
  const b1 = Math.min(b0 + 1, maxIdx);

  const rd = rS - r0;
  const gd = gS - g0;
  const bd = bS - b0;

  // Index into flattened array: (b * size * size + g * size + r) * 3
  const idx = (bi: number, gi: number, ri: number) =>
    (bi * size * size + gi * size + ri) * 3;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const sample = (offset: number) => {
    const c000 = data[idx(b0, g0, r0) + offset];
    const c100 = data[idx(b0, g0, r1) + offset];
    const c010 = data[idx(b0, g1, r0) + offset];
    const c110 = data[idx(b0, g1, r1) + offset];
    const c001 = data[idx(b1, g0, r0) + offset];
    const c101 = data[idx(b1, g0, r1) + offset];
    const c011 = data[idx(b1, g1, r0) + offset];
    const c111 = data[idx(b1, g1, r1) + offset];

    const c00 = lerp(c000, c100, rd);
    const c10 = lerp(c010, c110, rd);
    const c01 = lerp(c001, c101, rd);
    const c11 = lerp(c011, c111, rd);

    const c0 = lerp(c00, c10, gd);
    const c1 = lerp(c01, c11, gd);

    return lerp(c0, c1, bd);
  };

  return [sample(0), sample(1), sample(2)];
}

/**
 * Apply a stored LUT to an image and return the result as a Blob.
 * Runs entirely on the client using an OffscreenCanvas / regular Canvas.
 */
export async function applyLutToImage(
  lutId: string,
  imageBlob: Blob
): Promise<Blob> {
  const entry = await getLocalLut(lutId);
  if (!entry) throw new Error("LUT not found");

  const bitmap = await createImageBitmap(imageBlob);
  let { width, height } = bitmap;

  // Cap resolution on mobile to prevent tab crash
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const maxDim = isMobile ? 800 : 1600;
  if (Math.max(width, height) > maxDim) {
    const s = maxDim / Math.max(width, height);
    width = Math.round(width * s);
    height = Math.round(height * s);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  applyLutToPixels(imageData.data, entry.data, entry.size);

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.92
    );
  });
}

/**
 * Apply LUT directly to a Uint8ClampedArray of pixel data (RGBA).
 * Used for real-time camera preview — avoids IndexedDB round-trip.
 */
export function applyLutToPixels(
  px: Uint8ClampedArray,
  lutData: Float32Array,
  lutSize: number,
): void {
  const maxIdx = lutSize - 1;
  const sizeSq = lutSize * lutSize;
  const len = px.length;

  for (let i = 0; i < len; i += 4) {
    const rS = (px[i] / 255) * maxIdx;
    const gS = (px[i + 1] / 255) * maxIdx;
    const bS = (px[i + 2] / 255) * maxIdx;

    const r0 = rS | 0;
    const g0 = gS | 0;
    const b0 = bS | 0;
    const r1 = r0 < maxIdx ? r0 + 1 : maxIdx;
    const g1 = g0 < maxIdx ? g0 + 1 : maxIdx;
    const b1 = b0 < maxIdx ? b0 + 1 : maxIdx;

    const rd = rS - r0;
    const gd = gS - g0;
    const bd = bS - b0;
    const rd1 = 1 - rd, gd1 = 1 - gd, bd1 = 1 - bd;

    // Pre-compute 8 corner indices into flat LUT array
    const i000 = (b0 * sizeSq + g0 * lutSize + r0) * 3;
    const i100 = (b0 * sizeSq + g0 * lutSize + r1) * 3;
    const i010 = (b0 * sizeSq + g1 * lutSize + r0) * 3;
    const i110 = (b0 * sizeSq + g1 * lutSize + r1) * 3;
    const i001 = (b1 * sizeSq + g0 * lutSize + r0) * 3;
    const i101 = (b1 * sizeSq + g0 * lutSize + r1) * 3;
    const i011 = (b1 * sizeSq + g1 * lutSize + r0) * 3;
    const i111 = (b1 * sizeSq + g1 * lutSize + r1) * 3;

    // Inline trilinear interpolation — no array alloc, no function calls
    for (let c = 0; c < 3; c++) {
      const c00 = lutData[i000 + c] * rd1 + lutData[i100 + c] * rd;
      const c10 = lutData[i010 + c] * rd1 + lutData[i110 + c] * rd;
      const c01 = lutData[i001 + c] * rd1 + lutData[i101 + c] * rd;
      const c11 = lutData[i011 + c] * rd1 + lutData[i111 + c] * rd;
      const c0 = c00 * gd1 + c10 * gd;
      const c1 = c01 * gd1 + c11 * gd;
      let v = (c0 * bd1 + c1 * bd) * 255 + 0.5;
      px[i + c] = v > 255 ? 255 : v < 0 ? 0 : v | 0;
    }
  }
}
