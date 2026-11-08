import * as THREE from 'three'

/**
 * The storm overhead (a dome with drifting clouds posterized into hard bands,
 * dithered, a moon behind them) and the rain falling around the camera.
 */
export const FOG_COLOR = new THREE.Color(0x0d1015)
export const MOON_DIR = new THREE.Vector3(-0.38, 0.33, -1).normalize()

const NOISE = /* glsl */ `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
`

export function createSky() {
  const uniforms = {
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uBlood: { value: 0 },
    uClouds: { value: 0.6 },
    uMoon: { value: MOON_DIR.clone() },
    uHorizon: { value: FOG_COLOR.clone() },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash, uBlood, uClouds;
      uniform vec3 uMoon, uHorizon;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        float dith = bayer4(gl_FragCoord.xy);
        // clouds painted on a flat ceiling above the churchyard
        vec2 c = d.xz / (d.y + 0.12) * 0.55 + vec2(uTime * 0.012, uTime * 0.004);
        float n = snoise(c * 0.8) * 0.6 + snoise(c * 2.1 + 3.0) * 0.3 + snoise(c * 5.0 - uTime * 0.02) * 0.1;
        n = n * 0.5 + 0.5 + (uClouds - 0.5) * 0.7;
        float md = acos(clamp(dot(d, uMoon), -1.0, 1.0));
        float moonGlow = exp(-md * 5.0);

        vec3 top = vec3(0.018, 0.02, 0.03);
        vec3 col = mix(uHorizon * 1.15, top, smoothstep(0.0, 0.45, h));
        // cloud bands, dithered
        float v = n + (dith - 0.5) * 0.14;
        vec3 cloud = mix(vec3(0.03, 0.035, 0.045), vec3(0.075, 0.08, 0.095), step(0.62, v));
        cloud = mix(cloud, vec3(0.2, 0.21, 0.24), step(0.9, v + moonGlow * 0.5));
        col = mix(col, cloud, step(0.45, v) * smoothstep(0.0, 0.08, h));
        // stars in the gaps
        if (v < 0.4 && h > 0.15) {
          vec2 sp = floor(d.xz / (d.y + 0.3) * 260.0);
          float s = fract(sin(dot(sp, vec2(41.3, 289.1))) * 43758.5453);
          if (s > 0.995) col += vec3(0.35) * (0.5 + 0.5 * sin(uTime * 2.0 + s * 300.0));
        }
        // the moon, and its halo through the clouds
        vec3 moon = mix(vec3(0.85, 0.86, 0.82), vec3(0.85, 0.15, 0.12), uBlood);
        if (md < 0.045) {
          float crater = step(0.3, snoise(d.xy * 90.0));
          col = mix(col, moon * (1.0 - crater * 0.15), v < 0.75 ? 1.0 : 0.35);
        } else {
          col += moon * floor(moonGlow * 4.0 + dith) / 4.0 * 0.06;
        }
        col = mix(col, col * vec3(1.6, 0.4, 0.4) + vec3(0.03, 0.0, 0.0), uBlood * 0.8);
        col += vec3(0.55, 0.57, 0.62) * uFlash * (0.4 + 0.6 * step(0.5, v));
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat)
  dome.frustumCulled = false
  dome.renderOrder = -1
  return { mesh: dome, uniforms }
}

/** Rain: short streaks that wrap around a box following the camera. */
export function createRain(count = 2400) {
  const BOX = new THREE.Vector3(26, 16, 26)
  const seeds = new Float32Array(count * 2 * 4)
  const ends = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()]
    for (let e = 0; e < 2; e++) {
      seeds.set(s, (i * 2 + e) * 4)
      ends[i * 2 + e] = e
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3),
  )
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
  g.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))
  const uniforms = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uBox: { value: BOX },
    uDensity: { value: 0.5 },
    uWind: { value: 0.15 },
    uFlash: { value: 0 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute float aEnd;
      uniform float uTime, uDensity, uWind;
      uniform vec3 uCam, uBox;
      varying float vAlpha;
      void main() {
        float speed = 13.0 + aSeed.w * 5.0;
        vec3 p = aSeed.xyz * uBox;
        p.y -= uTime * speed;
        p.x -= uTime * speed * uWind;
        // wrap into a box centred on the camera
        p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
        p.y += 4.0;
        float len = 0.45;
        p += aEnd * vec3(-uWind * len, -len, 0.0);
        vAlpha = step(aSeed.w, uDensity) * (1.0 - aEnd * 0.7);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vAlpha *= smoothstep(14.0, 3.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFlash;
      varying float vAlpha;
      void main() {
        if (vAlpha < 0.02) discard;
        gl_FragColor = vec4(vec3(0.55, 0.6, 0.68) + uFlash * 0.4, vAlpha * 0.22);
      }`,
  })
  const lines = new THREE.LineSegments(g, mat)
  lines.frustumCulled = false
  return { mesh: lines, uniforms }
}
