import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const wrap = document.querySelector('#canvas-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecfd0);
scene.fog = new THREE.Fog(0x8ecfd0, 28, 115);
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, .1, 180);
camera.position.set(10, 7.5, 17);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; wrap.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 3.1, 0); controls.enableDamping = true; controls.dampingFactor = .055; controls.minDistance = 8; controls.maxDistance = 27; controls.minPolarAngle = .75; controls.maxPolarAngle = 1.52; controls.enablePan = false;
const clock = new THREE.Clock();
const palette = { dark:0x152a36, navy:0x183849, teal:0x329c9d, mint:0xbbe2d0, orange:0xe98d5e, cream:0xf3e7c9, yellow:0xf6c85f, pink:0xd77572 };

scene.add(new THREE.HemisphereLight(0xdaf5e9, 0x18354d, 2.2));
const sun = new THREE.DirectionalLight(0xffe1bd, 3.2); sun.position.set(-10,18,8); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-25; sun.shadow.camera.right=25; sun.shadow.camera.top=25; sun.shadow.camera.bottom=-25; scene.add(sun);
const fill = new THREE.DirectionalLight(0x8bdde2, 1.2); fill.position.set(12,7,-10); scene.add(fill);

function mat(color, roughness=.7) { return new THREE.MeshStandardMaterial({ color, roughness, metalness:.05 }); }
function mesh(geo, material, pos=[0,0,0], scale=[1,1,1]) { const m=new THREE.Mesh(geo,material); m.position.set(...pos); m.scale.set(...scale); m.castShadow=true; m.receiveShadow=true; return m; }
function cyl(radius, height, material, pos, rot=[0,0,0], radial=16) { const m=mesh(new THREE.CylinderGeometry(radius,radius,height,radial),material,pos); m.rotation.set(...rot); return m; }

const ocean = mesh(new THREE.PlaneGeometry(150,150), mat(0x2c9fa9,.45), [0,-.18,0], [1,1,1]); ocean.rotation.x=-Math.PI/2; ocean.receiveShadow=true; scene.add(ocean);
const sand = mesh(new THREE.CircleGeometry(34,64), mat(0xd9c486), [0,-.05,0]); sand.rotation.x=-Math.PI/2; sand.scale.set(1,.44,1); scene.add(sand);
const path = mesh(new THREE.RingGeometry(5.3,6.35,64), mat(0xe7d09a), [0,.005,1], [1,.48,1]); path.rotation.x=-Math.PI/2; scene.add(path);
for(let i=0;i<34;i++){ const a=i/34*Math.PI*2; const r=7+Math.random()*3; const rock=cyl(.12+Math.random()*.25,.12+Math.random()*.18,mat(i%2?0x90aa92:0x6c9690),[Math.cos(a)*r,.07,Math.sin(a)*r*.45],[0,Math.random(),0],7); scene.add(rock); }

function cloud(x,y,z,s){ const g=new THREE.Group(); for(let i=0;i<5;i++) g.add(mesh(new THREE.SphereGeometry(1,14,10),mat(0xeaf1df,.95),[(i-2)*.75,(i%2)*.25,0],[1.3, .65+Math.random()*.3, .8])); g.position.set(x,y,z); g.scale.setScalar(s); scene.add(g); }
cloud(-15,10,-20,2.3); cloud(13,12,-25,1.7); cloud(22,7,-12,1.2);

const lighthouse=new THREE.Group(); lighthouse.add(cyl(.5,4,mat(0xf0dfb9),[-.0,2,-9],[0,0,0],12)); lighthouse.add(cyl(.7,.3,mat(palette.orange),[0,4.05,-9],[0,0,0],12)); lighthouse.add(mesh(new THREE.ConeGeometry(.78,1.05,8),mat(palette.navy),[0,4.7,-9])); lighthouse.add(mesh(new THREE.SphereGeometry(.24,12,8),mat(palette.yellow),[0,4.48,-9])); lighthouse.position.x=-9; scene.add(lighthouse);
for(let i=0;i<10;i++){ const h=1+Math.random()*2; const cliff=mesh(new THREE.ConeGeometry(1.4+Math.random(),h,5),mat(i%2?0x487c7b:0x376d72),[(i-5)*2.2, h/2-.05,-17-Math.random()*3]); cliff.rotation.y=Math.random(); scene.add(cliff); }

function makeWheel(z){ const g=new THREE.Group(); const tire=new THREE.Mesh(new THREE.TorusGeometry(1.38,.12,12,32),mat(0x172b30,.5)); tire.rotation.x=Math.PI/2; tire.castShadow=true; g.add(tire); const hub=cyl(.13,.18,mat(palette.orange),[0,0,0],[Math.PI/2,0,0],12); g.add(hub); for(let i=0;i<12;i++){ const spoke=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1.28,5),mat(0xe8e2ca,.45)); spoke.rotation.z=i*Math.PI/6; spoke.position.y=0; g.add(spoke); } g.position.set(0,1.45,z); return g; }
const bike=new THREE.Group(); scene.add(bike); bike.position.set(0,0,.25);
const bikeMat=mat(palette.navy,.48), orangeMat=mat(palette.orange,.42), metalMat=mat(0xbacbc2,.3);
const rear=makeWheel(1.35), front=makeWheel(-1.35); bike.add(rear,front);
function tube(a,b,r,material){ const va=new THREE.Vector3(...a), vb=new THREE.Vector3(...b), d=vb.clone().sub(va); const m=cyl(r,d.length(),material); m.position.copy(va).add(vb).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m; }
bike.add(tube([0,1.45,1.35],[0,2.9,.2],.105,orangeMat),tube([0,2.9,.2],[0,1.45,-1.35],.105,bikeMat),tube([0,1.45,-1.35],[0,1.45,1.35],.1,bikeMat),tube([0,2.9,.2],[0,1.45,1.35],.105,orangeMat));
const fork=tube([0,1.45,-1.35],[0,3.05,-1.7],.085,metalMat); bike.add(fork,tube([0,3.05,-1.7],[0,3.35,-1.7],.07,bikeMat)); bike.add(tube([-.42,3.35,-1.7],[.42,3.35,-1.7],.07,bikeMat));
const crank=cyl(.18,.2,orangeMat,[0,1.45,0],[Math.PI/2,0,0]); bike.add(crank); bike.add(tube([0,1.45,0],[.48,1.72,0],.04,metalMat),tube([0,1.45,0],[-.48,1.18,0],.04,metalMat));
const basket=mesh(new THREE.BoxGeometry(1.35,.55,1.15),mat(0xd6ae72),[0,3.38,.55],[1,1,.9]); basket.material.wireframe=true; basket.castShadow=false; bike.add(basket);

const pelican=new THREE.Group(); bike.add(pelican); pelican.position.set(0,3.65,.55); pelican.rotation.y=Math.PI;
const body=mesh(new THREE.SphereGeometry(1.12,20,14),mat(0xf0e7d0),[0,.55,0],[.78,1.05,.7]); pelican.add(body);
const neck=mesh(new THREE.SphereGeometry(.67,18,12),mat(0xf5eddc),[0,1.45,.02],[.64,1.25,.6]); pelican.add(neck);
const head=mesh(new THREE.SphereGeometry(.74,20,14),mat(0xf6ecda),[0,2.42,.03],[.94,.88,.82]); pelican.add(head);
const crown=mesh(new THREE.SphereGeometry(.52,12,8),mat(0xd8e5d6),[0,3.02,.04],[.65,.55,.65]); pelican.add(crown);
const beak=mesh(new THREE.ConeGeometry(.47,2.25,4),mat(palette.orange),[0,2.15,.98],[1,.8,1]); beak.rotation.x=Math.PI/2; beak.rotation.z=Math.PI/4; pelican.add(beak);
const pouch=mesh(new THREE.SphereGeometry(.55,16,10),mat(0xf2a578),[0,1.82,.82],[1.05,.62,.8]); pelican.add(pouch);
for(const x of [-.32,.32]) { const eye=mesh(new THREE.SphereGeometry(.09,10,8),mat(0x17232d),[x,2.56,.67]); pelican.add(eye); const leg=cyl(.07,.9,orangeMat,[x*.7,-.18,.05],[0,0,0],8); pelican.add(leg); const foot=mesh(new THREE.SphereGeometry(.2,10,6),orangeMat,[x*.7,-.63,-.04],[1,.32,1.7]); pelican.add(foot); }
function wing(x){ const w=mesh(new THREE.SphereGeometry(.74,12,8),mat(x<0?0xb5cfc7:0xc2d9cf),[x*.84,2.0,-.1],[.34,1.02,.75]); w.rotation.z=x<0?-.48:.48; return w; } pelican.add(wing(-1),wing(1));

const flagPole=cyl(.025,1.1,metalMat,[0,4.35,-1.7]); bike.add(flagPole); const flag=mesh(new THREE.PlaneGeometry(.62,.35),mat(palette.orange),[.29,4.72,-1.7]); flag.rotation.y=Math.PI/2; bike.add(flag);

const particleGeo=new THREE.BufferGeometry(); const points=[]; for(let i=0;i<95;i++) points.push((Math.random()-.5)*45,Math.random()*15+1,(Math.random()-.5)*28-2); particleGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0xeaf8e8,size:.08,transparent:true,opacity:.42})); scene.add(particles);
const foam=new THREE.Group(); for(let i=0;i<18;i++){ const f=mesh(new THREE.TorusGeometry(.25+Math.random()*.35,.025,6,16),mat(0xc9f2e6),[(Math.random()-.5)*20,.03,(Math.random()-.5)*10]); f.rotation.x=Math.PI/2; f.scale.z=.4; foam.add(f); } scene.add(foam);

document.querySelector('#camera-btn').addEventListener('click',()=>{ camera.position.set(10,7.5,17); controls.target.set(0,3.1,0); controls.update(); });
let muted=false; document.querySelector('#sound-btn').addEventListener('click',e=>{ muted=!muted; e.currentTarget.textContent=muted?'◑':'◒'; });
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.8)); });
setTimeout(()=>document.querySelector('#loading').classList.add('done'),450);
function animate(){ requestAnimationFrame(animate); const t=clock.getElapsedTime(); controls.update(); pelican.position.y=3.65+Math.sin(t*2.1)*.035; pelican.rotation.z=Math.sin(t*1.8)*.018; bike.rotation.z=Math.sin(t*1.8)*.008; rear.rotation.z=front.rotation.z=t*1.1; particles.rotation.y=t*.008; foam.rotation.y=t*.018; renderer.render(scene,camera); } animate();
