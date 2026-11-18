import * as THREE from 'three';
import { batch, box, cylinder, mesh, oval, random, rod, standard, texture, tube, v } from './forms.js';

const day = {
  sky: '#7ac6cd', horizon: '#f6e6bd', glow: '#ffdca0', sun: '#fff0ae',
  sea: '#65aeb0', seaFar: '#aed1c5', foam: '#e4eee0',
  light: '#fff0da', ambient: '#e1fbf5', ground: '#91a0af', cloud: '#fff4dd',
};
const evening = {
  sky: '#777cb0', horizon: '#ffc08d', glow: '#ff9f76', sun: '#ffe6a9',
  sea: '#4f758d', seaFar: '#b79ca7', foam: '#f7cbb7',
  light: '#ffcc9a', ambient: '#d9dbff', ground: '#8b7f9e', cloud: '#fbd4c1',
};

const colors = Object.fromEntries(Object.keys(day).map(key => [
  key, [new THREE.Color(day[key]), new THREE.Color(evening[key])],
]));

const vertexShader = `
varying vec3 worldPosition;
void main() {
  vec4 positionWorld = modelMatrix * vec4(position, 1.);
  worldPosition = positionWorld.xyz;
  gl_Position = projectionMatrix * viewMatrix * positionWorld;
}`;

function backdrop(scene) {
  const uniforms = {
    sky: { value: new THREE.Color(day.sky) },
    horizon: { value: new THREE.Color(day.horizon) },
    glow: { value: new THREE.Color(day.glow) },
    sun: { value: new THREE.Color(day.sun) },
    sunlight: { value: v(-.261, .045, -.965).normalize() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, side: THREE.BackSide, depthWrite: false, toneMapped: false,
    fragmentShader: `
varying vec3 worldPosition;
uniform vec3 sky, horizon, glow, sun, sunlight;
void main() {
  vec3 direction = normalize(worldPosition - cameraPosition);
  float altitude = max(direction.y, 0.);
  vec3 color = mix(horizon, sky, pow(smoothstep(0., .24, altitude), .47));
  float disk = distance(direction, sunlight);
  color = mix(color, glow, exp(-disk * 7.2) * .65);
  color = mix(color, sun, 1. - smoothstep(.042, .044, disk));
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(7.17, 83.77))) * 4621.731);
  gl_FragColor = vec4(color + (grain - .5) * .009, 1.);
  #include <colorspace_fragment>
}`,
  });
  const dome = mesh(scene, new THREE.SphereGeometry(90, 30, 20), material, false);
  dome.renderOrder = -5;

  const lakes = {
    sea: { value: new THREE.Color(day.sea) },
    seaFar: { value: new THREE.Color(day.seaFar) },
    foam: { value: new THREE.Color(day.foam) },
    horizon: uniforms.horizon,
    glow: uniforms.glow,
    time: { value: 0 },
  };
  const water = new THREE.ShaderMaterial({
    uniforms: lakes, vertexShader, toneMapped: false,
    fragmentShader: `
varying vec3 worldPosition;
uniform vec3 sea, seaFar, foam, horizon, glow;
uniform float time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = worldPosition.xz;
  float dist = length(cameraPosition.xz - p);
  float distanceBlend = smoothstep(8., 48., dist);
  float scallop = .5 + .5 * sin(p.x * 1.13 + p.y * 1.9 + sin(p.x * .69) + time * .65);
  vec3 color = mix(sea * .93, sea * 1.10, scallop);
  color = mix(color, seaFar, distanceBlend);
  float shore = length(vec2((p.x + .14) / 3.93, (p.y + .15) / 2.17));
  color *= mix(.81, 1., smoothstep(.83, 1.2, shore));
  float wake = smoothstep(.8, 1., sin(p.x * 2.6 + p.y * 7.2 + sin(p.x * 1.01) - time *.76));
  wake *= smoothstep(-.24, .8, cos(p.x * 2.26 - p.y * .61 + time * .53));
  vec2 cells = vec2(p.x * 1.3 + time * .08, p.y * 2.9 + sin(p.x * 1.25 + time) * .15);
  vec2 cell = floor(cells);
  vec2 ripple = fract(cells) - vec2(.5, .34 + hash(cell + 13.) * .32);
  float spark = 1. - smoothstep(.56, 1., length(ripple * vec2(2.5 + hash(cell) * 5., 38.)));
  float reflection = exp(-pow((p.x + p.y * .14) * .19, 2.)) * distanceBlend;
  color = mix(color, foam, (wake * .18 + spark * .48) * (1. - distanceBlend));
  color = mix(color, glow, reflection * (.22 + wake * .15));
  color = mix(color, horizon, smoothstep(47., 84., dist) * .985);
  gl_FragColor = vec4(color, 1.);
  #include <colorspace_fragment>
}`,
  });
  const waterPlane = mesh(scene, new THREE.PlaneGeometry(144, 144), water, false);
  waterPlane.position.y = -.604;
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.renderOrder = -3;
  return { sky: uniforms, water: lakes };
}

const islandCenter = -.35;
const rimSegments = 102;
const roadEnd = 3.33;
const roadCenter = x => -.03 * x ** 2 + .014 * x + .0076 * x ** 3;
const rim = (angle, ratio = 1) => {
  const bump = 1 + .035 * Math.sin(angle * 3 + .2) + .018 * Math.cos(angle * 7 + 1.9);
  return [3.66 * Math.cos(angle) * ratio * bump, islandCenter + 1.93 * Math.sin(angle) * ratio * bump];
};

function groundMap() {
  const sample = random(153);
  return texture((ctx, w, h) => {
    ctx.fillStyle = '#e2b582';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8800; i++) {
      const x = sample() * w;
      const y = sample() * h;
      const size = .3 + sample() * 1.6;
      ctx.fillStyle = sample() < .5 ? '#f7d6a05c' : '#a16b4f2c';
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.4, size, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, 512);
}

function roadMap() {
  const sample = random(427);
  return texture((ctx, w, h) => {
    ctx.fillStyle = '#b56e55';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8100; i++) {
      ctx.fillStyle = sample() > .48 ? '#f2b28860' : '#693e392d';
      ctx.fillRect(sample() * w, sample() * h, .5 + sample() * 2, .48 + sample() * 1.3);
    }
    for (const y of [5, h - 9]) {
      ctx.fillStyle = '#e9c792';
      ctx.fillRect(0, y, w, 4);
      ctx.fillStyle = '#985e4b';
      ctx.fillRect(0, y + 6, w, 1);
    }
  }, 1024, 128);
}

function island(scene) {
  const clay = standard('#c48865');
  const shore = standard('#d8a475');
  const base = standard('#aa6758');
  const ground = mesh(scene, new THREE.BufferGeometry(), standard('#fff', { map: groundMap() }));
  const surface = [0, -.002, islandCenter];
  const uv = [.5, .5];
  const faces = [];
  for (let i = 0; i <= rimSegments; i++) {
    const [x, z] = rim(i * Math.PI * 2 / rimSegments);
    surface.push(x, -.008 - .011 * Math.sin(i / rimSegments * Math.PI) ** 2, z);
    uv.push(x / 7.7 + .5, (z - islandCenter) / 4.2 + .5);
    if (i) faces.push(0, i + 1, i);
  }
  ground.geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface, 3));
  ground.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ground.geometry.setIndex(faces);
  ground.geometry.computeVertexNormals();
  ground.castShadow = false;

  const layers = [[1, -.009], [1.025, -.13], [.989, -.29], [1.013, -.43], [.947, -.635]];
  for (let layer = 0; layer < layers.length - 1; layer++) {
    const points = [];
    const indices = [];
    for (let i = 0; i <= rimSegments; i++) {
      const angle = 2 * Math.PI * i / rimSegments;
      for (let row = layer; row <= layer + 1; row++) {
        const [ratio, height] = layers[row];
        const [x, z] = rim(angle, ratio);
        const noise = row * (.012 * Math.sin(angle * 11 + row) + .006 * Math.cos(angle * 17 + .4));
        points.push(x, height + noise, z);
      }
      if (i) {
        const j = i * 2;
        indices.push(j - 2, j, j + 1, j - 2, j + 1, j - 1);
      }
    }
    const strata = new THREE.BufferGeometry();
    strata.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    strata.setIndex(indices);
    strata.computeVertexNormals();
    mesh(scene, strata, [shore, clay, shore, base][layer]);
  }

  const positions = [];
  const roadUV = [];
  const roadFaces = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const x = (t * 2 - 1) * roadEnd;
    const pinch = 1 - .31 * THREE.MathUtils.smoothstep(Math.abs(x), 2.61, roadEnd);
    const taper = THREE.MathUtils.smoothstep(Math.abs(x), 3.15, roadEnd);
    for (const side of [-1, 1]) {
      positions.push(x - Math.sign(x) * taper * .045, .006, roadCenter(x) + side * .64 * pinch);
      roadUV.push(t, (side + 1) / 2);
    }
    if (i) {
      const j = i * 2;
      roadFaces.push(j - 2, j - 1, j + 1, j - 2, j + 1, j);
    }
  }
  const road = new THREE.BufferGeometry();
  road.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  road.setAttribute('uv', new THREE.Float32BufferAttribute(roadUV, 2));
  road.setIndex(roadFaces);
  road.computeVertexNormals();
  mesh(scene, road, standard('#fff', { map: roadMap() })).castShadow = false;

  const marks = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(.288, .027).rotateX(-Math.PI / 2), standard('#efcfa0'), 10);
  const mark = new THREE.Object3D();
  scene.add(marks);

  const foam = new THREE.MeshBasicMaterial({
    color: '#f3edce', transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide,
  });
  const surf = [];
  const breakers = new THREE.Group();
  scene.add(breakers);
  for (let i = 0; i < 2; i++) {
    const row = new THREE.Group();
    breakers.add(row);
    for (let segment = 0; segment < 12; segment++) {
      const start = (.2 + segment) / 12 * Math.PI * 2 + i * .18;
      const arc = Array.from({ length: 9 }, (_, j) => {
        const angle = start + j / 8 * (.27 + .13 * Math.cos(segment * 6.2));
        const [x, z] = rim(angle, 1.065 + i * .065 + .008 * Math.sin(j * .6 + segment));
        return [x, -.586 - i * .006, z];
      });
      const crest = tube(row, foam, arc, i === 0 ? .015 : .009, 9, 5);
      crest.castShadow = crest.receiveShadow = false;
    }
    batch(row);
    surf.push(row);
  }

  return (revolutions, time) => {
    for (let i = 0; i < 10; i++) {
      const step = (i / 10 + revolutions / (Math.PI * 2) * .22) % 1;
      const x = (step < 0 ? step + 1 : step) * 6.62 - 3.31;
      const scale = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 3.05, 3.31);
      mark.position.set(x, .012, roadCenter(x) - .073);
      mark.rotation.y = Math.atan(.06 * x - .014 - .0228 * x ** 2);
      mark.scale.set(Math.max(.001, scale), 1, 1);
      mark.updateMatrix();
      marks.setMatrixAt(i, mark.matrix);
    }
    marks.instanceMatrix.needsUpdate = true;
    surf.forEach((row, index) => {
      const stretch = 1 + .013 * Math.sin(time * 1.2 - index * 2.0);
      row.scale.set(stretch, 1, stretch);
    });
  };
}

function lighthouse(parent) {
  const base = new THREE.Group();
  base.position.set(2.47, 0, -1.06);
  parent.add(base);
  const chalk = standard('#fff1d2');
  const coral = standard('#c45446');
  const roof = standard('#994239');
  const foundation = standard('#c8a182');
  const teal = standard('#456965');
  const illumination = standard('#ffce74', { emissive: '#ffbf58', emissiveIntensity: .27 });
  cylinder(base, foundation, 0, .056, 0, .345, .388, .115);
  cylinder(base, chalk, 0, .26, 0, .222, .268, .37);
  cylinder(base, coral, 0, .55, 0, .194, .222, .21);
  cylinder(base, chalk, 0, .775, 0, .159, .194, .24);
  cylinder(base, coral, 0, .965, 0, .139, .159, .14);
  cylinder(base, teal, 0, 1.047, 0, .222, .19, .061);
  cylinder(base, chalk, 0, 1.09, 0, .224, .224, .036);
  cylinder(base, illumination, 0, 1.20, 0, .13, .129, .182);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    rod(base, teal, v(x * .142, 1.104, z * .142), v(x * .142, 1.31, z * .142), .013);
    rod(base, teal, v(x * .215, 1.105, z * .215), v(x * .215, 1.17, z * .215), .008);
  }
  const rail = mesh(base, new THREE.TorusGeometry(.215, .009, 6, 28), teal);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 1.166;
  cylinder(base, roof, 0, 1.317, 0, .198, .214, .058);
  cylinder(base, coral, 0, 1.407, 0, .031, .209, .135);
  oval(base, roof, 0, 1.503, 0, .041, .048, .041);
  oval(base, teal, .04, .251, .231, .071, .137, .026, .05);
  box(base, foundation, .04, .113, .282, .171, .044, .12);
  return illumination;
}

function coastalDetails(scene) {
  const items = new THREE.Group();
  scene.add(items);
  const lamp = lighthouse(items);
  const sand = standard('#f0d5a6');
  const grassMaterials = ['#66886c', '#819b6c', '#a0a769'].map(color => standard(color));
  const pebbles = ['#d99d6b', '#b58b73', '#ecc999'].map(color => standard(color));
  const woods = [standard('#986749'), standard('#d19c65')];
  const blossoms = [standard('#ffffd8'), standard('#f6b850'), standard('#c86152')];
  const sample = random(20261018);
  for (let i = 0; i < 47; i++) {
    const angle = (i + sample()) * 2 * Math.PI / 47;
    const [x, z] = rim(angle, .68 + sample() * .28);
    if (Math.abs(z - roadCenter(x)) < .77 || (x > 2.1 && x < 2.82 && Math.abs(z + 1.06) < .32)) continue;
    const height = .045 + sample() * .067;
    oval(items, pebbles[i % 3], x, height * .35, z, .067 + sample() * .162, height, .05 + sample() * .11, sample() - .5);
    if (i % 3 === 0) continue;
    for (let j = 0; j < 5; j++) {
      const dx = (sample() - .5) * .22;
      const dz = (sample() - .5) * .17;
      const y = .084 + sample() ** 2 * .22;
      const blade = oval(items, grassMaterials[(i + j) % 3], x + dx, y * .52, z + dz, .020, y * .60, .021, -dx * 4.1);
      blade.rotation.x = dz * 5.1;
    }
    if (i % 4 === 1) {
      const y = .20 + sample() * .1;
      rod(items, grassMaterials[0], v(x, .01, z), v(x - .042, y, z), .011, .008, 7);
      oval(items, blossoms[1], x - .042, y, z, .029, .032, .025);
      for (let j = 0; j < 5; j++) {
        const a = j * Math.PI * 2 / 5;
        oval(items, blossoms[i % 8 === 1 ? 0 : 2], x - .042 + Math.cos(a) * .039,
          y + Math.sin(a) * .039, z, .028, .022, .018, a);
      }
    }
  }

  const sign = new THREE.Group();
  sign.position.set(-2.63, 0, -1.15);
  sign.rotation.y = .25;
  items.add(sign);
  cylinder(sign, woods[0], -.192, .304, 0, .035, .042, .61, 8);
  cylinder(sign, woods[0], .192, .304, 0, .035, .042, .61, 8);
  box(sign, woods[1], 0, .502, 0, .527, .265, .068);
  box(sign, sand, 0, .502, .038, .512, .244, .023);
  const signFace = texture((ctx, w, h) => {
    ctx.fillStyle = '#285955';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e9d9a4';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#fff0bf';
    ctx.font = 'bold 26px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('COAST ROAD', w / 2, 39);
    ctx.beginPath();
    ctx.moveTo(43, 57);
    ctx.lineTo(117, 57);
    ctx.lineTo(107, 49);
    ctx.moveTo(117, 57);
    ctx.lineTo(107, 65);
    ctx.stroke();
  }, 192, 88);
  const plaque = mesh(sign, new THREE.PlaneGeometry(.472, .216), standard('#fff', { map: signFace }));
  plaque.position.set(0, .502, .052);
  plaque.castShadow = false;

  const posts = [];
  for (let i = 0; i < 5; i++) {
    const x = -.94 + i * .44;
    const z = -1.57 + Math.abs(x) ** 2 * .12;
    cylinder(items, woods[1], x, .174, z, .044, .053, .348, 8);
    cylinder(items, sand, x, .317, z, .046, .047, .046, 8);
    posts.push([x, .257, z + .026]);
    if (i < 4) posts.push([x + .22, .20, z + .018]);
  }
  tube(items, woods[0], posts, .013, 36, 7);
  batch(items);
  return lamp;
}

function skies(scene) {
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: day.cloud });
  const shade = new THREE.MeshBasicMaterial({ color: '#e7e7d7' });
  const sample = random(639);
  const clouds = new THREE.Group();
  scene.add(clouds);
  for (let group = 0; group < 11; group++) {
    const theta = -2.1 + group * Math.PI * 2 / 11;
    const distance = 19 + sample() * 8;
    const circle = new THREE.Group();
    circle.position.set(distance * Math.cos(theta), 2.3 + sample() * 2.0, distance * Math.sin(theta));
    circle.rotation.y = -theta + Math.PI / 2;
    clouds.add(circle);
    const width = 1.7 + sample() * 1.9;
    const center = .75 + sample() * .28;
    oval(circle, shade, 0, -.12, 0, width, .18, .36);
    for (let p = 0; p < 5; p++) {
      const t = p / 4;
      oval(circle, cloudMaterial, (t - .5) * width * 1.4, Math.sin(t * Math.PI) * .21,
        0, center * (.79 + sample() * .43), .18 + .34 * Math.sin(t * Math.PI) * sample(), .3);
    }
  }
  clouds.traverse(node => { if (node.isMesh) node.castShadow = node.receiveShadow = false; });
  batch(clouds);

  const gullWhite = standard('#fff1d6');
  const gullTip = standard('#73777b');
  const gulls = Array.from({ length: 3 }, (_, i) => {
    const bird = new THREE.Group();
    const wings = [-1, 1].map(side => {
      const wing = new THREE.Group();
      oval(wing, gullWhite, -.04, .019, side * .143, .095, .022, .151);
      oval(wing, gullTip, -.102, .023, side * .254, .065, .015, .103).rotation.y = -.29 * side;
      bird.add(wing);
      return wing;
    });
    oval(bird, gullWhite, 0, 0, 0, .151, .041, .047);
    bird.scale.setScalar(.76 - i * .12);
    bird.traverse(node => { if (node.isMesh) node.castShadow = node.receiveShadow = false; });
    scene.add(bird);
    return { bird, wings };
  });
  return {
    cloudMaterial,
    shade,
    update(time) {
      clouds.rotation.y = time * .0054;
      for (const [i, { bird, wings }] of gulls.entries()) {
        const angle = -.48 + Math.sin(time * .11) * .14 - i * .073;
        bird.position.set(-3.15 + .44 * i + 1.17 * Math.sin(time * .16 + i * .24),
          3.44 + .19 * (i % 2) + .105 * Math.sin(time * .88 + i),
          -4.79 - i * 1.48 + .61 * Math.cos(time * .16));
        bird.rotation.y = angle;
        wings.forEach((wing, j) => { wing.rotation.x = (j ? 1 : -1) * .43 * Math.sin(time * 4.6 + i * 1.2); });
      }
    },
  };
}

export function createWorld(scene) {
  const { sky, water } = backdrop(scene);
  const skyObjects = skies(scene);
  const updateIsland = island(scene);
  const lamp = coastalDetails(scene);

  const fill = new THREE.HemisphereLight(day.ambient, day.ground, 1.82);
  const sun = new THREE.DirectionalLight(day.light, 2.48);
  sun.position.set(-3.8, 8.7, 5.3);
  sun.target.position.set(-.10, 1, -.15);
  sun.castShadow = true;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 720;
  sun.shadow.mapSize.set(mobile ? 1024 : 1536, mobile ? 1024 : 1536);
  Object.assign(sun.shadow.camera, { left: -5.1, right: 5.1, top: 5.0, bottom: -4.0, near: .8, far: 19 });
  sun.shadow.normalBias = .024;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 2.6;
  const bounce = new THREE.DirectionalLight('#bbebe2', .52);
  bounce.position.set(3, 3, -5);
  scene.add(fill, sun, sun.target, bounce);

  return {
    update(time, phase) {
      water.time.value = time;
      updateIsland(phase, time);
      skyObjects.update(time);
    },

    light(mix) {
      for (const [key, uniform] of Object.entries(sky)) {
        if (colors[key]) uniform.value.copy(colors[key][0]).lerp(colors[key][1], mix);
      }
      for (const key of ['sea', 'seaFar', 'foam']) {
        water[key].value.copy(colors[key][0]).lerp(colors[key][1], mix);
      }
      sky.sunlight.value.set(-.261, .045 - mix * .019, -.965).normalize();
      fill.color.copy(colors.ambient[0]).lerp(colors.ambient[1], mix);
      fill.groundColor.copy(colors.ground[0]).lerp(colors.ground[1], mix);
      sun.color.copy(colors.light[0]).lerp(colors.light[1], mix);
      sun.intensity = 2.48 - .65 * mix;
      fill.intensity = 1.82 - .29 * mix;
      lamp.emissiveIntensity = .27 + mix * .9;
      skyObjects.cloudMaterial.color.copy(colors.cloud[0]).lerp(colors.cloud[1], mix);
      skyObjects.shade.color.copy(colors.horizon[0]).lerp(colors.horizon[1], mix);
    },
  };
}
