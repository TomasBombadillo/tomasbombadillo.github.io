/* ------------------------------------------------------------------
   Editor tree viewer — the tree beside the circle canvas.

   - One persistent WebGL canvas: the editor rebuilds its DOM constantly,
     so the panel is created once and re-attached (attach / detach).
   - Two arrow buttons rotate the tree (tap = 45° step, hold = spin).
   - Same "floor snapshot" rules as before: a floor only grows its branches
     when it is committed (i.e. when you leave its tab, or on save). The floor
     being edited is drawn solid, the others fade; the highlight glides.
   - Everything animates only while something is moving (no idle GPU use).
   ------------------------------------------------------------------ */

const TreeView = (function () {
  'use strict';

  const C = TreeModel.C;
  const W = 320, H = 400;          // logical canvas size (CSS scales it)
  const DIM = 0.45;                // opacity of floors that aren't being edited
  const CAM = { fov: 28, dist: 8.9, elev: 15 * Math.PI / 180, targetY: 1.78 };
  const AMBER = 0xd97706;

  const s = {
    ready: false, failed: false, attached: false,
    panel: null, canvas: null, renderer: null, scene: null, camera: null, spin: null,
    trunkMesh: null, trunkMat: null,
    floors: [],
    trunkCur: [], trunkTar: [],
    cursor: 0, cFrom: 0, cTarget: 0, cT0: 0, cDur: 0, cMoving: false,
    rot: 0, rotTarget: 0, hold: 0,
    raf: 0, last: 0
  };

  const count = () => CHARACTERISTICS.length;
  const dimIds = () => CHARACTERISTICS.map(c => c.id);
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeOutBack = k => { const c1 = 1.1, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  /* ---------- panel (canvas + rotate arrows) ---------- */
  const ARROW = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  // arc + arrowhead; the two icons are mirror images of each other
  const ICON_CW  = ARROW('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 3.5v4.6h-4.6"/>');
  const ICON_CCW = ARROW('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M3.5 3.5v4.6h4.6"/>');

  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'tree-panel';
    panel.innerHTML = `
      <canvas class="tree-canvas" role="img" data-i18n-aria-label="tree.alt"></canvas>
      <div class="tree-controls">
        <button type="button" class="icon-btn tree-rot" data-dir="ccw"
                data-i18n-aria-label="tree.rotateCcw" data-i18n-title="tree.rotateCcw">${ICON_CCW}</button>
        <button type="button" class="icon-btn tree-rot" data-dir="cw"
                data-i18n-aria-label="tree.rotateCw" data-i18n-title="tree.rotateCw">${ICON_CW}</button>
      </div>`;
    panel.querySelectorAll('.tree-rot').forEach(bindRotate);
    return panel;
  }

  /* Clockwise seen from above = the tree's rotation.y decreasing. */
  function bindRotate(btn) {
    const dir = btn.dataset.dir === 'cw' ? -1 : 1;
    let timer = 0, holding = false, pressed = false;
    const step = () => { s.rotTarget += dir * Math.PI / 4; requestFrame(); };
    const finish = tap => {
      if (!pressed) return;
      pressed = false;
      clearTimeout(timer);
      if (holding) { holding = false; s.hold = 0; s.rotTarget = s.rot; }
      else if (tap) step();
    };
    btn.addEventListener('pointerdown', e => {
      pressed = true; holding = false;
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
      timer = setTimeout(() => { holding = true; s.hold = dir; requestFrame(); }, 260);   // hold → keep spinning
    });
    btn.addEventListener('pointerup', () => finish(true));
    btn.addEventListener('pointercancel', () => finish(false));
    btn.addEventListener('click', e => { if (e.detail === 0) step(); });                 // keyboard: Enter / Space
  }

  /* ---------- scene ---------- */
  function makeGuides(i) {
    const g = new THREE.Group();
    g.position.y = TreeModel.floorY(i);
    const flat = geo => geo.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(flat(new THREE.CircleGeometry(C.R, 48)),
      new THREE.MeshBasicMaterial({ color: 0xd9e2f0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    const ring = new THREE.Mesh(flat(new THREE.RingGeometry(C.R * 0.975, C.R, 72)),
      new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));

    // Three spokes: Masc (away), Fem (front-right), Other (front-left), in their colours.
    const pos = [], col = [];
    [['masc', -Math.PI / 2], ['fem', Math.PI / 6], ['otro', 5 * Math.PI / 6]].forEach(([k, ang]) => {
      const c = new THREE.Color(TreeModel.BASE_COLORS[k]);
      pos.push(0, 0, 0, Math.cos(ang) * C.R, 0, Math.sin(ang) * C.R);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const spokes = new THREE.LineSegments(sg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.15, depthWrite: false }));

    g.add(disc, spokes, ring);
    return { group: g, disc, ring, spokes };
  }

  function init() {
    if (s.ready) return true;
    if (s.failed) return false;
    try {
      s.panel = buildPanel();
      s.canvas = s.panel.querySelector('canvas');
      s.renderer = new THREE.WebGLRenderer({ canvas: s.canvas, antialias: true, alpha: true });
    } catch (err) {
      console.warn('WebGL is not available — the tree is disabled.', err);
      s.failed = true;
      return false;
    }
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    s.renderer.setSize(W, H, false);
    s.renderer.setClearColor(0x000000, 0);

    s.scene = new THREE.Scene();
    TreeGeometry.addLights(s.scene);
    s.camera = new THREE.PerspectiveCamera(CAM.fov, W / H, 0.1, 60);
    s.camera.position.set(0, CAM.targetY + CAM.dist * Math.sin(CAM.elev), CAM.dist * Math.cos(CAM.elev));
    s.camera.lookAt(0, CAM.targetY, 0);

    s.spin = new THREE.Group();
    s.scene.add(s.spin);

    const base = TreeGeometry.baseGeometries();
    s.spin.add(new THREE.Mesh(base.flare, TreeGeometry.woodMaterial()));
    s.spin.add(new THREE.Mesh(base.pedestal, TreeGeometry.earthMaterial()));

    for (let i = 0; i < count(); i++) {
      s.trunkCur[i] = { x: 0, z: 0 };
      s.trunkTar[i] = { x: 0, z: 0 };
    }
    s.trunkMat = TreeGeometry.woodMaterial();
    s.trunkMesh = new THREE.Mesh(TreeGeometry.trunkGeometry(TreeModel.spineFor(s.trunkCur)), s.trunkMat);
    s.spin.add(s.trunkMesh);

    for (let i = 0; i < count(); i++) {
      const guides = makeGuides(i);
      s.spin.add(guides.group);
      const group = new THREE.Group();                  // origin = this floor's trunk point
      group.position.set(0, TreeModel.floorY(i), 0);
      s.spin.add(group);
      s.floors.push({
        sig: null, group, guides, wood: null, leaves: null, grow: null,
        woodMat: TreeGeometry.woodMaterial(), leafMat: TreeGeometry.leafMaterial()
      });
    }

    s.spin.add(TreeGeometry.glassMesh());
    s.ready = true;
    return true;
  }

  /* ---------- per-frame look ---------- */
  const weight = i => Math.max(0, 1 - Math.abs(s.cursor - i));

  function applyLook() {
    s.floors.forEach((f, i) => {
      const w = weight(i);
      const a = DIM + (1 - DIM) * w;
      TreeGeometry.setOpacity(f.woodMat, a);
      TreeGeometry.setOpacity(f.leafMat, a);
      f.guides.disc.material.opacity = 0.05 + 0.32 * w;
      f.guides.ring.material.opacity = 0.2 + 0.75 * w;
      f.guides.spokes.material.opacity = 0.12 + 0.45 * w;
    });
  }

  function rebuildTrunk() {
    s.trunkMesh.geometry.dispose();
    s.trunkMesh.geometry = TreeGeometry.trunkGeometry(TreeModel.spineFor(s.trunkCur));
    s.floors.forEach((f, i) => f.group.position.set(s.trunkCur[i].x, TreeModel.floorY(i), s.trunkCur[i].z));
  }

  function frame(now) {
    s.raf = 0;
    const dt = Math.min(0.05, s.last ? (now - s.last) / 1000 : 0.016);
    s.last = now;
    let busy = false;

    // rotation: continuous while an arrow is held, otherwise ease to the target step
    if (s.hold) {
      s.rot += s.hold * 1.6 * dt; s.rotTarget = s.rot; busy = true;
    } else if (Math.abs(s.rotTarget - s.rot) > 0.0008) {
      s.rot += (s.rotTarget - s.rot) * (1 - Math.exp(-dt * 9)); busy = true;
    } else {
      s.rot = s.rotTarget;
    }
    s.spin.rotation.y = s.rot;

    // highlight glides between floors
    if (s.cMoving) {
      const k = Math.min(1, (now - s.cT0) / s.cDur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      s.cursor = s.cFrom + (s.cTarget - s.cFrom) * e;
      if (k >= 1) s.cMoving = false; else busy = true;
    }

    // trunk bends towards its new floor positions
    let bending = false;
    for (let i = 0; i < count(); i++) {
      const c = s.trunkCur[i], t = s.trunkTar[i];
      const dx = t.x - c.x, dz = t.z - c.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.0008) {
        const k = 1 - Math.exp(-dt * 7);
        c.x += dx * k; c.z += dz * k; bending = true;
      } else if (dx || dz) { c.x = t.x; c.z = t.z; bending = true; }
    }
    if (bending) { rebuildTrunk(); busy = true; }

    // branches & leaves grow out of the trunk
    s.floors.forEach(f => {
      if (!f.grow) return;
      const k = Math.min(1, Math.max(0, (now - f.grow.t0) / f.grow.dur));
      f.group.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      if (k >= 1) { f.group.scale.setScalar(1); f.grow = null; } else busy = true;
    });

    applyLook();
    s.renderer.render(s.scene, s.camera);
    if (busy) s.raf = requestAnimationFrame(frame); else s.last = 0;
  }

  function requestFrame() {
    if (!s.ready || !s.attached || s.raf) return;
    s.raf = requestAnimationFrame(frame);
  }

  /* ---------- floors ---------- */
  function applyFloor(i, peaks, delay) {
    const f = s.floors[i];
    const sig = TreeModel.signature(peaks);
    if (f.sig === sig) return;                        // unchanged → nothing to regrow
    f.sig = sig;

    const layout = TreeModel.layoutFloor(peaks, i);
    const geo = TreeGeometry.floorGeometries(layout);
    if (f.wood) { f.group.remove(f.wood); f.wood.geometry.dispose(); f.wood = null; }
    if (f.leaves) { f.group.remove(f.leaves); f.leaves.geometry.dispose(); f.leaves = null; }
    if (geo.wood) { f.wood = new THREE.Mesh(geo.wood, f.woodMat); f.group.add(f.wood); }
    if (geo.leaves) { f.leaves = new THREE.Mesh(geo.leaves, f.leafMat); f.group.add(f.leaves); }

    s.trunkTar[i] = { x: layout.trunk.x, z: layout.trunk.z };
    if (reducedMotion()) {
      s.trunkCur[i] = { x: layout.trunk.x, z: layout.trunk.z };
      rebuildTrunk();
      f.group.scale.setScalar(1);
    } else {
      f.grow = { t0: performance.now() + delay, dur: 850 };
      f.group.scale.setScalar(0.001);
    }
    requestFrame();
  }

  /* ---------- public API ---------- */
  return {
    /* Put the panel into `slot` (an element in the editor). false = no WebGL. */
    attach(slot) {
      if (!init()) return false;
      slot.appendChild(s.panel);
      s.attached = true;
      applyTranslations(s.panel);
      requestFrame();
      return true;
    },

    /* Take the panel out of the page (the editor is about to rebuild its DOM). */
    detach() {
      s.attached = false;
      cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0;
      if (s.panel && s.panel.parentNode) s.panel.parentNode.removeChild(s.panel);
    },

    /* Give every floor its branches from a whole shape { dimId: [peaks] }. */
    setShape(shape) {
      if (!init()) return;
      dimIds().forEach((id, i) => applyFloor(i, (shape && shape[id]) || [], i * 170));
    },

    /* The floor being left takes its snapshot. */
    commitFloor(index, peaks) {
      if (!s.ready) return;
      applyFloor(index, peaks || [], 0);
    },

    /* Highlight floor `index`; glides unless animate is false. */
    setActive(index, animate) {
      s.cTarget = index;
      if (!animate || reducedMotion() || s.cursor === index) {
        s.cMoving = false; s.cursor = index;
        if (s.ready && s.attached) { applyLook(); s.renderer.render(s.scene, s.camera); }
        return;
      }
      s.cFrom = s.cursor; s.cT0 = performance.now();
      s.cDur = 380 + 70 * Math.abs(index - s.cursor);
      s.cMoving = true;
      requestFrame();
    }
  };
})();
