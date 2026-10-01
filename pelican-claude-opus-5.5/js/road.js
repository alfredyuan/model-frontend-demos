import * as THREE from 'three';
import { fbm, smoothstep, lerp } from './util.js';

export const SEA_FLOOR = -7;
export const ROAD_HALF = 2.0;

export function islandEdge(a) {
  return 120 + 10 * Math.sin(a * 3 + 0.5) + 7 * Math.sin(a * 5 + 2.0) + 4 * Math.sin(a * 9 + 1.3);
}

/** Raw island height field (before the road is carved in). */
export function terrainBase(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const e = islandEdge(a);
  const mask = smoothstep(e + 16, e - 16, r);
  const n = fbm(x * 0.016 + 11.3, z * 0.016 - 4.7);
  const hills = Math.max(0, n - 0.32) * 17;
  const mountain = 30 * Math.exp(-(r * r) / (2 * 24 * 24));
  const detail = (fbm(x * 0.08 + 3.1, z * 0.08 + 9.2, 3) - 0.45) * 1.4;
  return mask * (2.6 + hills + mountain + detail) + (1 - mask) * SEA_FLOOR;
}

/** Closed scenic loop road around the island, sampled by arc length. */
export class Road {
  constructor() {
    const ctrl = [];
    const NC = 16;
    for (let i = 0; i < NC; i++) {
      const a = (i / NC) * Math.PI * 2;
      const r = 74 + 9 * Math.sin(a * 2 + 0.7) + 6 * Math.sin(a * 3 + 2.1);
      ctrl.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    this.curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
    this.length = this.curve.getLength();
    const N = (this.N = Math.round(this.length / 0.4));
    this.ds = this.length / N;
    const pts = this.curve.getSpacedPoints(N);
    const px = (this.px = new Float32Array(N));
    const pz = (this.pz = new Float32Array(N));
    let py = (this.py = new Float32Array(N));
    for (let i = 0; i < N; i++) {
      px[i] = pts[i].x; pz[i] = pts[i].z;
      py[i] = Math.max(terrainBase(px[i], pz[i]), 2.4);
    }
    // heavy circular smoothing -> gentle gradients
    const rad = 45;
    for (let pass = 0; pass < 4; pass++) {
      const out = new Float32Array(N);
      let acc = 0;
      for (let k = -rad; k <= rad; k++) acc += py[(k + N) % N];
      for (let i = 0; i < N; i++) {
        out[i] = acc / (2 * rad + 1);
        acc += py[(i + rad + 1) % N] - py[(i - rad + N) % N];
      }
      py = out;
    }
    this.py = py;
    const tx = (this.tx = new Float32Array(N));
    const tz = (this.tz = new Float32Array(N));
    const slope = (this.slope = new Float32Array(N));
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      const dx = px[b] - px[a], dz = pz[b] - pz[a];
      const l = Math.hypot(dx, dz);
      tx[i] = dx / l; tz[i] = dz / l;
      slope[i] = (py[b] - py[a]) / (2 * this.ds);
    }
    const k = (this.k = new Float32Array(N));
    const W = 6;
    for (let i = 0; i < N; i++) {
      const a = (i - W + N) % N, b = (i + W) % N;
      k[i] = (tz[a] * tx[b] - tx[a] * tz[b]) / (2 * W * this.ds);
    }
    // spatial hash for nearest-sample queries
    this.cell = 12;
    this.grid = new Map();
    for (let i = 0; i < N; i++) {
      const key = this._key(Math.floor(px[i] / this.cell), Math.floor(pz[i] / this.cell));
      let arr = this.grid.get(key);
      if (!arr) this.grid.set(key, (arr = []));
      arr.push(i);
    }
    this._near = { d: 0, i: 0 };
  }

  _key(cx, cz) { return cx * 4096 + cz; }

  wrap(s) { return ((s % this.length) + this.length) % this.length; }

  /** Interpolated sample at arc length s. */
  sample(s, out = {}) {
    const N = this.N;
    const f = this.wrap(s) / this.ds;
    const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, t = f - Math.floor(f);
    out.x = lerp(this.px[i0], this.px[i1], t);
    out.y = lerp(this.py[i0], this.py[i1], t);
    out.z = lerp(this.pz[i0], this.pz[i1], t);
    let tx = lerp(this.tx[i0], this.tx[i1], t), tz = lerp(this.tz[i0], this.tz[i1], t);
    const l = Math.hypot(tx, tz);
    out.tx = tx / l; out.tz = tz / l;
    out.k = lerp(this.k[i0], this.k[i1], t);
    out.slope = lerp(this.slope[i0], this.slope[i1], t);
    // right-hand side vector (rider faces +tangent)
    out.rx = -out.tz; out.rz = out.tx;
    return out;
  }

  nearest(x, z) {
    const cs = this.cell, cx = Math.floor(x / cs), cz = Math.floor(z / cs);
    let best = Infinity, bi = -1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = this.grid.get(this._key(cx + dx, cz + dz));
      if (!arr) continue;
      for (let j = 0; j < arr.length; j++) {
        const i = arr[j];
        const ex = this.px[i] - x, ez = this.pz[i] - z;
        const d = ex * ex + ez * ez;
        if (d < best) { best = d; bi = i; }
      }
    }
    if (bi < 0) return null;
    this._near.d = Math.sqrt(best); this._near.i = bi;
    return this._near;
  }

  /** Final ground height (terrain blended into the road bed). */
  groundHeight(x, z) {
    const base = terrainBase(x, z);
    const n = this.nearest(x, z);
    if (!n) return base;
    const t = smoothstep(ROAD_HALF + 0.8, ROAD_HALF + 9, n.d);
    return lerp(this.py[n.i] - 0.08, base, t);
  }
}
