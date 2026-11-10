// 海岸公路世界：鹈鹕固定在原点，世界向 -x 滚动；道具到边界后回绕并缩放淡入
import * as THREE from 'three';

// 固定种子的随机数，保证每次打开布景一致
let seed = 20260607;
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const R = (a, b) => a + (b - a) * rand();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ── 几何体烘焙：把多个部件合并成一个带顶点色的网格，减少 draw call ──
const _c = new THREE.Color();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
function TRS(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, order = 'XYZ') {
  _e.set(rx, ry, rz, order);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e), new THREE.Vector3(sx, sy, sz));
}
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88 });

// parts: [geometry, 颜色 | (cx,cy,cz)=>颜色, Matrix4?]
function bake(parts, mat = vcMat, shadow = true) {
  const P = [], C = [];
  for (const [geo, color, m] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const a = g.attributes.position.array;
    const cols = [];
    for (let i = 0; i < a.length; i += 9) {
      if (typeof color === 'function') {
        _c.set(color((a[i] + a[i + 3] + a[i + 6]) / 3, (a[i + 1] + a[i + 4] + a[i + 7]) / 3, (a[i + 2] + a[i + 5] + a[i + 8]) / 3));
      } else _c.set(color);
      for (let k = 0; k < 3; k++) cols.push(_c.r, _c.g, _c.b);
    }
    if (m) g.applyMatrix4(m);
    const b = g.attributes.position.array;
    for (let i = 0; i < b.length; i++) P.push(b[i]);
    for (let i = 0; i < cols.length; i++) C.push(cols[i]);
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  return mesh;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);

// ── 贴图 ──
function tileTexture(size, base, blots, n, rmin, rmax) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const x = rand() * size, y = rand() * size, r = R(rmin, rmax);
    g.fillStyle = blots[i % blots.length];
    g.globalAlpha = R(0.25, 0.6);
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4b5059'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = pick(['#5a606a', '#41454d', '#666c76']);
    g.globalAlpha = R(0.3, 0.8);
    const x = rand() * 512, y = rand() * 256, s = R(1, 3);
    g.fillRect(x, y, s, s); g.fillRect(x - 512, y, s, s);
  }
  g.globalAlpha = 1;
  g.fillStyle = '#f2f2ea';
  g.fillRect(0, 9, 512, 7); g.fillRect(0, 240, 512, 7);
  g.fillStyle = '#ffd95a';
  g.fillRect(40, 124, 230, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,1)');
  gr.addColorStop(0.25, 'rgba(255,220,150,0.55)');
  gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = bg; g.fillRect(8, 8, 240, 112);
  g.fillStyle = fg;
  g.font = 'bold 50px system-ui, "Noto Sans CJK SC", "PingFang SC", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── 滚动层 ──
class Scroller {
  constructor(parent, half, fade) { this.parent = parent; this.half = half; this.fade = fade; this.items = []; }
  add(obj, x, y, z) {
    obj.position.set(x, y, z);
    obj.userData.base = obj.scale.clone();
    this.parent.add(obj);
    this.items.push(obj);
    return obj;
  }
  update(dx) {
    const { half, fade } = this;
    for (const o of this.items) {
      let x = o.position.x - dx;
      if (x < -half) x += 2 * half; else if (x > half) x -= 2 * half;
      o.position.x = x;
      let e = clamp01((half - Math.abs(x)) / fade);
      e = e * e * (3 - 2 * e);
      o.visible = e > 0.001;
      o.scale.copy(o.userData.base).multiplyScalar(Math.max(e, 0.001));
    }
  }
}

export function createWorld(scene) {
  const world = new THREE.Group();
  scene.add(world);
  const spinners = [], bobbers = [];

  // 夜晚发光的共享材质
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3cf, emissive: 0xffd98a, emissiveIntensity: 0 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x9db8c9, emissive: 0xffc56e, emissiveIntensity: 0, roughness: 0.3 });
  const glowTex = glowTexture();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false });
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false });
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, fog: false });

  // ── 天空 ──
  const skyU = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uDisc: { value: new THREE.Color() }, uGlow: { value: 0.4 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uSunDir, uDisc; uniform float uGlow; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.5));
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          col += uDisc * (pow(s, 6.0) * 0.18 + pow(s, 48.0) * 0.45) * uGlow;
          col = mix(col, uDisc, smoothstep(0.9983, 0.9988, s));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // 星星
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const u = rand() * Math.PI * 2, v = Math.asin(R(0.04, 1));
    starPos.push(Math.cos(u) * Math.cos(v) * 1400, Math.sin(v) * 1400, Math.sin(u) * Math.cos(v) * 1400);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── 地面：草地 / 公路 / 沙滩 / 海 ──
  const ROAD_Z0 = -3.2, ROAD_Z1 = 1.2;
  const grassTex = tileTexture(256, '#69b34c', ['#5aa544', '#7cc25a', '#4f9a3e', '#8acb62'], 150, 6, 26);
  grassTex.repeat.set(1600 / 20, 700 / 20);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(1600, 700).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  grass.position.set(0, 0, ROAD_Z1 + 350);
  grass.receiveShadow = true;
  world.add(grass);

  const roadTex = roadTexture();
  roadTex.repeat.set(1600 / 8, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1600, ROAD_Z1 - ROAD_Z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 }));
  road.position.set(0, 0, (ROAD_Z0 + ROAD_Z1) / 2);
  road.receiveShadow = true;
  world.add(road);

  const sandTex = tileTexture(256, '#efd9a0', ['#e6cd8e', '#f6e4b4', '#dfc584'], 120, 5, 22);
  sandTex.repeat.set(1600 / 10, 1);
  const sandGeo = new THREE.PlaneGeometry(1600, 9.8).rotateX(-Math.PI / 2);
  {
    const p = sandGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getZ(i) > 0 ? 0 : -0.88);
    sandGeo.computeVertexNormals();
  }
  const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
  sand.position.set(0, -0.005, ROAD_Z0 - 4.9);
  sand.receiveShadow = true;
  world.add(sand);

  const SHORE = -8.0, SEA_Y = -0.44;
  const seaU = {
    uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFogColor: { value: new THREE.Color() },
    uSpark: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
    uTime: { value: 0 }, uScroll: { value: 0 }, uFogNear: { value: 70 }, uFogFar: { value: 380 }, uShore: { value: SHORE },
  };
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(3200, 1600).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: seaU, fog: false, toneMapped: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform vec3 uDeep, uShallow, uFogColor, uSpark, uFoam;
        uniform float uTime, uScroll, uFogNear, uFogFar, uShore;
        varying vec3 vW;
        void main(){
          vec2 p = vec2(vW.x + uScroll, vW.z);
          float dist = distance(vW, cameraPosition);
          float detail = 1.0 - smoothstep(30.0, 170.0, dist);
          vec3 col = mix(uDeep, uShallow, smoothstep(uShore - 34.0, uShore, vW.z));
          float w = sin(p.x * 0.55 + sin(p.y * 0.33 + uTime * 0.6) * 1.6 + uTime * 0.8) * sin(p.y * 0.85 - uTime * 1.1 + sin(p.x * 0.21) * 2.0);
          col += 0.045 * w * detail;
          float sp = pow(max(0.0, sin(p.x * 1.7 + uTime * 1.3) * sin(p.y * 2.3 - uTime * 0.9 + p.x * 0.5)), 10.0);
          col += uSpark * sp * 0.45 * detail;
          float edge = uShore - 0.7 - 0.55 * sin(uTime * 0.9 + p.x * 0.23) - 0.22 * sin(p.x * 1.1 + uTime * 1.7);
          float foam = smoothstep(edge - 0.45, edge, vW.z);
          float edge2 = edge - 2.6 - 0.5 * sin(uTime * 0.6 + p.x * 0.31);
          foam = max(foam, 0.55 * smoothstep(0.22, 0.0, abs(vW.z - edge2)));
          col = mix(col, uFoam, foam * 0.85);
          col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sea.position.set(0, SEA_Y, -6 - 800);
  world.add(sea);

  // ── 道具 ──
  function palm() {
    const parts = [];
    const lean = R(-0.5, 0.8), h = R(4.2, 5.8), n = 6;
    let tx = 0, ty = 0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      tx = lean * u * u * 1.4; ty = (i + 0.5) * (h / n);
      parts.push([cyl(0.15 - i * 0.012, 0.18 - i * 0.012, h / n + 0.06, 6), i % 2 ? 0x9b7653 : 0x8a6846, TRS(tx, ty, 0, 0, 0, -lean * u * 0.45)]);
    }
    ty += h / n / 2;
    const leafGeo = cone(0.36, 2.7, 4); leafGeo.translate(0, 1.35, 0);
    const k = 9, a0 = rand() * 6;
    for (let i = 0; i < k; i++) {
      parts.push([leafGeo, i % 2 ? 0x2f9f50 : 0x41b862, TRS(tx, ty, 0, 0, a0 + (i / k) * Math.PI * 2, -(1.15 + R(0, 0.65)), 1, 1, 0.14, 'YZX')]);
    }
    parts.push([leafGeo, 0x4cc46c, TRS(tx, ty, 0, 0, 0, 0.1, 0.6, 0.5, 0.1)]);
    for (let i = 0; i < 3; i++) parts.push([ico(0.14, 0), 0x6b4a2a, TRS(tx + Math.cos(i * 2.1) * 0.2, ty - 0.18, Math.sin(i * 2.1) * 0.2)]);
    return bake(parts);
  }
  function tree() {
    const g1 = pick([0x3f9d4a, 0x4fb054, 0x2f8a45]), g2 = pick([0x5cbf5c, 0x48a851, 0x6fc968]);
    return bake([
      [cyl(0.16, 0.26, 1.8, 6), 0x7a5536, TRS(0, 0.9, 0)],
      [ico(1.35, 0), g1, TRS(0, 2.6, 0, rand(), rand(), 0)],
      [ico(1.0, 0), g2, TRS(0.75, 3.3, 0.3, rand(), rand(), 0)],
      [ico(0.9, 0), g1, TRS(-0.6, 3.25, -0.35, rand(), rand(), 0)],
      [ico(0.75, 0), g2, TRS(0.1, 3.9, 0.1, rand(), rand(), 0)],
    ]);
  }
  function pine() {
    const g = pick([0x2c7a4b, 0x33885a]);
    return bake([
      [cyl(0.14, 0.2, 1.2, 6), 0x6e4b30, TRS(0, 0.6, 0)],
      [cone(1.3, 1.9, 7), g, TRS(0, 1.9, 0)],
      [cone(1.0, 1.7, 7), 0x3a9763, TRS(0, 2.9, 0)],
      [cone(0.7, 1.5, 7), g, TRS(0, 3.8, 0)],
    ]);
  }
  function bush() {
    return bake([
      [ico(0.55, 0), 0x4aa24f, TRS(0, 0.3, 0, rand(), rand(), 0, 1, 0.75, 1)],
      [ico(0.42, 0), 0x5cb85c, TRS(0.45, 0.25, 0.15, rand(), rand(), 0, 1, 0.75, 1)],
      [ico(0.36, 0), 0x3f9547, TRS(-0.4, 0.2, -0.1, rand(), rand(), 0, 1, 0.75, 1)],
    ]);
  }
  function rock() {
    const c = pick([0x9aa0a6, 0x8a8f96, 0xb0b3b8]);
    return bake([
      [ico(0.5, 0), c, TRS(0, 0.18, 0, rand() * 3, rand() * 3, 0, R(0.8, 1.4), R(0.5, 0.8), R(0.8, 1.2))],
      [ico(0.28, 0), 0x7d838a, TRS(0.5, 0.1, 0.2, rand() * 3, rand() * 3, 0)],
    ]);
  }
  function flowers() {
    const parts = [];
    const n = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const x = R(-0.6, 0.6), z = R(-0.6, 0.6), h = R(0.22, 0.42);
      const col = pick([0xff5d73, 0xffd23f, 0xffffff, 0xc77dff, 0xff8fab, 0xff9f1c]);
      parts.push([cyl(0.014, 0.014, h, 4), 0x3d8f3d, TRS(x, h / 2, z)]);
      parts.push([ico(0.075, 0), col, TRS(x, h + 0.03, z, rand(), rand(), 0, 1, 0.6, 1)]);
      parts.push([ico(0.032, 0), 0xffe066, TRS(x, h + 0.075, z)]);
    }
    for (let i = 0; i < 5; i++) {
      parts.push([cone(0.05, R(0.2, 0.34), 3), 0x58a942, TRS(R(-0.7, 0.7), 0.12, R(-0.7, 0.7), R(-0.2, 0.2), rand() * 3, R(-0.2, 0.2))]);
    }
    return bake(parts);
  }
  function house() {
    const wall = pick([0xfff1d6, 0xffd9c2, 0xd9ecff, 0xfde6a8]), roof = pick([0xd9534f, 0xc0603a, 0x4f7cac]);
    const g = new THREE.Group();
    g.add(bake([
      [box(4.2, 2.6, 3.4), wall, TRS(0, 1.3, 0)],
      [cone(3.5, 1.7, 4), roof, TRS(0, 3.45, 0, 0, Math.PI / 4, 0, 1, 1, 1)],
      [box(0.5, 1.2, 0.5), 0x8d6e63, TRS(1.1, 3.6, 0.4)],
      [box(0.8, 1.5, 0.1), 0x7b4a2b, TRS(0, 0.75, -1.72)],
      [box(5.0, 0.12, 4.2), 0xcfcfc4, TRS(0, 0.06, 0)],
    ]));
    const wins = [];
    for (const z of [-1.71, 1.71]) for (const x of [-1.3, 1.3]) wins.push([box(0.8, 0.8, 0.08), 0xffffff, TRS(x, 1.55, z)]);
    const w = bake(wins, windowMat, false);
    w.geometry.deleteAttribute('color');
    g.add(w);
    return g;
  }
  function windmill() {
    const g = new THREE.Group();
    g.add(bake([
      [cyl(0.55, 1.0, 6.5, 8), 0xf7f3e8, TRS(0, 3.25, 0)],
      [cone(0.75, 1.0, 8), 0xc0504d, TRS(0, 7.0, 0)],
      [box(0.5, 1.0, 0.1), 0x7b4a2b, TRS(0, 0.5, -0.95)],
      [cyl(0.12, 0.12, 0.7, 6), 0x555555, TRS(0, 6.2, -0.75, Math.PI / 2, 0, 0)],
    ]));
    const bl = [];
    for (let i = 0; i < 4; i++) {
      bl.push([box(0.12, 3.4, 0.06), 0x8d6e63, TRS(0, 0, 0, 0, 0, i * Math.PI / 2).multiply(TRS(0, 1.7, 0))]);
      bl.push([box(0.7, 2.5, 0.04), 0xfdfbf2, TRS(0, 0, 0, 0, 0, i * Math.PI / 2).multiply(TRS(0.38, 2.0, 0))]);
    }
    const blades = bake(bl);
    blades.position.set(0, 6.2, -1.1);
    g.add(blades);
    spinners.push(blades);
    return g;
  }
  function umbrella() {
    const a = pick([0xff5d73, 0x2ec4b6, 0xff9f1c, 0x4f7cac]);
    const stripe = (cx, cy, cz) => (Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 8 + 0.001) % 2 ? a : 0xffffff);
    return bake([
      [cyl(0.03, 0.03, 2.3, 5), 0xeeeeee, TRS(0, 1.15, 0, 0, 0, 0.12)],
      [cone(1.45, 0.55, 8), stripe, TRS(-0.14, 2.3, 0, 0, 0, 0.12)],
      [box(0.85, 0.04, 1.7), pick([0xffd23f, 0x7bdff2, 0xf7aef8]), TRS(0.5, 0.03, 0.3, 0, 0.3, 0)],
      [ico(0.24, 1), (cx, cy) => (cy > 0.08 ? 0xff5d73 : cy < -0.08 ? 0x3a86ff : 0xffffff), TRS(-0.9, 0.24, 0.8)],
    ]);
  }
  function lampPost() {
    const g = new THREE.Group();
    g.add(bake([
      [cyl(0.055, 0.085, 4.3, 6), 0x2f4050, TRS(0, 2.15, 0)],
      [cyl(0.14, 0.16, 0.3, 6), 0x2f4050, TRS(0, 0.15, 0)],
      [box(0.07, 0.07, 1.35), 0x2f4050, TRS(0, 4.3, 0.62)],
      [box(0.3, 0.1, 0.46), 0x2f4050, TRS(0, 4.26, 1.25)],
    ]));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lampMat);
    bulb.position.set(0, 4.17, 1.25);
    g.add(bulb);
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(0, 4.15, 1.25); glow.scale.setScalar(2.4);
    g.add(glow);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), poolMat);
    pool.position.set(0, 0.03, 1.6);
    pool.renderOrder = 2;
    g.add(pool);
    return g;
  }
  function bollard() {
    return bake([
      [cyl(0.07, 0.08, 0.62, 6), 0xf4f4ee, TRS(0, 0.31, 0)],
      [cyl(0.083, 0.083, 0.12, 6), 0xe23b3b, TRS(0, 0.45, 0)],
    ]);
  }
  function sign(text, bg, fg) {
    const g = new THREE.Group();
    g.add(bake([[cyl(0.04, 0.04, 1.9, 5), 0x8a8f96, TRS(0, 0.95, 0)]]));
    const b = new THREE.Mesh(box(1.3, 0.65, 0.05), [
      vcWhite, vcWhite, vcWhite, vcWhite,
      new THREE.MeshStandardMaterial({ map: signTexture(text, bg, fg), roughness: 0.7 }), vcWhite,
    ]);
    b.position.set(0, 1.75, 0.05);
    b.castShadow = true;
    g.add(b);
    return g;
  }
  const vcWhite = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8 });

  function sailboat() {
    const sailCol = pick([0xffffff, 0xff6b6b, 0xffd23f, 0x7bdff2]);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2.2, 0, 0, 0, 4.2, 0, 0, 0, 0, 0, 4.2, 0, 2.2, 0, 0], 3));
    const jib = new THREE.BufferGeometry();
    jib.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 3.4, 0, -1.5, 0, 0, 0, 0, 0, -1.5, 0, 0, 0, 3.4, 0], 3));
    const m = bake([
      [box(4.4, 0.7, 1.4), 0xf5f0e6, TRS(0, 0.2, 0)],
      [box(4.5, 0.16, 1.5), 0xc0504d, TRS(0, 0.55, 0)],
      [cone(0.75, 1.2, 4), 0xf5f0e6, TRS(2.7, 0.2, 0, 0, 0, -Math.PI / 2, 0.47, 1, 0.94)],
      [cyl(0.05, 0.05, 5, 5), 0x6e4b30, TRS(0, 3, 0)],
      [tri, sailCol, TRS(-2.1, 1.0, 0)],
      [jib, 0xffffff, TRS(1.7, 1.0, 0)],
    ], vcMat, false);
    return m;
  }
  function island(withLighthouse) {
    const g = new THREE.Group();
    const w = R(28, 46), h = R(7, 13);
    g.add(bake([
      [ico(1, 1), 0xe8d59a, TRS(0, -0.4, 0, 0, rand() * 3, 0, w * 1.15, 2.2, w * 0.75)],
      [ico(1, 1), 0x4f9d55, TRS(0, 0.5, 0, 0, rand() * 3, 0, w, h, w * 0.6)],
      [ico(1, 1), 0x3f8d4a, TRS(w * 0.45, 0.3, 2, 0, rand() * 3, 0, w * 0.5, h * 0.6, w * 0.4)],
    ], vcMat, false));
    if (withLighthouse) {
      const stripes = (cx, cy) => (Math.floor((cy + 6) / 2.4) % 2 ? 0xe23b3b : 0xffffff);
      const lh = bake([
        [cyl(1.3, 2.0, 12, 10), stripes, TRS(0, 6, 0)],
        [cyl(1.7, 1.7, 0.4, 10), 0x333a44, TRS(0, 12.2, 0)],
        [cone(1.5, 1.6, 10), 0xe23b3b, TRS(0, 15.0, 0)],
      ], vcMat, false);
      lh.position.set(-w * 0.35, h * 0.72, 0);
      g.add(lh);
      const lampM = new THREE.Mesh(cyl(1.1, 1.1, 1.8, 8), lampMat);
      lampM.position.set(-w * 0.35, h * 0.72 + 13.3, 0);
      g.add(lampM);
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(lampM.position); glow.scale.setScalar(22);
      g.add(glow);
    }
    return g;
  }
  function cloud() {
    const parts = [];
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const s = R(3, 6.5) * (1 - Math.abs(i - (n - 1) / 2) / n);
      parts.push([ico(1, 1), 0xffffff, TRS((i - (n - 1) / 2) * 4.6, R(-0.6, 0.8), R(-1.5, 1.5), rand(), rand(), 0, s * 1.25, s * 0.72, s)]);
    }
    const m = bake(parts, cloudMat, false);
    m.geometry.deleteAttribute('color');
    return m;
  }
  function balloon() {
    const a = pick([0xff5d73, 0xff9f1c, 0x9b5de5]), b = pick([0xffd23f, 0xffffff, 0x7bdff2]);
    const stripe = (cx, cy, cz) => (Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 10 + 0.001) % 2 ? a : b);
    return bake([
      [new THREE.SphereGeometry(4, 20, 12), stripe, TRS(0, 0, 0, 0, 0, 0, 1, 1.15, 1)],
      [cone(2.6, 3.2, 20), stripe, TRS(0, -4.6, 0, Math.PI, 0, 0)],
      [box(1.3, 1.1, 1.3), 0x9b6b3d, TRS(0, -8.2, 0)],
      [cyl(0.03, 0.03, 2.4, 4), 0x555555, TRS(0.6, -6.9, 0.6)],
      [cyl(0.03, 0.03, 2.4, 4), 0x555555, TRS(-0.6, -6.9, 0.6)],
      [cyl(0.03, 0.03, 2.4, 4), 0x555555, TRS(0.6, -6.9, -0.6)],
      [cyl(0.03, 0.03, 2.4, 4), 0x555555, TRS(-0.6, -6.9, -0.6)],
    ], vcMat, false);
  }
  function hill() {
    const c = pick([0x58a64a, 0x4d9a48, 0x66b254, 0x449045]);
    return bake([[ico(1, 1), c, TRS(0, 0, 0, 0, rand() * 3, 0, R(26, 48), R(7, 16), R(22, 36))]], vcMat, false);
  }

  // ── 布置 ──
  const near = new Scroller(world, 96, 12);
  const far = new Scroller(world, 360, 45);

  for (let i = 0; i < 8; i++) near.add(lampPost(), -96 + i * 24 + 6, 0, ROAD_Z0 - 0.3);
  for (let i = 0; i < 32; i++) { if (i % 4 !== 1) near.add(bollard(), -96 + i * 6, 0, ROAD_Z0 - 0.15); }
  for (let i = 0; i < 9; i++) {
    const p = palm(); p.scale.setScalar(R(0.85, 1.2)); p.rotation.y = rand() * 6;
    near.add(p, -96 + i * 21.3 + R(-4, 4), -0.12, R(-4.6, -6.6));
  }
  for (let i = 0; i < 4; i++) { const u = umbrella(); u.rotation.y = rand() * 6; near.add(u, -80 + i * 47 + R(-6, 6), -0.28, R(-5.6, -6.6)); }
  for (let i = 0; i < 7; i++) { const r = rock(); r.scale.setScalar(R(0.6, 1.5)); near.add(r, R(-96, 96), -0.3, R(-5, -7.4)); }
  for (let i = 0; i < 26; i++) { const f = flowers(); near.add(f, -96 + i * 7.4 + R(-2, 2), 0, i % 3 === 0 ? R(1.7, 2.6) : R(2.4, 7)); }
  for (let i = 0; i < 8; i++) { const b = bush(); b.scale.setScalar(R(0.9, 1.7)); near.add(b, R(-96, 96), 0, R(4.5, 12)); }
  for (let i = 0; i < 6; i++) { const r = rock(); r.scale.setScalar(R(0.5, 1.1)); near.add(r, R(-96, 96), 0, R(2.5, 10)); }
  for (let i = 0; i < 16; i++) {
    const t = rand() < 0.3 ? pine() : tree(); t.scale.setScalar(R(0.9, 1.7)); t.rotation.y = rand() * 6;
    near.add(t, -96 + i * 12 + R(-4, 4), 0, R(9, 34));
  }
  [[-60, 17], [5, 21], [62, 16]].forEach(([x, z]) => { const h = house(); h.rotation.y = R(-0.25, 0.25); near.add(h, x, 0, z); });
  near.add(windmill(), 34, 0, 26);
  const s1 = sign('鱼市 2km', '#1f7a4d', '#ffffff'); s1.rotation.y = Math.PI * 0.8; near.add(s1, -30, 0, 2.2);
  const s2 = sign('小心鹈鹕', '#ffd23f', '#222222'); s2.rotation.y = Math.PI * 0.8; near.add(s2, 50, 0, 2.2);

  for (let i = 0; i < 12; i++) { far.add(hill(), -360 + i * 60 + R(-12, 12), -1.5, R(60, 150)); }
  for (let i = 0; i < 3; i++) far.add(island(i === 1), -300 + i * 240 + R(-30, 30), SEA_Y, R(-150, -250));
  for (let i = 0; i < 6; i++) {
    const b = sailboat(); b.rotation.y = R(-0.4, 0.4) + (rand() < 0.5 ? Math.PI : 0); b.scale.setScalar(R(0.9, 1.5));
    far.add(b, -360 + i * 120 + R(-30, 30), SEA_Y, R(-24, -95));
    bobbers.push({ o: b, y: SEA_Y, ph: rand() * 6 });
  }
  for (let i = 0; i < 14; i++) {
    const c = cloud(); c.scale.setScalar(R(1.2, 2.6));
    far.add(c, -360 + i * 51 + R(-15, 15), R(38, 80), R(-330, 160));
  }
  for (let i = 0; i < 3; i++) {
    const b = balloon();
    far.add(b, -300 + i * 240 + R(-40, 40), R(24, 40), R(-120, -45));
    bobbers.push({ o: b, y: b.position.y, ph: rand() * 6, amp: 1.2, sp: 0.35 });
  }

  // ── 海鸥（跟着鹈鹕一起飞） ──
  const gulls = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    g.add(bake([
      [ico(1, 1), 0xffffff, TRS(0, 0, 0, 0, 0, 0, 0.42, 0.14, 0.15)],
      [ico(0.11, 1), 0xffffff, TRS(0.4, 0.06, 0)],
      [cone(0.04, 0.16, 4), 0xffb703, TRS(0.56, 0.05, 0, 0, 0, -Math.PI / 2)],
      [cone(0.12, 0.3, 3), 0xdddddd, TRS(-0.5, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.3)],
    ], vcMat, false));
    const wings = [];
    for (const s of [1, -1]) {
      const w = bake([
        [box(0.3, 0.025, 0.55), 0xf4f4f4, TRS(0, 0, s * 0.28)],
        [box(0.2, 0.02, 0.5), 0x555b66, TRS(-0.03, 0, s * 0.78, 0, s * 0.25, 0)],
      ], vcMat, false);
      g.add(w); wings.push({ w, s });
    }
    scene.add(g);
    gulls.push({ g, wings, ph: i * 1.7, cx: R(-4, 6), cy: R(4.5, 8), cz: R(-5, -13), sp: R(0.25, 0.45) });
  }

  // ── 跃出海面的海豚 ──
  const dolphin = bake([
    [ico(1, 2), (cx, cy) => (cy < -0.25 ? 0xdfe9f0 : 0x5b7f99), TRS(0, 0, 0, 0, 0, 0, 1.1, 0.3, 0.27)],
    [cone(0.14, 0.5, 6), 0x5b7f99, TRS(1.15, -0.03, 0, 0, 0, -Math.PI / 2)],
    [cone(0.16, 0.42, 4), 0x4f7189, TRS(-0.05, 0.36, 0, 0, 0, 0.5, 1, 1, 0.3)],
    [cone(0.2, 0.5, 4), 0x4f7189, TRS(-1.2, 0, 0.18, Math.PI / 2 - 0.5, 0, 0.3, 1, 1, 0.25)],
    [cone(0.2, 0.5, 4), 0x4f7189, TRS(-1.2, 0, -0.18, -Math.PI / 2 + 0.5, 0, 0.3, 1, 1, 0.25)],
  ], vcMat, false);
  dolphin.visible = false;
  scene.add(dolphin);
  const dol = { t: -4, dur: 1.5, x: 0, z: -18 };

  // ── 车轮扬尘 ──
  const dustGeo = new THREE.IcosahedronGeometry(1, 1);
  const dust = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: 0xe9dfc8, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    scene.add(m);
    dust.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, s: 0.1 });
  }
  let dustI = 0, dustAcc = 0;
  function puff(x, y, z, vx, vy, vz, s, life) {
    const d = dust[dustI++ % dust.length];
    d.m.position.set(x, y, z); d.vx = vx; d.vy = vy; d.vz = vz; d.s = s; d.life = d.max = life; d.m.visible = true;
  }

  let scroll = 0;
  return {
    // 落地时的一圈尘土
    burst(x, z) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        puff(x + Math.cos(a) * 0.3, 0.08, z + Math.sin(a) * 0.3, Math.cos(a) * 1.6, 0.7, Math.sin(a) * 1.6, 0.16, 0.7);
      }
    },
    applyEnv(env, sunDir) {
      skyU.uTop.value.copy(env.skyTop);
      skyU.uHorizon.value.copy(env.horizon);
      skyU.uSunDir.value.copy(sunDir);
      skyU.uDisc.value.copy(env.disc);
      skyU.uGlow.value = env.glow;
      seaU.uDeep.value.copy(env.seaDeep);
      seaU.uShallow.value.copy(env.seaShallow);
      seaU.uFogColor.value.copy(env.horizon);
      seaU.uSpark.value.copy(env.disc);
      seaU.uFoam.value.copy(env.foam);
      starMat.opacity = env.stars;
      stars.visible = env.stars > 0.01;
      lampMat.emissiveIntensity = env.lamps * 3;
      windowMat.emissiveIntensity = env.lamps * 1.6;
      glowMat.opacity = env.lamps * 0.9;
      poolMat.opacity = env.lamps * 0.3;
      cloudMat.color.copy(env.cloud);
    },
    update(dt, t, speed, riderZ, airborne) {
      const dx = speed * dt;
      scroll += dx;
      roadTex.offset.x = (scroll / 8) % 1;
      grassTex.offset.x = (scroll / 20) % 1;
      sandTex.offset.x = (scroll / 10) % 1;
      seaU.uScroll.value = scroll % 5000;
      seaU.uTime.value = t;
      near.update(dx);
      far.update(dx);
      stars.rotation.y = t * 0.003;

      for (const s of spinners) s.rotation.z = t * 0.9;
      for (const b of bobbers) {
        b.o.position.y = b.y + Math.sin(t * (b.sp || 1.3) + b.ph) * (b.amp || 0.12);
        if (!b.amp) b.o.rotation.z = Math.sin(t * 1.1 + b.ph) * 0.05;
      }
      for (const gl of gulls) {
        const a = t * gl.sp + gl.ph;
        gl.g.position.set(gl.cx + Math.sin(a) * 5, gl.cy + Math.sin(a * 1.7) * 0.8, gl.cz + Math.cos(a * 0.8) * 2.5);
        gl.g.rotation.y = -Math.cos(a * 0.8) * 0.25;
        gl.g.rotation.z = Math.cos(a * 1.7) * 0.15;
        const glide = Math.sin(a * 0.6) > 0.55 ? 0.15 : 1;   // 偶尔滑翔
        const f = Math.sin(t * 8 + gl.ph) * 0.65 * glide + 0.1;
        for (const { w, s } of gl.wings) w.rotation.x = -s * f;
      }

      // 海豚
      dol.t += dt;
      if (dol.t > dol.dur) {
        dolphin.visible = false;
        if (dol.t > dol.dur + dol.gap) { dol.t = 0; dol.x = R(-6, 14); dol.z = R(-15, -26); dol.gap = R(3, 7); }
      } else if (dol.t >= 0) {
        const u = dol.t / dol.dur;
        dolphin.visible = true;
        dol.x += (5.5 - speed) * dt;
        dolphin.position.set(dol.x + u * 0, SEA_Y - 0.7 + 3.0 * Math.sin(Math.PI * u), dol.z);
        dolphin.rotation.z = Math.cos(Math.PI * u) * 0.95;
      }
      if (dol.gap === undefined) dol.gap = 2;

      // 扬尘
      dustAcc += dt * Math.min(speed, 10);
      if (dustAcc > 0.45 && !airborne) {
        dustAcc = 0;
        puff(-0.72, 0.06, riderZ + R(-0.05, 0.05), -speed * 0.45, R(0.3, 0.7), R(-0.25, 0.25), R(0.05, 0.09), 0.6);
      }
      for (const d of dust) {
        if (d.life <= 0) continue;
        d.life -= dt;
        if (d.life <= 0) { d.m.visible = false; continue; }
        const u = 1 - d.life / d.max;
        d.m.position.x += (d.vx - speed * 0.3) * dt;
        d.m.position.y += d.vy * dt;
        d.m.position.z += d.vz * dt;
        d.vx *= 1 - dt * 2; d.vz *= 1 - dt * 2;
        d.m.scale.setScalar(d.s * (1 + u * 2.2));
        d.m.material.opacity = 0.32 * (1 - u);
      }
    },
  };
}
