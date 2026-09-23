/* ------------------------------------------------------------------
   The sculpture: a translucent cylinder with one floor per dimension,
   in the same order as CHARACTERISTICS (floor 1 = bottom … floor 5 = top).

   - The floor being edited is drawn opaque; the others are dimmed.
   - Each floor is a *snapshot*: it only takes the current shape when
     commit(i, peaks) is called (the editor does this when you leave a
     dimension tab), so it does NOT follow the sliders live.
   - A single animated value, `cursor`, is the (fractional) floor being
     looked at. Every floor's opacity is derived from its distance to the
     cursor, so switching tabs makes the highlight glide up or down the
     cylinder and light up the floors it passes.

   The state lives in this module (not in the DOM), because the editor
   rebuilds its canvas on every tab change / language change: attach() just
   points the same state at the new canvas.

   Camera: fixed oblique view drawn with plain 2D-canvas ellipses.
   Everything is derived from the constants below, so the tilt, spacing or
   radius are one-line changes.
   ------------------------------------------------------------------ */

const Sculpture = (function () {
  'use strict';

  const W = 320, H = 320;          // logical drawing size (CSS scales it)
  const CX = 146;                  // cylinder axis, x
  const R = 92;                    // radius
  const RY = R * 0.36;             // vertical radius of the ellipses (camera tilt)
  const GAP = 44;                  // distance between floors
  const PAD = 26;                  // glass extending beyond the first / last floor
  const BASE_Y = 249;              // y of floor 1
  const DIM = 0.22;                // opacity of a floor that isn't being edited
  const TEX = 320;                 // snapshot resolution (same as the editor canvas)
  const TAU = Math.PI * 2;
  const INK = '32,35,43';
  const AMBER = '217,119,6';
  const FONT = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const s = {
    canvas: null, ctx: null,
    cursor: 0, from: 0, target: 0, t0: 0, dur: 0, raf: 0,
    tex: [],        // per-floor snapshot canvases
    ok: []          // per-floor: has a snapshot been committed?
  };

  const count  = () => CHARACTERISTICS.length;
  const yOf    = i => BASE_Y - i * GAP;
  const weight = i => Math.max(0, 1 - Math.abs(s.cursor - i));   // 1 on the cursor floor → 0 a floor away
  const reducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- drawing ---------- */
  function drawBody(ctx, yTop, yBot) {
    const g = ctx.createLinearGradient(CX - R, 0, CX + R, 0);
    g.addColorStop(0, 'rgba(96,110,140,0.18)');
    g.addColorStop(0.5, 'rgba(96,110,140,0.05)');
    g.addColorStop(1, 'rgba(96,110,140,0.15)');
    ctx.beginPath();                         // one path, so overlaps aren't tinted twice
    ctx.rect(CX - R, yTop, 2 * R, yBot - yTop);
    ctx.ellipse(CX, yTop, R, RY, 0, 0, TAU);
    ctx.ellipse(CX, yBot, R, RY, 0, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function drawOutline(ctx, yTop, yBot) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(${INK},0.5)`;
    ctx.beginPath();
    ctx.moveTo(CX - R, yTop); ctx.lineTo(CX - R, yBot);
    ctx.moveTo(CX + R, yTop); ctx.lineTo(CX + R, yBot);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(CX, yTop, R, RY, 0, 0, TAU); ctx.stroke();      // top rim
    ctx.beginPath(); ctx.ellipse(CX, yBot, R, RY, 0, 0, Math.PI); ctx.stroke();  // base, front

    ctx.setLineDash([3, 4]);                                                     // base, hidden back edge
    ctx.strokeStyle = `rgba(${INK},0.22)`;
    ctx.beginPath(); ctx.ellipse(CX, yBot, R, RY, 0, Math.PI, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFloor(ctx, i) {
    const w = weight(i);
    const a = DIM + (1 - DIM) * w;
    const y = yOf(i);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(CX, y, R, RY, 0, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.85 * w})`;   // the "opaque" disc
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.strokeStyle = `rgba(0,0,0,${0.03 + 0.03 * w})`;        // same faint rings as the editor canvas
    ctx.lineWidth = 1;
    [0.33, 0.66].forEach(k => {
      ctx.beginPath(); ctx.ellipse(CX, y, R * k, RY * k, 0, 0, TAU); ctx.stroke();
    });
    if (s.ok[i]) {
      // The snapshot is a full editor canvas; cut out just the circle and
      // squash it into the floor's ellipse.
      const geo = geometryFor(TEX);
      const m = geo.r * 1.04;
      ctx.globalAlpha = a;
      ctx.drawImage(s.tex[i], geo.cx - m, geo.cy - m, 2 * m, 2 * m, CX - R, y - RY, 2 * R, 2 * RY);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(CX, y, R, RY, 0, 0, TAU);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${INK},${0.14 + 0.4 * w})`;
    ctx.stroke();
    if (w > 0.02) {                                             // amber rim on the floor being edited
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(${AMBER},${0.9 * w})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLabels(ctx) {
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < count(); i++) {
      const w = weight(i), y = yOf(i);
      ctx.fillStyle = `rgba(${INK},${0.32 + 0.68 * w})`;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(CX + R + 3, y); ctx.lineTo(CX + R + 9, y); ctx.stroke();
      ctx.fillText(String(i + 1), CX + R + 14, y);
    }
  }

  function draw() {
    const ctx = s.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const yTop = yOf(count() - 1) - PAD;
    const yBot = yOf(0) + PAD;
    drawBody(ctx, yTop, yBot);

    // Least-highlighted first, so the floor being edited is painted last
    // and stays crisp where the ellipses overlap.
    const order = [...Array(count()).keys()].sort((a, b) => weight(a) - weight(b) || a - b);
    order.forEach(i => drawFloor(ctx, i));

    drawOutline(ctx, yTop, yBot);
    drawLabels(ctx);
  }

  /* ---------- animation ---------- */
  function step(now) {
    const k = Math.min(1, (now - s.t0) / s.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease-in-out cubic
    s.cursor = s.from + (s.target - s.from) * e;
    draw();
    s.raf = k < 1 ? requestAnimationFrame(step) : 0;
  }

  /* ---------- public API ---------- */
  return {
    /* Point the module at a (new) canvas. Keeps all state. */
    attach(canvas) {
      s.canvas = canvas;
      if (!canvas) { s.ctx = null; return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      s.ctx = canvas.getContext('2d');
      s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    },

    /* Move the highlight to floor `index`; glides unless animate is false. */
    setActive(index, animate) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.target = index;
      if (!animate || reducedMotion() || s.cursor === index) {
        s.cursor = index;
        draw();
        return;
      }
      s.from = s.cursor;
      s.t0 = performance.now();
      s.dur = 380 + 70 * Math.abs(index - s.cursor);
      s.raf = requestAnimationFrame(step);
    },

    /* Freeze the given peaks onto floor `index`. */
    commit(index, peaks) {
      if (index < 0 || index >= count()) return;
      const c = s.tex[index] || (s.tex[index] = document.createElement('canvas'));
      c.width = c.height = TEX;                    // (re)size = clear
      renderShape(c, peaks, { labels: false });
      s.ok[index] = true;
      draw();
    },

    /* Empty every floor (a brand-new shape). */
    reset() {
      s.ok = [];
      draw();
    },

    isCommitted(index) { return !!s.ok[index]; }
  };
})();
