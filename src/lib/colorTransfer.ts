/**
 * Client-side Reinhard LAB color transfer + LUT generation.
 * Pure JavaScript — runs entirely in the browser with no backend.
 *
 * Implements the core "Color Transfer between Images" algorithm
 * (Reinhard et al., 2001) using LAB color space mean/std matching,
 * matching OpenCV's uint8 LAB range for parity with the Python backend.
 */

/* ══════════════ Color Conversion ══════════════ */

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

// D65 white point
const Xn = 0.95047;
const Zn = 1.08883;

const LAB_D3 = (6 / 29) ** 3; // ≈ 0.008856

function labF(t: number): number {
  return t > LAB_D3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
}
function labFInv(t: number): number {
  return t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29);
}

/**
 * sRGB [0-255] → OpenCV-compatible LAB
 *   L: [0, 255]  (CIE L* 0-100 scaled)
 *   a: [0, 255]  (CIE a* shifted +128)
 *   b: [0, 255]  (CIE b* shifted +128)
 */
function rgb2lab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r / 255);
  const gl = srgbToLinear(g / 255);
  const bl = srgbToLinear(b / 255);

  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / Xn;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / Zn;

  const fy = labF(y);
  const L = 116 * fy - 16;
  const a = 500 * (labF(x) - fy);
  const bv = 200 * (fy - labF(z));

  return [L * 255 / 100, a + 128, bv + 128];
}

/** OpenCV-compatible LAB [0-255] → sRGB [0-255] */
function lab2rgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L * 100 / 255 + 16) / 116;
  const fx = (a - 128) / 500 + fy;
  const fz = fy - (b - 128) / 200;

  const rl = 3.2404542 * (Xn * labFInv(fx)) - 1.5371385 * labFInv(fy) - 0.4985314 * (Zn * labFInv(fz));
  const gl = -0.9692660 * (Xn * labFInv(fx)) + 1.8760108 * labFInv(fy) + 0.0415560 * (Zn * labFInv(fz));
  const bl = 0.0556434 * (Xn * labFInv(fx)) - 0.2040259 * labFInv(fy) + 1.0572252 * (Zn * labFInv(fz));

  const c = (v: number) => Math.max(0, Math.min(255, Math.round(linearToSrgb(Math.max(0, v)) * 255)));
  return [c(rl), c(gl), c(bl)];
}

/* ══════════════ Image Helpers ══════════════ */

async function blobToImageData(blob: Blob, maxDim?: number): Promise<ImageData> {
  const bmp = await createImageBitmap(blob);
  let w = bmp.width, h = bmp.height;
  if (maxDim) {
    const s = Math.min(1, maxDim / Math.max(w, h));
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function imageDataToBlob(img: ImageData, quality = 0.92): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d")!.putImageData(img, 0, 0);
  return new Promise((ok, fail) =>
    c.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob failed"))), "image/jpeg", quality)
  );
}

/* ══════════════ LAB Statistics ══════════════ */

interface LabStats {
  lMean: number; lStd: number;
  aMean: number; aStd: number;
  bMean: number; bStd: number;
}

function computeLabStats(data: ImageData): LabStats {
  const px = data.data;
  const n = px.length / 4;
  const labs = new Float32Array(n * 3);
  let lS = 0, aS = 0, bS = 0;

  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    const [l, a, b] = rgb2lab(px[i], px[i + 1], px[i + 2]);
    labs[j] = l; labs[j + 1] = a; labs[j + 2] = b;
    lS += l; aS += a; bS += b;
  }

  const lM = lS / n, aM = aS / n, bM = bS / n;
  let lV = 0, aV = 0, bV = 0;
  for (let j = 0; j < labs.length; j += 3) {
    lV += (labs[j] - lM) ** 2;
    aV += (labs[j + 1] - aM) ** 2;
    bV += (labs[j + 2] - bM) ** 2;
  }

  return {
    lMean: lM, lStd: Math.sqrt(lV / n) + 1e-6,
    aMean: aM, aStd: Math.sqrt(aV / n) + 1e-6,
    bMean: bM, bStd: Math.sqrt(bV / n) + 1e-6,
  };
}

/* ══════════════ LUT Construction ══════════════ */

/**
 * Build a 3D LUT that encodes the Reinhard transfer + XY strength blend.
 * For each grid point: RGB→LAB→Reinhard→blend→LAB→RGB.
 */
function buildReinhardLut(
  srcStats: LabStats,
  refStats: LabStats,
  cubeSize: number,
  colorStr: number,
  toneStr: number,
): Float32Array {
  const data = new Float32Array(cubeSize ** 3 * 3);
  const max = cubeSize - 1;
  let idx = 0;

  for (let bi = 0; bi < cubeSize; bi++) {
    for (let gi = 0; gi < cubeSize; gi++) {
      for (let ri = 0; ri < cubeSize; ri++) {
        const r = (ri / max) * 255;
        const g = (gi / max) * 255;
        const b = (bi / max) * 255;

        const [sL, sA, sB] = rgb2lab(r, g, b);

        // Reinhard (preserve_paper=false): scale by ref_std / src_std
        const tL = (sL - srcStats.lMean) * (refStats.lStd / srcStats.lStd) + refStats.lMean;
        const tA = (sA - srcStats.aMean) * (refStats.aStd / srcStats.aStd) + refStats.aMean;
        const tB = (sB - srcStats.bMean) * (refStats.bStd / srcStats.bStd) + refStats.bMean;

        // XY strength blend (tone=L, color=a,b)
        const fL = Math.max(0, Math.min(255, sL + (tL - sL) * toneStr));
        const fA = Math.max(0, Math.min(255, sA + (tA - sA) * colorStr));
        const fB = Math.max(0, Math.min(255, sB + (tB - sB) * colorStr));

        const [oR, oG, oB] = lab2rgb(fL, fA, fB);
        data[idx++] = oR / 255;
        data[idx++] = oG / 255;
        data[idx++] = oB / 255;
      }
    }
  }
  return data;
}

/** Fast trilinear LUT application on ImageData (mutates in-place) */
function applyLutToImageData(px: Uint8ClampedArray, lut: Float32Array, cubeSize: number) {
  const maxI = cubeSize - 1;
  const cs2 = cubeSize * cubeSize;

  for (let i = 0; i < px.length; i += 4) {
    const rS = (px[i] / 255) * maxI;
    const gS = (px[i + 1] / 255) * maxI;
    const bS = (px[i + 2] / 255) * maxI;

    const r0 = Math.floor(rS), g0 = Math.floor(gS), b0 = Math.floor(bS);
    const r1 = Math.min(r0 + 1, maxI), g1 = Math.min(g0 + 1, maxI), b1 = Math.min(b0 + 1, maxI);
    const rd = rS - r0, gd = gS - g0, bd = bS - b0;

    for (let ch = 0; ch < 3; ch++) {
      const I = (bi: number, gi: number, ri: number) => (bi * cs2 + gi * cubeSize + ri) * 3 + ch;
      const c000 = lut[I(b0, g0, r0)], c100 = lut[I(b0, g0, r1)];
      const c010 = lut[I(b0, g1, r0)], c110 = lut[I(b0, g1, r1)];
      const c001 = lut[I(b1, g0, r0)], c101 = lut[I(b1, g0, r1)];
      const c011 = lut[I(b1, g1, r0)], c111 = lut[I(b1, g1, r1)];

      const c00 = c000 + (c100 - c000) * rd;
      const c10 = c010 + (c110 - c010) * rd;
      const c01 = c001 + (c101 - c001) * rd;
      const c11 = c011 + (c111 - c011) * rd;

      const c_0 = c00 + (c10 - c00) * gd;
      const c_1 = c01 + (c11 - c01) * gd;

      px[i + ch] = Math.max(0, Math.min(255, Math.round((c_0 + (c_1 - c_0) * bd) * 255)));
    }
  }
}

/* ══════════════ Public: Client-Side Transfer ══════════════ */

import type { TransferResponse } from "./types";

/**
 * Perform Reinhard LAB color transfer entirely in the browser.
 *
 * 1. Downsample source + reference to compute LAB statistics
 * 2. Build a 33³ 3D LUT encoding the Reinhard transfer + XY blend
 * 3. Apply the LUT to the full-resolution source via trilinear interpolation
 */
export async function clientTransfer(
  sourceBlob: Blob,
  referenceBlob: Blob,
  colorStrength: number,
  toneStrength: number,
  autoXY: boolean,
): Promise<TransferResponse> {
  // Decode images: small for stats, full for output
  const [srcSmall, refSmall, srcFull] = await Promise.all([
    blobToImageData(sourceBlob, 256),
    blobToImageData(referenceBlob, 256),
    blobToImageData(sourceBlob),
  ]);

  const srcStats = computeLabStats(srcSmall);
  const refStats = computeLabStats(refSmall);

  // Auto XY heuristic
  let autoX = colorStrength;
  let autoY = toneStrength;
  if (autoXY) {
    const chromaDist = Math.abs(srcStats.aMean - refStats.aMean) + Math.abs(srcStats.bMean - refStats.bMean);
    const lumaDist = Math.abs(srcStats.lMean - refStats.lMean);
    autoX = chromaDist > 60 ? 0.65 : chromaDist > 30 ? 0.78 : 0.90;
    autoY = lumaDist > 40 ? 0.60 : lumaDist > 20 ? 0.72 : 0.85;
  }

  // Build LUT and apply
  const cubeSize = 33;
  const lut = buildReinhardLut(srcStats, refStats, cubeSize, autoX, autoY);
  applyLutToImageData(srcFull.data, lut, cubeSize);

  const imageBlob = await imageDataToBlob(srcFull);

  return {
    imageBlob,
    autoX,
    autoY,
    selectedMethod: "reinhard_lab",
    ranking: "",
  };
}

/* ══════════════ Public: Fit LUT from Before/After Pair ══════════════ */

/**
 * Generate a 3D LUT by sampling pixel correspondences between
 * a source image and its styled (color-transferred + edited) version.
 */
export async function fitLutFromPair(
  sourceBlob: Blob,
  styledBlob: Blob,
  cubeSize = 33,
): Promise<{ size: number; data: Float32Array }> {
  const [srcData, styledData] = await Promise.all([
    blobToImageData(sourceBlob, 512),
    blobToImageData(styledBlob, 512),
  ]);

  const sPx = srcData.data;
  const tPx = styledData.data;
  const n = Math.min(sPx.length, tPx.length) / 4;
  const maxI = cubeSize - 1;

  // Accumulate output colors per LUT bin
  const sums = new Float64Array(cubeSize ** 3 * 3);
  const counts = new Uint32Array(cubeSize ** 3);

  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const ri = Math.round((sPx[off] / 255) * maxI);
    const gi = Math.round((sPx[off + 1] / 255) * maxI);
    const bi = Math.round((sPx[off + 2] / 255) * maxI);
    const idx = bi * cubeSize * cubeSize + gi * cubeSize + ri;
    const idx3 = idx * 3;
    sums[idx3] += tPx[off] / 255;
    sums[idx3 + 1] += tPx[off + 1] / 255;
    sums[idx3 + 2] += tPx[off + 2] / 255;
    counts[idx]++;
  }

  const result = new Float32Array(cubeSize ** 3 * 3);
  for (let idx = 0; idx < counts.length; idx++) {
    const idx3 = idx * 3;
    if (counts[idx] > 0) {
      result[idx3] = sums[idx3] / counts[idx];
      result[idx3 + 1] = sums[idx3 + 1] / counts[idx];
      result[idx3 + 2] = sums[idx3 + 2] / counts[idx];
    } else {
      // Identity for empty bins
      const bi = Math.floor(idx / (cubeSize * cubeSize));
      const rem = idx % (cubeSize * cubeSize);
      const gi = Math.floor(rem / cubeSize);
      const ri = rem % cubeSize;
      result[idx3] = ri / maxI;
      result[idx3 + 1] = gi / maxI;
      result[idx3 + 2] = bi / maxI;
    }
  }

  return { size: cubeSize, data: result };
}

/* ══════════════ Public: LUT Data → .cube Blob ══════════════ */

export function lutDataToCubeBlob(
  name: string,
  size: number,
  data: Float32Array,
): Blob {
  const lines: string[] = [`TITLE "${name}"`, `LUT_3D_SIZE ${size}`, ""];
  const total = size ** 3;
  for (let i = 0; i < total; i++) {
    lines.push(`${data[i * 3].toFixed(6)} ${data[i * 3 + 1].toFixed(6)} ${data[i * 3 + 2].toFixed(6)}`);
  }
  return new Blob([lines.join("\n")], { type: "text/plain" });
}
