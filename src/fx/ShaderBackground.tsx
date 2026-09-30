import { useEffect, useRef, useState } from 'react'
import { modeStore } from '@/lib/store'
import {
  bgThemes,
  mercuryColors,
  type BgTheme,
  type BgThemeName,
} from '@/styles/backgroundThemes'

/**
 * Fixed, animated page background with a Balatro-style "crunchy" look: a slow
 * spiral swirl of domain-warped noise, posterized into four palette bands with
 * ordered (Bayer) dithering and drawn as big crisp pixels. It morphs between
 * per-section themes as you scroll (see backgroundThemes.ts).
 *
 * Deliberately cheap: plain WebGL, one full-screen triangle, one shader pixel
 * per PIXEL×PIXEL CSS pixels (upscaled with nearest-neighbour), 30 fps.
 */

/** Size of one background "pixel" in CSS pixels. */
const PIXEL = 5
const FPS = 30

const vertex = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const fragment = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC0, uC1, uC2, uC3;
uniform float uScale, uWarp, uRibbons, uIntensity, uSwirl;

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

// 4x4 ordered-dither threshold in [0, 1), one cell per background pixel.
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;

  // Spiral swirl: rotation grows with distance from the centre and slowly spins.
  float rad = length(p);
  float ang = uSwirl * (rad * 3.2 + t * 0.06);
  float cs = cos(ang), sn = sin(ang);
  p = mat2(cs, -sn, sn, cs) * p * uScale * 0.55;

  // Two rounds of domain warping give the painted, folding flow.
  vec2 q = vec2(snoise(p + vec2(0.0, t * 0.10)), snoise(p + vec2(5.2, 1.3) - vec2(t * 0.08, 0.0)));
  vec2 r = vec2(
    snoise(p + uWarp * q + vec2(1.7, 9.2) + t * 0.05),
    snoise(p + uWarp * q + vec2(8.3, 2.8) - t * 0.06)
  );
  float n = snoise(p + uWarp * r);

  float blob = n * 0.5 + 0.5;
  float ribbon = pow(1.0 - abs(n), 5.0);
  float v = mix(blob, ribbon, uRibbons);
  v *= 0.8 + 0.2 * smoothstep(-0.6, 1.0, q.x);
  // Darker edges keep the focus in the middle.
  v *= mix(0.55, 1.0, smoothstep(0.85, 0.15, length(uv - 0.5)));
  // Stretch the contrast so all four bands show up.
  v = smoothstep(0.12, 0.8, v) * uIntensity;

  // Posterize into 4 bands; the dither turns band edges into crunchy patterns.
  v += (bayer4(gl_FragCoord.xy) - 0.5) * 0.09;
  vec3 col = uC0;
  col = mix(col, uC1, step(0.3, v));
  col = mix(col, uC2, step(0.58, v));
  col = mix(col, uC3, step(0.84, v));
  gl_FragColor = vec4(col, 1.0);
}
`

/** Flat numeric form of a theme, so two themes can be blended component-wise. */
const SIZE = 18
function themeVector(theme: BgTheme, mercury: boolean, out = new Float32Array(SIZE)) {
  const colors = mercury ? mercuryColors : theme.colors
  colors.forEach((hex, i) => {
    const v = parseInt(hex.slice(1), 16)
    out[i * 3] = ((v >> 16) & 255) / 255
    out[i * 3 + 1] = ((v >> 8) & 255) / 255
    out[i * 3 + 2] = (v & 255) / 255
  })
  out[12] = theme.scale
  out[13] = theme.warp
  out[14] = theme.speed
  out[15] = theme.ribbons
  out[16] = theme.intensity
  out[17] = theme.swirl
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

export function ShaderBackground() {
  const canvas = useRef<HTMLCanvasElement>(null)
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
    const uRes = u('uRes')
    const uTime = u('uTime')
    const uColors = [u('uC0'), u('uC1'), u('uC2'), u('uC3')]
    const uScale = u('uScale')
    const uWarp = u('uWarp')
    const uRibbons = u('uRibbons')
    const uIntensity = u('uIntensity')
    const uSwirl = u('uSwirl')

    const resize = () => {
      el.width = Math.max(1, Math.ceil(window.innerWidth / PIXEL))
      el.height = Math.max(1, Math.ceil(window.innerHeight / PIXEL))
      // Exact multiples of PIXEL so every background pixel is the same size.
      el.style.width = `${el.width * PIXEL}px`
      el.style.height = `${el.height * PIXEL}px`
      gl.viewport(0, 0, el.width, el.height)
      gl.uniform2f(uRes, el.width, el.height)
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
    const current = themeVector(bgThemes.hero, modeStore.get() === 'mercury')
    const a = new Float32Array(SIZE)
    const b = new Float32Array(SIZE)
    const target = new Float32Array(SIZE)
    let dirty = true
    let phase = Math.random() * 20
    let last = 0

    const computeTarget = () => {
      const mercury = modeStore.get() === 'mercury'
      if (!bands.length) return themeVector(bgThemes.notes, mercury, target)
      const center = window.scrollY + window.innerHeight / 2
      let i = bands.findIndex((band) => center < band.bottom)
      if (i === -1) i = bands.length - 1
      const band = bands[i]
      const next = bands[i + 1]
      const f = (center - band.top) / Math.max(1, band.bottom - band.top)
      // Start blending into the next section over the last 40% of this one.
      const k = next ? smoothstep(0.6, 1, f) : 0
      themeVector(band.theme, mercury, a)
      if (k > 0) themeVector(next.theme, mercury, b)
      for (let j = 0; j < SIZE; j++) target[j] = a[j] + (b[j] - a[j]) * k
    }

    let raf = requestAnimationFrame(function frame(t) {
      raf = requestAnimationFrame(frame)
      if (document.hidden || t - last < 1000 / FPS - 1) return
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t

      computeTarget()
      const ease = reduced.matches ? 1 : 1 - Math.exp(-dt * 2.5)
      let delta = 0
      for (let j = 0; j < SIZE; j++) {
        const d = target[j] - current[j]
        current[j] += d * ease
        delta += Math.abs(d)
      }
      if (!reduced.matches) phase += dt * current[14]
      // With reduced motion, only redraw when the theme actually changes.
      else if (!dirty && delta < 1e-4) return
      dirty = false

      gl.uniform1f(uTime, phase)
      uColors.forEach((loc, i) =>
        gl.uniform3f(loc, current[i * 3], current[i * 3 + 1], current[i * 3 + 2]),
      )
      gl.uniform1f(uScale, current[12])
      gl.uniform1f(uWarp, current[13])
      gl.uniform1f(uRibbons, current[15])
      gl.uniform1f(uIntensity, current[16])
      gl.uniform1f(uSwirl, current[17])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    })

    const lost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(raf)
      setFailed(true)
    }

    resize()
    window.addEventListener('resize', resize)
    el.addEventListener('webglcontextlost', lost)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', resize)
      el.removeEventListener('webglcontextlost', lost)
    }
  }, [])

  return (
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
  )
}
