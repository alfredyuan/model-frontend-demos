import * as THREE from 'three';

/**
 * Classic Coastal Cruiser Bicycle (Three.js r160)
 * Coordinate convention:
 *   +X = forward direction of travel
 *   +Y = vertical up (y = 0 is boardwalk surface)
 *   +Z = rider's right-hand side (drive side with chainring & chain)
 */

const UP = new THREE.Vector3(0, 1, 0);

function createCylinderBetween(p1, p2, r1, r2, radialSegs, material) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r2, r1, len, radialSegs, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCurvedTube(points, radius, tubularSegs, radialSegs, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Exact closed-loop tangent path around two circles (front chainring & rear cog)
 * so chain links travel seamlessly with zero kinks.
 */
function buildChainLoopSampler(c1, r1, c2, r2) {
  // c1 = front chainring (larger), c2 = rear cog (smaller), in XY plane
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  const baseAngle = Math.atan2(dy, dx); // ~ pi (pointing backward from BB to rear axle)
  const alpha = Math.acos(THREE.MathUtils.clamp((r1 - r2) / d, -0.99, 0.99));

  // Tangent angles on circle 1 and circle 2:
  // Upper run (top of gears, y higher -> angle near +pi/2): baseAngle - alpha
  const aTop = baseAngle - alpha;
  // Lower run (bottom of gears, y lower -> angle near -pi/2): baseAngle + alpha
  const aBot = baseAngle + alpha;

  const p1Top = new THREE.Vector2(c1.x + r1 * Math.cos(aTop), c1.y + r1 * Math.sin(aTop));
  const p2Top = new THREE.Vector2(c2.x + r2 * Math.cos(aTop), c2.y + r2 * Math.sin(aTop));

  const p2Bot = new THREE.Vector2(c2.x + r2 * Math.cos(aBot), c2.y + r2 * Math.sin(aBot));
  const p1Bot = new THREE.Vector2(c1.x + r1 * Math.cos(aBot), c1.y + r1 * Math.sin(aBot));

  // Clockwise traversal (matches forward drivetrain motion!):
  // 1) p2Top -> p1Top (upper straight chain run pulled forward by top of chainring!)
  const lenTop = p1Top.distanceTo(p2Top);

  // 2) Arc clockwise around front chainring c1 from aTop down to aBot
  let sweep1 = aTop - aBot;
  while (sweep1 <= 0) sweep1 += Math.PI * 2;
  const lenArc1 = r1 * sweep1;

  // 3) p1Bot -> p2Bot (lower chain run returning backward to rear cog)
  const lenBot = p2Bot.distanceTo(p1Bot);

  // 4) Arc clockwise around rear cog c2 from aBot up to aTop
  let sweep2 = aBot - aTop;
  while (sweep2 <= 0) sweep2 += Math.PI * 2;
  const lenArc2 = r2 * sweep2;

  const totalLen = lenTop + lenArc1 + lenBot + lenArc2;

  return {
    totalLen,
    sample(uNorm, outPos2, outTan2) {
      let s = ((uNorm % 1) + 1) % 1 * totalLen;
      if (s < lenTop) {
        const t = s / lenTop;
        outPos2.lerpVectors(p2Top, p1Top, t);
        outTan2.subVectors(p1Top, p2Top).normalize();
        return;
      }
      s -= lenTop;
      if (s < lenArc1) {
        const ang = aTop - (s / lenArc1) * sweep1;
        outPos2.set(c1.x + r1 * Math.cos(ang), c1.y + r1 * Math.sin(ang));
        outTan2.set(Math.sin(ang), -Math.cos(ang));
        return;
      }
      s -= lenArc1;
      if (s < lenBot) {
        const t = s / lenBot;
        outPos2.lerpVectors(p1Bot, p2Bot, t);
        outTan2.subVectors(p2Bot, p1Bot).normalize();
        return;
      }
      s -= lenBot;
      const ang = aBot - (s / lenArc2) * sweep2;
      outPos2.set(c2.x + r2 * Math.cos(ang), c2.y + r2 * Math.sin(ang));
      outTan2.set(Math.sin(ang), -Math.cos(ang));
    }
  };
}

function buildSprocketMesh(radius, teeth, thickness, mat) {
  const shape = new THREE.Shape();
  const innerRim = radius - 0.008;
  const outerTip = radius + 0.0045;

  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.32) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.52) / teeth) * Math.PI * 2;
    const a3 = ((i + 0.84) / teeth) * Math.PI * 2;

    const x0 = Math.cos(a0) * innerRim;
    const y0 = Math.sin(a0) * innerRim;
    if (i === 0) shape.moveTo(x0, y0);
    else shape.lineTo(x0, y0);

    shape.lineTo(Math.cos(a1) * outerTip, Math.sin(a1) * outerTip);
    shape.lineTo(Math.cos(a2) * outerTip, Math.sin(a2) * outerTip);
    shape.lineTo(Math.cos(a3) * innerRim, Math.sin(a3) * innerRim);
  }
  shape.closePath();

  // Decorative weight-relief cutouts for large chainring
  if (radius > 0.06) {
    const holeCount = 5;
    for (let h = 0; h < holeCount; h++) {
      const ha = (h / holeCount) * Math.PI * 2 + 0.2;
      const hole = new THREE.Path();
      const hr = radius * 0.54;
      hole.absarc(Math.cos(ha) * hr, Math.sin(ha) * hr, radius * 0.19, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  } else {
    const centerHole = new THREE.Path();
    centerHole.absarc(0, 0, radius * 0.42, 0, Math.PI * 2, true);
    shape.holes.push(centerHole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.001,
    bevelSegments: 1,
    curveSegments: 12
  });
  geo.translate(0, 0, -thickness * 0.5);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

export function createBicycle(textures) {
  const root = new THREE.Group();
  root.name = 'BicycleRoot';

  // Key dimensions (meters)
  const wheelRadius = 0.35;
  const tireTube = 0.036;
  const torusRadius = wheelRadius - tireTube; // 0.314 -> outer tire touches y = 0!
  const rearAxle = new THREE.Vector3(-0.50, wheelRadius, 0);
  const frontAxleWorld = new THREE.Vector3(0.58, wheelRadius, 0);
  const bbPos = new THREE.Vector3(-0.06, 0.295, 0);
  const seatCluster = new THREE.Vector3(-0.205, 0.745, 0);
  const headMid = new THREE.Vector3(0.41, 0.73, 0);
  const headAngleRad = THREE.MathUtils.degToRad(19); // tilted 19 deg back from vertical
  const steerAxisDir = new THREE.Vector3(-Math.sin(headAngleRad), Math.cos(headAngleRad), 0);

  const headTop = new THREE.Vector3().copy(headMid).addScaledVector(steerAxisDir, 0.082);
  const headBot = new THREE.Vector3().copy(headMid).addScaledVector(steerAxisDir, -0.082);

  // Materials
  const framePaintMat = new THREE.MeshStandardMaterial({
    color: 0x229ebc, // Vibrant coastal seafoam-turquoise enamel
    roughness: 0.22,
    metalness: 0.35
  });

  const creamAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf7efe0,
    roughness: 0.28,
    metalness: 0.12
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fa,
    roughness: 0.12,
    metalness: 0.94
  });

  const darkAlloyMat = new THREE.MeshStandardMaterial({
    color: 0x3b424c,
    roughness: 0.35,
    metalness: 0.8
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf2b84b,
    roughness: 0.18,
    metalness: 0.9
  });

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x9c5227,
    roughness: 0.52,
    metalness: 0.08
  });

  const darkLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x6e3819,
    roughness: 0.58,
    metalness: 0.06
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.tireMap,
    roughness: 0.76,
    metalness: 0.04
  });

  const rubyReflectorMat = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    emissive: 0x99111c,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.2
  });

  const amberReflectorMat = new THREE.MeshStandardMaterial({
    color: 0xff9f1c,
    emissive: 0xb85d00,
    emissiveIntensity: 0.38,
    roughness: 0.25,
    metalness: 0.15
  });

  // =========================================================================
  // 1. SPOKED WHEEL BUILDER (Front & Rear)
  // =========================================================================
  function buildWheel(name) {
    const wheelGroup = new THREE.Group();
    wheelGroup.name = name;

    // Tire
    const tireGeo = new THREE.TorusGeometry(torusRadius, tireTube, 18, 52);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    tireMesh.receiveShadow = true;
    wheelGroup.add(tireMesh);

    // Polished alloy rim
    const rimRadius = torusRadius - tireTube * 0.72;
    const rimGeo = new THREE.TorusGeometry(rimRadius, 0.013, 12, 48);
    const rimMesh = new THREE.Mesh(rimGeo, chromeMat);
    rimMesh.castShadow = true;
    wheelGroup.add(rimMesh);

    // Hub shell + left/right flanges
    const hubGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.078, 16);
    hubGeo.rotateX(Math.PI * 0.5);
    wheelGroup.add(new THREE.Mesh(hubGeo, chromeMat));

    const flangeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.005, 20);
    flangeGeo.rotateX(Math.PI * 0.5);
    for (const fz of [-0.028, 0.028]) {
      const flange = new THREE.Mesh(flangeGeo, chromeMat);
      flange.position.z = fz;
      wheelGroup.add(flange);
    }

    // 24 Cross-laced tangential steel spokes using a single InstancedMesh
    const spokeCount = 24;
    const spokeGeo = new THREE.CylinderGeometry(0.0019, 0.0019, 1, 6);
    const spokesInst = new THREE.InstancedMesh(spokeGeo, chromeMat, spokeCount);
    spokesInst.castShadow = true;

    const dummy = new THREE.Object3D();
    const pHub = new THREE.Vector3();
    const pRim = new THREE.Vector3();
    const dir = new THREE.Vector3();

    for (let i = 0; i < spokeCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const crossDir = i % 4 < 2 ? 1 : -1;
      const rimAng = (i / spokeCount) * Math.PI * 2;
      const hubAng = rimAng + crossDir * 0.42;

      pHub.set(Math.cos(hubAng) * 0.031, Math.sin(hubAng) * 0.031, side * 0.028);
      pRim.set(Math.cos(rimAng) * (rimRadius - 0.006), Math.sin(rimAng) * (rimRadius - 0.006), side * 0.003);

      dir.subVectors(pRim, pHub);
      const len = dir.length();
      dummy.position.addVectors(pHub, pRim).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(UP, dir.normalize());
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      spokesInst.setMatrixAt(i, dummy.matrix);
    }
    spokesInst.instanceMatrix.needsUpdate = true;
    wheelGroup.add(spokesInst);

    // Valve stem + brass cap
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.032, 8), brassMat);
    valve.position.set(0, -(rimRadius - 0.018), 0);
    wheelGroup.add(valve);

    // Classic amber spoke reflector
    const spokeRef = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.02, 0.008), amberReflectorMat);
    spokeRef.position.set(0, rimRadius * 0.66, 0);
    wheelGroup.add(spokeRef);

    return wheelGroup;
  }

  const rearWheel = buildWheel('RearWheel');
  rearWheel.position.copy(rearAxle);
  root.add(rearWheel);

  // =========================================================================
  // 2. DIAMOND + COASTAL CRUISER STEEL FRAME
  // =========================================================================
  const frameGroup = new THREE.Group();
  frameGroup.name = 'FrameGroup';
  root.add(frameGroup);

  // Seat tube (BB to seat cluster)
  frameGroup.add(createCylinderBetween(bbPos, seatCluster, 0.018, 0.017, 14, framePaintMat));

  // Cream decorative panel on seat tube + head tube
  const seatMidA = new THREE.Vector3().lerpVectors(bbPos, seatCluster, 0.36);
  const seatMidB = new THREE.Vector3().lerpVectors(bbPos, seatCluster, 0.72);
  frameGroup.add(createCylinderBetween(seatMidA, seatMidB, 0.0188, 0.0185, 14, creamAccentMat));

  // Head tube with cream panel & brass head badge
  frameGroup.add(createCylinderBetween(headBot, headTop, 0.022, 0.022, 16, creamAccentMat));
  frameGroup.add(createCylinderBetween(
    new THREE.Vector3().copy(headBot).addScaledVector(steerAxisDir, -0.01),
    new THREE.Vector3().copy(headBot).addScaledVector(steerAxisDir, 0.016),
    0.024, 0.024, 16, chromeMat
  ));
  frameGroup.add(createCylinderBetween(
    new THREE.Vector3().copy(headTop).addScaledVector(steerAxisDir, -0.016),
    new THREE.Vector3().copy(headTop).addScaledVector(steerAxisDir, 0.01),
    0.024, 0.024, 16, chromeMat
  ));

  // Brass badge on front of head tube
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 12), brassMat);
  badge.rotation.z = Math.PI * 0.5 + headAngleRad;
  badge.position.copy(headMid).add(new THREE.Vector3(0.021, 0.006, 0));
  frameGroup.add(badge);

  // Graceful curved cruiser Top Tube (seat cluster -> gentle arch -> head tube upper)
  const topTubeEnd = new THREE.Vector3().copy(headMid).addScaledVector(steerAxisDir, 0.048);
  frameGroup.add(createCurvedTube([
    seatCluster,
    new THREE.Vector3(-0.02, 0.775, 0),
    new THREE.Vector3(0.20, 0.785, 0),
    topTubeEnd
  ], 0.0165, 24, 12, framePaintMat));

  // Secondary twin-bar vintage accent tube below top tube
  frameGroup.add(createCurvedTube([
    new THREE.Vector3().lerpVectors(bbPos, seatCluster, 0.76),
    new THREE.Vector3(0.02, 0.695, 0),
    new THREE.Vector3(0.23, 0.70, 0),
    new THREE.Vector3().copy(headMid).addScaledVector(steerAxisDir, -0.012)
  ], 0.0115, 20, 10, framePaintMat));

  // Curved Down Tube (BB -> sweeping curve -> head tube lower)
  const downTubeEnd = new THREE.Vector3().copy(headMid).addScaledVector(steerAxisDir, -0.052);
  frameGroup.add(createCurvedTube([
    bbPos,
    new THREE.Vector3(0.11, 0.39, 0),
    new THREE.Vector3(0.29, 0.55, 0),
    downTubeEnd
  ], 0.0185, 24, 12, framePaintMat));

  // Bottom bracket shell
  const bbShell = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.072, 16), framePaintMat);
  bbShell.rotation.x = Math.PI * 0.5;
  bbShell.position.copy(bbPos);
  bbShell.castShadow = true;
  frameGroup.add(bbShell);

  // Left & Right Chainstays + Seatstays + Rear Dropouts
  for (const side of [-1, 1]) {
    const dropout = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.048);
    const bbSide = new THREE.Vector3(bbPos.x, bbPos.y, side * 0.030);
    const seatSide = new THREE.Vector3(seatCluster.x, seatCluster.y - 0.015, side * 0.022);

    frameGroup.add(createCurvedTube([
      bbSide,
      new THREE.Vector3(-0.26, 0.315, side * 0.052),
      dropout
    ], 0.011, 14, 10, framePaintMat));

    frameGroup.add(createCylinderBetween(seatSide, dropout, 0.010, 0.009, 10, framePaintMat));

    // Axle nut
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.018, 6), chromeMat);
    nut.rotation.x = Math.PI * 0.5;
    nut.position.set(rearAxle.x, rearAxle.y, side * 0.058);
    frameGroup.add(nut);
  }

  // Rear Cruiser Fender / Mudguard + Chrome Stays + Ruby Reflector
  const rearFenderGeo = new THREE.TorusGeometry(wheelRadius + 0.022, 0.042, 10, 32, Math.PI * 1.05);
  // Scale flatter in radial thickness so it hugs the tire like a curved sheet-metal fender
  const rearFender = new THREE.Mesh(rearFenderGeo, framePaintMat);
  rearFender.position.copy(rearAxle);
  rearFender.rotation.z = THREE.MathUtils.degToRad(28);
  rearFender.castShadow = true;
  frameGroup.add(rearFender);

  // Rear fender stays
  for (const side of [-1, 1]) {
    const stayStart = new THREE.Vector3(rearAxle.x, rearAxle.y, side * 0.052);
    const ang = THREE.MathUtils.degToRad(155);
    const stayEnd = new THREE.Vector3(
      rearAxle.x + Math.cos(ang) * (wheelRadius + 0.024),
      rearAxle.y + Math.sin(ang) * (wheelRadius + 0.024),
      side * 0.036
    );
    frameGroup.add(createCylinderBetween(stayStart, stayEnd, 0.0032, 0.0032, 6, chromeMat));
  }

  // Rear ruby reflector on back of rear fender
  const rearRefAng = THREE.MathUtils.degToRad(172);
  const rearRef = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.020, 0.014, 14), rubyReflectorMat);
  rearRef.rotation.z = rearRefAng - Math.PI * 0.5;
  rearRef.position.set(
    rearAxle.x + Math.cos(rearRefAng) * (wheelRadius + 0.045),
    rearAxle.y + Math.sin(rearRefAng) * (wheelRadius + 0.045),
    0
  );
  frameGroup.add(rearRef);

  // Tucked alloy kickstand on left chainstay
  frameGroup.add(createCylinderBetween(
    new THREE.Vector3(-0.14, 0.285, -0.042),
    new THREE.Vector3(-0.40, 0.305, -0.068),
    0.006, 0.005, 8, chromeMat
  ));

  // =========================================================================
  // 3. SEATPOST & SPRUNG HONEY-LEATHER SADDLE
  // =========================================================================
  const seatDir = new THREE.Vector3().subVectors(seatCluster, bbPos).normalize();
  const seatPostTop = new THREE.Vector3().copy(seatCluster).addScaledVector(seatDir, 0.115);

  // Seatpost clamp + chrome post
  frameGroup.add(createCylinderBetween(
    new THREE.Vector3().copy(seatCluster).addScaledVector(seatDir, -0.012),
    new THREE.Vector3().copy(seatCluster).addScaledVector(seatDir, 0.018),
    0.021, 0.021, 14, chromeMat
  ));
  frameGroup.add(createCylinderBetween(seatCluster, seatPostTop, 0.0135, 0.0135, 12, chromeMat));

  // Saddle suspension group (bounces subtly with pelican!)
  const saddleGroup = new THREE.Group();
  saddleGroup.position.copy(seatPostTop);
  frameGroup.add(saddleGroup);

  // Twin rear coil springs
  const saddleSprings = [];
  for (const side of [-1, 1]) {
    const springPoints = [];
    const turns = 4.5;
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = t * turns * Math.PI * 2;
      springPoints.push(new THREE.Vector3(
        -0.052 + Math.cos(a) * 0.014,
        0.005 + t * 0.042,
        side * 0.046 + Math.sin(a) * 0.014
      ));
    }
    const springMesh = createCurvedTube(springPoints, 0.0032, 28, 6, chromeMat);
    saddleGroup.add(springMesh);
    saddleSprings.push(springMesh);

    // Chrome saddle rail
    saddleGroup.add(createCurvedTube([
      new THREE.Vector3(0.075, 0.036, 0),
      new THREE.Vector3(0.01, 0.022, side * 0.038),
      new THREE.Vector3(-0.055, 0.045, side * 0.046)
    ], 0.0035, 12, 6, chromeMat));
  }

  // Sculpted Brooks-style leather saddle body
  const saddleDeck = new THREE.Group();
  saddleDeck.position.set(0, 0.048, 0);
  saddleGroup.add(saddleDeck);

  // Rear wide cantle + narrow nose
  const saddleShape = new THREE.Shape();
  saddleShape.moveTo(0.095, 0);
  saddleShape.bezierCurveTo(0.095, 0.024, 0.03, 0.030, -0.02, 0.078);
  saddleShape.bezierCurveTo(-0.065, 0.098, -0.098, 0.082, -0.098, 0);
  saddleShape.bezierCurveTo(-0.098, -0.082, -0.065, -0.098, -0.02, -0.078);
  saddleShape.bezierCurveTo(0.03, -0.030, 0.095, -0.024, 0.095, 0);

  const saddleGeo = new THREE.ExtrudeGeometry(saddleShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.008,
    bevelSegments: 3
  });
  saddleGeo.rotateX(Math.PI * 0.5);
  const saddleMesh = new THREE.Mesh(saddleGeo, leatherMat);
  saddleMesh.position.y = 0.012;
  saddleMesh.castShadow = true;
  saddleDeck.add(saddleMesh);

  // Brass saddle rivets along back edge
  for (let r = -2; r <= 2; r++) {
    const ang = r * 0.36;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 8, 6), brassMat);
    rivet.position.set(-0.086 + Math.abs(r) * 0.006, 0.021, Math.sin(ang) * 0.072);
    saddleDeck.add(rivet);
  }

  // Saddle anchor target for the Pelican's pelvis
  const saddleSeatTarget = new THREE.Object3D();
  saddleSeatTarget.position.set(-0.02, 0.025, 0);
  saddleDeck.add(saddleSeatTarget);

  // =========================================================================
  // 4. DRIVETRAIN: CRANKSET, PEDALS, SPROCKETS & ANIMATED ROLLER CHAIN
  // =========================================================================
  const chainZ = 0.046; // Drive side (+Z)
  const chainringRadius = 0.086;
  const rearCogRadius = 0.040;
  const crankLength = 0.160;

  // Rear sprocket mounted on rear wheel hub so it spins with rear wheel
  const rearCog = buildSprocketMesh(rearCogRadius, 16, 0.005, darkAlloyMat);
  rearCog.position.z = chainZ;
  rearWheel.add(rearCog);

  // Crank assembly at bottom bracket
  const crankGroup = new THREE.Group();
  crankGroup.name = 'CrankGroup';
  crankGroup.position.copy(bbPos);
  root.add(crankGroup);

  // Front 34T chainring + 5-arm spider
  const chainring = buildSprocketMesh(chainringRadius, 34, 0.0055, chromeMat);
  chainring.position.z = chainZ;
  crankGroup.add(chainring);

  for (let s = 0; s < 5; s++) {
    const sa = (s / 5) * Math.PI * 2;
    const armEnd = new THREE.Vector3(Math.cos(sa) * (chainringRadius * 0.56), Math.sin(sa) * (chainringRadius * 0.56), chainZ);
    crankGroup.add(createCylinderBetween(new THREE.Vector3(0, 0, chainZ), armEnd, 0.007, 0.005, 8, chromeMat));
  }

  // Partial vintage chain guard arc above top of chain
  const guardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(bbPos.x + 0.085, bbPos.y + 0.055, chainZ + 0.012),
    new THREE.Vector3(bbPos.x + 0.02, bbPos.y + 0.106, chainZ + 0.012),
    new THREE.Vector3(bbPos.x - 0.16, bbPos.y + 0.098, chainZ + 0.012),
    new THREE.Vector3(rearAxle.x + 0.06, rearAxle.y + 0.064, chainZ + 0.012)
  ]);
  const guardMesh = new THREE.Mesh(
    new THREE.TubeGeometry(guardCurve, 20, 0.012, 8, false),
    framePaintMat
  );
  guardMesh.scale.z = 0.35;
  guardMesh.position.z = chainZ * (1 - 0.35);
  guardMesh.castShadow = true;
  frameGroup.add(guardMesh);

  // Right crank arm (+Z, phase = 0 -> along +X at crankAngle = 0) & Left crank arm (-Z, phase = pi)
  function buildCrankAndPedal(side, dirSign) {
    const armZ = side * 0.058;
    const armStart = new THREE.Vector3(0, 0, side * 0.036);
    const armEnd = new THREE.Vector3(dirSign * crankLength, 0, armZ);
    crankGroup.add(createCylinderBetween(armStart, armEnd, 0.013, 0.010, 10, chromeMat));

    // Spindle out to pedal center
    const pedalPivot = new THREE.Group();
    pedalPivot.position.set(dirSign * crankLength, 0, side * 0.108);
    crankGroup.add(pedalPivot);

    crankGroup.add(createCylinderBetween(
      armEnd,
      new THREE.Vector3(dirSign * crankLength, 0, side * 0.108),
      0.005, 0.005, 8, chromeMat
    ));

    // Platform pedal body (stays level with ground via counter-rotation!)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.020, 0.068), darkAlloyMat);
    body.castShadow = true;
    pedalPivot.add(body);

    // Front & back amber pedal reflectors
    for (const rx of [-0.048, 0.048]) {
      const ref = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.046), amberReflectorMat);
      ref.position.x = rx;
      pedalPivot.add(ref);
    }

    // Grip target on top surface of pedal for Pelican's webbed foot!
    const footTarget = new THREE.Object3D();
    footTarget.position.set(0.01, 0.014, 0);
    pedalPivot.add(footTarget);

    return { pedalPivot, footTarget };
  }

  const rightPedal = buildCrankAndPedal(+1, +1);
  const leftPedal = buildCrankAndPedal(-1, -1);

  // Animated 56-link Roller Chain (InstancedMesh)
  const chainSampler = buildChainLoopSampler(
    new THREE.Vector2(bbPos.x, bbPos.y),
    chainringRadius,
    new THREE.Vector2(rearAxle.x, rearAxle.y),
    rearCogRadius
  );
  const chainLinkCount = 56;
  const linkGeo = new THREE.BoxGeometry(0.015, 0.0085, 0.009);
  const chainInst = new THREE.InstancedMesh(linkGeo, darkAlloyMat, chainLinkCount);
  chainInst.castShadow = true;
  root.add(chainInst);

  const _cPos = new THREE.Vector2();
  const _cTan = new THREE.Vector2();
  const _cDummy = new THREE.Object3D();

  function updateChain(chainDistance) {
    const phase = chainDistance / chainSampler.totalLen;
    for (let i = 0; i < chainLinkCount; i++) {
      const u = i / chainLinkCount + phase;
      chainSampler.sample(u, _cPos, _cTan);
      _cDummy.position.set(_cPos.x, _cPos.y, chainZ);
      _cDummy.rotation.set(0, 0, Math.atan2(_cTan.y, _cTan.x));
      const plateScale = i % 2 === 0 ? 1.0 : 0.78;
      _cDummy.scale.set(1, plateScale, plateScale);
      _cDummy.updateMatrix();
      chainInst.setMatrixAt(i, _cDummy.matrix);
    }
    chainInst.instanceMatrix.needsUpdate = true;
  }
  updateChain(0);

  // =========================================================================
  // 5. STEERING ASSEMBLY (Fork, Front Wheel, Handlebars, Bell, Basket, Lamp)
  // =========================================================================
  // Parent group aligned with the 19-degree inclined head-tube axis!
  const steerAxisGroup = new THREE.Group();
  steerAxisGroup.position.copy(headMid);
  steerAxisGroup.rotation.z = headAngleRad; // Local +Y now equals steerAxisDir!
  root.add(steerAxisGroup);

  const steeringPivot = new THREE.Group();
  steeringPivot.name = 'SteeringPivot';
  steerAxisGroup.add(steeringPivot);

  // Convert a world rest-pose point (steer=0) into steeringPivot local coords
  const invSteerQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    -headAngleRad
  );
  const worldToSteerLocal = (wp) =>
    new THREE.Vector3().copy(wp).sub(headMid).applyQuaternion(invSteerQuat);

  const frontAxleLocal = worldToSteerLocal(frontAxleWorld);
  const forkCrownLocal = new THREE.Vector3(0, -0.095, 0);

  // Fork crown
  const crownMesh = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.026, 0.106), chromeMat);
  crownMesh.position.copy(forkCrownLocal);
  crownMesh.castShadow = true;
  steeringPivot.add(crownMesh);

  // Left & Right graceful raked chrome fork blades
  for (const side of [-1, 1]) {
    const bladeTop = new THREE.Vector3(forkCrownLocal.x, forkCrownLocal.y, side * 0.044);
    const bladeMid = new THREE.Vector3(
      forkCrownLocal.x * 0.5 + frontAxleLocal.x * 0.35,
      (forkCrownLocal.y + frontAxleLocal.y) * 0.52,
      side * 0.049
    );
    const bladeTip = new THREE.Vector3(frontAxleLocal.x, frontAxleLocal.y, side * 0.048);
    steeringPivot.add(createCurvedTube([bladeTop, bladeMid, bladeTip], 0.0115, 16, 10, chromeMat));

    const fNut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.018, 6), chromeMat);
    fNut.rotation.x = Math.PI * 0.5;
    fNut.position.set(frontAxleLocal.x, frontAxleLocal.y, side * 0.058);
    steeringPivot.add(fNut);
  }

  // Front Wheel inside steeringPivot!
  const frontWheel = buildWheel('FrontWheel');
  frontWheel.position.copy(frontAxleLocal);
  // Counter-tilt Z by -headAngleRad in rest pose so wheel spokes match world orientation cleanly
  frontWheel.rotation.z = -headAngleRad;
  steeringPivot.add(frontWheel);

  // Front Painted Fender
  const frontFenderGeo = new THREE.TorusGeometry(wheelRadius + 0.022, 0.040, 10, 28, Math.PI * 0.88);
  const frontFender = new THREE.Mesh(frontFenderGeo, framePaintMat);
  frontFender.position.copy(frontAxleLocal);
  frontFender.rotation.z = THREE.MathUtils.degToRad(58) - headAngleRad;
  frontFender.castShadow = true;
  steeringPivot.add(frontFender);

  // Vintage Chrome Dynamo Headlamp on Fork Crown!
  const lampGroup = new THREE.Group();
  lampGroup.name = 'Headlamp';
  lampGroup.position.set(0.058, -0.055, 0);
  lampGroup.rotation.z = -headAngleRad; // level with ground!
  steeringPivot.add(lampGroup);

  steeringPivot.add(createCurvedTube([
    new THREE.Vector3(0.012, -0.085, 0),
    new THREE.Vector3(0.042, -0.075, 0),
    new THREE.Vector3(0.052, -0.055, 0)
  ], 0.0045, 8, 6, chromeMat));

  const lampShell = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.68), chromeMat);
  lampShell.rotation.z = Math.PI * 0.5;
  lampShell.scale.set(1, 1.35, 1);
  lampShell.castShadow = true;
  lampShell.userData.interactType = 'lamp';
  lampGroup.add(lampShell);

  const lampBezel = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.0045, 8, 20), brassMat);
  lampBezel.rotation.y = Math.PI * 0.5;
  lampBezel.position.x = 0.022;
  lampBezel.userData.interactType = 'lamp';
  lampGroup.add(lampBezel);

  const lampLensMat = new THREE.MeshStandardMaterial({
    color: 0xfff6d6,
    emissive: 0xffd275,
    emissiveIntensity: 0.9,
    roughness: 0.1
  });
  const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.031, 18), lampLensMat);
  lampLens.rotation.y = Math.PI * 0.5;
  lampLens.position.x = 0.023;
  lampLens.userData.interactType = 'lamp';
  lampGroup.add(lampLens);

  // Soft volumetric light beam cone + real SpotLight (shines gloriously in Sunset/Night!)
  const beamGeo = new THREE.ConeGeometry(0.62, 2.8, 24, 1, true);
  beamGeo.translate(0, -1.4, 0);
  beamGeo.rotateZ(Math.PI * 0.5); // apex at origin, flares toward +X
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe49e,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const headlampBeamMesh = new THREE.Mesh(beamGeo, beamMat);
  headlampBeamMesh.position.set(0.03, -0.01, 0);
  headlampBeamMesh.rotation.z = -0.14; // angle slightly down toward boardwalk
  lampGroup.add(headlampBeamMesh);

  const headlampSpot = new THREE.SpotLight(0xffe19c, 0, 9.5, Math.PI * 0.24, 0.55, 1.2);
  headlampSpot.position.set(0.03, 0, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(3.2, -0.55, 0);
  lampGroup.add(spotTarget);
  headlampSpot.target = spotTarget;
  lampGroup.add(headlampSpot);

  // Quill Stem & Swept-Back Coastal Cruiser Handlebars
  const stemTop = new THREE.Vector3(0, 0.168, 0);
  const barClamp = new THREE.Vector3(0.052, 0.185, 0);
  steeringPivot.add(createCylinderBetween(new THREE.Vector3(0, 0.075, 0), stemTop, 0.013, 0.013, 12, chromeMat));
  steeringPivot.add(createCurvedTube([stemTop, new THREE.Vector3(0.025, 0.182, 0), barClamp], 0.0135, 10, 10, chromeMat));

  // Level handlebar assembly in world orientation
  const handlebarGroup = new THREE.Group();
  handlebarGroup.position.copy(barClamp);
  handlebarGroup.rotation.z = -headAngleRad;
  steeringPivot.add(handlebarGroup);

  // Swept-back chrome cruiser bar (symmetric left/right)
  const leftGripAnchor = new THREE.Object3D();
  const rightGripAnchor = new THREE.Object3D();

  for (const side of [-1, 1]) {
    const barPts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.012, 0.018, side * 0.085),
      new THREE.Vector3(0.005, 0.056, side * 0.185),
      new THREE.Vector3(-0.075, 0.068, side * 0.255),
      new THREE.Vector3(-0.195, 0.058, side * 0.275)
    ];
    handlebarGroup.add(createCurvedTube(barPts, 0.011, 20, 10, chromeMat));

    // Stitched honey-leather grip on bar end
    const gripStart = barPts[3];
    const gripEnd = barPts[4];
    handlebarGroup.add(createCylinderBetween(gripStart, gripEnd, 0.0165, 0.0175, 12, leatherMat));

    // Chrome end-cap
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 10, 8), chromeMat);
    cap.position.copy(gripEnd);
    handlebarGroup.add(cap);

    // Brake lever + curved brake cable housing
    const leverBase = new THREE.Vector3(-0.062, 0.062, side * 0.238);
    const leverTip = new THREE.Vector3(-0.145, 0.036, side * 0.215);
    handlebarGroup.add(createCylinderBetween(leverBase, leverTip, 0.0045, 0.003, 8, chromeMat));

    const cablePts = [
      new THREE.Vector3(-0.048, 0.055, side * 0.228),
      new THREE.Vector3(0.075, -0.02, side * 0.14),
      new THREE.Vector3(0.045, -0.22, side * 0.04)
    ];
    handlebarGroup.add(createCurvedTube(cablePts, 0.0026, 14, 6, darkAlloyMat));

    const anchor = side > 0 ? rightGripAnchor : leftGripAnchor;
    anchor.position.lerpVectors(gripStart, gripEnd, 0.56);
    handlebarGroup.add(anchor);
  }

  // =========================================================================
  // 5B. INTERACTIVE BRASS BICYCLE BELL (Right Handlebar)
  // =========================================================================
  const bellGroup = new THREE.Group();
  bellGroup.name = 'BrassBell';
  bellGroup.position.set(-0.052, 0.084, 0.215);
  handlebarGroup.add(bellGroup);

  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    brassMat
  );
  bellDome.scale.set(1, 0.85, 1);
  bellDome.castShadow = true;
  bellDome.userData.interactType = 'bell';
  bellGroup.add(bellDome);

  const bellFinial = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 8), chromeMat);
  bellFinial.position.y = 0.025;
  bellFinial.userData.interactType = 'bell';
  bellGroup.add(bellFinial);

  const bellThumbLever = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.005, 0.012), chromeMat);
  bellThumbLever.position.set(-0.024, 0.004, -0.014);
  bellThumbLever.userData.interactType = 'bell';
  bellGroup.add(bellThumbLever);

  // Expanding golden sound-wave halo when bell rings!
  const bellWaveGeo = new THREE.RingGeometry(0.032, 0.044, 28);
  const bellWaveMat = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const bellWaveRing = new THREE.Mesh(bellWaveGeo, bellWaveMat);
  bellWaveRing.rotation.x = -Math.PI * 0.35;
  bellWaveRing.position.y = 0.03;
  bellGroup.add(bellWaveRing);

  // =========================================================================
  // 5C. SPINNING RAINBOW PINWHEEL (Left Handlebar!)
  // =========================================================================
  const pinwheelMount = new THREE.Group();
  pinwheelMount.position.set(0.012, 0.062, -0.165);
  handlebarGroup.add(pinwheelMount);

  pinwheelMount.add(createCylinderBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.035, 0.115, 0),
    0.0035, 0.003, 8, creamAccentMat
  ));

  const pinwheelRotor = new THREE.Group();
  pinwheelRotor.position.set(0.042, 0.118, 0);
  pinwheelRotor.rotation.y = Math.PI * 0.5; // faces forward into the wind (+X)!
  pinwheelMount.add(pinwheelRotor);

  const bladeColors = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xff924c];
  const bladeGeo = new THREE.ConeGeometry(0.024, 0.068, 5);
  bladeGeo.translate(0, 0.034, 0);
  bladeGeo.scale(1, 1, 0.25);

  for (let b = 0; b < 6; b++) {
    const bMat = new THREE.MeshStandardMaterial({
      color: bladeColors[b],
      roughness: 0.32,
      metalness: 0.08
    });
    const blade = new THREE.Mesh(bladeGeo, bMat);
    blade.rotation.z = (b / 6) * Math.PI * 2;
    blade.rotation.y = 0.38; // angled blades catch the wind
    blade.userData.interactType = 'pinwheel';
    pinwheelRotor.add(blade);
  }
  const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), creamAccentMat);
  hubCap.userData.interactType = 'pinwheel';
  pinwheelRotor.add(hubCap);

  // =========================================================================
  // 5D. WOVEN WICKER FRONT BASKET WITH SARDINES & COASTAL FLOWERS
  // =========================================================================
  const basketGroup = new THREE.Group();
  basketGroup.name = 'WickerBasket';
  basketGroup.position.set(0.115, -0.055, 0);
  handlebarGroup.add(basketGroup);

  const wickerMat = new THREE.MeshStandardMaterial({
    color: 0xd9a66c,
    map: textures.wickerMap,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  // Slightly flared oval wicker cylinder (open top) + bottom base + woven rim
  const basketWallGeo = new THREE.CylinderGeometry(0.115, 0.088, 0.155, 20, 1, true);
  basketWallGeo.scale(0.82, 1, 1.25);
  const basketWall = new THREE.Mesh(basketWallGeo, wickerMat);
  basketWall.castShadow = true;
  basketWall.receiveShadow = true;
  basketWall.userData.interactType = 'basket';
  basketGroup.add(basketWall);

  const basketBotGeo = new THREE.CircleGeometry(0.088, 20);
  basketBotGeo.rotateX(Math.PI * 0.5);
  basketBotGeo.scale(0.82, 1, 1.25);
  const basketBot = new THREE.Mesh(basketBotGeo, wickerMat);
  basketBot.position.y = -0.076;
  basketGroup.add(basketBot);

  const basketRimGeo = new THREE.TorusGeometry(0.115, 0.011, 10, 24);
  basketRimGeo.rotateX(Math.PI * 0.5);
  basketRimGeo.scale(0.82, 1, 1.25);
  const basketRim = new THREE.Mesh(basketRimGeo, wickerMat);
  basketRim.position.y = 0.078;
  basketRim.userData.interactType = 'basket';
  basketGroup.add(basketRim);

  // Two leather mounting straps wrapping back to handlebars
  for (const sz of [-0.07, 0.07]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0055, 8, 16), darkLeatherMat);
    strap.rotation.y = Math.PI * 0.5;
    strap.position.set(-0.095, 0.055, sz);
    basketGroup.add(strap);
  }

  // Crushed ice / cloth bed inside basket + 2 shiny silver fish & cheerful coastal daisies!
  const clothBed = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8f4f8, roughness: 0.65 })
  );
  clothBed.scale.set(0.75, 0.35, 1.15);
  clothBed.position.y = 0.038;
  basketGroup.add(clothBed);

  const fishSilverMat = new THREE.MeshStandardMaterial({
    color: 0xcfe8f7,
    roughness: 0.16,
    metalness: 0.85
  });

  const basketFish = [];
  for (let f = 0; f < 2; f++) {
    const fg = new THREE.Group();
    const fBody = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), fishSilverMat);
    fBody.scale.set(2.3, 0.75, 0.55);
    fg.add(fBody);

    const fTail = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.036, 4), fishSilverMat);
    fTail.rotation.z = -Math.PI * 0.5;
    fTail.scale.set(1, 1, 0.25);
    fTail.position.x = -0.068;
    fg.add(fTail);

    fg.position.set(0.015 - f * 0.022, 0.075, f === 0 ? 0.055 : 0.005);
    fg.rotation.set(0.2 * (f ? -1 : 1), 0.55 - f * 0.4, 0.42);
    fg.traverse((c) => {
      c.userData.interactType = 'basket';
    });
    basketGroup.add(fg);
    basketFish.push(fg);
  }

  // Little coastal daisies on left side of basket
  const stemGreenMat = new THREE.MeshStandardMaterial({ color: 0x3b8f4e, roughness: 0.6 });
  const petalWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfffdf7, roughness: 0.4 });
  for (let d = 0; d < 3; d++) {
    const flowerPos = new THREE.Vector3(-0.01 + d * 0.022, 0.115 + (d % 2) * 0.018, -0.065 - d * 0.015);
    basketGroup.add(createCylinderBetween(
      new THREE.Vector3(0, 0.04, -0.05),
      flowerPos,
      0.0025, 0.0025, 5, stemGreenMat
    ));
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), brassMat);
    center.position.copy(flowerPos);
    basketGroup.add(center);
    for (let p = 0; p < 6; p++) {
      const pa = (p / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 7, 6), petalWhiteMat);
      petal.scale.set(1.5, 0.4, 0.9);
      petal.position.copy(flowerPos).add(new THREE.Vector3(Math.cos(pa) * 0.013, 0.002, Math.sin(pa) * 0.013));
      petal.rotation.y = -pa;
      basketGroup.add(petal);
    }
  }

  // =========================================================================
  // 6. STATE & UPDATE API
  // =========================================================================
  let wheelAngle = 0;
  let crankAngle = 0;
  let chainDistance = 0;
  let bellTimer = 0;
  let pinwheelAngle = 0;
  let lampManualOverride = null; // null = auto by theme, boolean = manual toggle

  const gearRatio = chainringRadius / rearCogRadius; // ~ 2.15 wheel revs per crank rev

  function ringBell() {
    bellTimer = 0.75;
  }

  function toggleLamp() {
    lampManualOverride = lampManualOverride === null ? true : !lampManualOverride;
    return lampManualOverride;
  }

  function setFrameColor(hexColor) {
    framePaintMat.color.set(hexColor);
  }

  function setLampIntensity(themeLampLevel) {
    const active = lampManualOverride !== null ? (lampManualOverride ? 1.0 : 0.0) : themeLampLevel;
    lampLensMat.emissiveIntensity = 0.25 + active * 2.2;
    beamMat.opacity = active * 0.16;
    headlampSpot.intensity = active * 5.2;
  }

  function update(dt, speed, coasting, steerAngle, bounceOffset, time) {
    // 1. Exact rolling kinematics: v = omega * R -> dTheta = (v * dt) / R
    const dWheel = (speed * dt) / wheelRadius;
    wheelAngle += dWheel;

    // Forward motion along +X corresponds to negative Z rotation in right-handed coords
    rearWheel.rotation.z = -wheelAngle;
    frontWheel.rotation.z = -headAngleRad - wheelAngle;

    // 2. Crank & chain kinematics (freewheels smoothly when coasting!)
    const targetCrankOmega = coasting ? 0.25 : (speed / wheelRadius) / gearRatio;
    const dCrank = targetCrankOmega * dt;
    crankAngle += dCrank;
    crankGroup.rotation.z = -crankAngle;

    // Counter-rotate pedals so platforms remain level + subtle natural ankling pitch!
    const rightAnkle = Math.sin(crankAngle) * 0.16;
    const leftAnkle = Math.sin(crankAngle + Math.PI) * 0.16;
    rightPedal.pedalPivot.rotation.z = crankAngle + rightAnkle;
    leftPedal.pedalPivot.rotation.z = crankAngle + leftAnkle;

    // Advance chain links along exact sprocket perimeter speed
    chainDistance += dCrank * chainringRadius;
    updateChain(chainDistance);

    // 3. Steering around the 19-degree inclined head tube axis
    steeringPivot.rotation.y = steerAngle;

    // 4. Saddle coil-spring compression from pelican's pedaling bounce
    const springComp = THREE.MathUtils.clamp(1 + bounceOffset * 4.5, 0.72, 1.22);
    saddleDeck.position.y = 0.048 + bounceOffset * 0.35;
    for (const sp of saddleSprings) {
      sp.scale.y = springComp;
    }

    // 5. Rainbow pinwheel spins joyfully with airspeed + sea breeze!
    pinwheelAngle += dt * (2.2 + speed * 3.4);
    pinwheelRotor.rotation.z = pinwheelAngle;

    // Subtle fish jiggle inside basket
    for (let i = 0; i < basketFish.length; i++) {
      basketFish[i].position.y = 0.075 + Math.max(0, bounceOffset) * 0.4 + Math.sin(time * 9 + i * 2) * 0.002;
    }

    // 6. Brass bell strike oscillation & expanding sound ring
    if (bellTimer > 0) {
      bellTimer = Math.max(0, bellTimer - dt);
      const p = 1 - bellTimer / 0.75;
      bellDome.position.y = Math.abs(Math.sin(p * Math.PI * 10)) * 0.003 * (1 - p);
      bellThumbLever.rotation.y = Math.sin(p * Math.PI * 8) * 0.35 * (1 - p);
      bellWaveRing.scale.setScalar(1 + p * 3.8);
      bellWaveMat.opacity = (1 - p) * 0.75;
    } else {
      bellWaveMat.opacity = 0;
    }

    return {
      wheelAngle,
      crankAngle,
      dWheel,
      dCrank
    };
  }

  return {
    root,
    wheelRadius,
    rearAxle,
    frontAxleWorld,
    saddleSeatTarget,
    leftPedalTarget: leftPedal.footTarget,
    rightPedalTarget: rightPedal.footTarget,
    leftGripAnchor,
    rightGripAnchor,
    bellGroup,
    ringBell,
    toggleLamp,
    setFrameColor,
    setLampIntensity,
    update
  };
}
