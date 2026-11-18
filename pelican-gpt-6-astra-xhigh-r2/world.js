import * as THREE from 'three';
import { material, mesh, sphere, box, cylinder, torus, rod, tube, taperedTube, textTexture, randomFactory, batchStatic } from './forms.js';

export function createWorld(){
  const root=new THREE.Group(),random=randomFactory(72);
  const mat={sand:material(0xe6d2ab),sandEdge:material(0xd6bb8d),sandLight:material(0xf4e3bc),road:material(0xb7c6ba),roadLine:material(0xf7efcf),grass:material(0xb9c99d),leaf:material(0x72997b),leafLight:material(0x91ae82),trunk:material(0xa58c65),cream:material(0xfbf1d9),red:material(0xcc7559),teal:material(0x568a7d),dark:material(0x3e6359),wood:material(0xb48b61),foam:material(0xe6f3df,{transparent:true,opacity:.83}),water:material(0x96c9bf,{roughness:.35,metalness:.15}),waterSide:material(0x6ba99f,{roughness:.55}),stone:material(0xb4b7a0),gold:material(0xe9b774)};
  function organicDisc(radius,top,bottom,topMat,edgeMat,irregular=.025){
    const n=144,vertices=[],indices=[],groups=[];vertices.push(0,top,0);
    for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=radius*(1+Math.sin(a*3+.3)*irregular+Math.cos(a*5)*irregular*.55);vertices.push(Math.cos(a)*r,top,Math.sin(a)*r);}
    for(let i=0;i<n;i++)indices.push(0,i+2,i+1);
    const sideStart=vertices.length/3;
    for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=radius*(1+Math.sin(a*3+.3)*irregular+Math.cos(a*5)*irregular*.55);vertices.push(Math.cos(a)*r,top,Math.sin(a)*r,Math.cos(a)*r*.975,bottom,Math.sin(a)*r*.975);}
    for(let i=0;i<n;i++){const q=sideStart+i*2;indices.push(q,q+2,q+1,q+2,q+3,q+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();g.addGroup(0,n*3,0);g.addGroup(n*3,n*6,1);return mesh(root,g,[topMat,edgeMat]);
  }
  organicDisc(5.65,-.32,-.72,mat.water,mat.waterSide,.018);
  organicDisc(4.76,-.05,-.46,mat.sand,mat.sandEdge,.03);
  organicDisc(4.61,.015,-.13,mat.sandLight,mat.sand,.022);
  const road=mesh(root,new THREE.RingGeometry(3.07,4.05,144),mat.road,[0,.03,0]);road.rotation.x=-Math.PI/2;
  for(const radius of [3.1,4.02]){const line=torus(root,mat.roadLine,[0,.045,0],radius,.014,5,144);line.rotation.x=-Math.PI/2;}
  const lane=new THREE.Group();root.add(lane);
  for(let i=0;i<50;i++){const a=i/50*Math.PI*2;const dash=box(lane,mat.roadLine,[Math.sin(a)*3.56,.047,Math.cos(a)*3.56],[.19,.009,.032]);dash.rotation.y=a;}
  sphere(root,mat.grass,[0,-.11,-.16],[2.99,.39,2.89]);
  const moss=[material(0xa6bd8d),material(0xc1ce9e),material(0xb1c392)];
  for(let i=0;i<15;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*2.5;sphere(root,moss[i%3],[Math.cos(a)*r,.09,Math.sin(a)*r],[.5+random()*.5,.11,.4+random()*.6]);}
  // Rings and scattered whitecaps keep the sea alive without expensive shaders.
  const foam=[];
  for(let i=0;i<23;i++){const a=i/23*Math.PI*2,rad=4.85+random()*.42;const f=sphere(root,mat.foam,[Math.cos(a)*rad,-.285,Math.sin(a)*rad],[.15+random()*.21,.012,.035]);f.rotation.y=-a-Math.PI/2;foam.push({obj:f,a,rad,phase:random()*6});}
  const waveMat=material(0xcbe6d3,{transparent:true,opacity:.65});
  for(let i=0;i<10;i++){const a=random()*Math.PI*2;const wave=torus(root,waveMat,[0,-.295,0],5.15+random()*.35,.014,5,25,.12+random()*.2);wave.rotation.x=-Math.PI/2;wave.rotation.z=a;foam.push({obj:wave,ring:true,phase:random()*6});}
  // Red-and-cream lighthouse on a little stone footpath.
  const lighthouse=new THREE.Group();lighthouse.position.set(-1.48,.18,-1.44);root.add(lighthouse);
  cylinder(lighthouse,mat.stone,[0,.04,0],.68,.74,.15,24);
  for(let i=0;i<5;i++)cylinder(lighthouse,i%2?mat.red:mat.cream,[0,.19+i*.37,0],.36-i*.027,.39-i*.027,.38,40);
  cylinder(lighthouse,mat.cream,[0,2.02,0],.41,.4,.12,40);
  cylinder(lighthouse,mat.dark,[0,2.1,0],.32,.32,.06,32);
  const lantern=material(0xffe2a0,{emissive:0xffc06b,emissiveIntensity:.15,roughness:.2});
  cylinder(lighthouse,lantern,[0,2.32,0],.25,.25,.4,24);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(lighthouse,mat.dark,[Math.cos(a)*.28,2.11,Math.sin(a)*.28],[Math.cos(a)*.28,2.55,Math.sin(a)*.28],.018);}
  cylinder(lighthouse,mat.red,[0,2.59,0],.02,.43,.32,32);
  sphere(lighthouse,mat.gold,[0,2.79,0],[.045,.06,.045]);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;rod(lighthouse,mat.cream,[Math.cos(a)*.4,2.04,Math.sin(a)*.4],[Math.cos(a)*.4,2.21,Math.sin(a)*.4],.012);}
  const rail=torus(lighthouse,mat.cream,[0,2.21,0],.4,.015,5,48);rail.rotation.x=Math.PI/2;
  for(let i=0;i<3;i++){box(lighthouse,mat.dark,[0,.59+i*.52,.36-i*.04],[.12,.18,.035]);box(lighthouse,mat.cream,[0,.57+i*.52,.38-i*.04],[.015,.2,.012]);}
  box(lighthouse,mat.dark,[0,.28,.389],[.19,.34,.018]);
  for(let i=0;i<5;i++){const step=box(root,mat.stone,[-1.47+i*.06,.24-i*.025,-.9+i*.28],[.25,.035,.17]);step.rotation.y=-.1;}
  const glow=new THREE.PointLight(0xffce83,0,7,2);glow.position.set(-1.48,2.48,-1.44);root.add(glow);
  const beamMat=new THREE.MeshBasicMaterial({color:0xffe0a4,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const beacon=new THREE.Group();beacon.position.copy(glow.position);root.add(beacon);
  const beam=mesh(beacon,new THREE.ConeGeometry(.85,5,24,1,true),beamMat,[2.5,0,0]);beam.rotation.z=Math.PI/2;beam.castShadow=false;
  // The tiny coastal post office.
  const office=new THREE.Group();office.position.set(1.1,.18,-1.16);office.rotation.y=-.13;root.add(office);
  box(office,mat.cream,[0,.4,0],[1.08,.78,.83]);
  for(let i=0;i<7;i++)box(office,mat.sandLight,[0,.1+i*.105,.425],[1.1,.019,.016]);
  box(office,mat.teal,[0,.91,-.245],[1.3,.095,.68],0).rotation.x=-.55;
  box(office,mat.teal,[0,.91,.245],[1.3,.095,.68],0).rotation.x=.55;
  const gable=new THREE.Shape();gable.moveTo(-.43,0);gable.lineTo(.43,0);gable.lineTo(0,.26);gable.closePath();const gableMesh=mesh(office,new THREE.ExtrudeGeometry(gable,{depth:1.08,bevelEnabled:false}),mat.cream,[-.54,.78,0]);gableMesh.rotation.y=Math.PI/2;
  box(office,mat.teal,[-.23,.28,.441],[.26,.5,.04]);sphere(office,mat.gold,[-.15,.28,.47],[.018,.018,.018]);
  box(office,mat.dark,[.25,.43,.442],[.28,.25,.035]);box(office,mat.cream,[.25,.43,.47],[.018,.27,.015]);box(office,mat.cream,[.25,.43,.47],[.3,.018,.015]);
  box(office,mat.wood,[-.23,.04,.57],[.45,.06,.27]);
  const signMat=material(0xffffff,{map:textTexture('POST',{width:512,height:192,font:'bold 88px Georgia',background:'#f4e9c8',color:'#3f6b5d'})});box(office,signMat,[0,.76,.47],[.65,.21,.02]);
  // Postbox beside the road.
  const mailbox=new THREE.Group();mailbox.position.set(2.48,.12,1.14);mailbox.rotation.y=-.35;root.add(mailbox);
  rod(mailbox,mat.dark,[0,0,0],[0,.62,0],.045);box(mailbox,mat.red,[0,.7,0],[.34,.42,.3]);sphere(mailbox,mat.red,[0,.91,0],[.17,.12,.15]);box(mailbox,mat.dark,[0,.8,.155],[.21,.035,.012]);box(mailbox,mat.cream,[0,.64,.156],[.15,.105,.01]);
  rod(mailbox,mat.gold,[.19,.8,0],[.19,1.05,0],.012);box(mailbox,mat.red,[.23,1.04,0],[.1,.09,.014]);
  // Palm leaves are folded surfaces, not flat circles.
  const palms=[];
  function palm(x,z,height,lean){
    const g=new THREE.Group();g.position.set(x,.11,z);root.add(g);const tip=[lean,height,0];
    taperedTube(g,mat.trunk,[[0,0,0],[lean*.18,height*.35,0],[lean*.65,height*.7,0],tip],[.14,.12,.085,.065],24,10);
    for(let j=0;j<8;j++){const y=.2+j*(height-.35)/8;const ring=torus(g,material(0x8f8060),[lean*Math.pow(y/height,1.65),y,0],.132-y/height*.06,.009,5,12);ring.rotation.x=Math.PI/2;}
    const crown=new THREE.Group();crown.position.set(...tip);g.add(crown);palms.push(crown);
    for(let j=0;j<8;j++){
      const angle=j*Math.PI/4+random()*.1,length=.8+random()*.48,positions=[],indices=[],count=12;
      for(let k=0;k<=count;k++){const t=k/count,r=t*length,cy=Math.sin(t*Math.PI)*.31-t*t*.32,width=Math.sin(t*Math.PI)*.19;
        for(let s=-1;s<=1;s++)positions.push(Math.cos(angle)*r+Math.sin(angle)*width*s,cy-Math.abs(s)*.055,Math.sin(angle)*r-Math.cos(angle)*width*s);
        if(k<count){const q=k*3;indices.push(q,q+3,q+1,q+1,q+3,q+4,q+1,q+4,q+2,q+2,q+4,q+5);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const m=(j%2?mat.leaf:mat.leafLight).clone();m.side=THREE.DoubleSide;mesh(crown,geo,m);
      tube(crown,mat.leaf,[[0,0,0],[Math.cos(angle)*length*.5,.19,Math.sin(angle)*length*.5],[Math.cos(angle)*length,-.32,Math.sin(angle)*length]],.014,12);
    }
    for(let j=0;j<3;j++)sphere(crown,mat.wood,[Math.cos(j*2)*.1,-.1,Math.sin(j*2)*.1],[.11,.14,.1]);
  }
  palm(2.35,-1.96,2.62,-.27);palm(-2.66,-.45,2.12,-.17);
  // Small plants and flowers in the inner verge.
  for(let i=0;i<30;i++){
    const a=random()*Math.PI*2,r=2.45+random()*.38,x=Math.cos(a)*r,z=Math.sin(a)*r;
    for(let j=0;j<3;j++){const blade=sphere(root,j%2?mat.leaf:mat.leafLight,[x+(j-1)*.05,.19,z],[.026,.13+random()*.08,.045]);blade.rotation.z=(j-1)*.45;}
    if(i%3===0){rod(root,mat.leaf,[x,.15,z],[x,.39,z],.009);for(let k=0;k<5;k++){const b=k*Math.PI*2/5;sphere(root,i%2?mat.cream:mat.red,[x+Math.cos(b)*.043,.39,z+Math.sin(b)*.043],[.035,.019,.035]);}sphere(root,mat.gold,[x,.41,z],[.024,.023,.024]);}
  }
  // Coastal bollards, pebbles and shells.
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2;if(a<1.15||a>5.2)continue;const x=Math.sin(a)*4.16,z=Math.cos(a)*4.16;cylinder(root,mat.cream,[x,.15,z],.045,.055,.24,10);cylinder(root,mat.red,[x,.21,z],.047,.047,.055,10);}
  for(let i=0;i<29;i++){const a=random()*Math.PI*2,r=4.22+random()*.26;const s=.045+random()*.07;const stone=sphere(root,i%4?mat.stone:mat.cream,[Math.cos(a)*r,.06,Math.sin(a)*r],[s,.04,s*.7]);stone.rotation.y=random()*5;}
  // A striped beach parasol and deck chair tucked near the shore.
  const umbrella=new THREE.Group();umbrella.position.set(-3.25,0,1.76);root.add(umbrella);
  rod(umbrella,mat.wood,[0,0,0],[0,1.13,0],.022);
  for(let i=0;i<8;i++){const segment=new THREE.SphereGeometry(.51,6,6,i*Math.PI/4,Math.PI/4,0,Math.PI*.37);const o=mesh(umbrella,segment,i%2?mat.cream:mat.red,[0,.89,0],[1,.55,1]);}
  sphere(umbrella,mat.cream,[0,1.19,0],[.032,.045,.032]);
  const towel=box(root,mat.cream,[-3.2,.045,2.2],[.38,.017,.58]);towel.rotation.y=-.5;
  for(let i=0;i<3;i++){const stripe=box(root,mat.red,[-3.2,.06,2.07+i*.12],[.37,.005,.035]);stripe.rotation.y=-.5;}
  // Three little clouds and distant birds.
  const clouds=[];
  for(const [x,y,z,s] of [[-3.7,3.7,-3.2,.66],[3.7,4.2,-2.2,.55],[.6,3.65,-4.1,.36]]){const cloud=new THREE.Group();cloud.position.set(x,y,z);cloud.scale.setScalar(s);root.add(cloud);for(const [xx,yy,zz,rr] of [[-.45,0,0,.43],[0,.19,0,.56],[.54,.02,0,.4],[.15,-.08,.2,.45]])sphere(cloud,mat.cream,[xx,yy,zz],[rr,rr*.65,rr*.65]);clouds.push({obj:cloud,x,y});}
  const gulls=[];
  for(let i=0;i<3;i++){const gull=new THREE.Group();gull.position.set(-2.7+i*1.2,3.9+i*.3,-3.2-i*.25);root.add(gull);const left=tube(gull,mat.dark,[[0,0,0],[-.12,.12,0],[-.29,.1,.015]],.015,8),right=tube(gull,mat.dark,[[0,0,0],[.12,.12,0],[.29,.1,.015]],.015,8);gulls.push({gull,left,right,phase:i});}
  // A small paper boat on the turquoise sea.
  const boat=new THREE.Group();boat.position.set(3.65,-.26,3.55);boat.rotation.y=-.4;root.add(boat);
  const hullShape=new THREE.Shape();hullShape.moveTo(-.36,0);hullShape.lineTo(.36,0);hullShape.lineTo(.2,-.15);hullShape.lineTo(-.2,-.15);hullShape.closePath();mesh(boat,new THREE.ExtrudeGeometry(hullShape,{depth:.18,bevelEnabled:false}),mat.cream,[0,.13,-.09]);
  const sailShape=new THREE.Shape();sailShape.moveTo(0,0);sailShape.lineTo(0,.42);sailShape.lineTo(.29,0);sailShape.closePath();mesh(boat,new THREE.ShapeGeometry(sailShape),material(0xe18a62,{side:THREE.DoubleSide}),[-.02,.14,0]);rod(boat,mat.wood,[-.025,.1,0],[-.025,.59,0],.008);
  const starsGeometry=new THREE.BufferGeometry(),starPositions=[];
  for(let i=0;i<85;i++){const a=random()*Math.PI*2,r=4+random()*5;starPositions.push(Math.cos(a)*r,3+random()*5,Math.sin(a)*r);}
  starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));const starMat=new THREE.PointsMaterial({color:0xffe4b2,size:.035,transparent:true,opacity:0,depthWrite:false});const stars=new THREE.Points(starsGeometry,starMat);root.add(stars);
  batchStatic(root,[lane,...palms,...clouds.map(c=>c.obj),...foam.map(f=>f.obj),...gulls.map(g=>g.gull),boat,beacon]);
  batchStatic(lane);for(const p of palms)batchStatic(p);for(const c of clouds)batchStatic(c.obj);batchStatic(boat);
  function update(time,phase,night){
    lane.rotation.y=-phase*.012;
    palms.forEach((p,i)=>{p.rotation.x=Math.sin(time*.8+i)*.028;p.rotation.z=Math.sin(time*.7+i)*.035;});
    clouds.forEach((c,i)=>{c.obj.position.y=c.y+Math.sin(time*.5+i)*.065;c.obj.position.x=c.x+Math.sin(time*.2+i)*.12;});
    foam.forEach(f=>{if(f.ring){f.obj.scale.setScalar(1+Math.sin(time*.9+f.phase)*.009);}else{const r=f.rad+Math.sin(time*.9+f.phase)*.035;f.obj.position.x=Math.cos(f.a)*r;f.obj.position.z=Math.sin(f.a)*r;f.obj.scale.x=1+Math.sin(time+f.phase)*.15;}});
    gulls.forEach(({gull,left,right,phase:p})=>{left.rotation.x=Math.sin(time*2+p)*.25;right.rotation.x=-Math.sin(time*2+p)*.25;gull.position.y=3.9+p*.3+Math.sin(time*.9+p)*.09;});
    boat.position.y=-.25+Math.sin(time*1.6)*.025;boat.rotation.z=Math.sin(time*1.2)*.045;
    lantern.emissiveIntensity=.15+night*2.1;glow.intensity=night*9;beamMat.opacity=night*.065;beacon.rotation.y=time*.26;starMat.opacity=night*.85;
  }
  return {root,update};
}
