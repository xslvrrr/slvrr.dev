/**
 * Pixel buffers for the night scene's static layers (the cathedral and the
 * garden). Nothing here is a colour: every pixel stores a *material*, and the
 * shader in NightScene.tsx decides how it looks (moonlight, lightning, candle
 * flicker, blood moon...). Encoding, per RGBA pixel:
 *
 *   R  stone shade × 50   1 body · 2 masonry · 3 trim · 4 bright trim
 *   G  glass kind × 32    0 none · see GLASS
 *   B  flicker seed       0–255, so each window flickers on its own
 *   A  255 = solid, 0 = empty (sky shows through)
 */
export const SHADE = { body: 1, masonry: 2, trim: 3, bright: 4 } as const

export const GLASS = {
  candle: 1,
  crimson: 2,
  sapphire: 3,
  violet: 4,
  emerald: 5,
  lead: 6,
  flame: 7,
} as const

export class Layer {
  readonly w: number
  readonly h: number
  readonly data: Uint8Array

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.data = new Uint8Array(w * h * 4)
  }

  set(x: number, y: number, shade: number, glass = 0, seed = 0) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    this.data[i] = shade * 50
    this.data[i + 1] = glass * 32
    this.data[i + 2] = seed
    this.data[i + 3] = 255
  }

  solid(x: number, y: number) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false
    return this.data[(y * this.w + x) * 4 + 3] > 0
  }

  /** Filled rectangle between two corners (inclusive, any order). */
  rect(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    shade: number,
    glass = 0,
    seed = 0,
  ) {
    const ax = Math.round(Math.min(x0, x1))
    const bx = Math.round(Math.max(x0, x1))
    const ay = Math.max(0, Math.round(Math.min(y0, y1)))
    const by = Math.min(this.h - 1, Math.round(Math.max(y0, y1)))
    for (let y = ay; y <= by; y++) {
      for (let x = Math.max(0, ax); x <= Math.min(this.w - 1, bx); x++) {
        this.set(x, y, shade, glass, seed)
      }
    }
  }

  /** A line `thick` pixels wide. */
  line(x0: number, y0: number, x1: number, y1: number, thick: number, shade: number) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
    const r = (Math.max(1, thick) - 1) / 2
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps
      const y = y0 + ((y1 - y0) * i) / steps
      this.rect(x - r, y - r, x + r, y + r, shade)
    }
  }

  disc(cx: number, cy: number, r: number, shade: number, glass = 0, seed = 0) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3)
          this.set(x, y, shade, glass, seed)
      }
    }
  }

  /**
   * Visits every pixel of a pointed (equilateral) gothic arch, `2·hw + 1`
   * pixels wide, from `top` (the apex) down to `bottom`.
   */
  lancet(
    cx: number,
    hw: number,
    top: number,
    bottom: number,
    visit: (x: number, y: number) => void,
  ) {
    cx = Math.round(cx)
    hw = Math.max(0, Math.round(hw))
    top = Math.round(top)
    bottom = Math.round(bottom)
    const span = 2 * hw
    const spring = Math.min(bottom, top + Math.round(1.732 * hw))
    for (let y = top; y <= bottom; y++) {
      for (let x = cx - hw; x <= cx + hw; x++) {
        if (y < spring && span > 0) {
          const dy = y - spring
          const r2 = (span + 0.5) ** 2
          if ((x - (cx - hw)) ** 2 + dy * dy > r2) continue
          if ((x - (cx + hw)) ** 2 + dy * dy > r2) continue
        }
        visit(x, y)
      }
    }
  }

  /** Solid arch in one shade. */
  arch(cx: number, hw: number, top: number, bottom: number, shade: number, glass = 0) {
    this.lancet(cx, hw, top, bottom, (x, y) => this.set(x, y, shade, glass))
  }

  /** Triangle from a base row up to an apex (spires, gables, pinnacles). */
  spike(cx: number, base: number, apex: number, halfBase: number, shade: number) {
    const h = base - apex
    if (h <= 0) return
    for (let y = Math.round(apex); y <= Math.round(base); y++) {
      const hw = halfBase * ((y - apex) / h)
      this.rect(cx - hw, y, cx + hw, y, shade)
    }
  }
}

/** Deterministic random numbers, so the scene looks the same after a resize. */
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

export const hashInt = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
