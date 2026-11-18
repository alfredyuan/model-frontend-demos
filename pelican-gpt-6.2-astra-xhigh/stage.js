import * as T from 'three';
import { buildCoast } from './coast.js';
import { buildCyclist } from './cyclist.js';
import { vec } from './shapes.js';
export const sunDirection = vec(-0.39, 0.091, -0.916).normalize();
export function createStage() {
  const scene = new T.Scene();
  scene.fog = new T.Fog(0xd7e6db, 16, 81);
  const sky = new T.Mesh(new T.SphereGeometry(210, 28, 14), new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sun: { value: sunDirection } },
    vertexShader: 'varying vec3 dir; void main(){ dir=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader: `varying vec3 dir; uniform vec3 sun;
    void main(){vec3 d=normalize(dir);float h=smoothstep(-.07,.27,d.y);
      vec3 c=mix(vec3(.847,.906,.845),vec3(.51,.757,.795),h);
      float r=distance(d,sun);c=mix(c,vec3(.99,.936,.757),.20*exp(-r*10.));
      c=mix(c,vec3(1.,.946,.761),1.-smoothstep(.043,.0445,r));gl_FragColor=vec4(c,1.);
    }`
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -99;
  sky.userData.sky = true;
  scene.add(sky);
  const hemi = new T.HemisphereLight(0xfff6df, 0xc3d1cc, 1.68);
  scene.add(hemi);
  const light = new T.DirectionalLight(0xfff0d1, 2.06);
  light.position.set(-3.8, 8, 4.9);
  scene.add(light);
  scene.add(light.target);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {
    left: -4.3,
    right: 4.3,
    top: 4.3,
    bottom: -4.3,
    near: 0.5,
    far: 22
  });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.normalBias = 0.015;
  light.shadow.bias = -0.00055;
  const coast = buildCoast(scene);
  const animate = buildCyclist(scene);
  function tick(time) {
    const phase = 0.17 + time * 2.32;
    coast.tick(time * 2.32 * 2.43 * 0.702, time);
    animate(phase);
  }
  tick(0);
  return {
    scene,
    sky,
    coast,
    tick
  };
}
// Camera framing uses the actual aspect ratio, including when Android rotates.
export function frameFor(w, h, name = 'postcard') {
  const aspect = w / h, narrow = aspect < 1.02, short = aspect > 2.85;
  const fov = 31, az = name === 'profile' ? 0.025 : name === 'portrait' ? 0.45 : 0.245;
  const polar = name === 'portrait' ? 0.115 : 0.092;
  let span = narrow ? Math.max(6.48, 4.36 / aspect) : 5.53;
  let x = narrow ? 0.505 : 0.604, y = narrow ? 0.653 : 0.548, aimY = 2.02, aimX = 0.04;
  if (narrow && aspect > 0.79) {
    span = 5.9;
    x = 0.56;
    y = 0.6;
  }
  if (short) {
    x = 0.585;
    y = 0.55;
    span = 5.36;
  }
  if (name === 'portrait') {
    span = narrow ? Math.max(3.7, 3.13 / aspect) : 3.7;
    aimX = 0.32;
    aimY = 2.6;
    y = narrow ? 0.66 : 0.58;
    x = narrow ? 0.49 : 0.6;
  }
  const dist = span / (2 * Math.tan(T.MathUtils.degToRad(fov / 2)));
  const target = vec(aimX, aimY, 0), offset = vec(Math.sin(az) * Math.cos(polar), Math.sin(polar), Math.cos(az) * Math.cos(polar)).multiplyScalar(dist);
  return {
    target,
    position: target.clone().add(offset),
    dist,
    fov,
    az,
    x,
    y,
    span,
    worldWidth: span * aspect
  };
}
export function lens(camera, w, h, frame) {
  camera.fov = frame.fov;
  camera.aspect = w / h;
  camera.setViewOffset(w, h, (0.5 - frame.x) * w, (0.5 - frame.y) * h, w, h);
  camera.updateProjectionMatrix();
}
