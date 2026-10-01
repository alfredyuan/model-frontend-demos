import * as THREE from 'three';
import { radialTexture } from './util.js';

const COUNT = 16;

/** Flying fish snacks hovering over the lane; the pelican scoops them up. */
export class FishSchool {
  constructor(scene, road, lane) {
    this.road = road;
    this.lane = lane;
    this.list = [];
    const bodyGeo = new THREE.SphereGeometry(1, 16, 10);
    const tailGeo = new THREE.ConeGeometry(0.075, 0.13, 4).rotateX(-Math.PI / 2).scale(0.35, 1, 1);
    const finGeo = new THREE.ConeGeometry(0.04, 0.08, 3).scale(0.3, 1, 1);
    const blue = new THREE.MeshStandardMaterial({ color: 0x6ec6ff, metalness: 0.55, roughness: 0.25, emissive: 0x1a4a70, emissiveIntensity: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc933, metalness: 0.8, roughness: 0.2, emissive: 0xff9a00, emissiveIntensity: 0.6 });
    const eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const glowTex = radialTexture('rgba(255,240,180,1)');
    for (let i = 0; i < COUNT; i++) {
      const golden = i % 6 === 5;
      const g = new THREE.Group();
      const swim = new THREE.Group();
      g.add(swim);
      const mat = golden ? gold : blue;
      const body = new THREE.Mesh(bodyGeo, mat); body.scale.set(0.045, 0.075, 0.15); swim.add(body);
      const tail = new THREE.Mesh(tailGeo, mat); tail.position.z = -0.17; swim.add(tail);
      const fin = new THREE.Mesh(finGeo, mat); fin.position.set(0, 0.08, -0.02); swim.add(fin);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), eye); e.position.set(s * 0.036, 0.018, 0.09); swim.add(e); }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: golden ? 0xffcc55 : 0x9fe0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
      glow.scale.setScalar(golden ? 1.1 : 0.75);
      g.add(glow);
      if (golden) g.scale.setScalar(1.35);
      scene.add(g);
      this.list.push({ g, swim, tail, glow, golden, s: 0, state: 'idle', t: 0, pop: 1, from: new THREE.Vector3(), base: golden ? 1.35 : 1 });
    }
    this._S = {};
  }

  /** Spread fish ahead of the rider. */
  reset(riderS) {
    const L = this.road.length;
    this.list.forEach((f, i) => {
      f.s = this.road.wrap(riderS + 25 + (i / COUNT) * L * 0.97 + Math.random() * 6);
      f.state = 'idle'; f.g.visible = true; f.pop = 1;
    });
  }

  /** Distance ahead of the rider (0..L). */
  ahead(f, riderS) { return this.road.wrap(f.s - riderS); }

  update(dt, t, riderS, beakWorld, night, onCatch) {
    const S = this._S;
    let nearest = Infinity;
    for (const f of this.list) {
      if (f.state === 'idle') {
        const a = this.ahead(f, riderS);
        if (a < nearest) nearest = a;
        this.road.sample(f.s, S);
        const y = S.y + 1.66 + Math.sin(t * 2.2 + f.s) * 0.06;
        f.g.position.set(S.x + S.rx * this.lane, y, S.z + S.rz * this.lane);
        f.swim.rotation.y = Math.atan2(-S.tx, -S.tz) + Math.sin(t * 1.5 + f.s) * 0.5;
        f.tail.rotation.y = Math.sin(t * 12 + f.s) * 0.5;
        f.swim.rotation.z = Math.sin(t * 3 + f.s) * 0.15;
        f.pop = Math.min(1, f.pop + dt * 3);
        const sc = f.base * (f.pop < 1 ? 1 + Math.sin(f.pop * Math.PI) * 0.5 : 1) * f.pop;
        f.g.scale.setScalar(sc);
        f.glow.material.opacity = 0.35 + night * 0.25 + Math.sin(t * 4 + f.s) * 0.1;
        if (a < 0.82 || a > this.road.length - 0.5) {
          f.state = 'fly'; f.t = 0; f.from.copy(f.g.position);
        }
      } else if (f.state === 'fly') {
        f.t += dt / 0.12;
        const k = Math.min(f.t, 1);
        f.g.position.lerpVectors(f.from, beakWorld, k);
        f.g.scale.setScalar(f.base * (1 - k * 0.7));
        if (k >= 1) {
          f.state = 'gone'; f.t = 0; f.g.visible = false;
          onCatch(f, beakWorld);
        }
      } else {
        f.t += dt;
        const a = this.ahead(f, riderS);
        if (f.t > 8 && a > 60 && a < this.road.length - 30) {
          f.state = 'idle'; f.g.visible = true; f.pop = 0;
        }
      }
    }
    return nearest;
  }
}
