/* ── Kinolu Client-Side Image Processor ──
 *
 * Applies real-time edits (exposure, contrast, curves, HSL, etc.)
 * on a <canvas> purely in the browser using pixel manipulation.
 *
 * Heavy lifting is done off-main-thread via OffscreenCanvas when
 * available, otherwise falls back to a hidden <canvas>.
 */

import type { EditParams, CurvePoint, CurveChannels, HSL7Data, HSL7Key } from "./types";

/* ─── Curve LUT builder ─── */
function buildCurveLUT(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (points.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);

  // Monotone cubic Hermite (same algo as CurveEditor visual)
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    dy.push(ys[i + 1] - ys[i]);
    m.push(dy[i] / (dx[i] || 1e-6));
  }
  const tangents: number[] = [m[0] || 0];
  for (let i = 1; i < n - 1; i++) {
    tangents.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  tangents.push(m[n - 2] || 0);

  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let seg = 0;
    for (let j = 0; j < n - 1; j++) {
      if (t >= xs[j] && t <= xs[j + 1]) { seg = j; break; }
      if (j === n - 2) seg = j;
    }
    const h = dx[seg] || 1e-6;
    const s = (t - xs[seg]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    const y =
      h00 * ys[seg] +
      h10 * h * tangents[seg] +
      h01 * (ys[seg + 1] ?? ys[seg]) +
      h11 * h * (tangents[seg + 1] ?? tangents[seg]);
    lut[i] = Math.max(0, Math.min(255, Math.round(y * 255)));
  }
  return lut;
}

/* ─── HSL ↔ RGB helpers ─── */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/* ─── HSL7 band weight ─── */
const HSL7_CENTERS: Record<HSL7Key, number> = {
  red: 0, orange: 30, yellow: 60, green: 120,
  aqua: 180, blue: 240, purple: 300,
};
const BAND_WIDTH = 42;

function hsl7Weight(hue: number, center: number): number {
  let diff = Math.abs(hue - center);
  if (diff > 180) diff = 360 - diff;
  if (diff > BAND_WIDTH) return 0;
  return 1 - diff / BAND_WIDTH;
}

/* ─── Main processing function ─── */
export function applyEdits(
  sourceImageData: ImageData,
  params: EditParams
): ImageData {
  const { width, height } = sourceImageData;
  const src = sourceImageData.data;
  const out = new Uint8ClampedArray(src.length);

  // Pre-build curve LUTs
  const lutRGB = buildCurveLUT(params.curve_points.rgb);
  const lutR = buildCurveLUT(params.curve_points.r);
  const lutG = buildCurveLUT(params.curve_points.g);
  const lutB = buildCurveLUT(params.curve_points.b);

  // Normalize params (UI is -100..100, we need multipliers)
  const exposureMul = Math.pow(2, params.exposure / 100); // ±1 stop per 100
  const contrastFactor = 1 + params.contrast / 100;
  const satMul = 1 + params.sat / 100;
  const vibAmount = params.vib / 100;
  const tempShift = params.temp * 0.4;  // subtle warming/cooling in RGB space
  const tintShift = params.tint * 0.3;  // green-magenta shift
  const highlightAmt = params.highlights / 100;
  const shadowAmt = params.shadows / 100;
  const whitesAmt = params.whites / 100;
  const blacksAmt = params.blacks / 100;
  const dehazeStr = params.dehaze / 100;
  const clarityAmt = params.clarity / 100;

  // Vignette pre-calc
  const cx = width / 2, cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const vigStrength = params.vignette / 100;

  // Bloom pre-calc (we'll do a simple global lighten instead of full blur for perf)
  const bloomAmt = params.bloom / 200; // 0..0.5

  // HSL7 data
  const hsl7 = params.hsl7;
  const hsl7Keys = Object.keys(HSL7_CENTERS) as HSL7Key[];
  const hasHSL7 = hsl7Keys.some(
    (k) => hsl7[k].hue !== 0 || hsl7[k].sat !== 0 || hsl7[k].light !== 0
  );

  for (let i = 0; i < src.length; i += 4) {
    let r = src[i];
    let g = src[i + 1];
    let b = src[i + 2];
    const a = src[i + 3];

    // ── 0. Dehaze (dark channel prior approximation) ──
    if (dehazeStr !== 0) {
      if (dehazeStr > 0) {
        // Remove haze: subtract proportional to min-channel (dark channel)
        const minC = Math.min(r, g, b);
        const haze = minC / 255;
        const correction = dehazeStr * haze * 60;
        r -= correction;
        g -= correction;
        b -= correction;
      } else {
        // Add haze/fog: blend toward atmospheric gray
        const blend = -dehazeStr * 0.4;
        r += (200 - r) * blend;
        g += (200 - g) * blend;
        b += (200 - b) * blend;
      }
    }

    // ── 1. Exposure ──
    if (params.exposure !== 0) {
      r = Math.min(255, r * exposureMul);
      g = Math.min(255, g * exposureMul);
      b = Math.min(255, b * exposureMul);
    }

    // ── 2. Contrast (around midpoint 128) ──
    if (params.contrast !== 0) {
      r = 128 + (r - 128) * contrastFactor;
      g = 128 + (g - 128) * contrastFactor;
      b = 128 + (b - 128) * contrastFactor;
    }

    // ── 2b. Clarity (midtone local contrast) ──
    if (clarityAmt !== 0) {
      const lumC = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      // Bell curve: maximum at midtones, zero at extremes
      const midW = 4 * lumC * (1 - lumC);
      const cBoost = 1 + clarityAmt * midW * 0.5;
      r = 128 + (r - 128) * cBoost;
      g = 128 + (g - 128) * cBoost;
      b = 128 + (b - 128) * cBoost;
    }

    // ── 3. Highlights / Shadows ──
    if (params.highlights !== 0 || params.shadows !== 0) {
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      // Highlights affect bright areas (lum > 0.5)
      if (highlightAmt !== 0 && lum > 0.5) {
        const w = (lum - 0.5) * 2; // 0..1 weight
        const shift = highlightAmt * w * 60;
        r += shift;
        g += shift;
        b += shift;
      }
      // Shadows affect dark areas (lum < 0.5)
      if (shadowAmt !== 0 && lum < 0.5) {
        const w = (0.5 - lum) * 2;
        const shift = shadowAmt * w * 60;
        r += shift;
        g += shift;
        b += shift;
      }
    }

    // ── 3b. Whites / Blacks ──
    if (whitesAmt !== 0 || blacksAmt !== 0) {
      const lumWB = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      // Whites: affects brightest tones (lum > 0.6)
      if (whitesAmt !== 0) {
        const wW = Math.max(0, (lumWB - 0.6) * 2.5); // 0→1 ramp
        const shift = whitesAmt * wW * 55;
        r += shift; g += shift; b += shift;
      }
      // Blacks: affects darkest tones (lum < 0.4)
      if (blacksAmt !== 0) {
        const wB = Math.max(0, (0.4 - lumWB) * 2.5); // 0→1 ramp
        const shift = blacksAmt * wB * 55;
        r += shift; g += shift; b += shift;
      }
    }

    // ── 4. White Balance (Temp / Tint) ──
    if (params.temp !== 0) {
      r += tempShift;
      b -= tempShift;
    }
    if (params.tint !== 0) {
      g -= tintShift;
      r += tintShift * 0.5;
      b += tintShift * 0.5;
    }

    // ── 5. Curves ──
    r = lutRGB[lutR[Math.max(0, Math.min(255, Math.round(r)))]];
    g = lutRGB[lutG[Math.max(0, Math.min(255, Math.round(g)))]];
    b = lutRGB[lutB[Math.max(0, Math.min(255, Math.round(b)))]];

    // ── 6. Saturation / Vibrance ──
    if (params.sat !== 0 || params.vib !== 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let factor = satMul;
      // Vibrance: boost low-sat pixels more
      if (vibAmount !== 0) {
        const curSat = 1 - Math.min(r, g, b) / (Math.max(r, g, b) || 1);
        factor += vibAmount * (1 - curSat);
      }
      r = gray + (r - gray) * factor;
      g = gray + (g - gray) * factor;
      b = gray + (b - gray) * factor;
    }

    // ── 7. HSL 7-band adjustments ──
    if (hasHSL7) {
      let [hue, sat, lig] = rgbToHsl(
        Math.max(0, Math.min(255, Math.round(r))),
        Math.max(0, Math.min(255, Math.round(g))),
        Math.max(0, Math.min(255, Math.round(b)))
      );
      for (const k of hsl7Keys) {
        const band = hsl7[k];
        if (band.hue === 0 && band.sat === 0 && band.light === 0) continue;
        const w = hsl7Weight(hue, HSL7_CENTERS[k]);
        if (w <= 0) continue;
        hue += band.hue * w;
        sat = Math.max(0, Math.min(1, sat + (band.sat / 100) * w));
        lig = Math.max(0, Math.min(1, lig + (band.light / 200) * w));
      }
      [r, g, b] = hslToRgb(hue, sat, lig);
    }

    // ── 8. Bloom (global lighten) ──
    if (bloomAmt > 0) {
      r += (255 - r) * bloomAmt;
      g += (255 - g) * bloomAmt;
      b += (255 - b) * bloomAmt;
    }

    // ── 9. Vignette ──
    if (vigStrength > 0) {
      const px = (i / 4) % width;
      const py = Math.floor((i / 4) / width);
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / maxDist;
      const vig = 1 - vigStrength * dist * dist;
      r *= vig;
      g *= vig;
      b *= vig;
    }

    // ── Clamp and write ──
    out[i] = Math.max(0, Math.min(255, Math.round(r)));
    out[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    out[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    out[i + 3] = a;
  }

  // ── 10. Noise Reduction (selective 3×3 weighted blur) ──
  if (params.noise > 0) {
    const nStr = params.noise / 100;
    const blend = nStr * 0.6;
    const tmp = new Uint8ClampedArray(out);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          // Center-weighted 3×3 average: center=4, cross=2, corners=1
          const ci = idx + c;
          const avg =
            tmp[ci] * 4 +
            tmp[((y - 1) * width + x) * 4 + c] * 2 +
            tmp[((y + 1) * width + x) * 4 + c] * 2 +
            tmp[(y * width + x - 1) * 4 + c] * 2 +
            tmp[(y * width + x + 1) * 4 + c] * 2 +
            tmp[((y - 1) * width + x - 1) * 4 + c] +
            tmp[((y - 1) * width + x + 1) * 4 + c] +
            tmp[((y + 1) * width + x - 1) * 4 + c] +
            tmp[((y + 1) * width + x + 1) * 4 + c];
          out[idx + c] = Math.round(tmp[ci] * (1 - blend) + (avg / 16) * blend);
        }
      }
    }
  }

  // ── 11. Texture (midtone detail enhancement via local contrast) ──
  if (params.texture !== 0) {
    const tStr = params.texture / 100;
    const tmp2 = new Uint8ClampedArray(out);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const lum = tmp2[idx] * 0.299 + tmp2[idx + 1] * 0.587 + tmp2[idx + 2] * 0.114;
        // 3×3 average luminance
        let localL = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            localL += tmp2[((y + dy) * width + (x + dx)) * 4] * 0.299
              + tmp2[((y + dy) * width + (x + dx)) * 4 + 1] * 0.587
              + tmp2[((y + dy) * width + (x + dx)) * 4 + 2] * 0.114;
        localL /= 9;
        const detail = lum - localL;
        // Bell-curve midtone weight (preserves skin)
        const lumN = lum / 255;
        const midW = 4 * lumN * (1 - lumN);
        const shift = detail * tStr * 0.6 * midW;
        out[idx] = Math.max(0, Math.min(255, Math.round(tmp2[idx] + shift)));
        out[idx + 1] = Math.max(0, Math.min(255, Math.round(tmp2[idx + 1] + shift)));
        out[idx + 2] = Math.max(0, Math.min(255, Math.round(tmp2[idx + 2] + shift)));
      }
    }
  }

  // ── 12. Grain (post-process noise) ──
  if (params.grain > 0) {
    const amount = params.grain * 0.4; // max ~40 noise amplitude
    for (let i = 0; i < out.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount;
      out[i] = Math.max(0, Math.min(255, out[i] + noise));
      out[i + 1] = Math.max(0, Math.min(255, out[i + 1] + noise));
      out[i + 2] = Math.max(0, Math.min(255, out[i + 2] + noise));
    }
  }

  // ── 13. Sharpen (simple unsharp mask via 3×3 kernel) ──
  if (params.sharpen > 0) {
    const str = params.sharpen / 100;
    const tmp = new Uint8ClampedArray(out);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = tmp[idx + c] * 5;
          const sum =
            tmp[((y - 1) * width + x) * 4 + c] +
            tmp[((y + 1) * width + x) * 4 + c] +
            tmp[(y * width + x - 1) * 4 + c] +
            tmp[(y * width + x + 1) * 4 + c];
          const sharp = center - sum;
          out[idx + c] = Math.max(
            0,
            Math.min(255, Math.round(tmp[idx + c] + sharp * str * 0.25))
          );
        }
      }
    }
  }

  return new ImageData(out, width, height);
}

/* ─── Check if edits are non-default (need processing) ─── */
export function hasActiveEdits(params: EditParams): boolean {
  if (params.exposure !== 0) return true;
  if (params.contrast !== 0) return true;
  if (params.highlights !== 0) return true;
  if (params.shadows !== 0) return true;
  if (params.whites !== 0) return true;
  if (params.blacks !== 0) return true;
  if (params.sat !== 0) return true;
  if (params.vib !== 0) return true;
  if (params.temp !== 0) return true;
  if (params.tint !== 0) return true;
  if (params.texture !== 0) return true;
  if (params.clarity !== 0) return true;
  if (params.dehaze !== 0) return true;
  if (params.grain !== 0) return true;
  if (params.sharpen !== 0) return true;
  if (params.noise !== 0) return true;
  if (params.vignette !== 0) return true;
  if (params.bloom !== 0) return true;

  // Curves non-identity?
  for (const ch of ["rgb", "r", "g", "b"] as const) {
    const pts = params.curve_points[ch];
    if (pts.length !== 2) return true;
    if (pts[0].x !== 0 || pts[0].y !== 0) return true;
    if (pts[1].x !== 1 || pts[1].y !== 1) return true;
  }

  // HSL7 non-zero?
  for (const k of Object.keys(params.hsl7) as HSL7Key[]) {
    const b = params.hsl7[k];
    if (b.hue !== 0 || b.sat !== 0 || b.light !== 0) return true;
  }

  return false;
}

/* ─── Image Transform Helpers (crop / rotate / flip) ─── */

function imgDataToCanvas(d: ImageData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = d.width;
  c.height = d.height;
  c.getContext("2d")!.putImageData(d, 0, 0);
  return c;
}

/** Crop ImageData by pixel coordinates */
export function cropImageData(d: ImageData, px: number, py: number, pw: number, ph: number): ImageData {
  const c = document.createElement("canvas");
  c.width = pw;
  c.height = ph;
  c.getContext("2d")!.drawImage(imgDataToCanvas(d), px, py, pw, ph, 0, 0, pw, ph);
  return c.getContext("2d")!.getImageData(0, 0, pw, ph);
}

/** Rotate ImageData 90° clockwise */
export function rotateImageData90CW(d: ImageData): ImageData {
  const c = document.createElement("canvas");
  c.width = d.height;
  c.height = d.width;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(imgDataToCanvas(d), 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Flip ImageData horizontally */
export function flipImageDataH(d: ImageData): ImageData {
  const c = document.createElement("canvas");
  c.width = d.width;
  c.height = d.height;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(imgDataToCanvas(d), 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Flip ImageData vertically */
export function flipImageDataV(d: ImageData): ImageData {
  const c = document.createElement("canvas");
  c.width = d.width;
  c.height = d.height;
  const ctx = c.getContext("2d")!;
  ctx.translate(0, c.height);
  ctx.scale(1, -1);
  ctx.drawImage(imgDataToCanvas(d), 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}
