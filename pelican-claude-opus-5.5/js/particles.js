import * as THREE from 'three';

/** Pooled soft-sprite particle system (dust, sparkles, confetti, smoke). */
export class Particles {
  constructor(scene, max = 700) {
    this.max = max;
    this.next = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.p = Array.from({ length: max }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0, s0: 0, s1: 0, a0: 1, spin: 0 }));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uPx: { value: 500 } },
      vertexShader: /* glsl */`
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
        uniform float uPx;
        varying vec3 vC; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPx / max(-mv.z, 0.1);
          vC = aColor; vA = aAlpha;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vC; varying float vA;
        void main(){
          if (vA < 0.003) discard;
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          gl_FragColor = vec4(vC, smoothstep(0.5, 0.12, r) * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, color, o = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const p = this.p[i];
    p.life = p.max = o.life ?? 1;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.grav = o.grav ?? 0; p.drag = o.drag ?? 0;
    p.s0 = o.size ?? 0.15; p.s1 = o.size1 ?? p.s0;
    p.a0 = o.alpha ?? 1;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
  }

  update(dt, camera, renderer) {
    this.mat.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const { pos, alpha, size } = this;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) { alpha[i] = 0; continue; }
      p.life -= dt;
      const k = Math.max(p.life / p.max, 0);
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
      pos[i * 3] += p.vx * dt; pos[i * 3 + 1] += p.vy * dt; pos[i * 3 + 2] += p.vz * dt;
      alpha[i] = p.a0 * Math.min(1, k * 3) * (k > 0 ? 1 : 0);
      size[i] = p.s1 + (p.s0 - p.s1) * k;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aAlpha.needsUpdate = a.aSize.needsUpdate = a.aColor.needsUpdate = true;
  }
}
