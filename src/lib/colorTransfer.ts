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

/* ══════════════ Chroma Histogram Matching ══════════════ */

/**
 * Match the histogram of the a/b channels (LAB) from source to reference.
 * This is the client-side equivalent of backend's `_refine_chroma_hist`.
 * Pure JS implementation — no scikit-image needed.
 */
function refineChromaHistogram(img: ImageData, refData: ImageData, amount = 0.18) {
  const srcPx = img.data;
  const refPx = refData.data;
  const n = srcPx.length / 4;
  const nRef = refPx.length / 4;

  // Convert both to LAB a/b channels and build histograms
  const BINS = 256;
  const srcHistA = new Uint32Array(BINS);
  const srcHistB = new Uint32Array(BINS);
  const refHistA = new Uint32Array(BINS);
  const refHistB = new Uint32Array(BINS);

  // Source LAB
  const srcA = new Uint8Array(n);
  const srcB = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const [, a, b] = rgb2lab(srcPx[off], srcPx[off + 1], srcPx[off + 2]);
    const ai = Math.max(0, Math.min(255, Math.round(a)));
    const bi = Math.max(0, Math.min(255, Math.round(b)));
    srcA[i] = ai;
    srcB[i] = bi;
    srcHistA[ai]++;
    srcHistB[bi]++;
  }

  // Reference LAB
  for (let i = 0; i < nRef; i++) {
    const off = i * 4;
    const [, a, b] = rgb2lab(refPx[off], refPx[off + 1], refPx[off + 2]);
    refHistA[Math.max(0, Math.min(255, Math.round(a)))]++;
    refHistB[Math.max(0, Math.min(255, Math.round(b)))]++;
  }

  // Build CDF and mapping for each channel
  function buildMapping(srcHist: Uint32Array, refHist: Uint32Array, srcN: number, refN: number): Uint8Array {
    const mapping = new Uint8Array(BINS);
    const srcCdf = new Float64Array(BINS);
    const refCdf = new Float64Array(BINS);

    let cumS = 0, cumR = 0;
    for (let i = 0; i < BINS; i++) {
      cumS += srcHist[i];
      cumR += refHist[i];
      srcCdf[i] = cumS / srcN;
      refCdf[i] = cumR / refN;
    }

    for (let i = 0; i < BINS; i++) {
      let best = 0;
      let bestDiff = Infinity;
      for (let j = 0; j < BINS; j++) {
        const diff = Math.abs(srcCdf[i] - refCdf[j]);
        if (diff < bestDiff) { bestDiff = diff; best = j; }
      }
      mapping[i] = best;
    }
    return mapping;
  }

  const mapA = buildMapping(srcHistA, refHistA, n, nRef);
  const mapB = buildMapping(srcHistB, refHistB, n, nRef);

  // Apply mapping with blend amount
  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const [l, a, b] = rgb2lab(srcPx[off], srcPx[off + 1], srcPx[off + 2]);
    const newA = a + (mapA[srcA[i]] - a) * amount;
    const newB = b + (mapB[srcB[i]] - b) * amount;
    const [r, g, bv] = lab2rgb(l, newA, newB);
    srcPx[off] = r;
    srcPx[off + 1] = g;
    srcPx[off + 2] = bv;
  }
}

/* ══════════════ Segmentation-Aware Blending ══════════════ */

import type { RegionMasks } from "./segmentation";

/**
 * Apply per-region strength modulation + skin protection.
 * This is the client-side equivalent of backend's `blend_xy_strength`.
 *
 * - Subject regions: full strength
 * - Sky/vegetation: slightly reduced to prevent over-transfer
 * - Face/skin: chroma drift limiting (skin protection)
 */
function applyRegionAwareBlending(
  img: ImageData,
  original: ImageData,
  masks: RegionMasks,
  skinProtect: boolean,
) {
  const px = img.data;
  const origPx = original.data;
  const n = px.length / 4;

  for (let i = 0; i < n; i++) {
    const off = i * 4;

    // Region weights: how much of the transfer to keep
    const person = masks.person[i];
    const sky = masks.sky[i];
    const veg = masks.vegetation[i];
    const face = masks.face[i];
    const skin = masks.skin[i];

    // Sky: reduce transfer to 70%
    // Vegetation: reduce to 80%
    // Background: reduce to 85%
    const bgWeight = 0.85;
    const skyWeight = 0.70;
    const vegWeight = 0.80;

    const regionBlend = person > 0.5
      ? 1.0
      : sky > 0.3
        ? skyWeight + (1 - skyWeight) * (1 - sky)
        : veg > 0.3
          ? vegWeight + (1 - vegWeight) * (1 - veg)
          : bgWeight;

    // Blend between original and transferred based on region
    if (regionBlend < 1.0) {
      px[off] = origPx[off] + (px[off] - origPx[off]) * regionBlend;
      px[off + 1] = origPx[off + 1] + (px[off + 1] - origPx[off + 1]) * regionBlend;
      px[off + 2] = origPx[off + 2] + (px[off + 2] - origPx[off + 2]) * regionBlend;
    }

    // ── Skin protection: multi-layer chroma & luminance drift control ──
    // Matches the backend's 3-layer skin protection pipeline.
    if (skinProtect && (face > 0.15 || skin > 0.3)) {
      // Face regions get boosted weight (faces are most noticeable)
      const skinW = Math.min(1.0, Math.max(face * 1.3, skin));

      const [origL, origA, origB] = rgb2lab(origPx[off], origPx[off + 1], origPx[off + 2]);
      const [newL, newA, newB] = rgb2lab(px[off], px[off + 1], px[off + 2]);

      // ── Layer 1: Reduce chroma transfer on skin ──
      // Backend: c_alpha *= (1 - 0.90 * s * skin)  →  ~63% chroma reduction
      // Client equivalent: blend chroma 70% back toward original
      const chromaReduction = 0.70 * skinW;
      let blendA = newA * (1 - chromaReduction) + origA * chromaReduction;
      let blendB = newB * (1 - chromaReduction) + origB * chromaReduction;

      // ── Layer 2: Per-channel hard cap on residual chroma drift ──
      // Backend: limit_a ≈ 13, limit_b ≈ 15.6  (separate per-channel)
      const maxDriftA = 12;
      const maxDriftB = 14;
      const dA = blendA - origA;
      const dB = blendB - origB;
      blendA = origA + Math.max(-maxDriftA, Math.min(maxDriftA, dA));
      blendB = origB + Math.max(-maxDriftB, Math.min(maxDriftB, dB));

      // ── Layer 3: Soft anchor toward original skin chroma ──
      // Backend: anchor = 0.55 * s * skin  →  ~39% pull-back
      const anchor = 0.40 * skinW;
      const finalA = blendA * (1 - anchor) + origA * anchor;
      const finalB = blendB * (1 - anchor) + origB * anchor;

      // ── L-channel: mild luminance protection ──
      // Backend: l_alpha *= (1 - 0.35 * s * skin)  →  ~25% L reduction
      const lReduction = 0.25 * skinW;
      const finalL = newL * (1 - lReduction) + origL * lReduction;

      const [r, g, b] = lab2rgb(finalL, finalA, finalB);
      px[off] = r;
      px[off + 1] = g;
      px[off + 2] = b;
    }
  }
}

/* ══════════════ Cinematic Tone Enhancement ══════════════ */

/**
 * Simplified cinematic enhancement matching the Python backend's
 * _apply_cinematic_tone_enhancement + _apply_colorby_signature_calibration.
 *
 * - Film toe/shoulder S-curve on luminance
 * - Subtle chroma density push toward reference palette
 * - Learned calibration prior (Colorby benchmark values)
 */
function applyCinematicTone(img: ImageData, refStats: LabStats, strength = 0.35) {
  const px = img.data;
  const n = px.length / 4;

  // ── Pass 1: Compute percentiles for adaptive tone mapping ──
  const lumBuckets = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
    lumBuckets[Math.max(0, Math.min(255, lum))]++;
  }
  let cumul = 0;
  let p5 = 0, p50 = 128, p95 = 255;
  for (let v = 0; v < 256; v++) {
    cumul += lumBuckets[v];
    const pct = cumul / n;
    if (p5 === 0 && pct >= 0.05) p5 = v;
    if (pct >= 0.50 && p50 === 128) p50 = v;
    if (pct >= 0.95) { p95 = v; break; }
  }

  // ── Film toe/shoulder S-curve parameters ──
  // Maps: shadows get compressed (toe), highlights get rolled off (shoulder)
  const range = Math.max(p95 - p5, 1);
  const shadowLift = strength * 6;       // Lift deep shadows slightly (film stock floor)
  const shoulderRoll = strength * 0.12;  // Gentle highlight roll-off

  // ── Colorby calibration prior (learned from benchmark) ──
  // Slightly warm the tone and increase saturation density
  const calSatBoost = 1 + strength * 0.08;

  // ── Pass 2: Apply tone curve + chroma push ──
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;

    // Film toe: lift shadows
    if (lum < p5 + 20) {
      const w = Math.max(0, 1 - (lum - p5) / 20);
      r += shadowLift * w;
      g += shadowLift * w;
      b += shadowLift * w;
    }

    // Film shoulder: roll off highlights
    if (lum > p95 - 30) {
      const w = Math.max(0, (lum - (p95 - 30)) / 30);
      const compress = 1 - shoulderRoll * w;
      const target = p95 - 30 + (lum - (p95 - 30)) * compress;
      const ratio = lum > 0 ? target / lum : 1;
      r *= ratio;
      g *= ratio;
      b *= ratio;
    }

    // Midtone contrast boost (very subtle S-curve)
    const lumN = lum / 255;
    const midtoneBoost = strength * 0.08 * Math.sin(lumN * Math.PI);
    r = r + (r - 128) * midtoneBoost;
    g = g + (g - 128) * midtoneBoost;
    b = b + (b - 128) * midtoneBoost;

    // Chroma density push: boost saturation slightly toward reference palette
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * calSatBoost;
    g = gray + (g - gray) * calSatBoost;
    b = gray + (b - gray) * calSatBoost;

    px[i] = Math.max(0, Math.min(255, Math.round(r)));
    px[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    px[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
}

/* ══════════════ Public: Client-Side Transfer ══════════════ */

import type { TransferResponse } from "./types";
import { computeRegionMasks } from "./segmentation";

/**
 * Perform Reinhard LAB color transfer entirely in the browser.
 *
 * 1. Downsample source + reference to compute LAB statistics
 * 2. Build a 33³ 3D LUT encoding the Reinhard transfer + XY blend
 * 3. Apply the LUT to the full-resolution source via trilinear interpolation
 * 4. Refine chroma via histogram matching
 * 5. Apply cinematic tone enhancement
 * 6. Segmentation-aware blending + skin protection
 */
export async function clientTransfer(
  sourceBlob: Blob,
  referenceBlob: Blob,
  colorStrength: number,
  toneStrength: number,
  autoXY: boolean,
  skinProtect = true,
  semanticRegions = true,
): Promise<TransferResponse> {
  // Decode images: small for stats, capped for output (800px on mobile to prevent OOM)
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const fullMax = isMobile ? 800 : 1200;
  const [srcSmall, refSmall, srcFull] = await Promise.all([
    blobToImageData(sourceBlob, 256),
    blobToImageData(referenceBlob, 256),
    blobToImageData(sourceBlob, fullMax),
  ]);

  // Keep a copy of original for region blending
  const originalFull = semanticRegions
    ? new ImageData(new Uint8ClampedArray(srcFull.data), srcFull.width, srcFull.height)
    : null;

  const srcStats = computeLabStats(srcSmall);
  const refStats = computeLabStats(refSmall);

  // Compute semantic masks in parallel (non-blocking)
  const masksPromise = semanticRegions
    ? computeRegionMasks(srcFull).catch(() => null)
    : Promise.resolve(null);

  // ── Auto XY strength recommendation ──
  // Ported from backend's recommend_xy_strength():
  //   Continuous LAB gap analysis + semantic mask weighting
  let autoX = colorStrength;
  let autoY = toneStrength;
  if (autoXY) {
    // LAB mean & std differences
    const meanDiffL = Math.abs(srcStats.lMean - refStats.lMean);
    const meanDiffA = Math.abs(srcStats.aMean - refStats.aMean);
    const meanDiffB = Math.abs(srcStats.bMean - refStats.bMean);
    const stdDiffL = Math.abs(srcStats.lStd - refStats.lStd);
    const stdDiffA = Math.abs(srcStats.aStd - refStats.aStd);
    const stdDiffB = Math.abs(srcStats.bStd - refStats.bStd);

    // Chroma gap (a+b channels): how different the color palettes are
    const chromaGap = Math.min(1.8,
      ((meanDiffA + meanDiffB) / 2 / 48.0) + 0.35 * ((stdDiffA + stdDiffB) / 2 / 48.0)
    );
    // Tone gap (L channel): how different the brightness is
    const toneGap = Math.min(1.8,
      meanDiffL / 52.0 + 0.35 * stdDiffL / 52.0
    );

    // Base recommendation: larger gap → slightly lower default blend
    let recColor = 96.0 - 24.0 * Math.min(chromaGap, 1.2);
    let recTone  = 96.0 - 18.0 * Math.min(toneGap, 1.2);

    // Semantic-aware adjustment (if masks are being computed)
    if (semanticRegions) {
      try {
        // Use the small image for fast mask estimation
        const quickMasks = await computeRegionMasks(
          new ImageData(new Uint8ClampedArray(srcSmall.data), srcSmall.width, srcSmall.height)
        );
        const n = srcSmall.width * srcSmall.height;
        let faceCount = 0, skinCount = 0, personCount = 0;
        for (let i = 0; i < n; i++) {
          if (quickMasks.face[i] > 0.25) faceCount++;
          if (quickMasks.skin[i] > 0.25) skinCount++;
          if (quickMasks.person[i] > 0.25) personCount++;
        }
        const faceRatio = faceCount / n;
        const skinRatio = skinCount / n;
        const subjectRatio = personCount / n;

        // Portrait-heavy frames: reduce to avoid over-transfer on faces
        recColor -= 18.0 * Math.min(faceRatio / 0.15, 1.0) * Math.min(chromaGap, 1.0);
        recColor -= 8.0  * Math.min(skinRatio / 0.25, 1.0) * Math.min(chromaGap, 1.0);
        recTone  -= 8.0  * Math.min(subjectRatio / 0.45, 1.0) * Math.min(toneGap, 1.0);
      } catch { /* ignore mask errors for auto XY */ }
    }

    // Clamp to safe range [45, 98] then normalize to [0, 1]
    recColor = Math.max(45, Math.min(98, recColor));
    recTone  = Math.max(45, Math.min(98, recTone));
    autoX = recColor / 100;
    autoY = recTone  / 100;
  }

  // Build LUT and apply
  const cubeSize = 33;
  const lut = buildReinhardLut(srcStats, refStats, cubeSize, autoX, autoY);
  applyLutToImageData(srcFull.data, lut, cubeSize);

  // ── Chroma histogram refinement ──
  // Match a/b channel histograms toward reference (amount=0.18)
  const refFull = await blobToImageData(referenceBlob, Math.max(srcFull.width, srcFull.height));
  refineChromaHistogram(srcFull, refFull, 0.18);

  // ── Cinematic tone enhancement ──
  applyCinematicTone(srcFull, refStats);

  // ── Segmentation-aware blending + skin protection ──
  const masks = await masksPromise;
  if (masks && originalFull) {
    applyRegionAwareBlending(srcFull, originalFull, masks, skinProtect);
  }

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
