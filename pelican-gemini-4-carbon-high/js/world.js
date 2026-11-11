import * as THREE from 'three';

/**
 * Coastal Boardwalk, Animated Ocean Shader, Lighthouse, Sailboats, Seagulls,
 * Three Lighting Themes, and Interactive Fish-Tossing & Particle Effects.
 */

export const THEMES = {
  sunset: {
    id: 'sunset',
    label: '加州金辉',
    skyTop: '#233c6e',
    skyMid: '#e87a5d',
    skyHorizon: '#ffd280',
    sunColor: '#ffbe5c',
    sunDir: new THREE.Vector3(-0.32, 0.24, -0.91).normalize(),
    sunIntensity: 2.8,
    hemiSky: '#ffb07c',
    hemiGround: '#594236',
    hemiIntensity: 1.05,
    fillColor: '#7ec8e3',
    fillIntensity: 0.75,
    oceanShallow: '#1ca3a8',
    oceanDeep: '#153b66',
    foamColor: '#ffe9c9',
    fogColor: '#f6b37f',
    fogDensity: 0.0065,
    nightAmount: 0.15,
    lampLevel: 0.45
  },
  sunny: {
    id: 'sunny',
    label: '晴空海风',
    skyTop: '#166cc2',
    skyMid: '#5eb5f0',
    skyHorizon: '#ccf0ff',
    sunColor: '#fff7e0',
    sunDir: new THREE.Vector3(0.28, 0.62, -0.73).normalize(),
    sunIntensity: 3.1,
    hemiSky: '#a8e0ff',
    hemiGround: '#9e7c5b',
    hemiIntensity: 1.2,
    fillColor: '#9be7ff',
    fillIntensity: 0.85,
    oceanShallow: '#00b4c8',
    oceanDeep: '#0a5282',
    foamColor: '#ffffff',
    fogColor: '#bfeaff',
    fogDensity: 0.0048,
    nightAmount: 0.0,
    lampLevel: 0.0
  },
  night: {
    id: 'night',
    label: '星夜霓虹',
    skyTop: '#070c1f',
    skyMid: '#122247',
    skyHorizon: '#233f70',
    sunColor: '#bdd6ff',
    sunDir: new THREE.Vector3(-0.22, 0.42, -0.88).normalize(),
    sunIntensity: 0.95,
    hemiSky: '#3b5998',
    hemiGround: '#1c1824',
    hemiIntensity: 0.68,
    fillColor: '#ffb76b',
    fillIntensity: 0.65,
    oceanShallow: '#0e4d68',
    oceanDeep: '#061830',
    foamColor: '#8ecae6',
    fogColor: '#15284c',
    fogDensity: 0.0075,
    nightAmount: 1.0,
    lampLevel: 1.0
  }
};

export function createWorld(scene, textures) {
  const root = new THREE.Group();
  root.name = 'CoastalWorld';
  scene.add(root);

  // =========================================================================
  // 1. LIGHTS
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0xffb07c, 0x594236, 1.05);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffbe5c, 2.8);
  dirLight.position.set(4.5, 6.8, 3.8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1.0;
  dirLight.shadow.camera.far = 22.0;
  const d = 2.8;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0006;
  dirLight.shadow.normalBias = 0.018;
  scene.add(dirLight);

  // Rim / Ocean bounce light so feathers & dark bike parts always pop!
  const fillLight = new THREE.DirectionalLight(0x7ec8e3, 0.75);
  fillLight.position.set(-4.0, 2.8, -5.0);
  scene.add(fillLight);

  // Warm pier lantern bounce point light near rider (glows warmly at night!)
  const warmPierLight = new THREE.PointLight(0xffad52, 0.3, 12, 1.4);
  warmPierLight.position.set(0.5, 2.6, -1.3);
  scene.add(warmPierLight);

  scene.fog = new THREE.FogExp2(0xf6b37f, 0.0065);

  // =========================================================================
  // 2. PROCEDURAL SKY DOME + STARFIELD
  // =========================================================================
  const skyUniforms = {
    uTop: { value: new THREE.Color(THEMES.sunset.skyTop) },
    uMid: { value: new THREE.Color(THEMES.sunset.skyMid) },
    uHorizon: { value: new THREE.Color(THEMES.sunset.skyHorizon) },
    uSunDir: { value: new THREE.Vector3().copy(THEMES.sunset.sunDir) },
    uSunColor: { value: new THREE.Color(THEMES.sunset.sunColor) },
    uNight: { value: THEMES.sunset.nightAmount }
  };

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uNight;

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 sky = h < 0.28
          ? mix(uHorizon, uMid, smoothstep(0.0, 0.28, h))
          : mix(uMid, uTop, pow((h - 0.28) / 0.72, 0.75));

        // Sun / Moon disc & warm atmospheric halo
        float sunCos = max(dot(d, normalize(uSunDir)), 0.0);
        float disc = smoothstep(0.9982, 0.9994, sunCos);
        float halo = pow(sunCos, 16.0) * (0.48 - uNight * 0.28) + pow(sunCos, 4.0) * 0.16;
        sky += uSunColor * (disc * 2.2 + halo);

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(155, 36, 24), skyMat);
  root.add(skyDome);

  // Twinkling Starfield Points (visible at Sunset twilight & Starry Night!)
  const starCount = 340;
  const starPos = new Float32Array(starCount * 3);
  let sSeed = 1337;
  const sRand = () => {
    sSeed = (sSeed * 1664525 + 1013904223) % 4294967296;
    return sSeed / 4294967296;
  };
  for (let i = 0; i < starCount; i++) {
    const theta = sRand() * Math.PI * 2;
    const phi = Math.acos(0.12 + sRand() * 0.88); // upper hemisphere
    const r = 142;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    map: textures.glowMap,
    color: 0xfff8e7,
    size: 1.55,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(starGeo, starMat);
  root.add(stars);

  // =========================================================================
  // 3. SHIMMERING ANIMATED OCEAN SHADER
  // =========================================================================
  const oceanUniforms = {
    uTime: { value: 0 },
    uScrollX: { value: 0 },
    uShallow: { value: new THREE.Color(THEMES.sunset.oceanShallow) },
    uDeep: { value: new THREE.Color(THEMES.sunset.oceanDeep) },
    uFoam: { value: new THREE.Color(THEMES.sunset.foamColor) },
    uSunDir: { value: new THREE.Vector3().copy(THEMES.sunset.sunDir) },
    uSunColor: { value: new THREE.Color(THEMES.sunset.sunColor) },
    uFogColor: { value: new THREE.Color(THEMES.sunset.fogColor) },
    uFogDensity: { value: THEMES.sunset.fogDensity }
  };

  const oceanGeo = new THREE.PlaneGeometry(260, 145, 110, 64);
  oceanGeo.rotateX(-Math.PI * 0.5);
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uScrollX;
      varying vec3 vWorldPos;
      varying float vWaveCrest;

      void main() {
        vec3 p = position;
        float wx = p.x + uScrollX * 0.35;
        float wz = p.z;

        float w1 = sin(wx * 0.24 + uTime * 1.45 + wz * 0.18) * 0.22;
        float w2 = cos(wx * 0.52 - uTime * 1.9 + wz * 0.44) * 0.11;
        float w3 = sin((wx - wz) * 0.95 + uTime * 2.6) * 0.045;

        // Gentler waves right beside pier pilings
        float nearPier = smoothstep(-1.5, -10.0, wz);
        float h = (w1 + w2) * (0.35 + 0.65 * nearPier) + w3;
        p.y += h;

        vWaveCrest = h;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScrollX;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uFoam;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      varying vec3 vWorldPos;
      varying float vWaveCrest;

      void main() {
        float distZ = clamp((-vWorldPos.z - 1.5) / 55.0, 0.0, 1.0);
        vec3 baseCol = mix(uShallow, uDeep, pow(distZ, 0.62));

        // Analytic ripple normal for glittering sun reflection path!
        float wx = vWorldPos.x + uScrollX * 0.35;
        float wz = vWorldPos.z;
        float nx = cos(wx * 0.85 + uTime * 2.1 + wz * 0.4) * 0.16 + sin(wx * 2.1 - uTime * 3.1) * 0.06;
        float nz = sin(wz * 0.95 + uTime * 1.8 - wx * 0.3) * 0.18 + cos(wz * 2.4 + uTime * 2.7) * 0.06;
        vec3 N = normalize(vec3(-nx, 1.0, -nz));

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);

        float spec = pow(max(dot(N, H), 0.0), 72.0);
        float broadGlow = pow(max(dot(N, H), 0.0), 10.0) * 0.22;

        // Sea-foam lace near pier pilings & high wave crests
        float pierFoam = smoothstep(-3.1, -1.75, vWorldPos.z) * (0.45 + 0.55 * sin(wx * 1.8 + uTime * 3.2));
        float crestFoam = smoothstep(0.19, 0.33, vWaveCrest);
        float foam = clamp(crestFoam * 0.55 + max(0.0, pierFoam) * 0.65, 0.0, 0.85);

        vec3 col = mix(baseCol, uFoam, foam);
        col += uSunColor * (spec * 1.65 + broadGlow);

        // Match scene exponential squared fog
        float viewDist = length(cameraPosition - vWorldPos);
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * viewDist * viewDist);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.set(0, -1.35, -72);
  root.add(oceanMesh);

  // =========================================================================
  // 4. INFINITE WOODEN PIER / BOARDWALK & MODULAR SCENIC PROPS
  // =========================================================================
  const deckLength = 96;
  const deckWidth = 4.6; // spans z = -1.75 (ocean railing) to z = +2.85 (beach side)
  const deckCenterZ = 0.55;

  textures.boardwalkMap.repeat.set(deckLength / 2.2, deckWidth / 2.2);
  textures.boardwalkBump.repeat.set(deckLength / 2.2, deckWidth / 2.2);

  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.boardwalkMap,
    bumpMap: textures.boardwalkBump,
    bumpScale: 0.014,
    roughness: 0.78,
    metalness: 0.04
  });

  const deckGeo = new THREE.BoxGeometry(deckLength, 0.16, deckWidth);
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.set(0, -0.08, deckCenterZ); // top surface is EXACTLY y = 0!
  deckMesh.receiveShadow = true;
  root.add(deckMesh);

  // Heavy weathered cedar edge curbs along z = -1.70 (ocean edge) and z = +2.80 (land edge)
  const timberDarkMat = new THREE.MeshStandardMaterial({ color: 0x6b472b, roughness: 0.84 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd9be93, roughness: 0.88 });
  const ironPostMat = new THREE.MeshStandardMaterial({ color: 0x26353d, roughness: 0.45, metalness: 0.7 });
  const lanternBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: 0xffaa3b,
    emissiveIntensity: 1.2,
    roughness: 0.15
  });
  const redBuoyMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.45 });
  const whitePaintMat = new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.42 });

  for (const cz of [-1.70, 2.80]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(deckLength, 0.11, 0.16), timberDarkMat);
    curb.position.set(0, 0.055, cz);
    curb.castShadow = true;
    curb.receiveShadow = true;
    root.add(curb);
  }

  // Sandy beach strip on landward side (z > +2.85) so camera turning around looks great too!
  const sandGeo = new THREE.PlaneGeometry(240, 85);
  sandGeo.rotateX(-Math.PI * 0.5);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xeed2a4, roughness: 0.92 });
  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.position.set(0, -0.55, 45);
  sandMesh.receiveShadow = true;
  root.add(sandMesh);

  // Scrolling modular Pier Segments (span = 64m, 16 segments of 4m each!)
  const segCount = 16;
  const segStep = 4.0;
  const totalSpan = segCount * segStep; // 64m seamless loop!
  const pierSegments = [];

  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.85 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x3b8c4c, roughness: 0.62, side: THREE.DoubleSide });
  const signMat = new THREE.MeshStandardMaterial({ map: textures.pierSignMap, roughness: 0.5 });

  function buildPalmTree() {
    const g = new THREE.Group();
    const trunkPts = [
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(0.15, 0.8, -0.15),
      new THREE.Vector3(0.32, 2.1, -0.35),
      new THREE.Vector3(0.42, 3.25, -0.45)
    ];
    const trunk = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 12, 0.11, 8, false),
      palmTrunkMat
    );
    trunk.castShadow = true;
    g.add(trunk);

    const crown = new THREE.Group();
    crown.position.copy(trunkPts[3]);
    g.add(crown);
    for (let f = 0; f < 7; f++) {
      const ang = (f / 7) * Math.PI * 2;
      const frondCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.55, 0.22, 0),
        new THREE.Vector3(1.15, -0.25, 0)
      ]);
      const frond = new THREE.Mesh(new THREE.TubeGeometry(frondCurve, 8, 0.06, 4, false), palmLeafMat);
      frond.scale.set(1, 0.22, 2.4);
      frond.rotation.y = ang;
      crown.add(frond);
    }
    return g;
  }

  for (let i = 0; i < segCount; i++) {
    const seg = new THREE.Group();
    seg.userData.baseX = (i - segCount * 0.5) * segStep;

    // 1) Underwater wooden pilings supporting the pier
    for (const pz of [-1.55, 2.55]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 2.0, 10), timberDarkMat);
      piling.position.set(0, -1.0, pz);
      seg.add(piling);
    }

    // 2) Oceanfront wooden bollard post at z = -1.68 + sagging nautical hemp rope to next post!
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.84, 12), timberDarkMat);
    bollard.position.set(0, 0.42, -1.68);
    bollard.castShadow = true;
    bollard.receiveShadow = true;
    seg.add(bollard);

    const bollardCap = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), whitePaintMat);
    bollardCap.scale.y = 0.45;
    bollardCap.position.set(0, 0.85, -1.68);
    seg.add(bollardCap);

    // Sagging catenary rope spanning +4.0m to next bollard
    const ropePts = [
      new THREE.Vector3(0, 0.68, -1.68),
      new THREE.Vector3(segStep * 0.25, 0.50, -1.68),
      new THREE.Vector3(segStep * 0.50, 0.44, -1.68),
      new THREE.Vector3(segStep * 0.75, 0.50, -1.68),
      new THREE.Vector3(segStep, 0.68, -1.68)
    ];
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts), 14, 0.016, 6, false),
      ropeMat
    );
    rope.castShadow = true;
    seg.add(rope);

    // 3) Every 3rd segment: Vintage Coastal Festoon Lamp Post + Life Ring!
    if (i % 3 === 0) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.055, 2.85, 10), ironPostMat);
      post.position.set(segStep * 0.5, 1.42, -1.68);
      post.castShadow = true;
      seg.add(post);

      // Curved lamp arm + glowing warm globe lantern
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(segStep * 0.5, 2.75, -1.68),
        new THREE.Vector3(segStep * 0.5, 3.05, -1.42),
        new THREE.Vector3(segStep * 0.5, 2.88, -1.18)
      ]);
      seg.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.02, 6, false), ironPostMat));

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lanternBulbMat);
      bulb.position.set(segStep * 0.5, 2.76, -1.18);
      seg.add(bulb);

      // Classic red-and-white lifebuoy ring hung on the lamp post!
      const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.055, 10, 20), redBuoyMat);
      buoy.position.set(segStep * 0.5, 1.15, -1.59);
      buoy.castShadow = true;
      seg.add(buoy);
      for (let b = 0; b < 4; b++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.058, 8, 6, 0.35), whitePaintMat);
        band.position.copy(buoy.position);
        band.rotation.z = (b / 4) * Math.PI * 2;
        seg.add(band);
      }
    }

    // 4) Milepost wooden sign ("PELICAN PIER") twice per loop
    if (i === 2 || i === 10) {
      const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.55, 8), timberDarkMat);
      signPost.position.set(segStep * 0.5, 0.77, -1.66);
      seg.add(signPost);

      const board = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.36, 0.04), signMat);
      board.position.set(segStep * 0.5, 1.38, -1.62);
      board.castShadow = true;
      seg.add(board);
    }

    // 5) Landward palm trees set well back at z = +4.6 so camera orbit is 100% unobstructed!
    if (i % 4 === 1) {
      const palm = buildPalmTree();
      palm.position.set(segStep * 0.3, 0, 4.8 + (i % 3) * 0.9);
      palm.rotation.y = i * 1.1;
      seg.add(palm);
    }

    root.add(seg);
    pierSegments.push(seg);
  }

  // =========================================================================
  // 5. SCENIC DISTANT BAY: STRIPED LIGHTHOUSE, SAILBOATS, CLOUDS & SEAGULLS
  // =========================================================================
  // Cape Headland + Striped Red-and-White Lighthouse
  const lighthouseGroup = new THREE.Group();
  lighthouseGroup.position.set(34, -1.3, -58);
  root.add(lighthouseGroup);

  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x5c534c, roughness: 0.92 });
  const cliff = new THREE.Mesh(new THREE.DodecahedronGeometry(9.5, 1), cliffMat);
  cliff.scale.set(1.9, 0.52, 1.3);
  cliff.position.set(-2, 1.5, 0);
  lighthouseGroup.add(cliff);

  // Striped lighthouse tower (5 alternating bands)
  for (let s = 0; s < 5; s++) {
    const rBot = 1.45 - s * 0.13;
    const rTop = 1.45 - (s + 1) * 0.13;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 1.85, 16),
      s % 2 === 0 ? whitePaintMat : redBuoyMat
    );
    band.position.y = 4.2 + s * 1.85;
    lighthouseGroup.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.95, 0.35, 16), ironPostMat);
  gallery.position.y = 12.65;
  lighthouseGroup.add(gallery);

  const lanternRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.2, 14), lanternBulbMat);
  lanternRoom.position.y = 13.4;
  lighthouseGroup.add(lanternRoom);

  const roofCap = new THREE.Mesh(new THREE.ConeGeometry(0.92, 0.95, 16), redBuoyMat);
  roofCap.position.y = 14.45;
  lighthouseGroup.add(roofCap);

  // Rotating Lighthouse Beacon Beam (shines dramatically at Sunset/Night!)
  const beaconPivot = new THREE.Group();
  beaconPivot.position.y = 13.4;
  lighthouseGroup.add(beaconPivot);

  const beaconGeo = new THREE.ConeGeometry(3.6, 36, 20, 1, true);
  beaconGeo.translate(0, -18, 0);
  beaconGeo.rotateZ(Math.PI * 0.5);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffe49e,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const beaconCone = new THREE.Mesh(beaconGeo, beaconMat);
  beaconPivot.add(beaconCone);

  // 3 Sailboats gliding across the bay
  const sailboats = [];
  for (let b = 0; b < 3; b++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.28, 2.8, 10),
      b === 1 ? redBuoyMat : whitePaintMat
    );
    hull.rotation.z = Math.PI * 0.5;
    hull.scale.set(1, 1, 0.55);
    boat.add(hull);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.6, 8), timberDarkMat);
    mast.position.y = 1.8;
    boat.add(mast);

    // Main triangular sail
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0.35);
    sailShape.lineTo(0, 3.45);
    sailShape.lineTo(-1.55, 0.45);
    sailShape.closePath();
    const sail = new THREE.Mesh(
      new THREE.ShapeGeometry(sailShape),
      new THREE.MeshStandardMaterial({ color: 0xfffcf2, roughness: 0.5, side: THREE.DoubleSide })
    );
    sail.rotation.y = 0.25;
    boat.add(sail);

    boat.position.set(-22 + b * 24, -1.25, -24 - b * 11);
    boat.scale.setScalar(0.95 - b * 0.12);
    root.add(boat);
    sailboats.push({ group: boat, baseZ: boat.position.z, speed: 0.55 + b * 0.2, phase: b * 2.1 });
  }

  // Stylized Puffy 3D Clouds
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xfffaf2,
    roughness: 0.85,
    metalness: 0.0
  });
  const clouds = [];
  for (let c = 0; c < 8; c++) {
    const cg = new THREE.Group();
    const puffs = 4 + (c % 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + (p % 2) * 0.9, 12, 10), cloudMat);
      puff.position.set((p - puffs * 0.5) * 2.1, (p % 2) * 0.65, (p % 3 - 1) * 0.6);
      puff.scale.set(1.3, 0.78, 0.9);
      cg.add(puff);
    }
    cg.position.set(-55 + c * 17, 15 + (c % 3) * 4.5, -38 - (c % 4) * 14);
    root.add(cg);
    clouds.push(cg);
  }

  // 6 Animated Flapping Seagulls wheeling in the coastal breeze!
  const seagulls = [];
  const gullWingGeo = new THREE.PlaneGeometry(0.38, 0.13, 2, 1);
  gullWingGeo.translate(0.19, 0, 0);
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide });

  for (let g = 0; g < 6; g++) {
    const bird = new THREE.Group();
    const gBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.16, 4, 8), gullMat);
    gBody.rotation.z = Math.PI * 0.5;
    bird.add(gBody);

    const wL = new THREE.Mesh(gullWingGeo, gullMat);
    wL.rotation.x = Math.PI * 0.5;
    wL.rotation.z = Math.PI * 0.5;
    const wR = new THREE.Mesh(gullWingGeo, gullMat);
    wR.rotation.x = Math.PI * 0.5;
    wR.rotation.z = -Math.PI * 0.5;
    bird.add(wL, wR);

    root.add(bird);
    seagulls.push({
      bird,
      wL,
      wR,
      centerX: -6 + g * 5.5,
      centerY: 3.4 + (g % 3) * 1.4,
      centerZ: -5.5 - g * 3.2,
      radius: 3.2 + (g % 2) * 2.0,
      speed: 0.65 + g * 0.08,
      phase: g * 1.3
    });
  }

  // =========================================================================
  // 6. INTERACTIVE FISH TOSSING & PARTICLE EFFECTS (Splash + Wind Streaks)
  // =========================================================================
  const fishMat = new THREE.MeshStandardMaterial({
    color: 0xbde4ff,
    emissive: 0x16425b,
    emissiveIntensity: 0.2,
    roughness: 0.14,
    metalness: 0.88
  });

  function createFishMesh() {
    const fg = new THREE.Group();
    const fBody = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), fishMat);
    fBody.scale.set(2.4, 0.82, 0.55);
    fBody.castShadow = true;
    fg.add(fBody);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.068, 4), fishMat);
    tail.rotation.z = -Math.PI * 0.5;
    tail.scale.set(1, 1, 0.25);
    tail.position.x = -0.125;
    fg.add(tail);
    fg.userData.tail = tail;
    return fg;
  }

  const activeFishes = []; // { mesh, start, progress, duration, arcHeight }
  const splashParticles = [];

  const splashGeo = new THREE.SphereGeometry(0.022, 6, 6);
  const splashMat = new THREE.MeshBasicMaterial({ color: 0x80ed99 });
  const splashGoldMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });

  function spawnSplashBurst(worldPos, count = 14) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(splashGeo, i % 2 === 0 ? splashGoldMat : splashMat);
      m.position.copy(worldPos);
      const a = (i / count) * Math.PI * 2;
      const spd = 1.1 + (i % 3) * 0.55;
      const vel = new THREE.Vector3(
        Math.cos(a) * spd * 0.7,
        1.4 + (i % 4) * 0.45,
        Math.sin(a) * spd
      );
      root.add(m);
      splashParticles.push({ mesh: m, vel, life: 0.58, maxLife: 0.58 });
    }
  }

  function tossFishTowardPelican(customStartWorld) {
    const mesh = createFishMesh();
    const start = customStartWorld
      ? customStartWorld.clone()
      : new THREE.Vector3(
          2.6 + (Math.random() - 0.5) * 0.8,
          0.35,
          -2.4 + (Math.random() - 0.3) * 0.9
        );
    mesh.position.copy(start);
    root.add(mesh);
    spawnSplashBurst(start, 8);

    activeFishes.push({
      mesh,
      start,
      progress: 0,
      duration: 0.74,
      arcHeight: 1.05 + Math.random() * 0.35
    });
  }

  // Turbo Wind Streak Lines around rider!
  const windCount = 26;
  const windDummy = new THREE.Object3D();
  const windGeo = new THREE.BoxGeometry(0.65, 0.009, 0.009);
  const windMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const windInst = new THREE.InstancedMesh(windGeo, windMat, windCount);
  root.add(windInst);

  const windParticles = [];
  for (let i = 0; i < windCount; i++) {
    windParticles.push({
      x: (Math.random() - 0.5) * 6.5,
      y: 0.35 + Math.random() * 1.65,
      z: (Math.random() - 0.5) * 2.6,
      len: 0.6 + Math.random() * 1.1,
      speedMul: 0.85 + Math.random() * 0.5
    });
  }

  // =========================================================================
  // 7. THEME SWITCHER & FRAME UPDATE
  // =========================================================================
  let scrollDistance = 0;
  let currentTheme = THEMES.sunset;

  function applyTheme(themeKey) {
    const t = THEMES[themeKey] || THEMES.sunset;
    currentTheme = t;

    skyUniforms.uTop.value.set(t.skyTop);
    skyUniforms.uMid.value.set(t.skyMid);
    skyUniforms.uHorizon.value.set(t.skyHorizon);
    skyUniforms.uSunDir.value.copy(t.sunDir);
    skyUniforms.uSunColor.value.set(t.sunColor);
    skyUniforms.uNight.value = t.nightAmount;

    oceanUniforms.uShallow.value.set(t.oceanShallow);
    oceanUniforms.uDeep.value.set(t.oceanDeep);
    oceanUniforms.uFoam.value.set(t.foamColor);
    oceanUniforms.uSunDir.value.copy(t.sunDir);
    oceanUniforms.uSunColor.value.set(t.sunColor);
    oceanUniforms.uFogColor.value.set(t.fogColor);
    oceanUniforms.uFogDensity.value = t.fogDensity;

    scene.fog.color.set(t.fogColor);
    scene.fog.density = t.fogDensity;

    dirLight.color.set(t.sunColor);
    dirLight.intensity = t.sunIntensity;
    hemiLight.color.set(t.hemiSky);
    hemiLight.groundColor.set(t.hemiGround);
    hemiLight.intensity = t.hemiIntensity;
    fillLight.color.set(t.fillColor);
    fillLight.intensity = t.fillIntensity;

    starMat.opacity = t.nightAmount > 0.5 ? 0.85 : t.nightAmount * 0.6;
    lanternBulbMat.emissiveIntensity = 0.35 + t.lampLevel * 2.4;
    warmPierLight.intensity = t.lampLevel * 1.65;
    beaconMat.opacity = t.lampLevel * 0.22;
    cloudMat.color.set(t.nightAmount > 0.5 ? '#35486b' : t.id === 'sunset' ? '#ffe3cc' : '#ffffff');

    return t;
  }

  const _mouthWorld = new THREE.Vector3();
  const _prevFishPos = new THREE.Vector3();

  function update(dt, time, speed, turboFactor, pelican, onFishCaught) {
    scrollDistance += speed * dt;

    // 1. Scroll boardwalk plank texture seamlessly (exact match to ground speed!)
    // Boardwalk UV repeat X is (deckLength / 2.2), so 1 meter = 1 / 2.2 UV units!
    const uvOffset = (scrollDistance / 2.2) % 1;
    textures.boardwalkMap.offset.x = uvOffset;
    textures.boardwalkBump.offset.x = uvOffset;

    // 2. Scroll modular pier railings, bollards, lamps & palms in a 64m loop!
    for (let i = 0; i < pierSegments.length; i++) {
      const seg = pierSegments[i];
      let relX = seg.userData.baseX - (scrollDistance % totalSpan);
      if (relX < -totalSpan * 0.5) relX += totalSpan;
      if (relX > totalSpan * 0.5) relX -= totalSpan;
      seg.position.x = relX;
    }

    // 3. Update Ocean shader & bobbing sailboats
    oceanUniforms.uTime.value = time;
    oceanUniforms.uScrollX.value = scrollDistance;

    for (const sb of sailboats) {
      sb.group.position.x -= (speed * 0.04 - sb.speed * 0.25) * dt;
      if (sb.group.position.x < -55) sb.group.position.x = 55;
      if (sb.group.position.x > 55) sb.group.position.x = -55;
      sb.group.position.y = -1.25 + Math.sin(time * 1.8 + sb.phase) * 0.09;
      sb.group.rotation.z = Math.sin(time * 1.5 + sb.phase) * 0.06;
      sb.group.rotation.x = Math.cos(time * 1.3 + sb.phase) * 0.05;
    }

    // Lighthouse rotating beam & gentle star twinkle
    beaconPivot.rotation.y = time * 0.85;

    // Drifting clouds
    for (const c of clouds) {
      c.position.x -= (speed * 0.05 + 0.35) * dt;
      if (c.position.x < -72) c.position.x = 72;
    }

    // 4. Wheeling & flapping coastal seagulls
    for (const g of seagulls) {
      const a = time * g.speed + g.phase;
      const gx = g.centerX + Math.cos(a) * g.radius;
      const gz = g.centerZ + Math.sin(a) * g.radius * 0.65;
      const gy = g.centerY + Math.sin(a * 2.0) * 0.35;
      g.bird.position.set(gx, gy, gz);
      g.bird.rotation.y = -a + Math.PI * 0.5;
      const flap = Math.sin(time * 9.5 + g.phase * 3) * 0.58;
      g.wL.rotation.y = flap;
      g.wR.rotation.y = -flap;
    }

    // 5. Update Flying Fish Projectiles -> Track Pelican's Open Mouth!
    pelican.mouthCatchTarget.getWorldPosition(_mouthWorld);
    for (let i = activeFishes.length - 1; i >= 0; i--) {
      const f = activeFishes[i];
      _prevFishPos.copy(f.mesh.position);
      f.progress += dt / f.duration;

      if (f.progress >= 1.0) {
        // CAUGHT RIGHT IN THE PELICAN'S GIANT GULAR POUCH!!
        spawnSplashBurst(_mouthWorld, 16);
        root.remove(f.mesh);
        activeFishes.splice(i, 1);
        if (onFishCaught) onFishCaught();
        continue;
      }

      const p = f.progress;
      f.mesh.position.lerpVectors(f.start, _mouthWorld, p);
      f.mesh.position.y += Math.sin(p * Math.PI) * f.arcHeight;

      // Orient fish nose along flight tangent + rapid tail wiggle!
      const tangent = _prevFishPos.subVectors(f.mesh.position, _prevFishPos);
      if (tangent.lengthSq() > 1e-6) {
        f.mesh.lookAt(
          f.mesh.position.x + tangent.y * 0,
          f.mesh.position.y,
          f.mesh.position.z
        );
        // Align fish +X axis along velocity
        const velDir = tangent.normalize();
        f.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), velDir);
      }
      f.mesh.userData.tail.rotation.y = Math.sin(time * 38) * 0.55;
    }

    // 6. Update Splash Droplets
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const sp = splashParticles[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        root.remove(sp.mesh);
        splashParticles.splice(i, 1);
        continue;
      }
      sp.vel.y -= 7.5 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      sp.mesh.scale.setScalar(sp.life / sp.maxLife);
    }

    // 7. Speed / Turbo Wind Streaks
    const streakVis = THREE.MathUtils.clamp((speed - 4.2) / 5.5 + turboFactor * 0.65, 0, 1);
    windMat.opacity = streakVis * 0.42;
    if (streakVis > 0.01) {
      windInst.visible = true;
      for (let i = 0; i < windCount; i++) {
        const wp = windParticles[i];
        wp.x -= speed * wp.speedMul * 2.2 * dt;
        if (wp.x < -3.4) {
          wp.x = 3.4;
          wp.y = 0.3 + Math.random() * 1.75;
          wp.z = (Math.random() - 0.5) * 2.6;
        }
        windDummy.position.set(wp.x, wp.y, wp.z);
        windDummy.scale.set(wp.len * (0.6 + turboFactor * 1.1), 1, 1);
        windDummy.updateMatrix();
        windInst.setMatrixAt(i, windDummy.matrix);
      }
      windInst.instanceMatrix.needsUpdate = true;
    } else {
      windInst.visible = false;
    }

    return {
      incomingFishPos: activeFishes.length > 0 ? activeFishes[0].mesh.position : null,
      scrollDistance
    };
  }

  return {
    root,
    currentTheme: () => currentTheme,
    applyTheme,
    tossFishTowardPelican,
    spawnSplashBurst,
    update
  };
}
