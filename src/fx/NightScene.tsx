import { useEffect, useRef, useState } from 'react'
import { buildWorld, type LandmarkKind, type Light, type World } from '@/scene/buildScene'
import { pack, type Layer } from '@/scene/layers'
import { cameraX, explore } from '@/lib/explore'
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
 * The page background: a night garden around a gothic cathedral, in a storm,
 * drawn as big crisp pixels in greys. Storm clouds posterized into four bands
 * with ordered dithering, a moon, lightning, two layers of rain and ground fog,
 * over three parallax layers pre-drawn by buildWorld: the far cathedral, the
 * garden with its statues and landmarks, and dark foreground silhouettes.
 *
 * Scrolling walks the camera sideways through the garden from landmark to
 * landmark, one per page section (`data-landmark`). On wide screens the
 * sections themselves move sideways (ExploreTrack) and the garden moves with
 * them exactly, so each section stands beside its landmark. Each section's
 * `data-bg` theme sets the weather (backgroundThemes.ts).
 *
 * Deliberately cheap: plain WebGL, one full-screen triangle, one shader pixel
 * per PIXEL×PIXEL CSS pixels (upscaled with nearest-neighbour), 30 fps.
 */

const FPS = 30
const FAR_LIGHTS = 4
const MID_LIGHTS = 8
const LIGHTS = FAR_LIGHTS + MID_LIGHTS

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
uniform float uSkyOff, uGround;
uniform sampler2D uFar, uMid, uNear;
uniform vec3 uFarInfo, uMidInfo, uNearInfo;   // logical width, height, strip width
uniform vec2 uFarTex, uMidTex, uNearTex;      // packed texture size
uniform float uFarOff, uMidOff, uNearOff;
uniform vec4 uMoon;          // x, y, radius, blood (0..1)
uniform vec4 uLights[${LIGHTS}];   // x, y (screen), radius, power
uniform vec3 uLightCol[${LIGHTS}];

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

// Reads a layer that may be packed into stacked strips (see pack() in layers.ts).
vec4 layer(sampler2D tex, vec3 info, vec2 size, float off, vec2 p) {
  float x = p.x + off;
  if (x < 0.0 || x >= info.x || p.y < 0.0 || p.y >= info.y) return vec4(0.0);
  float strip = floor(x / info.z);
  vec2 q = vec2(x - strip * info.z, p.y + strip * info.y);
  return texture2D(tex, (q + 0.5) / size);
}

vec3 glassColor(float g, vec2 p) {
  if (g < 1.5) return vec3(0.92, 0.86, 0.74);   // candlelight
  if (g < 2.5) return vec3(0.74, 0.74, 0.76);   // pale pane
  if (g < 3.5) return vec3(0.5, 0.5, 0.53);     // grey pane
  if (g < 4.5) return vec3(0.3, 0.3, 0.33);     // dark pane
  if (g < 5.5) {                                // water: moonlit, falling
    float s = step(fract((p.y - uTime * 14.0 + hash1(p.x) * 3.0) / 5.0), 0.35);
    return mix(vec3(0.3, 0.31, 0.35), vec3(0.78, 0.8, 0.85), s);
  }
  if (g < 6.5) return vec3(0.03, 0.03, 0.035);  // lead / darkness
  return vec3(1.0, 0.97, 0.9);                  // flame
}

// Candle flicker, stepped so it reads as pixel-art animation.
float flicker(float seed) {
  float t = uTime;
  float f = 0.5 + 0.5 * sin(t * 6.3 + seed * 41.0) * sin(t * 2.1 + seed * 13.0);
  return 0.72 + 0.28 * floor(f * 4.0) / 4.0;
}

// Shade one solid pixel of a layer: stone lit by moon and lightning, or glass.
vec3 material(vec4 t, vec2 p, float upRight, float edge, vec3 s1, vec3 s3, vec3 s4, vec3 rim) {
  float glass = floor(t.g * 255.0 / 32.0 + 0.5);
  if (glass > 0.5) {
    vec3 c = glassColor(glass, p);
    // the blood moon stains every pane red
    c = mix(c, c * vec3(1.15, 0.28, 0.26), uMoon.w * 0.85);
    if (glass > 4.5 && glass < 6.5) return c;
    // seeds of 128+ mark the dimmer windows
    float lit = uGlow * flicker(t.b) * mix(1.0, 0.5, step(0.5, t.b));
    return mix(c * 0.1, c, lit);
  }
  float shade = floor(t.r * 255.0 / 50.0 + 0.5);
  vec3 c = s1;
  if (shade > 1.5) c = mix(s1, s3, 0.45);
  if (shade > 2.5) c = s3;
  if (shade > 3.5) c = s4;
  // moonlight catches edges facing the moon (up and to the right)
  if (upRight < 0.5) c = mix(c, rim, 0.55);
  // lightning outlines everything
  c = mix(c, c * 1.8 + vec3(0.05), uFlash * 0.35);
  c = mix(c, vec3(0.86), edge * uFlash * 0.8);
  return c;
}

float edgeOf(sampler2D tex, vec3 info, vec2 size, float off, vec2 p) {
  float e = 0.0;
  e += 1.0 - step(0.5, layer(tex, info, size, off, p + vec2(1.0, 0.0)).a);
  e += 1.0 - step(0.5, layer(tex, info, size, off, p - vec2(1.0, 0.0)).a);
  e += 1.0 - step(0.5, layer(tex, info, size, off, p - vec2(0.0, 1.0)).a);
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
  vec3 tint = mix(vec3(1.0), vec3(1.0, 0.3, 0.28), uMoon.w);
  for (int i = 0; i < ${LIGHTS}; i++) {
    if (i < from || i >= to) continue;
    vec4 L = uLights[i];
    if (L.w <= 0.0) continue;
    float d = length(p - L.xy) / L.z;
    float a = max(0.0, 1.0 - d);
    a = a * a * L.w * uGlow;
    // posterized rings with dithered edges
    a = floor(a * 5.0 + d4) / 5.0;
    col += uLightCol[i] * tint * a * 0.28;
  }
  return col;
}

vec3 stoneLayer(sampler2D tex, vec3 info, vec2 size, float off, vec2 p, vec3 col,
                vec3 s1, vec3 s3, vec3 s4, vec3 rim, out float solid) {
  vec4 t = layer(tex, info, size, off, p);
  solid = t.a;
  if (t.a < 0.5) return col;
  float ur = layer(tex, info, size, off, p + vec2(1.0, -1.0)).a;
  float e = uFlash > 0.0 ? edgeOf(tex, info, size, off, p) : 0.0;
  return material(t, p, ur, e, s1, s3, s4, rim);
}

void main() {
  vec2 p = floor(gl_FragCoord.xy);
  p.y = uRes.y - 1.0 - p.y; // rows from the top
  float H = uRes.y;
  float t = uTime;
  float d4 = bayer4(p);

  // ---- sky: drifting storm clouds in four posterized bands ----
  vec2 sp = vec2(p.x + uSkyOff, p.y);
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
  // Overcast skies get more cloud, not brighter cloud: only the moon lights edges.
  float lit = v - (uClouds - 0.5) * 0.7 + moonLight * 0.4 * step(0.45, v);
  v += (d4 - 0.5) * 0.12;
  lit += (d4 - 0.5) * 0.12;

  vec3 col = uC0;
  col = mix(col, uC1, step(0.42, v));
  col = mix(col, uC2, step(0.64, v));
  col = mix(col, uC3, step(0.97, lit));

  if (v < 0.4) {
    float s = hash2(floor(sp));
    if (s > 0.996) {
      float tw = floor((0.5 + 0.5 * sin(t * 2.0 + s * 300.0)) * 3.0) / 3.0;
      col = mix(col, vec3(0.86), 0.25 + 0.5 * tw);
    }
  }

  vec3 moonCol = mix(vec3(0.9, 0.9, 0.88), vec3(0.85, 0.18, 0.16), uMoon.w);
  if (md < 1.0 && v < 0.6) {
    float crater = step(0.35, snoise((p - uMoon.xy) / (uMoon.z * 0.45) + 4.0));
    vec2 dir = (p - uMoon.xy) / uMoon.z;
    float shadow = step(0.55, dot(dir, vec2(-0.7, 0.7)) + md * 0.2);
    col = moonCol * (1.0 - crater * 0.14) * (1.0 - shadow * 0.18);
  } else if (md < 2.8 && v < 0.6) {
    float a = floor((2.8 - md) / 1.8 * 3.0 + d4) / 3.0;
    col += moonCol * a * 0.07;
  }

  col = mix(col, uC3 * 1.5 + vec3(0.12), uFlash * 0.55);

  if (uBoltAlpha > 0.0 && p.y <= uBolt.y) {
    float dx = abs(p.x - (uBolt.x + boltX(p.y, uBolt.z)));
    float y0 = uBolt.y * 0.35;
    float dir = hash1(uBolt.z) > 0.5 ? 1.0 : -1.0;
    float bx = uBolt.x + boltX(y0, uBolt.z) + (p.y - y0) * dir * 0.6 + boltX(p.y, uBolt.z + 7.0) * 0.4;
    float db = (p.y > y0 && p.y < uBolt.y * 0.75) ? abs(p.x - bx) : 99.0;
    if (dx < 0.75 || db < 0.5) col = mix(col, vec3(0.95), uBoltAlpha);
    else if (dx < 2.5) col = mix(col, vec3(0.65), 0.45 * uBoltAlpha);
  }

  float solid;
  // ---- far: the cathedral ----
  col = stoneLayer(uFar, uFarInfo, uFarTex, uFarOff, p, col,
    vec3(0.065, 0.065, 0.072), vec3(0.12, 0.12, 0.13), vec3(0.19, 0.19, 0.2),
    vec3(0.25, 0.25, 0.27), solid);
  // distance haze: the cathedral sinks into the storm
  if (solid > 0.5) col = mix(col, uC1, 0.3);
  col = halos(p, col, 0, ${FAR_LIGHTS});

  // ---- far rain, then mist between the cathedral and the garden ----
  float rr = rain(p, 2.0, 150.0, 3.0, uRain * 0.5, 0.0);
  col = mix(col, vec3(0.5, 0.5, 0.54) + uFlash * 0.3, rr * 0.3);

  float fog = uFog * smoothstep(uGround - H * 0.35, uGround + H * 0.04, p.y);
  fog *= 0.55 + 0.45 * snoise(vec2((p.x + uMidOff) / 70.0 + t * 0.05, p.y / 16.0 - t * 0.02));
  vec3 fogCol = mix(vec3(0.22, 0.22, 0.24), uC3, 0.25);
  col = mix(col, fogCol, step(d4, fog) * 0.4 + fog * 0.15);

  // ---- mid: the garden, its statues and landmarks ----
  col = stoneLayer(uMid, uMidInfo, uMidTex, uMidOff, p, col,
    vec3(0.04, 0.04, 0.047), vec3(0.24, 0.24, 0.25), vec3(0.38, 0.38, 0.39),
    vec3(0.5, 0.5, 0.52), solid);
  if (solid > 0.5) col = mix(col, fogCol, step(d4, fog * 0.5) * 0.18);
  col = halos(p, col, ${FAR_LIGHTS}, ${LIGHTS});

  // ---- near: foreground silhouettes ----
  col = stoneLayer(uNear, uNearInfo, uNearTex, uNearOff, p, col,
    vec3(0.012, 0.012, 0.015), vec3(0.04, 0.04, 0.045), vec3(0.07, 0.07, 0.08),
    vec3(0.11, 0.11, 0.125), solid);

  // ---- near rain, in front of everything ----
  float nr = rain(p, 3.0, 230.0, 5.0, uRain * 0.32, 17.0);
  col = mix(col, vec3(0.74, 0.74, 0.78) + uFlash * 0.2, nr * 0.42);

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

interface Stop {
  theme: BgTheme
  landmark: LandmarkKind
  /** Centre of the landmark along the walk, in CSS pixels. */
  x: number
  /** Vertical layout only: where the section sits on the page. */
  top: number
  bottom: number
}

/** Reads the page's sections (`data-bg` + `data-landmark`) into stops along the walk. */
function measureStops(): { stops: Stop[]; width: number; exploring: boolean } {
  const sections = [...document.querySelectorAll<HTMLElement>('[data-bg]')]
  const vw = window.innerWidth
  const track = explore.track
  const trackLeft = track?.getBoundingClientRect().left ?? 0
  const stops = sections.map((el, i): Stop => {
    const r = el.getBoundingClientRect()
    let x = vw * (0.55 + i * 1.25)
    if (track) {
      const anchor = el.querySelector<HTMLElement>('[data-anchor]') ?? el
      const a = anchor.getBoundingClientRect()
      x = a.left - trackLeft + a.width / 2
    }
    return {
      theme: bgThemes[el.dataset.bg as BgThemeName] ?? bgThemes.hero,
      landmark: (el.dataset.landmark as LandmarkKind | undefined) ?? 'gate',
      x,
      top: r.top + window.scrollY,
      bottom: r.bottom + window.scrollY,
    }
  })
  const width = track
    ? track.scrollWidth
    : stops.length
      ? stops[stops.length - 1].x + vw * 0.6
      : vw
  return { stops, width, exploring: !!track }
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
      ground: u('uGround'),
      farOff: u('uFarOff'),
      midOff: u('uMidOff'),
      nearOff: u('uNearOff'),
      moon: u('uMoon'),
      lights: u('uLights'),
      lightCol: u('uLightCol'),
    }
    const maxTex = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)

    const uploaders = (['Far', 'Mid', 'Near'] as const).map((name, unit) => {
      const tex = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(u(`u${name}`), unit)
      const info = u(`u${name}Info`)
      const size = u(`u${name}Tex`)
      return (layer: Layer) => {
        const packed = pack(layer, maxTex)
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          packed.w,
          packed.h,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          packed.data,
        )
        gl.uniform3f(info, layer.w, layer.h, packed.stripW)
        gl.uniform2f(size, packed.w, packed.h)
      }
    })

    let world: World | null = null
    let worldKey = ''
    let W = 0
    let H = 0
    let pixel = 0
    let stops: Stop[] = []
    let walkWidth = 0
    let exploring = false
    let dirty = true
    const lightBuf = new Float32Array(LIGHTS * 4)
    const lightCol = new Float32Array(LIGHTS * 3)

    /** Re-reads the page layout, and redraws the world if its stops moved. */
    const layout = () => {
      const m = measureStops()
      stops = m.stops
      walkWidth = m.width
      exploring = m.exploring
      const next = pixelSize()
      const w = Math.max(1, Math.ceil(window.innerWidth / next))
      const h = Math.max(1, Math.ceil(window.innerHeight / next))
      // Mobile browsers resize the viewport as their toolbars slide in and out.
      // Keep the scene as it is for those small height-only changes.
      const keepSize = world && next === pixel && w === W && h <= H && h > H * 0.8
      if (!keepSize) {
        pixel = next
        W = w
        H = h
        el.width = W
        el.height = H
        el.style.width = `${W * pixel}px`
        el.style.height = `${H * pixel}px`
        gl.viewport(0, 0, W, H)
        gl.uniform2f(loc.res, W, H)
      }
      const stations = stops.map((s) => ({
        landmark: s.landmark,
        x: Math.round(s.x / pixel),
      }))
      const key = `${W}x${H}:${Math.ceil(walkWidth / pixel)}:${stations.map((s) => `${s.landmark}@${s.x}`).join(',')}`
      if (key !== worldKey) {
        worldKey = key
        world = buildWorld(W, H, stations, walkWidth / pixel)
        uploaders[0](world.far)
        uploaders[1](world.mid)
        uploaders[2](world.near)
        gl.uniform1f(loc.ground, world.ground)
      }
      dirty = true
    }

    let relayoutTimer = 0
    const relayout = () => {
      window.clearTimeout(relayoutTimer)
      relayoutTimer = window.setTimeout(layout, 150)
    }
    const ro = new ResizeObserver(relayout)
    ro.observe(document.body)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const blood = () => modeStore.get() === 'bloodmoon'
    const current = themeVector(bgThemes.hero, blood())
    const a = new Float32Array(SIZE)
    const b = new Float32Array(SIZE)
    const target = new Float32Array(SIZE)
    let bloodMix = blood() ? 1 : 0
    let time = Math.random() * 20
    let last = 0
    let cam = -1
    let lastOffsets = ''

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

    /**
     * Where along the walk the visitor is: the stop index, the fraction of the
     * way to the next stop, and the camera position (CSS px) to match.
     */
    const locate = (): [number, number, number] => {
      const vw = window.innerWidth
      if (!stops.length) return [0, 0, 0]
      if (exploring) {
        const x = cameraX()
        const centre = x + vw / 2
        let i = 0
        while (i < stops.length - 1 && centre >= stops[i + 1].x) i++
        const next = stops[i + 1]
        const f = next
          ? Math.min(1, Math.max(0, (centre - stops[i].x) / (next.x - stops[i].x)))
          : 0
        return [i, f, x]
      }
      // Vertical layout: walk from one landmark to the next between sections.
      const centre = window.scrollY + window.innerHeight / 2
      let i = stops.findIndex((s) => centre < s.bottom)
      if (i === -1) i = stops.length - 1
      const s = stops[i]
      const along = i + (centre - s.top) / Math.max(1, s.bottom - s.top) - 0.5
      const i0 = Math.max(0, Math.min(stops.length - 1, Math.floor(along)))
      const f = Math.min(1, Math.max(0, along - i0))
      const next = stops[i0 + 1] ?? stops[i0]
      const x = stops[i0].x + (next.x - stops[i0].x) * smoothstep(0.15, 0.85, f) - vw / 2
      return [i0, f, Math.min(Math.max(0, walkWidth - vw), Math.max(0, x))]
    }

    let raf = requestAnimationFrame(function frame(t) {
      raf = requestAnimationFrame(frame)
      if (document.hidden || !world || t - last < 1000 / FPS - 1) return
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const still = reduced.matches

      // weather: blend the themes of the two stops we're between
      const [i, f, camGoal] = locate()
      const isBlood = blood()
      themeVector(stops[i]?.theme ?? bgThemes.notes, isBlood, a)
      const next = stops[i + 1]
      const k = next ? smoothstep(0.2, 0.8, f) : 0
      if (next && k > 0) themeVector(next.theme, isBlood, b)
      for (let j = 0; j < SIZE; j++) target[j] = a[j] + (b[j] - a[j]) * k
      const ease = still ? 1 : 1 - Math.exp(-dt * 2.5)
      let delta = 0
      for (let j = 0; j < SIZE; j++) {
        const d = target[j] - current[j]
        current[j] += d * ease
        delta += Math.abs(d)
      }
      const bloodTarget = isBlood ? 1 : 0
      bloodMix += (bloodTarget - bloodMix) * (still ? 1 : 1 - Math.exp(-dt * 2))

      // While exploring, the garden is locked to the content; otherwise it glides.
      cam =
        exploring || still || cam < 0
          ? camGoal
          : cam + (camGoal - cam) * (1 - Math.exp(-dt * 4))
      const maxCam = Math.max(1, walkWidth - window.innerWidth)
      const midOff = Math.round(cam / pixel)
      const nearOff = Math.round(midOff * world.nearSpeed)
      const farOff = Math.round((Math.min(cam, maxCam) / maxCam) * world.farTravel)
      const skyOff = Math.round(midOff * 0.06)
      const offsets = `${midOff},${farOff},${worldKey}`

      if (!still && Math.random() < (current[13] / 60) * dt)
        doStrike(Math.random(), false)
      const since = t / 1000 - strikeAt
      const flash = still ? 0 : envelope(since) * strength
      const boltAlpha =
        (since < 0.1 ? 1 : since < 0.18 ? 0.6 : Math.max(0, 1 - (since - 0.18) / 0.15)) *
        Math.max(0.75, strength)

      if (!still) time += dt
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

      const pageFlash = Math.round(flash * 100) / 100
      if (pageFlash !== lastFlash && flashEl.current) {
        lastFlash = pageFlash
        flashEl.current.style.opacity = String(pageFlash * 0.06)
        flashEl.current.style.display = pageFlash > 0 ? 'block' : 'none'
      }

      gl.uniform1f(loc.time, time)
      loc.colors.forEach((l, j) =>
        gl.uniform3f(l, current[j * 3], current[j * 3 + 1], current[j * 3 + 2]),
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
      gl.uniform1f(loc.farOff, farOff)
      gl.uniform1f(loc.midOff, midOff)
      gl.uniform1f(loc.nearOff, nearOff)
      gl.uniform4f(loc.moon, world.moon.x, world.moon.y, world.moon.r, bloodMix)

      // The lights nearest the middle of the screen, each flickering on its own.
      lightBuf.fill(0)
      lightCol.fill(0)
      const pick = (all: Light[], off: number, from: number, count: number) => {
        all
          .map((l, n) => ({ l, n, x: l.x - off }))
          .filter(({ l, x }) => x > -l.r && x < W + l.r)
          .sort((p, q) => Math.abs(p.x - W / 2) - Math.abs(q.x - W / 2))
          .slice(0, count)
          .forEach(({ l, n, x }, j) => {
            const fl = still
              ? 1
              : 0.85 + 0.15 * Math.sin(time * 5 + n * 1.7) * Math.sin(time * 1.3 + n)
            lightBuf.set([x, l.y, l.r, l.power * fl], (from + j) * 4)
            lightCol.set(l.color, (from + j) * 3)
          })
      }
      pick(world.farLights, farOff, 0, FAR_LIGHTS)
      pick(world.midLights, midOff, FAR_LIGHTS, MID_LIGHTS)
      gl.uniform4fv(loc.lights, lightBuf)
      gl.uniform3fv(loc.lightCol, lightCol)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
    })

    const lost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(raf)
      setFailed(true)
    }

    layout()
    window.addEventListener('resize', relayout)
    window.addEventListener('explore:layout', relayout)
    el.addEventListener('webglcontextlost', lost)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(relayoutTimer)
      offStrike()
      ro.disconnect()
      window.removeEventListener('resize', relayout)
      window.removeEventListener('explore:layout', relayout)
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
        className="pointer-events-none fixed inset-0 z-[60] hidden bg-[#e4e4ea]"
        style={{ opacity: 0 }}
      />
    </>
  )
}

// `strike()` in the console during development, for tuning the lightning.
if (import.meta.env.DEV) {
  ;(window as unknown as { strike: typeof strike }).strike = strike
}
