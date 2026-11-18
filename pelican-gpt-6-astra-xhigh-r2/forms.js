import * as THREE from 'three';

export const palette = { cream:0xfff4dc, white:0xfffcf0, teal:0x69aaa0, dark:0x294c42, orange:0xe58d43, coral:0xd96d4e, sand:0xe5cf9c, grass:0xb4c49a, metal:0xc9d3c6, tire:0x344740 };
export function material(color, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness:.78, ...options }); }
const sphereGeometry = new THREE.SphereGeometry(1,24,16);
const boxGeometry = new THREE.BoxGeometry(1,1,1);
const cylinderGeometry = new THREE.CylinderGeometry(1,1,1,12);
export function mesh(parent, geometry, mat, position=[0,0,0], scale=[1,1,1]) {
  const obj=new THREE.Mesh(geometry,mat); obj.position.set(...position);obj.scale.set(...scale);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
}
export function sphere(parent, mat, position, scale) { return mesh(parent,sphereGeometry,mat,position,scale); }
export function box(parent, mat, position, scale, rotation=0) { const obj=mesh(parent,boxGeometry,mat,position,scale);obj.rotation.z=rotation;return obj; }
export function cylinder(parent, mat, position, radiusTop, radiusBottom, height, segments=24) { return mesh(parent,new THREE.CylinderGeometry(radiusTop,radiusBottom,height,segments),mat,position); }
export function torus(parent,mat,position,radius,tube,radial=8,tubular=64,arc=Math.PI*2) { return mesh(parent,new THREE.TorusGeometry(radius,tube,radial,tubular,arc),mat,position); }
export function rod(parent,mat,a,b,radius=.03) { const obj=mesh(parent,cylinderGeometry,mat);setRod(obj,a,b,radius);return obj; }
const up=new THREE.Vector3(0,1,0), av=new THREE.Vector3(),bv=new THREE.Vector3(),direction=new THREE.Vector3();
export function setRod(obj,a,b,radius=.03) { av.fromArray(a);bv.fromArray(b);direction.subVectors(bv,av);obj.position.copy(av).add(bv).multiplyScalar(.5);obj.scale.set(radius,direction.length(),radius);obj.quaternion.setFromUnitVectors(up,direction.normalize()); }
export function tube(parent,mat,points,radius=.03,segments=32) { const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(parent,new THREE.TubeGeometry(curve,segments,radius,8,false),mat); }
export function taperedTube(parent,mat,points,radii,segments=40,sides=12) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),frames=curve.computeFrenetFrames(segments,false),vertices=[],indices=[],normals=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,p=curve.getPointAt(t),ri=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(ri)),r=THREE.MathUtils.lerp(radii[j],radii[j+1],ri-j);
    for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));vertices.push(p.x+n.x*r,p.y+n.y*r,p.z+n.z*r);normals.push(n.x,n.y,n.z);if(i<segments&&k<sides){const q=i*(sides+1)+k;indices.push(q,q+1,q+sides+1,q+1,q+sides+2,q+sides+1);}}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);return mesh(parent,g,mat);
}
export function textTexture(text,{width=512,height=256,background='#f8f0d7',color='#30564b',font='bold 80px Georgia',subtext=''}={}) { const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);ctx.fillStyle=color;ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height*(subtext?.43:.5));if(subtext){ctx.font='24px Arial';ctx.fillText(subtext,width/2,height*.77);}const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture; }
export function randomFactory(seed=42){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

// Batch only static meshes. Moving groups retain their independent transforms.
// Indexed buffers keep the detailed model small and avoid hundreds of draw calls.
export function batchStatic(root,excluded=[]){
  const exclude=new Set(excluded),batches=new Map();root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
  function visit(obj){
    if(exclude.has(obj))return;
    if(obj.isMesh&&!Array.isArray(obj.material)){
      const key=`${obj.material.uuid}/${obj.castShadow}/${obj.receiveShadow}`;
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(obj);
    }
    for(const child of obj.children)visit(child);
  }
  for(const child of root.children)visit(child);
  for(const objects of batches.values()){
    if(objects.length<2)continue;
    let count=0,indexCount=0;for(const obj of objects){count+=obj.geometry.attributes.position.count;indexCount+=obj.geometry.index?.count||obj.geometry.attributes.position.count;}
    const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2),indices=new Uint32Array(indexCount);let offset=0,indexOffset=0;
    for(const obj of objects){
      const geometry=obj.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,obj.matrixWorld));const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
      positions.set(p.array,offset*3);if(n)normals.set(n.array,offset*3);if(uv)uvs.set(uv.array,offset*2);
      const source=geometry.index;for(let i=0;i<(source?.count||p.count);i++)indices[indexOffset++]=offset+(source?source.array[i]:i);
      offset+=p.count;geometry.dispose();obj.removeFromParent();
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingSphere();
    const merged=new THREE.Mesh(geometry,objects[0].material);merged.castShadow=objects[0].castShadow;merged.receiveShadow=objects[0].receiveShadow;root.add(merged);
  }
}
