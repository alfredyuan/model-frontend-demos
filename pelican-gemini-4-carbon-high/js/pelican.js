import * as THREE from 'three';

/**
 * Expressive 3D Pelican Cyclist with:
 * - Analytical twist-free Two-Bone 3D IK for both legs (hip -> knee -> webbed foot on pedal)
 * - Analytical twist-free Two-Bone 3D IK for both feathered wings (shoulder -> elbow -> handlebar grips)
 * - Real-time vertex-deformed elastic gular throat pouch with spring-damper jiggle & fish-catch bulge
 * - Articulated S-curve neck, gimbaled head stabilization, blinking eyes, sliding aviator goggles,
 *   and a multi-segment wind-rippling coastal scarf!
 */

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();

/**
 * Exact 3D two-bone analytical IK solver returning joint world/local position `outJoint`
 * and clamped end effector `outEnd`.
 */
function solveTwoBoneIK(rootPos, targetPos, len1, len2, poleDir, outJoint, outEnd) {
  _v1.subVectors(targetPos, rootPos);
  const rawDist = _v1.length();
  if (rawDist < 1e-5) {
    _u.set(0, -1, 0);
  } else {
    _u.copy(_v1).divideScalar(rawDist);
  }

  const minReach = Math.abs(len1 - len2) + 0.015;
  const maxReach = (len1 + len2) * 0.996;
  const r = THREE.MathUtils.clamp(rawDist, minReach, maxReach);

  outEnd.copy(rootPos).addScaledVector(_u, r);

  const cosAlpha = THREE.MathUtils.clamp(
    (len1 * len1 + r * r - len2 * len2) / (2 * len1 * r),
    -1,
    1
  );
  const x = len1 * cosAlpha;
  const h = len1 * Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Gram-Schmidt orthogonalize poleDir against _u
  const dotPU = poleDir.dot(_u);
  _v.copy(poleDir).addScaledVector(_u, -dotPU);
  if (_v.lengthSq() < 1e-6) {
    _v.set(1, 0, 0).addScaledVector(_u, -_u.x);
  }
  _v.normalize();

  outJoint.copy(rootPos).addScaledVector(_u, x).addScaledVector(_v, h);
}

/**
 * Orient `obj` at `startPos` so its local +Y points along `(endPos - startPos)`,
 * local +X aligns in the bend plane (`planeNormal x +Y`), and local +Z = `planeNormal`.
 * Guarantees zero twist / gimbal flip!
 */
function orientBoneSegment(obj, startPos, endPos, planeNormal) {
  _v1.subVectors(endPos, startPos);
  const len = _v1.length();
  if (len < 1e-5) return;
  const yAxis = _v1.divideScalar(len); // along bone
  _w.copy(planeNormal).normalize();
  // Ensure orthogonal Z
  _w.addScaledVector(yAxis, -_w.dot(yAxis)).normalize();
  _v2.crossVectors(yAxis, _w).normalize(); // X axis in bend plane

  _mat4.makeBasis(_v2, yAxis, _w);
  obj.position.copy(startPos);
  obj.quaternion.setFromRotationMatrix(_mat4);
}

/**
 * Parametric deformable Gular Throat Pouch geometry
 * u in [0..1] along beak length (0 = throat base, 1 = near beak tip)
 * v in [0..1] across jaw width (0 = right jaw rail +Z, 0.5 = bottom pouch keel, 1 = left jaw rail -Z)
 */
function createGularPouchGeometry(uSegs = 22, vSegs = 16) {
  const geo = new THREE.BufferGeometry();
  const vertCount = (uSegs + 1) * (vSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const baseData = new Float32Array(vertCount * 2); // store (u, v)
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  let ptr = 0;
  for (let iu = 0; iu <= uSegs; iu++) {
    const u = iu / uSegs;
    for (let iv = 0; iv <= vSegs; iv++) {
      const v = iv / vSegs;
      baseData[ptr * 2] = u;
      baseData[ptr * 2 + 1] = v;
      uvs[ptr * 2] = u;
      uvs[ptr * 2 + 1] = v;
      ptr++;
    }
  }

  for (let iu = 0; iu < uSegs; iu++) {
    for (let iv = 0; iv < vSegs; iv++) {
      const a = iu * (vSegs + 1) + iv;
      const b = (iu + 1) * (vSegs + 1) + iv;
      const c = (iu + 1) * (vSegs + 1) + (iv + 1);
      const d = iu * (vSegs + 1) + (iv + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.userData = { baseData, uSegs, vSegs };
  return geo;
}

function updateGularPouchVertices(geo, state) {
  const posAttr = geo.attributes.position;
  const arr = posAttr.array;
  const { baseData } = geo.userData;
  const count = posAttr.count;

  const beakLen = 0.355;
  const jawOpenDrop = state.jawOpen * 0.085;

  for (let i = 0; i < count; i++) {
    const u = baseData[i * 2];       // 0 (throat) -> 1 (tip)
    const v = baseData[i * 2 + 1];   // 0 (+Z right rail) -> 0.5 (bottom belly) -> 1 (-Z left rail)

    const theta = v * Math.PI;       // 0 -> pi
    const across = Math.cos(theta);  // +1 -> -1
    const depthProfile = Math.sin(theta); // 0 at jaw rails, 1 at pouch bottom

    // Jaw width narrows cleanly toward beak tip
    const halfWidth = 0.056 * Math.pow(1 - u * 0.86, 0.68) + 0.005;

    // Classic pelican gular pouch silhouette: deepest around u = 0.34, tapering smoothly to tip
    const longitudinalSag = Math.sin(Math.pow(u, 0.72) * Math.PI);
    const rearThroatDrop = (1 - u) * 0.052;

    // Fish bulge wave traveling from mouth toward throat!
    const bulgeDist = (u - state.fishU) / 0.24;
    const fishFactor = state.fishBulge * Math.exp(-bulgeDist * bulgeDist);

    const totalDepth =
      (0.118 * longitudinalSag + rearThroatDrop + state.pouchBounce + fishFactor * 0.085 + jawOpenDrop * (0.4 + 0.6 * longitudinalSag)) *
      depthProfile;

    // Subtle longitudinal throat pleats
    const pleat = Math.sin(theta * 9) * 0.0022 * depthProfile;

    // Rim line along lower mandible rami
    const rimY = -u * jawOpenDrop - (1 - u) * 0.012;
    const x = u * beakLen;
    const y = rimY - totalDepth + pleat;
    const z =
      across * (halfWidth + fishFactor * 0.032 * depthProfile) +
      state.pouchSwayZ * depthProfile * longitudinalSag;

    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();
}

export function createPelican(textures) {
  const root = new THREE.Group();
  root.name = 'PelicanRoot';

  // =========================================================================
  // MATERIALS
  // =========================================================================
  const plumageWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xfbf8f1,
    roughness: 0.62,
    metalness: 0.02
  });

  const plumageCreamMat = new THREE.MeshStandardMaterial({
    color: 0xf4ebd4,
    roughness: 0.64,
    metalness: 0.02
  });

  const primaryDarkMat = new THREE.MeshStandardMaterial({
    color: 0x29323d, // Classic pelican slate-black flight feather tips!
    roughness: 0.56,
    metalness: 0.05
  });

  const beakUpperMat = new THREE.MeshStandardMaterial({
    color: 0xffb838,
    roughness: 0.36,
    metalness: 0.06
  });

  const beakNailMat = new THREE.MeshStandardMaterial({
    color: 0xf0543e, // Iconic coral-red hooked tip!
    roughness: 0.28,
    metalness: 0.08
  });

  const pouchMat = new THREE.MeshStandardMaterial({
    color: 0xff8524,
    emissive: 0x6b2200,
    emissiveIntensity: 0.16,
    roughness: 0.44,
    metalness: 0.03,
    side: THREE.DoubleSide
  });

  const orangeFootMat = new THREE.MeshStandardMaterial({
    color: 0xf76b1c,
    roughness: 0.48,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  const eyeRingMat = new THREE.MeshStandardMaterial({
    color: 0xffd15c,
    roughness: 0.5
  });

  const eyeDarkMat = new THREE.MeshStandardMaterial({
    color: 0x11161d,
    roughness: 0.08,
    metalness: 0.25
  });

  const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const scarfMat = new THREE.MeshStandardMaterial({
    map: textures.scarfMap,
    roughness: 0.68,
    side: THREE.DoubleSide
  });

  const brassGoggleMat = new THREE.MeshStandardMaterial({
    color: 0xebb142,
    roughness: 0.22,
    metalness: 0.88
  });

  const lensGoggleMat = new THREE.MeshStandardMaterial({
    color: 0x4cc9f0,
    emissive: 0x155d78,
    emissiveIntensity: 0.35,
    roughness: 0.1,
    metalness: 0.55
  });

  const strapLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x5c3218,
    roughness: 0.65
  });

  // =========================================================================
  // 1. TORSO, FEATHER SCALLOPS & TAIL FAN (Anchored to Bicycle Saddle)
  // =========================================================================
  const pelvisGroup = new THREE.Group();
  pelvisGroup.name = 'PelvisGroup';
  root.add(pelvisGroup);

  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'TorsoGroup';
  pelvisGroup.add(torsoGroup);

  // Main plump ovoid pelican body
  const bodyGeo = new THREE.SphereGeometry(0.185, 26, 22);
  bodyGeo.scale(1.42, 0.96, 0.92);
  const bodyMesh = new THREE.Mesh(bodyGeo, plumageWhiteMat);
  bodyMesh.position.set(0.10, 0.135, 0);
  bodyMesh.rotation.z = 0.32; // natural chest-up / forward cycling posture
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.interactType = 'pelican';
  torsoGroup.add(bodyMesh);

  // Soft warm cream breast puff
  const chestGeo = new THREE.SphereGeometry(0.145, 20, 16);
  chestGeo.scale(1.12, 1.05, 0.88);
  const chestMesh = new THREE.Mesh(chestGeo, plumageCreamMat);
  chestMesh.position.set(0.22, 0.195, 0);
  chestMesh.castShadow = true;
  chestMesh.userData.interactType = 'pelican';
  torsoGroup.add(chestMesh);

  // Decorative overlapping dorsal feather scallops
  for (let r = 0; r < 3; r++) {
    for (let c = -1; c <= 1; c++) {
      const feather = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), plumageCreamMat);
      feather.scale.set(1.7, 0.28, 0.85);
      feather.position.set(0.06 - r * 0.068, 0.255 - r * 0.025 - Math.abs(c) * 0.015, c * 0.065);
      feather.rotation.set(c * 0.22, -c * 0.15, 0.26);
      feather.userData.interactType = 'pelican';
      torsoGroup.add(feather);
    }
  }

  // Sculpted Tail Feather Fan sweeping behind the saddle
  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.115, 0.088, 0);
  torsoGroup.add(tailPivot);

  for (let t = -3; t <= 3; t++) {
    const tf = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.165, 8), Math.abs(t) === 3 ? plumageCreamMat : plumageWhiteMat);
    tf.scale.set(0.32, 1, 1.15);
    tf.rotation.z = Math.PI * 0.56;
    tf.rotation.y = t * 0.14;
    tf.position.set(-0.065, 0.01 + Math.abs(t) * 0.003, t * 0.022);
    tf.castShadow = true;
    tailPivot.add(tf);
  }

  // Feathered hip "drumstick" puffs & Hip Socket Anchors
  const leftHipAnchor = new THREE.Object3D();
  const rightHipAnchor = new THREE.Object3D();
  leftHipAnchor.position.set(0.075, -0.055, -0.098);
  rightHipAnchor.position.set(0.075, -0.055, 0.098);
  torsoGroup.add(leftHipAnchor, rightHipAnchor);

  for (const side of [-1, 1]) {
    const hipPuff = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), plumageWhiteMat);
    hipPuff.scale.set(1.15, 1.25, 0.88);
    hipPuff.position.set(0.065, -0.02, side * 0.096);
    hipPuff.castShadow = true;
    torsoGroup.add(hipPuff);
  }

  // Left & Right Shoulder Socket Anchors on upper chest
  const leftShoulderAnchor = new THREE.Object3D();
  const rightShoulderAnchor = new THREE.Object3D();
  leftShoulderAnchor.position.set(0.215, 0.235, -0.142);
  rightShoulderAnchor.position.set(0.215, 0.235, 0.142);
  torsoGroup.add(leftShoulderAnchor, rightShoulderAnchor);

  // =========================================================================
  // 2. GRACEFUL S-CURVE NECK + WIND-STREAMING COASTAL SCARF
  // =========================================================================
  const neckBase = new THREE.Group();
  neckBase.position.set(0.255, 0.275, 0);
  torsoGroup.add(neckBase);

  // Snug knitted scarf collar around neck base + 2 articulated streaming tails!
  const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.024, 12, 24), scarfMat);
  scarfCollar.rotation.x = Math.PI * 0.5;
  scarfCollar.rotation.y = -0.25;
  scarfCollar.position.set(0.005, 0.025, 0);
  scarfCollar.castShadow = true;
  neckBase.add(scarfCollar);

  const scarfKnot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), scarfMat);
  scarfKnot.position.set(-0.055, 0.015, 0.045);
  neckBase.add(scarfKnot);

  function buildScarfTail(lengthSegs, segLen, width, zOffset) {
    const segs = [];
    let parent = neckBase;
    for (let i = 0; i < lengthSegs; i++) {
      const pivot = new THREE.Group();
      if (i === 0) {
        pivot.position.set(-0.062, 0.012, zOffset);
      } else {
        pivot.position.set(-segLen, 0, 0);
      }
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(segLen * 1.08, width * (1 - i * 0.05)),
        scarfMat
      );
      plate.rotation.x = Math.PI * 0.38;
      plate.position.set(-segLen * 0.5, 0, 0);
      plate.castShadow = true;
      pivot.add(plate);
      parent.add(pivot);
      segs.push(pivot);
      parent = pivot;
    }
    return segs;
  }

  const scarfTailMain = buildScarfTail(7, 0.058, 0.048, 0.050);
  const scarfTailShort = buildScarfTail(5, 0.048, 0.038, 0.025);

  // 5 Overlapping S-Curve Neck Segments (smooth continuous plumage!)
  const neckRestOffsets = [
    new THREE.Vector3(0.006, 0.044, 0),
    new THREE.Vector3(-0.022, 0.056, 0),
    new THREE.Vector3(-0.016, 0.058, 0),
    new THREE.Vector3(0.015, 0.055, 0),
    new THREE.Vector3(0.034, 0.048, 0)
  ];
  const neckRadii = [0.068, 0.061, 0.056, 0.053, 0.054];
  const neckJoints = [];
  let neckParent = neckBase;

  for (let i = 0; i < neckRestOffsets.length; i++) {
    const j = new THREE.Group();
    j.position.copy(neckRestOffsets[i]);
    const segMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(neckRadii[i], 0.052, 8, 16),
      plumageWhiteMat
    );
    segMesh.position.y = -0.024;
    segMesh.castShadow = true;
    segMesh.userData.interactType = 'pelican';
    j.add(segMesh);
    neckParent.add(j);
    neckJoints.push(j);
    neckParent = j;
  }

  // =========================================================================
  // 3. HEAD, CREST FEATHERS, BLINKING EYES, GOGGLES, GIANT BEAK & GULAR POUCH
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.name = 'PelicanHead';
  headGroup.position.set(0.025, 0.038, 0);
  neckParent.add(headGroup);

  // First-person POV camera mount right above pelican's brow looking past its giant beak!
  const povCameraAnchor = new THREE.Object3D();
  povCameraAnchor.position.set(-0.02, 0.125, 0);
  headGroup.add(povCameraAnchor);

  const povLookAnchor = new THREE.Object3D();
  povLookAnchor.position.set(1.8, -0.18, 0);
  headGroup.add(povLookAnchor);

  // Feathered cranium
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.088, 20, 18), plumageWhiteMat);
  skull.scale.set(1.16, 0.98, 0.92);
  skull.castShadow = true;
  skull.userData.interactType = 'pelican';
  headGroup.add(skull);

  // Jaunty backward-swept pelican crest feathers!
  const crestGroup = new THREE.Group();
  crestGroup.position.set(-0.055, 0.062, 0);
  headGroup.add(crestGroup);

  const crestFeathers = [];
  for (let c = 0; c < 4; c++) {
    const cf = new THREE.Mesh(new THREE.ConeGeometry(0.017 - c * 0.002, 0.095 - c * 0.008, 7), plumageCreamMat);
    cf.scale.set(1, 1, 0.5);
    cf.geometry.translate(0, 0.045, 0);
    cf.rotation.z = THREE.MathUtils.degToRad(62 + c * 11);
    cf.rotation.y = (c % 2 === 0 ? 1 : -1) * 0.08;
    cf.position.set(-c * 0.012, -c * 0.010, 0);
    crestGroup.add(cf);
    crestFeathers.push(cf);
  }

  // Eyes + Golden Orbital Patch + Blinking Eyelids
  const eyelids = [];
  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(0.048, 0.026, side * 0.068);
    headGroup.add(eyeSocket);

    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), eyeRingMat);
    patch.scale.set(1.15, 0.95, 0.45);
    eyeSocket.add(patch);

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 14, 12), eyeDarkMat);
    eyeball.position.z = side * 0.009;
    eyeSocket.add(eyeball);

    // Dual crisp specular catchlights for Pixar life!
    const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 8), catchlightMat);
    glint1.position.set(0.007, 0.007, side * 0.022);
    eyeSocket.add(glint1);

    const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), catchlightMat);
    glint2.position.set(-0.005, -0.004, side * 0.022);
    eyeSocket.add(glint2);

    // Upper eyelid cap that rotates down to blink!
    const lidGeo = new THREE.SphereGeometry(0.0185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const lid = new THREE.Mesh(lidGeo, plumageCreamMat);
    lid.position.z = side * 0.009;
    lid.rotation.z = -1.25; // tucked up when open
    eyeSocket.add(lid);
    eyelids.push(lid);
  }

  // Retro Aviator Goggles (perched jauntily on forehead; slides onto eyes in Turbo Sprint!)
  const gogglesGroup = new THREE.Group();
  gogglesGroup.name = 'AviatorGoggles';
  headGroup.add(gogglesGroup);

  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.089, 0.0085, 8, 24), strapLeatherMat);
  strap.rotation.x = Math.PI * 0.5;
  strap.scale.set(1.14, 0.93, 1);
  gogglesGroup.add(strap);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.022, 16), brassGoggleMat);
    rim.rotation.z = Math.PI * 0.5;
    rim.rotation.y = -side * 0.55;
    rim.position.set(0.084, 0.002, side * 0.048);
    gogglesGroup.add(rim);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.020, 16), lensGoggleMat);
    lens.rotation.y = Math.PI * 0.5 - side * 0.55;
    lens.position.set(0.095, 0.002, side * 0.054);
    gogglesGroup.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.008, 0.036), brassGoggleMat);
  bridge.position.set(0.094, 0.006, 0);
  gogglesGroup.add(bridge);

  // Rest position perched high on crown/forehead so eyes stay 100% clear & expressive!
  gogglesGroup.position.set(-0.014, 0.062, 0);
  gogglesGroup.rotation.z = 0.56;

  // =========================================================================
  // 3B. MASSIVE SCULPTED PELICAN BEAK + ELASTIC GULAR POUCH
  // =========================================================================
  const beakRoot = new THREE.Group();
  beakRoot.position.set(0.072, -0.008, 0);
  beakRoot.rotation.z = -0.08; // graceful slight downward tilt
  headGroup.add(beakRoot);

  // Target point inside open mouth for fish projectiles!
  const mouthCatchTarget = new THREE.Object3D();
  mouthCatchTarget.position.set(0.21, -0.03, 0);
  beakRoot.add(mouthCatchTarget);

  // Upper Mandible: sculpted 4-sided tapered culmen ridge (0.37m long!)
  const upperBeakLen = 0.368;
  const upperShapePts = [];
  const segsB = 14;
  // Build custom tapered upper mandible BufferGeometry for crisp dorsal culmen ridge
  const ubGeo = new THREE.CylinderGeometry(0.010, 0.048, upperBeakLen, 12, 8);
  ubGeo.rotateZ(-Math.PI * 0.5);
  ubGeo.translate(upperBeakLen * 0.5, 0.012, 0);
  // Flatten bottom of upper mandible & pinch dorsal ridge
  const ubPos = ubGeo.attributes.position;
  for (let i = 0; i < ubPos.count; i++) {
    const x = ubPos.getX(i);
    let y = ubPos.getY(i);
    let z = ubPos.getZ(i);
    const t = THREE.MathUtils.clamp(x / upperBeakLen, 0, 1);
    if (y < 0.004) {
      y = 0.002 - t * 0.004; // flat lower palate edge!
    } else {
      y *= (1 - t * 0.52);
      z *= 0.85 * (1 - Math.min(1, y * 10) * 0.35); // triangular culmen crest
    }
    z *= (1.12 - t * 0.65);
    ubPos.setXYZ(i, x, y, z);
  }
  ubGeo.computeVertexNormals();
  const upperMandible = new THREE.Mesh(ubGeo, beakUpperMat);
  upperMandible.castShadow = true;
  upperMandible.userData.interactType = 'pelican';
  beakRoot.add(upperMandible);

  // Iconic Coral-Red Hooked Nail Tip (`dertrum`) at the very tip of the pelican's beak!
  const nailHook = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.044, 10), beakNailMat);
  nailHook.position.set(upperBeakLen + 0.004, -0.008, 0);
  nailHook.rotation.z = THREE.MathUtils.degToRad(148); // curves sharply down at tip!
  nailHook.scale.set(1, 1, 0.78);
  nailHook.castShadow = true;
  beakRoot.add(nailHook);

  // Lower Mandible Jaw Rails
  const lowerJawGroup = new THREE.Group();
  beakRoot.add(lowerJawGroup);

  for (const side of [-1, 1]) {
    const railPts = [
      new THREE.Vector3(0, -0.008, side * 0.056),
      new THREE.Vector3(0.14, -0.006, side * 0.042),
      new THREE.Vector3(0.28, -0.005, side * 0.022),
      new THREE.Vector3(0.355, -0.004, side * 0.005)
    ];
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 16, 0.0055, 8, false), orangeFootMat);
    railMesh.castShadow = true;
    lowerJawGroup.add(railMesh);
  }

  // Deformable Elastic Gular Throat Pouch!
  const pouchGeo = createGularPouchGeometry(22, 16);
  const pouchState = {
    jawOpen: 0.04,
    pouchBounce: 0,
    pouchVelY: 0,
    pouchSwayZ: 0,
    pouchVelZ: 0,
    fishBulge: 0,
    fishU: 0.65
  };
  updateGularPouchVertices(pouchGeo, pouchState);
  const pouchMesh = new THREE.Mesh(pouchGeo, pouchMat);
  pouchMesh.castShadow = true;
  pouchMesh.receiveShadow = true;
  pouchMesh.userData.interactType = 'pelican';
  beakRoot.add(pouchMesh);

  // =========================================================================
  // 4. LAYERED FEATHERED WINGS WITH HANDLEBAR GRIP IK
  // =========================================================================
  const upperWingLen = 0.245;
  const foreWingLen = 0.255;

  function buildWingLimb(side) {
    const upperGroup = new THREE.Group();
    const foreGroup = new THREE.Group();
    root.add(upperGroup, foreGroup);

    // Upper wing (humerus + white secondary coverts)
    const humMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.036, upperWingLen - 0.04, 8, 12),
      plumageWhiteMat
    );
    humMesh.position.y = upperWingLen * 0.5;
    humMesh.scale.set(1.25, 1, 0.72);
    humMesh.castShadow = true;
    upperGroup.add(humMesh);

    // Feathered covert fan along trailing edge of upper wing
    for (let f = 0; f < 5; f++) {
      const t = (f + 0.5) / 5;
      const cov = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), plumageCreamMat);
      cov.scale.set(1.25, 0.52, 0.28);
      cov.position.set(-0.042, t * upperWingLen, side * 0.010);
      cov.rotation.z = 0.24;
      cov.castShadow = true;
      upperGroup.add(cov);
    }

    // Forewing (ulna + white coverts + dark slate-black primary flight tips!)
    const foreMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.028, foreWingLen - 0.04, 8, 12),
      plumageWhiteMat
    );
    foreMesh.position.y = foreWingLen * 0.48;
    foreMesh.scale.set(1.18, 1, 0.68);
    foreMesh.castShadow = true;
    foreGroup.add(foreMesh);

    // Layered overlapping white secondary & slate-black primary flight feathers!
    for (let p = 0; p < 7; p++) {
      const t = 0.16 + (p / 6) * 0.80;
      const isPrimary = p >= 2;
      const len = isPrimary ? 0.068 - Math.abs(p - 4.5) * 0.006 : 0.054;
      const rem = new THREE.Mesh(
        new THREE.SphereGeometry(len, 10, 8),
        isPrimary ? primaryDarkMat : plumageWhiteMat
      );
      rem.scale.set(1.35, 0.44, 0.24);
      rem.position.set(-0.048, t * foreWingLen, side * (0.012 + p * 0.001));
      rem.rotation.z = 0.22 - p * 0.05;
      rem.castShadow = true;
      foreGroup.add(rem);
    }

    // Wing-tip feather "hand" curling snugly over the leather handlebar grip!
    const wingHand = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), plumageWhiteMat);
    wingHand.scale.set(1.15, 0.75, 1.05);
    wingHand.position.set(0.005, foreWingLen, 0);
    wingHand.castShadow = true;
    foreGroup.add(wingHand);

    return { upperGroup, foreGroup };
  }

  const leftWing = buildWingLimb(-1);
  const rightWing = buildWingLimb(+1);

  // =========================================================================
  // 5. TWO-BONE IK LEGS + TOTIPALMATE WEBBED ORANGE FEET
  // =========================================================================
  const thighLen = 0.385;
  const shinLen = 0.385;

  function buildLegAndWebbedFoot(side) {
    const thighGroup = new THREE.Group();
    const shinGroup = new THREE.Group();
    const footGroup = new THREE.Group();
    root.add(thighGroup, shinGroup, footGroup);

    // Feathered upper thigh cuff + scaly orange lower thigh + knee joint
    const featherCuff = new THREE.Mesh(
      new THREE.ConeGeometry(0.056, thighLen * 0.55, 12),
      plumageWhiteMat
    );
    featherCuff.position.y = thighLen * 0.24;
    featherCuff.rotation.x = Math.PI;
    featherCuff.castShadow = true;
    thighGroup.add(featherCuff);

    const thighBone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.022, thighLen * 0.65, 10),
      orangeFootMat
    );
    thighBone.position.y = thighLen * 0.66;
    thighBone.castShadow = true;
    thighGroup.add(thighBone);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.020, 10, 8), orangeFootMat);
    kneeCap.position.y = thighLen;
    thighGroup.add(kneeCap);

    // Scaly orange tarsus / shin
    const shinBone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.016, shinLen, 10),
      orangeFootMat
    );
    shinBone.position.y = shinLen * 0.5;
    shinBone.castShadow = true;
    shinGroup.add(shinBone);

    const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), orangeFootMat);
    footGroup.add(ankleJoint);

    // Iconic Webbed Orange Pelican Foot (`footGroup` rests flat on pedal!)
    const toeAngles = [-0.38, 0.0, 0.38];
    const toeLengths = [0.088, 0.102, 0.088];
    const toeTips = [];

    for (let t = 0; t < 3; t++) {
      const ang = toeAngles[t];
      const len = toeLengths[t];
      const tipX = Math.cos(ang) * len;
      const tipZ = Math.sin(ang) * len;
      toeTips.push(new THREE.Vector3(tipX, 0.002, tipZ));

      const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, len * 0.85, 6, 8), orangeFootMat);
      toe.rotation.z = -Math.PI * 0.5;
      toe.rotation.y = -ang;
      toe.position.set(tipX * 0.5, 0.003, tipZ * 0.5);
      toe.castShadow = true;
      footGroup.add(toe);

      // Tiny dark claw at toe tip
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.012, 6), primaryDarkMat);
      claw.rotation.z = -Math.PI * 0.62;
      claw.rotation.y = -ang;
      claw.position.set(tipX * 1.04, -0.001, tipZ * 1.04);
      footGroup.add(claw);
    }

    // Orange interdigital webbing membranes stretched between adjacent toes!
    for (let w = 0; w < 2; w++) {
      const webGeo = new THREE.BufferGeometry();
      const pA = toeTips[w];
      const pB = toeTips[w + 1];
      const verts = new Float32Array([
        0.008, 0.004, 0,
        pA.x * 0.92, 0.003, pA.z * 0.92,
        pB.x * 0.92, 0.003, pB.z * 0.92
      ]);
      webGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      webGeo.computeVertexNormals();
      const webMesh = new THREE.Mesh(webGeo, orangeFootMat);
      webMesh.castShadow = true;
      footGroup.add(webMesh);
    }

    // Hind hallux toe gripping back of pedal
    const backToe = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.032, 6, 6), orangeFootMat);
    backToe.rotation.z = Math.PI * 0.55;
    backToe.position.set(-0.022, 0.001, side * 0.014);
    footGroup.add(backToe);

    return { thighGroup, shinGroup, footGroup };
  }

  const leftLeg = buildLegAndWebbedFoot(-1);
  const rightLeg = buildLegAndWebbedFoot(+1);

  // =========================================================================
  // 6. ANIMATION & SECONDARY PHYSICS STATE
  // =========================================================================
  let blinkTimer = 2.4;
  let blinkProgress = 0;
  let gulpTimer = 0;
  let cheerTimer = 0;
  let bellFlickTimer = 0;
  let goggleSlide = 0; // 0 = forehead, 1 = over eyes (Turbo!)
  let gogglesForceMode = 'auto'; // 'auto' | 'down' | 'up' | 'hidden'
  let prevBounceOffset = 0;

  // Scratch vectors for zero-GC per-frame IK updates
  const _saddleLocal = new THREE.Vector3();
  const _hipPos = new THREE.Vector3();
  const _pedalPos = new THREE.Vector3();
  const _kneePos = new THREE.Vector3();
  const _footEnd = new THREE.Vector3();
  const _kneePole = new THREE.Vector3();
  const _legPlaneNormal = new THREE.Vector3();

  const _shoulderPos = new THREE.Vector3();
  const _gripPos = new THREE.Vector3();
  const _elbowPos = new THREE.Vector3();
  const _handEnd = new THREE.Vector3();
  const _elbowPole = new THREE.Vector3();
  const _wingPlaneNormal = new THREE.Vector3();

  const _invRootMat = new THREE.Matrix4();
  const _lookPointLocal = new THREE.Vector3();

  function toPelicanSpace(targetObj, outVec) {
    targetObj.getWorldPosition(outVec);
    outVec.applyMatrix4(_invRootMat);
    return outVec;
  }

  function triggerCatchFish() {
    gulpTimer = 1.25;
    cheerTimer = 1.0;
    pouchState.fishBulge = 1.15;
    pouchState.fishU = 0.72;
    pouchState.pouchVelY -= 0.48;
  }

  function triggerBellFlick() {
    bellFlickTimer = 0.45;
    cheerTimer = Math.max(cheerTimer, 0.55);
  }

  function triggerCheer() {
    cheerTimer = 0.9;
    pouchState.pouchVelY -= 0.25;
  }

  function setAccessoryMode(mode) {
    // 'aviator' (default scarf + auto goggles), 'goggles' (goggles down), 'pure' (natural pelican!)
    if (mode === 'pure') {
      gogglesGroup.visible = false;
      scarfCollar.visible = false;
      scarfKnot.visible = false;
      for (const s of scarfTailMain) s.visible = false;
      for (const s of scarfTailShort) s.visible = false;
      gogglesForceMode = 'hidden';
    } else {
      gogglesGroup.visible = true;
      scarfCollar.visible = true;
      scarfKnot.visible = true;
      for (const s of scarfTailMain) s.visible = true;
      for (const s of scarfTailShort) s.visible = true;
      gogglesForceMode = mode === 'goggles' ? 'down' : 'auto';
    }
  }

  function update(dt, params) {
    const {
      time,
      speed,
      turboFactor,
      wheelieFactor,
      hopHeight,
      steerAngle,
      crankAngle,
      bicycle,
      fishTargetWorld // null or Vector3 of incoming fish!
    } = params;

    // Ensure world matrices of root & bicycle are up to date before solving IK!
    root.updateMatrixWorld(true);
    bicycle.root.updateMatrixWorld(true);
    _invRootMat.copy(root.matrixWorld).invert();

    // 1. Pelvis & Torso cycling bounce, cadence sway, forward aero lean
    const cadenceBounce = Math.sin(crankAngle * 2) * 0.011 * THREE.MathUtils.clamp(speed / 3.5, 0.15, 1.35);
    toPelicanSpace(bicycle.saddleSeatTarget, _saddleLocal);
    pelvisGroup.position.copy(_saddleLocal);
    pelvisGroup.position.y += cadenceBounce;

    // Side-to-side hip rock synced with alternating pedal strokes + aero forward pitch in Turbo
    const hipRoll = Math.sin(crankAngle) * 0.055;
    const forwardLean = -0.06 - turboFactor * 0.20 + wheelieFactor * 0.16;
    torsoGroup.rotation.set(hipRoll, -steerAngle * 0.18, forwardLean);

    // Tail fan flutter
    tailPivot.rotation.z = Math.sin(time * 9 + crankAngle * 2) * (0.06 + turboFactor * 0.10);

    // Refresh torso matrix so hip, shoulder, and neck world positions are exact!
    pelvisGroup.updateMatrixWorld(true);

    // 2. S-Curve Neck & Gimbaled Head Stabilization
    // Pelicans keep their heads remarkably steady while their bodies bob!
    const neckAeroPitch = -turboFactor * 0.055;
    for (let i = 0; i < neckJoints.length; i++) {
      const wave = Math.sin(time * 5.5 - i * 0.65) * 0.018;
      neckJoints[i].rotation.z = neckAeroPitch + wave - cadenceBounce * 1.1;
      neckJoints[i].rotation.y = steerAngle * 0.08;
    }

    // Head orientation: counter-levels torso pitch + tracks incoming tossed fish or gulps!
    let headPitch = -forwardLean * 0.72 + Math.sin(time * 3.2) * 0.03;
    let headYaw = steerAngle * 0.52 + Math.sin(time * 1.4) * 0.06;
    let targetJawOpen = 0.04 + turboFactor * 0.05;

    if (fishTargetWorld) {
      // Pelican eagerly locks eyes on incoming fish and opens its giant beak wide!!
      _lookPointLocal.copy(fishTargetWorld).applyMatrix4(_invRootMat);
      const dx = Math.max(0.2, _lookPointLocal.x - 0.15);
      const dy = _lookPointLocal.y - 1.45;
      const dz = _lookPointLocal.z;
      headYaw = THREE.MathUtils.clamp(-Math.atan2(dz, dx) * 0.85, -0.75, 0.75);
      headPitch = THREE.MathUtils.clamp(Math.atan2(dy, dx) * 0.75, -0.35, 0.58);
      targetJawOpen = 0.78;
    }

    if (gulpTimer > 0) {
      gulpTimer = Math.max(0, gulpTimer - dt);
      const gp = 1 - gulpTimer / 1.25; // 0 -> 1
      // Tilt beak skyward at gp ~ 0.45 to swallow the fish down the gullet!
      const tossBack = Math.sin(gp * Math.PI);
      headPitch += tossBack * 0.52;
      targetJawOpen = gp < 0.35 ? 0.38 * (1 - gp / 0.35) : 0.06;
      pouchState.fishU = THREE.MathUtils.lerp(0.72, 0.05, Math.min(1, gp * 1.35));
      pouchState.fishBulge = Math.max(0, 1.15 * (1 - gp * 1.05));
    } else {
      pouchState.fishBulge = THREE.MathUtils.lerp(pouchState.fishBulge, 0, Math.min(1, dt * 6));
    }

    if (cheerTimer > 0) {
      cheerTimer = Math.max(0, cheerTimer - dt);
      headPitch += Math.sin(cheerTimer * 18) * 0.10;
      if (!fishTargetWorld && gulpTimer <= 0) {
        targetJawOpen = Math.max(targetJawOpen, 0.34 * Math.sin((cheerTimer / 0.9) * Math.PI));
      }
    }

    headGroup.rotation.z = headPitch;
    headGroup.rotation.y = headYaw;
    headGroup.rotation.x = -hipRoll * 0.6;

    // Smooth jaw hinge & lower mandible rotation
    pouchState.jawOpen = THREE.MathUtils.lerp(pouchState.jawOpen, targetJawOpen, Math.min(1, dt * 14));
    lowerJawGroup.rotation.z = -pouchState.jawOpen * 0.24;

    // 3. Real-Time Gular Throat Pouch Spring-Damper Physics!
    const bounceImpulse = (cadenceBounce - prevBounceOffset) / Math.max(dt, 0.008);
    prevBounceOffset = cadenceBounce;

    // Vertical pouch spring-damper
    const kSpring = 155;
    const cDamp = 9.5;
    const extForceY = -bounceImpulse * 0.22 - (hopHeight > 0.01 ? 0.12 : 0);
    const accY = -kSpring * pouchState.pouchBounce - cDamp * pouchState.pouchVelY + extForceY;
    pouchState.pouchVelY += accY * dt;
    pouchState.pouchBounce = THREE.MathUtils.clamp(pouchState.pouchBounce + pouchState.pouchVelY * dt, -0.045, 0.095);

    // Lateral pouch sway from steering & hip rock
    const targetSwayZ = -steerAngle * 0.055 + Math.sin(crankAngle) * 0.012;
    const accZ = -120 * (pouchState.pouchSwayZ - targetSwayZ) - 8.5 * pouchState.pouchVelZ;
    pouchState.pouchVelZ += accZ * dt;
    pouchState.pouchSwayZ = THREE.MathUtils.clamp(pouchState.pouchSwayZ + pouchState.pouchVelZ * dt, -0.055, 0.055);

    updateGularPouchVertices(pouchGeo, pouchState);

    // 4. Natural Eye Blinking + Aviator Goggles Slide + Crest Feather Breeze
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blinkProgress = 0.18;
      blinkTimer = 2.2 + ((Math.sin(time * 12.9898) * 43758.5453) % 1 + 1) % 1 * 2.8;
    }
    let lidClose = 0;
    if (blinkProgress > 0) {
      blinkProgress = Math.max(0, blinkProgress - dt);
      lidClose = Math.sin((blinkProgress / 0.18) * Math.PI);
    }
    if (cheerTimer > 0.2) lidClose = Math.max(lidClose, 0.45); // happy squint!
    for (const lid of eyelids) {
      lid.rotation.z = THREE.MathUtils.lerp(-1.25, -0.08, lidClose);
    }

    const wantGogglesDown = gogglesForceMode === 'down' || (gogglesForceMode === 'auto' && turboFactor > 0.35);
    goggleSlide = THREE.MathUtils.lerp(goggleSlide, wantGogglesDown ? 1 : 0, Math.min(1, dt * 8));
    gogglesGroup.position.set(
      THREE.MathUtils.lerp(-0.014, -0.025, goggleSlide),
      THREE.MathUtils.lerp(0.062, 0.022, goggleSlide),
      0
    );
    gogglesGroup.rotation.z = THREE.MathUtils.lerp(0.56, -0.04, goggleSlide);

    for (let c = 0; c < crestFeathers.length; c++) {
      crestFeathers[c].rotation.z =
        THREE.MathUtils.degToRad(62 + c * 11) +
        Math.sin(time * (10 + speed * 1.5) + c * 0.9) * (0.06 + speed * 0.012);
    }

    // 5. Wind-Streaming Striped Aviator Scarf!
    const windSpeed = 8 + speed * 2.2;
    const windLift = THREE.MathUtils.clamp(speed * 0.055, 0.05, 0.42);
    for (let i = 0; i < scarfTailMain.length; i++) {
      const seg = scarfTailMain[i];
      const phase = time * windSpeed - i * 0.72;
      seg.rotation.z = (i === 0 ? 0.32 - windLift : 0) + Math.sin(phase) * (0.08 + i * 0.025);
      seg.rotation.y = (i === 0 ? 0.22 : 0) + Math.cos(phase * 0.85) * (0.06 + i * 0.02) - steerAngle * 0.08;
    }
    for (let i = 0; i < scarfTailShort.length; i++) {
      const seg = scarfTailShort[i];
      const phase = time * (windSpeed * 1.15) - i * 0.8 + 1.2;
      seg.rotation.z = (i === 0 ? 0.48 - windLift * 0.8 : 0) + Math.sin(phase) * (0.09 + i * 0.025);
      seg.rotation.y = (i === 0 ? -0.10 : 0) + Math.cos(phase) * 0.07;
    }

    // 6. Exact Two-Bone 3D Leg IK (Hip -> Knee -> Webbed Foot on Pedal!)
    for (const side of [-1, 1]) {
      const hipObj = side > 0 ? rightHipAnchor : leftHipAnchor;
      const pedalObj = side > 0 ? bicycle.rightPedalTarget : bicycle.leftPedalTarget;
      const leg = side > 0 ? rightLeg : leftLeg;

      toPelicanSpace(hipObj, _hipPos);
      toPelicanSpace(pedalObj, _pedalPos);

      // Forward-and-slightly-outward knee pole vector
      _kneePole.set(1.0, 0.25, side * 0.16).normalize();
      solveTwoBoneIK(_hipPos, _pedalPos, thighLen, shinLen, _kneePole, _kneePos, _footEnd);

      // Plane normal (~ +Z) for twist-free limb basis
      _legPlaneNormal.set(0, 0, 1);
      orientBoneSegment(leg.thighGroup, _hipPos, _kneePos, _legPlaneNormal);
      orientBoneSegment(leg.shinGroup, _kneePos, _footEnd, _legPlaneNormal);

      // Plant webbed foot squarely on the pedal with matching ankling pitch!
      leg.footGroup.position.copy(_footEnd);
      const phase = side > 0 ? crankAngle : crankAngle + Math.PI;
      const ankling = Math.sin(phase) * 0.16;
      leg.footGroup.rotation.set(0, -side * 0.05, ankling);
    }

    // 7. Exact Two-Bone 3D Wing IK (Shoulder -> Feathered Elbow -> Handlebar Leather Grips!)
    if (bellFlickTimer > 0) bellFlickTimer = Math.max(0, bellFlickTimer - dt);
    const flapLift =
      (cheerTimer > 0 ? Math.abs(Math.sin(cheerTimer * 18)) * 0.35 : 0) +
      (hopHeight > 0.02 ? 0.45 : 0);

    for (const side of [-1, 1]) {
      const shoulderObj = side > 0 ? rightShoulderAnchor : leftShoulderAnchor;
      const gripObj = side > 0 ? bicycle.rightGripAnchor : bicycle.leftGripAnchor;
      const wing = side > 0 ? rightWing : leftWing;

      toPelicanSpace(shoulderObj, _shoulderPos);
      toPelicanSpace(gripObj, _gripPos);

      // Subtle right-wing flick toward brass bell when ringing!
      if (side > 0 && bellFlickTimer > 0) {
        const flick = Math.sin((bellFlickTimer / 0.45) * Math.PI);
        _gripPos.z -= flick * 0.045;
        _gripPos.y += flick * 0.030;
      }

      // Outward-and-upward feathered elbow pole vector (flares higher during cheers/hops!)
      _elbowPole.set(-0.28, 0.55 + flapLift * 0.85, side * (0.85 + flapLift * 0.35)).normalize();
      solveTwoBoneIK(_shoulderPos, _gripPos, upperWingLen, foreWingLen, _elbowPole, _elbowPos, _handEnd);

      _wingPlaneNormal.set(0, 0.25, side).normalize();
      orientBoneSegment(wing.upperGroup, _shoulderPos, _elbowPos, _wingPlaneNormal);
      orientBoneSegment(wing.foreGroup, _elbowPos, _handEnd, _wingPlaneNormal);
    }

    return { cadenceBounce };
  }

  return {
    root,
    headGroup,
    mouthCatchTarget,
    povCameraAnchor,
    povLookAnchor,
    triggerCatchFish,
    triggerBellFlick,
    triggerCheer,
    setAccessoryMode,
    update
  };
}
