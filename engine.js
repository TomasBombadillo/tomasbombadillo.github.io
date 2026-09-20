/* ------------------------------------------------------------------
   Rendering engine — pure drawing, no page state.
   Everything derives from the canvas you hand it, so the same code
   draws a 320px editor view and a 120px gallery thumbnail.
   ------------------------------------------------------------------ */

const CHARACTERISTICS = [
  { id: 'identity',   title: 'Gender Identity',    desc: 'Internal sense of self' },
  { id: 'expression', title: 'Gender Expression',  desc: 'Outward presentation and behavior' },
  { id: 'sex',        title: 'Anatomical Sex',     desc: 'Physical traits and sex characteristics' },
  { id: 'romantic',   title: 'Romantic Attraction',desc: 'Direction of romantic desires' },
  { id: 'sexual',     title: 'Sexual Attraction',  desc: 'Direction of physical/sexual desires' }
];

const VIRIDIS = [
  [68, 1, 84], [72, 35, 116], [64, 67, 135], [52, 94, 141],
  [41, 120, 142], [32, 144, 140], [34, 168, 132], [68, 191, 112],
  [122, 209, 81], [189, 223, 38], [253, 231, 37]
];

function getViridisColor(val) {
  val = Math.max(0, Math.min(1, val));
  const idx = val * (VIRIDIS.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  if (i >= VIRIDIS.length - 1) return VIRIDIS[VIRIDIS.length - 1];
  const c1 = VIRIDIS[i], c2 = VIRIDIS[i + 1];
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * f),
    Math.round(c1[1] + (c2[1] - c1[1]) * f),
    Math.round(c1[2] + (c2[2] - c1[2]) * f)
  ];
}

// Geometry scales with canvas size (matches the original 320/160/170/110 ratios)
function geometryFor(size) {
  return { size, cx: size / 2, cy: size * 0.531, r: size * 0.344 };
}

// Offscreen canvases are reused per size so thumbnails don't thrash the GC
const heatCache = new Map();
function heatSurfaceFor(size) {
  if (!heatCache.has(size)) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    heatCache.set(size, { canvas: c, ctx, img: ctx.createImageData(size, size) });
  }
  return heatCache.get(size);
}

function createBlobPath(geo, maxM, maxF, maxO) {
  const K = 0.769800358;       // bezier constant for 120° arcs
  const SQRT3_2 = 0.8660254;
  const HALF = 0.5;
  const { cx, cy, r } = geo;

  const rM = r * (maxM / 100);
  const rF = r * (maxF / 100);
  const rO = r * (maxO / 100);

  const path = new Path2D();
  if (maxM === 0 && maxF === 0 && maxO === 0) {
    path.arc(cx, cy, 1, 0, Math.PI * 2);
    return path;
  }

  const pM = { x: cx, y: cy - rM };
  const pF = { x: cx + rF * SQRT3_2, y: cy + rF * HALF };
  const pO = { x: cx - rO * SQRT3_2, y: cy + rO * HALF };

  path.moveTo(pM.x, pM.y);
  path.bezierCurveTo(pM.x + rM * K, pM.y, pF.x + rF * K * HALF, pF.y - rF * K * SQRT3_2, pF.x, pF.y);
  path.bezierCurveTo(pF.x - rF * K * HALF, pF.y + rF * K * SQRT3_2, pO.x + rO * K * HALF, pO.y + rO * K * SQRT3_2, pO.x, pO.y);
  path.bezierCurveTo(pO.x - rO * K * HALF, pO.y - rO * K * SQRT3_2, pM.x - rM * K, pM.y, pM.x, pM.y);
  return path;
}

function generateDensityHeatmap(geo, peaks) {
  const { size, cx, cy, r } = geo;
  const surface = heatSurfaceFor(size);
  const data = surface.img.data;

  const peakData = peaks.map(p => {
    const sum = p.masc + p.fem + p.otro;
    const maxV = Math.max(p.masc, p.fem, p.otro);
    let px = cx, py = cy;
    if (maxV > 0 && sum > 0) {
      const wM = p.masc / sum, wF = p.fem / sum, wO = p.otro / sum;
      const vx = wF * 0.866025 + wO * -0.866025;
      const vy = wM * -1 + wF * 0.5 + wO * 0.5;
      const rad = r * (maxV / 100);
      px = cx + rad * vx;
      py = cy + rad * vy;
    }
    return { x: px, y: py, weight: p.freq / 100 };
  });

  const SIGMA = size * 0.0875;           // 28px at 320, scales down for thumbs
  const TWO_SIGMA_SQ = 2 * SIGMA * SIGMA;

  let i = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let density = 0;
      for (const p of peakData) {
        if (p.weight === 0) continue;
        const dx = x - p.x, dy = y - p.y;
        density += p.weight * Math.exp(-(dx * dx + dy * dy) / TWO_SIGMA_SQ);
      }
      density = Math.min(1, density * 1.5);
      const rgb = getViridisColor(density);
      data[i++] = rgb[0]; data[i++] = rgb[1]; data[i++] = rgb[2]; data[i++] = 255;
    }
  }
  surface.ctx.putImageData(surface.img, 0, 0);
  return surface.canvas;
}

/* Draw one characteristic's peaks onto any canvas.
   opts.labels — draw the Masc/Fem/Other axis labels (off for thumbnails) */
function renderShape(canvas, peaks, opts = {}) {
  if (!canvas) return;
  const showLabels = opts.labels !== false;
  const size = canvas.width;
  const geo = geometryFor(size);
  const { cx, cy, r } = geo;
  const ctx = canvas.getContext('2d');
  peaks = peaks || [];

  ctx.clearRect(0, 0, size, size);

  // grid
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  [0.33, 0.66].forEach(level => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * level, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.stroke();
  });

  const maxM = Math.max(...peaks.map(s => s.masc), 0);
  const maxF = Math.max(...peaks.map(s => s.fem), 0);
  const maxO = Math.max(...peaks.map(s => s.otro), 0);

  if (maxM > 0 || maxF > 0 || maxO > 0) {
    const blobPath = createBlobPath(geo, maxM, maxF, maxO);
    const heat = generateDensityHeatmap(geo, peaks);

    ctx.save();
    ctx.clip(blobPath);
    ctx.fillStyle = '#440154';
    ctx.fill(blobPath);
    ctx.drawImage(heat, 0, 0);
    ctx.restore();

    ctx.lineWidth = Math.max(1, size / 128);
    ctx.strokeStyle = 'rgba(217,119,6,0.9)';
    ctx.stroke(blobPath);
  }

  if (showLabels) {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2563eb'; ctx.fillText('Masc', cx, cy - r - 12);
    ctx.fillStyle = '#ec4899'; ctx.fillText('Fem', cx + r * 0.866 + 18, cy + r * 0.5 + 16);
    ctx.fillStyle = '#10b981'; ctx.fillText('Other', cx - r * 0.866 - 18, cy + r * 0.5 + 16);
  }
}

/* ------------------------------------------------------------------
   Gallery thumbnail variants — three different takes on "one icon per
   person," swappable at runtime for comparison. See engine.js callers.
   ------------------------------------------------------------------ */

// A) Only the Identity dimension, unmodified — the one canonical view.
function renderIdentityThumb(canvas, shape) {
  renderShape(canvas, shape?.identity || [], { labels: false });
}

// B) One small dot per dimension. Each dot's color is a freq-weighted
//    blend of that dimension's masc/fem/otro peaks — no shape, just a hue.
const DOT_COLORS = { masc: [37, 99, 235], fem: [236, 72, 153], otro: [16, 185, 129] };

function dimensionBlendColor(peaks) {
  if (!peaks || !peaks.length) return 'rgba(0,0,0,0.12)';
  let wSum = 0, m = 0, f = 0, o = 0;
  peaks.forEach(p => {
    const w = Math.max(0.001, p.freq || 0);
    m += p.masc * w; f += p.fem * w; o += p.otro * w; wSum += w;
  });
  if (wSum === 0) return 'rgba(0,0,0,0.12)';
  m /= wSum; f /= wSum; o /= wSum;
  const total = m + f + o;
  if (total === 0) return 'rgba(0,0,0,0.12)';
  const r = (DOT_COLORS.masc[0] * m + DOT_COLORS.fem[0] * f + DOT_COLORS.otro[0] * o) / total;
  const g = (DOT_COLORS.masc[1] * m + DOT_COLORS.fem[1] * f + DOT_COLORS.otro[1] * o) / total;
  const b = (DOT_COLORS.masc[2] * m + DOT_COLORS.fem[2] * f + DOT_COLORS.otro[2] * o) / total;
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function renderDotStrip(canvas, shape) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  const n = CHARACTERISTICS.length;
  const dotR = size * 0.09;
  const gap = size / (n + 1);
  CHARACTERISTICS.forEach((c, i) => {
    const cx = gap * (i + 1);
    const cy = size / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = dimensionBlendColor(shape?.[c.id]);
    ctx.fill();
  });
}

// C) Composite of just Identity + Expression — the two "self" dimensions,
//    leaving attraction and anatomy out of the icon.
function renderComposite2Thumb(canvas, shape) {
  const dims = ['identity', 'expression'];
  const all = [];
  dims.forEach(id => {
    (shape?.[id] || []).forEach(p => all.push({ ...p, freq: p.freq / dims.length }));
  });
  renderShape(canvas, all, { labels: false });
}

const THUMB_RENDERERS = {
  identity: renderIdentityThumb,
  dots: renderDotStrip,
  composite2: renderComposite2Thumb
};