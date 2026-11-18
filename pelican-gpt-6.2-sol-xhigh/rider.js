import * as THREE from 'three';
import { align, batch, box, cylinder, mesh, oval, rod, standard, torus, tube, v } from './forms.js';

const rear = v(-1.31, .735, 0);
const front = v(1.31, .735, 0);
const crankCenter = v(-.26, .755, 0);
const wheelRadius = .657;
const pedalRadius = .213;

function wheel(parent, center, palette) {
  const wheel = new THREE.Group();
  wheel.position.copy(center);
  parent.add(wheel);
  const { tire, rubber, enamel, steel, brass } = palette;
  torus(wheel, tire, 0, 0, 0, wheelRadius, .076);
  torus(wheel, enamel, 0, 0, 0, .583, .025);
  for (const side of [-1, 1]) {
    torus(wheel, rubber, 0, 0, side * .056, .649, .024);
    torus(wheel, steel, 0, 0, side * .022, .572, .011);
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6 + (side > 0 ? .095 : 0);
      const inner = angle + (index % 2 ? .78 : -.78);
      rod(wheel, steel,
        v(.09 * Math.cos(inner), .09 * Math.sin(inner), .065 * side),
        v(.565 * Math.cos(angle), .565 * Math.sin(angle), .012 * side), .0055, .0055, 5);
    }
  }
  rod(wheel, steel, v(0, 0, -.145), v(0, 0, .145), .069);
  rod(wheel, brass, v(0, 0, -.153), v(0, 0, .153), .038);
  box(wheel, brass, 0, -.531, 0, .036, .069, .037);
  batch(wheel);
  return wheel;
}

function buildBike(parent) {
  const enamel = standard('#176c69', { metalness: .12, roughness: .35 });
  const darkEnamel = standard('#145659', { metalness: .15 });
  const steel = standard('#afc4bd', { metalness: .39, roughness: .28 });
  const brass = standard('#daa85d', { metalness: .25, roughness: .42 });
  const tire = standard('#25373a');
  const rubber = standard('#d9bd92');
  const saddle = standard('#693f30');
  const stitching = standard('#d39369');
  const paint = standard('#f6e3b2');
  const frame = new THREE.Group();
  parent.add(frame);
  const wheels = [wheel(parent, rear, { tire, rubber, enamel, steel, brass }),
    wheel(parent, front, { tire, rubber, enamel, steel, brass })];

  const seat = v(-.66, 1.57, 0);
  const steerer = v(.79, 1.56, 0);
  const bottomSteerer = v(.85, 1.32, 0);
  tube(frame, enamel, [[-.65, 1.54, 0], [-.47, 1.13, 0], [-.22, .96, 0], [.19, 1.02, 0], [.54, 1.25, 0], [.81, 1.5, 0]], .053);
  rod(frame, enamel, crankCenter, seat, .057, .049);
  tube(frame, enamel, [[-.26, .755, 0], [.16, .86, 0], [.54, 1.10, 0], [.85, 1.34, 0]], .068);
  rod(frame, enamel, bottomSteerer, steerer, .079);
  rod(frame, paint, v(.787, 1.56, 0), v(.81, 1.47, 0), .081);
  rod(frame, steel, seat, v(-.78, 1.85, 0), .039);
  rod(frame, darkEnamel, v(-.46, .755, 0), v(-.105, .755, 0), .086);
  rod(frame, steel, v(-.26, .755, -.175), v(-.26, .755, .175), .049);
  oval(frame, saddle, -.78, 1.876, 0, .275, .075, .177, .01);
  oval(frame, stitching, -.81, 1.879, 0, .245, .031, .177, .01);
  oval(frame, saddle, -.85, 1.914, 0, .209, .051, .16);

  for (const side of [-1, 1]) {
    const z = .124 * side;
    rod(frame, darkEnamel, v(rear.x, rear.y, z), v(-.3, .755, z * .67), .031);
    rod(frame, enamel, v(rear.x, rear.y, z), v(seat.x, seat.y, z * .3), .034);
    tube(frame, enamel, [[front.x, front.y, z], [1.14, .9, z * .94], [.95, 1.17, z * .75], [.85, 1.34, z * .35]], .04, 17);
    for (const hub of [front, rear]) {
      rod(frame, steel, v(hub.x, hub.y, z), v(hub.x - .03, hub.y + .35, z), .009, .009, 6);
    }
  }

  for (const hub of [rear, front]) {
    const fender = mesh(frame, new THREE.TorusGeometry(.767, .035, 9, 40, Math.PI * .91), enamel);
    fender.position.copy(hub);
    fender.rotation.z = .15;
    const stripe = mesh(frame, new THREE.TorusGeometry(.801, .006, 5, 40, Math.PI * .89), paint);
    stripe.position.copy(hub);
    stripe.rotation.z = .18;
  }

  rod(frame, steel, steerer, v(.72, 1.99, 0), .042);
  tube(frame, steel, [[.72, 1.99, -.001], [.83, 2.02, .18], [.76, 2.13, .32], [.58, 2.15, .451]], .028);
  tube(frame, steel, [[.72, 1.99, .001], [.83, 2.02, -.18], [.76, 2.13, -.32], [.58, 2.15, -.451]], .028);
  for (const side of [-1, 1]) {
    rod(frame, saddle, v(.71, 2.144, side * .374), v(.548, 2.153, side * .473), .037);
    rod(frame, brass, v(.555, 2.153, side * .468), v(.537, 2.153, side * .479), .037);
  }
  tube(frame, tire, [[.73, 2.15, .36], [.93, 1.98, .25], [.81, 1.81, .066], [.84, 1.43, .14]], .008, 16, 6);
  oval(frame, brass, .793, 2.071, .242, .072, .044, .069);
  oval(frame, paint, .80, 2.092, .248, .050, .019, .050);

  const headlamp = standard('#fff0b2', { emissive: '#ffcf73', emissiveIntensity: .18 });
  oval(frame, brass, 1.05, 1.385, 0, .12, .097, .097, .12);
  oval(frame, headlamp, 1.142, 1.393, 0, .040, .074, .074, .12);
  oval(frame, standard('#e75b42'), -1.93, 1.16, 0, .035, .066, .073, -.43);

  // The carrier, basket ribs, and staggered weave follow the same tapered oval.
  const cane = standard('#ad6940');
  const wicker = standard('#d89553');
  const brightWicker = standard('#ecbb79');
  const basket = v(1.267, 1.93, 0);
  for (const side of [-1, 1]) {
    rod(frame, steel, v(.94, 1.27, .12 * side), v(1.294, 1.668, .205 * side), .018);
  }
  cylinder(frame, cane, basket.x, 1.73, 0, .24, .21, .10).scale.z = 1.16;
  for (let i = 0; i < 22; i++) {
    const angle = i * Math.PI * 2 / 22;
    const coords = [.21, .254, .28].map((r, j) =>
      [basket.x + r * Math.cos(angle), 1.70 + .155 * j, (r + .065) * Math.sin(angle)]);
    tube(frame, i % 3 ? wicker : brightWicker, coords, .012, 7, 5);
  }
  for (let i = 0; i < 7; i++) {
    const radius = .218 + i * .0095;
    const points = Array.from({ length: 45 }, (_, j) => {
      const angle = j * Math.PI * 2 / 44;
      const step = j % 2 ? -.006 : .006;
      return [basket.x + (radius + step) * Math.cos(angle), 1.714 + .047 * i, (radius + .065 + step) * Math.sin(angle)];
    });
    tube(frame, [cane, brightWicker, wicker][i % 3], points, i === 6 ? .023 : .014, 56, 6);
  }

  const stem = standard('#537d57');
  const petals = standard('#fff2c7');
  const center = standard('#efa72c');
  const pink = standard('#e4795e');
  for (const [x, y, z, tilt, tint] of [
    [1.195, 2.228, -.14, .4, petals], [1.41, 2.16, .091, -.47, pink], [1.179, 2.137, .162, .5, petals],
  ]) {
    rod(frame, stem, v(basket.x, 1.82, 0), v(x, y, z), .014);
    oval(frame, stem, x + .06, y - .17, z, .09, .027, .035, .6);
    oval(frame, center, x, y, z + .016, .038, .045, .033);
    for (let p = 0; p < 6; p++) {
      const a = tilt + p * Math.PI / 3;
      oval(frame, tint, x + Math.cos(a) * .053, y + Math.sin(a) * .053, z,
        .045, .022, .023, a);
    }
  }
  batch(frame);

  const drive = new THREE.Group();
  drive.position.copy(crankCenter);
  parent.add(drive);
  torus(drive, darkEnamel, 0, 0, .139, .145, .023, 44);
  for (let index = 0; index < 5; index++) {
    const angle = index * Math.PI * 2 / 5;
    rod(drive, brass, v(0, 0, .14), v(Math.cos(angle) * .142, Math.sin(angle) * .142, .14), .014);
  }
  oval(drive, brass, 0, 0, .171, .058, .058, .023);
  rod(parent, tire, v(-1.30, .817, .14), v(-.27, .898, .14), .015, .015, 8);
  rod(parent, tire, v(-1.30, .665, .14), v(-.27, .614, .14), .015, .015, 8);

  const pedals = [-1, 1].map(side => {
    const shank = mesh(parent, new THREE.CylinderGeometry(.022, .032, 1, 10), steel);
    const platform = new THREE.Group();
    parent.add(platform);
    box(platform, saddle, 0, 0, 0, .207, .036, .147);
    box(platform, brass, .105, 0, 0, .013, .026, .12);
    box(platform, brass, -.105, 0, 0, .013, .026, .12);
    return { side, shank, platform };
  });

  return { wheels, drive, pedals };
}

function neckGeometry() {
  const spine = new THREE.CatmullRomCurve3([
    v(-.55, 2.39, 0), v(-.29, 2.57, 0), v(-.32, 2.86, 0),
    v(-.37, 3.14, 0), v(-.28, 3.41, 0), v(-.06, 3.54, 0),
  ]);
  const radii = [.42, .371, .279, .254, .287, .315];
  const sides = 28;
  const segments = 30;
  const positions = [];
  const faces = [];
  for (let row = 0; row <= segments; row++) {
    const t = row / segments;
    const point = spine.getPoint(t);
    const tangent = spine.getTangent(t);
    const normal = v(tangent.y, -tangent.x, 0).normalize();
    const radiusIndex = t * (radii.length - 1);
    const a = Math.floor(radiusIndex);
    const r = THREE.MathUtils.lerp(radii[a], radii[Math.min(a + 1, radii.length - 1)], radiusIndex - a);
    for (let side = 0; side <= sides; side++) {
      const angle = side * 2 * Math.PI / sides;
      positions.push(point.x + normal.x * r * Math.cos(angle), point.y + normal.y * r * Math.cos(angle),
        Math.sin(angle) * r * 1.04);
      if (row && side) {
        const index = row * (sides + 1) + side;
        faces.push(index - sides - 2, index, index - sides - 1, index - sides - 2, index - 1, index);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

const billProfile = [
  [.21, 3.575, .19, .116, .103], [.39, 3.568, .278, .139, .236],
  [.63, 3.551, .253, .124, .324], [.95, 3.53, .226, .103, .296],
  [1.24, 3.514, .177, .103, .208], [1.5, 3.498, .105, .095, .108],
  [1.64, 3.477, .051, .069, .069], [1.69, 3.466, .001, .002, .002],
];
const beakSpine = new THREE.CatmullRomCurve3(billProfile.map(([x, y, w]) => v(x, y, w)));
const beakHeight = new THREE.CatmullRomCurve3(billProfile.map(([, , , up, down], i) => v(i, up, down)));

function billGeometry(pouch) {
  const length = 42;
  const sides = 32;
  const positions = [];
  const colors = [];
  const faces = [];
  const base = new THREE.Color(pouch ? '#f4ae4b' : '#ffce61');
  const edge = new THREE.Color(pouch ? '#df7544' : '#f5a43f');
  const tip = new THREE.Color('#e57842');
  for (let row = 0; row <= length; row++) {
    const t = row / length;
    const spine = beakSpine.getPoint(t);
    const height = beakHeight.getPoint(t);
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const c = Math.cos(angle);
      const y = c >= 0 ? (pouch ? .011 : height.y) : (pouch ? height.z : .012);
      positions.push(spine.x, spine.y + c * y - (pouch ? .016 : 0), Math.sin(angle) * spine.z);
      const pigment = base.clone().lerp(edge, pouch ? Math.abs(c) * .68 : (1 - c) * .38)
        .lerp(tip, THREE.MathUtils.smoothstep(t, .68, 1) * .8);
      colors.push(pigment.r, pigment.g, pigment.b);
      if (row && side) {
        const index = row * (sides + 1) + side;
        faces.push(index - sides - 2, index - sides - 1, index, index - sides - 2, index, index - 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

function scarf(parent) {
  const material = standard('#fff', { side: THREE.DoubleSide, vertexColors: true });
  const fabrics = [new THREE.Color('#c13f35'), new THREE.Color('#e49265'), new THREE.Color('#f3c089')];
  const rows = 24;
  const tabs = [0, .10, .41, .59, .90, 1];
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array((rows + 1) * tabs.length * 3);
  const colors = [];
  const faces = [];
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col < tabs.length; col++) {
      const color = fabrics[col === 0 || col === tabs.length - 1 ? 1 : (col === 2 || col === 3) && row > 21 ? 2 : 0];
      colors.push(color.r, color.g, color.b);
      if (row && col) {
        const index = row * tabs.length + col;
        faces.push(index, index - 1, index - tabs.length, index - 1, index - tabs.length - 1, index - tabs.length);
      }
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  const tail = mesh(parent, geometry, material);
  tail.frustumCulled = false;

  return (time, wind) => {
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const wave = Math.sin(t * 8 - time * 6);
      for (let col = 0; col < tabs.length; col++) {
        const u = tabs[col];
        const i = (row * tabs.length + col) * 3;
        vertices[i] = -.478 - (.81 + wind * .1) * t + Math.abs(u - .5) * .095 * t ** 8;
        vertices[i + 1] = 3.076 + (u - .5) * (.12 + t * .098) + t * (.09 + .068 * wave + .036 * wind);
        vertices[i + 2] = .239 + t * (.1 + .103 * Math.cos(t * 5.4 - time * 4.6)) + (u - .5) * (.075 + .048 * wave);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
  };
}

function buildBird(parent) {
  const cloud = standard('#ffedd4');
  const cream = standard('#f4e4ca');
  const dusty = standard('#e1ccac');
  const silver = standard('#b5b0a2');
  const slate = standard('#5a686a');
  const peach = standard('#edb489');
  const dark = standard('#302e2b', { roughness: .31 });
  const iris = standard('#86502d', { roughness: .4 });
  const white = new THREE.MeshBasicMaterial({ color: '#fff8e5' });
  const nostril = standard('#aa6938');
  const mouth = standard('#a55f3c');
  const wrap = standard('#b84035');
  const wrapEdge = standard('#dd6952');
  const bill = standard('#fff', { vertexColors: true, roughness: .48 });
  const fixed = new THREE.Group();
  parent.add(fixed);

  oval(fixed, cream, -.697, 2.359, 0, .754, .518, .469, .24);
  oval(fixed, cloud, -.446, 2.398, 0, .506, .489, .447, .37);
  for (const side of [-1, 0, 1]) {
    oval(fixed, side ? dusty : cream, -1.345, 2.352, side * .151, .341, .108, .139, -.18);
    oval(fixed, slate, -1.54, 2.387, side * .148, .205, .061, .097, -.19);
  }
  mesh(fixed, neckGeometry(), cream);
  oval(fixed, cloud, -.081, 3.552, 0, .444, .374, .329, -.16);
  oval(fixed, cloud, .103, 3.483, 0, .284, .250, .330, .13);
  for (let i = 0; i < 4; i++) {
    oval(fixed, i % 2 ? cream : cloud, -.358 - i * .041, 3.822 - i * .033,
      (i - 1.5) * .069, .196 - i * .012, .059, .064, -.40 + i * .09);
  }
  mesh(fixed, billGeometry(true), bill);
  mesh(fixed, billGeometry(false), bill);

  for (const side of [-1, 1]) {
    const z = side;
    const seam = Array.from({ length: 28 }, (_, i) => {
      const t = .105 + .881 * i / 27;
      const point = beakSpine.getPoint(t);
      return [point.x, point.y - .008, z * (point.z + .002)];
    });
    tube(fixed, mouth, seam, .0055, 42, 7);
    oval(fixed, nostril, .493, 3.623, z * .235, .047, .014, .019, -.15);
    oval(fixed, peach, .155, 3.532, z * .323, .116, .061, .017, -.14);

    oval(fixed, dusty, -.679, 2.395, z * .379, .574, .306, .171, .32);
    oval(fixed, cream, -.594, 2.479, z * .423, .468, .297, .157, .26);
    for (let i = 0; i < 5; i++) {
      const x = -.867 + i * .113;
      const y = 2.356 - i * .031;
      oval(fixed, slate, x - .135, y - .043, z * (.424 + i * .022), .250 - i * .013, .069, .069, .24);
      oval(fixed, i % 2 ? dusty : silver, x - .035, y + .019, z * (.457 + i * .02), .268 - i * .011, .072, .076, .30);
      oval(fixed, i % 2 ? cream : cloud, x + .063, y + .077, z * (.472 + i * .018), .242 - i * .010, .076, .072, .23);
    }
    oval(fixed, cream, -.036, 2.362, z * .464, .369, .133, .145, -.34);
    oval(fixed, cloud, .227, 2.236, z * .483, .30, .108, .123, -.39);
    oval(fixed, cream, .465, 2.158, z * .468, .179, .092, .102, -.11);
    for (let i = 0; i < 3; i++) {
      oval(fixed, cloud, .56 + i * .023, 2.118 + i * .025, z * (.48 - i * .041), .112, .044, .048, .10);
    }
  }

  const knot = torus(fixed, wrap, -.375, 3.12, 0, .257, .050, 42);
  knot.rotation.x = Math.PI / 2 + .14;
  knot.scale.y = 1.1;
  const knot2 = torus(fixed, wrapEdge, -.363, 3.157, 0, .26, .023, 42);
  knot2.rotation.copy(knot.rotation);
  knot2.scale.y = 1.105;
  oval(fixed, wrap, -.502, 3.095, .264, .116, .084, .082, .22);
  oval(fixed, wrapEdge, -.473, 3.112, .308, .075, .052, .034, .15);
  batch(fixed);

  const eyes = [-1, 1].map(side => {
    const eye = new THREE.Group();
    eye.position.set(.114, 3.689, .303 * side);
    eye.rotation.y = .24 * side;
    parent.add(eye);
    oval(eye, peach, 0, 0, 0, .114, .104, .038);
    oval(eye, cloud, 0, .003, .014 * side, .093, .084, .034);
    oval(eye, iris, .013, .005, .039 * side, .069, .071, .024);
    oval(eye, dark, .019, .006, .058 * side, .054, .058, .016);
    oval(eye, white, .034, .027, .073 * side, .019, .018, .006);
    oval(eye, white, -.007, -.014, .071 * side, .008, .008, .005);
    return eye;
  });

  const skin = standard('#e3a363');
  const toe = standard('#e9b879');
  const legs = [-1, 1].map(side => {
    const upper = mesh(parent, new THREE.CylinderGeometry(.057, .078, 1, 12), skin);
    const lower = mesh(parent, new THREE.CylinderGeometry(.043, .054, 1, 12), skin);
    const knee = oval(parent, skin, 0, 0, 0, .059, .06, .06);
    const foot = new THREE.Group();
    parent.add(foot);
    oval(foot, toe, .029, .023, 0, .133, .058, .103);
    for (let i = -1; i <= 1; i++) {
      oval(foot, toe, .105 - Math.abs(i) * .022, .013, i * .053, .112, .032, .039, -.13);
    }
    return { side, upper, lower, knee, foot };
  });
  return { eyes, legs, moveScarf: scarf(parent) };
}

function legPose(leg, platform) {
  const hip = v(-.63, 2.15, leg.side * .245);
  const ankle = leg.foot.position.copy(platform).add(v(-.027, .044, 0));
  const delta = ankle.clone().sub(hip);
  const distance = Math.min(delta.length(), 1.598);
  const direction = delta.normalize();
  const upperLength = .790;
  const lowerLength = .810;
  const midpoint = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - midpoint ** 2));
  const forward = v(-direction.y, direction.x, 0).normalize();
  const knee = leg.knee.position.copy(hip).addScaledVector(direction, midpoint).addScaledVector(forward, height);
  align(leg.upper, hip, knee);
  align(leg.lower, knee, ankle);
  leg.upper.scale.y = hip.distanceTo(knee);
  leg.lower.scale.y = knee.distanceTo(ankle);
}

export function createRider(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const bike = buildBike(root);
  const rider = buildBird(root);

  function pose(phase, time, speed) {
    root.rotation.x = Math.sin(phase) * .018;
    root.rotation.z = Math.sin(phase * 2) * .006;
    bike.wheels.forEach(wheel => { wheel.rotation.z = phase * 2.23; });
    bike.drive.rotation.z = phase;
    for (const [index, pedal] of bike.pedals.entries()) {
      const angle = phase + index * Math.PI;
      pedal.platform.position.set(crankCenter.x + pedalRadius * Math.cos(angle),
        crankCenter.y + pedalRadius * Math.sin(angle), pedal.side * .284);
      const spindle = v(crankCenter.x, crankCenter.y, pedal.side * .17);
      const tip = pedal.platform.position.clone();
      tip.z = pedal.side * .232;
      align(pedal.shank, spindle, tip);
      pedal.shank.scale.y = spindle.distanceTo(tip);
      legPose(rider.legs[index], pedal.platform.position);
    }
    const blink = (time + .72) % 4.78;
    const openness = blink < .15 ? 1 - Math.sin(blink / .15 * Math.PI) * .96 : 1;
    rider.eyes.forEach(eye => { eye.scale.y = openness; });
    rider.moveScarf(time, speed);
  }

  pose(-.65, 0, 1);
  return { pose };
}
