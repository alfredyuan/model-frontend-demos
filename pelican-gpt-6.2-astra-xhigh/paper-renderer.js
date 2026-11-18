// A flat-shaded raster fallback for browsers that cannot create a WebGL context.
// It projects the same Three.js meshes, camera and animated joints as the GPU path.
import * as T from 'three';
import { sunDirection } from './stage.js';
const clip = 0.12;
const srgb = new Uint8Array(4097);
for (let i = 0; i < srgb.length; i++) {
  const v = i / 4096;
  srgb[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}
const channel = v => srgb[Math.min(4096, Math.max(0, Math.round(v * 4096)))];
const color = (r, g, b) => 255 << 24 | b << 16 | g << 8 | r;
const light = new T.Vector3(-3.8, 8, 4.9).normalize();
const mvp = new T.Matrix4(), viewProj = new T.Matrix4(), normMat = new T.Matrix3();
const camDir = new T.Vector3(), sunPos = new T.Vector3(), sphere = new T.Sphere(), frustum = new T.Frustum();
const smooth = x => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};
export class PaperRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
  }
  setSize(w, h, ratio = 1) {
    this.w = Math.max(1, Math.round(w * ratio));
    this.h = Math.max(1, Math.round(h * ratio));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.image = this.ctx.createImageData(this.w, this.h);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.depth = new Float32Array(this.w * this.h);
    this.shade = new Uint8Array(this.w * this.h);
  }
  drawTriangle(a, b, c, paint, shadow) {
    // Clip camera-space depth before dividing by w. This is important for the
    // sea and boardwalk surfaces that sometimes straddle the near plane.
    if (a[2] < clip || b[2] < clip || c[2] < clip) {
      const poly = [a, b, c], out = [];
      for (let i = 0; i < 3; i++) {
        const p = poly[i], q = poly[(i + 1) % 3];
        if (p[2] >= clip)
          out.push(p);
        if (p[2] >= clip !== q[2] >= clip) {
          const t = (clip - p[2]) / (q[2] - p[2]);
          out.push([p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t, clip]);
        }
      }
      for (let i = 1; i + 1 < out.length; i++)
        this.raster(out[0], out[i], out[i + 1], paint, shadow);
    } else
      this.raster(a, b, c, paint, shadow);
  }
  raster(a, b, c, paint, shadow) {
    const w = this.w, h = this.h, za = 1 / a[2], zb = 1 / b[2], zc = 1 / c[2];
    const ax = (1 + a[0] * za) * w * 0.5, ay = (1 - a[1] * za) * h * 0.5, bx = (1 + b[0] * zb) * w * 0.5, by = (1 - b[1] * zb) * h * 0.5, cx = (1 + c[0] * zc) * w * 0.5, cy = (1 - c[1] * zc) * h * 0.5;
    const minX = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5)), maxX = Math.min(w - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
    const minY = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5)), maxY = Math.min(h - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
    if (minX > maxX || minY > maxY)
      return;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-7)
      return;
    const d1 = (by - cy) / den, d2 = (cy - ay) / den, v1 = (cx - bx) / den, v2 = (ax - cx) / den;
    let f1 = (minX + 0.5 - cx) * d1 + (minY + 0.5 - cy) * v1, f2 = (minX + 0.5 - cx) * d2 + (minY + 0.5 - cy) * v2;
    const depth = this.depth, pixels = this.pixels, mask = this.shade;
    for (let y = minY; y <= maxY; y++, f1 += v1, f2 += v2) {
      let u = f1, v = f2, k = y * w + minX;
      for (let x = minX; x <= maxX; x++, k++, u += d1, v += d2) {
        if (u < -0.00001 || v < -0.00001 || u + v > 1.00001)
          continue;
        const z = zc + u * (za - zc) + v * (zb - zc);
        if (shadow) {
          if (z + 0.000016 >= depth[k])
            mask[k] = 1;
        } else if (z > depth[k]) {
          depth[k] = z;
          pixels[k] = paint;
        }
      }
    }
  }
  render(scene, camera) {
    const w = this.w, h = this.h;
    this.depth.fill(0);
    this.shade.fill(0);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProj);
    const sun = sunPos.copy(sunDirection).multiplyScalar(160).add(camera.position).project(camera);
    const sunX = (sun.x + 1) * w / 2, sunY = (1 - sun.y) * h / 2, radius = h * 0.044 / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (let y = 0; y < h; y++) {
      camDir.set(0, 1 - 2 * y / h, 0.5).unproject(camera).sub(camera.position).normalize();
      const f = smooth((camDir.y + 0.07) / 0.34);
      this.pixels.fill(color(216 - 86 * f, 231 - 38 * f, 216 - 13 * f), y * w, (y + 1) * w);
      const dy = y - sunY;
      if (sun.z < 1 && Math.abs(dy) < radius) {
        const dx = Math.sqrt(radius * radius - dy * dy), lo = Math.max(0, Math.ceil(sunX - dx)), hi = Math.min(w, Math.ceil(sunX + dx));
        if (hi > lo)
          this.pixels.fill(color(255, 241, 194), y * w + lo, y * w + hi);
      }
    }
    const shadowMeshes = [];
    const v = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], normal = new T.Vector3(), p = new T.Vector3(), towardCamera = new T.Vector3();
    scene.traverseVisible(o => {
      if (!o.isMesh || o.userData.sky)
        return;
      const geo = o.geometry;
      if (!geo.boundingSphere)
        geo.computeBoundingSphere();
      sphere.copy(geo.boundingSphere).applyMatrix4(o.matrixWorld);
      if (!frustum.intersectsSphere(sphere))
        return;
      if (o.castShadow)
        shadowMeshes.push(o);
      const pos = geo.attributes.position?.array, col = geo.attributes.color?.array, norm = geo.attributes.normal?.array;
      if (!pos || !col || !norm)
        return;
      const m = mvp.multiplyMatrices(viewProj, o.matrixWorld).elements;
      normMat.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < pos.length; i += 9) {
        for (let j = 0; j < 3; j++) {
          const k = i + j * 3, x = pos[k], y = pos[k + 1], z = pos[k + 2], a = v[j];
          a[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
          a[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
          a[2] = m[3] * x + m[7] * y + m[11] * z + m[15];
        }
        if (v[0][2] < clip && v[1][2] < clip && v[2][2] < clip)
          continue;
        normal.fromArray(norm, i).applyMatrix3(normMat).normalize();
        p.fromArray(pos, i).applyMatrix4(o.matrixWorld);
        towardCamera.subVectors(camera.position, p);
        if (normal.dot(towardCamera) < 0)
          normal.negate();
        const diffuse = Math.max(0, normal.dot(light)), up = (normal.y + 1) * 0.5;
        const fog = smooth(((v[0][2] + v[1][2] + v[2][2]) / 3 - 16) / 65);
        const r = channel(col[i] * (0.57 + up * 0.16 + diffuse * 0.71)), g = channel(col[i + 1] * (0.59 + up * 0.12 + diffuse * 0.65)), b = channel(col[i + 2] * (0.61 + up * 0.06 + diffuse * 0.57));
        const paint = color(r + (215 - r) * fog, g + (230 - g) * fog, b + (219 - b) * fog);
        this.drawTriangle(v[0], v[1], v[2], paint, false);
      }
    });
    // Project the rider's silhouette onto the boardwalk.
    const wm = new T.Vector3();
    for (const o of shadowMeshes) {
      const pos = o.geometry.attributes.position.array, m = viewProj.elements;
      for (let i = 0; i < pos.length; i += 9) {
        let onDeck = false;
        for (let j = 0; j < 3; j++) {
          wm.fromArray(pos, i + j * 3).applyMatrix4(o.matrixWorld);
          const x = wm.x - wm.y * light.x / light.y, z = wm.z - wm.y * light.z / light.y, y = 0.007;
          if (Math.abs(z) < 1.69)
            onDeck = true;
          v[j][0] = m[0] * x + m[4] * y + m[8] * z + m[12];
          v[j][1] = m[1] * x + m[5] * y + m[9] * z + m[13];
          v[j][2] = m[3] * x + m[7] * y + m[11] * z + m[15];
        }
        if (onDeck)
          this.drawTriangle(...v, 0, true);
      }
    }
    for (let i = 0; i < this.shade.length; i++)
      if (this.shade[i]) {
        const p = this.pixels[i];
        this.pixels[i] = color((p & 255) * 0.73, (p >>> 8 & 255) * 0.77, (p >>> 16 & 255) * 0.79);
      }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
