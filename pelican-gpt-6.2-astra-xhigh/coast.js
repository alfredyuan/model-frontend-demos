import * as T from 'three';
import {
  group,
  box,
  ell,
  rod,
  path,
  faces,
  pack,
  seeded,
  tau
} from './shapes.js';
function island(parent, x, z, length, width, height, seed, colors) {
  const g = group(parent);
  g.position.set(x, -0.91, z);
  const rnd = seeded(seed), count = 23;
  const rings = [[], [], [], []];
  for (let i = 0; i < count; i++) {
    const a = tau * i / count, variation = 0.8 + rnd() * 0.21, crest = 0.78 + rnd() * 0.22;
    const px = length * Math.cos(a) * variation, pz = width * Math.sin(a) * variation;
    rings[0].push([px*1.12, -.21, pz*1.12]);
    rings[1].push([px*1.03, height*(.35+rnd()*.16), pz*1.03]);
    rings[2].push([px*.83, height*crest, pz*.83]);
    rings[3].push([px*.45, height*(1.03+rnd()*.12), pz*.45]);
  }
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    for (let k = 0; k < 3; k++) {
      const palette = colors[k], c = palette[Math.floor(rnd() * palette.length)];
      faces(g, [...rings[k][i], ...rings[k+1][j], ...rings[k][j], ...rings[k][i], ...rings[k+1][i], ...rings[k+1][j]], c);
    }
    faces(g, [...rings[3][i], 0, height*1.13, 0, ...rings[3][j]], colors[2][0]);
  }
  return g;
}
function grass(g, x, y, z, size, rnd) {
  const colors = [0x81985e, 0xa1a66d, 0x788c60, 0xc4b880, 0x697f55];
  for (let j = 0; j < 7; j++) {
    const a = tau * rnd(), d = size * (0.15 + rnd() * 0.52), h = size * (0.5 + rnd() * 0.7), r = 0.045 * size;
    const bx = x + Math.cos(a) * size * 0.16, bz = z + Math.sin(a) * size * 0.16;
    faces(g, [bx-r, y, bz+r*.5, bx+r, y, bz-r*.5, bx+Math.cos(a)*d, y+h, bz+Math.sin(a)*d], colors[j % 5]);
  }
}
function pine(g, x, y, z, s, rnd) {
  rod(g, [x, y, z], [x+s*.10, y+s*.94, z], s * 0.056, 0x786d52, s * 0.032);
  for (let i = 0; i < 4; i++) {
    const a = i * 2.12, dx = Math.cos(a) * s * 0.28, dz = Math.sin(a) * s * 0.21;
    rod(g, [x, y+s*.42, z], [x+dx, y+s*(.75+i*.1), z+dz], s * 0.036, 0x786d52, s * 0.015);
    ell(g, x + dx, y + s * (0.8 + i * 0.1), z + dz, s * (0.48 + rnd() * 0.13), s * 0.22, s * 0.42, [0x557b69, 0x688774, 0x73927a, 0x73937d][i]);
  }
}
function lighthouse(g) {
  const stone = 0xffe7bb, red = 0xc7593f, rail = 0x455d56;
  // A small keeper's cottage next to the striped coastal light.
  box(g, -0.99, 0.31, 0.26, 1.12, 0.6, 0.73, stone);
  const roof = [[-1.65, .61, -.19], [-.34, .61, -.19], [-.34, .61, .72], [-1.65, .61, .72], [-1.65, .96, .26], [-.34, .96, .26]];
  for (const [inds, col] of [[[0, 1, 5, 0, 5, 4], 0xb66448], [[3, 4, 5, 3, 5, 2], 0xc97955], [[0, 4, 3, 1, 2, 5], stone]])
    faces(g, inds.flatMap(i => roof[i]), col);
  box(g, -0.9, 0.25, 0.63, 0.19, 0.48, 0.025, 0x53776f);
  box(g, -1.32, 0.37, 0.64, 0.21, 0.19, 0.018, 0x526e67);
  box(g, -1.4, 0.94, 0.04, 0.17, 0.4, 0.16, 0xb96e53);
  const layer = (lo, hi, rb, rt, c) => rod(g, [0, lo, 0], [0, hi, 0], rb, c, rt, 12);
  layer(0, 0.16, 0.62, 0.58, 0xb8b79b);
  layer(0.16, 1.11, 0.47, 0.395, stone);
  layer(1.11, 1.66, 0.395, 0.35, red);
  layer(1.66, 2.38, 0.35, 0.3, stone);
  layer(2.38, 2.5, 0.43, 0.46, rail);
  layer(2.5, 2.94, 0.285, 0.285, 0xf5cf83);
  for (let i = 0; i < 8; i++) {
    const a = tau * i / 8;
    rod(g, [Math.sin(a)*.29, 2.49, Math.cos(a)*.29], [Math.sin(a)*.29, 2.96, Math.cos(a)*.29], 0.023, rail);
    const b = a + tau / 8, pp = k => [Math.sin(k)*.43, 2.72, Math.cos(k)*.43];
    rod(g, [.43*Math.sin(a), 2.48, .43*Math.cos(a)], pp(a), 0.015, rail);
    rod(g, pp(a), pp(b), 0.017, rail);
  }
  layer(2.94, 3.01, 0.36, 0.39, red);
  layer(3.01, 3.27, 0.4, 0.055, red);
  layer(3.27, 3.43, 0.04, 0.013, rail);
  for (const h of [.62, 1.91])
    box(g, 0, h, h > 0.9 ? 0.325 : 0.445, 0.122, 0.221, 0.026, 0x5b766d);
}
function sloop(parent, x, z, size, color) {
  const g = group(parent);
  g.position.set(x, -0.86, z);
  g.scale.setScalar(size);
  const hull = [-1.03, .17, 0, -.60, -.035, .19, .66, -.02, .17, -1.03, .17, 0, .66, -.02, .17, .99, .20, 0];
  faces(g, hull, color);
  faces(g, hull.map((v, i) => i % 3 === 2 ? -v : v), color);
  box(g, 0, 0.108, 0, 1.64, 0.13, 0.24, 0xe8d8b3);
  rod(g, [.10, .16, 0], [.10, 1.94, 0], 0.016, 0x756f58, 0.009);
  faces(g, [.055, 1.84, .01, -.87, .35, .01, .055, .28, .08], 0xfff2cf);
  faces(g, [.165, 1.64, 0, .195, .34, .02, .84, .37, .02], 0xf3c18b);
  faces(g, [.10, 1.93, 0, .10, 1.78, 0, -.17, 1.875, 0], 0xc66449);
  for (let k = 0; k < 3; k++) {
    const z = (k - 1) * 0.22;
    faces(g, [
      -1.76 - k * 0.24,
      -0.056,
      z,
      -0.61,
      -0.056,
      z + 0.043,
      -0.13,
      -0.056,
      z + 0.014,
      -0.61,
      -0.056,
      z + 0.043,
      -1.76 - k * 0.24,
      -0.056,
      z,
      -1,
      -0.056,
      z + 0.003
    ], 0xc3dbce);
  }
  pack(g);
  return g;
}
export function buildCoast(scene) {
  const rnd = seeded(718), world = group(scene);
  const water = group(world);
  const depths = [-239, -99, -67, -45, -34, -25, -19, -14, -10, -7, -4, -1, 4, 10, 22, 52, 239];
  for (let z = 0; z < depths.length - 1; z++) {
    for (let x = -252; x < 252; x += 12) {
      const near = depths[z + 1], far = depths[z], y = -0.93;
      const tone = near < -25 ? 0x74b5b6 : 0x57a6ae;
      faces(water, [x, y, far, x, y, near, x+12, y, near, x, y, far, x+12, y, near, x+12, y, far], tone);
    }
  }
  // Small horizontal facets make wind ripples visible all the way to shore.
  const tones = [0x87c3be, 0x99cfc5, 0x5ca7ac, 0xaad9cd, 0x75b9b8, 0xc1e2d3];
  for (let i = 0; i < 680; i++) {
    const x = (rnd() - 0.5) * 121, z = -1 - rnd() * 82, y = -0.919 + rnd() * 0.016, l = 0.16 + rnd() ** 2 * 2.2, w = 0.025 + rnd() * 0.11;
    faces(water, [x-l, y, z, x, y, z+w, x+l, y, z+w*.1, x-l, y, z, x+l, y, z+w*.1, x+l*.2, y, z-w], tones[i % tones.length]);
  }
  pack(water);
  const far = group(world);
  for (let k = 0; k < 2; k++) {
    const z = -58 + k * 20, base = -0.97;
    const points = [];
    for (let i = 0; i <= 70; i++) {
      const x = -140 + i * 4;
      const ridge = 0.48 + 0.35 * Math.sin(x * 0.064 + k * 4) + 0.17 * Math.cos(x * 0.177 + k);
      points.push([x, base+Math.max(.03, ridge**2*(k?4.5:7.4)+rnd()*.65), z-rnd()*2.5]);
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], c = k ? [0x6f9b96, 0x83a69c, 0x7a9f97] : [0xa1bcb4, 0xa7c4bb, 0xb2c9be];
      const foot = [a[0]-2.2, base, a[2]+2.6], nextFoot = [b[0]-2.2, base, b[2]+2.6];
      const mid = [(a[0]+b[0])*.5-.75, base+(a[1]+b[1]-2*base)*.22, (a[2]+b[2])*.5+1.1];
      faces(far, [...foot, ...a, ...mid, ...mid, ...b, ...nextFoot], c[(i + 1) % 3]);
      faces(far, [...a, ...b, ...mid], c[i % 3]);
      faces(far, [...foot, ...mid, ...nextFoot], c[2]);
    }
  }
  pack(far);
  const islet = group(world), land = island(islet, 0, 0, 4.25, 2.02, 1.17, 169, [[0x7c918b, 0x8e9e90], [0xb1b3a2, 0xaaa993, 0x9d9a84], [0xa3ab80, 0xb0b78d, 0x99a981]]);
  const tower = group(land);
  tower.position.set(0.53, 1.28, 0);
  lighthouse(tower);
  pine(land, -1.87, 1.15, 0.21, 0.82, rnd);
  pine(land, 2.11, 1.1, -0.18, 0.75, rnd);
  for (let i = 0; i < 21; i++) {
    const a = tau * rnd(), px = Math.cos(a) * 4.18, pz = Math.sin(a) * 1.97;
    ell(land, px, 0.19 + rnd() * 0.14, pz, 0.23 + rnd() * 0.42, 0.21 + rnd() * 0.23, 0.32 + rnd() * 0.44, [0x88978d, 0x9caa9a, 0xa7afa0][i % 3], 0);
  }
  // Broken foam lines trace the base of the rocky point.
  for (let i = 0; i < 32; i++) {
    const a = rnd() * tau, px = Math.cos(a) * (4.15 + rnd() * 0.47), pz = Math.sin(a) * (2.08 + rnd() * 0.42);
    const l = 0.24 + rnd() * 0.78;
    faces(land, [px-l, .016, pz, px, .016, pz+.06, px+l, .016, pz+.019, px-l, .016, pz, px+l, .016, pz+.019, px+.1, .016, pz-.048], i % 4 ? 0xa8cec0 : 0xe4e7ce);
  }
  pack(islet);
  const point = group(world);
  const rock = island(point, 0, 0, 6.4, 2.2, 0.93, 441, [[0x718e89, 0x7f9a93], [0xa0a99a, 0x99a28f], [0x899e81, 0x91a689]]);
  for (const [x, s, z] of [[-2.3, .95, 0], [-1.5, 1.28, -.45], [-.95, .72, .5], [1.3, .85, -.3], [2.1, .56, .25]])
    pine(rock, x, 1.02, z, s, rnd);
  pack(point);
  const boat = sloop(world, -5, -10, 1.15, 0x617b78);
  const boat2 = sloop(world, -10, -23, 0.72, 0xa1674e);
  const skyObjects = group(world);
  // Long banks of pale, faceted maritime cloud.
  function cloud(x, y, z, s) {
    const cloudGroup = group(skyObjects);
    cloudGroup.position.set(x, y, z);
    cloudGroup.scale.setScalar(s);
    const outline = [
      [-2.9, 0],
      [-2.5, .12],
      [-1.85, .14],
      [-1.64, .36],
      [-1.35, .45],
      [-.99, .40],
      [-.77, .69],
      [-.29, .89],
      [.21, .88],
      [.62, .64],
      [.75, .45],
      [1.14, .42],
      [1.53, .25],
      [1.64, .15],
      [2.41, .11],
      [2.80, -.016],
      [1.85, -.09],
      [-1.68, -.09]
    ];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      faces(cloudGroup, [0, .13, 0, a[0], a[1], 0, b[0], b[1], 0], i > 14 ? 0xecede1 : 0xfffae8);
    }
  }
  cloud(-17, 7.1, -31, 1.6);
  cloud(-7.2, 7.7, -36, 1.3);
  cloud(4.5, 8, -32, 1.08);
  cloud(15.7, 7.2, -36, 2.1);
  cloud(25, 9.1, -45, 1.6);
  cloud(-22, 5.1, -30, 1);
  pack(skyObjects);
  const gulls = group(world);
  for (const [x, y, z, s, tilt] of [
      [-4.8, 4.34, -11, .42, -.1],
      [-5.7, 4.62, -12, .32, .12],
      [4.5, 5.75, -17, .49, -.15],
      [6.05, 5.4, -17, .32, .21],
      [7.0, 5.82, -17, .23, -.06]
    ]) {
    const g = group(gulls);
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    g.rotation.z = tilt;
    for (const sign of [-1, 1])
      faces(g, [0, 0, 0, sign*.37, .29, .018, sign*.8, .19, 0, 0, 0, 0, sign*.8, .19, 0, sign*.36, .16, -.05], 0x527a77);
  }
  pack(gulls);
  // A continuous boardwalk. Repeated sections carry their own planks,
  // railings, rope, pebbles and tufts, then wrap beyond the camera.
  const segment = 5.4, chunkGeometries = [];
  for (let variant = 0; variant < 3; variant++) {
    const template = group();
    box(template, segment / 2, -0.46, 3, segment, 0.73, 10, 0xc5b183);
    const woods = [0xd7af7d, 0xe0b988, 0xd4ab7b, 0xe5c193, 0xdfb888, 0xddba8c, 0xdcb687, 0xe3bd8d];
    for (let i = 0; i < 18; i++) {
      const width = segment / 18, x = (i + 0.5) * width;
      box(template, x, -0.074, 0, width - 0.009, 0.142, 3.34, woods[Math.floor(rnd() * woods.length)]);
      for (const z of [-1.43, 1.43])
        ell(template, x - 0.052, 0.001, z, 0.013, 0.003, 0.013, 0x9c8666, 0);
      if (i % 2 === 0) {
        const z = (rnd() - 0.5) * 2.2, len = 0.16 + rnd() * 0.64;
        faces(template, [
          x - 0.072,
          0.0005,
          z - len,
          x - 0.057,
          0.0005,
          z,
          x - 0.066,
          0.0005,
          z + len,
          x - 0.072,
          0.0005,
          z - len,
          x - 0.066,
          0.0005,
          z + len,
          x - 0.081,
          0.0005,
          z
        ], 0xc69f74);
      }
    }
    for (const z of [-1.76, 1.78]) {
      box(template, segment / 2, -0.109, z, segment, 0.16, 0.2, 0xc19d70);
    }
    const z = -1.86;
    for (const x of [.4, 3.1]) {
      box(template, x, 0.32, z, 0.145, 0.85, 0.15, 0xc3a579);
      box(template, x, 0.74, z, 0.173, 0.073, 0.18, 0xe4c99c);
      box(template, x, 0.555, z, 0.153, 0.041, 0.159, 0x8c8166);
      const next = x + 2.7;
      path(template, [[x, .57, z], [x+.66, .44, z], [x+1.35, .40, z], [next-.65, .445, z], [next, .57, z]], 0.027, 0x9d8e6b, 5, 9);
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * segment, z = (i % 3 === 0 ? 1 : -1) * (1.9 + rnd() * 0.31);
      grass(template, x, -0.075, z, 0.18 + rnd() * 0.31, rnd);
      if (i % 4 === 0) {
        for (let k = 0; k < 3; k++) {
          const dx = (rnd() - 0.5) * 0.19, dz = (rnd() - 0.5) * 0.11, top = 0.14 + rnd() * 0.13;
          rod(template, [x, -.035, z], [x+dx, top, z+dz], 0.009, 0x718352, 0.005, 4);
          ell(template, x + dx, top, z + dz, 0.042, 0.027, 0.039, k === 1 ? 0xffcf62 : 0xf6be57, 0);
        }
      }
      if (i % 3 === 1)
        ell(template, x, -0.012, z, 0.14 + rnd() * 0.2, 0.09 + rnd() * 0.12, 0.13 + rnd() * 0.15, 0xa7a48a, 0);
    }
    const m = pack(template, false, true);
    chunkGeometries.push(m);
  }
  const chunks = [];
  const n = 15;
  for (let i = 0; i < n; i++) {
    const source = chunkGeometries[i % 3], m = new T.Mesh(source.geometry, source.material);
    m.receiveShadow = true;
    world.add(m);
    chunks.push(m);
  }
  return {
    place(fractionWidth, azimuth, camDistance, aimX, center = 0.6) {
      // Position the landmark on the horizon at all postcard aspect ratios.
      const rightAt = (pct, z) => aimX + ((pct - center) * fractionWidth * (camDistance - z) / camDistance + Math.sin(azimuth) * z) / Math.cos(azimuth);
      const isMobile = fractionWidth < 8.7;
      islet.position.set(rightAt(isMobile ? 0.88 : 0.879, -13), 0, -13);
      islet.scale.setScalar(isMobile ? 0.71 : 1.06);
      islet.position.y = -0.91 * (1 - islet.scale.y);
      point.position.set(rightAt(-0.095, -22), 0, -22);
      boat.position.x = rightAt(isMobile ? 0.17 : 0.225, -9);
      boat.position.z = -9;
      boat.scale.setScalar(isMobile ? 0.68 : 1);
      boat2.position.x = rightAt(0.095, -21);
    },
    tick(distance, time) {
      const offset = (distance % (n * segment) + n * segment) % (n * segment);
      for (let i = 0; i < n; i++)
        chunks[i].position.x = (i * segment - offset + n * segment) % (n * segment) - Math.floor(n / 2) * segment;
      boat.rotation.z = Math.sin(time * 0.85) * 0.032;
      boat2.rotation.z = Math.sin(time * 0.72 + 0.8) * 0.026;
      gulls.position.x = 0.42 * Math.sin(time * 0.21);
      gulls.position.y = 0.1 * Math.sin(time * 0.64);
    }
  };
}
