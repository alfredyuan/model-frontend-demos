import * as THREE from 'three';

const ball = new THREE.SphereGeometry(1, 24, 16);
const smallBall = new THREE.SphereGeometry(1, 12, 8);
const axis = new THREE.Vector3(0, 1, 0);

export const v = (x, y, z) => new THREE.Vector3(x, y, z);
export const standard = (color, options) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.69, ...options });

export function mesh(parent, geometry, material, shadows = true) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = shadows;
  object.receiveShadow = shadows;
  parent.add(object);
  return object;
}

export function oval(parent, material, x, y, z, sx, sy, sz, tilt = 0) {
  const object = mesh(parent, Math.max(sx, sy, sz) < .225 ? smallBall : ball, material);
  object.position.set(x, y, z);
  object.scale.set(sx, sy, sz);
  object.rotation.z = tilt;
  return object;
}

export function align(object, start, end) {
  object.position.copy(start).lerp(end, 0.5);
  object.rotation.set(0, 0, 0);
  object.quaternion.setFromUnitVectors(axis, end.clone().sub(start).normalize());
}

export function tube(parent, material, points, radius, segments = 24, sides = 9) {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(path, segments, radius, sides), material);
}

export function rod(parent, material, start, end, radius, tip = radius, sides = 12) {
  const object = mesh(parent, new THREE.CylinderGeometry(tip, radius, start.distanceTo(end), sides), material);
  align(object, start, end);
  return object;
}

export function cylinder(parent, material, x, y, z, upper, lower, height, sides = 24) {
  const object = mesh(parent, new THREE.CylinderGeometry(upper, lower, height, sides), material);
  object.position.set(x, y, z);
  return object;
}

export function box(parent, material, x, y, z, sx, sy, sz) {
  const object = mesh(parent, new THREE.BoxGeometry(sx, sy, sz), material);
  object.position.set(x, y, z);
  return object;
}

export function torus(parent, material, x, y, z, radius, thickness, major = 64, minor = 10) {
  const object = mesh(parent, new THREE.TorusGeometry(radius, thickness, minor, major), material);
  object.position.set(x, y, z);
  return object;
}

export function texture(draw, width = 256, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Combine stationary pieces that share a material into a single draw call.
export function batch(group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const buckets = new Map();
  group.traverse(object => {
    if (!object.isMesh) return;
    const layout = Object.keys(object.geometry.attributes).sort().join(',');
    const key = `${object.material.id}:${object.castShadow}:${object.receiveShadow}:${layout}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  });
  group.clear();

  for (const objects of buckets.values()) {
    const first = objects[0];
    const bucketsByAttribute = {};
    const attributeNames = Object.keys(first.geometry.attributes);
    const vertexCount = objects.reduce((sum, object) =>
      sum + (object.geometry.index?.count ?? object.geometry.attributes.position.count), 0);
    for (const name of attributeNames) {
      const { itemSize } = first.geometry.attributes[name];
      bucketsByAttribute[name] = new THREE.BufferAttribute(new Float32Array(vertexCount * itemSize), itemSize);
    }

    let offset = 0;
    for (const object of objects) {
      const part = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      part.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      for (const [name, attribute] of Object.entries(bucketsByAttribute)) {
        attribute.array.set(part.attributes[name].array, offset * attribute.itemSize);
      }
      offset += part.attributes.position.count;
      part.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(bucketsByAttribute)) geometry.setAttribute(name, attribute);
    const merged = mesh(group, geometry, first.material, first.castShadow);
    merged.receiveShadow = first.receiveShadow;
  }
}
