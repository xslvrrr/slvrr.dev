import * as THREE from 'three'
import { expand, sprites, type SpriteName } from './sprites'
import { rng } from './textures'

/**
 * Turns a flat pixel-art sprite into a chunky sculpture: every pixel becomes
 * a column of voxels, deeper the further it is from the sprite's outline, so
 * the shapes swell like carved stone instead of looking like cut-outs.
 * Only faces that touch air are emitted.
 */
const COLORS: Record<string, [number, number, number]> = {
  '#': [0.6, 0.59, 0.56],
  '+': [0.4, 0.4, 0.38],
  '=': [0.74, 0.73, 0.69],
  '*': [0.86, 0.85, 0.8],
  ':': [0.04, 0.04, 0.045],
  o: [1, 0.72, 0.38],
  '@': [1, 0.93, 0.75],
}
const GLOWS = new Set(['o', '@'])

const FACES = [
  {
    n: [1, 0, 0],
    c: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    n: [-1, 0, 0],
    c: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    n: [0, 1, 0],
    c: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    n: [0, -1, 0],
    c: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, 1],
    c: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, -1],
    c: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
] as const

const cache = new Map<
  string,
  { stone: THREE.BufferGeometry; glow: THREE.BufferGeometry | null }
>()

export function voxelGeometry(name: SpriteName, size: number, maxDepth = 4) {
  const key = `${name}:${size}:${maxDepth}`
  const hit = cache.get(key)
  if (hit) return hit

  const rows = expand(sprites[name])
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const ch = (x: number, y: number) => {
    const c = rows[y]?.[x]
    return c && c !== '.' && c !== ' ' ? c : null
  }

  // Distance (in pixels, chessboard metric) from each solid pixel to the outline.
  const depth = new Int32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!ch(x, y)) continue
      let d = 1
      search: for (; d < maxDepth; d++) {
        for (let dy = -d; dy <= d; dy++)
          for (let dx = -d; dx <= d; dx++) if (!ch(x + dx, y + dy)) break search
      }
      depth[y * w + x] = d
    }
  const solid = (x: number, y: number, z: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h || !ch(x, y)) return false
    const d = depth[y * w + x]
    return z >= -d && z < d
  }

  const r = rng(name.length * 977 + w * 31 + h)
  const build = (glowing: boolean) => {
    const pos: number[] = []
    const nor: number[] = []
    const col: number[] = []
    const idx: number[] = []
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = ch(x, y)
        if (!c || GLOWS.has(c) !== glowing) continue
        const d = depth[y * w + x]
        const base = COLORS[c] ?? COLORS['#']
        for (let z = -d; z < d; z++) {
          // weathering: a little noise, and grime collecting towards the base
          const grime = 1 - (y / h) * 0.18
          const n = glowing ? 1 : (0.92 + r() * 0.12) * (1.06 - grime * 0.12)
          for (const f of FACES) {
            if (solid(x + f.n[0], y - f.n[1], z + f.n[2])) continue
            const start = pos.length / 3
            for (const corner of f.c) {
              pos.push(
                (x + corner[0] - w / 2) * size,
                (h - y - 1 + corner[1]) * size,
                (z + corner[2]) * size,
              )
              nor.push(f.n[0], f.n[1], f.n[2])
              col.push(base[0] * n, base[1] * n, base[2] * n)
            }
            idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
          }
        }
      }
    if (!pos.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    return g
  }

  const out = { stone: build(false)!, glow: build(true) }
  cache.set(key, out)
  return out
}
