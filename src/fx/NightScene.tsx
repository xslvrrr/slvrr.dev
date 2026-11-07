import { useEffect, useRef, useState } from 'react'
import { buildScene, type Light, type Scene } from '@/scene/buildScene'
import { sfx } from '@/lib/sfx'
import { onStrike, strike } from '@/lib/storm'
import { modeStore } from '@/lib/store'
import {
  bgThemes,
  bloodMoonSky,
  type BgTheme,
  type BgThemeName,
} from '@/styles/backgroundThemes'

/**
 * The page background: night outside a gothic cathedral, from its garden, in a
 * storm. Drawn as big crisp pixels: storm clouds posterized into four bands
 * with ordered dithering, a moon, lightning, two layers of rain, ground fog,
 * and the cathedral and garden (pre-drawn by buildScene) lit by moonlight,
 * lightning and flickering candlelit glass.
 *
 * Scrolling slides the layers at different speeds (you slowly descend from
 * the spires into the garden), and each section's `data-bg` theme sets the
 * weather (see backgroundThemes.ts).
 *
 * Deliberately cheap: plain WebGL, one full-screen triangle, one shader pixel
 * per PIXEL×PIXEL CSS pixels (upscaled with nearest-neighbour), 30 fps.
 */

const FPS = 30
const MAX_LIGHTS = 10
/** Lights 0–5 belong to the cathedral, 6–9 to the garden. */
const GARDEN_LIGHTS_AT = 6

/** Size of one background pixel in CSS pixels: ~250 rows tall, 170+ columns wide. */
function pixelSize() {
  const p = Math.round(Math.min(window.innerHeight / 250, window.innerWidth / 170))
  return Math.min(5, Math.max(2, p))
}

const vertex = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const fragment = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC0, uC1, uC2, uC3;
uniform float uRain, uClouds, uFog, uGlow, uWind, uDrift;
uniform float uFlash, uBoltAlpha;
uniform vec3 uBolt;          // x, end row, seed
uniform float uSkyOff, uCathOff, uGardenOff, uGardenGround;
uniform sampler2D uCath, uGarden;
uniform vec2 uCathSize, uGardenSize;
uniform vec4 uMoon;          // x, y, radius, blood (0..1)
uniform vec4 uLights[${MAX_LIGHTS}];   // x, y (screen rows), radius, power
uniform vec3 uLightCol[${MAX_LIGHTS}];

// 2D simplex noise, Ashima Arts / Stefan Gustavson (MIT).
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

float hash1(float n) { return fract(sin(n * 127.1 + 0.31) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

// 4x4 ordered-dither threshold in [0, 1), one cell per pixel.
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

vec4 layer(sampler2D tex, vec2 size, float off, vec2 p) {
  vec2 q = vec2(p.x, p.y + off);
  if (q.x < 0.0 || q.x >= size.x || q.y < 0.0 || q.y >= size.y) return vec4(0.0);
  return texture2D(tex, (q + 0.5) / size);
}

vec3 glassColor(float g) {
  if (g < 1.5) return vec3(0.95, 0.62, 0.24);   // candle
  if (g < 2.5) return vec3(0.74, 0.17, 0.27);   // crimson
  if (g < 3.5) return vec3(0.22, 0.36, 0.78);   // sapphire
  if (g < 4.5) return vec3(0.5, 0.27, 0.72);    // violet
  if (g < 5.5) return vec3(0.16, 0.55, 0.42);   // emerald
  if (g < 6.5) return vec3(0.035, 0.03, 0.055); // lead / darkness
  return vec3(1.0, 0.88, 0.58);                 // flame
}

// Candle flicker, stepped so it reads as pixel-art animation.
float flicker(float seed) {
  float t = uTime;
  float f = 0.5 + 0.5 * sin(t * 6.3 + seed * 41.0) * sin(t * 2.1 + seed * 13.0);
  return 0.72 + 0.28 * floor(f * 4.0) / 4.0;
}

// Shade one solid pixel of a layer: stone lit by moon and lightning, or glass.
vec3 material(vec4 t, vec4 upRight, float edge, vec3 s1, vec3 s3, vec3 s4, vec3 rim) {
  float glass = floor(t.g * 255.0 / 32.0 + 0.5);
  if (glass > 0.5) {
    vec3 c = glassColor(glass);
    if (glass > 5.5 && glass < 6.5) return c;
    // seeds of 128+ mark the dimmer windows of the side wings
    float lit = uGlow * flicker(t.b) * mix(1.0, 0.5, step(0.5, t.b));
    return mix(c * 0.12, c, lit);
  }
  float shade = floor(t.r * 255.0 / 50.0 + 0.5);
  vec3 c = s1;
  if (shade > 1.5) c = mix(s1, s3, 0.45);
  if (shade > 2.5) c = s3;
  if (shade > 3.5) c = s4;
  // moonlight catches edges facing the moon (up and to the right)
  if (upRight.a < 0.5) c = mix(c, rim, 0.55);
  // lightning outlines everything
  c = mix(c, c * 1.8 + vec3(0.05, 0.05, 0.1), uFlash * 0.35);
  c = mix(c, vec3(0.78, 0.8, 1.0), edge * uFlash * 0.8);
  return c;
}

float edgeOf(sampler2D tex, vec2 size, float off, vec2 p) {
  float e = 0.0;
  e += 1.0 - step(0.5, layer(tex, size, off, p + vec2(1.0, 0.0)).a);
  e += 1.0 - step(0.5, layer(tex, size, off, p - vec2(1.0, 0.0)).a);
  e += 1.0 - step(0.5, layer(tex, size, off, p - vec2(0.0, 1.0)).a);
  return min(e, 1.0);
}

// Pixel rain: slanted columns of short streaks, each column at its own pace.
float rain(vec2 p, float spacing, float speed, float len, float dens, float seed) {
  float u = p.x - floor(p.y * uWind);
  if (mod(u, spacing) > 0.5) return 0.0;
  float col = floor(u / spacing);
  float r = hash1(col * 1.37 + seed);
  if (r > dens) return 0.0;
  float period = 40.0 + 80.0 * hash1(col * 2.11 + seed);
  float y = p.y - uTime * speed * (0.8 + 0.4 * r) + hash1(col * 3.7 + seed) * period;
  return step(mod(y, period), len);
}

// A jagged bolt: straight segments between noisy nodes.
float boltX(float y, float seed) {
  float seg = 6.0;
  float i = floor(y / seg);
  float f = fract(y / seg);
  float a = snoise(vec2(i * 0.21, seed)) * 14.0 + (hash1(i + seed) - 0.5) * 7.0;
  float b = snoise(vec2((i + 1.0) * 0.21, seed)) * 14.0 + (hash1(i + 1.0 + seed) - 0.5) * 7.0;
  return mix(a, b, f);
}

vec3 halos(vec2 p, vec3 col, int from, int to) {
  float d4 = bayer4(p);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i < from || i >= to) continue;
    vec4 L = uLights[i];
    if (L.w <= 0.0) continue;
    float d = length(p - L.xy) / L.z;
    float a = max(0.0, 1.0 - d);
    a = a * a * L.w * uGlow;
    // posterized rings with dithered edges
    a = floor(a * 5.0 + d4) / 5.0;
    col += uLightCol[i] * a * 0.3;
  }
  return col;
}

void main() {
  vec2 p = floor(gl_FragCoord.xy);
  p.y = uRes.y - 1.0 - p.y; // rows from the top
  float H = uRes.y;
  float t = uTime;
  float d4 = bayer4(p);

  // ---- sky: drifting storm clouds in four posterized bands ----
  vec2 sp = vec2(p.x, p.y + uSkyOff);
  vec2 c = vec2(sp.x / (H * 0.95), sp.y / (H * 0.32));
  float drift = t * uDrift;
  vec2 q = vec2(
    snoise(c * 0.7 + vec2(drift * 0.03, 0.0)),
    snoise(c * 0.7 + vec2(3.1, 7.7) - vec2(drift * 0.02, 0.0))
  );
  float n = snoise(c + 0.9 * q + vec2(drift * 0.06, 0.0));
  float n2 = snoise(c * 2.4 + q + vec2(drift * 0.1, 3.0));
  float v = (n * 0.65 + n2 * 0.35) * 0.5 + 0.5;
  v += (uClouds - 0.5) * 0.9;
  v += (p.y / H) * 0.12;

  float md = length(p - uMoon.xy) / uMoon.z;
  float moonLight = exp(-md * 0.45);
  float lit = v + moonLight * 0.4 * step(0.45, v);
  v += (d4 - 0.5) * 0.12;
  lit += (d4 - 0.5) * 0.12;

  vec3 col = uC0;
  col = mix(col, uC1, step(0.42, v));
  col = mix(col, uC2, step(0.64, v));
  col = mix(col, uC3, step(0.97, lit));

  // stars in the gaps
  if (v < 0.4) {
    float s = hash2(floor(sp));
    if (s > 0.996) {
      float tw = floor((0.5 + 0.5 * sin(t * 2.0 + s * 300.0)) * 3.0) / 3.0;
      col = mix(col, vec3(0.85, 0.83, 0.92), 0.25 + 0.5 * tw);
    }
  }

  // the moon, behind the thicker clouds
  vec3 moonCol = mix(vec3(0.92, 0.9, 0.83), vec3(0.85, 0.2, 0.18), uMoon.w);
  if (md < 1.0 && v < 0.6) {
    float crater = step(0.35, snoise((p - uMoon.xy) / (uMoon.z * 0.45) + 4.0));
    vec2 dir = (p - uMoon.xy) / uMoon.z;
    float shadow = step(0.55, dot(dir, vec2(-0.7, 0.7)) + md * 0.2);
    col = moonCol * (1.0 - crater * 0.14) * (1.0 - shadow * 0.18);
  } else if (md < 2.8 && v < 0.6) {
    // dithered halo rings
    float a = floor((2.8 - md) / 1.8 * 3.0 + d4) / 3.0;
    col += moonCol * a * 0.07;
  }

  // lightning flash lifts the whole sky
  col = mix(col, uC3 * 1.5 + vec3(0.1, 0.1, 0.16), uFlash * 0.55);

  // the bolt, behind the cathedral
  if (uBoltAlpha > 0.0 && p.y <= uBolt.y) {
    float dx = abs(p.x - (uBolt.x + boltX(p.y, uBolt.z)));
    float y0 = uBolt.y * 0.35;
    float dir = hash1(uBolt.z) > 0.5 ? 1.0 : -1.0;
    float bx = uBolt.x + boltX(y0, uBolt.z) + (p.y - y0) * dir * 0.6 + boltX(p.y, uBolt.z + 7.0) * 0.4;
    float db = (p.y > y0 && p.y < uBolt.y * 0.75) ? abs(p.x - bx) : 99.0;
    vec3 boltCol = vec3(0.92, 0.92, 1.0);
    if (dx < 0.75 || db < 0.5) col = mix(col, boltCol, uBoltAlpha);
    else if (dx < 2.5) col = mix(col, vec3(0.6, 0.6, 0.95), 0.45 * uBoltAlpha);
  }

  // ---- the cathedral ----
  vec4 ct = layer(uCath, uCathSize, uCathOff, p);
  if (ct.a > 0.5) {
    vec4 ur = layer(uCath, uCathSize, uCathOff, p + vec2(1.0, -1.0));
    float e = uFlash > 0.0 ? edgeOf(uCath, uCathSize, uCathOff, p) : 0.0;
    col = material(ct, ur, e,
      vec3(0.075, 0.068, 0.11), vec3(0.15, 0.14, 0.21), vec3(0.26, 0.25, 0.36),
      vec3(0.33, 0.32, 0.46));
  }
  col = halos(p, col, 0, ${GARDEN_LIGHTS_AT});

  // ---- far rain, then fog rolling in from the garden ----
  float rr = rain(p, 2.0, 150.0, 3.0, uRain * 0.5, 0.0);
  col = mix(col, vec3(0.46, 0.48, 0.64) + uFlash * 0.3, rr * 0.3);

  float fy = uGardenGround - uGardenOff;
  float fog = uFog * smoothstep(fy - H * 0.45, fy + H * 0.05, p.y);
  fog *= 0.55 + 0.45 * snoise(vec2(p.x / 70.0 + t * 0.05, p.y / 16.0 - t * 0.02));
  vec3 fogCol = mix(vec3(0.2, 0.19, 0.28), uC3, 0.25);
  col = mix(col, fogCol, step(d4, fog) * 0.4 + fog * 0.15);

  // ---- the garden ----
  vec4 gt = layer(uGarden, uGardenSize, uGardenOff, p);
  if (gt.a > 0.5) {
    vec4 ur = layer(uGarden, uGardenSize, uGardenOff, p + vec2(1.0, -1.0));
    float e = uFlash > 0.0 ? edgeOf(uGarden, uGardenSize, uGardenOff, p) : 0.0;
    col = material(gt, ur, e,
      vec3(0.025, 0.022, 0.04), vec3(0.06, 0.055, 0.09), vec3(0.11, 0.1, 0.16),
      vec3(0.17, 0.16, 0.25));
    col = mix(col, fogCol, step(d4, fog * 0.5) * 0.18);
  }
  col = halos(p, col, ${GARDEN_LIGHTS_AT}, ${MAX_LIGHTS});

  // ---- near rain, in front of everything ----
  float nr = rain(p, 3.0, 230.0, 5.0, uRain * 0.32, 17.0);
  col = mix(col, vec3(0.68, 0.7, 0.84) + uFlash * 0.2, nr * 0.42);

  gl_FragColor = vec4(col, 1.0);
}
`

/** Flat numeric form of a theme, so two themes can be blended component-wise. */
const SIZE = 19
function themeVector(theme: BgTheme, blood: boolean, out = new Float32Array(SIZE)) {
  const colors = blood ? bloodMoonSky : theme.sky
  colors.forEach((hex, i) => {
    const v = parseInt(hex.slice(1), 16)
    out[i * 3] = ((v >> 16) & 255) / 255
    out[i * 3 + 1] = ((v >> 8) & 255) / 255
    out[i * 3 + 2] = (v & 255) / 255
  })
  out[12] = theme.rain
  out[13] = theme.storm
  out[14] = theme.clouds
  out[15] = theme.fog
  out[16] = theme.glow
  out[17] = theme.wind
  out[18] = theme.speed
  return out
}

interface Band {
  theme: BgTheme
  top: number
  bottom: number
}

function measureBands(): Band[] {
  return [...document.querySelectorAll<HTMLElement>('[data-bg]')].map((el) => {
    const r = el.getBoundingClientRect()
    return {
      theme: bgThemes[el.dataset.bg as BgThemeName] ?? bgThemes.hero,
      top: r.top + window.scrollY,
      bottom: r.bottom + window.scrollY,
    }
  })
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Brightness over time of one lightning strike: flash, flicker, flash, fade. */
function envelope(dt: number) {
  if (dt < 0) return 0
  if (dt < 0.05) return 1
  if (dt < 0.1) return 0.2
  if (dt < 0.18) return 0.85
  return Math.max(0, Math.exp(-(dt - 0.18) * 7) - 0.01)
}

export function NightScene() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const flashEl = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = canvas.current
    const gl = el?.getContext('webgl', {
      antialias: false,
      depth: false,
      alpha: false,
      powerPreference: 'low-power',
    })
    if (!el || !gl) {
      setFailed(true)
      return
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (import.meta.env.DEV && !gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s))
      }
      return s
    }
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFailed(true)
      return
    }
    gl.useProgram(program)

    // One triangle that covers the whole screen.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const u = (name: string) => gl.getUniformLocation(program, name)
    const loc = {
      res: u('uRes'),
      time: u('uTime'),
      colors: [u('uC0'), u('uC1'), u('uC2'), u('uC3')],
      rain: u('uRain'),
      clouds: u('uClouds'),
      fog: u('uFog'),
      glow: u('uGlow'),
      wind: u('uWind'),
      drift: u('uDrift'),
      flash: u('uFlash'),
      boltAlpha: u('uBoltAlpha'),
      bolt: u('uBolt'),
      skyOff: u('uSkyOff'),
      cathOff: u('uCathOff'),
      gardenOff: u('uGardenOff'),
      gardenGround: u('uGardenGround'),
      cathSize: u('uCathSize'),
      gardenSize: u('uGardenSize'),
      moon: u('uMoon'),
      lights: u('uLights'),
      lightCol: u('uLightCol'),
    }
    gl.uniform1i(u('uCath'), 0)
    gl.uniform1i(u('uGarden'), 1)

    const makeTexture = (unit: number) => {
      const tex = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return tex
    }
    const cathTex = makeTexture(0)
    const gardenTex = makeTexture(1)

    let scene: Scene | null = null
    let W = 0
    let H = 0
    let pixel = 0
    const lightBuf = new Float32Array(MAX_LIGHTS * 4)
    const lightCol = new Float32Array(MAX_LIGHTS * 3)

    const build = () => {
      const next = pixelSize()
      const w = Math.max(1, Math.ceil(window.innerWidth / next))
      const h = Math.max(1, Math.ceil(window.innerHeight / next))
      // Mobile browsers resize the viewport as their toolbars slide in and out.
      // Keep the scene as it is for those small height-only changes.
      if (scene && next === pixel && w === W && h <= H && h > H * 0.8) return
      pixel = next
      W = w
      H = h
      el.width = W
      el.height = H
      el.style.width = `${W * pixel}px`
      el.style.height = `${H * pixel}px`
      gl.viewport(0, 0, W, H)
      gl.uniform2f(loc.res, W, H)

      scene = buildScene(W, H)
      const upload = (unit: number, tex: WebGLTexture | null, layer: Scene['garden']) => {
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          layer.w,
          layer.h,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          layer.data,
        )
      }
      upload(0, cathTex, scene.cathedral)
      upload(1, gardenTex, scene.garden)
      gl.uniform2f(loc.cathSize, scene.cathedral.w, scene.cathedral.h)
      gl.uniform2f(loc.gardenSize, scene.garden.w, scene.garden.h)
      gl.uniform1f(loc.gardenGround, scene.gardenGround)
      lightCol.fill(0)
      const setCol = (i: number, l: Light) => lightCol.set(l.color, i * 3)
      scene.cathedralLights.slice(0, GARDEN_LIGHTS_AT).forEach((l, i) => setCol(i, l))
      scene.gardenLights
        .slice(0, MAX_LIGHTS - GARDEN_LIGHTS_AT)
        .forEach((l, i) => setCol(GARDEN_LIGHTS_AT + i, l))
      gl.uniform3fv(loc.lightCol, lightCol)
      dirty = true
    }

    // Section positions are cached and only re-measured when the layout changes.
    let bands = measureBands()
    const remeasure = () => {
      bands = measureBands()
      dirty = true
    }
    const ro = new ResizeObserver(remeasure)
    ro.observe(document.body)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const blood = () => modeStore.get() === 'bloodmoon'
    const current = themeVector(bgThemes.hero, blood())
    const a = new Float32Array(SIZE)
    const b = new Float32Array(SIZE)
    const target = new Float32Array(SIZE)
    let bloodMix = blood() ? 1 : 0
    let dirty = true
    let time = Math.random() * 20
    let last = 0
    let progress = 0
    let lastOffsets = ''

    // lightning
    let strikeAt = -10
    let boltX = 0
    let boltEnd = 0
    let boltSeed = 0
    let strength = 1
    let lastFlash = -1
    const doStrike = (x: number, loud: boolean) => {
      if (reduced.matches) return
      const now = performance.now() / 1000
      if (now - strikeAt < 0.6) return
      strikeAt = now
      boltX = Math.round(x * W)
      boltEnd = Math.round(H * (0.35 + Math.random() * 0.35))
      boltSeed = Math.random() * 100
      // Strikes you call down are brighter (and louder) than the storm's own.
      strength = loud ? 1 : 0.6
      if (loud) sfx.thunder(0.25 + Math.random() * 0.4)
    }
    const offStrike = onStrike(doStrike)

    const computeTarget = () => {
      const isBlood = blood()
      if (!bands.length) return themeVector(bgThemes.notes, isBlood, target)
      const center = window.scrollY + window.innerHeight / 2
      let i = bands.findIndex((band) => center < band.bottom)
      if (i === -1) i = bands.length - 1
      const band = bands[i]
      const next = bands[i + 1]
      const f = (center - band.top) / Math.max(1, band.bottom - band.top)
      // Start blending into the next section over the last 40% of this one.
      const k = next ? smoothstep(0.6, 1, f) : 0
      themeVector(band.theme, isBlood, a)
      if (k > 0) themeVector(next.theme, isBlood, b)
      for (let j = 0; j < SIZE; j++) target[j] = a[j] + (b[j] - a[j]) * k
    }

    let raf = requestAnimationFrame(function frame(t) {
      raf = requestAnimationFrame(frame)
      if (document.hidden || !scene || t - last < 1000 / FPS - 1) return
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const still = reduced.matches

      computeTarget()
      const ease = still ? 1 : 1 - Math.exp(-dt * 2.5)
      let delta = 0
      for (let j = 0; j < SIZE; j++) {
        const d = target[j] - current[j]
        current[j] += d * ease
        delta += Math.abs(d)
      }
      const bloodTarget = blood() ? 1 : 0
      bloodMix += (bloodTarget - bloodMix) * (still ? 1 : 1 - Math.exp(-dt * 2))

      // Scroll position drives the parallax descent from the spires to the garden.
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const goal = Math.min(1, Math.max(0, window.scrollY / max))
      progress += (goal - progress) * (still ? 1 : 1 - Math.exp(-dt * 8))
      const skyOff = Math.round(progress * H * 0.3)
      const cathOff = Math.round(progress * (scene.cathedral.h - H))
      const gardenOff = Math.round(progress * (scene.garden.h - H))
      const offsets = `${skyOff},${cathOff},${gardenOff},${W},${H}`

      // Random strikes, more often the stormier the section.
      if (!still && Math.random() < (current[13] / 60) * dt)
        doStrike(Math.random(), false)
      const since = t / 1000 - strikeAt
      const flash = still ? 0 : envelope(since) * strength
      const boltAlpha =
        (since < 0.1 ? 1 : since < 0.18 ? 0.6 : Math.max(0, 1 - (since - 0.18) / 0.15)) *
        Math.max(0.75, strength)

      if (!still) time += dt
      // With reduced motion, only redraw when something actually changes.
      else if (
        !dirty &&
        delta < 1e-4 &&
        offsets === lastOffsets &&
        Math.abs(bloodMix - bloodTarget) < 1e-3
      ) {
        return
      }
      dirty = false
      lastOffsets = offsets

      // The whole page flickers faintly with the lightning.
      const pageFlash = Math.round(flash * 100) / 100
      if (pageFlash !== lastFlash && flashEl.current) {
        lastFlash = pageFlash
        flashEl.current.style.opacity = String(pageFlash * 0.06)
        flashEl.current.style.display = pageFlash > 0 ? 'block' : 'none'
      }

      gl.uniform1f(loc.time, time)
      loc.colors.forEach((l, i) =>
        gl.uniform3f(l, current[i * 3], current[i * 3 + 1], current[i * 3 + 2]),
      )
      gl.uniform1f(loc.rain, current[12])
      gl.uniform1f(loc.clouds, current[14])
      gl.uniform1f(loc.fog, current[15])
      gl.uniform1f(loc.glow, current[16])
      gl.uniform1f(loc.wind, current[17])
      gl.uniform1f(loc.drift, current[18])
      gl.uniform1f(loc.flash, flash)
      gl.uniform1f(loc.boltAlpha, since < 0.33 && !still ? boltAlpha : 0)
      gl.uniform3f(loc.bolt, boltX, boltEnd, boltSeed)
      gl.uniform1f(loc.skyOff, skyOff)
      gl.uniform1f(loc.cathOff, cathOff)
      gl.uniform1f(loc.gardenOff, gardenOff)
      gl.uniform4f(loc.moon, scene.moon.x, scene.moon.y - skyOff, scene.moon.r, bloodMix)

      // Lights, moved into screen space, each flickering on its own.
      lightBuf.fill(0)
      const place = (i: number, l: Light, off: number) => {
        const f = still
          ? 1
          : 0.85 + 0.15 * Math.sin(time * 5 + i * 1.7) * Math.sin(time * 1.3 + i)
        lightBuf.set([l.x, l.y - off, l.r, l.power * f], i * 4)
      }
      scene.cathedralLights
        .slice(0, GARDEN_LIGHTS_AT)
        .forEach((l, i) => place(i, l, cathOff))
      scene.gardenLights
        .slice(0, MAX_LIGHTS - GARDEN_LIGHTS_AT)
        .forEach((l, i) => place(GARDEN_LIGHTS_AT + i, l, gardenOff))
      gl.uniform4fv(loc.lights, lightBuf)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
    })

    const lost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(raf)
      setFailed(true)
    }

    let resizeTimer = 0
    const resize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(build, 120)
    }

    build()
    window.addEventListener('resize', resize)
    el.addEventListener('webglcontextlost', lost)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      offStrike()
      ro.disconnect()
      window.removeEventListener('resize', resize)
      el.removeEventListener('webglcontextlost', lost)
    }
  }, [])

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink"
      >
        {failed ? (
          <div className="static-bg absolute inset-0" />
        ) : (
          <canvas
            ref={canvas}
            className="absolute left-0 top-0 [image-rendering:pixelated]"
          />
        )}
        <div className="crt absolute inset-0" />
      </div>
      <div
        ref={flashEl}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] hidden bg-[#d6d8ff]"
        style={{ opacity: 0 }}
      />
    </>
  )
}

// `strike()` in the console during development, for tuning the lightning.
if (import.meta.env.DEV) {
  ;(window as unknown as { strike: typeof strike }).strike = strike
}
