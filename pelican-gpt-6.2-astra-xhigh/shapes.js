import * as T from 'three';
export const tau = 2 * Math.PI;
export const vec = (x, y, z) => new T.Vector3(x, y, z);
export function group(parent) {
  const g = new T.Group();
  if (parent)
    parent.add(g);
  return g;
}
const materials = new Map();
export function material(color) {
  if (!materials.has(color))
    materials.set(color, new T.MeshStandardMaterial({
      color,
      roughness: 0.86,
      metalness: 0
    }));
  return materials.get(color);
}
export function mesh(parent, geometry, color, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, material(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function box(g, x, y, z, w, h, d, col, rz = 0) {
  const m = mesh(g, new T.BoxGeometry(w, h, d), col, x, y, z);
  m.rotation.z = rz;
  return m;
}
export function ell(g, x, y, z, sx, sy, sz, col, detail = 1, rz = 0) {
  const m = mesh(g, new T.IcosahedronGeometry(1, detail), col, x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.z = rz;
  return m;
}
export function rod(g, a, b, r, c, rb = r, sides = 8) {
  const v = vec(...b).sub(vec(...a));
  const o = mesh(g, new T.CylinderGeometry(rb, r, v.length(), sides), c);
  o.position.copy(vec(...a)).addScaledVector(v, 0.5);
  o.quaternion.setFromUnitVectors(vec(0, 1, 0), v.normalize());
  return o;
}
export function path(g, points, r, c, sides = 6, steps = 18) {
  const curve = new T.CatmullRomCurve3(points.map(p => vec(...p)));
  return mesh(g, new T.TubeGeometry(curve, steps, r, sides, false), c);
}
export function torus(g, x, y, z, r, t, c, segments = 48, arc = tau, start = 0) {
  const o = mesh(g, new T.TorusGeometry(r, t, 8, segments, arc), c, x, y, z);
  o.rotation.z = start;
  return o;
}
// Rings run along the animal's silhouette. Each cross-section can have a
// different width and asymmetric upper/lower contour.
export function formX(g, rows, col, n = 12) {
  const rings = rows.map(([x, y, w, up, down = up]) => Array.from({ length: n }, (_, k) => {
    const a = tau * k / n;
    return [x, y+Math.cos(a)*(Math.cos(a)>0?up:down), Math.sin(a)*w];
  }));
  return skin(g, rings, col);
}
export function formY(g, rows, col, n = 12) {
  const rings = rows.map(([y, x, rx, rz, z = 0]) => Array.from({ length: n }, (_, k) => {
    const a = -tau * k / n;
    return [x+rx*Math.cos(a), y, z+rz*Math.sin(a)];
  }));
  return skin(g, rings, col);
}
function skin(g, rings, c) {
  const verts = [];
  const n = rings[0].length;
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      verts.push(...rings[j][i], ...rings[j][k], ...rings[j + 1][k], ...rings[j][i], ...rings[j + 1][k], ...rings[j + 1][i]);
    }
  for (let i = 1; i < n - 1; i++)
    verts.push(...rings[0][0], ...rings[0][i + 1], ...rings[0][i], ...rings.at(-1)[0], ...rings.at(-1)[i], ...rings.at(-1)[i + 1]);
  return faces(g, verts, c);
}
export function faces(g, vertices, c) {
  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geom.computeVertexNormals();
  return mesh(g, geom, c);
}
const paletteMaterial = new T.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.87,
  side: T.DoubleSide,
  flatShading: true
});
// Combine rigid parts in local space. Articulation nodes remain independent.
export function pack(g, cast = false, receive = false) {
  g.updateWorldMatrix(true, true);
  const inv = g.matrixWorld.clone().invert(), p = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const pos = [], col = [], norm = [];
  const old = [];
  g.traverse(o => {
    if (!o.isMesh)
      return;
    const mat = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const geo = o.geometry, src = geo.attributes.position, idx = geo.index, vc = geo.attributes.color;
    for (let t = 0; t < (idx ? idx.count : src.count); t += 3) {
      const ids = [0, 1, 2].map(k => idx ? idx.getX(t + k) : t + k);
      a.fromBufferAttribute(src, ids[0]).applyMatrix4(mat);
      b.fromBufferAttribute(src, ids[1]).applyMatrix4(mat);
      c.fromBufferAttribute(src, ids[2]).applyMatrix4(mat);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      p.subVectors(b, a).cross(c.sub(a)).normalize();
      for (const id of ids) {
        norm.push(p.x, p.y, p.z);
        const mc = o.material.color;
        col.push(mc.r * (vc ? vc.getX(id) : 1), mc.g * (vc ? vc.getY(id) : 1), mc.b * (vc ? vc.getZ(id) : 1));
      }
    }
    old.push(geo);
  });
  g.clear();
  old.forEach(geo => geo.dispose());
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(norm, 3));
  const result = new T.Mesh(geo, paletteMaterial);
  result.castShadow = cast;
  result.receiveShadow = receive;
  g.add(result);
  return result;
}
export function seeded(seed) {
  return () => {
    seed = Math.imul(1664525, seed) + 1013904223 >>> 0;
    return seed / 4294967296;
  };
}
