import * as THREE from 'three';
import { clamp, lerp, damp, canvasTexture } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();
const _m4 = new THREE.Matrix4();

export const WHEEL_R = 0.34;
const GEAR = 2.6; // wheel turns per crank turn

const SPH = new THREE.SphereGeometry(1, 22, 16);
const SPH_LO = new THREE.SphereGeometry(1, 12, 9);

function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o }); }
const M = {
  frame: std(0xe63946, { roughness: 0.28, metalness: 0.45 }),
  cream: std(0xfff1d6, { roughness: 0.45 }),
  chrome: std(0xe2e6ea, { roughness: 0.18, metalness: 1.0 }),
  dark: std(0x24262c, { roughness: 0.45, metalness: 0.5 }),
  tire: std(0x1d1d20, { roughness: 0.92 }),
  leather: std(0x7a4a2a, { roughness: 0.6 }),
  feather: std(0xfbf8f2, { roughness: 0.92 }),
  featherShade: std(0xeee8de, { roughness: 0.95 }),
  chest: std(0xffe7a8, { roughness: 0.92 }),
  primary: std(0x2c2e36, { roughness: 0.8 }),
  beak: std(0xf9a23c, { roughness: 0.4 }),
  beakTip: std(0xe0502a, { roughness: 0.4 }),
  pouch: std(0xffb877, { roughness: 0.5 }),
  leg: std(0xf38b3a, { roughness: 0.55 }),
  eye: std(0xffffff, { roughness: 0.15 }),
  iris: std(0xffd34d, { roughness: 0.2 }),
  pupil: std(0x0b0b0b, { roughness: 0.1 }),
  helmet: std(0x23a8ff, { roughness: 0.22, metalness: 0.15 }),
  stripe: std(0xffffff, { roughness: 0.3 }),
  scarf: std(0xff3d5a, { roughness: 0.75, side: THREE.DoubleSide }),
  lens: std(0xffffee, { emissive: 0xfff2c0, emissiveIntensity: 0.2, roughness: 0.1 }),
  tail: std(0x550000, { emissive: 0xff1a1a, emissiveIntensity: 0.4 }),
  bread: std(0xd9963f, { roughness: 0.8 }),
};

function mesh(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

function tube(a, b, r, mat, parent, seg = 10) {
  const d = _a.subVectors(b, a);
  const len = d.length();
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), mat, parent);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Cylinder whose geometry spans y∈[0,1]; stretched between two points each frame. */
function limbGeo(rTop, rBot, seg = 10) { return new THREE.CylinderGeometry(rTop, rBot, 1, seg, 1).translate(0, 0.5, 0); }
function placeLimb(m, a, b) {
  const d = _a.subVectors(b, a);
  const len = d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
  m.scale.set(1, len, 1);
}
/** Ellipsoid spanning a→b, flat across `normal`. */
function placeFlat(m, a, b, normal, width, thick, ext = 1) {
  _Y.subVectors(b, a);
  const len = _Y.length();
  _Y.multiplyScalar(1 / len);
  _Z.copy(normal).addScaledVector(_Y, -normal.dot(_Y)).normalize();
  _X.crossVectors(_Y, _Z);
  m.quaternion.setFromRotationMatrix(_m4.makeBasis(_X, _Y, _Z));
  m.position.lerpVectors(a, b, 0.5);
  m.scale.set(width, len * 0.5 * ext, thick);
}
/** Two-bone IK: writes the joint position into `out`, returns clamped end point in `end`. */
function ik(root, target, l1, l2, pole, out, end) {
  const dir = _b.subVectors(target, root);
  let dist = dir.length();
  dir.multiplyScalar(1 / (dist || 1));
  dist = clamp(dist, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  _c.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  out.copy(root).addScaledVector(dir, a).addScaledVector(_c, h);
  end.copy(root).addScaledVector(dir, dist);
}

function makeWheel() {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const tire = mesh(new THREE.TorusGeometry(WHEEL_R - 0.03, 0.033, 10, 48).rotateY(Math.PI / 2), M.tire, spin);
  tire.receiveShadow = true;
  mesh(new THREE.TorusGeometry(WHEEL_R - 0.068, 0.013, 6, 48).rotateY(Math.PI / 2), M.chrome, spin);
  mesh(new THREE.TorusGeometry(WHEEL_R - 0.055, 0.006, 4, 48).rotateY(Math.PI / 2), M.cream, spin);
  mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.13, 12).rotateZ(Math.PI / 2), M.chrome, spin);
  const pts = [];
  const NS = 28;
  for (let i = 0; i < NS; i++) {
    const a = (i / NS) * Math.PI * 2, side = i % 2 ? 1 : -1;
    const a2 = a + (side * 0.18);
    pts.push(side * 0.05, Math.sin(a2) * 0.03, Math.cos(a2) * 0.03, 0, Math.sin(a) * (WHEEL_R - 0.07), Math.cos(a) * (WHEEL_R - 0.07));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  spin.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xc8ccd2 })));
  // reflectors make the spin readable
  for (const s of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(0.012, 0.035, 0.07), std(0xffa21a, { emissive: 0xff7a00, emissiveIntensity: 0.4 }), spin, s * 0.02, WHEEL_R * 0.55, 0);
    r.castShadow = false;
  }
  // translucent motion-blur disc (fades in at speed)
  const blur = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R - 0.07, 32).rotateY(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc8ccd2, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  g.add(blur);
  return { g, spin, blur };
}

export class Rider {
  constructor() {
    this.root = new THREE.Group();     // placed on the road
    this.lean = new THREE.Group();     // roll / hop
    this.root.add(this.lean);
    this.root.rotation.order = 'YXZ';
    this.pickPelican = [];
    this.pickBike = [];

    this.crank = 0;
    this.wheelAng = 0;
    this.handsFree = 0;
    this.jaw = 0;
    this.jawTarget = 0;
    this.pouch = 1; this.pouchV = 0;
    this.swallow = 1;
    this.blinkT = 2;
    this.lookYaw = 0; this.lookPitch = 0;
    this.honkT = 0;
    this.stand = 0;
    this.steer = 0;

    this._bike();
    this._pelican();
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = !o.material.transparent && o.castShadow; });
    this.headWorld = new THREE.Vector3();
    this.beakWorld = new THREE.Vector3();
  }

  // ---------------------------------------------------------------- bicycle
  _bike() {
    const B = (this.bike = new THREE.Group());
    this.lean.add(B);
    const R = WHEEL_R;
    const P = (this.P = {
      rear: new THREE.Vector3(0, R, -0.53), front: new THREE.Vector3(0, R, 0.56),
      bb: new THREE.Vector3(0, 0.31, -0.06), seat: new THREE.Vector3(0, 0.78, -0.25),
      headTop: new THREE.Vector3(0, 0.82, 0.37), headBot: new THREE.Vector3(0, 0.64, 0.42),
    });
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    tube(P.bb, P.seat, 0.022, M.frame, B);
    tube(v(0, 0.75, -0.24), v(0, 0.795, 0.372), 0.02, M.frame, B);
    tube(P.bb, v(0, 0.66, 0.415), 0.027, M.frame, B);
    tube(P.headBot, P.headTop, 0.032, M.cream, B);
    for (const s of [-1, 1]) {
      tube(v(s * 0.025, 0.31, -0.08), v(s * 0.06, R, -0.53), 0.012, M.frame, B);
      tube(v(s * 0.02, 0.75, -0.25), v(s * 0.06, R, -0.53), 0.011, M.frame, B);
    }
    mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 14).rotateZ(Math.PI / 2), M.dark, B, P.bb.x, P.bb.y, P.bb.z);
    tube(P.seat, v(0, 0.84, -0.27), 0.012, M.chrome, B);
    const saddle = mesh(SPH, M.leather, B, 0, 0.855, -0.285, 0.085, 0.032, 0.15);
    saddle.rotation.x = -0.08;
    mesh(SPH_LO, M.leather, B, 0, 0.85, -0.35, 0.11, 0.035, 0.08);
    // chain
    tube(v(0.075, P.bb.y + 0.1, P.bb.z), v(0.075, R + 0.045, P.rear.z), 0.006, M.dark, B, 5);
    tube(v(0.075, P.bb.y - 0.1, P.bb.z), v(0.075, R - 0.045, P.rear.z), 0.006, M.dark, B, 5);
    // rear fender + tail light
    const rf = mesh(new THREE.TorusGeometry(R + 0.05, 0.026, 5, 24, Math.PI * 0.6).rotateY(Math.PI / 2), M.cream, B, 0, R, -0.53);
    rf.rotation.x = Math.PI * 0.62;
    this.tailLight = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), M.tail, B, 0, R + 0.2, -0.84);
    // rear rack with a little flag
    tube(v(-0.08, 0.7, -0.68), v(0.08, 0.7, -0.68), 0.008, M.chrome, B);
    for (const s of [-1, 1]) {
      tube(v(s * 0.08, 0.7, -0.68), v(s * 0.08, 0.7, -0.3), 0.008, M.chrome, B);
      tube(v(s * 0.08, 0.7, -0.6), v(s * 0.06, R, -0.53), 0.008, M.chrome, B);
    }
    tube(v(-0.08, 0.7, -0.68), v(-0.08, 1.75, -0.74), 0.006, M.dark, B, 5);
    const flagGeo = new THREE.PlaneGeometry(0.32, 0.2, 6, 1).translate(0.16, 0, 0);
    this.flag = new THREE.Mesh(flagGeo, std(0xffd23f, { side: THREE.DoubleSide }));
    this.flag.position.set(-0.08, 1.64, -0.74);
    this.flag.rotation.y = Math.PI / 2;
    this.flagBase = flagGeo.attributes.position.array.slice();
    B.add(this.flag);

    this.rearWheel = makeWheel();
    this.rearWheel.g.position.copy(P.rear);
    B.add(this.rearWheel.g);
    mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 16).rotateY(Math.PI / 2), M.dark, this.rearWheel.spin, 0.075, 0, 0);

    // crank set
    const crank = (this.crankG = new THREE.Group());
    crank.position.copy(P.bb);
    B.add(crank);
    mesh(new THREE.TorusGeometry(0.1, 0.009, 6, 32).rotateY(Math.PI / 2), M.chrome, crank, 0.075, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const s = mesh(new THREE.BoxGeometry(0.008, 0.1, 0.014), M.chrome, crank, 0.075, Math.sin(a) * 0.05, Math.cos(a) * 0.05);
      s.rotation.x = -a;
    }
    mesh(new THREE.BoxGeometry(0.02, 0.026, 0.19), M.chrome, crank, 0.098, 0, 0.085);
    mesh(new THREE.BoxGeometry(0.02, 0.026, 0.19), M.chrome, crank, -0.098, 0, -0.085);
    this.pedals = [-1, 1].map(() => {
      const p = new THREE.Group();
      mesh(new THREE.BoxGeometry(0.1, 0.022, 0.07), M.dark, p);
      mesh(new THREE.BoxGeometry(0.104, 0.008, 0.012), std(0xffa21a, { emissive: 0xff7a00, emissiveIntensity: 0.3 }), p, 0, 0, 0.036);
      B.add(p);
      return p;
    });

    // steering assembly
    const fork = (this.fork = new THREE.Group());
    fork.position.copy(P.headTop);
    this.headAxis = new THREE.Vector3().subVectors(P.headTop, P.headBot).normalize();
    B.add(fork);
    const rel = (x, y, z) => new THREE.Vector3(x, y, z).sub(P.headTop);
    for (const s of [-1, 1]) tube(rel(s * 0.045, 0.64, 0.42), rel(s * 0.05, R, 0.56), 0.013, M.frame, fork);
    mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), M.frame, fork, ...rel(0, 0.64, 0.42).toArray());
    tube(rel(0, 0.8, 0.37), rel(0, 0.95, 0.35), 0.016, M.chrome, fork);
    tube(rel(-0.13, 0.95, 0.35), rel(0.13, 0.95, 0.35), 0.013, M.chrome, fork);
    for (const s of [-1, 1]) {
      tube(rel(s * 0.13, 0.95, 0.35), rel(s * 0.25, 0.965, 0.27), 0.013, M.chrome, fork);
      tube(rel(s * 0.235, 0.963, 0.282), rel(s * 0.3, 0.97, 0.24), 0.022, M.dark, fork);
    }
    this.grips = [rel(-0.27, 0.967, 0.262), rel(0.27, 0.967, 0.262)];
    // bell
    const bell = (this.bellMesh = mesh(new THREE.SphereGeometry(0.035, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.chrome, fork, ...rel(-0.1, 0.965, 0.35).toArray()));
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02), M.chrome, bell, 0, 0.035, 0);
    // headlamp
    const lamp = new THREE.Group();
    lamp.position.copy(rel(0, 0.86, 0.43));
    fork.add(lamp);
    mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 14).rotateX(Math.PI / 2), M.chrome, lamp);
    this.lens = mesh(new THREE.CircleGeometry(0.04, 16), M.lens, lamp, 0, 0, 0.036);
    this.headlight = new THREE.SpotLight(0xfff1cc, 0, 30, 0.5, 0.55, 1.6);
    this.headlight.position.set(0, 0, 0.05);
    this.headlight.target.position.set(0, -0.5, 4);
    lamp.add(this.headlight, this.headlight.target);
    // wicker basket with a baguette and flowers
    const wicker = canvasTexture(128, 64, (g, w, h) => {
      g.fillStyle = '#b27a3e'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 16) {
        g.fillStyle = (x / 16 + y / 8) % 2 ? '#d9a35f' : '#c88c48';
        g.fillRect(x + 1, y + 1, 14, 6);
      }
    });
    wicker.wrapS = THREE.RepeatWrapping; wicker.repeat.x = 3;
    const basket = new THREE.Group();
    basket.position.copy(rel(0, 0.82, 0.55));
    fork.add(basket);
    mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 16, 1, true), std(0xffffff, { map: wicker, side: THREE.DoubleSide, roughness: 0.9 }), basket);
    mesh(new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), std(0x8a5a2b), basket, 0, -0.088, 0);
    mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 24).rotateX(Math.PI / 2), M.leather, basket, 0, 0.09, 0);
    tube(rel(0, 0.86, 0.43), rel(0, 0.82, 0.48), 0.01, M.chrome, fork);
    const bread = mesh(new THREE.CapsuleGeometry(0.03, 0.3, 4, 10), M.bread, basket, 0.05, 0.12, -0.02);
    bread.rotation.set(0.3, 0, -0.5);
    const fcols = [0xff5d8f, 0xffd23f, 0xffffff, 0xb388ff];
    fcols.forEach((c, i) => {
      const a = i * 1.7;
      tube(new THREE.Vector3(Math.cos(a) * 0.05 - 0.04, 0.0, Math.sin(a) * 0.05), new THREE.Vector3(Math.cos(a) * 0.08 - 0.05, 0.18, Math.sin(a) * 0.08), 0.005, std(0x3f8f3a), basket, 4);
      mesh(new THREE.IcosahedronGeometry(0.03, 0), std(c, { flatShading: true }), basket, Math.cos(a) * 0.08 - 0.05, 0.19, Math.sin(a) * 0.08);
    });
    // front fender + wheel
    const ff = mesh(new THREE.TorusGeometry(R + 0.05, 0.026, 5, 24, Math.PI * 0.55).rotateY(Math.PI / 2), M.cream, fork, ...rel(0, R, 0.56).toArray());
    ff.rotation.x = Math.PI * 0.18;
    this.frontWheel = makeWheel();
    this.frontWheel.g.position.copy(rel(0, R, 0.56));
    fork.add(this.frontWheel.g);

    B.traverse((o) => { if (o.isMesh) this.pickBike.push(o); });
  }

  // ---------------------------------------------------------------- pelican
  _pelican() {
    const L = this.lean;
    const g = (this.pel = new THREE.Group());
    L.add(g);

    // torso
    const body = (this.body = new THREE.Group());
    body.position.set(0, 1.08, -0.16);
    body.rotation.x = -0.55;
    g.add(body);
    mesh(SPH, M.feather, body, 0, 0, 0, 0.23, 0.25, 0.38);
    mesh(SPH, M.chest, body, 0, 0.04, 0.27, 0.17, 0.19, 0.15);
    mesh(SPH, M.featherShade, body, 0, -0.1, -0.05, 0.22, 0.17, 0.32);
    // tail fan
    for (let i = -2; i <= 2; i++) {
      const t = mesh(SPH_LO, i % 2 ? M.featherShade : M.feather, body, i * 0.04, -0.03, -0.42, 0.05, 0.018, 0.14);
      t.rotation.set(0.2, i * 0.22, 0);
    }
    // cycling jersey number on the back, why not
    const bib = canvasTexture(128, 128, (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e63946'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#111'; c.font = 'bold 76px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('42', w / 2, h / 2 + 4);
    });
    const bibM = mesh(new THREE.PlaneGeometry(0.17, 0.17), std(0xffffff, { map: bib, roughness: 0.8 }), body, 0, 0.12, -0.12);
    bibM.rotation.set(-Math.PI / 2 - 0.45, 0, Math.PI);
    bibM.position.set(0, 0.255, -0.1);

    // neck: chain of spheres along a Bézier
    // dynamic tube (rebuilt every frame along a Bézier curve)
    const NR = (this.neckRings = 18), NS = (this.neckSides = 14);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * NS * 3), 3));
    ng.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(NR * NS * 3), 3));
    const nIdx = [];
    for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NS; j++) {
      const a = i * NS + j, b = i * NS + ((j + 1) % NS), c = a + NS, d = b + NS;
      nIdx.push(a, b, c, b, d, c);
    }
    ng.setIndex(nIdx);
    this.neckMesh = mesh(ng, M.feather, g);
    this.neckMesh.frustumCulled = false;
    this.neckPts = Array.from({ length: NR }, () => new THREE.Vector3());
    this.neckCap = mesh(SPH, M.feather, g);
    this.neckBase = new THREE.Vector3(0, 0.2, 0.27); // body-local

    // scarf knot + tails
    this.scarfKnot = mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 22), M.scarf, g);
    this.scarfTails = [0, 1].map(() => {
      const SEG = 14;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
      const idx = [];
      for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, M.scarf);
      m.frustumCulled = false;
      g.add(m);
      return { m, SEG };
    });

    // head
    const head = (this.head = new THREE.Group());
    g.add(head);
    mesh(SPH, M.feather, head, 0, 0, 0, 0.1, 0.1, 0.112);
    mesh(SPH, M.feather, head, 0, -0.035, 0.05, 0.075, 0.07, 0.08);
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Group();
      e.position.set(s * 0.068, 0.022, 0.05);
      e.rotation.y = s * 0.55;
      head.add(e);
      mesh(SPH, M.eye, e, 0, 0, 0, 0.038);
      mesh(SPH, M.iris, e, 0, 0.002, 0.025, 0.023, 0.023, 0.015);
      mesh(SPH, M.pupil, e, 0, 0.003, 0.034, 0.013, 0.014, 0.008);
      const hl = mesh(SPH_LO, std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }), e, 0.008, 0.013, 0.039, 0.005);
      hl.castShadow = false;
      return e;
    });
    // helmet
    const helm = new THREE.Group();
    helm.position.set(0, 0.03, -0.012);
    helm.rotation.x = -0.12;
    head.add(helm);
    const dome = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    mesh(dome, M.helmet, helm, 0, 0, 0, 0.122, 0.11, 0.14);
    for (const x of [-0.045, 0, 0.045]) mesh(dome, M.stripe, helm, x, 0.002, 0, 0.016, 0.113, 0.142);
    const visor = mesh(new THREE.BoxGeometry(0.17, 0.01, 0.06), M.dark, helm, 0, 0.02, 0.135);
    visor.rotation.x = 0.25;
    for (const s of [-1, 1]) tube(new THREE.Vector3(s * 0.1, 0.0, 0.0), new THREE.Vector3(s * 0.07, -0.1, 0.04), 0.006, M.dark, helm, 5);
    // crest feathers poking out the back
    this.crest = [];
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group();
      c.position.set((i - 1.5) * 0.02, 0.0 - i * 0.008, -0.1);
      head.add(c);
      const f = mesh(SPH_LO, M.chest, c, 0, 0, -0.07, 0.012, 0.01, 0.075);
      f.castShadow = false;
      this.crest.push(c);
    }
    // beak
    const beak = (this.beak = new THREE.Group());
    beak.position.set(0, -0.03, 0.08);
    beak.rotation.x = 0.32;
    head.add(beak);
    const billGeo = new THREE.CylinderGeometry(0.02, 0.05, 0.7, 14, 1).translate(0, 0.35, 0).rotateX(Math.PI / 2);
    mesh(billGeo, M.beak, beak, 0, 0.012, 0, 1.25, 0.48, 1);
    mesh(SPH, M.beakTip, beak, 0, 0.0, 0.7, 0.027, 0.022, 0.04);
    mesh(new THREE.BoxGeometry(0.006, 0.006, 0.58), M.beakTip, beak, 0, 0.036, 0.35).castShadow = false;
    const jaw = (this.jawG = new THREE.Group());
    beak.add(jaw);
    mesh(billGeo, M.beak, jaw, 0, -0.012, 0, 1.18, 0.32, 0.97);
    this.pouchM = mesh(SPH, M.pouch, jaw, 0, -0.06, 0.28, 0.058, 0.09, 0.3);
    this.pouchM.rotation.x = -0.1;
    this.beakTip = new THREE.Object3D();
    this.beakTip.position.set(0, -0.01, 0.7);
    beak.add(this.beakTip);

    // wings (dynamic)
    this.wings = [-1, 1].map((s) => {
      const up = mesh(SPH, M.feather, g);
      const fore = mesh(SPH, M.feather, g);
      const cov = mesh(SPH, M.featherShade, g);
      const hand = new THREE.Group();
      g.add(hand);
      const feathers = [];
      for (let i = 0; i < 6; i++) {
        const fg = new THREE.Group();
        hand.add(fg);
        const f = mesh(SPH, i < 2 ? M.featherShade : M.primary, fg, 0, 0.13, 0, 0.032, 0.14, 0.012);
        feathers.push(fg);
      }
      return { s, up, fore, cov, hand, feathers, elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), end: new THREE.Vector3() };
    });

    // legs (dynamic)
    const footShape = new THREE.Shape();
    footShape.moveTo(0, -0.02);
    footShape.lineTo(-0.075, 0.15); footShape.quadraticCurveTo(-0.045, 0.13, -0.03, 0.135);
    footShape.lineTo(0, 0.18); footShape.quadraticCurveTo(0.015, 0.14, 0.03, 0.135);
    footShape.lineTo(0.075, 0.15); footShape.lineTo(0, -0.02);
    const footGeo = new THREE.ExtrudeGeometry(footShape, { depth: 0.012, bevelEnabled: false }).rotateX(Math.PI / 2);
    this.legs = [-1, 1].map((s) => {
      const thigh = mesh(limbGeo(0.055, 0.085, 12), M.feather, g);
      const shin = mesh(limbGeo(0.02, 0.026, 8), M.leg, g);
      const knee = mesh(SPH_LO, M.featherShade, g, 0, 0, 0, 0.058);
      const ankle = mesh(SPH_LO, M.leg, g, 0, 0, 0, 0.028);
      const foot = new THREE.Group();
      g.add(foot);
      mesh(footGeo, M.leg, foot, 0, 0.0, -0.02);
      return { s, thigh, shin, knee, ankle, foot, kneeP: new THREE.Vector3(), end: new THREE.Vector3() };
    });

    g.traverse((o) => { if (o.isMesh) this.pickPelican.push(o); });
  }

  honk() { this.honkT = 1.6; }
  gulp() { this.pouchV += 9; this.swallow = 0; this.jaw = 0; }

  /**
   * state: { dt, t, speed, steer, handsFree, climb, camLocal (Vector3|null) }
   */
  update(st) {
    const { dt, t, speed } = st;
    const P = this.P;
    // ---- wheels & crank
    const w = speed / WHEEL_R;
    this.wheelAng += w * dt;
    this.crank += (w / GEAR) * dt;
    this.rearWheel.spin.rotation.x = this.wheelAng;
    this.frontWheel.spin.rotation.x = this.wheelAng;
    const blur = clamp((speed - 4) / 8, 0, 0.35);
    this.rearWheel.blur.material.opacity = this.frontWheel.blur.material.opacity = blur;
    const th = this.crank;
    this.crankG.rotation.x = th;
    const CR = 0.17;
    const pedalPos = [
      new THREE.Vector3(-0.15, P.bb.y + CR * Math.sin(th), P.bb.z - CR * Math.cos(th)),
      new THREE.Vector3(0.15, P.bb.y - CR * Math.sin(th), P.bb.z + CR * Math.cos(th)),
    ];
    this.pedals.forEach((p, i) => p.position.copy(pedalPos[i]));

    // ---- steering
    this.steer = damp(this.steer, st.steer, 6, dt);
    this.fork.quaternion.setFromAxisAngle(this.headAxis, this.steer);
    this.fork.updateMatrix();

    // flag flutter
    const fa = this.flag.geometry.attributes.position;
    for (let i = 0; i < fa.count; i++) {
      const x = this.flagBase[i * 3];
      fa.setZ(i, Math.sin(x * 18 - t * (8 + speed)) * x * 0.25);
    }
    fa.needsUpdate = true;

    // ---- body posture
    this.stand = damp(this.stand, st.climb ? 1 : 0, 3, dt);
    const pedalRock = Math.sin(th);
    const bodyOff = _d.set(0, 0.012 * Math.sin(th * 2) + this.stand * 0.06, this.stand * 0.08);
    this.body.position.set(0, 1.08, -0.16).add(bodyOff);
    this.body.rotation.set(-0.55 + this.stand * 0.15, pedalRock * 0.03 * (1 + this.stand * 2), pedalRock * (0.03 + this.stand * 0.08));
    this.body.updateMatrix();
    this.lean.rotation.z += pedalRock * this.stand * 0.05;

    // ---- legs (IK to pedals)
    for (const L of this.legs) {
      const i = L.s < 0 ? 0 : 1;
      const hip = new THREE.Vector3(L.s * 0.11, 0.9, -0.22).add(bodyOff);
      const ped = pedalPos[i];
      const ankleT = new THREE.Vector3(ped.x, ped.y + 0.032, ped.z - 0.07);
      const polev = new THREE.Vector3(L.s * 0.25, 0.25, 1);
      ik(hip, ankleT, 0.4, 0.38, polev, L.kneeP, L.end);
      placeLimb(L.thigh, hip, L.kneeP);
      placeLimb(L.shin, L.kneeP, L.end);
      L.knee.position.copy(L.kneeP);
      L.ankle.position.copy(L.end);
      L.foot.position.copy(L.end);
      const ang = (i ? -1 : 1) * th;
      L.foot.rotation.set(0.12 + 0.18 * Math.cos(ang), 0, 0);
    }

    // ---- wings
    this.handsFree = damp(this.handsFree, st.handsFree || this.honkT > 0 ? 1 : 0, 5, dt);
    const hf = this.handsFree;
    const flapSpeed = this.honkT > 0 ? 16 : 7;
    for (const W of this.wings) {
      const i = W.s < 0 ? 0 : 1;
      const shoulder = new THREE.Vector3(W.s * 0.2, 0.12, 0.13).applyMatrix4(this.body.matrix);
      const grip = this.grips[i].clone().applyMatrix4(this.fork.matrix);
      const flap = Math.sin(t * flapSpeed + i * 0.3);
      const spread = new THREE.Vector3(W.s * 0.62, 0.22 + flap * 0.22, -0.05).add(shoulder);
      const target = grip.lerp(spread, hf);
      const elbowPole = new THREE.Vector3(W.s * 1, lerp(0.5, 0.3, hf), lerp(-0.7, -0.6, hf));
      ik(shoulder, target, 0.28, 0.28, elbowPole, W.elbow, W.end);
      const nrm = new THREE.Vector3(W.s, 0.15, 0).normalize().lerp(new THREE.Vector3(0, 1, 0), hf).normalize();
      placeFlat(W.up, shoulder, W.elbow, nrm, 0.11, 0.045, 1.25);
      placeFlat(W.cov, shoulder.clone().lerp(W.elbow, 0.1), W.elbow, nrm, 0.13, 0.03, 1.15);
      placeFlat(W.fore, W.elbow, W.end, nrm, 0.08, 0.035, 1.25);
      // hand / primaries
      W.hand.position.copy(W.end);
      W.hand.quaternion.copy(W.fore.quaternion);
      const fan = lerp(0.12, 0.26, hf);
      W.feathers.forEach((f, k) => {
        f.rotation.set(0, 0, W.s * (-(k - 1) * fan) - W.s * 0.1);
        f.scale.setScalar(lerp(0.55, 1.2, hf) * (1 - k * 0.04));
      });
    }

    // ---- neck & head
    this.honkT = Math.max(0, this.honkT - dt);
    const base = this.neckBase.clone().applyMatrix4(this.body.matrix);
    const bob = Math.sin(th * 2 + 0.6) * 0.01;
    const headPos = new THREE.Vector3(0 + this.lookYaw * 0.06, 1.98 + bob + this.stand * 0.05, 0.08 + this.stand * 0.1);
    if (this.honkT > 0) headPos.y += Math.abs(Math.sin(this.honkT * 9)) * 0.05;
    const ctrl = new THREE.Vector3(0, 1.72 + this.stand * 0.05, -0.24 + this.stand * 0.06);
    this.swallow = Math.min(1, this.swallow + dt * 1.6);
    const NR = this.neckRings, NS = this.neckSides;
    const npos = this.neckMesh.geometry.attributes.position, nnor = this.neckMesh.geometry.attributes.normal;
    for (let i = 0; i < NR; i++) {
      const u = i / (NR - 1);
      this.neckPts[i].set(0, 0, 0)
        .addScaledVector(base, (1 - u) * (1 - u))
        .addScaledVector(ctrl, 2 * u * (1 - u))
        .addScaledVector(headPos, u * u);
    }
    for (let i = 0; i < NR; i++) {
      const u = i / (NR - 1);
      const p = this.neckPts[i];
      const tng = _a.subVectors(this.neckPts[Math.min(i + 1, NR - 1)], this.neckPts[Math.max(i - 1, 0)]).normalize();
      const bn = _b.set(1, 0, 0).addScaledVector(tng, -tng.x).normalize();
      const nn = _c.crossVectors(tng, bn);
      let r = lerp(0.115, 0.06, Math.pow(u, 0.7));
      const bump = Math.exp(-((u - (1 - this.swallow)) ** 2) / 0.006);
      r *= 1 + (this.swallow < 1 ? bump * 0.55 : 0);
      for (let j = 0; j < NS; j++) {
        const ph = (j / NS) * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
        const nx = bn.x * cs + nn.x * sn, ny = bn.y * cs + nn.y * sn, nz = bn.z * cs + nn.z * sn;
        const k = i * NS + j;
        npos.setXYZ(k, p.x + nx * r, p.y + ny * r, p.z + nz * r);
        nnor.setXYZ(k, nx, ny, nz);
      }
    }
    npos.needsUpdate = nnor.needsUpdate = true;
    this.neckCap.position.copy(this.neckPts[0]);
    this.neckCap.scale.setScalar(0.115);
    // scarf around the lower neck
    const k0 = this.neckPts[1], k1 = this.neckPts[3];
    this.scarfKnot.position.copy(k0).lerp(k1, 0.5);
    this.scarfKnot.quaternion.setFromUnitVectors(_a.set(0, 0, 1), _c.subVectors(k1, k0).normalize());
    this.scarfKnot.scale.setScalar(1.05);
    const wind = clamp(speed / 6, 0, 1);
    this.scarfTails.forEach((S, j) => {
      const pa = S.m.geometry.attributes.position;
      const start = _a.copy(this.scarfKnot.position).add(_c.set(j ? 0.03 : -0.03, -0.02, -0.1));
      const dir = _d.set(0, lerp(-1, 0.12, wind), lerp(-0.25, -1, wind)).normalize();
      const len = 0.62 + j * 0.1;
      for (let i = 0; i <= S.SEG; i++) {
        const u = i / S.SEG;
        const wav = Math.sin(t * (6 + speed * 1.4) - u * 7 + j * 1.7) * 0.07 * u * (0.3 + wind);
        const wav2 = Math.sin(t * (5 + speed) - u * 5 + j) * 0.05 * u * (0.3 + wind);
        const cx = start.x + dir.x * u * len + wav + (j ? 0.03 : -0.03) * u;
        const cy = start.y + dir.y * u * len + wav2;
        const cz = start.z + dir.z * u * len;
        const hw = 0.04 * (1 - u * 0.3);
        pa.setXYZ(i * 2, cx - hw, cy, cz);
        pa.setXYZ(i * 2 + 1, cx + hw, cy + hw * 0.4, cz);
      }
      pa.needsUpdate = true;
      S.m.geometry.computeVertexNormals();
    });

    this.head.position.copy(headPos);
    // look toward the camera when honking, otherwise glance around
    let ty = Math.sin(t * 0.37) * 0.25 * Math.max(0, Math.sin(t * 0.13)), tp = 0;
    if (this.honkT > 0 && st.camLocal) {
      const d = _c.copy(st.camLocal).sub(headPos);
      ty = clamp(Math.atan2(d.x, d.z), -1.3, 1.3);
      tp = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.5);
    }
    this.lookYaw = damp(this.lookYaw, ty, 6, dt);
    this.lookPitch = damp(this.lookPitch, tp, 6, dt);
    this.head.rotation.set(this.lookPitch - this.stand * 0.1, this.lookYaw, -this.lookYaw * 0.15, 'YXZ');
    this.crest.forEach((c, i) => { c.rotation.set(0.25 + Math.sin(t * (9 + speed) + i) * 0.12 * (0.3 + wind), (i - 1.5) * 0.15, 0); });

    // ---- beak, jaw, pouch
    let jawT = this.jawTarget;
    if (this.honkT > 0) jawT = Math.max(0, Math.sin(this.honkT * 14)) * 0.9;
    this.jaw = damp(this.jaw, jawT, 14, dt);
    this.jawG.rotation.x = this.jaw * 0.5;
    const pk = 60, pd = 7;
    this.pouchV += (-(this.pouch - 1) * pk - this.pouchV * pd) * dt;
    this.pouch += this.pouchV * dt;
    const breathe = 1 + Math.sin(t * 3.1) * 0.03 + Math.sin(t * (4 + speed)) * 0.02 * wind;
    this.pouchM.scale.set(0.058 * (0.75 + this.pouch * 0.25), 0.09 * this.pouch * breathe * (1 + this.jaw * 0.5), 0.3);
    this.pouchM.position.y = -0.06 - (this.pouch - 1) * 0.04 - this.jaw * 0.02;

    // blink
    this.blinkT -= dt;
    let lid = 1;
    if (this.blinkT < 0.12) lid = Math.abs(this.blinkT - 0.06) / 0.06;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;
    this.eyes.forEach((e) => (e.scale.y = Math.max(0.08, lid)));

    this.root.updateMatrixWorld(true);
    this.head.getWorldPosition(this.headWorld);
    this.beakTip.getWorldPosition(this.beakWorld);
  }

  setNight(n) {
    this.headlight.intensity = n * 90;
    this.lens.material.emissiveIntensity = 0.2 + n * 5;
    this.tailLight.material.emissiveIntensity = 0.4 + n * 4;
  }
}
