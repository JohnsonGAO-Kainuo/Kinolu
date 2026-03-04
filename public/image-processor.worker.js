/* ── Kinolu Image Processing Web Worker ──
 *
 * Offloads heavy pixel-level processing from the main thread.
 * Handles: applyEdits (13-stage pipeline + spatial filters),
 *          applyLutToPixels (trilinear LUT interpolation).
 *
 * Messages:
 *   { type: "applyEdits", id, buffer, width, height, params, liveMode }
 *   { type: "applyLut",   id, buffer, width, height, lutData, lutSize }
 *
 * Response:
 *   { type: "result", id, buffer }  (Transferable — zero-copy back)
 */

/* ═══════════════════════════════════════════════════════
 *  LUT Application (trilinear interpolation)
 * ═══════════════════════════════════════════════════════ */

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function applyLutToPixels(px, lutData, lutSize) {
  const maxIdx = lutSize - 1;
  const sizeSquared = lutSize * lutSize;

  for (let i = 0; i < px.length; i += 4) {
    const rS = clamp01(px[i] / 255) * maxIdx;
    const gS = clamp01(px[i + 1] / 255) * maxIdx;
    const bS = clamp01(px[i + 2] / 255) * maxIdx;

    const r0 = rS | 0, g0 = gS | 0, b0 = bS | 0;
    const r1 = r0 < maxIdx ? r0 + 1 : maxIdx;
    const g1 = g0 < maxIdx ? g0 + 1 : maxIdx;
    const b1 = b0 < maxIdx ? b0 + 1 : maxIdx;

    const rd = rS - r0, gd = gS - g0, bd = bS - b0;
    const rd1 = 1 - rd, gd1 = 1 - gd, bd1 = 1 - bd;

    // Pre-compute base indices
    const i000 = (b0 * sizeSquared + g0 * lutSize + r0) * 3;
    const i100 = (b0 * sizeSquared + g0 * lutSize + r1) * 3;
    const i010 = (b0 * sizeSquared + g1 * lutSize + r0) * 3;
    const i110 = (b0 * sizeSquared + g1 * lutSize + r1) * 3;
    const i001 = (b1 * sizeSquared + g0 * lutSize + r0) * 3;
    const i101 = (b1 * sizeSquared + g0 * lutSize + r1) * 3;
    const i011 = (b1 * sizeSquared + g1 * lutSize + r0) * 3;
    const i111 = (b1 * sizeSquared + g1 * lutSize + r1) * 3;

    // Trilinear for each channel — inlined for speed
    for (let c = 0; c < 3; c++) {
      const c000 = lutData[i000 + c], c100 = lutData[i100 + c];
      const c010 = lutData[i010 + c], c110 = lutData[i110 + c];
      const c001 = lutData[i001 + c], c101 = lutData[i101 + c];
      const c011 = lutData[i011 + c], c111 = lutData[i111 + c];

      const c00 = c000 * rd1 + c100 * rd;
      const c10 = c010 * rd1 + c110 * rd;
      const c01 = c001 * rd1 + c101 * rd;
      const c11 = c011 * rd1 + c111 * rd;

      const c0 = c00 * gd1 + c10 * gd;
      const c1 = c01 * gd1 + c11 * gd;

      const val = c0 * bd1 + c1 * bd;
      px[i + c] = (clamp01(val) * 255 + 0.5) | 0;
    }
  }
}

/* ═══════════════════════════════════════════════════════
 *  Curve LUT builder
 * ═══════════════════════════════════════════════════════ */

function buildCurveLUT(points) {
  const lut = new Uint8Array(256);
  if (!points || points.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const n = sorted.length;
  const xs = sorted.map(p => p.x), ys = sorted.map(p => p.y);
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    dy.push(ys[i + 1] - ys[i]);
    m.push(dy[i] / (dx[i] || 1e-6));
  }
  const tangents = [m[0] || 0];
  for (let i = 1; i < n - 1; i++) tangents.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  tangents.push(m[n - 2] || 0);

  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let seg = 0;
    for (let j = 0; j < n - 1; j++) { if (t >= xs[j] && t <= xs[j + 1]) { seg = j; break; } if (j === n - 2) seg = j; }
    const h = dx[seg] || 1e-6, s = (t - xs[seg]) / h, s2 = s * s, s3 = s2 * s;
    const y = (2*s3-3*s2+1)*ys[seg] + (s3-2*s2+s)*h*tangents[seg] + (-2*s3+3*s2)*(ys[seg+1]??ys[seg]) + (s3-s2)*h*(tangents[seg+1]??tangents[seg]);
    lut[i] = Math.max(0, Math.min(255, Math.round(y * 255)));
  }
  return lut;
}

/* ═══════════════════════════════════════════════════════
 *  HSL helpers
 * ═══════════════════════════════════════════════════════ */

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p, q, t) => { if (t<0) t+=1; if (t>1) t-=1; if (t<1/6) return p+(q-p)*6*t; if (t<1/2) return q; if (t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [Math.round(hue2rgb(p,q,h+1/3)*255), Math.round(hue2rgb(p,q,h)*255), Math.round(hue2rgb(p,q,h-1/3)*255)];
}

const HSL7_CENTERS = { red:0, orange:30, yellow:60, green:120, aqua:180, blue:240, purple:300 };
const BAND_WIDTH = 42;
function hsl7Weight(hue, center) {
  let diff = Math.abs(hue - center);
  if (diff > 180) diff = 360 - diff;
  return diff > BAND_WIDTH ? 0 : 1 - diff / BAND_WIDTH;
}

/* ═══════════════════════════════════════════════════════
 *  applyEdits — full 13-stage pixel pipeline
 * ═══════════════════════════════════════════════════════ */

function applyEdits(srcData, width, height, params, liveMode) {
  const src = srcData;
  const len = width * height * 4;
  const out = new Uint8ClampedArray(len);

  const lutRGB = buildCurveLUT(params.curve_points?.rgb);
  const lutR = buildCurveLUT(params.curve_points?.r);
  const lutG = buildCurveLUT(params.curve_points?.g);
  const lutB = buildCurveLUT(params.curve_points?.b);

  const exposureMul = Math.pow(2, params.exposure / 100);
  const contrastFactor = 1 + params.contrast / 100;
  const satMul = 1 + params.sat / 100;
  const vibAmount = params.vib / 100;
  const tempShift = params.temp * 0.4;
  const tintShift = params.tint * 0.3;
  const highlightAmt = params.highlights / 100;
  const shadowAmt = params.shadows / 100;
  const whitesAmt = params.whites / 100;
  const blacksAmt = params.blacks / 100;
  const dehazeStr = params.dehaze / 100;
  const clarityAmt = params.clarity / 100;
  const cx = width / 2, cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const vigStrength = params.vignette / 100;
  const bloomAmt = params.bloom / 200;

  const hsl7 = params.hsl7;
  const hsl7Keys = hsl7 ? Object.keys(HSL7_CENTERS) : [];
  const hasHSL7 = hsl7 && hsl7Keys.some(k => hsl7[k].hue !== 0 || hsl7[k].sat !== 0 || hsl7[k].light !== 0);

  for (let i = 0; i < len; i += 4) {
    let r = src[i], g = src[i+1], b = src[i+2];
    const a = src[i+3];

    // Dehaze
    if (dehazeStr !== 0) {
      if (dehazeStr > 0) { const minC = Math.min(r,g,b)/255; const corr = dehazeStr*minC*60; r-=corr; g-=corr; b-=corr; }
      else { const bl = -dehazeStr*0.4; r+=(200-r)*bl; g+=(200-g)*bl; b+=(200-b)*bl; }
    }
    // Exposure
    if (params.exposure !== 0) { r = Math.min(255, r*exposureMul); g = Math.min(255, g*exposureMul); b = Math.min(255, b*exposureMul); }
    // Contrast
    if (params.contrast !== 0) { r=128+(r-128)*contrastFactor; g=128+(g-128)*contrastFactor; b=128+(b-128)*contrastFactor; }
    // Clarity
    if (clarityAmt !== 0) { const lumC=(r*0.299+g*0.587+b*0.114)/255; const midW=4*lumC*(1-lumC); const cB=1+clarityAmt*midW*0.5; r=128+(r-128)*cB; g=128+(g-128)*cB; b=128+(b-128)*cB; }
    // Highlights/Shadows
    if (params.highlights !== 0 || params.shadows !== 0) {
      const lum=(r*0.299+g*0.587+b*0.114)/255;
      if (highlightAmt !== 0 && lum > 0.5) { const w=(lum-0.5)*2; const sh=highlightAmt*w*60; r+=sh; g+=sh; b+=sh; }
      if (shadowAmt !== 0 && lum < 0.5) { const w=(0.5-lum)*2; const sh=shadowAmt*w*60; r+=sh; g+=sh; b+=sh; }
    }
    // Whites/Blacks
    if (whitesAmt !== 0 || blacksAmt !== 0) {
      const lumWB=(r*0.299+g*0.587+b*0.114)/255;
      if (whitesAmt !== 0) { const wW=Math.max(0,(lumWB-0.6)*2.5); const sh=whitesAmt*wW*55; r+=sh; g+=sh; b+=sh; }
      if (blacksAmt !== 0) { const wB=Math.max(0,(0.4-lumWB)*2.5); const sh=blacksAmt*wB*55; r+=sh; g+=sh; b+=sh; }
    }
    // White Balance
    if (params.temp !== 0) { r+=tempShift; b-=tempShift; }
    if (params.tint !== 0) { g-=tintShift; r+=tintShift*0.5; b+=tintShift*0.5; }
    // Curves
    r = lutRGB[lutR[Math.max(0, Math.min(255, Math.round(r)))]];
    g = lutRGB[lutG[Math.max(0, Math.min(255, Math.round(g)))]];
    b = lutRGB[lutB[Math.max(0, Math.min(255, Math.round(b)))]];
    // Saturation/Vibrance
    if (params.sat !== 0 || params.vib !== 0) {
      const gray = 0.299*r + 0.587*g + 0.114*b;
      let factor = satMul;
      if (vibAmount !== 0) { const curSat = 1-Math.min(r,g,b)/(Math.max(r,g,b)||1); factor += vibAmount*(1-curSat); }
      r = gray+(r-gray)*factor; g = gray+(g-gray)*factor; b = gray+(b-gray)*factor;
    }
    // HSL 7-band
    if (hasHSL7) {
      let [hue,sat,lig] = rgbToHsl(Math.max(0,Math.min(255,Math.round(r))), Math.max(0,Math.min(255,Math.round(g))), Math.max(0,Math.min(255,Math.round(b))));
      for (const k of hsl7Keys) {
        const band = hsl7[k]; if (band.hue===0&&band.sat===0&&band.light===0) continue;
        const w = hsl7Weight(hue, HSL7_CENTERS[k]); if (w<=0) continue;
        hue += band.hue*w; sat = Math.max(0,Math.min(1,sat+(band.sat/100)*w)); lig = Math.max(0,Math.min(1,lig+(band.light/200)*w));
      }
      [r,g,b] = hslToRgb(hue, sat, lig);
    }
    // Bloom
    if (bloomAmt > 0) { r+=(255-r)*bloomAmt; g+=(255-g)*bloomAmt; b+=(255-b)*bloomAmt; }
    // Vignette
    if (vigStrength > 0) {
      const px = (i/4)%width, py = ((i/4)/width)|0;
      const dist = Math.sqrt((px-cx)**2+(py-cy)**2)/maxDist;
      const vig = 1-vigStrength*dist*dist; r*=vig; g*=vig; b*=vig;
    }
    out[i]=Math.max(0,Math.min(255,Math.round(r)));
    out[i+1]=Math.max(0,Math.min(255,Math.round(g)));
    out[i+2]=Math.max(0,Math.min(255,Math.round(b)));
    out[i+3]=a;
  }

  // Spatial filters (only in full mode)
  if (!liveMode) {
    // Noise reduction
    if (params.noise > 0) {
      const nStr = params.noise/100, blend = nStr*0.6;
      const tmp = new Uint8ClampedArray(out);
      for (let y=1; y<height-1; y++) for (let x=1; x<width-1; x++) {
        const idx=(y*width+x)*4;
        for (let c=0; c<3; c++) {
          const ci=idx+c;
          const avg = tmp[ci]*4 + tmp[((y-1)*width+x)*4+c]*2 + tmp[((y+1)*width+x)*4+c]*2 + tmp[(y*width+x-1)*4+c]*2 + tmp[(y*width+x+1)*4+c]*2 + tmp[((y-1)*width+x-1)*4+c] + tmp[((y-1)*width+x+1)*4+c] + tmp[((y+1)*width+x-1)*4+c] + tmp[((y+1)*width+x+1)*4+c];
          out[idx+c] = Math.round(tmp[ci]*(1-blend)+(avg/16)*blend);
        }
      }
    }
    // Texture
    if (params.texture !== 0) {
      const tStr = params.texture/100;
      const tmp2 = new Uint8ClampedArray(out);
      for (let y=1; y<height-1; y++) for (let x=1; x<width-1; x++) {
        const idx=(y*width+x)*4;
        const lum = tmp2[idx]*0.299+tmp2[idx+1]*0.587+tmp2[idx+2]*0.114;
        let localL=0;
        for (let dy2=-1; dy2<=1; dy2++) for (let dx2=-1; dx2<=1; dx2++) localL += tmp2[((y+dy2)*width+(x+dx2))*4]*0.299+tmp2[((y+dy2)*width+(x+dx2))*4+1]*0.587+tmp2[((y+dy2)*width+(x+dx2))*4+2]*0.114;
        localL/=9;
        const detail=lum-localL, lumN=lum/255, midW=4*lumN*(1-lumN), shift=detail*tStr*0.6*midW;
        out[idx]=Math.max(0,Math.min(255,Math.round(tmp2[idx]+shift)));
        out[idx+1]=Math.max(0,Math.min(255,Math.round(tmp2[idx+1]+shift)));
        out[idx+2]=Math.max(0,Math.min(255,Math.round(tmp2[idx+2]+shift)));
      }
    }
    // Grain
    if (params.grain > 0) {
      const amount = params.grain*0.4;
      for (let i=0; i<out.length; i+=4) {
        const noise=(Math.random()-0.5)*amount;
        out[i]=Math.max(0,Math.min(255,out[i]+noise));
        out[i+1]=Math.max(0,Math.min(255,out[i+1]+noise));
        out[i+2]=Math.max(0,Math.min(255,out[i+2]+noise));
      }
    }
    // Sharpen
    if (params.sharpen > 0) {
      const str = params.sharpen/100;
      const tmp = new Uint8ClampedArray(out);
      for (let y=1; y<height-1; y++) for (let x=1; x<width-1; x++) {
        const idx=(y*width+x)*4;
        for (let c=0; c<3; c++) {
          const center = tmp[idx+c]*5;
          const sum = tmp[((y-1)*width+x)*4+c]+tmp[((y+1)*width+x)*4+c]+tmp[(y*width+x-1)*4+c]+tmp[(y*width+x+1)*4+c];
          out[idx+c] = Math.max(0, Math.min(255, Math.round(tmp[idx+c]+(center-sum)*str*0.25)));
        }
      }
    }
  }

  return out;
}

/* ═══════════════════════════════════════════════════════
 *  Message handler
 * ═══════════════════════════════════════════════════════ */

self.onmessage = function(e) {
  const msg = e.data;

  if (msg.type === "applyEdits") {
    const result = applyEdits(
      new Uint8ClampedArray(msg.buffer),
      msg.width, msg.height,
      msg.params, msg.liveMode
    );
    self.postMessage(
      { type: "result", id: msg.id, buffer: result.buffer, width: msg.width, height: msg.height },
      [result.buffer]
    );
  }

  else if (msg.type === "applyLut") {
    const px = new Uint8ClampedArray(msg.buffer);
    const lutData = new Float32Array(msg.lutBuffer);
    applyLutToPixels(px, lutData, msg.lutSize);
    self.postMessage(
      { type: "result", id: msg.id, buffer: px.buffer, width: msg.width, height: msg.height },
      [px.buffer]
    );
  }
};
