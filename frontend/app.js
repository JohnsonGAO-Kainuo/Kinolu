const refInput = document.getElementById('refInput');
const srcInput = document.getElementById('srcInput');
const refPreview = document.getElementById('refPreview');
const srcPreview = document.getElementById('srcPreview');
const resultPreview = document.getElementById('resultPreview');
const methodSelect = document.getElementById('method');
const cinematicEnhance = document.getElementById('cinematicEnhance');
const skinProtect = document.getElementById('skinProtect');
const semanticRegions = document.getElementById('semanticRegions');
const autoXY = document.getElementById('autoXY');
const colorStrength = document.getElementById('colorStrength');
const toneStrength = document.getElementById('toneStrength');
const pad = document.getElementById('pad');
const padCtx = pad.getContext('2d');
const curveCanvas = document.getElementById('curveCanvas');
const curveCtx = curveCanvas.getContext('2d');
const curveResetChannel = document.getElementById('curveResetChannel');
const curveResetAll = document.getElementById('curveResetAll');
const curveTabs = document.getElementById('curveTabs');
const curvePointsInput = document.getElementById('curve_points');
const hsl7Grid = document.getElementById('hsl7Grid');
const hsl7Input = document.getElementById('hsl7_json');
const statusEl = document.getElementById('status');
const downloadEl = document.getElementById('download');
const capInfo = document.getElementById('capInfo');
const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';
const HSL7_BANDS = [
  { key: 'red', label: 'Red' },
  { key: 'orange', label: 'Orange' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'aqua', label: 'Aqua' },
  { key: 'blue', label: 'Blue' },
  { key: 'purple', label: 'Purple' }
];
const sliders = [
  ['cinematic_strength', 'cinematic_strengthVal'],
  ['skin_strength', 'skin_strengthVal'],
  ['sat', 'satVal'], ['vib', 'vibVal'], ['temp', 'tempVal'], ['tint', 'tintVal'],
  ['contrast', 'contrastVal'], ['highlights', 'highlightsVal'], ['shadows', 'shadowsVal'],
  ['grain', 'grainVal'], ['sharpen', 'sharpenVal'],
  ['hue', 'hueVal'], ['hsl_sat', 'hsl_satVal'], ['hsl_light', 'hsl_lightVal']
];

// preview helpers
function bindPreview(input, img) {
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) {
      img.src = URL.createObjectURL(input.files[0]);
    }
  });
}
bindPreview(refInput, refPreview);
bindPreview(srcInput, srcPreview);

// pad drawing
function drawPad(x = 1, y = 1) {
  const w = pad.width, h = pad.height;
  padCtx.clearRect(0, 0, w, h);
  padCtx.fillStyle = '#0c111b';
  padCtx.fillRect(0, 0, w, h);
  padCtx.strokeStyle = '#1f2735';
  padCtx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    padCtx.beginPath();
    padCtx.moveTo((w / 4) * i, 0);
    padCtx.lineTo((w / 4) * i, h);
    padCtx.stroke();
    padCtx.beginPath();
    padCtx.moveTo(0, (h / 4) * i);
    padCtx.lineTo(w, (h / 4) * i);
    padCtx.stroke();
  }
  const cx = x * w;
  const cy = (1 - y) * h;
  padCtx.fillStyle = '#3b6cf0';
  padCtx.beginPath();
  padCtx.arc(cx, cy, 8, 0, Math.PI * 2);
  padCtx.fill();
}

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

let padState = { x: 1, y: 1 };
drawPad(padState.x, padState.y);

function updatePadFromInputs() {
  const x = clamp01(Number(colorStrength.value) / 100);
  const y = clamp01(Number(toneStrength.value) / 100);
  padState = { x, y };
  drawPad(x, y);
}

colorStrength.addEventListener('input', updatePadFromInputs);
toneStrength.addEventListener('input', updatePadFromInputs);

function handlePadEvent(clientX, clientY) {
  const rect = pad.getBoundingClientRect();
  const x = clamp01((clientX - rect.left) / rect.width);
  const y = clamp01((clientY - rect.top) / rect.height);
  padState = { x, y: 1 - y };
  colorStrength.value = Math.round(padState.x * 100);
  toneStrength.value = Math.round(padState.y * 100);
  drawPad(padState.x, padState.y);
}

pad.addEventListener('mousedown', e => {
  handlePadEvent(e.clientX, e.clientY);
  const move = ev => handlePadEvent(ev.clientX, ev.clientY);
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

pad.addEventListener('touchstart', e => {
  const t = e.touches[0];
  handlePadEvent(t.clientX, t.clientY);
});
pad.addEventListener('touchmove', e => {
  const t = e.touches[0];
  handlePadEvent(t.clientX, t.clientY);
});

// RGB curve editor
const CURVE_CHANNELS = ['master', 'r', 'g', 'b'];
const CURVE_COLORS = {
  master: '#4d86ff',
  r: '#ff6f6f',
  g: '#70df8f',
  b: '#78a8ff'
};
const curveState = {
  active: 'master',
  dragging: -1,
  points: {
    master: [[0.0, 0.0], [1.0, 1.0]],
    r: [[0.0, 0.0], [1.0, 1.0]],
    g: [[0.0, 0.0], [1.0, 1.0]],
    b: [[0.0, 0.0], [1.0, 1.0]]
  }
};

function defaultCurvePoints() {
  return [[0.0, 0.0], [1.0, 1.0]];
}

function curveToCanvas(p) {
  return [p[0] * curveCanvas.width, (1 - p[1]) * curveCanvas.height];
}

function canvasToCurve(x, y) {
  return [clamp01(x / curveCanvas.width), clamp01(1 - y / curveCanvas.height)];
}

function syncCurveInput() {
  const out = {};
  CURVE_CHANNELS.forEach(ch => {
    out[ch] = curveState.points[ch].map(p => [Number(p[0].toFixed(4)), Number(p[1].toFixed(4))]);
  });
  curvePointsInput.value = JSON.stringify(out);
}

function updateCurveTabs() {
  if (!curveTabs) return;
  curveTabs.querySelectorAll('.curve-tab').forEach(btn => {
    const active = btn.dataset.curveChannel === curveState.active;
    btn.classList.toggle('active', active);
  });
}

function drawCurveGrid() {
  const w = curveCanvas.width;
  const h = curveCanvas.height;
  curveCtx.clearRect(0, 0, w, h);
  curveCtx.fillStyle = '#0c111b';
  curveCtx.fillRect(0, 0, w, h);
  curveCtx.strokeStyle = '#1f2735';
  curveCtx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gx = (w / 4) * i;
    const gy = (h / 4) * i;
    curveCtx.beginPath();
    curveCtx.moveTo(gx, 0);
    curveCtx.lineTo(gx, h);
    curveCtx.stroke();
    curveCtx.beginPath();
    curveCtx.moveTo(0, gy);
    curveCtx.lineTo(w, gy);
    curveCtx.stroke();
  }
}

function drawCurveLines() {
  CURVE_CHANNELS.forEach(ch => {
    const pts = curveState.points[ch];
    curveCtx.strokeStyle = CURVE_COLORS[ch];
    curveCtx.globalAlpha = ch === curveState.active ? 1.0 : 0.35;
    curveCtx.lineWidth = ch === curveState.active ? 2.2 : 1.3;
    curveCtx.beginPath();
    pts.forEach((p, i) => {
      const [cx, cy] = curveToCanvas(p);
      if (i === 0) curveCtx.moveTo(cx, cy);
      else curveCtx.lineTo(cx, cy);
    });
    curveCtx.stroke();
  });
  curveCtx.globalAlpha = 1.0;
}

function drawActiveCurvePoints() {
  const pts = curveState.points[curveState.active];
  pts.forEach((p, i) => {
    const [cx, cy] = curveToCanvas(p);
    const isEndpoint = i === 0 || i === pts.length - 1;
    curveCtx.fillStyle = isEndpoint ? '#9aa9c8' : CURVE_COLORS[curveState.active];
    curveCtx.beginPath();
    curveCtx.arc(cx, cy, isEndpoint ? 5 : 6, 0, Math.PI * 2);
    curveCtx.fill();
  });
}

function drawCurve() {
  drawCurveGrid();
  drawCurveLines();
  drawActiveCurvePoints();
  updateCurveTabs();
}

function pickCurvePoint(clientX, clientY) {
  const pts = curveState.points[curveState.active];
  const rect = curveCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = curveToCanvas(pts[i]);
    const d2 = (cx - x) * (cx - x) + (cy - y) * (cy - y);
    if (d2 < 12 * 12) return i;
  }
  return -1;
}

function insertCurvePoint(clientX, clientY) {
  const pts = curveState.points[curveState.active];
  if (pts.length >= 8) return -1;
  const rect = curveCanvas.getBoundingClientRect();
  const [x, y] = canvasToCurve(clientX - rect.left, clientY - rect.top);
  if (x <= 0.02 || x >= 0.98) return -1;

  let idx = 1;
  while (idx < pts.length && pts[idx][0] < x) idx++;
  const left = pts[idx - 1];
  const right = pts[idx];
  if (!left || !right) return -1;
  if (x - left[0] < 0.03 || right[0] - x < 0.03) return -1;
  pts.splice(idx, 0, [x, y]);
  return idx;
}

function moveCurvePoint(index, clientX, clientY) {
  const pts = curveState.points[curveState.active];
  if (index < 1 || index >= pts.length - 1) return;
  const rect = curveCanvas.getBoundingClientRect();
  const [nx0, ny0] = canvasToCurve(clientX - rect.left, clientY - rect.top);
  const leftX = pts[index - 1][0] + 0.02;
  const rightX = pts[index + 1][0] - 0.02;
  const nx = Math.min(rightX, Math.max(leftX, nx0));
  pts[index] = [nx, ny0];
  drawCurve();
  syncCurveInput();
}

function removeCurvePointAt(clientX, clientY) {
  const idx = pickCurvePoint(clientX, clientY);
  if (idx === -1) return;
  curveState.points[curveState.active].splice(idx, 1);
  drawCurve();
  syncCurveInput();
}

curveCanvas.addEventListener('mousedown', e => {
  let idx = pickCurvePoint(e.clientX, e.clientY);
  if (idx === -1) idx = insertCurvePoint(e.clientX, e.clientY);
  curveState.dragging = idx;
  if (idx !== -1) moveCurvePoint(idx, e.clientX, e.clientY);
  const move = ev => {
    if (curveState.dragging !== -1) moveCurvePoint(curveState.dragging, ev.clientX, ev.clientY);
  };
  const up = () => {
    curveState.dragging = -1;
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

curveCanvas.addEventListener('dblclick', e => {
  removeCurvePointAt(e.clientX, e.clientY);
});

curveCanvas.addEventListener('touchstart', e => {
  const t = e.touches[0];
  let idx = pickCurvePoint(t.clientX, t.clientY);
  if (idx === -1) idx = insertCurvePoint(t.clientX, t.clientY);
  curveState.dragging = idx;
  if (idx !== -1) moveCurvePoint(idx, t.clientX, t.clientY);
});

curveCanvas.addEventListener('touchmove', e => {
  if (curveState.dragging === -1) return;
  const t = e.touches[0];
  moveCurvePoint(curveState.dragging, t.clientX, t.clientY);
});

curveCanvas.addEventListener('touchend', () => { curveState.dragging = -1; });

if (curveTabs) {
  curveTabs.addEventListener('click', e => {
    const btn = e.target.closest('[data-curve-channel]');
    if (!btn) return;
    const ch = btn.dataset.curveChannel;
    if (!CURVE_CHANNELS.includes(ch)) return;
    curveState.active = ch;
    drawCurve();
  });
}

if (curveResetChannel) {
  curveResetChannel.addEventListener('click', () => {
    curveState.points[curveState.active] = defaultCurvePoints();
    drawCurve();
    syncCurveInput();
  });
}

if (curveResetAll) {
  curveResetAll.addEventListener('click', () => {
    CURVE_CHANNELS.forEach(ch => { curveState.points[ch] = defaultCurvePoints(); });
    drawCurve();
    syncCurveInput();
  });
}

drawCurve();
syncCurveInput();

// HSL 7-way controls
function buildHsl7Controls() {
  if (!hsl7Grid) return;
  const rows = [];
  HSL7_BANDS.forEach(b => {
    rows.push(`
      <div class="hsl7-card" data-band="${b.key}">
        <h4>${b.label}</h4>
        <label>Hue <input type="range" id="hsl7_${b.key}_h" min="-100" max="100" value="0" /><span id="hsl7_${b.key}_h_val">0</span></label>
        <label>Sat <input type="range" id="hsl7_${b.key}_s" min="-100" max="100" value="0" /><span id="hsl7_${b.key}_s_val">0</span></label>
        <label>Lum <input type="range" id="hsl7_${b.key}_l" min="-100" max="100" value="0" /><span id="hsl7_${b.key}_l_val">0</span></label>
      </div>
    `);
  });
  hsl7Grid.innerHTML = rows.join('');
}

function collectHsl7Values() {
  const out = {};
  HSL7_BANDS.forEach(b => {
    const h = Number(document.getElementById(`hsl7_${b.key}_h`).value);
    const s = Number(document.getElementById(`hsl7_${b.key}_s`).value);
    const l = Number(document.getElementById(`hsl7_${b.key}_l`).value);
    out[b.key] = { h, s, l };
  });
  return out;
}

function syncHsl7Input() {
  if (!hsl7Input) return;
  hsl7Input.value = JSON.stringify(collectHsl7Values());
}

function bindHsl7Events() {
  HSL7_BANDS.forEach(b => {
    ['h', 's', 'l'].forEach(k => {
      const input = document.getElementById(`hsl7_${b.key}_${k}`);
      const valueEl = document.getElementById(`hsl7_${b.key}_${k}_val`);
      const sync = () => {
        valueEl.textContent = input.value;
        syncHsl7Input();
      };
      input.addEventListener('input', sync);
      sync();
    });
  });
}

buildHsl7Controls();
bindHsl7Events();
syncHsl7Input();

// slider labels
sliders.forEach(([id, label]) => {
  const el = document.getElementById(id);
  const lab = document.getElementById(label);
  const sync = () => lab.textContent = el.value;
  el.addEventListener('input', sync);
  sync();
});

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#ff8c8c' : '#9ba7bc';
}

async function loadCapabilities() {
  if (!capInfo) return;
  try {
    const res = await fetch(`${API_BASE}/api/capabilities`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const mp = data.mediapipe ? 'on' : 'off';
    const sam = data.mobile_sam_enabled ? 'on' : 'off';
    capInfo.textContent = `Runtime: MediaPipe ${mp}, MobileSAM ${sam}`;
  } catch {
    capInfo.textContent = 'Runtime: capability info unavailable';
  }
}

async function generate() {
  if (window.location.protocol === 'file:') {
    setStatus('Please open this page via http://127.0.0.1:8000 (not file://)', true);
    return;
  }
  if (!refInput.files[0] || !srcInput.files[0]) {
    setStatus('Please choose reference and target images', true);
    return;
  }
  setStatus('Processing...');
  downloadEl.classList.add('disabled');
  const fd = new FormData();
  fd.append('reference', refInput.files[0]);
  fd.append('source', srcInput.files[0]);
  fd.append('method', methodSelect.value);
  fd.append('cinematic_enhance', cinematicEnhance && cinematicEnhance.checked ? '1' : '0');
  fd.append('cinematic_strength', document.getElementById('cinematic_strength').value);
  fd.append('color_strength', colorStrength.value);
  fd.append('tone_strength', toneStrength.value);
  fd.append('auto_xy', autoXY && autoXY.checked ? '1' : '0');
  fd.append('skin_protect', skinProtect.checked ? '1' : '0');
  fd.append('semantic_regions', semanticRegions.checked ? '1' : '0');
  fd.append('curve_points', curvePointsInput.value);
  fd.append('hsl7_json', hsl7Input ? hsl7Input.value : '{}');
  sliders.forEach(([id]) => fd.append(id, document.getElementById(id).value));

  try {
    async function doRequest(methodValue) {
      fd.set('method', methodValue);
      const response = await fetch(`${API_BASE}/api/transfer`, { method: 'POST', body: fd });
      if (response.ok) return response;

      let detail = '';
      try {
        const payload = await response.json();
        detail = payload && payload.detail ? String(payload.detail) : '';
      } catch {}

      // Backward compatibility: old backend might not support auto_best yet.
      if (methodValue === 'auto_best' && response.status === 400 && detail.toLowerCase().includes('unsupported method')) {
        return doRequest('hybrid_auto');
      }

      const msg = detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`;
      throw new Error(msg);
    }

    const res = await doRequest(methodSelect.value);
    const selectedMethod = res.headers.get('x-kinolu-selected-method');
    const autoRanking = res.headers.get('x-kinolu-auto-ranking');
    const cineOn = res.headers.get('x-kinolu-cinematic-enhance');
    const cineStrength = res.headers.get('x-kinolu-cinematic-strength');
    const xyMode = res.headers.get('x-kinolu-xy-mode');
    const usedColor = res.headers.get('x-kinolu-color-strength-used');
    const usedTone = res.headers.get('x-kinolu-tone-strength-used');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    resultPreview.src = url;
    downloadEl.href = url;
    downloadEl.classList.remove('disabled');

    if (usedColor && usedTone) {
      colorStrength.value = String(Math.round(Number(usedColor)));
      toneStrength.value = String(Math.round(Number(usedTone)));
      updatePadFromInputs();
    }

    let doneText = 'Done';
    if (methodSelect.value === 'auto_best' && selectedMethod) {
      doneText = `Done (auto_best -> ${selectedMethod})`;
      if (autoRanking) {
        const top = autoRanking.split(',').slice(0, 3).join(' | ');
        doneText += ` [${top}]`;
      }
    }
    if (xyMode === 'auto' && usedColor && usedTone) {
      doneText += ` | XY auto ${Math.round(Number(usedColor))}/${Math.round(Number(usedTone))}`;
    }
    if (cineOn === '1' && cineStrength) {
      doneText += ` | Film ${Math.round(Number(cineStrength))}`;
    }
    setStatus(doneText);
  } catch (err) {
    console.error(err);
    setStatus('Failed: ' + err.message, true);
  }
}

document.getElementById('generate').addEventListener('click', generate);
loadCapabilities();
