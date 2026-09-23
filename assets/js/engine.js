/* ------------------------------------------------------------------
   Rendering engine — pure drawing, no page state.
   Everything derives from the canvas you hand it, so the same code
   draws a 320px editor view and a 120px gallery thumbnail.
   ------------------------------------------------------------------ */

// Titles and descriptions are looked up in the active language:
// t(`char.${id}.title`) / t(`char.${id}.desc`) — see locales/*.js
const CHARACTERISTICS = [
  { id: 'identity' },
  { id: 'expression' },
  { id: 'sex' },
  { id: 'romantic' },
  { id: 'sexual' }
];

const VIRIDIS = [
  [68, 1, 84], [72, 35, 116], [64, 67, 135], [52, 94, 141],
  [41, 120, 142], [32, 144, 140], [34, 168, 132], [68, 191, 112],
  [122, 209, 81], [189, 223, 38], [253, 231, 37]
];

// Standard matplotlib "inferno" reference stops, 9-point approximation.
const INFERNO = [
  [0, 0, 4], [27, 12, 66], [75, 12, 107], [120, 28, 109],
  [165, 44, 96], [207, 68, 70], [237, 105, 37], [251, 155, 6], [252, 255, 164]
];

function sampleColormap(val, palette) {
  val = Math.max(0, Math.min(1, val));
  const idx = val * (palette.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  if (i >= palette.length - 1) return palette[palette.length - 1];
  const c1 = palette[i], c2 = palette[i + 1];
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

function generateDensityHeatmap(geo, peaks, palette) {
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
      const rgb = sampleColormap(density, palette);
      data[i++] = rgb[0]; data[i++] = rgb[1]; data[i++] = rgb[2]; data[i++] = 255;
    }
  }
  surface.ctx.putImageData(surface.img, 0, 0);
  return surface.canvas;
}

/* Draw one characteristic's peaks onto any canvas.
   opts.labels  — draw the Masc/Fem/Other axis labels (off for thumbnails/overlays)
   opts.grid    — draw the faint reference rings (off for overlays, so the dimmed
                  base's grid shows through instead of a doubled-up ring)
   opts.palette — VIRIDIS (default) or INFERNO; also used for the blob's pre-fill */
function renderShape(canvas, peaks, opts = {}) {
  if (!canvas) return;
  const showLabels = opts.labels !== false;
  const showGrid = opts.grid !== false;
  const palette = opts.palette || VIRIDIS;
  const size = canvas.width;
  const geo = geometryFor(size);
  const { cx, cy, r } = geo;
  const ctx = canvas.getContext('2d');
  peaks = peaks || [];

  ctx.clearRect(0, 0, size, size);

  if (showGrid) {
    // faint inner reference rings — fine if the data fill covers part of these
    [0.33, 0.66].forEach(level => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * level, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  const maxM = Math.max(...peaks.map(s => s.masc), 0);
  const maxF = Math.max(...peaks.map(s => s.fem), 0);
  const maxO = Math.max(...peaks.map(s => s.otro), 0);

  if (maxM > 0 || maxF > 0 || maxO > 0) {
    const blobPath = createBlobPath(geo, maxM, maxF, maxO);
    const heat = generateDensityHeatmap(geo, peaks, palette);
    const [lr, lg, lb] = palette[0];

    ctx.save();
    ctx.clip(blobPath);
    ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
    ctx.fill(blobPath);
    ctx.drawImage(heat, 0, 0);
    ctx.restore();

    ctx.lineWidth = Math.max(1, size / 128);
    ctx.strokeStyle = 'rgba(217,119,6,0.9)';
    ctx.stroke(blobPath);
  }

  // Outer limit ring — drawn last, on top of the fill, so it's always a
  // complete unbroken circle rather than getting painted over wherever the
  // data reaches the edge. Amber reads on both the pale editor background
  // and the dark world-view backgrounds.
  if (showGrid) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(217,119,6,0.35)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  if (showLabels) {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2563eb'; ctx.fillText(t('canvas.masc'), cx, cy - r - 12);
    ctx.fillStyle = '#ec4899'; ctx.fillText(t('canvas.fem'), cx + r * 0.866 + 18, cy + r * 0.5 + 16);
    ctx.fillStyle = '#10b981'; ctx.fillText(t('canvas.other'), cx - r * 0.866 - 18, cy + r * 0.5 + 16);
  }
}

/* ------------------------------------------------------------------
   "The world" view: pools everyone's peaks for a given set of
   dimensions into one shape. Each peak's weight is divided by
   (dimensions × people) so the picture stays readable regardless of
   how many people have saved a shape — otherwise density saturates
   solid within a handful of entries and all contrast is lost.
   ------------------------------------------------------------------ */
function renderPooledView(canvas, records, dimIds, palette) {
  const n = records.length;
  const all = [];
  if (n > 0) {
    records.forEach(rec => {
      dimIds.forEach(dimId => {
        (rec.shape?.[dimId] || []).forEach(p => {
          all.push({ ...p, freq: p.freq / (dimIds.length * n) });
        });
      });
    });
  }
  renderShape(canvas, all, { labels: true, palette });
}

/* A single person's own pool for a dimension group, at full (undivided)
   weight — used for the hover highlight, where we want just their
   contribution shown at its natural strength, not diluted by the crowd. */
function personPool(record, dimIds) {
  const peaks = [];
  dimIds.forEach(dimId => {
    (record.shape?.[dimId] || []).forEach(p => {
      peaks.push({ ...p, freq: p.freq / dimIds.length });
    });
  });
  return peaks;
}