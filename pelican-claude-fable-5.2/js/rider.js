// 自行车 + 鹈鹕：建模与逐帧动画（踩踏的腿用两段 IK，翅膀握把/扇动两种姿态插值）
import * as THREE from 'three';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const XAXIS = new THREE.Vector3(1, 0, 0);
const YAXIS = new THREE.Vector3(0, 1, 0);
const lerp = (a, b, t) => a + (b - a) * t;

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
}
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
// 两点之间的圆管（静态）
function tube(a, b, r, mat, r2 = r, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const m = mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}
// 把单位高度圆柱摆到 a→b（逐帧）
const _d = new THREE.Vector3();
function place(m, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  m.position.copy(a).addScaledVector(_d, 0.5);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  m.scale.set(1, len, 1);
}

function makeFish(mats, s = 1) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(1, 12, 8), mats.fish);
  body.scale.set(0.17 * s, 0.062 * s, 0.036 * s);
  const belly = mesh(new THREE.SphereGeometry(1, 10, 6), mats.fishBelly, 0, -0.012 * s, 0);
  belly.scale.set(0.15 * s, 0.05 * s, 0.038 * s);
  const tail = mesh(new THREE.ConeGeometry(0.07 * s, 0.11 * s, 4), mats.fish, -0.2 * s, 0, 0);
  tail.rotation.z = -Math.PI / 2;
  tail.scale.z = 0.25;
  const eye = mesh(new THREE.SphereGeometry(0.012 * s, 6, 6), mats.black, 0.11 * s, 0.015 * s, 0.027 * s);
  const eye2 = eye.clone(); eye2.position.z *= -1;
  g.add(body, belly, tail, eye, eye2);
  return g;
}

export function createRider() {
  const mats = {
    frame: std(0x12b3a2, { metalness: 0.3, roughness: 0.35 }),
    metal: std(0xd4dae0, { metalness: 0.45, roughness: 0.3 }),
    rubber: std(0x1c1c21, { roughness: 0.92 }),
    leather: std(0x7b4a2b, { roughness: 0.55 }),
    wicker: std(0xc9995a, { roughness: 0.9 }),
    cream: std(0xf3ead6, { roughness: 0.5, metalness: 0.1 }),
    white: std(0xfbfaf4, { roughness: 0.85 }),
    black: std(0x17171b, { roughness: 0.5 }),
    featherTip: std(0x26262c, { roughness: 0.8 }),
    beak: std(0xf7b033, { roughness: 0.45 }),
    beakTip: std(0xe5532a, { roughness: 0.45 }),
    pouch: std(0xf68b45, { roughness: 0.6 }),
    leg: std(0xf08a24, { roughness: 0.6 }),
    red: std(0xe23b3b, { roughness: 0.75 }),
    helmet: std(0xffd23f, { roughness: 0.35 }),
    eyeWhite: std(0xffffff, { roughness: 0.25 }),
    fish: std(0x6fa8c9, { roughness: 0.3, metalness: 0.35 }),
    fishBelly: std(0xe8f1f5, { roughness: 0.35, metalness: 0.2 }),
    reflector: std(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 0.25 }),
    lens: std(0xfff6d0, { emissive: 0xffe9a0, emissiveIntensity: 0 }),
  };

  const rig = new THREE.Group();      // 整体：跳跃、侧倾、抬头
  const bike = new THREE.Group();
  rig.add(bike);

  // ───────────────────────── 自行车 ─────────────────────────
  const R = 0.42;
  const P = {
    rear: V(-0.66, R), bb: V(-0.1, 0.34), seat: V(-0.3, 0.98),
    headTop: V(0.40, 1.02), headBot: V(0.468, 0.832), front: V(0.68, R),
  };

  function makeWheel() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(R - 0.036, 0.036, 10, 40), mats.rubber));
    g.add(mesh(new THREE.TorusGeometry(R - 0.078, 0.014, 6, 40), mats.metal));
    const spokeGeo = new THREE.CylinderGeometry(0.004, 0.004, 2 * (R - 0.08), 4);
    for (let i = 0; i < 8; i++) {
      const s = mesh(spokeGeo, mats.metal);
      s.rotation.z = (i / 8) * Math.PI;
      s.position.z = i % 2 ? 0.012 : -0.012;
      g.add(s);
    }
    const hub = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.11, 10), mats.metal);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    for (const a of [0.4, 0.4 + Math.PI]) {   // 辐条反光片，便于看出转动
      const r = mesh(new THREE.BoxGeometry(0.09, 0.03, 0.014), mats.reflector, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0);
      r.rotation.z = a + Math.PI / 2;
      g.add(r);
    }
    return g;
  }
  function makeFender(start, arc) {
    const f = mesh(new THREE.TorusGeometry(R + 0.035, 0.012, 6, 24, arc), mats.cream);
    f.rotation.z = start;
    f.scale.z = 3.4;
    return f;
  }

  // 车架
  const zs = [0.055, -0.055];
  bike.add(tube(P.bb, V(-0.335, 1.085), 0.022, mats.frame));                    // 立管
  bike.add(tube(V(-0.335, 1.085), V(-0.345, 1.115), 0.014, mats.metal));        // 座管
  bike.add(tube(V(-0.29, 0.95), V(0.405, 0.995), 0.021, mats.frame));           // 上管
  bike.add(tube(P.bb, P.headBot, 0.025, mats.frame));                           // 下管
  bike.add(tube(V(0.478, 0.804), V(0.392, 1.042), 0.03, mats.frame));           // 头管
  for (const z of zs) {
    bike.add(tube(V(P.bb.x, P.bb.y, z * 0.7), V(P.rear.x, P.rear.y, z), 0.013, mats.frame));       // 后下叉
    bike.add(tube(V(P.seat.x, P.seat.y, z * 0.4), V(P.rear.x, P.rear.y, z), 0.011, mats.frame));   // 后上叉
  }
  const bbShell = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), mats.frame, P.bb.x, P.bb.y, 0);
  bbShell.rotation.x = Math.PI / 2;
  bike.add(bbShell);

  // 车座
  const saddle = mesh(new THREE.SphereGeometry(1, 14, 10), mats.leather, -0.35, 1.13, 0);
  saddle.scale.set(0.17, 0.035, 0.105);
  const saddleNose = mesh(new THREE.SphereGeometry(1, 10, 8), mats.leather, -0.22, 1.125, 0);
  saddleNose.scale.set(0.1, 0.028, 0.045);
  bike.add(saddle, saddleNose);

  // 后轮 + 挡泥板 + 链条
  const rearWheel = makeWheel();
  rearWheel.position.copy(P.rear);
  bike.add(rearWheel);
  const rf = makeFender(0.35, 2.5); rf.position.copy(P.rear); bike.add(rf);
  const cog = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 12), mats.metal, P.rear.x, P.rear.y, 0.07);
  cog.rotation.x = Math.PI / 2;
  bike.add(cog);
  bike.add(tube(V(P.bb.x, P.bb.y + 0.088, 0.07), V(P.rear.x, P.rear.y + 0.04, 0.07), 0.006, mats.black, 0.006, 4));
  bike.add(tube(V(P.bb.x, P.bb.y - 0.088, 0.07), V(P.rear.x, P.rear.y - 0.04, 0.07), 0.006, mats.black, 0.006, 4));

  // 曲柄 + 脚踏
  const CRANK = 0.17;
  const crank = new THREE.Group();
  crank.position.copy(P.bb);
  bike.add(crank);
  const ring = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.008, 20), mats.metal, 0, 0, 0.07);
  ring.rotation.x = Math.PI / 2;
  crank.add(ring);
  const pedals = [];
  for (const s of [1, -1]) {
    crank.add(tube(V(0, 0, s * 0.085), V(0, s * CRANK, s * 0.085), 0.013, mats.metal));
    const pedal = new THREE.Group();
    pedal.position.set(0, s * CRANK, s * 0.15);
    pedal.add(mesh(new THREE.BoxGeometry(0.1, 0.022, 0.1), mats.black));
    crank.add(pedal);
    pedals.push(pedal);   // [0] 在 +z 侧，[1] 在 -z 侧
  }

  // 转向组件：绕头管轴转动；内部仍用车身坐标摆放零件
  const tilt = Math.asin(0.34);
  const steerTilt = new THREE.Group();
  steerTilt.position.copy(P.headBot);
  steerTilt.rotation.z = tilt;
  const steer = new THREE.Group();
  const front = new THREE.Group();
  front.rotation.z = -tilt;
  front.position.copy(P.headBot).applyAxisAngle(new THREE.Vector3(0, 0, 1), -tilt).negate();
  steerTilt.add(steer); steer.add(front); bike.add(steerTilt);

  const frontWheel = makeWheel();
  frontWheel.position.copy(P.front);
  front.add(frontWheel);
  const ff = makeFender(0.75, 1.75); ff.position.copy(P.front); front.add(ff);
  for (const z of zs) front.add(tube(V(0.474, 0.815, z), V(P.front.x, P.front.y, z), 0.014, mats.frame, 0.017));
  front.add(tube(V(0.474, 0.82, -0.055), V(0.474, 0.82, 0.055), 0.017, mats.frame));     // 叉肩
  const HB = V(0.345, 1.175);
  front.add(tube(V(0.392, 1.042), HB, 0.016, mats.metal));                               // 把立
  front.add(tube(V(HB.x, HB.y, -0.29), V(HB.x, HB.y, 0.29), 0.015, mats.metal));         // 车把
  const grips = [];
  for (const s of [1, -1]) {
    front.add(tube(V(HB.x, HB.y, s * 0.2), V(HB.x, HB.y, s * 0.3), 0.022, mats.rubber));
    const mk = new THREE.Object3D();
    mk.position.set(HB.x, HB.y + 0.005, s * 0.25);
    front.add(mk);
    grips.push(mk);
  }
  // 车铃
  const bell = mesh(new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.metal, HB.x, HB.y + 0.012, 0.13);
  front.add(bell);

  // 车筐（装鱼）
  const basket = new THREE.Group();
  basket.position.set(0.73, 1.07, 0);
  const bw = 0.3, bh = 0.2, bd = 0.42, bt = 0.014;
  basket.add(mesh(new THREE.BoxGeometry(bw, bt, bd), mats.wicker, 0, -bh / 2, 0));
  basket.add(mesh(new THREE.BoxGeometry(bt, bh, bd), mats.wicker, -bw / 2, 0, 0));
  basket.add(mesh(new THREE.BoxGeometry(bt, bh, bd), mats.wicker, bw / 2, 0, 0));
  basket.add(mesh(new THREE.BoxGeometry(bw, bh, bt), mats.wicker, 0, 0, -bd / 2));
  basket.add(mesh(new THREE.BoxGeometry(bw, bh, bt), mats.wicker, 0, 0, bd / 2));
  const rim = mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 4), mats.leather, 0, bh / 2, 0);   // 方形边框
  rim.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  rim.scale.set(bw * 1.42, bd * 1.42, 1);
  basket.add(rim);
  front.add(basket);
  for (const z of [0.1, -0.1]) front.add(tube(V(HB.x, HB.y, z), V(0.58, 1.1, z), 0.008, mats.metal));
  front.add(tube(V(0.6, 0.97, 0), V(P.front.x, P.front.y, 0.06), 0.006, mats.metal));
  front.add(tube(V(0.6, 0.97, 0), V(P.front.x, P.front.y, -0.06), 0.006, mats.metal));

  const fishes = [];
  const fishPose = [[0.03, 0.1, 0.1, 1.15], [-0.03, 0.1, 0.0, 1.4], [0.03, 0.09, -0.1, 1.05]];
  fishPose.forEach(([x, y, z, rz], i) => {
    const f = makeFish(mats, 1 + i * 0.08);
    f.position.set(x, y, z);
    f.rotation.set(0, i * 0.3 - 0.3, -rz);   // 头朝下、尾巴翘出车筐
    f.userData.rz = -rz;
    basket.add(f);
    fishes.push(f);
  });

  // 车灯（夜晚点亮）
  const lamp = mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.07, 12), mats.metal, 0.915, 1.02, 0);
  lamp.rotation.z = -Math.PI / 2;
  const lens = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 12), mats.lens, 0.953, 1.02, 0);
  lens.rotation.z = -Math.PI / 2;
  front.add(lamp, lens);
  const spot = new THREE.SpotLight(0xffe7b0, 0, 28, 0.55, 0.7, 1.6);
  spot.position.set(0.96, 1.02, 0);
  spot.target.position.set(7, 0, 0);
  front.add(spot, spot.target);

  // ───────────────────────── 鹈鹕 ─────────────────────────
  const body = new THREE.Group();
  const BODY_Y = 1.37;
  body.position.set(-0.2, BODY_Y, 0);
  rig.add(body);

  const torso = mesh(new THREE.SphereGeometry(1, 28, 20), mats.white);
  torso.scale.set(0.5, 0.36, 0.37);
  torso.rotation.z = 0.22;
  const chest = mesh(new THREE.SphereGeometry(1, 20, 16), mats.white, 0.24, 0.06, 0);
  chest.scale.set(0.3, 0.3, 0.31);
  body.add(torso, chest);

  const tail = new THREE.Group();
  tail.position.set(-0.43, -0.02, 0);
  for (let k = -1; k <= 1; k++) {
    const f = mesh(new THREE.ConeGeometry(0.09, 0.36, 6), k === 0 ? mats.white : mats.featherTip);
    f.geometry.translate(0, 0.18, 0);
    f.rotation.set(0, 0, Math.PI / 2 - 0.35);
    f.rotation.y = k * 0.38;
    f.rotation.order = 'YZX';
    f.scale.set(1, 1, 0.45);
    f.position.z = k * 0.05;
    tail.add(f);
  }
  body.add(tail);

  // 脖子（S 形）+ 头
  const neck = new THREE.Group();
  neck.position.set(0.3, 0.14, 0);
  body.add(neck);
  const neckCurve = new THREE.CatmullRomCurve3([V(-0.1, -0.1), V(0.04, 0.03), V(0.18, 0.22), V(0.12, 0.46), V(0.17, 0.68)]);
  neck.add(mesh(new THREE.TubeGeometry(neckCurve, 24, 0.085, 12), mats.white));
  const neckBase = mesh(new THREE.SphereGeometry(0.13, 14, 12), mats.white, 0.02, 0.0, 0);
  neck.add(neckBase);

  // 红围巾 + 飘带
  const scarfTilt = new THREE.Group();
  scarfTilt.position.set(0.165, 0.2, 0);
  scarfTilt.rotation.z = -0.62;
  const scarfRing = mesh(new THREE.TorusGeometry(0.09, 0.042, 8, 20), mats.red);
  scarfRing.rotation.x = Math.PI / 2;
  scarfTilt.add(scarfRing);
  neck.add(scarfTilt);
  const scarfTails = [];
  for (const [zOff, baseRz, ph] of [[0.05, -0.42, 0], [-0.04, -0.24, 1.3]]) {
    const root = new THREE.Group();
    root.position.set(0.07, 0.23, zOff);
    root.rotation.z = baseRz;
    neck.add(root);
    const segs = [];
    let parent = root;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.x = i === 0 ? -0.05 : -0.11;
      const strip = mesh(new THREE.BoxGeometry(0.115, 0.012, 0.085 - i * 0.006), mats.red, -0.055, 0, 0);
      seg.add(strip);
      parent.add(seg);
      parent = seg;
      segs.push(seg);
    }
    scarfTails.push({ segs, ph });
  }

  const head = new THREE.Group();
  head.position.set(0.18, 0.72, 0);
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.15, 22, 18), mats.white);
  skull.scale.set(1.1, 1, 0.92);
  head.add(skull);

  // 头盔（小号的）
  const helmet = new THREE.Group();
  helmet.position.set(-0.012, 0.012, 0);
  helmet.rotation.z = 0.14;
  helmet.add(mesh(new THREE.SphereGeometry(0.172, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.36), mats.helmet));
  helmet.add(mesh(new THREE.SphereGeometry(0.176, 4, 8, -0.17, 0.34, 0, Math.PI * 0.36), mats.red));
  helmet.add(mesh(new THREE.SphereGeometry(0.176, 4, 8, Math.PI - 0.17, 0.34, 0, Math.PI * 0.36), mats.red));
  const brim = mesh(new THREE.SphereGeometry(1, 12, 6), mats.helmet, 0.15, 0.075, 0);
  brim.scale.set(0.07, 0.012, 0.1);
  helmet.add(brim);
  head.add(helmet);

  // 眼睛
  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(0.09, 0.012, s * 0.105);
    eye.add(mesh(new THREE.SphereGeometry(0.043, 14, 12), mats.eyeWhite));
    eye.add(mesh(new THREE.SphereGeometry(0.025, 12, 10), mats.black, 0.014, 0.002, s * 0.024));
    eye.add(mesh(new THREE.SphereGeometry(0.008, 6, 6), mats.eyeWhite, 0.03, 0.014, s * 0.04));
    head.add(eye);
    eyes.push(eye);
  }

  // 大嘴：上喙 + 下颌（带喉囊）
  const beak = new THREE.Group();
  beak.position.set(0.105, -0.04, 0);
  beak.rotation.z = -0.2;
  head.add(beak);
  const upperGeo = new THREE.CylinderGeometry(0.018, 0.072, 0.74, 12);
  upperGeo.rotateZ(-Math.PI / 2); upperGeo.translate(0.37, 0, 0);
  const upper = mesh(upperGeo, mats.beak);
  upper.scale.set(1, 0.42, 0.88);
  const hook = mesh(new THREE.SphereGeometry(0.026, 10, 8), mats.beakTip, 0.735, -0.016, 0);
  hook.scale.set(1.2, 1.5, 0.8);
  beak.add(upper, hook);

  const jaw = new THREE.Group();
  jaw.position.set(0.0, -0.022, 0);
  beak.add(jaw);
  const lowerGeo = new THREE.CylinderGeometry(0.012, 0.058, 0.7, 10);
  lowerGeo.rotateZ(-Math.PI / 2); lowerGeo.translate(0.35, 0, 0);
  const lower = mesh(lowerGeo, mats.beak);
  lower.scale.set(1, 0.28, 0.82);
  jaw.add(lower);
  const pouchGeo = new THREE.SphereGeometry(1, 22, 16);
  {
    const p = pouchGeo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) * 0.08);
    pouchGeo.computeVertexNormals();
  }
  const pouch = mesh(pouchGeo, mats.pouch, 0.33, -0.012, 0);
  pouch.scale.set(0.31, 0.17, 0.06);
  jaw.add(pouch);

  // 翅膀（握把 ↔ 扇动）
  const WING_L = 0.5;
  const wings = [];
  for (const s of [1, -1]) {
    const g = new THREE.Group();
    const main = mesh(new THREE.SphereGeometry(1, 16, 10), mats.white, 0.24, 0, 0);
    main.scale.set(0.28, 0.05, 0.16);
    g.add(main);
    for (let i = 0; i < 4; i++) {
      const u = i / 3 - 0.5;
      const tip = mesh(new THREE.SphereGeometry(1, 8, 6), mats.featherTip, 0.43, -0.004, u * 0.2);
      tip.scale.set(0.14, 0.016, 0.042);
      tip.rotation.y = -u * 0.5;
      g.add(tip);
    }
    rig.add(g);
    const shoulder = new THREE.Object3D();
    shoulder.position.set(0.14, 0.14, s * 0.31);
    body.add(shoulder);
    wings.push({ g, s, shoulder, grip: grips[s > 0 ? 0 : 1] });
  }

  // 腿（大腿、小腿、蹼足）
  const L1 = 0.5, L2 = 0.5;
  const footShape = new THREE.Shape();
  footShape.moveTo(-0.045, -0.018);
  footShape.lineTo(0.16, -0.095);
  footShape.quadraticCurveTo(0.14, -0.048, 0.2, 0);
  footShape.quadraticCurveTo(0.14, 0.048, 0.16, 0.095);
  footShape.lineTo(-0.045, 0.018);
  footShape.closePath();
  const footGeo = new THREE.ExtrudeGeometry(footShape, { depth: 0.016, bevelEnabled: false });
  footGeo.rotateX(-Math.PI / 2);
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Object3D();
    hip.position.set(0.0, -0.25, s * 0.16);
    body.add(hip);
    const thigh = mesh(new THREE.CylinderGeometry(0.05, 0.085, 1, 10), mats.white);
    const shin = mesh(new THREE.CylinderGeometry(0.022, 0.028, 1, 8), mats.leg);
    const knee = mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.white);
    const foot = mesh(footGeo, mats.leg);
    rig.add(thigh, shin, knee, foot);
    legs.push({ s, hip, thigh, shin, knee, foot, pedal: pedals[s > 0 ? 0 : 1] });
  }

  rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  // ───────────────────────── 动画 ─────────────────────────
  let wheelA = 0, crankA = 0, hopT = -1, landT = 10, flap = 0, squawk = 0, blinkT = 2.5;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const vk = new THREE.Vector3(), vh = new THREE.Vector3(), va = new THREE.Vector3();
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion();

  const api = {
    rig,
    onLand: null,
    get airborne() { return hopT >= 0; },
    hop() {
      if (hopT >= 0) return false;
      hopT = 0; squawk = 1;
      return true;
    },
    squawk() { squawk = 1; },
    setNight(k) {
      mats.lens.emissiveIntensity = k * 3;
      spot.intensity = k * 90;
      mats.reflector.emissiveIntensity = 0.25 + k * 0.8;
    },
    update(dt, t, speed) {
      wheelA -= (speed * dt) / R;
      crankA -= (speed * dt) / R / 2.3;
      rearWheel.rotation.z = wheelA;
      frontWheel.rotation.z = wheelA;
      crank.rotation.z = crankA;
      pedals[0].rotation.z = -crankA;
      pedals[1].rotation.z = -crankA;

      const sway = Math.min(speed / 5, 1.3);
      steer.rotation.y = Math.sin(t * 1.1) * 0.07 * sway;
      rig.rotation.x = Math.sin(t * 1.1 + 0.6) * 0.035 * sway;
      rig.position.z = Math.sin(t * 0.55) * 0.16 * sway;

      // 跳跃
      let y = 0, pitch = 0;
      if (hopT >= 0) {
        hopT += dt / 0.95;
        if (hopT >= 1) {
          hopT = -1; landT = 0;
          if (api.onLand) api.onLand();
        } else {
          const u = hopT;
          y = 1.15 * 4 * u * (1 - u);
          pitch = 0.34 * Math.sin(Math.PI * Math.min(u * 1.5, 1)) - 0.1 * Math.sin(Math.PI * u) * u;
        }
      }
      landT += dt;
      const squash = 1 - 0.09 * Math.exp(-landT * 8) * Math.cos(landT * 20);
      rig.position.y = y;
      rig.rotation.z = pitch;
      rig.scale.set(1, squash, 1);
      const k = 1 - Math.exp(-dt * 10);
      flap += ((hopT >= 0 ? 1 : 0) - flap) * k;
      squawk = Math.max(0, squawk - dt * 1.6);

      // 身体随踩踏起伏
      const c2 = Math.sin(2 * crankA);
      const pedalK = Math.min(speed / 3, 1);
      body.position.y = BODY_Y + 0.012 * c2 * pedalK;
      body.rotation.x = 0.035 * Math.sin(crankA) * pedalK;
      body.rotation.z = flap * 0.12;
      neck.rotation.z = 0.035 * Math.sin(2 * crankA + 1) * pedalK - flap * 0.1 + Math.sin(t * 0.7) * 0.02;
      head.rotation.z = -neck.rotation.z * 0.8 + squawk * 0.25;
      head.rotation.y = Math.sin(t * 0.43) * 0.22 + Math.sin(t * 0.17 + 1) * 0.12;
      jaw.rotation.z = -(0.03 + 0.02 * Math.sin(t * 2.1) + Math.max(flap * 0.35, Math.sin(squawk * Math.PI) * 0.55));
      pouch.scale.y = 0.17 * (1 + 0.07 * Math.sin(2 * crankA + 0.5) * pedalK + flap * 0.15);
      tail.rotation.y = Math.sin(t * 5) * 0.12;
      tail.rotation.z = flap * 0.3;

      blinkT -= dt;
      if (blinkT < -0.12) blinkT = 2 + Math.random() * 3;
      const ey = blinkT < 0 ? 0.12 : 1;
      eyes[0].scale.y = ey; eyes[1].scale.y = ey;

      // 围巾飘带：风越大越平、抖得越快
      const wind = 0.4 + Math.min(speed / 6, 1.6);
      for (const { segs, ph } of scarfTails) {
        for (let i = 0; i < segs.length; i++) {
          segs[i].rotation.z = Math.sin(t * (5 + wind * 4) - i * 0.9 + ph) * (0.07 + 0.045 * i) + (i === 0 ? 0 : Math.max(0, 1.2 - wind) * 0.3);
          segs[i].rotation.y = Math.sin(t * (4 + wind * 3) - i * 0.7 + ph * 2) * 0.12;
        }
      }
      // 车筐里的鱼扑腾
      for (let i = 0; i < fishes.length; i++) {
        const f = fishes[i];
        const burst = Math.max(0, Math.sin(t * 0.9 + i * 2.1)) ** 6;
        f.rotation.z = f.userData.rz + Math.sin(t * 22 + i) * 0.22 * burst + flap * Math.sin(t * 30 + i) * 0.2;
      }

      rig.updateMatrixWorld(true);

      // 翅膀
      for (const w of wings) {
        const sh = rig.worldToLocal(w.shoulder.getWorldPosition(v1));
        const gr = rig.worldToLocal(w.grip.getWorldPosition(v2));
        v3.subVectors(gr, sh);
        const len = v3.length();
        v3.normalize();
        qA.setFromUnitVectors(XAXIS, v3).multiply(qC.setFromAxisAngle(XAXIS, w.s * 1.15));
        const phi = 0.2 + 0.8 * Math.sin(t * 17);
        qB.setFromAxisAngle(XAXIS, -w.s * phi).multiply(qC.setFromAxisAngle(YAXIS, -w.s * Math.PI / 2));
        w.g.position.copy(sh);
        w.g.quaternion.slerpQuaternions(qA, qB, flap);
        w.g.scale.set(lerp(len / WING_L, 1.7, flap), 1, lerp(1, 1.9, flap));
      }

      // 腿：两段 IK，膝盖朝前
      for (const lg of legs) {
        const hip = rig.worldToLocal(lg.hip.getWorldPosition(vh));
        const ped = rig.worldToLocal(lg.pedal.getWorldPosition(v1));
        lg.foot.position.set(ped.x - 0.03, ped.y + 0.012, ped.z);
        lg.foot.rotation.z = 0.28 * Math.sin(crankA + (lg.s > 0 ? 0 : Math.PI)) - 0.1;
        va.set(ped.x - 0.035, ped.y + 0.045, ped.z);
        v2.subVectors(va, hip);
        const d = Math.min(v2.length(), L1 + L2 - 0.004);
        v2.normalize();
        const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
        v3.set(1, 0.15, lg.s * 0.3);
        v3.addScaledVector(v2, -v3.dot(v2)).normalize();
        vk.copy(hip).addScaledVector(v2, a).addScaledVector(v3, h);
        place(lg.thigh, hip, vk);
        place(lg.shin, vk, va);
        lg.knee.position.copy(vk);
      }
    },
  };
  return api;
}
