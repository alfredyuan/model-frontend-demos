import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#scene');
const loader = document.querySelector('#loader');
const speedValue = document.querySelector('#speedValue');
const rideState = document.querySelector('#rideState');
const playToggle = document.querySelector('#playToggle');
const resetCamera = document.querySelector('#resetCamera');
const detailToggle = document.querySelector('#detailToggle');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x72c7cb);
scene.fog = new THREE.Fog(0x72c7cb, 22, 72);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 150);
camera.position.set(7.4, 4.25, 8.7);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.85, .15);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.minDistance = 5.1;
controls.maxDistance = 15;
controls.minPolarAngle = .62;
controls.maxPolarAngle = 1.47;
controls.enablePan = false;
controls.rotateSpeed = .45;
controls.zoomSpeed = .72;

const clock = new THREE.Clock();
let playing = true;
let detailMode = false;
let rideTime = 0;

const palette = {
  ink: new THREE.Color(0xf4efe2),
  shadow: new THREE.Color(0xdbcdb7),
  warm: new THREE.Color(0xe86f4f),
  beak: new THREE.Color(0xf29a47),
  beakDark: new THREE.Color(0xd9673f),
  tire: new THREE.Color(0x183e43),
  metal: new THREE.Color(0xced7c8),
  coral: new THREE.Color(0xd95f4c),
  road: new THREE.Color(0xd88767),
  sand: new THREE.Color(0xe8c891),
  sea: new THREE.Color(0x329fa7),
  seaLight: new THREE.Color(0x67c7bd),
  leaf: new THREE.Color(0x307e67),
  trunk: new THREE.Color(0x9c6549)
};

function mat(color, roughness = .78, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
const mats = {
  body: mat(palette.ink), shadow: mat(palette.shadow), warm: mat(palette.warm), beak: mat(palette.beak), beakDark: mat(palette.beakDark),
  tire: mat(palette.tire), metal: mat(palette.metal, .4, .55), coral: mat(palette.coral), road: mat(palette.road), sand: mat(palette.sand),
  sea: mat(palette.sea), seaLight: mat(palette.seaLight), leaf: mat(palette.leaf), trunk: mat(palette.trunk), black: mat(0x142d30), cloud: mat(0xf3eee0)
};

const hemi = new THREE.HemisphereLight(0xd9f7eb, 0x7a4e42, 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b6, 3.8);
sun.position.set(-8, 13, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -8;
sun.shadow.bias = -.0005;
scene.add(sun);

function mesh(geometry, material, parent = scene) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object);
  return object;
}

function cylinderBetween(a, b, radius, material, parent, radial = 8) {
  const start = new THREE.Vector3(...a); const end = new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(end, start);
  const object = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), radial), material, parent);
  object.position.copy(start).add(end).multiplyScalar(.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return object;
}

function lowSphere(radius, material, position, scale = [1, 1, 1], parent = scene, segments = 10) {
  const object = mesh(new THREE.IcosahedronGeometry(radius, 1), material, parent);
  object.position.set(...position); object.scale.set(...scale);
  return object;
}

function makeEnvironment() {
  const world = new THREE.Group();
  world.name = 'coastal world';
  scene.add(world);

  mesh(new THREE.PlaneGeometry(75, 120), mats.sand, world).rotation.x = -Math.PI / 2;
  const ocean = mesh(new THREE.PlaneGeometry(30, 120, 20, 20), mats.sea, world);
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-19, -.06, -10);
  const seaFoam = mesh(new THREE.PlaneGeometry(1.1, 120), mats.seaLight, world);
  seaFoam.rotation.x = -Math.PI / 2; seaFoam.position.set(-4.55, -.01, -10);

  const road = mesh(new THREE.PlaneGeometry(5.1, 120), mats.road, world);
  road.rotation.x = -Math.PI / 2; road.position.y = .015;
  const roadEdgeL = mesh(new THREE.PlaneGeometry(.1, 120), mats.sand, world); roadEdgeL.rotation.x = -Math.PI / 2; roadEdgeL.position.set(-2.5, .025, 0);
  const roadEdgeR = roadEdgeL.clone(); roadEdgeR.position.x = 2.5; world.add(roadEdgeR);

  const laneMarks = new THREE.Group(); laneMarks.name = 'moving lane marks'; world.add(laneMarks);
  for (let i = -11; i <= 11; i++) {
    const mark = mesh(new THREE.BoxGeometry(.11, .025, 1.5), mats.sand, laneMarks);
    mark.position.set(0, .055, i * 5.1);
  }

  for (let i = 0; i < 7; i++) {
    const wave = mesh(new THREE.TorusGeometry(.45 + (i % 2) * .15, .035, 5, 12, Math.PI * .72), mats.seaLight, world);
    wave.rotation.x = -Math.PI / 2; wave.rotation.z = Math.PI * .22; wave.position.set(-4.9 - (i % 3) * .25, .01, -24 + i * 8.2);
  }

  const sunDisc = mesh(new THREE.CircleGeometry(3.1, 32), new THREE.MeshBasicMaterial({ color: 0xffd68c, transparent: true, opacity: .75 }), world);
  sunDisc.position.set(-13, 13, -35); sunDisc.lookAt(camera.position);

  function palm(x, z, scale = 1) {
    const palmGroup = new THREE.Group(); palmGroup.position.set(x, 0, z); palmGroup.scale.setScalar(scale); world.add(palmGroup);
    cylinderBetween([0, 0, 0], [.12, 2.5, 0], .13, mats.trunk, palmGroup, 7);
    cylinderBetween([.12, 2.5, 0], [-.18, 3.65, .05], .11, mats.trunk, palmGroup, 7);
    for (let i = 0; i < 7; i++) {
      const leaf = mesh(new THREE.ConeGeometry(.1, 1.3, 4), mats.leaf, palmGroup);
      leaf.position.set(-.18, 3.65, .05); leaf.rotation.z = Math.PI / 2 + (i - 3) * .22; leaf.rotation.x = (i % 2 ? .2 : -.2); leaf.translateY(.58);
    }
    lowSphere(.25, mats.leaf, [-.18, 3.55, .05], [1, .7, 1], palmGroup, 7);
  }
  palm(-6.2, -8, 1.1); palm(5.8, -13, .82); palm(-7.4, 19, .9); palm(6.6, 25, 1.15);

  const rocks = new THREE.Group(); world.add(rocks);
  for (let i = 0; i < 17; i++) {
    const side = i % 2 ? 1 : -1;
    const rock = lowSphere(.18 + (i % 3) * .08, i % 3 ? mats.shadow : mats.sand, [side * (3.25 + (i % 4) * .55), .12, -31 + i * 4.4], [1.5, .65, 1], rocks, 7);
    rock.rotation.y = i * .8;
  }

  const clouds = new THREE.Group(); clouds.name = 'clouds'; world.add(clouds);
  function cloud(x, y, z, s) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); clouds.add(g);
    lowSphere(.58, mats.cloud, [0, 0, 0], [1.5, .55, .7], g, 7);
    lowSphere(.47, mats.cloud, [-.55, .05, .02], [1, .7, .8], g, 7);
    lowSphere(.43, mats.cloud, [.55, .02, .03], [1.1, .6, .75], g, 7);
  }
  cloud(-8, 7.7, -16, 1.2); cloud(7, 8.8, -27, 1.5); cloud(5, 6.5, 7, .75); cloud(-11, 9.5, 19, .9);

  return { world, laneMarks, clouds };
}

function makeBicycle() {
  const bike = new THREE.Group(); bike.name = 'bicycle'; bike.position.y = .12;
  const wheels = new THREE.Group(); bike.add(wheels);
  const wheelRadius = 1.03; const rearZ = -1.12; const frontZ = 1.12; const axleY = 1.05;
  const wheelGroups = [];
  function wheel(z) {
    const group = new THREE.Group(); group.position.set(0, axleY, z); wheels.add(group); wheelGroups.push(group);
    const tire = mesh(new THREE.TorusGeometry(wheelRadius, .095, 8, 18), mats.tire, group); tire.rotation.y = Math.PI / 2;
    const rim = mesh(new THREE.TorusGeometry(wheelRadius - .1, .027, 5, 18), mats.metal, group); rim.rotation.y = Math.PI / 2;
    const hub = mesh(new THREE.CylinderGeometry(.08, .08, .27, 8), mats.metal, group); hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 2 / 10;
      cylinderBetween([0, 0, 0], [0, Math.cos(angle) * (wheelRadius - .12), Math.sin(angle) * (wheelRadius - .12)], .012, mats.metal, group, 5).rotation.x += Math.PI / 2;
    }
  }
  wheel(rearZ); wheel(frontZ);

  const frame = new THREE.Group(); bike.add(frame);
  const crank = [0, .93, -.1], seat = [0, 2.0, -.45], rearHub = [0, axleY, rearZ], frontHub = [0, axleY, frontZ];
  cylinderBetween(rearHub, seat, .075, mats.coral, frame); cylinderBetween(seat, crank, .075, mats.coral, frame); cylinderBetween(crank, rearHub, .075, mats.coral, frame);
  cylinderBetween(seat, frontHub, .075, mats.coral, frame); cylinderBetween(crank, frontHub, .075, mats.coral, frame);
  cylinderBetween([0, 2.03, -.55], [0, 2.16, -.28], .06, mats.metal, frame);
  const saddle = mesh(new THREE.BoxGeometry(.38, .1, .19), mats.tire, frame); saddle.position.set(0, 2.1, -.58); saddle.rotation.x = -.08;
  const fork = cylinderBetween([0, axleY, frontZ], [0, 2.16, .28], .06, mats.metal, frame);
  const handleStem = cylinderBetween([0, 2.16, .28], [0, 2.43, .2], .055, mats.metal, frame);
  const handle = cylinderBetween([-.35, 2.43, .2], [.35, 2.43, .2], .045, mats.metal, frame);
  handle.rotation.z = 0;
  const crankGroup = new THREE.Group(); crankGroup.position.set(...crank); bike.add(crankGroup);
  mesh(new THREE.CylinderGeometry(.13, .13, .1, 10), mats.metal, crankGroup).rotation.z = Math.PI / 2;
  const crankArm = cylinderBetween([0, 0, 0], [.42, .02, 0], .025, mats.metal, crankGroup);
  const pedal = mesh(new THREE.BoxGeometry(.25, .04, .1), mats.tire, crankGroup); pedal.position.set(.49, .02, 0);
  const crankArm2 = crankArm.clone(); crankGroup.add(crankArm2); crankArm2.rotation.z = Math.PI;
  const pedal2 = pedal.clone(); crankGroup.add(pedal2); pedal2.position.set(-.49, -.02, 0);

  bike.userData.wheelGroups = wheelGroups; bike.userData.crank = crankGroup;
  return bike;
}

function makePelican() {
  const bird = new THREE.Group(); bird.name = 'pelican';
  const body = new THREE.Group(); body.position.set(0, 2.65, -.3); bird.add(body);
  lowSphere(.72, mats.body, [0, 0, 0], [.74, 1.16, .75], body, 10);
  lowSphere(.57, mats.shadow, [0, -.48, -.12], [.85, .45, .76], body, 9);
  lowSphere(.27, mats.body, [0, -1.08, -.13], [1.2, .75, .95], body, 8);

  const neck = new THREE.Group(); neck.position.set(0, .65, .13); body.add(neck);
  cylinderBetween([0, 0, 0], [0, .72, .03], .27, mats.body, neck, 8);
  lowSphere(.52, mats.body, [0, 1.02, .08], [.9, .95, .85], neck, 9);
  const head = new THREE.Group(); head.position.set(0, 1.32, .18); neck.add(head);
  lowSphere(.52, mats.body, [0, 0, 0], [1, .9, 1], head, 9);
  lowSphere(.14, mats.black, [-.39, .17, .27], [1, 1, .7], head, 8); lowSphere(.14, mats.black, [.39, .17, .27], [1, 1, .7], head, 8);
  lowSphere(.045, mats.ink, [-.41, .19, .37], [1, 1, .7], head, 6); lowSphere(.045, mats.ink, [.41, .19, .37], [1, 1, .7], head, 6);
  const beak = new THREE.Group(); beak.position.set(0, -.08, .48); head.add(beak);
  const upperBill = mesh(new THREE.ConeGeometry(.26, 1.12, 7), mats.beak, beak); upperBill.rotation.x = Math.PI / 2; upperBill.scale.set(1.15, 1, .72); upperBill.position.z = .43;
  const pouch = lowSphere(.32, mats.beakDark, [0, -.22, .62], [.92, .68, 1.35], beak, 8);
  pouch.rotation.x = -.14;
  const billLine = cylinderBetween([-.2, -.08, .63], [.2, -.08, .63], .018, mats.beakDark, beak, 5);

  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(side * .53, .05, -.23); wing.rotation.z = side * -.22; body.add(wing); wings.push(wing);
    lowSphere(.52, mats.body, [side * .13, -.18, 0], [.38, 1.15, .7], wing, 8);
    for (let i = 0; i < 3; i++) {
      const feather = mesh(new THREE.ConeGeometry(.15, .7, 5), i === 1 ? mats.shadow : mats.body, wing);
      feather.position.set(side * (.14 + i * .1), -.82 - i * .04, .03 + i * .08); feather.rotation.z = side * .62; feather.rotation.x = -.25;
    }
  }

  // Keep the long legs connected to the belly while their feet meet the pedals.
  const legs = new THREE.Group(); legs.position.set(0, 2.35, -.1); bird.add(legs);
  const legA = new THREE.Group(); const legB = new THREE.Group(); legs.add(legA, legB); legA.position.x = -.18; legB.position.x = .18;
  function makeLeg(parent, phase) {
    const upper = cylinderBetween([0, -.6, -.05], [0, -1.2, .08], .065, mats.beak, parent, 7);
    const lower = cylinderBetween([0, -1.2, .08], [0, -1.63, .05], .05, mats.beakDark, parent, 7);
    const foot = lowSphere(.18, mats.beak, [0, -1.7, .15], [1, .25, 1.6], parent, 7);
    parent.userData.phase = phase; parent.userData.parts = { upper, lower, foot };
  }
  makeLeg(legA, 0); makeLeg(legB, Math.PI);
  bird.userData = { body, neck, head, wings, legA, legB };
  return bird;
}

const environment = makeEnvironment();
const ride = new THREE.Group(); ride.name = 'ride rig'; ride.position.set(0, 0, 0); scene.add(ride);
const bicycle = makeBicycle(); ride.add(bicycle);
const pelican = makePelican(); pelican.position.set(0, .18, -.34); ride.add(pelican);

function animateLeg(leg, t) {
  const phase = leg.userData.phase;
  const swing = Math.sin(t * 8 + phase) * .28;
  leg.rotation.x = swing;
  leg.userData.parts.foot.rotation.x = -.1 + Math.cos(t * 8 + phase) * .12;
}

function animate(delta) {
  if (playing) rideTime += delta;
  const t = rideTime;
  const cycle = t * 3.4;
  const bob = Math.sin(cycle * 2) * .035;
  ride.position.y = bob;
  ride.rotation.x = Math.sin(cycle) * .018;
  pelican.rotation.z = Math.sin(cycle * 1.2) * .018;
  pelican.userData.wings?.forEach((wing, i) => { wing.rotation.z = (i ? -1 : 1) * -.22 + Math.sin(cycle * 1.7 + i) * .045; });
  animateLeg(pelican.userData.legA, t); animateLeg(pelican.userData.legB, t);
  bicycle.userData.wheelGroups.forEach(group => { group.rotation.x -= delta * (playing ? 7.2 : 0); });
  bicycle.userData.crank.rotation.x += delta * (playing ? 8.6 : 0);
  if (playing) {
    environment.laneMarks.children.forEach((mark, i) => { mark.position.z -= delta * 3.9; if (mark.position.z < -61) mark.position.z += 122; });
    environment.clouds.position.x = Math.sin(t * .045) * .7;
  }
  speedValue.textContent = (8.4 + Math.sin(t * 1.8) * .35).toFixed(1).padStart(4, '0');
  const heading = ['ESE', 'SE', 'ESE', 'SSE'][Math.floor(t / 2.8) % 4];
  document.querySelector('#headingValue').textContent = heading;
}

function setPlaying(next) {
  playing = next;
  rideState.textContent = playing ? 'CRUISING' : 'PAUSED';
  playToggle.setAttribute('aria-label', playing ? 'Pause ride' : 'Play ride');
  playToggle.dataset.tip = playing ? 'Pause ride' : 'Play ride';
  playToggle.innerHTML = playing ? '<span class="icon-pause"></span>' : '<span class="icon-play"></span>';
  document.querySelector('.live-dot').style.background = playing ? 'var(--aqua)' : 'var(--coral)';
}

playToggle.addEventListener('click', () => setPlaying(!playing));
resetCamera.addEventListener('click', () => {
  camera.position.set(7.4, 4.25, 8.7); controls.target.set(0, 1.85, .15); controls.update();
});
detailToggle.addEventListener('click', () => {
  detailMode = !detailMode;
  renderer.setPixelRatio(Math.min(devicePixelRatio, detailMode ? 2 : 1.7));
  detailToggle.style.color = detailMode ? 'var(--aqua)' : '';
  detailToggle.dataset.tip = detailMode ? 'High detail' : 'Toggle detail';
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});

function render() {
  const delta = Math.min(clock.getDelta(), .04);
  animate(delta); controls.update(); renderer.render(scene, camera); requestAnimationFrame(render);
}

render();
setTimeout(() => loader.classList.add('loaded'), 550);
