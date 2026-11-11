import * as THREE from 'three';

/**
 * Procedural Canvas2D textures & PMREM environment map generator.
 * 100% local, zero external network assets.
 */

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Weathered coastal cedar boardwalk planks (color + bump/roughness)
 */
export function createBoardwalkTextures() {
  const w = 512;
  const h = 512;
  const colorCanvas = makeCanvas(w, h);
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = makeCanvas(w, h);
  const bctx = bumpCanvas.getContext('2d');

  // Base dark gap between planks
  ctx.fillStyle = '#3a281c';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#181818';
  bctx.fillRect(0, 0, w, h);

  const plankCount = 8;
  const plankW = w / plankCount; // planks run across Z (perpendicular to X ride direction)

  // Seeded pseudo-random for deterministic beauty
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < plankCount; i++) {
    const x = i * plankW;
    const gap = 3;
    const toneShift = (rand() - 0.5) * 22;
    const r = Math.round(178 + toneShift);
    const g = Math.round(134 + toneShift * 0.8);
    const b = Math.round(92 + toneShift * 0.6);

    // Plank body
    const grad = ctx.createLinearGradient(x, 0, x + plankW, 0);
    grad.addColorStop(0, `rgb(${r - 12}, ${g - 10}, ${b - 8})`);
    grad.addColorStop(0.15, `rgb(${r}, ${g}, ${b})`);
    grad.addColorStop(0.85, `rgb(${r + 6}, ${g + 4}, ${b + 2})`);
    grad.addColorStop(1, `rgb(${r - 14}, ${g - 12}, ${b - 10})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x + gap * 0.5, 0, plankW - gap, h);

    bctx.fillStyle = '#c8c8c8';
    bctx.fillRect(x + gap * 0.5, 0, plankW - gap, h);

    // Wood grain streaks along Y
    for (let s = 0; s < 26; s++) {
      const gx = x + gap + rand() * (plankW - gap * 2);
      const alpha = 0.04 + rand() * 0.08;
      ctx.strokeStyle = rand() > 0.5 ? `rgba(85, 52, 28, ${alpha})` : `rgba(235, 198, 152, ${alpha * 0.8})`;
      ctx.lineWidth = 0.8 + rand() * 2.2;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      const wave = (rand() - 0.5) * 6;
      ctx.bezierCurveTo(gx + wave, h * 0.33, gx - wave, h * 0.66, gx, h);
      ctx.stroke();

      bctx.strokeStyle = `rgba(90, 90, 90, ${alpha * 1.4})`;
      bctx.lineWidth = 1;
      bctx.beginPath();
      bctx.moveTo(gx, 0);
      bctx.lineTo(gx, h);
      bctx.stroke();
    }

    // Cross joint & brass/iron nail heads
    const jointY = ((i * 173 + 60) % (h - 80)) + 40;
    ctx.fillStyle = 'rgba(42, 26, 16, 0.75)';
    ctx.fillRect(x + gap * 0.5, jointY, plankW - gap, 2.5);
    bctx.fillStyle = '#202020';
    bctx.fillRect(x + gap * 0.5, jointY, plankW - gap, 3);

    const nailOffsets = [-10, 10];
    for (const dy of nailOffsets) {
      for (const nx of [x + plankW * 0.28, x + plankW * 0.72]) {
        const ny = (jointY + dy + h) % h;
        ctx.fillStyle = '#4a3b31';
        ctx.beginPath();
        ctx.arc(nx, ny, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 4;

  return { map, bumpMap };
}

/**
 * Woven rattan / wicker basket texture
 */
export function createWickerTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b07e4f';
  ctx.fillRect(0, 0, size, size);

  const cells = 12;
  const step = size / cells;

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const x = col * step;
      const y = row * step;
      const even = (row + col) % 2 === 0;

      if (even) {
        const g = ctx.createLinearGradient(x, y, x, y + step);
        g.addColorStop(0, '#dbad76');
        g.addColorStop(0.5, '#fff0d6');
        g.addColorStop(1, '#c4935c');
        ctx.fillStyle = g;
        ctx.fillRect(x + 1, y + 2, step - 2, step - 4);
      } else {
        const g = ctx.createLinearGradient(x, y, x + step, y);
        g.addColorStop(0, '#c79660');
        g.addColorStop(0.5, '#f2dfc0');
        g.addColorStop(1, '#b58450');
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 1, step - 4, step - 2);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

/**
 * Striped coastal aviator scarf texture
 */
export function createScarfTexture() {
  const canvas = makeCanvas(256, 64);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e63946';
  ctx.fillRect(0, 0, 256, 64);

  // Cream & gold nautical stripes
  const stripes = [
    { x: 28, w: 12, c: '#fff3d6' },
    { x: 46, w: 5, c: '#ffb703' },
    { x: 118, w: 12, c: '#fff3d6' },
    { x: 136, w: 5, c: '#ffb703' },
    { x: 208, w: 14, c: '#fff3d6' },
    { x: 228, w: 6, c: '#ffb703' }
  ];
  for (const s of stripes) {
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x, 0, s.w, 64);
  }

  // Subtle knit weave lines
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let y = 2; y < 64; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Soft glowing circle sprite texture for particles, stars & sun glare
 */
export function createGlowSpriteTexture() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.28, 'rgba(255, 250, 235, 0.82)');
  grad.addColorStop(0.65, 'rgba(255, 235, 200, 0.22)');
  grad.addColorStop(1, 'rgba(255, 235, 200, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Tire tread & subtle cream-wall texture
 */
export function createTireTexture() {
  const canvas = makeCanvas(256, 128);
  const ctx = canvas.getContext('2d');

  // Note: In Three.js TorusGeometry, canvas Y=0 and Y=128 correspond to v=0/2pi (outer tread),
  // Y=32 and Y=96 correspond to z=+-tube (left/right whitewalls), Y=64 is inner rim bead!
  ctx.fillStyle = '#23262c';
  ctx.fillRect(0, 0, 256, 128);

  // Cream vintage whitewall bands on left & right sidewalls (around y=34 and y=94)
  ctx.fillStyle = '#f5ebd4';
  ctx.fillRect(0, 22, 256, 24);
  ctx.fillRect(0, 82, 256, 24);

  // Subtle pinstripe near rim bead
  ctx.fillStyle = '#d9cbb0';
  ctx.fillRect(0, 46, 256, 3);
  ctx.fillRect(0, 79, 256, 3);

  // Outer tread lugs near y=0..18 and y=110..128
  ctx.fillStyle = '#17191d';
  for (let x = 0; x < 256; x += 16) {
    ctx.fillRect(x + 2, 0, 9, 15);
    ctx.fillRect(x + 10, 113, 9, 15);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 1);
  return tex;
}

/**
 * Milepost wooden sign texture ("PELICAN PIER")
 */
export function createPierSignTexture() {
  const canvas = makeCanvas(512, 192);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f6eed9';
  ctx.fillRect(0, 0, 512, 192);

  ctx.strokeStyle = '#264653';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 488, 168);

  ctx.fillStyle = '#264653';
  ctx.font = 'bold 46px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PELICAN PIER', 256, 84);

  ctx.fillStyle = '#e76f51';
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillText('☀ 鹈鹕海滨栈道 ➔', 256, 142);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural PMREM environment map for crisp metallic chrome, brass & ocean reflections
 */
export function buildProceduralEnvironment(renderer, theme) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();

  // Gradient sky sphere
  const skyGeo = new THREE.SphereGeometry(40, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTop: { value: new THREE.Color(theme.skyTop) },
      uMid: { value: new THREE.Color(theme.skyHorizon) },
      uBot: { value: new THREE.Color(theme.oceanDeep) },
      uSunDir: { value: new THREE.Vector3().copy(theme.sunDir).normalize() },
      uSunColor: { value: new THREE.Color(theme.sunColor) }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBot;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      void main() {
        vec3 d = normalize(vWorldPos);
        float h = d.y;
        vec3 col = h >= 0.0
          ? mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.55))
          : mix(uMid, uBot, pow(clamp(-h, 0.0, 1.0), 0.35));
        float sunAmt = max(dot(d, uSunDir), 0.0);
        col += uSunColor * pow(sunAmt, 36.0) * 2.2;
        col += uSunColor * pow(sunAmt, 6.0) * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));

  // Bright studio bounce cards for vivid chrome highlights
  const bounceGeo = new THREE.PlaneGeometry(14, 6);
  const bounceMat = new THREE.MeshBasicMaterial({
    color: theme.sunColor,
    side: THREE.DoubleSide
  });
  const card = new THREE.Mesh(bounceGeo, bounceMat);
  card.position.copy(theme.sunDir).multiplyScalar(18);
  card.lookAt(0, 0, 0);
  envScene.add(card);

  const envRT = pmrem.fromScene(envScene, 0.02);
  skyGeo.dispose();
  skyMat.dispose();
  bounceGeo.dispose();
  bounceMat.dispose();
  pmrem.dispose();

  return envRT;
}
