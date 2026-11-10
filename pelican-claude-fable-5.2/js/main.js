import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRider } from './rider.js';
import { createWorld } from './world.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ───────────── 渲染器 / 相机 ─────────────
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe3f7, 70, 380);
const camera = new THREE.PerspectiveCamera(45, 1, 0.2, 4000);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 34;
controls.maxPolarAngle = 1.53;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.autoRotate = params.get('rotate') !== '0';
controls.autoRotateSpeed = -0.7;

function frameCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 1;
  camera.fov = portrait ? 50 : 42;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(6.2, 2.05 / (tanH * aspect)) * Number(params.get('zoom') ?? 1);
  controls.target.set(0.15, portrait ? 1.4 : 1.2, 0);
  const az = THREE.MathUtils.degToRad(Number(params.get('az') ?? 32)), el = THREE.MathUtils.degToRad(Number(params.get('el') ?? 13));
  camera.position.set(
    controls.target.x + dist * Math.sin(az) * Math.cos(el),
    controls.target.y + dist * Math.sin(el),
    controls.target.z + dist * Math.cos(az) * Math.cos(el),
  );
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
frameCamera();
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(() => { frameCamera(); resize(); }, 250));

// ───────────── 灯光 ─────────────
const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ───────────── 场景内容 ─────────────
const world = createWorld(scene);
const rider = createRider();
scene.add(rider.rig);
rider.onLand = () => { world.burst(-0.1, rider.rig.position.z); thud(); };

// ───────────── 时间段（白天 / 黄昏 / 夜晚），平滑过渡 ─────────────
const C = (h) => new THREE.Color(h);
const PRESETS = {
  day: {
    label: '☀️ 白天',
    skyTop: C(0x2f7fe0), horizon: C(0xbfe3f7), disc: C(0xfffbe6), glow: 0.5,
    sunDir: new THREE.Vector3(0.35, 0.8, 0.5), sunColor: C(0xfff3dc), sunI: 3.0,
    hemiSky: C(0xcfe8ff), hemiGround: C(0x86a56a), hemiI: 1.15,
    seaDeep: C(0x1670bb), seaShallow: C(0x52d3d8), foam: C(0xffffff), cloud: C(0xffffff),
    stars: 0, lamps: 0, exposure: 1.0,
  },
  sunset: {
    label: '🌇 黄昏',
    skyTop: C(0x33316f), horizon: C(0xffa565), disc: C(0xffd98a), glow: 1.3,
    sunDir: new THREE.Vector3(0.42, 0.13, -0.9), sunColor: C(0xff9648), sunI: 2.8,
    hemiSky: C(0xc09ad0), hemiGround: C(0x7a5552), hemiI: 1.0,
    seaDeep: C(0x2b3f80), seaShallow: C(0xf39a72), foam: C(0xffe3cf), cloud: C(0xffb894),
    stars: 0.2, lamps: 0.65, exposure: 1.05,
  },
  night: {
    label: '🌙 夜晚',
    skyTop: C(0x040a22), horizon: C(0x1b3058), disc: C(0xf1f5ff), glow: 0.35,
    sunDir: new THREE.Vector3(-0.42, 0.6, -0.55), sunColor: C(0xb9ceff), sunI: 1.7,
    hemiSky: C(0x7088cc), hemiGround: C(0x1c2740), hemiI: 1.25,
    seaDeep: C(0x06193a), seaShallow: C(0x175078), foam: C(0x9fb8d8), cloud: C(0x3a4d7a),
    stars: 1, lamps: 1, exposure: 1.25,
  },
};
const ORDER = ['day', 'sunset', 'night'];
let timeKey = ORDER.includes(params.get('time')) ? params.get('time') : 'day';
const env = {};
for (const [k, v] of Object.entries(PRESETS[timeKey])) env[k] = v && v.clone ? v.clone() : v;

function stepEnv(k) {
  const target = PRESETS[timeKey];
  for (const key in target) {
    const v = target[key];
    if (typeof v === 'number') env[key] += (v - env[key]) * k;
    else if (v.isColor || v.isVector3) env[key].lerp(v, k);
  }
  const dir = sun.position.copy(env.sunDir).normalize();
  world.applyEnv(env, dir);
  sun.position.multiplyScalar(60);
  sun.color.copy(env.sunColor); sun.intensity = env.sunI;
  hemi.color.copy(env.hemiSky); hemi.groundColor.copy(env.hemiGround); hemi.intensity = env.hemiI;
  scene.fog.color.copy(env.horizon);
  renderer.toneMappingExposure = env.exposure;
  rider.setNight(Math.max(0, (env.lamps - 0.4) / 0.6));
}

// ───────────── 声音（WebAudio 合成，无外部资源） ─────────────
let ac = null;
function audio() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
  return ac;
}
function tone(freq, t0, dur, vol, type = 'sine', freqEnd) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + t0);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.05);
}
function ding() {
  for (const off of [0, 0.17]) { tone(2093, off, 0.9, 0.16); tone(3140, off, 0.6, 0.07); tone(5270, off, 0.3, 0.03); }
}
function boing() { tone(260, 0, 0.28, 0.14, 'triangle', 640); }
function thud() { if (ac) tone(120, 0, 0.16, 0.2, 'sine', 50); }

// ───────────── 交互 ─────────────
let speed = Number(params.get('speed') ?? 5), speedTarget = speed, distance = 0;
const speedEl = $('speed'), kmhEl = $('kmh'), distEl = $('dist');
speedEl.value = String(speedTarget);
speedEl.addEventListener('input', () => { speedTarget = Number(speedEl.value); });

function hop() { if (rider.hop()) boing(); }
$('btnHop').addEventListener('click', hop);
$('btnBell').addEventListener('click', () => { ding(); rider.squawk(); });
const btnTime = $('btnTime');
btnTime.textContent = PRESETS[timeKey].label;
btnTime.addEventListener('click', () => {
  timeKey = ORDER[(ORDER.indexOf(timeKey) + 1) % ORDER.length];
  btnTime.textContent = PRESETS[timeKey].label;
});
const btnCam = $('btnCam');
btnCam.classList.toggle('on', controls.autoRotate);
btnCam.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  btnCam.classList.toggle('on', controls.autoRotate);
});

// 轻点画面 = 跳；拖动 = 旋转（由 OrbitControls 处理）
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
canvas.addEventListener('pointermove', (e) => {
  // 用户开始拖动视角时，停止自动环绕
  if (down && controls.autoRotate && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) {
    controls.autoRotate = false;
    btnCam.classList.remove('on');
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (down && e.pointerId === down.id && performance.now() - down.t < 350 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) hop();
  down = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); hop(); }
  else if (e.code === 'KeyB') { ding(); rider.squawk(); }
  else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    speedTarget = THREE.MathUtils.clamp(speedTarget + (e.code === 'ArrowUp' ? 1 : -1), 0, 12);
    speedEl.value = String(speedTarget);
  }
});
setTimeout(() => $('hint').classList.add('hide'), 7000);
if (params.get('hop')) setTimeout(hop, Number(params.get('hop')));

// ───────────── 主循环 ─────────────
const clock = new THREE.Clock();
let t = 0, frames = 0, perfT = 0, perfStage = 0, hudT = 0;

function tick() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  t += dt;

  speed += (speedTarget - speed) * (1 - Math.exp(-dt * 2.5));
  distance += speed * dt;

  stepEnv(1 - Math.exp(-dt * 1.6));
  rider.update(dt, t, speed);
  world.update(dt, t, speed, rider.rig.position.z, rider.airborne);
  controls.update();
  renderer.render(scene, camera);

  hudT += dt;
  if (hudT > 0.2) {
    hudT = 0;
    kmhEl.textContent = (speed * 3.6).toFixed(0);
    distEl.textContent = distance.toFixed(0);
  }

  // 帧率自适应：太卡时先降分辨率，再关阴影
  frames++; perfT += raw;
  if (perfT > 2.5) {
    const fps = frames / perfT;
    frames = 0; perfT = 0;
    if (t > 4 && fps < 32 && perfStage < 3) {
      perfStage++;
      if (perfStage === 1 && pixelRatio > 1.5) { pixelRatio = 1.5; renderer.setPixelRatio(pixelRatio); resize(); }
      else if (perfStage <= 2 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(pixelRatio); resize(); perfStage = 2; }
      else { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); perfStage = 3; }
    }
  }
}

stepEnv(1);
renderer.setAnimationLoop(tick);
$('loading').classList.add('hide');
