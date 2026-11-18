import * as THREE from 'three';
import { material, mesh, sphere, box, cylinder, torus, rod, setRod, tube, taperedTube, palette, batchStatic } from './forms.js';

export function createCyclist() {
  const root=new THREE.Group(), bike=new THREE.Group(),bird=new THREE.Group();root.add(bike,bird);
  const mats={frame:material(0x68ada1,{metalness:.2,roughness:.43}),cream:material(palette.cream),white:material(palette.white),feather:material(0xe8e6cf),dark:material(0x2b403a),tire:material(0x35463d),metal:material(0xbac7bb,{metalness:.65,roughness:.35}),seat:material(0x88573e),gold:material(0xe6b45b,{metalness:.5,roughness:.35}),orange:material(0xe79a46),pouch:material(0xf3b767),coral:material(palette.coral),bag:material(0x60877b),pink:material(0xe6a194)};
  const wheels=[];
  for(const x of [-1.08,1.16]){
    const wheel=new THREE.Group();wheel.position.set(x,.66,0);bike.add(wheel);wheels.push(wheel);
    torus(wheel,mats.tire,[0,0,0],.59,.072,10,72);
    for(const side of [-1,1]){
      torus(wheel,mats.cream,[0,0,side*.039],.59,.029,8,64);
      torus(wheel,mats.metal,[0,0,side*.045],.544,.014,6,64);
      for(let i=0;i<20;i++){const a=i/20*Math.PI*2,b=a+.19;rod(wheel,mats.metal,[Math.cos(b)*.06,Math.sin(b)*.06,side*.07],[Math.cos(a)*.54,Math.sin(a)*.54,side*.033],.007);}
    }
    const hub=cylinder(wheel,mats.metal,[0,0,0],.073,.073,.2,16);hub.rotation.x=Math.PI/2;
    box(wheel,mats.orange,[.37,.34,.045],[.075,.035,.035],.75);
    const fender=torus(bike,mats.frame,[x,.66,0],.706,.036,8,40,Math.PI*.91);fender.rotation.z=.15;
    rod(bike,mats.metal,[x,.66,.075],[x-.55,1.13,.075],.012);
  }
  const rear=[-1.08,.66,0],seat=[-.44,1.64,0],crank=[-.12,.72,0],head=[.88,1.59,0],front=[1.16,.66,0];
  for(const [a,b,r] of [[seat,head,.057],[head,crank,.061],[seat,crank,.06]])rod(bike,mats.frame,a,b,r);
  for(const z of [-.1,.1]){
    rod(bike,mats.frame,[rear[0],rear[1],z],[seat[0],seat[1],z*.4],.033);
    rod(bike,mats.frame,[rear[0],rear[1],z],[crank[0],crank[1],z],.033);
    rod(bike,mats.frame,[head[0],head[1],z],[front[0],front[1],z],.038);
  }
  rod(bike,mats.metal,[-.44,1.64,0],[-.53,1.89,0],.035);
  sphere(bike,mats.seat,[-.55,1.9,0],[.27,.072,.17]);
  rod(bike,mats.metal,[.88,1.59,0],[.83,1.97,0],.037);
  tube(bike,mats.metal,[[.83,1.97,0],[.95,2.04,0],[1.03,2.05,.29],[.86,2.02,.36]],.028,20);
  tube(bike,mats.metal,[[.83,1.97,0],[.95,2.04,0],[1.03,2.05,-.29],[.86,2.02,-.36]],.028,20);
  for(const z of [-.36,.36])rod(bike,mats.seat,[.85,2.02,z],[1.02,2.04,z],.046);
  tube(bike,mats.dark,[[1.02,2.02,.3],[1.18,1.86,.19],[1.1,1.48,.1]],.009,20);
  sphere(bike,mats.gold,[.96,2.09,.17],[.075,.045,.075]);
  const chainring=torus(bike,mats.metal,[-.12,.72,.17],.18,.024,8,36);
  for(let i=0;i<5;i++){let a=i*Math.PI*2/5;rod(bike,mats.metal,[-.12,.72,.17],[-.12+Math.cos(a)*.18,.72+Math.sin(a)*.18,.17],.012);}
  torus(bike,mats.metal,[-1.08,.66,.15],.09,.015,6,32);
  tube(bike,mats.dark,[[-.1,.9,.18],[-1.09,.75,.18],[-1.17,.66,.18],[-1.08,.57,.18],[-.1,.54,.18],[.06,.72,.18],[-.1,.9,.18]],.012,60);
  const crankArms=[];
  for(const z of [-.23,.23])crankArms.push(rod(bike,mats.metal,[-.12,.72,z],[.1,.9,z],.025));
  // A little postal rack, wood crate, and hand-addressed envelopes.
  for(const z of [-.19,.19]){rod(bike,mats.metal,[-1.08,.66,z],[-1.32,1.44,z],.019);rod(bike,mats.metal,[-1.55,1.44,z],[-.67,1.44,z],.024);}
  box(bike,mats.seat,[-1.18,1.49,0],[.67,.08,.46]);
  const wood=material(0xc39a6c),woodLight=material(0xd9b78b);
  box(bike,wood,[-1.25,1.68,0],[.55,.33,.43]);
  for(const z of [-.225,.225])for(let y=1.58;y<1.86;y+=.1)box(bike,woodLight,[-1.25,y,z],[.59,.066,.025]);
  for(let i=0;i<3;i++){const letter=box(bike,mats.cream,[-1.36+i*.12,1.91,.01],[.055,.34,.34],-.12+i*.09);}
  box(bike,mats.cream,[-1.25,1.7,.245],[.28,.16,.007]);
  rod(bike,mats.coral,[-1.38,1.76,.25],[-1.25,1.68,.25],.006);rod(bike,mats.coral,[-1.25,1.68,.25],[-1.12,1.76,.25],.006);
  const lamp=cylinder(bike,mats.metal,[1.25,1.37,0],.09,.09,.12,20);lamp.rotation.z=Math.PI/2;
  const lens=cylinder(bike,material(0xffe5a4,{emissive:0xffd998,emissiveIntensity:.3}),[1.32,1.37,0],.072,.072,.012,20);lens.rotation.z=Math.PI/2;

  sphere(bird,mats.white,[-.43,2.45,0],[.76,.66,.48]);
  sphere(bird,mats.cream,[-.07,2.5,0],[.55,.55,.44]);
  taperedTube(bird,mats.white,[[-.05,2.64,0],[.2,2.92,0],[.12,3.2,0],[.28,3.54,0],[.62,3.7,0]],[.33,.3,.24,.24,.33],44,20);
  sphere(bird,mats.white,[.65,3.72,0],[.44,.38,.345]);
  // Long upper bill and a deep, unmistakable pelican throat pouch.
  function bill(mat,sections){const vertices=[],indices=[],n=24;for(let i=0;i<sections.length;i++){const [x,top,bottom,width]=sections[i];for(let j=0;j<=n;j++){const a=j/n*Math.PI*2;vertices.push(x,(top+bottom)/2+Math.sin(a)*(top-bottom)/2,Math.cos(a)*width);if(i<sections.length-1&&j<n){const q=i*(n+1)+j;indices.push(q,q+n+1,q+1,q+1,q+n+1,q+n+2);}}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(bird,geo,mat);}
  bill(mats.pouch,[[.82,3.65,3.32,.22],[1.02,3.62,3.12,.245],[1.35,3.58,3.13,.21],[1.71,3.53,3.25,.14],[2.14,3.47,3.41,.045],[2.22,3.45,3.44,.002]]);
  bill(mats.orange,[[.85,3.73,3.61,.2],[1.13,3.7,3.59,.22],[1.6,3.6,3.52,.15],[2.14,3.49,3.44,.047],[2.24,3.46,3.4,.002]]);
  for(const z of [-1,1]){
    tube(bird,material(0xbd7c3f),[[.91,3.62,z*.21],[1.33,3.58,z*.207],[1.79,3.51,z*.105],[2.19,3.45,z*.014]],.009,24);
    sphere(bird,mats.orange,[.77,3.84,z*.303],[.127,.127,.037]);
    sphere(bird,mats.white,[.795,3.847,z*.331],[.099,.102,.026]);
    sphere(bird,mats.dark,[.826,3.85,z*.353],[.047,.06,.018]);
    sphere(bird,mats.white,[.841,3.873,z*.365],[.014,.016,.008]);
    sphere(bird,mats.pink,[.56,3.64,z*.31],[.095,.045,.014]);
    sphere(bird,material(0xb47537),[1.1,3.672,z*.19],[.035,.011,.006]);
  }
  // Pumpkin helmet, cream racing stripe, and real chin straps.
  const helmet=new THREE.Group();helmet.position.set(.55,3.98,0);helmet.rotation.z=.08;bird.add(helmet);
  mesh(helmet,new THREE.SphereGeometry(.445,32,16,0,Math.PI*2,0,Math.PI*.54),mats.coral,[0,0,0],[1.07,.84,.91]);
  const helmetRim=torus(helmet,mats.orange,[0,-.044,0],.445,.026,8,48);helmetRim.rotation.x=Math.PI/2;helmetRim.scale.set(1.07,.91,1);
  tube(helmet,mats.cream,[[-.43,.015,0],[-.34,.23,0],[0,.374,0],[.34,.23,0],[.46,.015,0]],.037,26);
  for(const z of [-.2,.2]){for(const x of [-.15,.14]){const vent=sphere(helmet,mats.dark,[x,.29,z],[.075,.012,.024]);vent.rotation.z=x>0?-.3:.3;}}
  for(const side of [-1,1])tube(bird,mats.seat,[[.28,3.96,side*.31],[.4,3.44,side*.22],[.77,3.4,side*.19],[.83,3.98,side*.28]],.018,26);
  // Folded tail feathers, layered wings reaching the handlebar.
  for(let i=0;i<5;i++){const z=(i-2)*.12;const f=sphere(bird,i%2?mats.feather:mats.white,[-1.03-i*.035,2.42+i*.015,z],[.51,.115,.11]);f.rotation.z=-.18+i*.04;const tip=sphere(bird,mats.dark,[-1.43-i*.02,2.5+i*.02,z],[.16,.065,.085]);tip.rotation.z=-.18;}
  const wings=[];
  for(const side of [-1,1]){
    const wing=new THREE.Group();bird.add(wing);wings.push(wing);
    const upper=sphere(wing,mats.white,[-.34,2.53,side*.43],[.48,.3,.18]);upper.rotation.z=-.4;
    for(let i=0;i<4;i++){const feather=sphere(wing,i===0?mats.white:mats.feather,[.02+i*.07,2.34-i*.045,side*(.47+i*.013)],[.42,.075,.07]);feather.rotation.z=-.42;}
    taperedTube(wing,mats.white,[[.03,2.38,side*.46],[.38,2.18,side*.4],[.8,2.08,side*.36]],[.16,.12,.07],20,10);
    for(let i=0;i<3;i++)sphere(wing,mats.cream,[.87+i*.045,2.054,side*.36],[.07,.045,.062]);
  }
  const scarfRing=torus(bird,mats.coral,[.14,2.99,0],.253,.075,10,48);scarfRing.rotation.x=Math.PI/2;scarfRing.rotation.y=.12;
  sphere(bird,mats.coral,[-.08,2.99,.2],[.13,.1,.13]);
  const scarf=new THREE.Group();scarf.position.set(-.08,2.99,.2);bird.add(scarf);
  const scarfGeometry=new THREE.PlaneGeometry(1.05,.2,18,2);scarfGeometry.translate(-.51,0,0);const scarfMesh=mesh(scarf,scarfGeometry,material(palette.coral,{side:THREE.DoubleSide}));
  const scarfGeometry2=new THREE.PlaneGeometry(.82,.15,16,2);scarfGeometry2.translate(-.4,-.08,.055);const scarfMesh2=mesh(scarf,scarfGeometry2,material(0xe88c60,{side:THREE.DoubleSide}));
  const scarfRest=[scarfGeometry.attributes.position.array.slice(),scarfGeometry2.attributes.position.array.slice()];
  // Shoulder bag, flap, brass clasp, and a tiny envelope badge.
  const bag=new THREE.Group();bag.position.set(-.7,2.34,.55);bag.rotation.z=-.15;bird.add(bag);
  sphere(bag,mats.bag,[0,0,0],[.29,.3,.105]);box(bag,mats.bag,[0,0,0],[.44,.42,.16]);
  sphere(bag,material(0x749a86),[0,.17,.05],[.28,.12,.09]);box(bag,mats.seat,[0,.04,.12],[.055,.19,.025]);sphere(bag,mats.gold,[0,.01,.14],[.035,.035,.015]);
  tube(bird,mats.seat,[[-.72,2.55,.59],[-.56,2.96,.2],[-.18,2.9,-.28]],.028,24);
  const legs=[];
  for(const side of [-1,1]){
    const hip=[-.4,2.05,side*.27];sphere(bird,mats.cream,hip,[.23,.3,.23]);
    const upper=rod(root,mats.orange,hip,[0,1.4,side*.27],.055),lower=rod(root,mats.orange,[0,1.4,side*.27],[0,.8,side*.27],.045);
    const knee=sphere(root,mats.orange,[0,1.4,side*.27],[.068,.068,.068]);
    const foot=new THREE.Group();root.add(foot);sphere(foot,mats.orange,[.06,.005,0],[.2,.045,.13]);
    const webShape=new THREE.Shape();webShape.moveTo(-.08,-.055);webShape.lineTo(.19,-.16);webShape.quadraticCurveTo(.28,-.09,.21,-.045);webShape.quadraticCurveTo(.32,0,.22,.045);webShape.quadraticCurveTo(.28,.12,.18,.16);webShape.lineTo(-.08,.055);webShape.closePath();
    const web=mesh(foot,new THREE.ExtrudeGeometry(webShape,{depth:.035,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,steps:1}),mats.orange);web.rotation.x=-Math.PI/2;web.position.y=.035;
    const pedal=box(root,mats.dark,[0,0,0],[.23,.045,.22]);legs.push({hip,upper,lower,knee,foot,pedal,side});
  }
  const bellRings=[];
  for(let i=0;i<3;i++){const ring=torus(root,material(0xe6b45b,{transparent:true,opacity:0,depthWrite:false}),[.96,2.1,.17],.14,.009,5,40);ring.rotation.x=-Math.PI/2;bellRings.push(ring);}
  for(const wheel of wheels)batchStatic(wheel);
  batchStatic(bike,[...wheels,chainring,...crankArms]);
  batchStatic(helmet);batchStatic(bird,[helmet,scarf]);
  for(const leg of legs)batchStatic(leg.foot);
  let ringAt=-100;
  function ring(time){ringAt=time;}
  function update(time,phase,moving){
    wheels.forEach(w=>w.rotation.z=-phase*2);chainring.rotation.z=-phase;
    const bob=moving?Math.sin(phase*2)*.018:0;bird.position.y=bob;
    for(let i=0;i<legs.length;i++){
      const l=legs[i],a=-phase+i*Math.PI,px=-.12+Math.cos(a)*.245,py=.72+Math.sin(a)*.245,z=l.side*.28;
      const hip=[l.hip[0],l.hip[1]+bob,z],ankle=[px,py+.055,z],dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],d=Math.sqrt(dx*dx+dy*dy),l1=.79,l2=.82;
      const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));const knee=[hip[0]+dx/d*along-dy/d*height,hip[1]+dy/d*along+dx/d*height,z];
      setRod(l.upper,hip,knee,.051);setRod(l.lower,knee,ankle,.038);l.knee.position.set(...knee);l.foot.position.set(px,py+.045,z);l.pedal.position.set(px,py-.015,z);
      setRod(crankArms[i],[-.12,.72,l.side*.23],[px,py,l.side*.23],.024);
    }
    [scarfMesh,scarfMesh2].forEach((s,j)=>{const p=s.geometry.attributes.position,rest=scarfRest[j];for(let i=0;i<p.count;i++){const x=rest[i*3],weight=-x; p.setY(i,rest[i*3+1]+Math.sin(time*5+x*5+j)*.07*weight);p.setZ(i,rest[i*3+2]+Math.cos(time*4+x*4)*.07*weight);}p.needsUpdate=true;s.geometry.computeVertexNormals();});
    const elapsed=time-ringAt;bellRings.forEach((r,i)=>{const t=(elapsed-i*.12)/.8;r.visible=t>0&&t<1;if(r.visible){r.scale.setScalar(1+t*5);r.position.y=2.1+t*.35;r.material.opacity=(1-t)*.65;}});
    helmet.rotation.z=.08+Math.sin(time*1.8)*.015;
  }
  return {root,bird,update,ring};
}
