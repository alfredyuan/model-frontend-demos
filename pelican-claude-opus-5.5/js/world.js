import * as THREE from 'three';
import { Road, terrainBase, islandEdge, ROAD_HALF, SEA_FLOOR } from './road.js';
import { clamp, lerp, smoothstep, fbm, mulberry32, M4, mergeColored, canvasTexture, radialTexture } from './util.js';

const TERRAIN_SIZE = 320;

// ---------------------------------------------------------------- sky / time keys
const SKY_KEYS = [
  { e: -0.4, top: 0x040816, hor: 0x0b1430, light: 0x9fb4ff, li: 0.55, hemi: 0.5, sea: 0x020a18 },
  { e: -0.1, top: 0x0b1636, hor: 0x2b2a58, light: 0x9fb4ff, li: 0.45, hemi: 0.45, sea: 0x05122a },
  { e: 0.0, top: 0x283a78, hor: 0xff7e4a, light: 0xff6a35, li: 0.7, hemi: 0.5, sea: 0x14324f },
  { e: 0.12, top: 0x4876c0, hor: 0xffc38c, light: 0xffc080, li: 2.0, hemi: 0.85, sea: 0x0d4a6e },
  { e: 0.45, top: 0x3a7ed8, hor: 0xbde0f6, light: 0xfff3e0, li: 3.0, hemi: 1.15, sea: 0x0b5578 },
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
function keyLerp(e, field, out) {
  const K = SKY_KEYS;
  if (e <= K[0].e) return out.set(K[0][field]);
  for (let i = 0; i < K.length - 1; i++) {
    if (e <= K[i + 1].e) {
      const t = (e - K[i].e) / (K[i + 1].e - K[i].e);
      return out.lerpColors(_ca.set(K[i][field]), _cb.set(K[i + 1][field]), t);
    }
  }
  return out.set(K[K.length - 1][field]);
}
function keyNum(e, field) {
  const K = SKY_KEYS;
  if (e <= K[0].e) return K[0][field];
  for (let i = 0; i < K.length - 1; i++)
    if (e <= K[i + 1].e) return lerp(K[i][field], K[i + 1][field], (e - K[i].e) / (K[i + 1].e - K[i].e));
  return K[K.length - 1][field];
}

export class World {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.road = new Road();
    this.rand = mulberry32(20240607);
    this.exclusions = [];
    this.night = 0;
    this.sunDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.anim = [];

    this._lights();
    this._sky();
    this._sea();
    this._terrain();
    this._roadMesh();
    this._startArch();
    this._lighthouse();
    this._turbines();
    this._village();
    this._lamps();
    this._vegetation();
    this._clouds();
    this._birds();
    this._boats();
    this.setTime(0.36);
  }

  groundHeight(x, z) { return this.road.groundHeight(x, z); }

  // ------------------------------------------------------------ lights
  _lights() {
    const hemi = (this.hemi = new THREE.HemisphereLight(0xbfdfff, 0x5a6b3a, 1));
    this.scene.add(hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 3));
    sun.castShadow = true;
    const sm = this.quality.shadow;
    sun.shadow.mapSize.set(sm, sm);
    const c = sun.shadow.camera;
    c.left = -18; c.right = 18; c.top = 18; c.bottom = -18; c.near = 1; c.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
  }

  // ------------------------------------------------------------ sky dome + stars
  _sky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
        uMoonDir: { value: new THREE.Vector3() }, uNight: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = vec4(p.xy, p.w * 0.99995, p.w);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uHor, uSunDir, uSunCol, uMoonDir; uniform float uNight;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 col = mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.55));
          float sd = max(dot(d, uSunDir), 0.0);
          float hz = 1.0 - clamp(abs(y) * 2.5, 0.0, 1.0);
          col += uSunCol * (pow(sd, 6.0) * 0.25 * (0.4 + hz) + pow(sd, 60.0) * 0.6);
          col += uSunCol * smoothstep(0.9992, 0.99955, sd) * 6.0 * (1.0 - uNight);
          float md = max(dot(d, uMoonDir), 0.0);
          col += vec3(0.75, 0.8, 1.0) * (smoothstep(0.9993, 0.9996, md) * 1.6 + pow(md, 80.0) * 0.18) * uNight;
          col = mix(col, uHor, smoothstep(0.02, -0.12, y));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const sky = (this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat));
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.scene.add(sky);

    const N = 1400, pos = new Float32Array(N * 3);
    const R = this.rand;
    for (let i = 0; i < N; i++) {
      const u = R() * 2 - 1, th = R() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 850, y * 850, Math.sin(th) * r * 850], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    sky.add(this.stars);
  }

  // ------------------------------------------------------------ ocean
  _sea() {
    // height texture so the water shader knows the depth (shore foam + shallow colour)
    const W = 256, data = new Uint8Array(W * W * 4);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const x = (i / (W - 1) - 0.5) * TERRAIN_SIZE, z = (j / (W - 1) - 0.5) * TERRAIN_SIZE;
      const h = terrainBase(x, z);
      const v = clamp((h - SEA_FLOOR) / 12, 0, 1);
      data[(j * W + i) * 4] = v * 255;
      data[(j * W + i) * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, W, W);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;

    const mat = (this.seaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uHeight: { value: tex }, uSize: { value: TERRAIN_SIZE },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
        uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() },
        uFogNear: { value: 60 }, uFogFar: { value: 420 },
      },
      vertexShader: /* glsl */`
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uSize, uFogNear, uFogFar;
        uniform sampler2D uHeight;
        uniform vec3 uSunDir, uSunCol, uTop, uHor, uDeep, uShallow;
        varying vec3 vW;
        vec2 wave(vec2 p, vec2 d, float k, float a, float s){
          float ph = dot(p, d) * k + uTime * s;
          return d * (a * k * cos(ph));
        }
        void main(){
          vec2 p = vW.xz;
          vec2 g = wave(p, normalize(vec2(1.0, 0.3)), 0.35, 0.18, 1.3)
                 + wave(p, normalize(vec2(-0.4, 1.0)), 0.52, 0.12, 1.7)
                 + wave(p, normalize(vec2(0.7, -0.8)), 1.3, 0.04, 2.6)
                 + wave(p, normalize(vec2(-0.9, -0.2)), 2.4, 0.02, 3.4)
                 + wave(p, normalize(vec2(0.2, 0.95)), 4.1, 0.01, 4.3);
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 V = normalize(cameraPosition - vW);
          float dist = length(cameraPosition - vW);
          n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(20.0, 140.0, dist) * 0.85));
          vec2 uv = p / uSize + 0.5;
          float h = -7.0;
          if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) h = texture2D(uHeight, uv).r * 12.0 - 7.0;
          float depth = max(-h, 0.0);
          vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 5.0, depth));
          vec3 R = reflect(-V, n);
          vec3 sky = mix(uHor, uTop, clamp(R.y * 1.6, 0.0, 1.0));
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          vec3 col = mix(water, sky, clamp(fres * 1.1, 0.0, 1.0));
          float spec = pow(max(dot(R, uSunDir), 0.0), 220.0);
          col += uSunCol * spec * 4.0;
          col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 12.0) * 0.08;
          // shore foam
          float band = 1.0 - smoothstep(0.0, 1.6, depth);
          float wv = sin(depth * 7.0 - uTime * 1.8 + sin(p.x * 0.3) * 1.5 + sin(p.y * 0.27));
          float foam = band * smoothstep(0.35, 0.95, wv) + smoothstep(0.35, 0.0, depth);
          col = mix(col, vec3(0.92, 0.96, 1.0) * (0.35 + 0.65 * max(uSunDir.y + 0.4, 0.15)), clamp(foam, 0.0, 1.0) * 0.8);
          col = mix(col, uHor, smoothstep(uFogNear, uFogFar, dist));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), mat);
    sea.position.y = 0;
    this.scene.add(sea);
  }

  // ------------------------------------------------------------ terrain
  _terrain() {
    const SEG = this.quality.terrainSeg;
    const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const near = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.road.groundHeight(x, z));
      const n = this.road.nearest(x, z);
      near[i] = n ? n.d : 99;
    }
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), t = new THREE.Color();
    const C = {
      wet: new THREE.Color(0xb59a6a), sand: new THREE.Color(0xecd7a0), grassA: new THREE.Color(0x4f9a36),
      grassB: new THREE.Color(0x93c052), dry: new THREE.Color(0xc2b56a), rock: new THREE.Color(0x8b8478),
      shoulder: new THREE.Color(0x9d8f74), snow: new THREE.Color(0xf4f4f0),
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ny = nrm.getY(i);
      const v = fbm(x * 0.05, z * 0.05, 3);
      c.copy(C.grassA).lerp(C.grassB, smoothstep(0.35, 0.7, v));
      c.lerp(C.dry, smoothstep(0.62, 0.8, fbm(x * 0.02 + 40, z * 0.02, 2)) * 0.6);
      c.lerp(C.rock, smoothstep(0.86, 0.7, ny));
      c.lerp(C.rock, smoothstep(17, 24, y) * 0.8);
      c.lerp(C.snow, smoothstep(27, 31, y));
      c.lerp(C.sand, smoothstep(2.6, 1.7, y));
      c.lerp(C.wet, smoothstep(0.7, -0.4, y));
      if (y < -0.5) c.multiplyScalar(lerp(1, 0.55, smoothstep(-0.5, -5, y)));
      c.lerp(t.copy(C.shoulder), smoothstep(ROAD_HALF + 1.6, ROAD_HALF + 0.3, near[i]) * 0.9);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const detail = canvasTexture(256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const v = 200 + Math.random() * 55;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
    detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
    detail.repeat.set(90, 90);
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: detail }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrain = mesh;
  }

  // ------------------------------------------------------------ road ribbon
  _roadMesh() {
    const road = this.road, N = road.N;
    const tex = canvasTexture(256, 512, (g, w, h) => {
      g.fillStyle = '#4b4d55'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = 60 + Math.random() * 60;
        g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = '#f2f2ea';
      g.fillRect(10, 0, 9, h); g.fillRect(w - 19, 0, 9, h);
      g.fillStyle = '#ffd23f';
      g.fillRect(w / 2 - 5, 0, 10, h * 0.5);
      g.fillStyle = 'rgba(30,30,30,0.25)';
      g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
    });
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2);
    const idx = [];
    for (let j = 0; j <= N; j++) {
      const i = j % N;
      const rx = -road.tz[i], rz = road.tx[i];
      const y = road.py[i] + 0.02;
      pos.set([road.px[i] - rx * ROAD_HALF, y, road.pz[i] - rz * ROAD_HALF, road.px[i] + rx * ROAD_HALF, y, road.pz[i] + rz * ROAD_HALF], j * 6);
      const v = (j * road.ds) / 8;
      uv.set([0, v, 1, v], j * 4);
      if (j < N) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // delineator posts along both edges
    const step = 14, count = Math.floor(road.length / step);
    const postGeo = mergeColored([
      { geo: new THREE.BoxGeometry(0.1, 0.8, 0.1), m: M4(0, 0.4, 0), color: 0xf4f4f4 },
      { geo: new THREE.BoxGeometry(0.11, 0.12, 0.11), m: M4(0, 0.68, 0), color: 0xff4a3a },
    ]);
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), count * 2);
    const S = {}, m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      road.sample(i * step + 3, S);
      for (const side of [-1, 1]) {
        const x = S.x + S.rx * side * (ROAD_HALF + 0.7), z = S.z + S.rz * side * (ROAD_HALF + 0.7);
        m.makeTranslation(x, this.groundHeight(x, z), z);
        posts.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m);
      }
    }
    this.scene.add(posts);
  }

  _exclude(x, z, r) { this.exclusions.push({ x, z, r }); }
  _blocked(x, z, pad = 0) {
    for (const e of this.exclusions) if ((e.x - x) ** 2 + (e.z - z) ** 2 < (e.r + pad) ** 2) return true;
    return false;
  }

  // ------------------------------------------------------------ start/finish arch
  _startArch() {
    const S = this.road.sample(0, {});
    const g = new THREE.Group();
    g.position.set(S.x, S.y, S.z);
    g.rotation.y = Math.atan2(S.tx, S.tz);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const W = ROAD_HALF + 0.6;
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.4, 12), postMat);
      p.position.set(sx * W, 2.2, 0); p.castShadow = true; g.add(p);
      // balloons
      const cols = [0xff4d6d, 0xffd23f, 0x3ec1ff];
      cols.forEach((c, i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.25 }));
        const a = (i / 3) * Math.PI * 2;
        b.position.set(sx * W + Math.cos(a) * 0.3, 4.75 + i * 0.12, Math.sin(a) * 0.3);
        b.scale.y = 1.15;
        g.add(b);
        this.anim.push((t) => { b.position.y = 4.75 + i * 0.12 + Math.sin(t * 2 + i + sx) * 0.06; });
      });
    }
    const banner = canvasTexture(1024, 160, (c, w, h) => {
      for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        c.fillRect(i * 32, j * 16, 32, 16); c.fillRect(i * 32, h - 32 + j * 16, 32, 16);
      }
      c.fillStyle = '#e63946'; c.fillRect(0, 32, w, h - 64);
      c.fillStyle = '#fff'; c.font = 'bold 64px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('PELICAN GRAND TOUR · 鹈鹕环岛赛', w / 2, h / 2 + 3);
    });
    banner.anisotropy = 4;
    const bm = new THREE.MeshStandardMaterial({ map: banner, roughness: 0.6 });
    const side = new THREE.MeshStandardMaterial({ color: 0xe63946 });
    const bannerMesh = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.3, 0.85, 0.06), [side, side, side, side, bm, bm]);
    bannerMesh.position.y = 3.85; bannerMesh.castShadow = true;
    g.add(bannerMesh);
    // checkered start line
    const chk = canvasTexture(256, 32, (c, w, h) => {
      for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'; c.fillRect(i * 16, j * 16, 16, 16); }
    });
    chk.magFilter = THREE.NearestFilter;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 0.5).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: chk, polygonOffset: true, polygonOffsetFactor: -2 }));
    line.position.y = 0.04; line.receiveShadow = true;
    g.add(line);
    this.scene.add(g);
    this.archPos = g.position.clone();
    this._exclude(S.x, S.z, 6);
  }

  // ------------------------------------------------------------ lighthouse
  _lighthouse() {
    let bestA = 0, best = -1;
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * Math.PI * 2;
      const n = this.road.nearest(Math.cos(a) * 80, Math.sin(a) * 80);
      const roadR = n ? Math.hypot(this.road.px[n.i], this.road.pz[n.i]) : 80;
      const gap = islandEdge(a) - roadR;
      if (gap > best) { best = gap; bestA = a; }
    }
    const r = islandEdge(bestA) - 9;
    const x = Math.cos(bestA) * r, z = Math.sin(bestA) * r;
    const y0 = Math.max(this.groundHeight(x, z), 0.5);
    const g = new THREE.Group();
    g.position.set(x, y0, z);
    const red = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf8f8f2, roughness: 0.5 });
    const rock = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.95, flatShading: true });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.8, 8, 9), rock);
    base.position.y = -3.4; g.add(base);
    const H = 2;
    for (let i = 0; i < 6; i++) {
      const r0 = 1.55 - i * 0.09, r1 = 1.55 - (i + 1) * 0.09;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, H, 20), i % 2 ? white : red);
      s.position.y = 0.6 + H * i + H / 2; s.castShadow = true; g.add(s);
    }
    const top = 0.6 + H * 6;
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.4, metalness: 0.6 });
    const gal = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.2, 20), dark);
    gal.position.y = top + 0.1; g.add(gal);
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe08a, emissiveIntensity: 0.3, roughness: 0.1 });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 16), this.lampMat);
    glass.position.y = top + 0.85; g.add(glass);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.0, 16), red);
    roof.position.y = top + 2.0; g.add(roof);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), dark);
    ball.position.y = top + 2.55; g.add(ball);

    // rotating light beams
    const beamMat = (this.beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uOpacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float a = pow(vUv.y, 2.0) * pow(abs(dot(vN, vV)), 1.5) * uOpacity;
          gl_FragColor = vec4(vec3(1.0, 0.92, 0.7) * a, a); }`,
    }));
    const beamGeo = new THREE.ConeGeometry(4.5, 60, 24, 1, true).translate(0, -30, 0).rotateZ(Math.PI / 2);
    const beams = new THREE.Group();
    beams.position.y = top + 0.85;
    for (const ry of [0, Math.PI]) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.rotation.y = ry; b.rotation.z = -0.06;
      beams.add(b);
    }
    g.add(beams);
    this.anim.push((t) => { beams.rotation.y = t * 0.9; });
    this.scene.add(g);
    this._exclude(x, z, 6);
  }

  // ------------------------------------------------------------ wind turbines
  _turbines() {
    const R = this.rand, spots = [];
    for (let i = 0; i < 2500; i++) {
      const a = R() * Math.PI * 2, r = 20 + R() * 95;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const n = this.road.nearest(x, z);
      if (n && n.d < 16) continue;
      const h = this.groundHeight(x, z);
      if (h < 4) continue;
      spots.push({ x, z, h });
    }
    spots.sort((a, b) => b.h - a.h);
    const chosen = [];
    for (const s of spots) {
      if (chosen.length >= 4) break;
      if (Math.hypot(s.x, s.z) < 16) continue; // keep the summit clear
      if (chosen.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > 30)) chosen.push(s);
    }
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f5, roughness: 0.45 });
    this.turbineLightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const towerGeo = new THREE.CylinderGeometry(0.22, 0.42, 17, 12).translate(0, 8.5, 0);
    const bladeGeo = new THREE.BoxGeometry(0.42, 7.5, 0.08).translate(0, 3.9, 0);
    chosen.forEach((s, idx) => {
      const g = new THREE.Group();
      g.position.set(s.x, s.h - 0.3, s.z);
      g.rotation.y = 0.6;
      const tower = new THREE.Mesh(towerGeo, white); tower.castShadow = true; g.add(tower);
      const nac = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.8), white); nac.position.set(0, 17.2, 0); g.add(nac);
      const rotor = new THREE.Group(); rotor.position.set(0, 17.2, 1.0); g.add(rotor);
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), white));
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(bladeGeo, white); b.rotation.z = (i / 3) * Math.PI * 2; b.castShadow = true; rotor.add(b);
      }
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.turbineLightMat);
      light.position.set(0, 17.65, -0.4); g.add(light);
      const sp = 0.9 + idx * 0.17, ph = idx * 1.7;
      this.anim.push((t) => { rotor.rotation.z = t * sp + ph; });
      this.scene.add(g);
      this._exclude(s.x, s.z, 4);
    });
  }

  // ------------------------------------------------------------ village (instanced)
  _village() {
    const road = this.road, L = road.length, S = {};
    const houses = [];
    let side = 1;
    for (let s = L * 0.52; s < L * 0.66; s += 13 + this.rand() * 6) {
      road.sample(s, S);
      side = -side;
      const off = ROAD_HALF + 7 + this.rand() * 3;
      const x = S.x + S.rx * side * off, z = S.z + S.rz * side * off;
      if (this._blocked(x, z, 4)) continue;
      const yaw = Math.atan2(-S.rx * side, -S.rz * side); // face the road
      houses.push({ x, z, y: this.groundHeight(x, z), yaw, w: 3 + this.rand() * 0.8, d: 3.4 + this.rand(), h: 2.3 + this.rand() * 0.8 });
      this._exclude(x, z, 5);
    }
    const n = houses.length;
    const walls = [0xf6d7a7, 0xf7b7a3, 0xa8d8ea, 0xfff1c1, 0xc5e3a5, 0xe4c1f9];
    const roofs = [0xc0392b, 0x8d5a3b, 0x2f5f8f, 0xd35400];
    const lam = (o = {}) => new THREE.MeshLambertMaterial(o);
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), lam(), n);
    const roofGeo = new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateX(-Math.PI / 2);
    const roof = new THREE.InstancedMesh(roofGeo, lam({ flatShading: true }), n);
    const chim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), lam({ color: 0x7b5b4b }), n);
    const door = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.75, 1.3), lam({ color: 0x6b3f22, polygonOffset: true, polygonOffsetFactor: -1 }), n);
    this.windowMat = new THREE.MeshStandardMaterial({ color: 0x9fd3f0, emissive: 0xffc56a, emissiveIntensity: 0, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -1 });
    const win = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.62, 0.62), this.windowMat, n * 6);
    const fence = [];
    const c = new THREE.Color();
    let wi = 0;
    const base = new THREE.Matrix4(), m = new THREE.Matrix4();
    houses.forEach((h, i) => {
      base.copy(M4(h.x, h.y - 0.6, h.z, 0, h.yaw, 0));
      body.setMatrixAt(i, m.multiplyMatrices(base, M4(0, 0, 0, 0, 0, 0, h.w, h.h + 0.6, h.d)));
      body.setColorAt(i, c.set(walls[i % walls.length]));
      // prism circumradius r -> base width r*sqrt3, scale so it overhangs the walls
      const rw = (h.w + 0.5) / Math.sqrt(3);
      roof.setMatrixAt(i, m.multiplyMatrices(base, M4(0, h.h + 0.6 + rw * 0.25, 0, 0, 0, 0, rw, rw * 0.5, h.d + 0.5)));
      roof.setColorAt(i, c.set(roofs[i % roofs.length]));
      chim.setMatrixAt(i, m.multiplyMatrices(base, M4(h.w * 0.25, h.h + 1.2 + rw * 0.4, -h.d * 0.2)));
      door.setMatrixAt(i, m.multiplyMatrices(base, M4(0, 0.6 + 0.65, h.d / 2 + 0.01)));
      const wy = 0.6 + h.h * 0.6;
      const wins = [
        [-h.w * 0.3, wy, h.d / 2 + 0.01, 0], [h.w * 0.3, wy, h.d / 2 + 0.01, 0],
        [-h.w * 0.3, wy, -h.d / 2 - 0.01, Math.PI], [h.w * 0.3, wy, -h.d / 2 - 0.01, Math.PI],
        [h.w / 2 + 0.01, wy, 0, Math.PI / 2], [-h.w / 2 - 0.01, wy, 0, -Math.PI / 2],
      ];
      for (const [wx, wyy, wz, ry] of wins) win.setMatrixAt(wi++, m.multiplyMatrices(base, M4(wx, wyy, wz, 0, ry, 0)));
      // chimney smoke puffs
      fence.push({ x: h.x, z: h.z, y: h.y, yaw: h.yaw, w: h.w, d: h.d, top: h.h + 1.8 + rw * 0.4 });
    });
    for (const im of [body, roof, chim]) { im.castShadow = true; im.receiveShadow = true; }
    this.scene.add(body, roof, chim, door, win);
    this.chimneys = fence.map((f) => {
      const v = new THREE.Vector3(f.w * 0.25, f.top - 0.6, -f.d * 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw);
      return new THREE.Vector3(f.x + v.x, f.y + v.y, f.z + v.z);
    });
  }

  // ------------------------------------------------------------ street lamps + light pools
  _lamps() {
    const road = this.road, step = 32, count = Math.floor(road.length / step), S = {};
    const poleGeo = mergeColored([
      { geo: new THREE.CylinderGeometry(0.06, 0.09, 4.2, 8), m: M4(0, 2.1, 0), color: 0x30343c },
      { geo: new THREE.BoxGeometry(0.06, 0.06, 1.3), m: M4(0, 4.15, 0.6), color: 0x30343c },
      { geo: new THREE.BoxGeometry(0.34, 0.12, 0.5), m: M4(0, 4.1, 1.2), color: 0x30343c },
    ]);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    const bulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.05, 0.4), this.bulbMat, count);
    this.poolMat = new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,210,140,1)'), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
    });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), this.poolMat, count);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < count; i++) {
      road.sample(i * step + 16, S);
      const off = -(ROAD_HALF + 1.0); // left side
      const x = S.x + S.rx * off, z = S.z + S.rz * off;
      if (this._blocked(x, z, 1)) continue;
      const y = this.groundHeight(x, z);
      const yaw = Math.atan2(S.rx, S.rz); // arm points toward road centre
      m.copy(M4(x, y, z, 0, yaw, 0)); poles.setMatrixAt(n, m);
      bulbs.setMatrixAt(n, m.multiply(M4(0, 4.03, 1.2)));
      pools.setMatrixAt(n, M4(x + S.rx * 1.2, S.y + 0.05, z + S.rz * 1.2));
      n++;
    }
    poles.count = bulbs.count = pools.count = n;
    poles.castShadow = true;
    this.scene.add(poles, bulbs, pools);
  }

  // ------------------------------------------------------------ trees, rocks, flowers
  _vegetation() {
    const R = this.rand;
    const pine = mergeColored([
      { geo: new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6), m: M4(0, 0.7, 0), color: 0x6b4426 },
      { geo: new THREE.ConeGeometry(1.35, 2.1, 7), m: M4(0, 2.0, 0), color: 0x2f6e3c },
      { geo: new THREE.ConeGeometry(1.05, 1.8, 7), m: M4(0, 3.0, 0, 0, 0.4), color: 0x37804a },
      { geo: new THREE.ConeGeometry(0.7, 1.5, 7), m: M4(0, 3.9, 0, 0, 0.8), color: 0x3f8f52 },
    ]);
    const round = mergeColored([
      { geo: new THREE.CylinderGeometry(0.13, 0.2, 1.7, 6), m: M4(0, 0.85, 0), color: 0x75492a },
      { geo: new THREE.IcosahedronGeometry(1.3, 0), m: M4(0, 2.5, 0), color: 0x5aa83f },
      { geo: new THREE.IcosahedronGeometry(0.85, 0), m: M4(0.55, 3.1, 0.25, 0.3, 0.2), color: 0x72bd4c },
      { geo: new THREE.IcosahedronGeometry(0.75, 0), m: M4(-0.5, 2.9, -0.35, 0.5, 0.7), color: 0x4f9c39 },
    ]);
    const palmParts = [];
    const tp = (t) => new THREE.Vector3(0.9 * t * t, 5.2 * t, 0);
    for (let i = 0; i < 7; i++) {
      const a = tp(i / 7), b = tp((i + 1) / 7);
      const d = b.clone().sub(a);
      const geo = new THREE.CylinderGeometry(0.17 - i * 0.008, 0.21 - i * 0.008, d.length() + 0.05, 7);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      palmParts.push({ geo, m: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), color: i % 2 ? 0x8a6a45 : 0x9c7b52 });
    }
    const top = tp(1);
    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.PlaneGeometry(1, 1, 1, 6);
      const p = leaf.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const u = p.getX(k), v = p.getY(k) + 0.5; // v in 0..1
        const t = v * 2.6;
        p.setXYZ(k, u * 0.62 * Math.sin(Math.PI * Math.min(v * 1.2, 1)) + 0.0001, 0.5 * t - 0.2 * t * t, t);
      }
      leaf.computeVertexNormals();
      palmParts.push({ geo: leaf, m: M4(top.x, top.y, top.z, 0, (i / 8) * Math.PI * 2 + R() * 0.3), color: i % 2 ? 0x3d9a3a : 0x4bb04a });
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      palmParts.push({ geo: new THREE.SphereGeometry(0.16, 6, 5), m: M4(top.x + Math.cos(a) * 0.2, top.y - 0.2, top.z + Math.sin(a) * 0.2), color: 0x5a3b1e });
    }
    const palm = mergeColored(palmParts);
    const rockGeo = mergeColored([{ geo: new THREE.DodecahedronGeometry(1, 0), color: 0x9a948a }]);
    const flowerGeo = mergeColored([
      { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.3, 3), m: M4(0, 0.15, 0), color: 0x3f8f3a },
      { geo: new THREE.IcosahedronGeometry(0.075, 0), m: M4(0, 0.32, 0), color: 0xffffff },
    ]);
    const tuftParts = [];
    for (let i = 0; i < 4; i++) tuftParts.push({ geo: new THREE.ConeGeometry(0.05, 0.5, 3), m: M4(0, 0.22, 0, Math.cos(i * 1.6) * 0.35, i * 1.6, Math.sin(i * 1.6) * 0.35), color: 0x5e9e3a });
    const tuftGeo = mergeColored(tuftParts);

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const q = this.quality.veg;
    const make = (geo, max, castShadow) => {
      const im = new THREE.InstancedMesh(geo, mat, max);
      im.castShadow = castShadow; im.receiveShadow = false; im.count = 0;
      this.scene.add(im); return im;
    };
    const sets = {
      pine: make(pine, Math.round(320 * q), true),
      round: make(round, Math.round(200 * q), true),
      palm: make(palm, Math.round(60 * q), true),
      rock: make(rockGeo, 90, true),
      flower: make(flowerGeo, Math.round(900 * q), false),
      tuft: make(tuftGeo, Math.round(1100 * q), false),
    };
    const c = new THREE.Color(), m = new THREE.Matrix4();
    const add = (im, x, y, z, s, ry, color, sy = s) => {
      if (im.count >= im.instanceMatrix.count) return false;
      m.copy(M4(x, y, z, 0, ry, 0, s, sy, s));
      im.setMatrixAt(im.count, m);
      im.setColorAt(im.count, color);
      im.count++;
      return true;
    };
    const slopeAt = (x, z) => Math.abs(this.groundHeight(x + 1, z) - this.groundHeight(x - 1, z)) + Math.abs(this.groundHeight(x, z + 1) - this.groundHeight(x, z - 1));
    for (let tries = 0; tries < 9000; tries++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 140;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = this.groundHeight(x, z);
      if (h < 1.2) continue;
      const n = this.road.nearest(x, z);
      const d = n ? n.d : 99;
      if (d < ROAD_HALF + 2.2) continue;
      if (this._blocked(x, z, 1.5)) continue;
      const sl = slopeAt(x, z);
      const ry = R() * Math.PI * 2;
      if (h < 2.8 && R() < 0.5) {
        add(sets.palm, x, h - 0.1, z, 0.8 + R() * 0.45, ry, c.setHSL(0, 0, 0.9 + R() * 0.1));
      } else if (h >= 2.8 && h < 24 && sl < 2.4) {
        const cluster = fbm(x * 0.03 + 5, z * 0.03 + 1, 2);
        if (cluster > 0.5 || R() < 0.12) {
          const isPine = h > 9 || R() < 0.45;
          add(isPine ? sets.pine : sets.round, x, h - 0.1, z, 0.75 + R() * 0.6, ry, c.setHSL(0.25 + R() * 0.08, 0.3, 0.85 + R() * 0.25), undefined);
        }
      }
      if (R() < 0.25 && sl < 3) add(sets.rock, x, h - 0.15, z, 0.3 + R() * 0.9, ry, c.setHSL(0.08, 0.05, 0.75 + R() * 0.25), 0.25 + R() * 0.4);
    }
    // flowers and grass hugging the roadside
    const S = {};
    const flowerCols = [0xffffff, 0xffe066, 0xff8fab, 0xc77dff, 0xff6b6b, 0x9bf6ff];
    for (let i = 0; i < 5000; i++) {
      this.road.sample(R() * this.road.length, S);
      const side = R() < 0.5 ? -1 : 1, off = ROAD_HALF + 1.2 + Math.pow(R(), 1.5) * 14;
      const x = S.x + S.rx * side * off, z = S.z + S.rz * side * off;
      const h = this.groundHeight(x, z);
      if (h < 1.6 || this._blocked(x, z)) continue;
      const nn = this.road.nearest(x, z);
      if (nn && nn.d < ROAD_HALF + 1.0) continue;
      if (R() < 0.45) add(sets.flower, x, h - 0.02, z, 0.8 + R() * 0.7, R() * 6, c.set(flowerCols[Math.floor(R() * flowerCols.length)]));
      else add(sets.tuft, x, h - 0.05, z, 0.7 + R() * 0.9, R() * 6, c.setHSL(0.22 + R() * 0.08, 0.5, 0.75 + R() * 0.3));
    }
    for (const k in sets) { sets[k].instanceMatrix.needsUpdate = true; if (sets[k].instanceColor) sets[k].instanceColor.needsUpdate = true; }
  }

  // ------------------------------------------------------------ clouds (instanced puffs)
  _clouds() {
    const R = this.rand, NC = 16, PUFFS = 7;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = (this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8899aa, emissiveIntensity: 0.25, flatShading: true }));
    const im = (this.cloudMesh = new THREE.InstancedMesh(geo, mat, NC * PUFFS));
    im.frustumCulled = false;
    this.clouds = [];
    for (let i = 0; i < NC; i++) {
      const cl = { x: (R() - 0.5) * 700, z: (R() - 0.5) * 700, y: 55 + R() * 40, puffs: [], speed: 1.5 + R() * 1.5 };
      const sc = 4 + R() * 5;
      for (let j = 0; j < PUFFS; j++) {
        cl.puffs.push({ x: (j - PUFFS / 2) * sc * 0.55 + (R() - 0.5) * sc * 0.6, y: R() * sc * 0.4, z: (R() - 0.5) * sc * 0.9, s: sc * (0.55 + R() * 0.5) * (1 - Math.abs(j - PUFFS / 2) / PUFFS) });
      }
      this.clouds.push(cl);
    }
    this.scene.add(im);
  }

  // ------------------------------------------------------------ seagulls
  _birds() {
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const grey = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
    const orange = new THREE.MeshLambertMaterial({ color: 0xffa62b });
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.15, 0, 0, -0.15, 0.9, 0, -0.25, 0, 0, 0.15, 0.9, 0, -0.25, 0.75, 0, 0.05]), 3));
    wingGeo.computeVertexNormals();
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.75, 0, 0.05, 0.9, 0, -0.25, 1.35, 0, -0.35]), 3));
    tipGeo.computeVertexNormals();
    const wmat = white.clone(); wmat.side = THREE.DoubleSide;
    const tmat = grey.clone(); tmat.side = THREE.DoubleSide;
    this.birds = [];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), white); body.scale.set(1, 0.9, 2.4); b.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), white); head.position.set(0, 0.08, 0.38); b.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 5).rotateX(Math.PI / 2), orange); beak.position.set(0, 0.06, 0.55); b.add(beak);
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.scale.x = s;
        w.add(new THREE.Mesh(wingGeo, wmat), new THREE.Mesh(tipGeo, tmat));
        w.position.set(s * 0.08, 0.05, 0); b.add(w); wings.push(w);
      }
      b.scale.setScalar(1.3);
      this.scene.add(b);
      this.birds.push({ g: b, wings, r: 10 + this.rand() * 18, h: 10 + this.rand() * 10, sp: (0.25 + this.rand() * 0.2) * (this.rand() < 0.5 ? -1 : 1), ph: this.rand() * 6.28, fp: this.rand() * 6.28 });
    }
    this.birdCenter = new THREE.Vector3();
  }

  // ------------------------------------------------------------ sailboats
  _boats() {
    this.boats = [];
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x1d5fa8, roughness: 0.5 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.8, side: THREE.DoubleSide });
    const sailMat2 = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 4.5, 8, 1).rotateX(Math.PI / 2), hullMat);
      hull.scale.set(1, 0.6, 1); hull.position.y = 0.2; g.add(hull);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 3.8), stripe); deck.position.y = 0.5; g.add(deck);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6), stripe); mast.position.set(0, 3.4, 0.4); g.add(mast);
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 5.4); sh.lineTo(-2.6, 0); sh.lineTo(0, 0);
      const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), sailMat); sail.rotation.y = Math.PI / 2; sail.position.set(0, 0.9, 0.3); g.add(sail);
      const sh2 = new THREE.Shape(); sh2.moveTo(0, 0); sh2.lineTo(0, 4.6); sh2.lineTo(1.8, 0); sh2.lineTo(0, 0);
      const jib = new THREE.Mesh(new THREE.ShapeGeometry(sh2), sailMat2); jib.rotation.y = Math.PI / 2; jib.position.set(0, 0.9, 0.55); g.add(jib);
      this.scene.add(g);
      this.boats.push({ g, r: 165 + i * 28, sp: (0.018 + i * 0.006) * (i % 2 ? -1 : 1), ph: i * 2.1 });
    }
  }

  // ------------------------------------------------------------ time of day
  setTime(tau) {
    this.tau = tau;
    const a = (tau - 0.25) * Math.PI * 2;
    const sun = this.sunDir.set(Math.cos(a), Math.sin(a), 0.38).normalize();
    const e = sun.y;
    const top = keyLerp(e, 'top', new THREE.Color());
    const hor = keyLerp(e, 'hor', new THREE.Color());
    const lightCol = keyLerp(e, 'light', new THREE.Color());
    const seaCol = keyLerp(e, 'sea', new THREE.Color());
    let li = keyNum(e, 'li');
    const hemiI = keyNum(e, 'hemi');
    const night = (this.night = 1 - smoothstep(-0.14, 0.06, e));
    const useSun = e > -0.05;
    this.lightDir.copy(sun);
    if (!useSun) this.lightDir.multiplyScalar(-1);
    li *= smoothstep(0, 0.05, Math.abs(e + 0.05)); // fade at the sun/moon hand-over

    this.sun.color.copy(lightCol);
    this.sun.intensity = li;
    this.hemi.color.copy(top).lerp(_ca.set(0xffffff), 0.35);
    this.hemi.groundColor.set(0x4a5a30).lerp(_ca.set(0x0a0c18), night);
    this.hemi.intensity = hemiI;

    const su = this.skyMesh.material.uniforms;
    su.uTop.value.copy(top); su.uHor.value.copy(hor);
    su.uSunDir.value.copy(sun); su.uMoonDir.value.copy(sun).multiplyScalar(-1);
    su.uSunCol.value.copy(keyLerp(Math.max(e, -0.02), 'light', new THREE.Color())).multiplyScalar(smoothstep(-0.2, 0.0, e));
    su.uNight.value = night;
    this.stars.material.opacity = night * 0.95;

    if (this.scene.fog) this.scene.fog.color.copy(hor);
    const sm = this.seaMat.uniforms;
    sm.uTop.value.copy(top); sm.uHor.value.copy(hor);
    sm.uSunDir.value.copy(this.lightDir);
    sm.uSunCol.value.copy(lightCol).multiplyScalar(Math.min(li, 2.2) * (useSun ? 1 : 1.6));
    sm.uDeep.value.copy(seaCol);
    sm.uShallow.value.set(0x2fbfb0).multiplyScalar(lerp(1, 0.12, night)).lerp(seaCol, 0.25);

    this.windowMat.emissiveIntensity = night * 1.6;
    this.lampMat.emissiveIntensity = 0.3 + night * 3;
    this.beamMat.uniforms.uOpacity.value = night * 0.55;
    this.bulbMat.color.set(0xcfcfcf).lerp(_ca.set(0xffe2a8).multiplyScalar(3), night);
    this.poolMat.opacity = night * 0.55;
    this.cloudMat.emissive.copy(hor).multiplyScalar(0.35 + 0.2 * (1 - night));
    this.cloudMat.emissiveIntensity = 0.6;
    this.renderer.toneMappingExposure = lerp(1.0, 1.25, night);
    return night;
  }

  // ------------------------------------------------------------ per-frame
  update(dt, t, focus, camera) {
    this.skyMesh.position.copy(camera.position);
    this.stars.rotation.y = t * 0.004;
    this.seaMat.uniforms.uTime.value = t;
    // shadow frustum follows the rider
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 70);
    this.turbineLightMat.color.setRGB(Math.sin(t * 3) > 0.3 ? 3 : 0.4, 0.05, 0.05);

    for (const f of this.anim) f(t);

    const m = new THREE.Matrix4();
    let k = 0;
    for (const cl of this.clouds) {
      cl.x += cl.speed * dt;
      if (cl.x > 380) cl.x -= 760;
      for (const p of cl.puffs) {
        m.makeScale(p.s, p.s * 0.7, p.s).setPosition(cl.x + p.x, cl.y + p.y, cl.z + p.z);
        this.cloudMesh.setMatrixAt(k++, m);
      }
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    this.birdCenter.lerp(focus, 1 - Math.exp(-dt * 0.5));
    for (const b of this.birds) {
      const a = t * b.sp + b.ph;
      const x = this.birdCenter.x + Math.cos(a) * b.r, z = this.birdCenter.z + Math.sin(a) * b.r;
      const y = this.birdCenter.y + b.h + Math.sin(t * 0.7 + b.ph) * 1.5;
      b.g.position.set(x, y, z);
      b.g.rotation.set(0, -a + (b.sp > 0 ? 0 : Math.PI), -Math.sign(b.sp) * 0.35);
      const flapping = Math.sin(t * 0.5 + b.fp) > -0.2;
      const f = flapping ? Math.sin(t * 9 + b.fp) * 0.55 : 0.12;
      b.wings[0].rotation.z = -f; b.wings[1].rotation.z = f;
    }
    for (const b of this.boats) {
      const a = t * b.sp + b.ph;
      b.g.position.set(Math.cos(a) * b.r, Math.sin(t * 1.3 + b.ph) * 0.12, Math.sin(a) * b.r);
      b.g.rotation.set(Math.sin(t * 1.1 + b.ph) * 0.05, -a + (b.sp > 0 ? 0 : Math.PI), Math.sin(t * 0.9 + b.ph) * 0.08 + 0.12 * Math.sign(b.sp));
    }
  }
}
