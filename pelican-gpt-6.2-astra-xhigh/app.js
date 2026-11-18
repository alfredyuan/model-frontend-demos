import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createStage,
  frameFor,
  lens
} from './stage.js';
import { printDetails } from './postcard.js';
const $ = selector => document.querySelector(selector);
const chinese = navigator.languages?.[0]?.toLowerCase().startsWith('zh');
const label = (english, zh) => chinese ? zh : english;
if (chinese) {
  document.documentElement.lang = 'zh-CN';
  for (const [selector, text] of [
      ['.collection', '互动明信片'],
      ['.titles p', '沿着海岸，送一封信。'],
      ['#sound span', '声音关闭'],
      ['.speed-controls .control-label', '速度'],
      ['label[for="camera"]', '视角'],
      ['option[value="postcard"]', '明信片视角'],
      ['option[value="profile"]', '正侧面'],
      ['option[value="portrait"]', '骑手特写']
    ])
    $(selector).textContent = text;
  $('.location').lastChild.textContent = '盐风海岸';
  $('#reset').setAttribute('aria-label', '重置视角');
  $('#camera').setAttribute('aria-label', '选择视角');
  $('#world').setAttribute('aria-label', '海岸骑行场景。单指拖动旋转，双指张合缩放。');
}
$('.gesture').lastChild.textContent = matchMedia('(pointer: coarse)').matches ? label('Drag · Pinch to zoom', '单指旋转 · 双指缩放') : label('Drag to orbit', '拖动旋转');
const setIcon = (button, id) => button.querySelector('use').setAttribute('href', '#' + id);
const stage = createStage();
const camera = new THREE.PerspectiveCamera(31, 1, 0.12, 300);
let canvas = $('#world'), renderer, software = false;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} catch {
  // A canvas that already acquired a GL context cannot be reused as a 2D surface.
  const replacement = canvas.cloneNode(false);
  canvas.replaceWith(replacement);
  canvas = replacement;
  const {PaperRenderer} = await import('./paper-renderer.js');
  renderer = new PaperRenderer(canvas);
  software = true;
}
printDetails();
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.12;
orbit.enablePan = false;
orbit.rotateSpeed = 0.68;
orbit.zoomSpeed = 0.78;
orbit.minPolarAngle = Math.PI * 0.2;
orbit.maxPolarAngle = Math.PI * 0.494;
let width = 0, height = 0, view = 'postcard', frame, time = 0, rate = 1;
let active = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let handle = 0, last = 0, lastPaint = 0, dirty = true, tween = null;
let viewX = 0.6, viewY = 0.55;
function resize() {
  const rect = $('#scene').getBoundingClientRect(), w = Math.round(rect.width), h = Math.round(rect.height);
  if (!w || !h || w === width && h === height)
    return;
  width = w;
  height = h;
  const ratio = software ? Math.min(1.45, 1600 / w, Math.sqrt(1050000 / (w * h))) : Math.min(window.devicePixelRatio || 1, w < 750 ? 1.7 : 1.8);
  if (software)
    renderer.setSize(w, h, ratio);
  else {
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
  }
  setView(view, false);
  stage.tick(time);
  stage.sky.position.copy(camera.position);
  renderer.render(stage.scene, camera);
  lastPaint = performance.now();
  dirty = false;
}
function setView(name, transition) {
  view = name;
  $('#camera').value = name;
  const base = frameFor(width, height, 'postcard');
  stage.coast.place(base.worldWidth, base.az, base.dist, base.target.x, base.x);
  frame = frameFor(width, height, name);
  orbit.minDistance = frame.dist * 0.46;
  orbit.maxDistance = frame.dist * 1.85;
  // Clear residual drag damping before moving between preset compositions.
  orbit.enableDamping = false;
  orbit.update();
  orbit.enableDamping = true;
  if (transition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tween = {
      start: performance.now(),
      eye: camera.position.clone(),
      target: orbit.target.clone(),
      x: viewX,
      y: viewY
    };
  } else {
    tween = null;
    viewX = frame.x;
    viewY = frame.y;
    lens(camera, width, height, frame);
    camera.position.copy(frame.position);
    orbit.target.copy(frame.target);
    orbit.update();
  }
  dirty = true;
  wake();
}
function wake() {
  if (!handle && !document.hidden)
    handle = requestAnimationFrame(draw);
}
function draw(now) {
  handle = 0;
  const dt = last ? Math.min((now - last) / 1000, 0.09) : 0;
  last = now;
  if (active)
    time += dt * rate;
  if (tween) {
    const u = Math.min(1, (now - tween.start) / 480), t = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.eye, frame.position, t);
    orbit.target.lerpVectors(tween.target, frame.target, t);
    viewX = tween.x + (frame.x - tween.x) * t;
    viewY = tween.y + (frame.y - tween.y) * t;
    lens(camera, width, height, {
      ...frame,
      x: viewX,
      y: viewY
    });
    dirty = true;
    if (u === 1)
      tween = null;
  }
  const moved = orbit.update();
  if (width && (!software || now - lastPaint >= 66 || !lastPaint) && (active || dirty || moved)) {
    stage.tick(time);
    stage.sky.position.copy(camera.position);
    renderer.render(stage.scene, camera);
    lastPaint = now;
    dirty = false;
  }
  if (active || moved || tween || dirty)
    wake();
}
orbit.addEventListener('start', () => {
  tween = null;
});
orbit.addEventListener('change', () => {
  dirty = true;
  wake();
});
canvas.addEventListener('dblclick', () => setView('postcard', true));
$('#camera').addEventListener('change', e => setView(e.target.value, true));
$('#reset').addEventListener('click', () => setView('postcard', true));
function rideUI() {
  const b = $('#ride');
  setIcon(b, active ? 'pause' : 'play');
  const caption = active ? label('Pause ride', '暂停骑行') : label('Play ride', '继续骑行');
  b.querySelector('span').textContent = caption;
  b.setAttribute('aria-label', caption);
}
$('#ride').addEventListener('click', () => {
  active = !active;
  rideUI();
  last = 0;
  dirty = true;
  wake();
});
document.querySelector('.speeds').addEventListener('click', e => {
  const b = e.target.closest('[data-speed]');
  if (!b)
    return;
  rate = Number(b.dataset.speed);
  for (const el of document.querySelectorAll('[data-speed]'))
    el.setAttribute('aria-pressed', String(el === b));
});
new ResizeObserver(resize).observe($('#scene'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(handle);
    handle = 0;
  } else {
    last = 0;
    dirty = true;
    wake();
  }
  updateAudio();
});
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  cancelAnimationFrame(handle);
  handle = 0;
});
canvas.addEventListener('webglcontextrestored', () => {
  dirty = true;
  last = 0;
  wake();
});
const fsButton = $('#fullscreen');
function fullscreenUI() {
  const expanded = Boolean(document.fullscreenElement) || document.body.classList.contains('expanded');
  setIcon(fsButton, expanded ? 'contract' : 'expand');
  fsButton.setAttribute('aria-label', expanded ? label('Exit full screen', '退出全屏') : label('Full screen', '全屏'));
}
fsButton.addEventListener('click', async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {
    });
  } else if (document.body.classList.contains('expanded'))
    document.body.classList.remove('expanded');
  else {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      document.body.classList.add('expanded');
    }
  }
  fullscreenUI();
});
document.addEventListener('fullscreenchange', fullscreenUI);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.body.classList.remove('expanded');
    fullscreenUI();
  }
});
// Wind and surf are synthesized in the browser after the user's first tap.
let audio = null, master = null, sounding = false;
function prepareAudio() {
  audio = new (window.AudioContext || window.webkitAudioContext)();
  const len = audio.sampleRate * 4, buffer = audio.createBuffer(1, len, audio.sampleRate), samples = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < len; i++) {
    previous = 0.979 * previous + 0.021 * (Math.random() * 2 - 1);
    samples[i] = previous * 4.2;
  }
  const wave = audio.createBufferSource();
  wave.buffer = buffer;
  wave.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 890;
  const swell = audio.createGain();
  swell.gain.value = 0.43;
  const lfo = audio.createOscillator(), mod = audio.createGain();
  lfo.frequency.value = 0.145;
  mod.gain.value = 0.27;
  lfo.connect(mod).connect(swell.gain);
  master = audio.createGain();
  master.gain.value = 0;
  wave.connect(filter).connect(swell).connect(master).connect(audio.destination);
  wave.start();
  lfo.start();
}
function updateAudio() {
  if (!audio)
    return;
  const gain = sounding && !document.hidden ? 0.35 : 0;
  master.gain.setTargetAtTime(gain, audio.currentTime, 0.12);
}
$('#sound').addEventListener('click', async () => {
  const b = $('#sound');
  try {
    if (!audio)
      prepareAudio();
    if (audio.state !== 'running')
      await audio.resume();
    sounding = !sounding;
    updateAudio();
    setIcon(b, sounding ? 'volume' : 'muted');
    b.querySelector('span').textContent = sounding ? label('Sound on', '声音开启') : label('Sound off', '声音关闭');
    b.setAttribute('aria-pressed', String(sounding));
  } catch {
    b.querySelector('span').textContent = label('Audio unavailable', '声音不可用');
    b.disabled = true;
  }
});
rideUI();
fullscreenUI();
resize();
