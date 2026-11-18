import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRider } from './rider.js';
import { createWorld } from './world.js';

const byId = id => document.getElementById(id);
const stage = byId('stage');
const canvas = byId('scene');
const loading = byId('loading');
const loadingLabel = byId('loading-label');
const rideButton = byId('ride-button');
const bellButton = byId('bell-button');
const lightButton = byId('light-button');
const zoomIn = byId('zoom-in');
const zoomOut = byId('zoom-out');
const resetButton = byId('reset-view');
const speedButtons = Array.from(document.querySelectorAll('[data-speed]'));
const help = byId('help');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const interactiveButtons = [rideButton, bellButton, lightButton, zoomIn, zoomOut, resetButton, ...speedButtons];

byId('help-button').addEventListener('click', () => help.showModal());

let audio;
let ringTimer;
function ringBell() {
  clearTimeout(ringTimer);
  bellButton.removeAttribute('data-ringing');
  bellButton.getBoundingClientRect();
  bellButton.setAttribute('data-ringing', '');
  ringTimer = setTimeout(() => bellButton.removeAttribute('data-ringing'), 500);
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audio ??= new Audio();
  void audio.resume().then(() => {
    for (const delay of [0, .135]) {
      const start = audio.currentTime + delay;
      for (const [frequency, volume, decay] of [[1278, .077, .48], [2283, .023, .31], [3472, .013, .19]]) {
        const tone = audio.createOscillator();
        const envelope = audio.createGain();
        tone.frequency.value = frequency;
        envelope.gain.setValueAtTime(.0001, start);
        envelope.gain.exponentialRampToValueAtTime(volume, start + .0045);
        envelope.gain.exponentialRampToValueAtTime(.0001, start + decay);
        tone.connect(envelope).connect(audio.destination);
        tone.start(start);
        tone.stop(start + decay + .01);
      }
    }
  }).catch(() => {});
}

function setAvailability(available) {
  interactiveButtons.forEach(button => { button.disabled = !available; });
  canvas.tabIndex = available ? 0 : -1;
}

function showFallback(message) {
  setAvailability(false);
  loadingLabel.textContent = message;
  loading.hidden = false;
}

function startRide() {
  const options = { canvas, antialias: true, alpha: false, powerPreference: 'low-power' };
  const context = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
  if (!context) {
    showFallback('此浏览器当前无法运行 WebGL，互动场景暂不可用。');
    return;
  }
  const renderer = new THREE.WebGLRenderer({ ...options, context });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.4 : 1.65));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b3d6c8');
  const camera = new THREE.PerspectiveCamera(35, 1, .09, 148);
  const home = new THREE.Vector3(3.88, 2.07, 9.83);
  const focus = new THREE.Vector3(.07, 1.54, -.09);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !reduceMotion.matches;
  controls.dampingFactor = .085;
  controls.rotateSpeed = .58;
  controls.zoomSpeed = .78;
  controls.minDistance = 5.8;
  controls.maxDistance = 19;
  controls.minPolarAngle = .28;
  controls.maxPolarAngle = 1.49;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const rider = createRider(scene);
  const world = createWorld(scene);
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  let riding = !reduceMotion.matches;
  let speed = 1;
  let palette = 0;
  let light = 0;
  let time = 0;
  let phase = -.65;
  let last = 0;
  let frame = 0;
  let dirty = true;
  let visible = true;
  let contextLost = false;

  function setRiding(value) {
    riding = value;
    rideButton.toggleAttribute('data-paused', !value);
    byId('ride-label').textContent = value ? '暂停骑行' : '开始骑行';
    dirty = true;
  }

  function resetView() {
    controls.enableDamping = false;
    controls.update();
    controls.target.copy(focus);
    camera.position.copy(focus).add(home);
    controls.update();
    controls.enableDamping = !reduceMotion.matches;
    dirty = true;
  }

  function zoom(scale) {
    offset.copy(camera.position).sub(controls.target);
    const radius = THREE.MathUtils.clamp(offset.length() * scale, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(radius));
    controls.update();
    dirty = true;
  }

  function rotate(azimuth, altitude) {
    spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
    spherical.theta += azimuth;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + altitude, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
    dirty = true;
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    const newCenter = .07 + .28 * (1 - THREE.MathUtils.smoothstep(camera.aspect, .84, 1.15));
    const shift = newCenter - focus.x;
    focus.x = newCenter;
    controls.target.x += shift;
    camera.position.x += shift;
    const fit = THREE.MathUtils.radToDeg(2 * Math.atan(2.75 / (home.length() * camera.aspect)));
    camera.fov = Math.max(35, fit);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    dirty = true;
  }

  function draw(now) {
    const elapsed = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    if (!visible || document.hidden || contextLost) return;
    const moved = controls.update();
    if (riding && elapsed) {
      time += elapsed * speed;
      phase -= elapsed * speed * 3.05;
      rider.pose(phase, time, speed);
      world.update(time, phase);
      if (frame++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
      dirty = true;
    }
    if (Math.abs(light - palette) > .001) {
      light = reduceMotion.matches ? palette : THREE.MathUtils.damp(light, palette, 4.8, elapsed);
      if (Math.abs(light - palette) <= .001) light = palette;
      world.light(light);
      dirty = true;
    }
    if (dirty || moved) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  resetView();
  resize();
  setRiding(riding);
  world.update(time, phase);
  world.light(light);
  renderer.render(scene, camera);
  loading.hidden = true;
  setAvailability(true);
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    dirty = true;
  }).observe(stage);

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    showFallback('3D 画面暂时中断，正在等待浏览器恢复…');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    loading.hidden = true;
    setAvailability(true);
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  });
  reduceMotion.addEventListener('change', event => {
    controls.enableDamping = !event.matches;
    if (event.matches) setRiding(false);
  });

  rideButton.addEventListener('click', () => setRiding(!riding));
  bellButton.addEventListener('click', ringBell);
  lightButton.addEventListener('click', () => {
    palette = 1 - palette;
    lightButton.setAttribute('aria-pressed', String(palette === 1));
    lightButton.querySelector('.light-icon').textContent = palette ? '☾' : '☼';
    byId('light-label').textContent = palette ? '切到白昼' : '切到黄昏';
  });
  zoomIn.addEventListener('click', () => zoom(.82));
  zoomOut.addEventListener('click', () => zoom(1 / .82));
  resetButton.addEventListener('click', resetView);
  for (const button of speedButtons) {
    button.addEventListener('click', () => {
      speed = Number(button.dataset.speed);
      speedButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    });
  }

  const viewKeys = {
    ArrowLeft: () => rotate(.12, 0),
    ArrowRight: () => rotate(-.12, 0),
    ArrowUp: () => rotate(0, -.12),
    ArrowDown: () => rotate(0, .12),
    '+': () => zoom(.82),
    '=': () => zoom(.82),
    '-': () => zoom(1 / .82),
  };
  canvas.addEventListener('keydown', event => {
    if (contextLost || !Object.hasOwn(viewKeys, event.key)) return;
    event.preventDefault();
    viewKeys[event.key]();
  });
  document.addEventListener('keydown', event => {
    if (contextLost || help.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select, a, [contenteditable]')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      setRiding(!riding);
    }
    if (event.key.toLowerCase() === 'r') resetView();
  });
  renderer.setAnimationLoop(draw);
}

try {
  startRide();
} catch (error) {
  console.error(error);
  showFallback('3D 场景加载失败，请刷新页面重试。');
}
