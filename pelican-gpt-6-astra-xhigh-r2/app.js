import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCyclist } from './cyclist.js';
import { createWorld } from './world.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),stage=$('stage');
let renderer;
try {
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
} catch(error) {
  $('loading').hidden=true;$('loading').style.display='none';$('webgl-error').hidden=false;
  document.querySelectorAll('.controls button,.controls input,#bell-button').forEach(el=>el.disabled=true);
  $('ride-status').textContent='等待海风';$('live-dot').classList.add('paused');
  console.error('WebGL initialization failed:',error);
}
$('reload-button').addEventListener('click',()=>location.reload());
if(renderer) start();

function start(){
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,innerWidth<=700?1.5:1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000,0);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,.1,100);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;controls.minDistance=10;controls.maxDistance=27;controls.minPolarAngle=.32;controls.maxPolarAngle=Math.PI*.465;controls.rotateSpeed=.65;controls.zoomSpeed=.8;
  controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
  const hemisphere=new THREE.HemisphereLight(0xf9f3de,0x97a98d,2.55);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xffedcc,3.4);sun.position.set(-3,9,6);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<=700?1024:2048,innerWidth<=700?1024:2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:8,bottom:-7,near:.5,far:24});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=4;scene.add(sun);
  const rim=new THREE.DirectionalLight(0xd4eee0,1.25);rim.position.set(5,4,-6);scene.add(rim);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.y=-.735;ground.receiveShadow=true;scene.add(ground);
  // A soft contact shadow adds depth even on devices using a small shadow map.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'rgba(51,75,58,.19)');gradient.addColorStop(.6,'rgba(51,75,58,.10)');gradient.addColorStop(1,'rgba(51,75,58,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(14,13),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.set(.4,-.73,.25);scene.add(contactShadow);
  const world=createWorld();scene.add(world.root);
  const cyclist=createCyclist();cyclist.root.position.set(-.12,.055,3.42);cyclist.root.rotation.y=.055;cyclist.root.scale.setScalar(1.1);scene.add(cyclist.root);
  // Warm bicycle headlight comes on with the lighthouse.
  const headlight=new THREE.PointLight(0xffd49a,0,3,2);headlight.position.set(1.35,1.42,3.48);scene.add(headlight);
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let running=!motionPreference.matches,speed=12,nightTarget=0,night=0,time=0,phase=.55,distance=0,previous=0,frameCount=0,toastTimer,resetAnimation=null,firstFrame=true,lost=false;
  const homeTarget=new THREE.Vector3(0,1.38,0),homePosition=new THREE.Vector3();
  let portrait=innerWidth<=700;
  function setHome(){portrait=innerWidth<=700;homePosition.set(portrait?10.3:10.8,portrait?8.2:8.3,portrait?15.8:15.5);homeTarget.set(0,portrait?1.45:1.3,0);}
  setHome();camera.position.copy(homePosition);controls.target.copy(homeTarget);controls.update();
  function resize(){
    const rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const wasPortrait=portrait;setHome();camera.aspect=rect.width/rect.height;
    // Fit the complete miniature to its allocated space, including narrow landscape views.
    camera.fov=portrait?THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan((rect.height/(innerWidth*.95)*11.8)/(2*homePosition.distanceTo(homeTarget)))),26,53):camera.aspect>1.75?32:camera.aspect<1.05?43:37;
    camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);
    if(wasPortrait!==portrait){camera.position.copy(homePosition);controls.target.copy(homeTarget);controls.update();}
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
  function updatePlayback(){
    $('play-icon').setAttribute('href',running?'#i-pause':'#i-play');$('play-button').setAttribute('aria-label',running?'暂停骑行':'继续骑行');$('play-button').title=running?'暂停骑行':'继续骑行';$('play-button').setAttribute('aria-pressed',String(!running));$('ride-status').textContent=running?'快乐派送中':'停下来，看看海';$('live-dot').classList.toggle('paused',!running);
  }
  function togglePlayback(){running=!running;updatePlayback();}
  $('play-button').addEventListener('click',togglePlayback);updatePlayback();
  motionPreference.addEventListener('change',e=>{if(e.matches){running=false;updatePlayback();}});
  $('speed').addEventListener('input',e=>{speed=Number(e.target.value);$('speed-value').innerHTML=`${speed}<span> km/h</span>`;e.target.style.background=`linear-gradient(to right,var(--orange) 0%,var(--orange) ${(speed-4)/20*100}%,var(--line) ${(speed-4)/20*100}%,var(--line) 100%)`;});
  function theme(isNight){
    nightTarget=isNight?1:0;document.body.classList.toggle('night',isNight);$('day-button').classList.toggle('active',!isNight);$('night-button').classList.toggle('active',isNight);$('day-button').setAttribute('aria-pressed',String(!isNight));$('night-button').setAttribute('aria-pressed',String(isNight));$('weather-text').textContent=isNight?'把星光送给你':'海风刚刚好';$('temperature').textContent=isNight?'19°':'24°';document.querySelector('meta[name=theme-color]').content=isNight?'#172b32':'#f6f3ea';
  }
  $('day-button').addEventListener('click',()=>theme(false));$('night-button').addEventListener('click',()=>theme(true));
  let audioContext=null;
  function bell(){
    cyclist.ring(time);const ding=$('ding');ding.classList.remove('ring');void ding.offsetWidth;ding.classList.add('ring');toast('叮铃！你有一份好心情，请签收。');
    try {
      const AudioContext=window.AudioContext||window.webkitAudioContext;if(AudioContext){audioContext??=new AudioContext();audioContext.resume().then(()=>{
        const now=audioContext.currentTime;
        for(const delay of [0,.19])for(const [frequency,volume,decay] of [[1468,.1,.75],[2936,.025,.4],[3698,.012,.25]]){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,now+delay);gain.gain.setValueAtTime(.001,now+delay);gain.gain.exponentialRampToValueAtTime(volume,now+delay+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+delay+decay);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now+delay);oscillator.stop(now+delay+decay+.05);}
      }).catch(()=>{});}
    }catch{/* The visual bell is always available if browser audio is disabled. */}
  }
  $('bell-button').addEventListener('click',bell);
  function reset(){setHome();resetAnimation={start:performance.now(),position:camera.position.clone(),target:controls.target.clone()};}
  $('reset-button').addEventListener('click',reset);controls.addEventListener('start',()=>{resetAnimation=null;});
  canvas.addEventListener('keydown',e=>{
    if(e.code==='Space'){e.preventDefault();togglePlayback();}else if(e.key.toLowerCase()==='b'){bell();}else if(e.key.toLowerCase()==='r'){reset();}
  });
  $('photo-button').addEventListener('click',async()=>{
    const button=$('photo-button');button.disabled=true;
    try{
      renderer.render(scene,camera);
      const postcard=document.createElement('canvas');postcard.width=1600;postcard.height=1200;const context=postcard.getContext('2d');context.fillStyle=nightTarget?'#172b32':'#f6f3ea';context.fillRect(0,0,1600,1200);
      context.fillStyle=nightTarget?'#e4e8d4':'#294c42';context.font='28px Georgia';context.fillText('PELICAN POST',75,85);context.font='16px Arial';context.fillText('A LITTLE RIDE. A LITTLE HAPPINESS.',75,116);
      const scale=Math.min(1550/canvas.width,950/canvas.height),w=canvas.width*scale,h=canvas.height*scale;context.drawImage(canvas,(1600-w)/2,135+(950-h)/2,w,h);
      context.fillStyle=nightTarget?'#efa66c':'#db6b42';context.font='italic 38px Georgia';context.fillText('Less hurry. More happy.',75,1120);context.font='16px Arial';context.fillText('THE COASTAL ROUTE  /  NO. 001',1140,1120);
      const blob=await new Promise((resolve,reject)=>postcard.toBlob(b=>b?resolve(b):reject(new Error('Image export failed')),'image/png'));
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='pelican-postcard.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      document.body.classList.add('photo-flash');setTimeout(()=>document.body.classList.remove('photo-flash'),600);toast('明信片已生成，带走这一刻的海风。');
    }catch(error){toast('明信片暂时没寄出，请再试一次。');console.error(error);}finally{button.disabled=false;}
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;$('loading').style.display='flex';$('loading').classList.remove('ready');$('loading').lastElementChild.textContent='正在重新连接海风…';});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;previous=0;$('loading').classList.add('ready');});
  document.addEventListener('visibilitychange',()=>{previous=0;});
  const daySky=new THREE.Color(0xf9f3de),nightSky=new THREE.Color(0x7f9fb8),dayGround=new THREE.Color(0x97a98d),nightGround=new THREE.Color(0x314f5a),daySun=new THREE.Color(0xffedcc),nightSun=new THREE.Color(0x9bb6e2),dayRim=new THREE.Color(0xd4eee0),nightRim=new THREE.Color(0x799eb9);
  function animate(now){
    requestAnimationFrame(animate);
    if(document.hidden||lost)return;
    const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
    // Honoring reduced motion stops automatic scene movement; controls remain usable.
    if(!motionPreference.matches||running)time+=dt;
    if(running){phase+=dt*(speed/12)*3.5;distance+=speed*dt/3600;}
    night=THREE.MathUtils.damp(night,nightTarget,2.8,dt);hemisphere.color.copy(daySky).lerp(nightSky,night);hemisphere.groundColor.copy(dayGround).lerp(nightGround,night);hemisphere.intensity=2.55-night*1.55;sun.color.copy(daySun).lerp(nightSun,night);sun.intensity=3.4-night*2.55;rim.color.copy(dayRim).lerp(nightRim,night);rim.intensity=1.25-night*.55;renderer.toneMappingExposure=1.28-night*.28;headlight.intensity=night*2;ground.material.opacity=.13+night*.08;
    world.update(time,phase,night);cyclist.update(time,phase,running);
    if(resetAnimation){const t=Math.min((now-resetAnimation.start)/850,1),ease=1-Math.pow(1-t,3);camera.position.lerpVectors(resetAnimation.position,homePosition,ease);controls.target.lerpVectors(resetAnimation.target,homeTarget,ease);if(t===1)resetAnimation=null;}
    controls.update();renderer.render(scene,camera);frameCount++;
    if(frameCount%15===0)$('distance').textContent=distance.toFixed(2);
    if(firstFrame){firstFrame=false;setTimeout(()=>{$('loading').classList.add('ready');},150);document.documentElement.dataset.ready='true';}
  }
  requestAnimationFrame(animate);
}
