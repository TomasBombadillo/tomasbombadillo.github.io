/* ------------------------------------------------------------------
   The forest — every saved tree in one scene.

   - Trees sit on a sunflower spiral in the order they were planted, so a new
     tree always goes on the outside and nobody's tree moves. The ground and
     the camera widen smoothly as the forest grows.
   - Each tree is baked into two meshes (wood + leaves), so hundreds of trees
     stay cheap. They are built a few per frame and grow in as they appear.
   - highlight(id) dims every other tree and brings that one forward
     (used when hovering a name in the list).
   ------------------------------------------------------------------ */

const Forest = (function () {
  'use strict';

  const SPACING = 1.55;            // distance scale between trees
  const TREE_SCALE = 0.55;         // a forest tree is smaller than the editor tree
  const DIM_ALPHA = 0.16;          // opacity of the trees that aren't highlighted
  const GOLDEN = 2.399963229728653;
  const ELEV = 27 * Math.PI / 180;

  const s = {
    ready: false, failed: false, running: false,
    canvas: null, renderer: null, scene: null, camera: null, ground: null, ring: null,
    shell: null, shellId: null, shellAlpha: 0, shellTarget: 0,   // butterflies around the hovered tree
    trees: new Map(),        // id → tree
    queue: [],               // trees waiting to be built
    hi: null,                // highlighted id
    az: 0.6, spin: 1,        // camera azimuth; 1 = turning, 0 = paused (while hovering)
    dist: 6, distTar: 6, groundR: 3, groundTar: 3,
    raf: 0, last: 0, w: 0, h: 0, ro: null
  };

  const dimIds = () => CHARACTERISTICS.map(c => c.id);
  const easeOutBack = k => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  function hashId(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }
  function sigOf(shape) {
    return dimIds().map(id => TreeModel.signature(shape && shape[id])).join('|');
  }
  function groundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(88,128,84,0.92)');
    g.addColorStop(0.65, 'rgba(62,98,66,0.72)');
    g.addColorStop(1, 'rgba(40,70,52,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function init(canvas) {
    if (s.ready) return true;
    if (s.failed) return false;
    try {
      s.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
      console.warn('WebGL is not available — the forest is disabled.', err);
      s.failed = true;
      return false;
    }
    s.canvas = canvas;
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    s.renderer.setClearColor(0x000000, 0);

    s.scene = new THREE.Scene();
    TreeGeometry.addLights(s.scene);
    s.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);

    s.ground = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: groundTexture(), transparent: true, depthWrite: false }));
    s.ground.position.y = -0.01;
    s.scene.add(s.ground);

    s.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.74, 0.82, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    s.ring.position.y = 0.005;
    s.ring.scale.setScalar(TREE_SCALE);
    s.ring.visible = false;
    s.scene.add(s.ring);

    // Butterflies (and only butterflies — no glass) that appear around the hovered tree.
    s.shell = TreeGeometry.butterflyShell();
    s.shell.visible = false;
    s.shell.scale.setScalar(TREE_SCALE);
    s.scene.add(s.shell);

    s.ro = new ResizeObserver(resize);
    s.ro.observe(canvas);
    s.ready = true;
    return true;
  }

  function resize() {
    const w = s.canvas.clientWidth, h = s.canvas.clientHeight;
    if (!w || !h || (w === s.w && h === s.h)) return;
    s.w = w; s.h = h;
    s.renderer.setSize(w, h, false);
    s.camera.aspect = w / h;
    // On wide screens the names list sits on the right: slide the forest left so it never hides behind it.
    const shift = w > 760 ? Math.min(140, w * 0.09) : 0;
    if (shift) s.camera.setViewOffset(w, h, shift, 0, w, h); else s.camera.clearViewOffset();
    s.camera.updateProjectionMatrix();
  }

  /* ---------- trees ---------- */
  function place(t) {
    const r = SPACING * Math.sqrt(t.index), a = t.index * GOLDEN;
    t.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  }

  function build({ rec, idx, sig }) {
    const geo = TreeGeometry.staticTree(rec.shape, dimIds());
    const t = {
      id: rec.id, index: idx, sig,
      group: new THREE.Group(),
      woodMat: TreeGeometry.woodMaterial(), leafMat: TreeGeometry.leafMaterial(),
      alpha: 1, target: 1,
      grow: { t0: performance.now(), dur: 900 }
    };
    t.group.add(new THREE.Mesh(geo.wood, t.woodMat));
    if (geo.leaves) t.group.add(new THREE.Mesh(geo.leaves, t.leafMat));
    t.group.rotation.y = hashId(rec.id) * Math.PI * 2;      // every tree faces its own way
    t.group.scale.setScalar(0.001);
    place(t);
    s.scene.add(t.group);
    s.trees.set(rec.id, t);
    applyHighlightTo(t);
  }

  function remove(t) {
    s.scene.remove(t.group);
    t.group.children.forEach(m => m.geometry.dispose());
    t.woodMat.dispose(); t.leafMat.dispose();
    s.trees.delete(t.id);
  }

  function applyHighlightTo(t) {
    t.target = s.hi == null || s.hi === t.id ? 1 : DIM_ALPHA;
  }

  function processQueue() {
    const t0 = performance.now();
    while (s.queue.length && performance.now() - t0 < 9) build(s.queue.shift());   // a few per frame
  }

  /* ---------- loop ---------- */
  function frame(now) {
    s.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, s.last ? (now - s.last) / 1000 : 0.016);
    s.last = now;

    resize();
    processQueue();

    // camera: slow turn (paused while a name is hovered), pulls back as the forest widens
    s.spin += ((s.hi == null ? 1 : 0) - s.spin) * (1 - Math.exp(-dt * 4));
    s.az += 0.045 * s.spin * dt;
    const k = 1 - Math.exp(-dt * 2.2);
    s.dist += (s.distTar - s.dist) * k;
    s.groundR += (s.groundTar - s.groundR) * k;
    s.ground.scale.setScalar(s.groundR);
    const cy = 0.95;
    s.camera.position.set(Math.sin(s.az) * Math.cos(ELEV) * s.dist, cy + Math.sin(ELEV) * s.dist, Math.cos(s.az) * Math.cos(ELEV) * s.dist);
    s.camera.lookAt(0, cy, 0);

    s.trees.forEach(t => {
      t.alpha += (t.target - t.alpha) * (1 - Math.exp(-dt * 9));
      TreeGeometry.setOpacity(t.woodMat, t.alpha);
      TreeGeometry.setOpacity(t.leafMat, t.alpha);
      let sc = TREE_SCALE;
      if (t.grow) {
        const g = Math.min(1, (now - t.grow.t0) / t.grow.dur);
        sc *= Math.max(0.001, easeOutBack(g));
        if (g >= 1) t.grow = null;
      }
      t.group.scale.setScalar(sc);
    });

    // Ring + butterflies follow the highlighted tree (even if it was only just built).
    const ht = s.hi != null ? s.trees.get(s.hi) : null;
    s.ring.visible = !!ht;
    if (ht) s.ring.position.set(ht.group.position.x, 0.005, ht.group.position.z);

    s.shellAlpha += (s.shellTarget - s.shellAlpha) * (1 - Math.exp(-dt * 7));
    if (Math.abs(s.shellTarget - s.shellAlpha) < 0.01) s.shellAlpha = s.shellTarget;
    s.shell.material.opacity = s.shellAlpha;
    s.shell.visible = s.shellAlpha > 0.01;
    const st = s.shellId != null ? s.trees.get(s.shellId) : null;
    if (st) s.shell.position.set(st.group.position.x, 0, st.group.position.z);

    s.renderer.render(s.scene, s.camera);
  }

  /* ---------- public API ---------- */
  return {
    /* records: [{ id, shape }] in the order the trees were planted. */
    setRecords(records) {
      if (!s.ready) return;
      const keep = new Set(records.map(r => r.id));
      s.trees.forEach(t => { if (!keep.has(t.id)) remove(t); });
      s.queue = s.queue.filter(q => keep.has(q.rec.id));

      records.forEach((rec, idx) => {
        const sig = sigOf(rec.shape);
        const t = s.trees.get(rec.id);
        if (t && t.sig === sig) { t.index = idx; place(t); return; }
        if (t) remove(t);
        const queued = s.queue.findIndex(q => q.rec.id === rec.id);
        if (queued >= 0) s.queue.splice(queued, 1);
        s.queue.push({ rec, idx, sig });
      });

      const radius = SPACING * Math.sqrt(Math.max(0, records.length - 1));   // distance of the outermost tree
      s.groundTar = radius + 2.6;
      s.distTar = Math.max(6.2, radius * 2.15 + 3.6);
    },

    /* Bring one tree forward and dim the rest; null clears it. While a tree is
       highlighted its butterflies flutter in (still, not moving) around it;
       when the highlight goes, they fade away again. */
    highlight(id) {
      s.hi = id;
      s.trees.forEach(applyHighlightTo);
      if (id != null) {
        if (s.shellId !== id) { s.shellId = id; s.shellAlpha = 0; }   // new tree → start from invisible
        s.shellTarget = 1;
      } else {
        s.shellTarget = 0;                                            // keep the position until they've faded
      }
    },

    /* Start drawing into `canvas` (call when the forest view opens). */
    start(canvas) {
      if (!init(canvas)) return false;
      if (!s.running) {
        s.running = true;
        s.last = 0;
        s.raf = requestAnimationFrame(frame);
      }
      return true;
    },

    /* Stop drawing (call when leaving the view). Trees stay in memory. */
    stop() {
      s.running = false;
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    },

    get failed() { return s.failed; }
  };
})();
