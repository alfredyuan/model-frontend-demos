import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World } from './world.js';
import { Rider } from './rider.js';
import { FishSchool } from './fish.js';
import { Particles } from './particles.js';
import { Sfx } from './audio.js';
import { clamp, lerp, damp } from './util.js';

const $ = (id) => document.getElementById(id);
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
const quality = {
  pixelRatio: Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2),
  shadow: isMobile ? 1024 : 2048,
  terrainSeg: isMobile ? 170 : 220,
  veg: isMobile ? 0.7 : 1,
};

const LANE = 0.95;
const CAM_MODES = [
  { id: 'orbit', name: '🎥 自由环绕 · 拖动旋转 / 双指缩放' },
  { id: 'chase', name: '🚴 追随视角' },
  { id: 'side', name: '📹 侧面跟拍' },
  { id: 'pov', name: '👀 鹈鹕第一视角' },
  { id: 'tv', name: '📺 电视转播' },
  { id: 'drone', name: '🚁 航拍环绕' },
];
const TIME_PRESETS = [
  { tau: 0.36, name: '☀️ 晴朗白天' },
  { tau: 0.715, name: '🌇 金色黄昏' },
  { tau: 0.88, name: '🌙 星空夜晚' },
  { tau: 0.255, name: '🌅 清晨日出' },
];
const DAY_LENGTH = 420; // seconds per full day cycle

function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    $('loading').innerHTML = '<p>😢 你的浏览器不支持 WebGL，鹈鹕骑不了车了</p>';
    return;
  }
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbde0f6, 60, 420);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 1500);

  const world = new World(scene, renderer, quality);
  const road = world.road;
  const rider = new Rider();
  scene.add(rider.root);
  const fish = new FishSchool(scene, road, LANE);
  const fx = new Particles(scene, isMobile ? 500 : 800);
  const sfx = new Sfx();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 45;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.rotateSpeed = isMobile ? 0.7 : 0.9;
  controls.zoomSpeed = 0.9;

  // ------------------------------------------------------------ state
  const st = {
    dist: 4, speed: 0, target: 20 / 3.6, lean: 0, steer: 0,
    jumpY: 0, jumpV: 0, air: false, land: 0,
    handsFree: false, fish: 0, lap: 1, travelled: 0,
    camMode: 0, tau: 0.36, tauAnim: null, timeIdx: 0,
    t: 0, hudT: 0, dustT: 0, smokeT: 0,
  };
  fish.reset(st.dist);
  const S = {}, S2 = {};
  const focus = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const camLook = new THREE.Vector3(), camGoal = new THREE.Vector3(), tmp = new THREE.Vector3();
  const tv = { s: 0, need: true, pos: new THREE.Vector3() };
  const C = (hex) => new THREE.Color(hex);
  const DUST = C(0xcbb48a), SPARK = [C(0xfff3b0), C(0x9fe7ff), C(0xffffff)], GOLD = [C(0xffd23f), C(0xffa400), C(0xfff1a8)];
  const CONFETTI = [C(0xff4d6d), C(0xffd23f), C(0x3ec1ff), C(0x7bd389), C(0xb388ff), C(0xffffff)];
  const SMOKE = C(0xd8d8d8);

  // initial camera: front three-quarter view
  road.sample(st.dist, S);
  focus.set(S.x + S.rx * LANE, S.y + 1.1, S.z + S.rz * LANE);
  camera.position.set(focus.x + S.tx * 3.2 - S.rx * 3.4, focus.y + 0.9, focus.z + S.tz * 3.2 - S.rz * 3.4);
  controls.target.copy(focus);
  camLook.copy(focus);

  // ------------------------------------------------------------ UI
  const toastEl = $('toast');
  let toastTimer = 0;
  function toast(msg, ms = 1600) {
    toastEl.textContent = msg;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  const pop = (el) => { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };

  const slider = $('speed');
  const setTarget = (kmh) => { st.target = kmh / 3.6; $('speedVal').textContent = Math.round(kmh); };
  slider.addEventListener('input', () => setTarget(+slider.value));
  setTarget(+slider.value);

  function setCam(i) {
    st.camMode = (i + CAM_MODES.length) % CAM_MODES.length;
    const m = CAM_MODES[st.camMode];
    controls.enabled = m.id === 'orbit';
    if (m.id === 'orbit') {
      controls.target.copy(focus);
      camera.fov = 55; camera.updateProjectionMatrix();
    }
    if (m.id === 'tv') tv.need = true;
    toast(m.name);
  }
  const ring = () => { sfx.bell(); rider.bellMesh.scale.setScalar(1.4); toast('🔔 叮铃铃～借过借过！'); };
  const jump = () => {
    if (st.air) return;
    st.air = true; st.jumpV = 4.3;
    sfx.whoosh();
    toast(['⤴️ 兔子跳！', '🚀 起飞！', '⤴️ 漂亮！'][Math.floor(Math.random() * 3)], 1000);
  };
  const toggleHands = () => {
    st.handsFree = !st.handsFree;
    $('bHands').classList.toggle('on', st.handsFree);
    toast(st.handsFree ? '🙌 看！不用手！' : '✊ 还是扶好车把吧');
  };
  const cycleTime = () => {
    st.timeIdx = (st.timeIdx + 1) % TIME_PRESETS.length;
    const p = TIME_PRESETS[st.timeIdx];
    let to = p.tau;
    while (to <= st.tau) to += 1;
    st.tauAnim = { from: st.tau, to, k: 0 };
    toast(p.name);
  };
  const honk = () => {
    sfx.honk(); rider.honk();
    toast(['🦢 嘎嘎！', '📣 嘎——！', '😆 看镜头！', '🐟 有鱼吗？'][Math.floor(Math.random() * 4)], 1200);
  };

  const bind = (id, fn) => {
    const el = $(id);
    el.addEventListener('click', (e) => { e.preventDefault(); sfx.ensure(); pop(el); fn(); hideHint(); });
  };
  bind('bCam', () => setCam(st.camMode + 1));
  bind('bBell', ring);
  bind('bJump', jump);
  bind('bHands', toggleHands);
  bind('bTime', cycleTime);
  bind('bSound', () => {
    sfx.setEnabled(!sfx.enabled);
    $('bSound').querySelector('i').textContent = sfx.enabled ? '🔊' : '🔇';
    $('bSound').classList.toggle('on', !sfx.enabled);
  });

  let hintHidden = false;
  function hideHint() { if (!hintHidden) { hintHidden = true; $('hint').classList.add('hide'); } }
  setTimeout(hideHint, 9000);

  addEventListener('keydown', (e) => {
    if (e.repeat && e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
    sfx.ensure();
    switch (e.code) {
      case 'Space': e.preventDefault(); jump(); break;
      case 'KeyB': ring(); break;
      case 'KeyC': setCam(st.camMode + 1); break;
      case 'KeyN': cycleTime(); break;
      case 'KeyH': toggleHands(); break;
      case 'KeyG': honk(); break;
      case 'ArrowUp': slider.value = Math.min(45, +slider.value + 2); setTarget(+slider.value); break;
      case 'ArrowDown': slider.value = Math.max(0, +slider.value - 2); setTarget(+slider.value); break;
    }
  });

  // tap the pelican (or the bike) for a reaction
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; sfx.ensure(); hideHint(); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 350;
    down = null;
    if (moved > 10 || !quick) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...rider.pickPelican, ...rider.pickBike], false)[0];
    if (!hit) return;
    if (rider.pickPelican.includes(hit.object)) honk(); else ring();
  });

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 200));

  // ------------------------------------------------------------ events
  function onCatch(f, at) {
    const n = f.golden ? 5 : 1;
    st.fish += n;
    rider.gulp();
    sfx.gulp(f.golden);
    const cols = f.golden ? GOLD : SPARK;
    const cnt = f.golden ? 60 : 26;
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, sp = 1 + Math.random() * (f.golden ? 3.5 : 2.2);
      const r = Math.sqrt(1 - u * u);
      fx.emit(at.x, at.y, at.z, Math.cos(a) * r * sp + fwd.x * st.speed, u * sp + 1, Math.sin(a) * r * sp + fwd.z * st.speed, cols[i % cols.length],
        { life: 0.7 + Math.random() * 0.5, grav: 4, drag: 1.5, size: 0.11, size1: 0.02 });
    }
    pop($('fishBox'));
    if (f.golden) toast('✨ 金色飞鱼！+5 ✨', 1800);
    else toast(['🐟 好吃！', '🐟 鲜美！', '🐟 Yummy!', '🐟 再来一条！', '😋 嗝～'][Math.floor(Math.random() * 5)], 1000);
  }

  function onLap() {
    st.lap++;
    sfx.fanfare();
    toast(`🏁 第 ${st.lap} 圈！冲鸭！🎉`, 2200);
    pop($('lapBox'));
    const p = world.archPos;
    for (let i = 0; i < 160; i++) {
      fx.emit(p.x + (Math.random() - 0.5) * 5, p.y + 4.2, p.z + (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5,
        CONFETTI[i % CONFETTI.length], { life: 2 + Math.random(), grav: 3, drag: 1.2, size: 0.13, size1: 0.1 });
    }
  }

  // ------------------------------------------------------------ adaptive quality
  const perf = { frames: 0, time: 0, checked: false };
  function adapt(dt) {
    if (perf.checked) return;
    perf.frames++; perf.time += dt;
    if (perf.time > 4) {
      perf.checked = true;
      const fps = perf.frames / perf.time;
      if (fps < 38 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(1);
        onResize();
      }
    }
  }

  // ------------------------------------------------------------ main loop
  const clock = new THREE.Clock();
  let first = true;
  function frame() {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    st.t += dt;
    const t = st.t;
    adapt(rawDt);

    // time of day
    if (st.tauAnim) {
      const A = st.tauAnim;
      A.k = Math.min(1, A.k + dt / 3);
      const e = A.k < 0.5 ? 2 * A.k * A.k : 1 - Math.pow(-2 * A.k + 2, 2) / 2;
      st.tau = lerp(A.from, A.to, e) % 1;
      if (A.k >= 1) st.tauAnim = null;
    } else st.tau = (st.tau + dt / DAY_LENGTH) % 1;
    const night = world.setTime(st.tau);
    rider.setNight(night);

    // riding physics (kinematic, but with a bit of character)
    road.sample(st.dist, S);
    const uphill = clamp(S.slope, -0.15, 0.15);
    const tgt = st.target * (1 - uphill * 1.5);
    st.speed = damp(st.speed, tgt, 1.2, dt);
    const prevLap = Math.floor(st.dist / road.length);
    st.dist += st.speed * dt;
    st.travelled += st.speed * dt;
    if (Math.floor(st.dist / road.length) > prevLap) onLap();
    road.sample(st.dist, S);
    fwd.set(S.tx, 0, S.tz);
    right.set(S.rx, 0, S.rz);
    const wob = Math.sin(t * 1.3) * 0.08 + Math.sin(t * 0.47) * 0.12;
    rider.root.position.set(S.x + S.rx * (LANE + wob * 0.3), S.y, S.z + S.rz * (LANE + wob * 0.3));
    rider.root.rotation.set(-Math.atan(S.slope), Math.atan2(S.tx, S.tz) + wob * 0.02, 0);

    const leanT = clamp(-Math.atan((st.speed * st.speed * S.k) / 9.8) * 1.3, -0.5, 0.5);
    st.lean = damp(st.lean, leanT, 4, dt);
    const steerT = Math.atan(1.09 * S.k) * 2.5 + Math.sin(t * 1.3) * 0.02 + (st.handsFree ? Math.sin(t * 2.1) * 0.04 : 0);

    // hop
    if (st.air) {
      st.jumpV -= 13 * dt;
      st.jumpY += st.jumpV * dt;
      if (st.jumpY <= 0) {
        st.jumpY = 0; st.air = false; st.land = 1;
        sfx.thud();
        const rw = rider.root.localToWorld(tmp.set(0, 0.03, -0.3));
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 1.5;
          fx.emit(rw.x, rw.y, rw.z, Math.cos(a) * sp, 0.4 + Math.random() * 0.6, Math.sin(a) * sp, DUST, { life: 0.9, drag: 2.5, size: 0.25, size1: 0.7, alpha: 0.45 });
        }
      }
    }
    st.land = Math.max(0, st.land - dt * 2.5);
    rider.lean.position.y = st.jumpY - Math.sin(st.land * Math.PI) * 0.05;
    rider.lean.rotation.x = st.air ? -clamp(st.jumpV * 0.06, -0.22, 0.26) : Math.sin(st.land * Math.PI * 2) * 0.03;
    rider.lean.rotation.z = st.lean;

    // fish
    rider.camLocal = rider.camLocal || new THREE.Vector3();
    rider.lean.updateMatrixWorld(true);
    const camLocal = rider.lean.worldToLocal(rider.camLocal.copy(camera.position));
    rider.update({ dt, t, speed: st.speed, steer: steerT, handsFree: st.handsFree, climb: (S.slope > 0.045 && st.speed > 1.5) || st.target > 33 / 3.6, camLocal });
    const nearest = fish.update(dt, t, st.dist, rider.beakWorld, night, onCatch);
    rider.jawTarget = nearest > 0.8 && nearest < 3.4 ? 1 : 0;
    rider.bellMesh.scale.setScalar(damp(rider.bellMesh.scale.x, 1, 8, dt));

    // dust & smoke
    st.dustT += dt * (st.air ? 0 : Math.max(0, st.speed - 1.5) * 4);
    while (st.dustT > 1) {
      st.dustT -= 1;
      const rw = rider.root.localToWorld(tmp.set((Math.random() - 0.5) * 0.1, 0.04, -0.6));
      fx.emit(rw.x, rw.y, rw.z, -fwd.x * st.speed * 0.15 + (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.4, -fwd.z * st.speed * 0.15 + (Math.random() - 0.5) * 0.4,
        DUST, { life: 0.9, drag: 1.5, size: 0.12, size1: 0.55, alpha: 0.28 * (1 - night * 0.6) });
    }
    st.smokeT += dt;
    if (st.smokeT > 0.35) {
      st.smokeT = 0;
      for (const c of world.chimneys) {
        if (c.distanceToSquared(rider.root.position) > 140 * 140) continue;
        fx.emit(c.x, c.y, c.z, 0.25 + Math.random() * 0.2, 0.7 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2, SMOKE,
          { life: 4.5, drag: 0.2, size: 0.6, size1: 2.6, alpha: 0.35 * (1 - night * 0.7) });
      }
    }

    // ------------------------------------------------------------ camera
    focus.copy(rider.root.position);
    focus.y += 1.1 + st.jumpY * 0.6;
    const mode = CAM_MODES[st.camMode].id;
    let fov = 55;
    if (mode === 'orbit') {
      tmp.subVectors(focus, controls.target);
      camera.position.add(tmp);
      controls.target.copy(focus);
      controls.update();
    } else {
      let rate = 4;
      if (mode === 'chase') {
        camGoal.copy(focus).addScaledVector(fwd, -4.3).add(tmp.set(0, 0.9, 0));
        camLook.copy(focus).addScaledVector(fwd, 2.5);
        rate = 3.5;
      } else if (mode === 'side') {
        camGoal.copy(focus).addScaledVector(right, 3.6).addScaledVector(fwd, 0.7).add(tmp.set(0, -0.35, 0));
        camLook.copy(focus).addScaledVector(fwd, 0.3).add(tmp.set(0, -0.2, 0));
        rate = 5;
      } else if (mode === 'pov') {
        camGoal.copy(rider.headWorld).addScaledVector(fwd, 0.16).add(tmp.set(0, 0.2, 0));
        road.sample(st.dist + 14, S2);
        camLook.set(S2.x + S2.rx * LANE, S2.y + 0.6, S2.z + S2.rz * LANE);
        rate = 14;
        fov = 68;
      } else if (mode === 'tv') {
        const behind = road.wrap(st.dist - tv.s);
        if (tv.need || (behind > 14 && behind < road.length - 60)) {
          tv.need = false;
          tv.s = st.dist + 26 + Math.random() * 14;
          road.sample(tv.s, S2);
          // stay on the tree-free shoulder so nothing blocks the shot
          const side = Math.random() < 0.5 ? -1 : 1;
          const off = 3.0 + Math.random() * 0.8;
          const x = S2.x + S2.rx * side * off, z = S2.z + S2.rz * side * off;
          tv.pos.set(x, Math.max(world.groundHeight(x, z) + 0.6, S2.y + 0.6 + Math.random() * 2.2), z);
          camera.position.copy(tv.pos);
          camLook.copy(focus);
        }
        camGoal.copy(tv.pos);
        camLook.copy(focus);
        rate = 100;
        const d = camera.position.distanceTo(focus);
        fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(1.7 / d)), 8, 50);
      } else if (mode === 'drone') {
        const a = t * 0.22;
        camGoal.set(focus.x + Math.cos(a) * 9, focus.y + 4.5 + Math.sin(t * 0.3) * 1.5, focus.z + Math.sin(a) * 9);
        camLook.copy(focus);
        rate = 3;
      }
      camera.position.x = damp(camera.position.x, camGoal.x, rate, dt);
      camera.position.y = damp(camera.position.y, camGoal.y, rate, dt);
      camera.position.z = damp(camera.position.z, camGoal.z, rate, dt);
      camera.lookAt(camLook);
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov = mode === 'tv' ? fov : damp(camera.fov, fov, 4, dt);
        camera.updateProjectionMatrix();
      }
    }
    if (mode !== 'pov') {
      const gh = Math.max(world.groundHeight(camera.position.x, camera.position.z), 0) + 0.35;
      if (camera.position.y < gh) camera.position.y = gh;
    }

    world.update(dt, t, focus, camera);
    fx.update(dt, camera, renderer);
    sfx.setWind(st.speed);

    st.hudT -= dt;
    if (st.hudT <= 0) {
      st.hudT = 0.12;
      $('kmh').textContent = Math.round(st.speed * 3.6);
      $('fishN').textContent = st.fish;
      $('lapN').textContent = st.lap;
      $('km').textContent = (st.travelled / 1000).toFixed(2);
    }

    renderer.render(scene, camera);
    if (first) {
      first = false;
      $('loading').classList.add('done');
      setTimeout(() => $('loading').remove(), 900);
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
  requestAnimationFrame(frame);
}

// let the loading screen paint before the (synchronous) world build
requestAnimationFrame(() => setTimeout(start, 30));
