import {
  group,
  vec,
  box,
  ell,
  rod,
  path,
  torus,
  formX,
  formY,
  pack,
  tau
} from './shapes.js';
const ink = 0x273b3a, cream = 0xfff3d7, coral = 0xd54a2b, frame = 0x197e79, brass = 0xd8a855, steel = 0xa6afa0, leather = 0x995637;
export function buildCyclist(scene) {
  const rider = group(scene), bike = group(rider), body = group(rider);
  const rear = -1.17, front = 1.18, axle = 0.702, bb = [-.04, .77, 0], seat = [-.52, 1.63, 0];
  const wheels = [];
  for (const x of [rear, front]) {
    const w = group(rider);
    w.position.set(x, axle, 0);
    wheels.push(w);
    torus(w, 0, 0, 0, 0.632, 0.07, ink, 64);
    for (const s of [-1, 1])
      torus(w, 0, 0, 0.034 * s, 0.614, 0.039, 0xd5b88a, 64);
    torus(w, 0, 0, 0, 0.575, 0.032, steel, 64);
    rod(w, [0, 0, -.12], [0, 0, .12], 0.077, brass);
    for (let i = 0; i < 28; i++) {
      const a = i * tau / 28, s = i % 2 ? 1 : -1, aa = a + s * 0.42;
      rod(w, [.058*Math.cos(aa), .058*Math.sin(aa), s*.09], [.572*Math.cos(a), .572*Math.sin(a), 0], 0.007, 0x899995, 0.007, 4);
    }
    for (const s of [-1, 1]) {
      torus(w, 0, 0, s * 0.105, 0.057, 0.012, steel, 12);
      ell(w, 0, 0, s * 0.13, 0.049, 0.05, 0.023, ink, 0);
    }
    const ang = 2.1;
    rod(w, [.50*Math.cos(ang), .50*Math.sin(ang), .01], [.56*Math.cos(ang), .56*Math.sin(ang), .01], 0.014, ink);
    pack(w, true);
  }
  for (const s of [-1, 1]) {
    rod(bike, [rear, axle, s*.13], [bb[0], bb[1], s*.08], 0.035, frame);
    rod(bike, [rear, axle, s*.13], [seat[0], seat[1], s*.06], 0.031, frame);
    path(bike, [[.85, 1.43, .10*s], [1.01, .97, .14*s], [front, axle, .14*s]], 0.043, frame);
    for (const x of [rear, front]) {
      torus(bike, x, axle, s * 0.023, 0.764, 0.035, 0x366a61, 40, Math.PI * 0.88, 0.13);
      rod(bike, [x, axle, s*.14], [x-.58, axle+.47, s*.095], 0.014, steel, 0.014, 5);
    }
    rod(bike, [rear, axle, .16*s], [-1.48, 1.58, .2*s], 0.024, 0x485d55);
    rod(bike, [rear, axle, .16*s], [-.84, 1.58, .2*s], 0.024, 0x485d55);
  }
  rod(bike, bb, seat, 0.063, frame);
  rod(bike, bb, [.88, 1.43, 0], 0.069, frame);
  rod(bike, seat, [.81, 1.71, 0], 0.054, frame);
  rod(bike, [.91, 1.36, 0], [.77, 1.79, 0], 0.076, frame);
  for (const y of [1.46, 1.69])
    rod(bike, [.905-(y-1.36)*.32, y, 0], [.9-(y-1.36)*.32, y+.038, 0], 0.079, brass);
  rod(bike, [-.52, 1.62, 0], [-.59, 1.91, 0], 0.041, steel);
  ell(bike, -0.52, 1.9, 0, 0.305, 0.091, 0.173, leather, 1, -0.03);
  rod(bike, [.77, 1.76, 0], [.69, 2.01, 0], 0.041, steel);
  rod(bike, [.69, 2.01, 0], [.86, 2.06, 0], 0.044, steel);
  path(bike, [[.76, 2.11, -.48], [.92, 2.06, -.35], [.9, 2.04, 0], [.92, 2.06, .35], [.76, 2.11, .48]], 0.031, steel);
  for (const s of [-1, 1]) {
    rod(bike, [.84, 2.084, .42*s], [.69, 2.135, .52*s], 0.045, leather);
    path(bike, [[.84, 2.09, s*.43], [1.09, 1.99, s*.26], [1.07, 1.66, s*.12], [.94, 1.42, s*.11]], 0.011, ink, 5);
  }
  // Dynamo lamp, badge and enamel stripes.
  rod(bike, [1.03, 1.60, 0], [1.08, 1.76, 0], 0.023, steel);
  ell(bike, 1.07, 1.78, 0, 0.142, 0.11, 0.115, brass);
  rod(bike, [1.15, 1.79, 0], [1.19, 1.80, 0], 0.092, cream, 0.077, 12);
  for (let i = 0; i < 3; i++)
    rod(bike, [.23+i*.067, .964+i*.048, 0], [.265+i*.067, .989+i*.048, 0], 0.072, i === 1 ? cream : brass);
  box(bike, -1.19, 1.565, 0, 0.84, 0.058, 0.48, 0x526155);
  // Two tied postal parcels ride on the rack.
  box(bike, -1.28, 1.75, 0, 0.65, 0.31, 0.48, 0xba8151, -0.025);
  box(bike, -1.28, 1.91, 0, 0.52, 0.08, 0.41, 0xd9ae77, 0.035);
  for (const x of [-1.46, -1.13])
    box(bike, x, 1.76, 0, 0.026, 0.325, 0.489, 0xe6cea1, -0.025);
  box(bike, -1.28, 1.77, 0, 0.656, 0.324, 0.022, 0xe6cea1, -0.025);
  box(bike, -1.28, 1.814, 0.245, 0.226, 0.124, 0.009, 0xffeac2, 0.085);
  box(bike, -1.22, 1.84, 0.252, 0.041, 0.035, 0.009, 0xcb5034, 0.085);
  // A canvas mail pannier with a stitched flap and a brass envelope badge.
  box(bike, -1.18, 1.3, 0.246, 0.52, 0.42, 0.165, 0x955337, -0.045);
  box(bike, -1.18, 1.43, 0.342, 0.54, 0.176, 0.035, 0xb86e42, -0.045);
  box(bike, -1.18, 1.375, 0.365, 0.315, 0.039, 0.012, 0x975636, -0.045);
  for (const x of [-1.37, -1.0]) {
    box(bike, x, 1.34, 0.367, 0.045, 0.218, 0.021, 0x754633, -0.045);
    box(bike, x, 1.32, 0.38, 0.067, 0.047, 0.012, brass, -0.045);
  }
  box(bike, -1.18, 1.435, 0.367, 0.165, 0.09, 0.014, 0xf6d192, -0.045);
  path(bike, [[-1.257, 1.475, .377], [-1.18, 1.427, .379], [-1.104, 1.47, .377]], 0.007, 0x94633e, 4, 4);
  // Chain and sprockets share the same tangent lines.
  torus(bike, bb[0], bb[1], 0.15, 0.196, 0.023, ink, 34);
  torus(bike, rear, axle, 0.15, 0.089, 0.019, ink, 22);
  rod(bike, [rear-.005, axle+.09, .15], [bb[0]-.008, bb[1]+.195, .15], 0.014, ink);
  rod(bike, [rear+.01, axle-.09, .15], [bb[0]+.012, bb[1]-.195, .15], 0.014, ink);
  const crank = group(rider);
  crank.position.set(...bb);
  torus(crank, 0, 0, 0.17, 0.182, 0.025, brass, 30);
  for (let k = 0; k < 5; k++)
    rod(crank, [0, 0, .17], [.173*Math.cos(k*tau/5), .173*Math.sin(k*tau/5), .17], 0.022, brass);
  for (const s of [-1, 1])
    rod(crank, [0, 0, .195*s], [s*.29, 0, .235*s], 0.034, steel);
  pack(bike, true, true);
  pack(crank, true);
  // Sculpted body, folded tail, and a continuous S-curved throat.
  formX(body, [
    [-1.56, 2.46, .03, .025],
    [-1.22, 2.38, .23, .18],
    [-.92, 2.36, .385, .33],
    [-.55, 2.36, .469, .44],
    [-.21, 2.37, .439, .48],
    [.05, 2.42, .36, .43],
    [.23, 2.55, .29, .35],
    [.34, 2.67, .10, .17]
  ], cream, 16);
  for (const s of [-1, 1]) {
    const feather = ell(body, -1.17, 2.42, s * 0.17, 0.57, 0.105, 0.12, 0x35484b, 1, -0.15);
    feather.rotation.y = -s * 0.11;
    for (let k = 0; k < 4; k++) {
      ell(body, -0.93 + k * 0.115, 2.36 + k * 0.025, s * (0.34 + k * 0.014), 0.53, 0.12, 0.079, [0x394b4d, 0x6c7b79, 0x97a19a, 0xc8c9b8][k], 1, -0.2 + k * 0.07);
    }
    ell(body, -0.49, 2.47, s * 0.373, 0.63, 0.275, 0.151, 0xe4e1cd, 1, 0.12);
    for (let k = 0; k < 3; k++)
      ell(body, -0.69 + k * 0.1, 2.47 + k * 0.075, s * (0.498 - k * 0.01), 0.32, 0.047, 0.023, [0xc6cbbf, 0xd3d6c8, 0xeae6d5][k], 1, 0.2);
  }
  formY(body, [
    [2.27, -.13, .36, .35],
    [2.48, .02, .37, .35],
    [2.69, .14, .28, .285],
    [2.91, .135, .204, .24],
    [3.14, .10, .195, .216],
    [3.34, .105, .21, .23],
    [3.48, .19, .266, .27],
    [3.64, .28, .296, .27],
    [3.77, .34, .205, .20]
  ], cream, 16);
  // Slimmer forewings reach from the shoulders to the bar grips.
  for (const s of [-1, 1]) {
    const w = group(body);
    w.position.z = 0.38 * s;
    formX(w, [
      [-.42, 2.56, .10, .17],
      [-.17, 2.53, .155, .22],
      [.02, 2.42, .14, .173],
      [.23, 2.29, .12, .128],
      [.43, 2.23, .097, .097],
      [.62, 2.19, .073, .077],
      [.76, 2.15, .051, .047]
    ], 0xefe9d5, 12);
    for (let i = 0; i < 3; i++)
      ell(w, 0.56 + i * 0.075, 2.217 - i * 0.025, s * (0.066 + i * 0.015), 0.167 - i * 0.019, 0.045, 0.049, [0xb4b9aa, 0xa0afa6, 0x687d78][i], 1, -0.25);
  }
  // Silk neckerchief, knot, and two tapered ends caught by the wind.
  formY(body, [[2.85, .143, .238, .253], [2.88, .13, .247, .265], [3.015, .11, .226, .255], [3.045, .11, .214, .244]], coral, 16);
  ell(body, -0.095, 2.953, 0.008, 0.161, 0.128, 0.2, 0xb93d28);
  const streamers = [];
  for (let k = 0; k < 2; k++) {
    const r = group(body);
    r.position.set(-0.12, 2.93 - k * 0.043, (k - 0.5) * 0.1);
    formX(r, [
      [-1.03+k*.19, .055-k*.14, .025, .015],
      [-.86+k*.13, .081-k*.14, .049, .075],
      [-.62, .11-k*.16, .053, .095],
      [-.36, .015-k*.04, .058, .088],
      [-.10, -.015, .058, .068],
      [0, 0, .058, .045]
    ], k ? 0xc3472c : 0xe15834, 8);
    pack(r, true);
    streamers.push(r);
  }
  const head = group(rider);
  head.position.set(0.32, 3.61, 0);
  ell(head, 0.045, 0.027, 0, 0.422, 0.349, 0.314, cream, 2, 0.1);
  // The broad salmon pouch under a long, nearly straight upper mandible.
  formX(head, [
    [.197, -.014, .238, .043, .116],
    [.33, -.066, .270, .081, .245],
    [.52, -.119, .277, .09, .336],
    [.77, -.162, .242, .10, .311],
    [1.04, -.178, .179, .106, .218],
    [1.31, -.174, .105, .082, .103],
    [1.51, -.151, .026, .026, .027]
  ], 0xeb955b, 14);
  formX(head, [
    [.22, .008, .231, .059, .029],
    [.37, .024, .239, .068, .025],
    [.67, -.004, .205, .066, .025],
    [.98, -.048, .155, .060, .022],
    [1.28, -.088, .095, .051, .019],
    [1.5, -.115, .043, .036, .02],
    [1.55, -.16, .014, .02, .034]
  ], 0xf9b24f, 12);
  for (const s of [-1, 1]) {
    for (const k of [4, 5]) {
      const angle = k * tau / 14;
      const pleat = [
        [.33, -.066, .270, .245],
        [.52, -.119, .277, .336],
        [.77, -.162, .242, .311],
        [1.04, -.178, .179, .218],
        [1.31, -.174, .105, .103]
      ];
      path(head, pleat.map(([x, y, w, d]) => [x, y+Math.cos(angle)*d, s*(w+.003)*Math.sin(angle)]), 0.0045, 0xc97e4a, 4, 12);
    }
    path(head, [[.29, -.004, s*.23], [.61, -.036, s*.211], [1.04, -.085, s*.14], [1.47, -.128, s*.045]], 0.011, 0xa25736, 5, 12);
    ell(head, 0.424, 0.06, s * 0.18, 0.076, 0.015, 0.016, 0xb8733d, 1, -0.09);
    ell(head, 0.185, 0.09, 0.26 * s, 0.12, 0.119, 0.047, 0xe7bd71, 2);
    ell(head, 0.195, 0.092, 0.292 * s, 0.076, 0.084, 0.039, ink, 2);
    ell(head, 0.22, 0.121, 0.323 * s, 0.02, 0.021, 0.012, 0xfff6d8, 1);
  }
  // A four-panel racing cap with a contrasting centre stripe and short peak.
  formY(head, [
    [.188, .018, .389, .308],
    [.24, .006, .383, .302],
    [.35, -.02, .318, .263],
    [.428, -.038, .207, .175],
    [.457, -.047, .057, .052]
  ], 0x217a72, 16);
  formY(head, [[.178, .016, .393, .311], [.222, .008, .388, .309]], 0x254d49, 20);
  path(head, [[-.36, .239, 0], [-.25, .39, 0], [-.04, .46, 0], [.17, .41, 0], [.314, .30, 0], [.385, .23, 0]], 0.025, 0xf7dc9f, 6, 15);
  ell(head, 0.327, 0.22, 0, 0.269, 0.042, 0.255, 0x28645a, 1, 0.1);
  ell(head, -0.047, 0.463, 0, 0.046, 0.023, 0.045, 0xe4a65d, 1);
  for (const s of [-1, 1]) {
    const patch = ell(head, 0.042, 0.312, s * 0.274, 0.087, 0.058, 0.012, 0xf3dbaa, 1, 0.07);
    patch.rotation.x = -s * 0.33;
    for (let k = 0; k < 3; k++)
      box(head, 0.037 + k * 0.008, 0.328 - k * 0.014, s * (0.283 + k * 0.007), 0.088 - k * 0.021, 0.008, 0.008, 0xc15b3a, 0.09);
  }
  // Keep rigid torso geometry separate from the animated scarf ends.
  for (const r of streamers)
    body.remove(r);
  pack(body, true);
  streamers.forEach(r => body.add(r));
  pack(head, true);
  const legs = [];
  for (const s of [-1, 1]) {
    const upper = group(rider), lower = group(rider), foot = group(rider);
    rod(upper, [0, 0, 0], [0, 1, 0], 0.067, 0xc88345, 0.053);
    ell(upper, 0, 0, 0, 0.094, 0.1, 0.081, 0xe6d7b5);
    rod(lower, [0, 0, 0], [0, 1, 0], 0.047, 0xdf9b4d, 0.033);
    ell(lower, 0, 0, 0, 0.061, 0.062, 0.06, 0xc08446);
    box(foot, 0.045, -0.037, 0, 0.313, 0.063, 0.175, ink);
    const sole = formX(foot, [
      [-.095, .018, .043, .043],
      [-.015, .034, .061, .063],
      [.14, .022, .106, .043],
      [.255, .008, .126, .023],
      [.313, .006, .045, .012]
    ], 0xe69a46, 10);
    sole.rotation.z = -0.02;
    for (let t = -1; t <= 1; t++)
      rod(foot, [.059, .066, t*.03], [.278, .027, t*.111], 0.016, 0xf3b064, 0.007, 5);
    for (const g of [upper, lower, foot])
      pack(g, true);
    legs.push({
      upper,
      lower,
      foot,
      s
    });
  }
  const up = vec(0, 1, 0), dir = vec(0, 0, 0);
  function connect(bone, a, b) {
    dir.subVectors(b, a);
    bone.position.copy(a);
    bone.scale.y = dir.length();
    bone.quaternion.setFromUnitVectors(up, dir.normalize());
  }
  return function animate(phase) {
    const bob = 0.035 * Math.sin(2 * phase - 0.6);
    body.position.y = bob;
    head.position.y = 3.61 + bob + 0.011 * Math.cos(2 * phase);
    head.rotation.z = 0.022 * Math.sin(2 * phase + 0.5);
    for (let i = 0; i < 2; i++)
      streamers[i].rotation.z = 0.055 * Math.sin(phase * 2 + i * 0.9);
    crank.rotation.z = -phase;
    for (const w of wheels)
      w.rotation.z = -phase * 2.43;
    for (const {s, upper, lower, foot} of legs) {
      const x = bb[0] + s * 0.29 * Math.cos(phase), y = bb[1] - s * 0.29 * Math.sin(phase), z = s * 0.315;
      foot.position.set(x, y, z);
      foot.rotation.z = -0.12 + 0.12 * Math.sin(phase) * s;
      const hip = vec(-0.45, 2.035 + bob, z * 0.94), ankle = vec(x - 0.025, y + 0.066, z);
      const delta = ankle.clone().sub(hip), length = delta.length(), along = (0.76 ** 2 - 0.86 ** 2 + length ** 2) / (2 * length);
      const bend = Math.sqrt(Math.max(0, 0.76 ** 2 - along ** 2));
      delta.normalize();
      const knee = hip.clone().addScaledVector(delta, along).add(vec(delta.y * bend, -delta.x * bend, 0));
      connect(upper, hip, knee);
      connect(lower, knee, ankle);
    }
  };
}
