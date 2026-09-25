/* ------------------------------------------------------------------
   Tree geometry — turns the TreeModel layout into three.js geometry.
   Low-poly look: flat shading, few radial segments, plain brown wood,
   leaf-textured spheres, and a glass cylinder printed with butterflies.
   Shared by the editor view and the forest view.
   ------------------------------------------------------------------ */

const TreeGeometry = (function () {
  'use strict';

  const C = TreeModel.C;
  const WOOD = 0x8b5a2b;
  const EARTH = 0x6d4526;
  const RADIAL = 6;              // sides of every branch → the "poly" look
  const LEAF_TILE = 0.7;         // world size covered by one leaf-texture tile

  /* Deterministic random numbers, so everyone gets the same leaves & butterflies. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- materials ---------- */
  function woodMaterial(opts) {
    return new THREE.MeshStandardMaterial(Object.assign(
      { color: WOOD, flatShading: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }, opts));
  }
  function earthMaterial() {
    return new THREE.MeshStandardMaterial({ color: EARTH, flatShading: true, roughness: 1, metalness: 0 });
  }
  function leafMaterial(opts) {
    return new THREE.MeshStandardMaterial(Object.assign(
      { map: leafTexture(), vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 }, opts));
  }

  /* Fade a material. three.js compiles a special "opaque" shader (alpha forced to 1)
     for materials with transparent === false, and only rebuilds it when told to —
     so flipping `transparent` without needsUpdate silently ignores the opacity. */
  function setOpacity(m, a) {
    m.opacity = a;
    const tr = a < 0.995;
    if (m.transparent !== tr) {
      m.transparent = tr;
      m.depthWrite = !tr;
      m.needsUpdate = true;
    }
  }

  /* ---------- a tapered, curved tube (branches & trunk) ---------- */
  function taperedTube(curve, segments, radiusAt) {
    const frames = curve.computeFrenetFrames(segments, false);
    const P = new THREE.Vector3();
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      curve.getPointAt(t, P);
      const r = radiusAt(t);
      const n = frames.normals[i], b = frames.binormals[i];
      for (let j = 0; j <= RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const nx = c * n.x + s * b.x, ny = c * n.y + s * b.y, nz = c * n.z + s * b.z;
        pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
        nor.push(nx, ny, nz);
        uv.push(j / RADIAL, t);
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j, b = (i + 1) * (RADIAL + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  /* A limb from a to b that first rises out of the trunk, then arches out and
     settles just above the floor. Radius tapers from r0 to r1.
     a and b are {x, y, z}; everything is local to the floor's trunk point. */
  function limb(a, b, r0, r1) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1e-6;
    const ux = dx / len, uz = dz / len;
    const rise = 0.10 + 0.10 * Math.min(1, len);
    const p = (f, y) => new THREE.Vector3(a.x + ux * len * f, y, a.z + uz * len * f);
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(a.x, a.y, a.z),
      p(0.28, a.y + rise + 0.06),
      p(0.70, b.y + rise * 0.7),
      new THREE.Vector3(b.x, b.y, b.z)
    );
    return taperedTube(curve, 8, t => r0 + (r1 - r0) * t);
  }

  /* ---------- leaf sphere: lumpy low-poly ball with vertex colour ---------- */
  function hash3(x, y, z, seed) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000;
  }
  function leafSphere(radius, color, x, y, z, seed) {
    const g = new THREE.IcosahedronGeometry(radius, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const k = hash3(Math.round(vx / radius * 400), Math.round(vy / radius * 400), Math.round(vz / radius * 400), seed);
      const f = 1 + (k - 0.5) * 0.24;                  // ±12% → a lumpy canopy, not a perfect ball
      pos.setXYZ(i, vx * f, vy * f * 0.94, vz * f);
    }
    // Texture scale follows the sphere, so a leaf is the same size on a tiny
    // sphere and on a big one (small spheres just show fewer leaves).
    const uv = g.attributes.uv;
    const uS = 2 * Math.PI * radius / LEAF_TILE, vS = Math.PI * radius / LEAF_TILE;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uS, uv.getY(i) * vS);
    g.translate(x, y, z);
    const col = new THREE.Color().setRGB(color.r, color.g, color.b, THREE.SRGBColorSpace);
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  }

  /* ---------- one floor: its branches (wood) and leaf spheres ---------- */
  function floorGeometries(layout) {
    const wood = [], leaves = [];
    const peaks = layout.peaks;
    const seedBase = (layout.index + 1) * 977;
    const TIP_Y = 0.08;

    layout.clusters.forEach(cluster => {
      const members = cluster.map(i => peaks[i]);
      const mass = members.reduce((s, p) => s + p.weight, 0);
      const baseR = 0.02 + 0.055 * Math.sqrt(Math.min(1, mass));

      let start = { x: 0, y: -0.02, z: 0 };
      let startR = baseR;

      if (members.length > 1) {
        // Shared limb: runs part of the way towards the group, then forks.
        let sx = 0, sz = 0;
        members.forEach(p => { sx += Math.cos(p.angle) * p.weight; sz += Math.sin(p.angle) * p.weight; });
        const sl = Math.hypot(sx, sz) || 1;
        const shortest = Math.min(...members.map(p => p.length));
        const fork = { x: sx / sl * C.FORK_FRAC * shortest, y: 0.14, z: sz / sl * C.FORK_FRAC * shortest };
        const forkR = baseR * 0.62;
        wood.push(limb(start, fork, baseR, forkR));
        start = fork;
        startR = forkR;
      }

      members.forEach(p => {
        const tip = { x: p.tip.x, y: TIP_Y, z: p.tip.z };
        const share = members.length > 1 ? 0.55 + 0.45 * Math.sqrt(p.weight / mass) : 1;
        const r0 = startR * share;
        wood.push(limb(start, tip, r0, Math.max(0.012, r0 * 0.45)));
        leaves.push(leafSphere(p.radius, p.color, tip.x, tip.y, tip.z, seedBase + p.index * 31));
      });
    });

    return {
      wood: wood.length ? THREE.mergeGeometries(wood) : null,
      leaves: leaves.length ? THREE.mergeGeometries(leaves) : null
    };
  }

  /* ---------- trunk (follows the spine, thick at the bottom) ---------- */
  function trunkGeometry(spine) {
    const pts = spine.map(p => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    // 0.105 where it leaves the base flare → 0.035 at the very top
    return taperedTube(curve, 28, t => 0.105 - 0.07 * Math.pow(t, 0.85));
  }

  /* ---------- base: root flare (trunk gets thicker) + a low round pedestal ---------- */
  function baseGeometries() {
    const flare = new THREE.LatheGeometry([
      new THREE.Vector2(0.38, 0.08),
      new THREE.Vector2(0.25, 0.19),
      new THREE.Vector2(0.16, 0.34),
      new THREE.Vector2(0.105, 0.58)
    ], 7);
    const pedestal = new THREE.CylinderGeometry(0.66, 0.72, 0.1, 10);
    pedestal.translate(0, 0.05, 0);
    return { flare, pedestal };
  }

  /* Everything of a tree as two baked, world-fixed geometries (wood, leaves).
     Used by the forest, where a tree never needs to change floor by floor. */
  function staticTree(shape, dimIds) {
    const layout = TreeModel.layoutTree(shape, dimIds);
    const wood = [trunkGeometry(layout.spine), baseGeometries().flare], leaves = [];
    layout.floors.forEach(f => {
      const g = floorGeometries(f);
      if (g.wood) { g.wood.translate(f.trunk.x, f.y, f.trunk.z); wood.push(g.wood); }
      if (g.leaves) { g.leaves.translate(f.trunk.x, f.y, f.trunk.z); leaves.push(g.leaves); }
    });
    return {
      wood: THREE.mergeGeometries(wood),
      leaves: leaves.length ? THREE.mergeGeometries(leaves) : null
    };
  }

  /* ---------- textures (drawn once, in code — no image files) ---------- */
  let _leafTex = null;
  function leafTexture() {
    if (_leafTex) return _leafTex;
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const rand = rng(7);
    ctx.fillStyle = 'rgb(168,168,168)';                     // shadow between leaves
    ctx.fillRect(0, 0, S, S);
    const leaf = (x, y, ang, len, shade) => {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      const w = len * 0.42;
      ctx.beginPath();
      ctx.moveTo(0, -len / 2);
      ctx.quadraticCurveTo(w, -len * 0.05, 0, len / 2);
      ctx.quadraticCurveTo(-w, -len * 0.05, 0, -len / 2);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(120,120,120,0.6)`;             // midrib
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -len * 0.45); ctx.lineTo(0, len * 0.42); ctx.stroke();
      ctx.restore();
    };
    for (let n = 0; n < 95; n++) {
      const x = rand() * S, y = rand() * S, ang = rand() * Math.PI * 2;
      const len = 34 + rand() * 16, shade = Math.round(222 + rand() * 33);
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) leaf(x + dx, y + dy, ang, len, shade);   // tiles seamlessly
    }
    _leafTex = new THREE.CanvasTexture(c);
    _leafTex.colorSpace = THREE.SRGBColorSpace;
    _leafTex.wrapS = _leafTex.wrapT = THREE.RepeatWrapping;
        return _leafTex;
  }

  const BUTTERFLY_COLORS = ['#f97316', '#facc15', '#a855f7', '#06b6d4', '#ef4444', '#f472b6', '#84cc16'];

  /* Paints small, still butterflies of simple colours onto a transparent canvas.
     size: multiplier for the butterflies; count: how many; same seed → same layout. */
  function paintButterflies(ctx, W, H, size0, count) {
    const rand = rng(21);
    const placed = [];
    const k = size0 / 0.62;                                       // spacing scales with butterfly size
    const gapX = 80 * k, gapY = 60 * k;
    const butterfly = (x, y, rot, size, color) => {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size, size);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(30,30,40,0.45)';
      ctx.lineWidth = 1 / size;
      const wing = (cx, cy, rx, ry, a) => {
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      };
      wing(-7, -5, 8, 5.5, -0.5); wing(7, -5, 8, 5.5, 0.5);        // upper wings
      wing(-5, 5.5, 5.5, 4, 0.5); wing(5, 5.5, 5.5, 4, -0.5);      // lower wings
      ctx.fillStyle = 'rgba(255,255,255,0.55)';                    // a spot on each upper wing
      ctx.beginPath(); ctx.arc(-9, -5, 1.8, 0, Math.PI * 2); ctx.arc(9, -5, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2a33';                                   // body + antennae
      ctx.beginPath(); ctx.ellipse(0, 0, 1.4, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a2a33'; ctx.lineWidth = 0.9 / size;
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(-3, -12); ctx.moveTo(0, -7); ctx.lineTo(3, -12); ctx.stroke();
      ctx.restore();
    };
    let tries = 0;
    while (placed.length < count && tries++ < 800) {
      const x = rand() * W, y = 40 + rand() * (H - 80);
      if (placed.some(q => Math.min(Math.abs(q.x - x), W - Math.abs(q.x - x)) < gapX && Math.abs(q.y - y) < gapY)) continue;
      placed.push({ x, y });
      const size = size0 + rand() * size0 * (0.42 / 0.62), rot = (rand() - 0.5) * 0.9;
      const color = BUTTERFLY_COLORS[Math.floor(rand() * BUTTERFLY_COLORS.length)];
      butterfly(x, y, rot, size, color);
      if (x < 40) butterfly(x + W, y, rot, size, color);           // wrap across the seam
      if (x > W - 40) butterfly(x - W, y, rot, size, color);
    }
  }

  function makeTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function newCanvas(W, H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  }

  let _glassTex = null;
  function glassTexture() {                                     // glass tint + small butterflies (the editor's cylinder)
    if (_glassTex) return _glassTex;
    const W = 1024, H = 512, c = newCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(190,210,235,0.10)';
    ctx.fillRect(0, 0, W, H);
    paintButterflies(ctx, W, H, 0.62, 30);
    return (_glassTex = makeTexture(c));
  }

  let _bfTex = null;
  function butterflyTexture() {                                 // butterflies only, a little bigger (forest hover)
    if (_bfTex) return _bfTex;
    const W = 1024, H = 512, c = newCanvas(W, H);
    paintButterflies(c.getContext("2d"), W, H, 1.15, 20);
    return (_bfTex = makeTexture(c));
  }

  function shell(texture, opacity) {
    const g = new THREE.CylinderGeometry(C.R, C.R, C.HEIGHT, 56, 1, true);
    g.translate(0, C.HEIGHT / 2, 0);
    const m = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 10;                                      // drawn after the tree, seen through
    return mesh;
  }
  const glassMesh = () => shell(glassTexture(), 1);             // the editor's cylinder
  const butterflyShell = () => shell(butterflyTexture(), 0);    // invisible until shown

  /* Lights shared by every scene. */
  function addLights(scene) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc4b59c, 1.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2.5, 5, 4);
    scene.add(sun);
  }

  return {
    woodMaterial, earthMaterial, leafMaterial,
    floorGeometries, trunkGeometry, baseGeometries, staticTree,
    glassMesh, butterflyShell, setOpacity, leafTexture, glassTexture, addLights
  };
})();
