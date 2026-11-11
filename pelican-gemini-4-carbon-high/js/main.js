import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
  createBoardwalkTextures,
  createWickerTexture,
  createScarfTexture,
  createGlowSpriteTexture,
  createTireTexture,
  createPierSignTexture,
  buildProceduralEnvironment
} from './textures.js';
import { createBicycle } from './bicycle.js';
import { createPelican } from './pelican.js';
import { createWorld, THEMES } from './world.js';
import { createAudioEngine } from './audio.js';

/**
 * Main Application Entry:
 * Orchestrates Renderer, Camera Presets (Mobile Portrait + Landscape aware),
 * OrbitControls, Touch Raycasting, Stunts (Wheelie / Hop / Turbo / Fish Toss),
 * Audio Foley, and HUD updates.
 */

const canvas = document.getElementById('scene-canvas');
const toastEl = document.getElementById('toast-banner');
const speedValEl = document.getElementById('speed-val');
const fishCountEl = document.getElementById('fish-count');
const touchHintEl = document.getElementById('touch-hint');

// ============================================================================
// 1. RENDERER & SCENE INITIALIZATION (Optimized for Android Mobile GPUs)
// ============================================================================
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 2.0 : 2.0));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.08,
  260
);

// OrbitControls with silky damping & mobile touch configuration
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = true;
controls.panSpeed = 0.7;
controls.rotateSpeed = isMobile ? 0.78 : 0.85;
controls.zoomSpeed = 0.9;
controls.minDistance = 0.75;
controls.maxDistance = 11.5;
controls.minPolarAngle = 0.14;
controls.maxPolarAngle = Math.PI * 0.495; // Prevent camera clipping below wooden boardwalk!
controls.target.set(0.08, 0.88, 0);

// ============================================================================
// 2. PROCEDURAL TEXTURES, WORLD, BICYCLE & PELICAN RIG
// ============================================================================
const boardwalkTex = createBoardwalkTextures();
const textures = {
  boardwalkMap: boardwalkTex.map,
  boardwalkBump: boardwalkTex.bumpMap,
  wickerMap: createWickerTexture(),
  scarfMap: createScarfTexture(),
  glowMap: createGlowSpriteTexture(),
  tireMap: createTireTexture(),
  pierSignMap: createPierSignTexture()
};

const world = createWorld(scene, textures);
const bicycle = createBicycle(textures);
const pelican = createPelican(textures);
const audio = createAudioEngine();

// Shared stunt pivot anchored at exact rear-tire ground contact point (-0.50, 0, 0)
// so Wheelies, Bunny-Hops, and Banking Roll keep Pelican + Bicycle 100% coupled!
const vehicleTrackGroup = new THREE.Group();
scene.add(vehicleTrackGroup);

const rearContactPivot = new THREE.Group();
rearContactPivot.position.set(-0.50, 0, 0);
vehicleTrackGroup.add(rearContactPivot);

const coupledRig = new THREE.Group();
coupledRig.position.set(0.50, 0, 0);
coupledRig.add(bicycle.root);
coupledRig.add(pelican.root);
rearContactPivot.add(coupledRig);

// Environment Map Cache per Theme for realistic chrome & brass reflections
const envCache = new Map();
function updateEnvironmentForTheme(themeKey) {
  const theme = world.applyTheme(themeKey);
  if (!envCache.has(theme.id)) {
    envCache.set(theme.id, buildProceduralEnvironment(renderer, theme));
  }
  scene.environment = envCache.get(theme.id).texture;
  bicycle.setLampIntensity(theme.lampLevel);
}
updateEnvironmentForTheme('sunset');

// ============================================================================
// 3. ASPECT-AWARE CAMERA PRESETS (Portrait Android + Landscape Desktop)
// ============================================================================
const CAMERA_PRESETS = {
  hero: {
    pos: new THREE.Vector3(1.52, 1.34, 2.58),
    target: new THREE.Vector3(0.05, 0.86, -0.05),
    fov: 44
  },
  closeup: {
    pos: new THREE.Vector3(1.12, 1.48, 1.18),
    target: new THREE.Vector3(0.26, 1.28, 0.0),
    fov: 40
  },
  drivetrain: {
    pos: new THREE.Vector3(0.32, 0.56, 1.38),
    target: new THREE.Vector3(-0.08, 0.44, 0.04),
    fov: 40
  },
  pov: {
    // Dynamically driven by pelican.povCameraAnchor!
    fov: 62
  },
  drone: {
    // Auto cinematic orbit
    pos: new THREE.Vector3(2.2, 1.85, 2.9),
    target: new THREE.Vector3(0.02, 0.88, -0.08),
    fov: 45
  }
};

let currentCamMode = 'hero';
let camTransition = 0; // > 0 while smoothly flying to a preset
const camGoalPos = new THREE.Vector3();
const camGoalTarget = new THREE.Vector3();

function computeAspectAdjustedPreset(preset) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  // On tall portrait mobile screens (aspect ~ 0.45), pull camera smoothly back so
  // the full bicycle + pelican beak + ocean sunset fit comfortably without side clipping!
  const portraitPullback = aspect < 1.0
    ? THREE.MathUtils.clamp(1.0 / Math.pow(aspect, 0.54), 1.0, 1.72)
    : 1.0;

  const offset = new THREE.Vector3().subVectors(preset.pos, preset.target).multiplyScalar(portraitPullback);
  return {
    pos: new THREE.Vector3().copy(preset.target).add(offset),
    target: preset.target.clone(),
    fov: aspect < 1.0 ? Math.min(54, preset.fov + 5) : preset.fov
  };
}

function setCameraMode(mode, instant = false) {
  currentCamMode = mode;

  document.querySelectorAll('[data-cam]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cam === mode);
  });

  if (mode === 'pov') {
    controls.enabled = false;
    camera.fov = 64;
    camera.updateProjectionMatrix();
    showToast('👀 鹈鹕第一视角：沿着大嘴看海滨栈道！');
    return;
  }

  controls.enabled = true;
  controls.autoRotate = mode === 'drone';
  controls.autoRotateSpeed = 1.65;

  const preset = CAMERA_PRESETS[mode] || CAMERA_PRESETS.hero;
  const adjusted = computeAspectAdjustedPreset(preset);

  camera.fov = adjusted.fov;
  camera.updateProjectionMatrix();

  if (instant) {
    camera.position.copy(adjusted.pos);
    controls.target.copy(adjusted.target);
    controls.update();
    camTransition = 0;
  } else {
    camGoalPos.copy(adjusted.pos);
    camGoalTarget.copy(adjusted.target);
    camTransition = 1.0;
  }
}

// Cancel smooth preset glide if user manually drags canvas
controls.addEventListener('start', () => {
  camTransition = 0;
  if (touchHintEl && !touchHintEl.classList.contains('hidden')) {
    touchHintEl.classList.add('hidden');
  }
});

setCameraMode('hero', true);

// ============================================================================
// 4. SIMULATION & STUNT STATE
// ============================================================================
let baseCruiseSpeed = 4.8; // m/s (~ 17.3 km/h)
let currentSpeed = 4.8;
let turboTimer = 0;
let turboHeld = false;
let fishBoostTimer = 0;
let fishCaughtCount = 0;

// Wheelie & Bunny-Hop physics
let wheelieTimer = 0;
let wheelieFactor = 0;
let hopHeight = 0;
let hopVelY = 0;

// Gentle organic coastal steering & lateral lane weave
let lateralZ = 0;
let manualSteerBias = 0;

let toastTimeout = null;
function showToast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, 2100);
}

// ============================================================================
// 5. INTERACTIVE ACTIONS (Buttons + 3D Touch Raycasting + Keyboard)
// ============================================================================
function actionTossFish(originWorld = null) {
  audio.unlock();
  audio.playHopOrToss('toss');
  world.tossFishTowardPelican(originWorld);
  if (touchHintEl) touchHintEl.classList.add('hidden');
}

function actionRingBell() {
  audio.unlock();
  audio.playBell();
  bicycle.ringBell();
  pelican.triggerBellFlick();
  showToast('🔔 叮铃铃～ 让一让，鹈鹕船长来啦！');
  if (touchHintEl) touchHintEl.classList.add('hidden');
}

function actionWheelie() {
  audio.unlock();
  wheelieTimer = wheelieTimer > 0.3 ? 0 : 2.6;
  if (wheelieTimer > 0) {
    audio.playPelicanGulp(false);
    pelican.triggerCheer();
    showToast('🎪 独轮翘头特技！平衡感满分！');
  }
  if (touchHintEl) touchHintEl.classList.add('hidden');
}

function actionBunnyHop() {
  audio.unlock();
  if (hopHeight <= 0.02) {
    hopVelY = 2.95;
    audio.playHopOrToss('hop');
    pelican.triggerCheer();
    showToast('🦘 扑腾翅膀连车起跳！');
  }
  if (touchHintEl) touchHintEl.classList.add('hidden');
}

function actionTurboPulse() {
  audio.unlock();
  turboTimer = 2.8;
  audio.playPelicanGulp(false);
  showToast('🚀 护目镜就位！海风全速冲刺！');
  if (touchHintEl) touchHintEl.classList.add('hidden');
}

// Bind HUD Buttons
document.getElementById('btn-fish')?.addEventListener('click', () => actionTossFish());
document.getElementById('btn-bell')?.addEventListener('click', () => actionRingBell());
document.getElementById('btn-wheelie')?.addEventListener('click', () => actionWheelie());
document.getElementById('btn-hop')?.addEventListener('click', () => actionBunnyHop());

const turboBtn = document.getElementById('btn-turbo');
if (turboBtn) {
  turboBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    turboHeld = true;
    turboBtn.classList.add('active');
    actionTurboPulse();
  });
  const releaseTurbo = () => {
    turboHeld = false;
    turboBtn.classList.remove('active');
  };
  window.addEventListener('pointerup', releaseTurbo);
  window.addEventListener('pointercancel', releaseTurbo);
}

// Camera Preset Pills
document.querySelectorAll('[data-cam]').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.unlock();
    setCameraMode(btn.dataset.cam, false);
  });
});

// Theme Cycle / Buttons
const themeOrder = ['sunset', 'sunny', 'night'];
let themeIdx = 0;
const themeBtn = document.getElementById('btn-theme');
const themeIconEl = document.getElementById('theme-icon');
const themeLabelEl = document.getElementById('theme-label');

function cycleTheme(nextKey) {
  audio.unlock();
  if (nextKey) {
    themeIdx = Math.max(0, themeOrder.indexOf(nextKey));
  } else {
    themeIdx = (themeIdx + 1) % themeOrder.length;
  }
  const key = themeOrder[themeIdx];
  updateEnvironmentForTheme(key);
  const icons = { sunset: '🌅', sunny: '☀️', night: '🌙' };
  if (themeIconEl) themeIconEl.textContent = icons[key];
  if (themeLabelEl) themeLabelEl.textContent = THEMES[key].label;
  document.querySelectorAll('[data-theme-pick]').forEach((b) => {
    b.classList.toggle('active', b.dataset.themePick === key);
  });
  showToast(`${icons[key]} 已切换至「${THEMES[key].label}」氛围`);
}

themeBtn?.addEventListener('click', () => cycleTheme());
document.querySelectorAll('[data-theme-pick]').forEach((btn) => {
  btn.addEventListener('click', () => cycleTheme(btn.dataset.themePick));
});

// Sound Toggle Button
const soundBtn = document.getElementById('btn-sound');
soundBtn?.addEventListener('click', () => {
  const on = audio.toggle();
  soundBtn.textContent = on ? '🔊' : '🔇';
  soundBtn.setAttribute('aria-label', on ? '关闭音效' : '开启音效');
  showToast(on ? '🔊 海浪与车铃音效已开启' : '🔇 已静音');
});

// Customize Drawer Toggle & Controls
const customPanel = document.getElementById('custom-panel');
const customBtn = document.getElementById('btn-custom');
customBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  customPanel?.classList.toggle('open');
  customBtn.classList.toggle('active', customPanel?.classList.contains('open'));
});

// Close customize drawer when tapping canvas
canvas.addEventListener('pointerdown', () => {
  if (customPanel?.classList.contains('open')) {
    customPanel.classList.remove('open');
    customBtn?.classList.remove('active');
  }
});

// Bicycle Frame Paint Swatches
document.querySelectorAll('[data-paint]').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('[data-paint]').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    bicycle.setFrameColor(swatch.dataset.paint);
    showToast('🎨 单车涂装已换新！');
  });
});

// Pelican Accessory Mode
document.querySelectorAll('[data-outfit]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-outfit]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    pelican.setAccessoryMode(btn.dataset.outfit);
  });
});

// Cruise Speed Slider
const speedSlider = document.getElementById('speed-slider');
speedSlider?.addEventListener('input', (e) => {
  baseCruiseSpeed = parseFloat(e.target.value);
});

// ============================================================================
// 6. SMART TOUCH TAP RAYCASTING ON 3D OBJECTS (Distinguishes Tap vs Orbit Drag!)
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0, time: 0 };
let lastTapTime = 0;

canvas.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };
});

canvas.addEventListener('pointerup', (e) => {
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  const dtMs = performance.now() - pointerDownPos.time;

  // Only treat as a deliberate tap if finger moved < 12px and lasted < 300ms
  if (Math.hypot(dx, dy) > 12 || dtMs > 300) return;

  audio.unlock();
  if (touchHintEl) touchHintEl.classList.add('hidden');

  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const hits = raycaster.intersectObjects([bicycle.root, pelican.root], true);
  if (hits.length > 0) {
    let obj = hits[0].object;
    let interactType = null;
    while (obj) {
      if (obj.userData && obj.userData.interactType) {
        interactType = obj.userData.interactType;
        break;
      }
      obj = obj.parent;
    }

    if (interactType === 'bell') {
      actionRingBell();
      return;
    }
    if (interactType === 'lamp') {
      const isOn = bicycle.toggleLamp();
      bicycle.setLampIntensity(world.currentTheme().lampLevel);
      showToast(isOn ? '💡 复古磨电车灯：开启！' : '💡 复古磨电车灯：关闭');
      return;
    }
    if (interactType === 'basket' || interactType === 'pinwheel') {
      actionTossFish(hits[0].point);
      showToast('🐟 从车筐抛出一尾鲜鱼！');
      return;
    }
    if (interactType === 'pelican') {
      audio.playPelicanGulp(false);
      pelican.triggerCheer();
      showToast('🦢 鹈鹕嘎嘎点头：再来一条小鱼吧！');
      return;
    }
  }

  // Double-tap anywhere on background/ocean -> toss a shiny fish from that direction!
  const now = performance.now();
  if (now - lastTapTime < 340) {
    const spawnPos = new THREE.Vector3();
    raycaster.ray.at(3.4, spawnPos);
    spawnPos.y = Math.max(0.25, spawnPos.y);
    actionTossFish(spawnPos);
  }
  lastTapTime = now;
});

// Keyboard shortcuts for desktop convenience too!
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    actionBunnyHop();
  } else if (e.key === 'f' || e.key === 'F') {
    actionTossFish();
  } else if (e.key === 'b' || e.key === 'B') {
    actionRingBell();
  } else if (e.key === 'w' || e.key === 'W') {
    actionWheelie();
  } else if (e.key === 'Shift') {
    actionTurboPulse();
  } else if (e.key === 'ArrowLeft') {
    manualSteerBias = 0.22;
  } else if (e.key === 'ArrowRight') {
    manualSteerBias = -0.22;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') manualSteerBias = 0;
});

// ============================================================================
// 7. RESPONSIVE RESIZE HANDLER
// ============================================================================
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  if (currentCamMode !== 'pov') {
    const preset = CAMERA_PRESETS[currentCamMode] || CAMERA_PRESETS.hero;
    camera.fov = computeAspectAdjustedPreset(preset).fov;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ============================================================================
// 8. MAIN ANIMATION LOOP
// ============================================================================
const clock = new THREE.Clock();
let elapsed = 0;
let hudAccum = 0;

const _povPos = new THREE.Vector3();
const _povLook = new THREE.Vector3();

function onFishCaught() {
  fishCaughtCount++;
  if (fishCountEl) fishCountEl.textContent = String(fishCaughtCount);
  fishBoostTimer = 1.6;
  pelican.triggerCatchFish();
  audio.playPelicanGulp(true);
  showToast(`🐟 精准入袋！大喉囊鼓起来啦 (+${fishCaughtCount})`);
}

function animate() {
  requestAnimationFrame(animate);

  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05); // Clamp dt on tab resume
  elapsed += dt;

  // 1. Speed, Turbo & Fish-Boost Dynamics
  if (turboTimer > 0 && !turboHeld) {
    turboTimer = Math.max(0, turboTimer - dt);
  }
  if (fishBoostTimer > 0) {
    fishBoostTimer = Math.max(0, fishBoostTimer - dt);
  }

  const turboFactor = turboHeld ? 1.0 : THREE.MathUtils.clamp(turboTimer / 1.2, 0, 1);
  const boostAdd = turboFactor * 5.2 + (fishBoostTimer > 0 ? 1.8 : 0);
  const targetSpeed = baseCruiseSpeed + boostAdd;
  currentSpeed = THREE.MathUtils.lerp(currentSpeed, targetSpeed, Math.min(1, dt * 4.5));
  const coasting = baseCruiseSpeed < 0.35 && turboFactor < 0.05;

  // 2. Natural Balance Weave & Steering
  const autoWeave = Math.sin(elapsed * 1.15) * 0.075 + Math.sin(elapsed * 2.7) * 0.025;
  const steerAngle = autoWeave + manualSteerBias;
  lateralZ = THREE.MathUtils.clamp(
    lateralZ - currentSpeed * Math.sin(steerAngle) * 0.14 * dt,
    -0.55,
    0.65
  );
  // Gently recenter toward pier middle lane
  lateralZ = THREE.MathUtils.lerp(lateralZ, 0, dt * 0.65);

  // 3. Wheelie & Bunny-Hop Stunt Physics
  if (wheelieTimer > 0) {
    wheelieTimer = Math.max(0, wheelieTimer - dt);
  }
  const wantWheelie = wheelieTimer > 0 ? 1.0 : 0.0;
  wheelieFactor = THREE.MathUtils.lerp(wheelieFactor, wantWheelie, Math.min(1, dt * 7.5));

  if (hopHeight > 0 || hopVelY !== 0) {
    hopHeight += hopVelY * dt;
    hopVelY -= 9.8 * dt;
    if (hopHeight <= 0) {
      hopHeight = 0;
      hopVelY = 0;
    }
  }

  // Apply coupled stunt transforms around rear-wheel contact patch!
  vehicleTrackGroup.position.set(0, hopHeight, lateralZ);
  const wheeliePitch = wheelieFactor * 0.36 + (hopHeight > 0.01 ? hopVelY * 0.045 : 0);
  const bankRoll = -steerAngle * 0.34;
  rearContactPivot.rotation.set(bankRoll, -steerAngle * 0.18, wheeliePitch);

  // 4. Update World (Ocean, Scrolling Pier, Seagulls, Flying Fish)
  const worldState = world.update(dt, elapsed, currentSpeed, turboFactor, pelican, onFishCaught);

  // 5. Update Bicycle Mechanics & Pelican IK + Pouch Physics!
  const approxBounce = Math.sin(elapsed * currentSpeed * 2.2) * 0.008;
  const bikeState = bicycle.update(dt, currentSpeed, coasting, steerAngle, approxBounce, elapsed);

  pelican.update(dt, {
    time: elapsed,
    speed: currentSpeed,
    turboFactor,
    wheelieFactor,
    hopHeight,
    steerAngle,
    crankAngle: bikeState.crankAngle,
    bicycle,
    fishTargetWorld: worldState.incomingFishPos
  });

  // Subtle mechanical freehub sound clicks
  audio.updateMechanicalTicks(bikeState.dWheel, coasting);

  // 6. Camera Director (Orbit, Smooth Preset Glide, or Pelican First-Person POV!)
  if (currentCamMode === 'pov') {
    pelican.povCameraAnchor.getWorldPosition(_povPos);
    pelican.povLookAnchor.getWorldPosition(_povLook);
    camera.position.lerp(_povPos, Math.min(1, dt * 18));
    camera.lookAt(_povLook);
  } else {
    if (camTransition > 0) {
      camTransition = Math.max(0, camTransition - dt * 1.8);
      const alpha = Math.min(1, dt * 6.5);
      camera.position.lerp(camGoalPos, alpha);
      controls.target.lerp(camGoalTarget, alpha);
    }
    controls.update();
  }

  // 7. Throttled HUD Speedometer Update
  hudAccum += dt;
  if (hudAccum > 0.12) {
    hudAccum = 0;
    if (speedValEl) {
      const kmh = Math.round(currentSpeed * 3.6);
      speedValEl.textContent = String(kmh);
    }
  }

  renderer.render(scene, camera);
}

// Kick off animation & toss an introductory welcome fish after 1.1s so first-time viewers
// immediately witness the pelican open its giant beak and catch a fish in its elastic pouch!
animate();
setTimeout(() => {
  world.tossFishTowardPelican(new THREE.Vector3(2.4, 0.55, -1.9));
}, 1100);
