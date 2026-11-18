import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Everything in this little world is made here: no models, textures or network requests.
const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(pointer: coarse)').matches;
const state = { riding: !reducedMotion, speed: 1, night: false, sound: false, travel: 0, time: 0, bell: 0, nightMix: 0 };
let randomSeed = 818;
function random(min = 0, max = 1) { randomSeed = (randomSeed * 16807) % 2147483647; return min + (randomSeed / 2147483647) * (max - min); }
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .72, ...extra });
const M = {
  cream: mat('#fff6de'), feather: mat('#e8e8d9'), featherShade: mat('#c4cdbf'),
  featherDark: mat('#8c9d91'), black: mat('#243b38'), tire: mat('#344742'),
  rim: mat('#efe4c9', { metalness: .3, roughness: .43 }), metal: mat('#bdc6b8', { metalness: .65, roughness: .34 }),
  coral: mat('#dc7152'), coralDark: mat('#b6523d'), coralLight: mat('#efab84'),
  ochre: mat('#efb851'), pouch: mat('#ed9b5c'), foot: mat('#d8923f'),
  sage: mat('#88a68b'), sageDark: mat('#456e58'), sand: mat('#e3cda4'), sandLight: mat('#f0dfb6'),
  grass: mat('#acb88a'), grassDark: mat('#6f9165'), green: mat('#4d7958'), greenLight: mat('#85a46c'),
  road: mat('#879489'), white: mat('#fff4d8'), wood: mat('#aa8052'), woodLight: mat('#d1aa70'),
  stone: mat('#a4afa0'), stoneLight: mat('#ccd0b9'), oceanSide: mat('#6caaa0', { roughness: .4 }),
  glow: mat('#ffd99b', { emissive: '#ffc36d', emissiveIntensity: .1 }),
  glass: mat('#537b79', { metalness: .4, roughness: .18, emissive: '#e5c78e', emissiveIntensity: 0 }),
};
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function mesh(geometry, material, parent, pos, scale) {
  const object = new THREE.Mesh(geometry, material);
  if (pos) object.position.set(...pos);
  if (scale) object.scale.set(...scale);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
function ball(parent, material, pos, scale) { return mesh(sphereGeo, material, parent, pos, scale); }
function box(parent, material, pos, scale, rotation = 0) { const m = mesh(boxGeo, material, parent, pos, scale); m.rotation.y = rotation; return m; }
function tube(parent, points, radius, material, segments = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? v(...p) : p));
  return mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material, parent);
}
function rod(parent, a, b, radius, material, endRadius = radius, sides = 12) {
  const from = v(...a), to = v(...b), delta = to.clone().sub(from);
  const geometry = endRadius === radius ? cylinderGeo : new THREE.CylinderGeometry(endRadius / radius, 1, 1, sides);
  const m = mesh(geometry, material, parent);
  m.position.copy(from.add(to).multiplyScalar(.5));
  m.scale.set(radius, delta.length(), radius);
  m.quaternion.setFromUnitVectors(v(0, 1, 0), delta.normalize());
  return m;
}
function ring(parent, radius, thickness, material, pos, rot = [0, 0, 0]) {
  const m = mesh(new THREE.TorusGeometry(radius, thickness, 8, 56), material, parent, pos);
  m.rotation.set(...rot); return m;
}
function group(parent, pos) { const g = new THREE.Group(); if (pos) g.position.set(...pos); parent.add(g); return g; }

// Merge static pieces by material. Fine details stay inexpensive on a phone.
function batch(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), sets = new Map(), originals = [];
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const key = o.material.uuid;
    if (!sets.has(key)) sets.set(key, { material: o.material, position: [], normal: [], uv: [] });
    const target = sets.get(key);
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    for (const name of ['position', 'normal']) target[name].push(geo.attributes[name].array);
    target.uv.push(geo.attributes.uv ? geo.attributes.uv.array : new Float32Array(geo.attributes.position.count * 2));
    originals.push(o); geo.dispose();
  });
  for (const o of originals) o.removeFromParent();
  for (const data of sets.values()) {
    const geo = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const length = data[name].reduce((a, b) => a + b.length, 0), array = new Float32Array(length);
      let offset = 0; for (const part of data[name]) { array.set(part, offset); offset += part.length; }
      geo.setAttribute(name, new THREE.BufferAttribute(array, name === 'uv' ? 2 : 3));
    }
    geo.computeBoundingSphere(); mesh(geo, data.material, root);
  }
}

let renderer, scene, camera, controls;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('scene').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
} catch (error) {
  $('loading').classList.add('error');
  $('loading').lastElementChild.textContent = '这片海需要 WebGL 支持。请开启浏览器硬件加速，再来兜风。';
  console.error(error);
  throw error;
}
scene = new THREE.Scene();
camera = new THREE.OrthographicCamera(-8, 8, 5.3, -5.3, .1, 100);
const initialPosition = v(10.5, 8.4, 16), initialTarget = v(0, 1.65, .25);
camera.position.copy(initialPosition);
controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(initialTarget);
controls.enableDamping = !reducedMotion; controls.dampingFactor = .065;
controls.enablePan = false; controls.minZoom = .72; controls.maxZoom = 2.1;
controls.minPolarAngle = .32; controls.maxPolarAngle = Math.PI / 2.08;
controls.rotateSpeed = .65; controls.zoomSpeed = .65;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
controls.update();
const hemi = new THREE.HemisphereLight('#fff6df', '#7b978d', 2.7); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffedcf', 3.5); sun.position.set(-3, 10, 7); sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: .5, far: 35 });
sun.shadow.normalBias = .035; sun.shadow.bias = -.0003; sun.shadow.radius = 3; scene.add(sun);
const fill = new THREE.DirectionalLight('#cbe9e0', 1.1); fill.position.set(8, 4, -6); scene.add(fill);
const world = group(scene);
const scenery = group(world);

function softShadow(size, opacity, pos) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  gradient.addColorStop(0, `rgba(32,70,63,${opacity})`); gradient.addColorStop(.5, `rgba(32,70,63,${opacity * .4})`); gradient.addColorStop(1, 'rgba(32,70,63,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const m = mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }), world, pos);
  m.rotation.x = -Math.PI / 2; m.castShadow = false; return m;
}
softShadow(23, .2, [0, -1.13, .1]);
const seaBase = mesh(new THREE.CylinderGeometry(8.45, 8.22, .36, 96), M.oceanSide, scenery, [0, -.79, 0]);
const waterMaterial = new THREE.ShaderMaterial({
  transparent: false,
  uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
  vertexShader: `varying vec2 vXZ; uniform float uTime; void main(){vec3 p=position; vXZ=p.xy; p.z+=sin(p.x*1.9+uTime)*cos(p.y*1.5+uTime*.7)*.018; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader: `varying vec2 vXZ; uniform float uTime; uniform float uNight;
    void main(){vec2 p=vXZ; float d=length(p)/8.45;
      vec3 light=mix(vec3(.43,.70,.66),vec3(.62,.80,.72),1.-smoothstep(.3,1.,d));
      vec3 dark=mix(vec3(.13,.32,.37),vec3(.23,.49,.50),1.-d);
      vec3 col=mix(light,dark,uNight);
      float wave=sin(p.x*3.7+p.y*2.9+sin(p.y*1.6+uTime*.55)*1.1+uTime*.65);
      float lines=smoothstep(.972,.998,wave)*.13;
      float broken=smoothstep(.1,.7,sin(p.x*2.4-p.y*1.5+uTime*.3));
      col+=lines*broken*(1.-uNight*.5);
      float edge=smoothstep(.96,.998,d)*.09; col+=edge;
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const water = mesh(new THREE.CircleGeometry(8.45, 96), waterMaterial, world, [0, -.59, 0]);
water.rotation.x = -Math.PI / 2; water.castShadow = false; water.receiveShadow = false;

const islandShape = new THREE.Shape();
for (let i = 0; i <= 64; i++) {
  const a = i / 64 * TAU, wobble = 1 + Math.sin(a * 3 + .4) * .035 + Math.sin(a * 7) * .017;
  const x = Math.cos(a) * 6.68 * wobble, z = Math.sin(a) * 3.75 * wobble;
  i ? islandShape.lineTo(x, -z) : islandShape.moveTo(x, -z);
}
const island = mesh(new THREE.ExtrudeGeometry(islandShape, { depth: .62, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .22, bevelThickness: .17, curveSegments: 48 }), M.sand, scenery, [0, -.5, 0]);
island.rotation.x = -Math.PI / 2;
const grassyPatch = ball(scenery, M.grass, [-.6, .02, -1.1], [5.4, .27, 2.35]);
const roadCurve = new THREE.CatmullRomCurve3([v(-6.75, .34, .65), v(-4.4, .34, 1.25), v(0, .34, 1.3), v(4.2, .34, .9), v(6.6, .34, -.1)]);
function ribbon(curve, width, material, yOffset = 0) {
  const p = [], n = [], uv = [], indices = [], steps = 100;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, point = curve.getPoint(t), tangent = curve.getTangent(t), normal = v(-tangent.z, 0, tangent.x).normalize();
    for (let side = -1; side <= 1; side += 2) { const q = point.clone().addScaledVector(normal, width * side / 2); p.push(q.x, q.y + yOffset, q.z); n.push(0, 1, 0); uv.push(t, (side + 1) / 2); }
    if (i < steps) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices);
  return mesh(geo, material, scenery);
}
ribbon(roadCurve, 1.72, M.sandLight, -.015); ribbon(roadCurve, 1.38, M.road);
const roadMarks = group(world);
for (let i = 0; i < 21; i++) box(roadMarks, M.sandLight, [0, .35, 0], [.29, .012, .035]);

// Beach stones, flowering dunes and palms.
for (let i = 0; i < 48; i++) {
  const a = random(0, TAU), x = Math.cos(a) * random(5.8, 6.6), z = Math.sin(a) * random(3.1, 3.65);
  if (z > .1 && z < 1.8) continue;
  const s = random(.12, .36), stone = mesh(new THREE.DodecahedronGeometry(1, 0), i % 3 ? M.stoneLight : M.stone, scenery, [x, .22, z], [s * 1.45, s * .65, s]); stone.rotation.set(random(0, 2), random(0, 3), random(0, 1));
}
const grasses = [];
for (let i = 0; i < 75; i++) {
  const x = random(-5.8, 5.8), z = random(-2.9, 2.8);
  if (Math.abs(z - 1.2) < 1.0 || (x * x / 35 + z * z / 10) > 1) continue;
  const g = group(scenery, [x, .22, z]);
  for (let j = 0; j < 3; j++) {
    const h = random(.16, .4), a = random(0, TAU);
    rod(g, [0, 0, 0], [Math.cos(a) * .12, h, Math.sin(a) * .12], .026, j % 2 ? M.grassDark : M.greenLight, .004);
  }
  if (i % 3 === 0) {
    const h = random(.23, .4); rod(g, [0, 0, 0], [.04, h, 0], .012, M.green);
    for (let j = 0; j < 5; j++) { const a = j / 5 * TAU; ball(g, i % 2 ? M.white : M.ochre, [.04 + Math.cos(a) * .05, h, Math.sin(a) * .05], [.055, .025, .04]); }
    ball(g, M.ochre, [.04, h + .015, 0], [.022, .024, .022]);
  }
}

function palm(x, z, height, lean) {
  const g = group(scenery, [x, .22, z]);
  tube(g, [[0, 0, 0], [lean * .16, height * .4, .03], [lean * .6, height * .8, .08], [lean, height, .12]], .095, M.wood, 24);
  for (let i = 1; i < 10; i++) { const t = i / 10; ring(g, .101, .015, M.woodLight, [lean * t * t, height * t, t * .1], [Math.PI / 2, 0, -.15]); }
  const top = v(lean, height, .12);
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * TAU, len = random(1.3, 1.8), pos = [], indices = [];
    for (let j = 0; j <= 14; j++) {
      const t = j / 14, r = t * len, y = Math.sin(t * Math.PI) * .42 - t * .46, w = Math.sin(t * Math.PI) * .19;
      for (const side of [-1, 1]) pos.push(top.x + Math.cos(angle) * r - Math.sin(angle) * w * side, top.y + y - Math.abs(side) * w * .2, top.z + Math.sin(angle) * r + Math.cos(angle) * w * side);
      if (j < 14) { const a = j * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    const leafMat = (i % 2 ? M.green : M.greenLight).clone(); leafMat.side = THREE.DoubleSide;
    mesh(geo, leafMat, g);
    tube(g, [top, top.clone().add(v(Math.cos(angle) * len * .5, .35, Math.sin(angle) * len * .5)), top.clone().add(v(Math.cos(angle) * len, -.46, Math.sin(angle) * len))], .014, M.grassDark, 12);
  }
  for (let i = 0; i < 3; i++) ball(g, M.wood, [lean + (i - 1) * .13, height - .17, .1], [.12, .14, .12]);
}
palm(4.9, -1.3, 2.55, -.35); palm(5.7, -2.0, 2.0, -.2);

// A striped lighthouse with a rotating light, tiny entrance and railings.
const lighthouse = group(scenery, [-4.35, .24, -1.85]);
mesh(new THREE.CylinderGeometry(.78, .92, .18, 32), M.stoneLight, lighthouse, [0, .04, 0]);
for (let i = 0; i < 6; i++) {
  const h = .45, bottom = .59 - i * .043, top = bottom - .043;
  mesh(new THREE.CylinderGeometry(top, bottom, h, 32), i % 2 ? M.coral : M.cream, lighthouse, [0, .33 + i * h, 0]);
}
mesh(new THREE.CylinderGeometry(.56, .54, .13, 32), M.cream, lighthouse, [0, 2.89, 0]);
mesh(new THREE.CylinderGeometry(.43, .43, .57, 12), M.glass, lighthouse, [0, 3.21, 0]);
mesh(new THREE.ConeGeometry(.68, .39, 32), M.coralDark, lighthouse, [0, 3.71, 0]);
ball(lighthouse, M.coralDark, [0, 3.96, 0], [.06, .08, .06]);
ring(lighthouse, .69, .035, M.cream, [0, 3.0, 0], [Math.PI / 2, 0, 0]);
for (let i = 0; i < 12; i++) {
  const a = i / 12 * TAU;
  rod(lighthouse, [Math.cos(a) * .67, 2.76, Math.sin(a) * .67], [Math.cos(a) * .67, 3.0, Math.sin(a) * .67], .013, M.cream);
  if (i % 2 === 0) rod(lighthouse, [Math.cos(a) * .43, 2.94, Math.sin(a) * .43], [Math.cos(a) * .43, 3.5, Math.sin(a) * .43], .023, M.cream);
}
box(lighthouse, M.sageDark, [0, .38, .559], [.28, .56, .05]); ball(lighthouse, M.ochre, [.085, .35, .594], [.025, .025, .015]);
for (const y of [1.3, 2.23]) { box(lighthouse, M.glass, [0, y, .52 - y * .095], [.17, .25, .035]); box(lighthouse, M.cream, [0, y, .54 - y * .095], [.018, .25, .025]); }
for (let i = 0; i < 3; i++) box(lighthouse, M.stoneLight, [0, -.02 - i * .04, .7 + i * .2], [.65 + i * .1, .12, .28]);
const lamp = group(world, [-4.35, 3.45, -1.85]);
const bulb = ball(lamp, M.glow, [0, 0, 0], [.18, .23, .18]);
const beamMaterial = new THREE.MeshBasicMaterial({ color: '#f9df9b', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const beam = mesh(new THREE.ConeGeometry(1.5, 8, 24, 1, true), beamMaterial, lamp, [4, 0, 0]); beam.rotation.z = Math.PI / 2; beam.castShadow = false;
const lampLight = new THREE.PointLight('#ffd498', 0, 7, 2); lamp.add(lampLight);

function canvasSign(text, small, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.font = 'bold 58px Georgia'; ctx.fillText(text, 256, 83); ctx.font = '20px Arial'; ctx.letterSpacing = '4px'; ctx.fillText(small, 256, 135);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: .9 });
}
const sign = group(scenery, [-3.1, .25, .1]); sign.rotation.y = .15;
rod(sign, [0, 0, 0], [0, 1.25, 0], .04, M.wood);
box(sign, M.sageDark, [0, 1.0, 0], [1.2, .5, .09]);
mesh(new THREE.PlaneGeometry(1.16, .44), canvasSign('SLOW DOWN', 'YOU ARE ALREADY HERE', '#456e58', '#f7efda'), sign, [0, 1, .049]);
ball(sign, M.woodLight, [0, 1.33, 0], [.065, .065, .065]);

// Beach umbrella and a little deck chair.
const umbrella = group(scenery, [4.9, .25, 1.7]);
rod(umbrella, [0, 0, 0], [0, 1.55, 0], .027, M.woodLight);
for (let i = 0; i < 8; i++) {
  const a = i / 8 * TAU, b = (i + 1) / 8 * TAU, positions = [0, 1.62, 0];
  for (let j = 0; j <= 6; j++) { const t = a + (b - a) * j / 6; positions.push(Math.cos(t) * .84, 1.27 - Math.sin((t - a) / (b - a) * Math.PI) * .06, Math.sin(t) * .84); }
  const indices = []; for (let j = 1; j <= 6; j++) indices.push(0, j + 1, j);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const m = (i % 2 ? M.cream : M.coral).clone(); m.side = THREE.DoubleSide; mesh(geo, m, umbrella);
  rod(umbrella, [0, 1.62, 0], [Math.cos(a) * .84, 1.27, Math.sin(a) * .84], .012, M.woodLight);
}
ball(umbrella, M.cream, [0, 1.64, 0], [.055, .055, .055]);
const chair = group(scenery, [4.5, .24, 2.4]); chair.rotation.y = -.5;
for (const z of [-.22, .22]) { rod(chair, [-.3, 0, z], [.3, .55, z], .025, M.wood); rod(chair, [.32, 0, z], [-.35, .9, z], .025, M.wood); }
const chairBack = box(chair, M.cream, [-.16, .62, 0], [.065, .53, .43]); chairBack.rotation.z = -.55;
box(chair, M.coral, [.09, .35, 0], [.42, .025, .44]);
for (let i = 0; i < 6; i++) { const t = i / 5; ball(scenery, M.sandLight, [3.5 + t * .7, .24, 2.5 + t * .65], [.035, .008, .07]); }

// Wooden fence follows the quieter side of the path.
for (let i = 0; i < 8; i++) {
  const x = -2.8 + i * .8;
  box(scenery, M.woodLight, [x, .55, -1.35], [.065, .65, .065]);
  if (i < 7) { rod(scenery, [x, .68, -1.35], [x + .8, .68, -1.35], .023, M.wood); rod(scenery, [x, .46, -1.35], [x + .8, .46, -1.35], .023, M.wood); }
}

// The bicycle: diamond frame, cream-wall tires, laced spokes, chain and woven basket.
const rider = group(world, [.15, .36, 1.2]); rider.scale.setScalar(1.16);
const bikeFrame = group(rider);
const rear = [-1.13, .78, 0], front = [1.28, .78, 0], crankCenter = [-.06, .84, 0], seat = [-.53, 1.78, 0], headset = [.86, 1.87, 0];
for (const [a, b] of [[rear, seat], [seat, crankCenter], [crankCenter, rear], [seat, headset], [headset, crankCenter], [headset, front]]) rod(bikeFrame, a, b, .052, M.coral);
for (const z of [-.11, .11]) { rod(bikeFrame, [rear[0], rear[1], z], [seat[0], seat[1], z * .2], .025, M.coralDark); rod(bikeFrame, [rear[0], rear[1], z], [crankCenter[0], crankCenter[1], z * 1.2], .026, M.coralDark); }
rod(bikeFrame, [-.53, 1.72, 0], [-.6, 2.0, 0], .042, M.metal);
ball(bikeFrame, M.black, [-.67, 2.02, 0], [.35, .09, .2]);
ball(bikeFrame, M.wood, [-.69, 2.06, 0], [.31, .055, .185]);
rod(bikeFrame, [.86, 1.87, 0], [.78, 2.25, 0], .043, M.metal);
tube(bikeFrame, [[.78, 2.24, 0], [.86, 2.35, 0], [1.04, 2.38, 0]], .04, M.metal);
tube(bikeFrame, [[1.03, 2.38, -.39], [.91, 2.4, -.24], [.91, 2.4, .24], [1.03, 2.38, .39]], .033, M.metal);
for (const z of [-.39, .39]) { rod(bikeFrame, [1.03, 2.38, z], [.8, 2.36, z], .052, M.wood); rod(bikeFrame, [1.0, 2.39, z * .8], [1.14, 2.25, z * .8], .014, M.black); }
tube(bikeFrame, [[1.1, 2.26, .28], [1.37, 1.99, .24], [1.09, 1.7, .12], [1.26, .9, .12]], .012, M.black);
rod(bikeFrame, [1.22, .77, -.12], [.93, 1.76, -.12], .035, M.coral);
const wheelGroups = [];
function wheel(pos) {
  const g = group(rider, pos);
  ring(g, .71, .078, M.tire, [0, 0, 0]);
  for (const z of [-.047, .047]) ring(g, .692, .038, M.rim, [0, 0, z]);
  ring(g, .625, .025, M.metal, [0, 0, 0]);
  rod(g, [0, 0, -.13], [0, 0, .13], .075, M.metal);
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * TAU, offset = (i % 2 ? 1 : -1) * .05;
    rod(g, [Math.cos(a + .25) * .08, Math.sin(a + .25) * .08, offset], [Math.cos(a) * .617, Math.sin(a) * .617, 0], .009, M.metal);
  }
  // Reflectors move with the spokes.
  box(g, M.ochre, [.4, .08, 0], [.07, .16, .045], .1);
  batch(g); wheelGroups.push(g); return g;
}
wheel(rear); wheel(front);
for (const wheelPos of [rear, front]) {
  const points = []; for (let i = 0; i <= 26; i++) { const a = .1 + i / 26 * (Math.PI - .2); points.push([wheelPos[0] + Math.cos(a) * .83, wheelPos[1] + Math.sin(a) * .83, 0]); }
  tube(bikeFrame, points, .038, M.coral, 40);
}
for (const z of [-.12, .12]) {
  rod(bikeFrame, [-1.13, .78, z], [-1.55, 1.53, z], .016, M.metal);
  rod(bikeFrame, [1.28, .78, z], [1.72, 1.46, z], .016, M.metal);
}
// Rear carrier and tiny rolled picnic blanket.
for (const z of [-.21, .21]) { rod(bikeFrame, [-1.43, .8, z * .6], [-1.42, 1.7, z], .018, M.metal); rod(bikeFrame, [-1.7, 1.71, z], [-.9, 1.71, z], .02, M.metal); }
for (let i = 0; i < 5; i++) rod(bikeFrame, [-1.63 + i * .14, 1.71, -.21], [-1.63 + i * .14, 1.71, .21], .015, M.metal);
rod(bikeFrame, [-1.38, 1.84, -.25], [-1.38, 1.84, .25], .13, M.sage);
for (const z of [-.15, .15]) ring(bikeFrame, .134, .017, M.cream, [-1.38, 1.84, z]);
// Drivetrain, chain loop and front headlight.
ring(bikeFrame, .225, .024, M.metal, [-.06, .84, .16]);
ring(bikeFrame, .1, .022, M.metal, [-1.13, .78, .16]);
tube(bikeFrame, [[-.06, 1.07, .17], [-1.13, .88, .17], [-1.23, .78, .17], [-1.13, .68, .17], [-.06, .615, .17], [.16, .84, .17], [-.06, 1.07, .17]], .013, M.black, 52);
for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; rod(bikeFrame, [-.06, .84, .16], [-.06 + Math.cos(a) * .21, .84 + Math.sin(a) * .21, .16], .014, M.metal); }
ball(bikeFrame, M.metal, [1.17, 1.94, 0], [.12, .13, .13]);
ball(bikeFrame, M.glow, [1.27, 1.94, 0], [.035, .1, .1]);
const bellMesh = ball(bikeFrame, M.ochre, [.85, 2.46, .22], [.095, .065, .095]);

const basket = group(bikeFrame, [1.4, 2.0, 0]);
box(basket, M.wood, [0, -.12, 0], [.49, .045, .5]);
for (let i = 0; i <= 6; i++) {
  const h = i / 6 * .47, w = .245 + h * .19;
  for (const z of [-1, 1]) rod(basket, [-w, h - .12, z * w], [w, h - .12, z * w], .014, M.woodLight);
  for (const x of [-1, 1]) rod(basket, [x * w, h - .12, -w], [x * w, h - .12, w], .014, M.woodLight);
}
for (let i = 0; i < 9; i++) {
  const t = i / 8 * 2 - 1;
  for (const z of [-1, 1]) rod(basket, [t * .24, -.12, z * .245], [t * .335, .35, z * .335], .012, M.wood);
  for (const x of [-1, 1]) rod(basket, [x * .245, -.12, t * .24], [x * .335, .35, t * .335], .012, M.wood);
}
// A baguette and flowers for absolutely no special occasion.
const loaf = ball(basket, M.ochre, [.1, .4, -.06], [.09, .43, .085]); loaf.rotation.z = -.22;
for (let i = 0; i < 4; i++) { const cut = ball(basket, M.sandLight, [.08 + i * .018, .28 + i * .12, .014], [.06, .017, .013]); cut.rotation.z = .3; }
for (let i = 0; i < 3; i++) {
  const x = -.18 + i * .09, h = .45 + i % 2 * .14;
  rod(basket, [x, 0, .1], [x - .08, h, .1], .012, M.green);
  for (let j = 0; j < 5; j++) { const a = j / 5 * TAU; ball(basket, M.cream, [x - .08 + Math.cos(a) * .055, h + Math.sin(a) * .055, .1], [.045, .05, .025]); }
  ball(basket, M.ochre, [x - .08, h, .125], [.034, .034, .02]);
}
batch(bikeFrame);

// Pip the pelican. A soft body, an S-shaped neck and a very unmistakable bill.
const bird = group(rider);
const birdBody = group(bird);
ball(birdBody, M.cream, [-.59, 2.67, 0], [.79, .63, .48]);
ball(birdBody, M.feather, [-.96, 2.59, 0], [.49, .39, .41]);
for (let i = 0; i < 5; i++) {
  const feather = ball(birdBody, i % 2 ? M.feather : M.cream, [-1.31 - i * .045, 2.72 + i * .048, (i - 2) * .09], [.44, .095, .09]); feather.rotation.z = -.22 - i * .035;
}
tube(birdBody, [[-.21, 2.84, 0], [.04, 3.16, 0], [-.05, 3.51, 0], [.04, 3.84, 0], [.29, 4.05, 0]], .225, M.cream, 40);
ball(birdBody, M.cream, [.31, 4.08, 0], [.43, .39, .33]);
ball(birdBody, M.cream, [.1, 4.32, 0], [.31, .17, .28]);
// Sculpted bill and pouch, extruded softly on both sides.
function extrudedBirdShape(shape, depth, material) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .045, bevelThickness: .05, bevelSegments: 3, curveSegments: 20, steps: 1 });
  return mesh(geo, material, birdBody, [0, 0, -depth / 2]);
}
const billShape = new THREE.Shape(); billShape.moveTo(.55, 4.19); billShape.quadraticCurveTo(1.22, 4.24, 2.22, 3.99); billShape.quadraticCurveTo(2.34, 3.93, 2.15, 3.92); billShape.lineTo(.56, 4.005); billShape.closePath();
extrudedBirdShape(billShape, .32, M.ochre);
const pouchShape = new THREE.Shape(); pouchShape.moveTo(.56, 4.01); pouchShape.lineTo(2.17, 3.94); pouchShape.quadraticCurveTo(1.41, 3.48, .89, 3.62); pouchShape.quadraticCurveTo(.61, 3.72, .56, 4.01); pouchShape.closePath();
extrudedBirdShape(pouchShape, .27, M.pouch);
for (const z of [-.198, .198]) tube(birdBody, [[.57, 4.015, z], [1.17, 3.99, z * .91], [2.18, 3.95, z * .62]], .012, M.coralDark, 20);
for (const z of [-.3, .3]) {
  ball(birdBody, M.ochre, [.46, 4.145, z], [.13, .14, .035]);
  ball(birdBody, M.cream, [.46, 4.16, z * 1.05], [.085, .1, .023]);
  ball(birdBody, M.black, [.49, 4.17, z * 1.105], [.047, .062, .023]);
  ball(birdBody, M.white, [.501, 4.193, z * 1.17], [.014, .017, .01]);
  tube(birdBody, [[.36, 4.31, z], [.44, 4.33, z * 1.07], [.54, 4.29, z]], .022, M.featherDark, 12);
  ball(birdBody, M.coralLight, [.29, 3.99, z * 1.03], [.105, .047, .015]);
}
ball(birdBody, M.coralDark, [.76, 4.16, .171], [.031, .015, .006]);
// A sage bicycle helmet with raised ribs, a small visor and chin strap.
const helmet = mesh(new THREE.SphereGeometry(.45, 32, 20, 0, TAU, 0, Math.PI / 2), M.sage, birdBody, [.21, 4.31, 0], [1.07, .88, .94]);
ring(birdBody, .443, .025, M.sageDark, [.21, 4.31, 0], [Math.PI / 2, 0, 0]);
ball(birdBody, M.sage, [.54, 4.32, 0], [.29, .035, .31]);
for (const z of [-.19, 0, .19]) tube(birdBody, [[-.16, 4.38, z], [.02, 4.65 - Math.abs(z) * .3, z], [.37, 4.65 - Math.abs(z) * .3, z], [.63, 4.37, z]], .018, M.sageDark, 20);
for (const z of [-.29, .29]) tube(birdBody, [[-.05, 4.3, z], [.1, 3.92, z * .6], [.31, 3.88, z * .55], [.45, 4.29, z]], .015, M.wood, 20);
// Layered wings sweep forward to the handlebar.
for (const side of [-1, 1]) {
  const z = side * .36;
  const wing = ball(birdBody, M.feather, [-.46, 2.74, z], [.64, .31, .16]); wing.rotation.z = -.22;
  tube(birdBody, [[-.38, 2.86, z], [.12, 2.79, z * 1.13], [.51, 2.48, side * .4], [.88, 2.4, side * .39]], .12, M.cream, 28);
  for (let i = 0; i < 5; i++) {
    const f = ball(birdBody, i % 2 ? M.featherShade : M.feather, [-.73 + i * .13, 2.52 - i * .015, z * 1.19], [.31, .075, .055]); f.rotation.z = .34;
  }
  for (let i = 0; i < 3; i++) ball(birdBody, M.feather, [.82 + i * .045, 2.4 - i * .015, side * (.37 + i * .035)], [.17, .055, .035]);
}
// A neckerchief and a separate, gently rippling ribbon.
ring(birdBody, .225, .065, M.coral, [-.04, 3.48, 0], [Math.PI / 2, 0, .1]);
ball(birdBody, M.coralDark, [-.23, 3.48, .13], [.1, .1, .09]);
batch(birdBody);
const scarf = group(bird, [-.23, 3.48, .05]);
const scarfPositions = new Float32Array(13 * 2 * 3), scarfIndices = [];
for (let i = 0; i < 12; i++) { const a = i * 2; scarfIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
const scarfGeo = new THREE.BufferGeometry(); scarfGeo.setAttribute('position', new THREE.BufferAttribute(scarfPositions, 3)); scarfGeo.setIndex(scarfIndices);
const scarfMat = M.coral.clone(); scarfMat.side = THREE.DoubleSide; mesh(scarfGeo, scarfMat, scarf);
const scarfEnd = group(scarf);

// Legs use two-link inverse kinematics so both feet stay attached to the pedals.
const legs = [];
const webShape = new THREE.Shape(); webShape.moveTo(-.12, -.045); webShape.lineTo(.07, -.1); webShape.lineTo(.34, -.15); webShape.quadraticCurveTo(.4, -.09, .25, -.035); webShape.lineTo(.4, .015); webShape.quadraticCurveTo(.42, .07, .27, .075); webShape.lineTo(.34, .15); webShape.quadraticCurveTo(.28, .2, .1, .12); webShape.lineTo(-.12, .07); webShape.closePath();
const webGeo = new THREE.ExtrudeGeometry(webShape, { depth: .045, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 2, steps: 1 }); webGeo.rotateX(-Math.PI / 2);
for (const side of [-1, 1]) {
  const g = group(rider), upper = rod(g, [0, 0, 0], [0, 1, 0], .065, M.ochre), lower = rod(g, [0, 0, 0], [0, 1, 0], .042, M.foot);
  const knee = ball(g, M.ochre, [0, 0, 0], [.08, .08, .08]);
  const foot = mesh(webGeo, M.foot, g);
  const pedal = box(g, M.black, [0, 0, 0], [.23, .06, .16]);
  const arm = rod(g, [0, 0, 0], [0, 1, 0], .025, M.metal);
  legs.push({ side, upper, lower, knee, foot, pedal, arm });
}
function positionLink(object, a, b, radius) { const delta = b.clone().sub(a); object.position.copy(a).add(b).multiplyScalar(.5); object.quaternion.setFromUnitVectors(v(0, 1, 0), delta.clone().normalize()); object.scale.set(radius, delta.length(), radius); }
function updatePedals(phase) {
  for (const leg of legs) {
    const a = phase + (leg.side < 0 ? Math.PI : 0), z = leg.side * .27;
    const pedal = v(-.06 + Math.cos(a) * .32, .84 + Math.sin(a) * .32, z);
    const hip = v(-.49, 2.28, z * .68), ankle = pedal.clone().add(v(-.015, .1, 0));
    const dx = ankle.x - hip.x, dy = ankle.y - hip.y, d = Math.min(1.72, Math.hypot(dx, dy)), l1 = .82, l2 = .94;
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const knee = v(hip.x + dx / d * along - dy / d * height, hip.y + dy / d * along + dx / d * height, z);
    positionLink(leg.upper, hip, knee, .06); positionLink(leg.lower, knee, ankle, .04);
    leg.knee.position.copy(knee); leg.foot.position.copy(pedal).add(v(0, .07, 0)); leg.foot.rotation.z = Math.sin(a) * .12;
    leg.pedal.position.copy(pedal); positionLink(leg.arm, v(-.06, .84, z), pedal, .025);
  }
}
updatePedals(0);

// Sailboats, buoy and slow-moving clouds live on the outer water.
const boats = [];
function sailboat(x, z, scale, angle) {
  const g = group(world, [x, -.49, z]); g.scale.setScalar(scale); g.rotation.y = angle;
  ball(g, M.cream, [0, 0, 0], [.58, .14, .22]);
  ball(g, M.coral, [0, -.03, 0], [.55, .1, .21]);
  rod(g, [0, .03, 0], [0, 1.3, 0], .018, M.wood);
  const shape = new THREE.Shape(); shape.moveTo(-.03, 1.25); shape.lineTo(-.03, .25); shape.lineTo(-.56, .25); shape.closePath();
  mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#fff4d8', side: THREE.DoubleSide }), g);
  const s2 = new THREE.Shape(); s2.moveTo(.03, 1.13); s2.lineTo(.03, .25); s2.lineTo(.47, .25); s2.closePath();
  mesh(new THREE.ShapeGeometry(s2), new THREE.MeshStandardMaterial({ color: '#df805e', side: THREE.DoubleSide }), g);
  batch(g); boats.push({ g, baseY: -.49, x, z, phase: random(0, TAU) });
}
sailboat(-5.35, 4.15, .75, -.5); sailboat(5.7, -4.6, .46, .4);
const buoy = group(world, [6.65, -.4, 2.6]);
mesh(new THREE.ConeGeometry(.18, .4, 16), M.coral, buoy, [0, .1, 0]); ring(buoy, .22, .04, M.cream, [0, -.04, 0], [Math.PI / 2, 0, 0]); rod(buoy, [0, .2, 0], [0, .65, 0], .018, M.black);
const clouds = [];
function cloud(x, y, z, scale) {
  const g = group(world, [x, y, z]);
  for (const [px, py, pz, r] of [[-.6, 0, 0, .43], [0, .16, 0, .59], [.6, .03, 0, .4], [.2, 0, .22, .43]]) ball(g, M.white, [px, py, pz], [r, r * .52, r * .64]);
  g.scale.setScalar(scale); batch(g); clouds.push({ g, x, phase: random(0, TAU) });
}
cloud(-3.4, 6.15, -3.8, .83); cloud(3.8, 5.85, -4.1, .63); cloud(6.1, 4.8, -.8, .42);
const gulls = [];
for (let i = 0; i < 4; i++) {
  const g = group(world), left = group(g), right = group(g);
  tube(left, [[0, 0, 0], [-.2, .12, 0], [-.44, .02, 0]], .025, M.cream, 10);
  tube(right, [[0, 0, 0], [.2, .12, 0], [.44, .02, 0]], .025, M.cream, 10);
  ball(g, M.cream, [0, -.01, .01], [.05, .045, .12]);
  gulls.push({ g, left, right, phase: i * 1.8, radius: 3.7 + i * .55, height: 4.7 + i * .35 });
}
// A small constellation appears at night, well above the diorama.
const starPositions = [];
for (let i = 0; i < 75; i++) starPositions.push(random(-8, 8), random(4.5, 8), random(-6, -2));
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: '#fff1c7', size: .045, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
const stars = new THREE.Points(starGeo, starMaterial); world.add(stars);
const moon = ball(world, new THREE.MeshBasicMaterial({ color: '#fff0c2' }), [4, 6.5, -4], [.32, .32, .18]); moon.visible = false;

// Fine foam strokes accent the sea, without a heavy postprocessing pipeline.
const foam = group(scenery);
for (let i = 0; i < 40; i++) {
  const a = random(0, TAU), r = random(7, 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
  rod(foam, [x, -.55, z], [x + random(.12, .48), -.55, z - .03], .012, M.sandLight);
}
batch(scenery);

// UI and sound ---------------------------------------------------------------
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2700); }
function syncRideUI() {
  $('ride-button').classList.toggle('paused', !state.riding);
  $('ride-button').setAttribute('aria-pressed', String(state.riding));
  $('ride-label').textContent = state.riding ? '歇一会儿' : '出发，去兜风';
}
syncRideUI();
$('ride-button').addEventListener('click', () => { state.riding = !state.riding; syncRideUI(); if (!state.riding) toast('歇一会儿，听听海。'); });
$('speed').addEventListener('input', e => {
  state.speed = Number(e.target.value);
  $('speed-output').textContent = state.speed < .7 ? '慢悠悠' : state.speed < 1.3 ? '悠哉哉' : state.speed < 1.8 ? '追着风' : '要起飞啦';
  $('speed').style.setProperty('--progress', `${(state.speed - .35) / 1.85 * 100}%`);
});

let audioContext, surfGain, surfSource, surfLfo, surfLfoGain;
function getAudio() { if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); return audioContext; }
function startSurf() {
  const ctx = getAudio();
  if (!surfSource) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), samples = buffer.getChannelData(0);
    let previous = 0; for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .025) / 1.025; samples[i] = previous * 4; }
    surfSource = ctx.createBufferSource(); surfSource.buffer = buffer; surfSource.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 850;
    surfGain = ctx.createGain(); surfGain.gain.value = 0;
    surfSource.connect(filter).connect(surfGain).connect(ctx.destination); surfSource.start();
    surfLfo = ctx.createOscillator(); surfLfo.frequency.value = .12; surfLfoGain = ctx.createGain(); surfLfoGain.gain.value = 0; surfLfo.connect(surfLfoGain).connect(surfGain.gain); surfLfo.start();
  }
  surfGain.gain.setTargetAtTime(state.sound ? .10 : 0, ctx.currentTime, .4);
  surfLfoGain.gain.setTargetAtTime(state.sound ? .025 : 0, ctx.currentTime, .4);
}
$('sound-button').addEventListener('click', () => {
  try {
    state.sound = !state.sound; startSurf();
    $('sound-button').setAttribute('aria-pressed', String(state.sound)); $('sound-button').setAttribute('aria-label', state.sound ? '关闭海风声' : '开启海风声');
    $('sound-button').querySelector('use').setAttribute('href', state.sound ? '#i-sound' : '#i-muted'); toast(state.sound ? '海风来了。戴上耳机，更近一点。' : '把海风调成静音。');
  } catch { state.sound = false; toast('浏览器暂时无法播放声音。'); }
});
function ringBell() {
  state.bell = 1; toast('叮铃！借过一阵海风。');
  try {
    const ctx = getAudio(), now = ctx.currentTime;
    for (const [offset, f] of [[0, 1568], [.12, 2093]]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(f, now + offset); osc.frequency.exponentialRampToValueAtTime(f * .98, now + offset + .9);
      gain.gain.setValueAtTime(0, now + offset); gain.gain.linearRampToValueAtTime(.14, now + offset + .004); gain.gain.exponentialRampToValueAtTime(.0001, now + offset + 1.2);
      osc.connect(gain).connect(ctx.destination); osc.start(now + offset); osc.stop(now + offset + 1.3);
    }
  } catch { /* Visual bell feedback works even if audio is unavailable. */ }
}
$('bell-button').addEventListener('click', ringBell);
function toggleNight() {
  state.night = !state.night; document.body.classList.toggle('night', state.night);
  $('day-button').setAttribute('aria-pressed', String(state.night)); $('day-button').setAttribute('aria-label', state.night ? '切换到晴日' : '切换到月夜');
  $('day-icon').setAttribute('href', state.night ? '#i-sun' : '#i-moon'); $('day-label').textContent = state.night ? '追太阳' : '等月亮';
  $('weather-icon').setAttribute('href', state.night ? '#i-moon' : '#i-sun'); $('weather-title').textContent = state.night ? '月亮，也来兜风' : '晴，适合兜风';
  $('weather-subtitle').textContent = state.night ? '19°  /  星光作伴' : '24°  /  海风轻轻';
  moon.visible = state.night; toast(state.night ? '灯塔亮了。我们再骑一圈。' : '早安，又是有海风的一天。');
}
$('day-button').addEventListener('click', toggleNight);
let resetting = false;
$('reset-button').addEventListener('click', () => { resetting = true; toast('回到出发时的好风景。'); });
controls.addEventListener('start', () => { resetting = false; });

const journal = $('journal');
$('journal-open').addEventListener('click', () => journal.showModal()); $('journal-close').addEventListener('click', () => journal.close());
journal.addEventListener('click', e => { if (e.target === journal) { const r = journal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) journal.close(); } });
document.addEventListener('keydown', e => {
  if (journal.open || /INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); state.riding = !state.riding; syncRideUI(); }
  if (e.code === 'KeyB') ringBell(); if (e.code === 'KeyN') toggleNight();
});

// A postcard is rendered at export resolution, then the viewport is restored.
$('photo-button').addEventListener('click', async () => {
  const oldSize = renderer.getSize(new THREE.Vector2()), oldRatio = renderer.getPixelRatio();
  try {
    renderer.setPixelRatio(1); renderer.setSize(1600, 1200, false);
    camera.left = -7.1; camera.right = 7.1; camera.top = 5.325; camera.bottom = -5.325; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1400;
    const ctx = c.getContext('2d'); ctx.fillStyle = state.night ? '#1f3337' : '#f4f2e9'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(renderer.domElement, 0, 20);
    ctx.fillStyle = state.night ? '#e7e6d4' : '#293e35'; ctx.font = 'italic 68px Georgia'; ctx.fillText('Take the scenic route.', 90, 1290);
    ctx.font = '18px Arial'; ctx.fillStyle = state.night ? '#9cadab' : '#7e867a'; ctx.fillText('PELICAN COAST CLUB  /  A SMALL WORLD. A SOFTER PACE.', 94, 1335);
    ctx.font = '18px Arial'; ctx.textAlign = 'right'; ctx.fillText('A POSTCARD FOR YOU', 1506, 1335);
    renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x, oldSize.y, false); resize();
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Image export failed');
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `pelican-coast-${state.night ? 'moonlight' : 'sunshine'}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('photo-flash').classList.remove('flash'); void $('photo-flash').offsetWidth; $('photo-flash').classList.add('flash'); toast('把这阵海风，存成一张明信片。');
  } catch (error) { console.error(error); toast('明信片未能保存，请再试一次。'); }
  finally { renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x, oldSize.y, false); resize(); }
});

function resize() {
  const el = $('scene'), width = el.clientWidth, height = el.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  const aspect = width / height, viewHeight = aspect < 1.05 ? 11.6 : 10.8;
  camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('scene')); resize();

const daySun = new THREE.Color('#ffedcf'), nightSun = new THREE.Color('#a6c9ee');
const daySky = new THREE.Color('#fff6df'), nightSky = new THREE.Color('#94b3ce');
const daySea = new THREE.Color('#6caaa0'), nightSea = new THREE.Color('#355c65');
const clock = new THREE.Clock();
let firstFrame = true;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  if (document.hidden) return;
  state.time += reducedMotion ? 0 : dt;
  if (state.riding) state.travel += dt * state.speed;
  const t = state.time, ride = state.travel;
  state.nightMix = THREE.MathUtils.damp(state.nightMix, state.night ? 1 : 0, 2, dt);
  const night = state.nightMix;
  hemi.intensity = THREE.MathUtils.lerp(2.7, 1.15, night); hemi.color.copy(daySky).lerp(nightSky, night);
  sun.intensity = THREE.MathUtils.lerp(3.5, .75, night); sun.color.copy(daySun).lerp(nightSun, night);
  fill.intensity = THREE.MathUtils.lerp(1.1, .7, night); renderer.toneMappingExposure = THREE.MathUtils.lerp(1.15, .95, night);
  M.oceanSide.color.copy(daySea).lerp(nightSea, night); waterMaterial.uniforms.uNight.value = night; waterMaterial.uniforms.uTime.value = t;
  starMaterial.opacity = night * (.68 + Math.sin(t * .6) * .15); M.glow.emissiveIntensity = .1 + night * 2.3; M.glass.emissiveIntensity = night * .7;
  lampLight.intensity = night * 5; beamMaterial.opacity = night * .065; lamp.rotation.y = t * .3;
  for (const w of wheelGroups) w.rotation.z = -ride * 2.8;
  updatePedals(-ride * 2.8);
  rider.position.y = .36 + (state.riding ? Math.sin(ride * 5.6) * .018 : 0);
  rider.rotation.z = state.riding ? Math.sin(ride * 2.8) * .003 : 0;
  for (let i = 0; i < roadMarks.children.length; i++) {
    const u = ((i / roadMarks.children.length - ride * .035) % 1 + 1) % 1, p = roadCurve.getPoint(u), tangent = roadCurve.getTangent(u), m = roadMarks.children[i];
    m.position.copy(p); m.position.y += .012; m.rotation.y = -Math.atan2(tangent.z, tangent.x);
  }
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, width = (.13 - u * .035) * (i === 12 ? .35 : 1);
    for (let side = 0; side < 2; side++) { const index = (i * 2 + side) * 3; scarfPositions[index] = -u * .91; scarfPositions[index + 1] = Math.sin(u * 8 - t * 5) * .075 * u + u * .1 + (side ? width : -width); scarfPositions[index + 2] = Math.sin(u * 7 - t * 3.5) * .09 * u; }
  }
  scarfGeo.attributes.position.needsUpdate = true; scarfGeo.computeVertexNormals();
  for (const { g, phase, baseY } of boats) { g.position.y = baseY + Math.sin(t * 1.5 + phase) * .045; g.rotation.z = Math.sin(t * 1.2 + phase) * .055; }
  buoy.rotation.z = Math.sin(t * 1.3) * .09;
  for (const c of clouds) c.g.position.x = c.x + Math.sin(t * .075 + c.phase) * .35;
  for (const gull of gulls) {
    const a = t * .11 + gull.phase;
    gull.g.position.set(Math.cos(a) * gull.radius, gull.height + Math.sin(t * .7 + gull.phase) * .12, -2.8 + Math.sin(a) * 1.5);
    gull.g.rotation.y = -a; gull.left.rotation.z = Math.sin(t * 3 + gull.phase) * .18; gull.right.rotation.z = -Math.sin(t * 3 + gull.phase) * .18;
    gull.g.scale.setScalar(.55);
  }
  if (state.bell > 0) { state.bell = Math.max(0, state.bell - dt * 1.8); bird.rotation.z = Math.sin(t * 28) * state.bell * .018; } else bird.rotation.z = 0;
  if (resetting) {
    const speed = reducedMotion ? 1 : 1 - Math.exp(-dt * 7); camera.position.lerp(initialPosition, speed); controls.target.lerp(initialTarget, speed); camera.zoom = THREE.MathUtils.lerp(camera.zoom, 1, speed); camera.updateProjectionMatrix();
    if (camera.position.distanceTo(initialPosition) < .015 && Math.abs(camera.zoom - 1) < .005) resetting = false;
  }
  controls.update(); renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; $('loading').classList.add('loaded'); }
}
animate();

// Rebase the timer on tab return; a hidden page does not accumulate ride time.
document.addEventListener('visibilitychange', () => { clock.getDelta(); if (audioContext && state.sound) { if (document.hidden) audioContext.suspend(); else audioContext.resume(); } });
renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); $('loading').classList.remove('loaded'); $('loading').lastElementChild.textContent = '海风暂时停了，正在恢复画面…'; });
renderer.domElement.addEventListener('webglcontextrestored', () => { $('loading').classList.add('loaded'); });

// Read-only diagnostics are useful for checking static deployments.
window.__pelican = { state, renderer, scene, camera, controls, get stats() { return { revision: THREE.REVISION, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; } };
