
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const app = document.getElementById('app');

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// ---------- scene & sky ----------
const scene = new THREE.Scene();
const sky = (() => {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#5aa8e0'); g.addColorStop(0.55,'#a9d9f0'); g.addColorStop(1,'#e8f6ef');
  ctx.fillStyle = g; ctx.fillRect(0,0,2,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
scene.background = sky;
scene.fog = new THREE.Fog(0xcfeaf5, 28, 70);

// ---------- camera & controls ----------
const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 300);
camera.position.set(7.5, 4.6, 9.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.1, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.7;
controls.minDistance = 5; controls.maxDistance = 32;
controls.maxPolarAngle = Math.PI * 0.49;

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a8f5a, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
sun.position.set(9, 15, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
const sv = 15;
sun.shadow.camera.left = -sv; sun.shadow.camera.right = sv;
sun.shadow.camera.top = sv;  sun.shadow.camera.bottom = -sv;
sun.shadow.bias = -0.0003;
scene.add(sun);

const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(1.8, 24, 24),
  new THREE.MeshBasicMaterial({ color:0xfff1c2 }));
sunDisc.position.set(18, 17, -16); scene.add(sunDisc);

// ---------- ground ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(80, 64),
  new THREE.MeshStandardMaterial({ color:0x8fc06b, roughness:1 }));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

// road + scrolling dashes
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 4.4),
  new THREE.MeshStandardMaterial({ color:0x6b6f77, roughness:1 }));
road.rotation.x = -Math.PI/2; road.position.y = 0.01; road.receiveShadow = true;
scene.add(road);

const dashes = [];
const dashGeo = new THREE.PlaneGeometry(1.4, 0.18);
const dashMat = new THREE.MeshStandardMaterial({ color:0xf2e27a, roughness:1 });
const DASH_RANGE = 26, DASH_GAP = 2.6;
for (let x = -DASH_RANGE; x <= DASH_RANGE; x += DASH_GAP){
  const d = new THREE.Mesh(dashGeo, dashMat);
  d.rotation.x = -Math.PI/2; d.position.set(x, 0.02, 0);
  scene.add(d); dashes.push(d);
}

// clouds
const cloudMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:1 });
const clouds = [];
function makeCloud(x,y,z,sc){
  const g = new THREE.Group();
  [[0,0,0,1],[1.1,-.1,0,.8],[-1.1,-.1,0,.8],[.5,.5,.3,.7],[-.5,.4,-.2,.65]]
    .forEach(([dx,dy,dz,r])=>{
      const m = new THREE.Mesh(new THREE.SphereGeometry(r,16,16), cloudMat);
      m.position.set(dx,dy,dz); g.add(m);
    });
  g.position.set(x,y,z); g.scale.setScalar(sc); scene.add(g); clouds.push(g);
}
makeCloud(-14,10,-16,1.6); makeCloud(11,12,-20,2.2);
makeCloud(0,9,-24,1.9); makeCloud(20,8,-10,1.3);

// ---------- helper materials ----------
const M = (c,r=0.6,m=0)=> new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:m});
const white  = M(0xf7f7f2, .75);
const beakM  = M(0xf6a623, .5);
const pouchM = M(0xf4b942, .5);
const darkM  = M(0x26282c, .4, .3);
const tyreM  = M(0x1c1d20, .8);
const rimM   = M(0xcfd3d8, .35, .7);
const frameM = M(0xd6362f, .35, .55);
const eyeM   = M(0x111111, .2);

// ---------- bicycle ----------
const WHEEL_R = 1.15;
const bike = new THREE.Group(); scene.add(bike);

function wheel(px){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.11, 16, 40), tyreM));
  g.children[0].castShadow = true;
  g.add(new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R-0.12, 0.04, 12, 40), rimM));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.18,12), rimM);
  hub.rotation.x = Math.PI/2; g.add(hub);
  for (let i=0;i<10;i++){
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,(WHEEL_R-0.12)*2,6), rimM);
    sp.rotation.z = i*Math.PI/5; g.add(sp);
  }
  g.position.set(px, WHEEL_R, 0); bike.add(g); return g;
}
const wheelF = wheel( 1.5);
const wheelB = wheel(-1.5);

function tube(a, b, rad, mat){
  const dir = new THREE.Vector3().subVectors(b,a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,len,12), mat);
  m.castShadow = true;
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
  bike.add(m); return m;
}
const BB      = new THREE.Vector3(0, 0.95, 0);
const seatTop = new THREE.Vector3(-0.95, 2.55, 0);
const headTop = new THREE.Vector3(1.45, 2.35, 0);
const hubF    = new THREE.Vector3(1.5, WHEEL_R, 0);
const hubB    = new THREE.Vector3(-1.5, WHEEL_R, 0);
tube(hubB, BB, 0.055, frameM);
tube(BB, seatTop, 0.06, frameM);
tube(BB, headTop, 0.06, frameM);
tube(seatTop, headTop, 0.06, frameM);
tube(hubB, seatTop, 0.05, frameM);
tube(hubF, headTop, 0.055, frameM);

const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75,0.14,0.34), darkM);
seat.position.copy(seatTop).add(new THREE.Vector3(0,0.12,0));
seat.castShadow = true; bike.add(seat);

tube(headTop, headTop.clone().add(new THREE.Vector3(0.1,0.5,0)), 0.045, darkM);
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1.1,12), darkM);
bar.position.copy(headTop).add(new THREE.Vector3(0.1,0.52,0));
bar.castShadow = true; bike.add(bar);

const crank = new THREE.Group(); crank.position.copy(BB); bike.add(crank);
function pedal(rot){
  const g = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.07,0.07), darkM);
  arm.position.set(0.25,0,0); g.add(arm);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.06,0.2), darkM);
  pad.position.set(0.5,0,0); g.add(pad);
  g.rotation.z = rot; crank.add(g); return g;
}
pedal(0); pedal(Math.PI);

// ---------- pelican ----------
const pelican = new THREE.Group(); bike.add(pelican);
const body = new THREE.Mesh(new THREE.SphereGeometry(0.95,28,22), white);
body.scale.set(1.5,1.05,0.95); body.position.set(-0.55,3.35,0);
body.rotation.z = 0.22; body.castShadow = true; pelican.add(body);

const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42,1.1,16), white);
tail.position.set(-1.9,3.5,0); tail.rotation.z = 1.9; tail.castShadow = true; pelican.add(tail);

const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.46,1.3,18), white);
neck.position.set(0.38,3.98,0); neck.rotation.z = -0.5; neck.castShadow = true; pelican.add(neck);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.52,24,20), white);
head.position.set(0.98,4.6,0); head.castShadow = true; pelican.add(head);

const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2,1.7,18), beakM);
beak.position.set(2.0,4.52,0); beak.rotation.z = -1.45; beak.castShadow = true; pelican.add(beak);
const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.46,20,16), pouchM);
pouch.scale.set(1.5,0.82,0.82); pouch.position.set(1.55,4.2,0); pelican.add(pouch);

[0.3,-0.3].forEach((dz)=>{
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.075,12,12), eyeM);
  e.position.set(1.2,4.78,dz); pelican.add(e);
  const w = new THREE.Mesh(new THREE.SphereGeometry(0.03,8,8), M(0xffffff,.3));
  w.position.set(1.26,4.82,dz+0.02); pelican.add(w);
});

function wing(sign){
  const w = new THREE.Mesh(new THREE.SphereGeometry(0.72,20,14), white);
  w.scale.set(1.1,0.25,0.62);
  w.position.set(-0.55,3.52, sign*0.92);
  w.castShadow = true; pelican.add(w); return w;
}
const wingR = wing(1), wingL = wing(-1);

function leg(sign){
  const g = new THREE.Group(); g.position.set(-0.1,3.0,sign*0.3); pelican.add(g);
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.09,1.0,10), beakM);
  thigh.position.y = -0.5; g.add(thigh);
  const shin = new THREE.Group(); shin.position.y = -1.0; g.add(shin);
  const shinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.07,0.9,10), beakM);
  shinMesh.position.y = -0.45; shin.add(shinMesh);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.08,0.26), beakM);
  foot.position.y = -0.9; shin.add(foot);
  g.userData = { shin }; return g;
}
const legR = leg(1), legL = leg(-1);

// ---------- animation ----------
const clock = new THREE.Clock();
const SPEED = 3.2;
let last = performance.now();

function frame(now){
  const dt = Math.min((now-last)/1000, 0.05); last = now;
  const t = clock.getElapsedTime();
  const phase = t * SPEED;

  wheelF.rotation.z = -phase;
  wheelB.rotation.z = -phase;
  crank.rotation.z = phase;

  [legR, legL].forEach((lg, i)=>{
    const a = phase + (i===0 ? 0 : Math.PI);
    lg.rotation.z = -0.35 + Math.sin(a)*0.5;
    lg.userData.shin.rotation.z = 0.6 + Math.cos(a)*0.55;
  });

  pelican.position.y = Math.sin(phase*2)*0.04;
  wingR.rotation.x =  Math.sin(phase*2)*0.35 + 0.1;
  wingL.rotation.x = -Math.sin(phase*2)*0.35 - 0.1;
  head.position.y = 4.6 + Math.sin(phase*2+0.6)*0.03;

  for (const d of dashes){
    d.position.x -= SPEED*WHEEL_R*dt;
    if (d.position.x < -DASH_RANGE) d.position.x += DASH_RANGE*2 + DASH_GAP;
  }
  for (const c of clouds){
    c.position.x -= 0.5*dt;
    if (c.position.x < -28) c.position.x = 26;
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// surface any module error to screen (useful on the deployed page)
addEventListener('error', e=>{ document.getElementById('err').textContent = 'ERR: '+e.message; });
