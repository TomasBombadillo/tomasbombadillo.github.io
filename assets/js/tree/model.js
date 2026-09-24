/* ------------------------------------------------------------------
   Tree model — pure math, no DOM and no three.js (so it can be tested
   in Node). It turns a saved shape into a description of the tree:
   where the trunk bends, where every branch goes, how big and what
   colour every leaf-sphere is.

   Coordinates: the cylinder axis is x = z = 0, its radius is 1, y is up.
   On a floor the heatmap's "up" (Masc) points AWAY from the viewer (-z),
   Fem is front-right, Other is front-left — exactly the orientation of the
   circle canvas seen from above with the viewer at the bottom edge.

   How the numbers map (per peak):
     direction  the peak's position on the heatmap (masc/fem/other pull)
     length     the peak's intensity = its highest masc/fem/other value
     size       sphere AREA ∝ weight (radius ∝ √weight)
     colour     masc/fem/other mixed in OKLab (blue / pink / green)
   Trunk: floor 1 stands on the axis; on every other floor it leans towards
   the weighted centre of mass of that floor's peaks.
   ------------------------------------------------------------------ */

const TreeModel = (function () {
  'use strict';

  const C = {
    R: 1,                 // cylinder radius
    REACH: 0.68,          // horizontal reach of a branch at intensity 100 (+ sphere radius stays inside the glass)
    LEAN: 0.6,            // how far the trunk follows a floor's centre of mass (1 = all the way)
    SPHERE_MAX: 0.28,     // radius of a peak that holds 100% of a floor's weight
    MIN_BRANCH: 0.2,      // shortest branch, so a sphere never sits inside the trunk
    FLOOR0_Y: 0.62,       // height of floor 1
    FLOOR_GAP: 0.6,       // distance between floors
    TOP_EXTRA: 0.32,      // trunk keeps growing this far above the last floor
    HEIGHT: 3.7,          // height of the glass cylinder
    FORK_ANGLE: 28 * Math.PI / 180,   // peaks closer than this share a limb…
    FORK_OVERLAP: 1.1,                // …or when their spheres overlap (× sum of radii)
    FORK_FRAC: 0.55       // the shared limb runs this far before it forks
  };

  const BASE_COLORS = { masc: '#2563eb', fem: '#ec4899', otro: '#10b981' };   // = --masculino / --femenino / --otro
  const GOLDEN = 2.399963229728653;

  /* ---------- OKLab colour mixing (Björn Ottosson) ---------- */
  const toLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toSrgb = c => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  function hexToLinear(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(toLinear);
  }
  function linearToOklab([r, g, b]) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  function oklabToLinear([L, a, b]) {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }
  const LAB = {
    masc: linearToOklab(hexToLinear(BASE_COLORS.masc)),
    fem: linearToOklab(hexToLinear(BASE_COLORS.fem)),
    otro: linearToOklab(hexToLinear(BASE_COLORS.otro))
  };

  /* Weighted mix of the three base colours. Returns sRGB channels 0–1. */
  function mixColor(masc, fem, otro) {
    const sum = masc + fem + otro;
    if (!(sum > 0)) return { r: 0.5, g: 0.5, b: 0.5 };
    const w = [masc / sum, fem / sum, otro / sum];
    const lab = [0, 1, 2].map(k => w[0] * LAB.masc[k] + w[1] * LAB.fem[k] + w[2] * LAB.otro[k]);
    const [r, g, b] = oklabToLinear(lab).map(toSrgb);
    return { r, g, b };
  }

  /* ---------- one peak ---------- */
  function angleDiff(a, b) {
    let d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  }

  /* Position of the peak's tip on the floor (relative to the cylinder axis),
     or null when the peak contributes nothing (no weight / all-zero values). */
  function analyzePeak(p, index) {
    const masc = +p.masc || 0, fem = +p.fem || 0, otro = +p.otro || 0;
    const sum = masc + fem + otro;
    const maxV = Math.max(masc, fem, otro);
    const weight = (+p.freq || 0) / 100;
    if (!(weight > 0) || !(maxV > 0) || !(sum > 0)) return null;

    // Same vector the density heatmap uses to place the peak on the disc.
    const wM = masc / sum, wF = fem / sum, wO = otro / sum;
    const vx = (wF - wO) * 0.866025;
    const vz = -wM + 0.5 * wF + 0.5 * wO;
    const mag = Math.hypot(vx, vz);

    // A perfectly balanced peak has no direction: spread those out by peak order.
    const angle = mag > 0.06 ? Math.atan2(vz, vx) : index * GOLDEN;
    const reach = (maxV / 100) * C.REACH;

    return {
      index,
      weight,
      intensity: maxV / 100,
      radius: C.SPHERE_MAX * Math.sqrt(weight),
      color: mixColor(masc, fem, otro),
      tipAbs: { x: Math.cos(angle) * reach, z: Math.sin(angle) * reach }
    };
  }

  /* ---------- one floor ---------- */
  function layoutFloor(peaks, floorIndex) {
    const raw = (peaks || []).map((p, i) => analyzePeak(p, i)).filter(Boolean);

    // Centre of mass of the floor, weighted by each peak's weight.
    const mass = raw.reduce((a, p) => a + p.weight, 0);
    const com = { x: 0, z: 0 };
    if (mass > 0) raw.forEach(p => { com.x += p.tipAbs.x * p.weight / mass; com.z += p.tipAbs.z * p.weight / mass; });

    // Floor 1 stands on the axis; every other floor leans towards its centre of mass.
    const trunk = floorIndex === 0 ? { x: 0, z: 0 } : { x: com.x * C.LEAN, z: com.z * C.LEAN };

    raw.forEach(p => {
      let x = p.tipAbs.x - trunk.x, z = p.tipAbs.z - trunk.z;
      let len = Math.hypot(x, z);
      let angle = len > 1e-6 ? Math.atan2(z, x) : p.index * GOLDEN;
      if (len < C.MIN_BRANCH) {           // keep the sphere clear of the trunk
        len = C.MIN_BRANCH;
        x = Math.cos(angle) * len; z = Math.sin(angle) * len;
      }
      p.tip = { x, z };                   // relative to the trunk point of this floor
      p.angle = angle;
      p.length = len;
    });

    return { index: floorIndex, trunk, peaks: raw, clusters: clusterPeaks(raw) };
  }

  /* Peaks that point the same way, or whose spheres overlap, share one limb
     and fork near the end. Single-linkage grouping. */
  function clusterPeaks(peaks) {
    const parent = peaks.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let a = 0; a < peaks.length; a++) {
      for (let b = a + 1; b < peaks.length; b++) {
        const A = peaks[a], B = peaks[b];
        const close = angleDiff(A.angle, B.angle) < C.FORK_ANGLE ||
          Math.hypot(A.tip.x - B.tip.x, A.tip.z - B.tip.z) < C.FORK_OVERLAP * (A.radius + B.radius);
        if (close) parent[find(a)] = find(b);
      }
    }
    const groups = new Map();
    peaks.forEach((_, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    });
    return [...groups.values()];
  }

  const floorY = i => C.FLOOR0_Y + i * C.FLOOR_GAP;

  /* Whole tree: `shape` is { dimId: [peaks] }, `dimIds` gives the floor order. */
  function layoutTree(shape, dimIds) {
    const floors = dimIds.map((id, i) => {
      const f = layoutFloor((shape && shape[id]) || [], i);
      f.y = floorY(i);
      return f;
    });
    return { floors, spine: spineFor(floors.map(f => f.trunk)) };
  }

  /* Trunk spine: from the ground, up through every floor's trunk point
     ({x, z} per floor), a bit beyond the last one. */
  function spineFor(trunks) {
    const n = trunks.length, last = trunks[n - 1];
    const pts = [{ x: 0, y: 0.25, z: 0 }];
    trunks.forEach((t, i) => pts.push({ x: t.x, y: floorY(i), z: t.z }));
    pts.push({ x: last.x, y: floorY(n - 1) + C.TOP_EXTRA, z: last.z });
    return pts;
  }

  /* Cheap fingerprint of a floor's peaks, to skip rebuilding unchanged floors. */
  function signature(peaks) {
    return JSON.stringify((peaks || []).map(p => [p.masc, p.fem, p.otro, p.freq]));
  }

  const api = { C, BASE_COLORS, mixColor, analyzePeak, layoutFloor, layoutTree, spineFor, clusterPeaks, floorY, signature };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
