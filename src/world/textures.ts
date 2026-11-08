import * as THREE from 'three'

/**
 * Procedural pixel-art textures, painted pixel by pixel into small canvases
 * and sampled with nearest-neighbour filtering, so surfaces read as chunky
 * texels up close. Colours are muted and cold: moonlight does the rest.
 */

/** Deterministic random numbers, so the world looks the same on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type RGB = [number, number, number]
const hex = (h: string): RGB => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

class Paint {
  readonly w: number
  readonly h: number
  readonly img: ImageData
  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.img = new ImageData(w, h)
  }
  set(x: number, y: number, c: RGB, a = 255) {
    x = ((Math.round(x) % this.w) + this.w) % this.w
    y = ((Math.round(y) % this.h) + this.h) % this.h
    const i = (y * this.w + x) * 4
    this.img.data[i] = c[0]
    this.img.data[i + 1] = c[1]
    this.img.data[i + 2] = c[2]
    this.img.data[i + 3] = a
  }
  get(x: number, y: number): RGB {
    x = ((Math.round(x) % this.w) + this.w) % this.w
    y = ((Math.round(y) % this.h) + this.h) % this.h
    const i = (y * this.w + x) * 4
    return [this.img.data[i], this.img.data[i + 1], this.img.data[i + 2]]
  }
  fill(c: RGB, a = 255) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c, a)
  }
  texture(repeat = true) {
    const canvas = document.createElement('canvas')
    canvas.width = this.w
    canvas.height = this.h
    canvas.getContext('2d')!.putImageData(this.img, 0, 0)
    return finish(new THREE.CanvasTexture(canvas), repeat)
  }
}

function finish(t: THREE.Texture, repeat = true) {
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Dark, rain-soaked grass. */
export function grass() {
  const r = rng(11)
  const p = new Paint(64, 64)
  const base = [hex('#18200f'), hex('#1d2613'), hex('#222c17'), hex('#151b0e')]
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) p.set(x, y, base[Math.floor(r() * base.length)])
  // blades: short vertical strokes, lighter at the tip
  for (let i = 0; i < 260; i++) {
    const x = r() * 64
    const y = r() * 64
    const len = 2 + Math.floor(r() * 3)
    const tip = mix(hex('#2f3d1f'), hex('#4a5a34'), r())
    for (let k = 0; k < len; k++)
      p.set(
        x + (k === len - 1 && r() < 0.5 ? 1 : 0),
        y - k,
        mix(hex('#1a2311'), tip, k / len),
      )
  }
  // dead leaves and mud
  for (let i = 0; i < 26; i++) {
    const c = r() < 0.5 ? hex('#2e2619') : hex('#0d100a')
    const x = r() * 64
    const y = r() * 64
    p.set(x, y, c)
    p.set(x + 1, y, c)
  }
  return p.texture()
}

/** A worn trail through the grass: packed earth, puddles, grass at the edges. */
export function trail() {
  const r = rng(23)
  const W = 64
  const H = 32
  const p = new Paint(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = Math.min(y, H - 1 - y) / (H / 2) // 0 at the edges, 1 in the middle
      const n = r()
      let c = mix(hex('#211c16'), hex('#2c251c'), n)
      if (n > 0.93) c = hex('#3d362b') // pebbles
      if (edge < 0.32 + r() * 0.25) c = mix(hex('#18200f'), hex('#26301a'), r()) // grass creeping in
      p.set(x, y, c)
    }
  // puddles that catch a little sky
  for (let i = 0; i < 4; i++) {
    const cx = r() * W
    const cy = H * 0.35 + r() * H * 0.3
    const rw = 3 + r() * 5
    for (let y = -2; y <= 2; y++)
      for (let x = -rw; x <= rw; x++)
        if ((x / rw) ** 2 + (y / 2.2) ** 2 < 1)
          p.set(cx + x, cy + y, y < 0 ? hex('#2a3038') : hex('#1a1e24'))
  }
  return p.texture()
}

/** Clipped yew hedge: dense dark leaves with deep gaps. */
export function hedge() {
  const r = rng(37)
  const p = new Paint(32, 32)
  p.fill(hex('#0b120a'))
  for (let i = 0; i < 180; i++) {
    const x = r() * 32
    const y = r() * 32
    const c = mix(hex('#132011'), hex('#2b3c22'), r() ** 1.5)
    p.set(x, y, c)
    p.set(x + 1, y, c)
    p.set(x, y + 1, mix(c, hex('#0b120a'), 0.5))
    if (r() < 0.3) p.set(x + 1, y - 1, mix(c, hex('#3c4e2e'), 0.5))
  }
  return p.texture()
}

/** Ashlar masonry: staggered blocks, dark mortar, moss in the joints. */
export function stone(seed = 51, tone = '#45443f') {
  const r = rng(seed)
  const p = new Paint(64, 64)
  const mortar = hex('#121211')
  const base = hex(tone)
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 8 : 0
    for (let col = -1; col < 4; col++) {
      const x0 = col * 16 + off
      const shade = mix(base, hex('#24241f'), r() * 0.45)
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 16; x++) {
          let c = mix(shade, hex('#5a5953'), r() * 0.25)
          if (y === 0 || x === 0) c = mortar
          else if (y === 1 || x === 1)
            c = mix(shade, hex('#6e6c64'), 0.3) // lit top-left edge
          else if (y === 7 || x === 15) c = mix(shade, mortar, 0.5)
          p.set(x0 + x, row * 8 + y, c)
        }
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * 64
    const y = r() * 64
    p.set(x, y, mix(hex('#1f2a16'), hex('#33402a'), r()))
  }
  return p.texture()
}

/** Weathered marble, for plinths and tombs. */
export function marble() {
  const r = rng(61)
  const p = new Paint(32, 32)
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) p.set(x, y, mix(hex('#8d8b84'), hex('#a5a39b'), r()))
  for (let v = 0; v < 3; v++) {
    let x = r() * 32
    for (let y = 0; y < 32; y++) {
      x += r() * 2 - 1
      p.set(x, y, hex('#6c6a63'))
    }
  }
  for (let i = 0; i < 40; i++) p.set(r() * 32, r() * 32, hex('#4b5340'))
  return p.texture()
}

/** Old timber planks. */
export function wood() {
  const r = rng(71)
  const p = new Paint(32, 32)
  for (let x = 0; x < 32; x++) {
    const plank = Math.floor(x / 8)
    const base = mix(hex('#2d241b'), hex('#3d3124'), (plank * 0.37) % 1)
    for (let y = 0; y < 32; y++) {
      let c = mix(base, hex('#1d1712'), r() * 0.4)
      if (x % 8 === 0) c = hex('#120e0a')
      if ((y + plank * 7) % 13 === 0 && r() < 0.7) c = mix(c, hex('#4a3d2d'), 0.6)
      p.set(x, y, c)
    }
  }
  return p.texture()
}

/** Bark for the dead trees and cypress trunks. */
export function bark() {
  const r = rng(81)
  const p = new Paint(16, 32)
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 32; y++)
      p.set(
        x,
        y,
        (x + Math.floor(y / 5)) % 4 === 0
          ? hex('#0f0d0b')
          : mix(hex('#1f1b17'), hex('#2e2923'), r()),
      )
  return p.texture()
}

/** Leaded glass, lit from inside: a lancet window pattern in amber and grey. */
export function glass(seed = 91) {
  const r = rng(seed)
  const W = 16
  const H = 32
  const p = new Paint(W, H)
  const panes = [
    hex('#d9a45a'),
    hex('#b07a3c'),
    hex('#8c8a80'),
    hex('#e8c88a'),
    hex('#6d5a40'),
  ]
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cell = Math.floor(x / 4) * 7 + Math.floor(y / 5) * 3
      let c = panes[(cell + Math.floor(r() * 1.3)) % panes.length]
      if (x % 4 === 0 || y % 5 === 0) c = hex('#1a1612') // lead cames
      p.set(x, y, c)
    }
  return p.texture()
}

/** Moonlit water, scrolled by the engine to make it ripple and fall. */
export function water() {
  const r = rng(101)
  const p = new Paint(32, 32)
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const n = r()
      p.set(
        x,
        y,
        n > 0.9 ? hex('#8c98a6') : n > 0.6 ? hex('#2d3946') : hex('#17202a'),
        220,
      )
    }
  return p.texture()
}

/** Soft blob for mist and halos: dithered rings, no smooth gradients. */
export function blob(levels = 5, S = 32) {
  const p = new Paint(S, S)
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2)
      const a = Math.max(0, 1 - d) ** 1.3
      const q = Math.floor(a * levels + bayer[(y % 4) * 4 + (x % 4)] / 16) / levels
      p.set(x, y, [255, 255, 255], Math.round(q * 255))
    }
  return p.texture(false)
}

/** A grass tuft for the instanced clumps (alpha-tested). */
export function tuft() {
  const r = rng(131)
  const p = new Paint(16, 16)
  p.fill([0, 0, 0], 0)
  for (let b = 0; b < 9; b++) {
    let x = 2 + r() * 12
    const h = 6 + r() * 9
    const lean = (r() - 0.5) * 0.5
    for (let k = 0; k < h; k++) {
      x += lean
      p.set(x, 15 - k, mix(hex('#18210f'), hex('#4d5c35'), k / h))
    }
  }
  return p.texture(false)
}

/**
 * Text painted onto a board (sign arrows, plaques, epitaphs), in the pixel
 * font, then thresholded so the letters stay crisp pixels.
 */
export function lettering(
  text: string,
  {
    w = 64,
    h = 16,
    bg = '#3a2e22',
    fg = '#d8d0bc',
    font = '"Jersey 10"',
    size = 14,
    grain = 71,
    carved = false,
  }: {
    w?: number
    h?: number
    bg?: string
    fg?: string
    font?: string
    size?: number
    grain?: number
    carved?: boolean
  } = {},
) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  // several lines: the first at `size`, the rest smaller, centred as a block
  const lines = text.split('\n')
  const sizes = lines.map((_, i) => (i === 0 ? size : Math.round(size * 0.72)))
  const total = sizes.reduce((a, b) => a + b * 1.05, 0)
  let y = h / 2 - total / 2
  lines.forEach((line, i) => {
    ctx.font = `${sizes[i]}px ${font}`
    ctx.fillText(line, w / 2, y + (sizes[i] * 1.05) / 2 + 1)
    y += sizes[i] * 1.05
  })
  const mask = ctx.getImageData(0, 0, w, h).data

  const r = rng(grain)
  const p = new Paint(w, h)
  const b = hex(bg)
  const f = hex(fg)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const on = mask[(y * w + x) * 4 + 3] > 110
      let c = mix(b, hex('#000000'), r() * 0.25)
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1)
        c = mix(b, hex('#000000'), 0.5)
      if (on) c = carved ? mix(b, hex('#000000'), 0.6) : mix(f, b, r() * 0.25)
      // carved letters catch the light on their lower edge
      if (carved && !on && y > 0 && mask[((y - 1) * w + x) * 4 + 3] > 110)
        c = mix(b, f, 0.35)
      p.set(x, y, c)
    }
  return p.texture(false)
}

/** A sticky note: yellowed paper, a number in the corner, lines of scribble. */
export function sticky(n: number) {
  const r = rng(200 + n)
  const p = new Paint(24, 24)
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++)
      p.set(x, y, mix(hex('#d8c45e'), hex('#c4ad48'), y / 24 + r() * 0.15))
  // a darker sticky strip along the top
  for (let x = 0; x < 24; x++)
    for (let y = 0; y < 4; y++)
      p.set(x, y, mix(hex('#b8a03e'), hex('#d0bb55'), r() * 0.3))
  // scribbled lines of handwriting
  for (let line = 0; line < 5; line++) {
    const y = 9 + line * 3
    let x = 3
    const end = 18 + r() * 4
    while (x < end) {
      if (r() < 0.8) p.set(x, y + (r() < 0.3 ? 1 : 0), hex('#3b3420'))
      x += 1
    }
  }
  // the number, as pixels in the top-left
  const digits: Record<string, string[]> = {
    '1': ['010', '110', '010', '010', '111'],
    '2': ['110', '001', '010', '100', '111'],
    '3': ['110', '001', '010', '001', '110'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '110', '001', '110'],
    '6': ['011', '100', '110', '101', '010'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['010', '101', '010', '101', '010'],
    '9': ['010', '101', '011', '001', '110'],
  }
  const d = digits[String(n)] ?? digits['1']
  d.forEach((row, y) =>
    [...row].forEach((c, x) => c === '1' && p.set(19 + x, 7 + y, hex('#7a2020'))),
  )
  return p.texture(false)
}

/** A folded sheet of paper left on a grave. */
export function paper(seed: number) {
  const r = rng(300 + seed)
  const p = new Paint(16, 20)
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 16; x++) {
      let c = mix(hex('#cfc8b6'), hex('#a9a291'), r() * 0.4 + (x === 8 ? 0.4 : 0))
      if (y > 3 && y < 17 && x > 2 && x < 14 && y % 3 === 0 && r() < 0.8)
        c = hex('#4a4538')
      p.set(x, y, c)
    }
  return p.texture(false)
}

/**
 * An album cover, shrunk to a few dozen pixels so it sits in the world like
 * everything else (or a flat swatch, for covers that are just a colour).
 */
export function cover(url: string | null, swatch?: string) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 40
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = swatch ?? '#2a2a2e'
  ctx.fillRect(0, 0, 40, 40)
  const t = finish(new THREE.CanvasTexture(canvas), false)
  if (url && !swatch) {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 40, 40)
      t.needsUpdate = true
    }
    img.src = url
  }
  return t
}
