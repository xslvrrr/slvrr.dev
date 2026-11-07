import { GLASS, hashInt, type Layer, SHADE } from './layers'
import type { Light } from './buildScene'

const CANDLE: Light['color'] = [1, 0.93, 0.8]
const PANES = [GLASS.pale, GLASS.grey, GLASS.dark, GLASS.grey]

/**
 * A gothic cathedral facade, drawn procedurally: twin spires, a rose window,
 * a gallery of kings, a door left slightly ajar, and a short run of side
 * aisles with pinnacled piers. Everything is in design units `D` relative to
 * the facade (~106 units wide, ~214 tall to the crosses), centred on `cx`
 * with its foot on `ground`.
 */
export function drawCathedral(L: Layer, cx: number, ground: number, D: number): Light[] {
  const lights: Light[] = []
  const X = (dx: number) => Math.round(cx + (dx - 50) * D)
  const Y = (dy: number) => Math.round(ground - dy * D)
  const P = (n: number) => Math.max(1, Math.round(n * D))
  let windowSeed = 1
  const nextSeed = () => hashInt(windowSeed++) & 127

  /** A leaded glass lancet with a stone surround. */
  const lancetWindow = (
    wx: number,
    hw: number,
    top: number,
    bottom: number,
    palette: number[],
    dim = false,
  ) => {
    const seed = nextSeed() | (dim ? 128 : 0)
    L.arch(wx, hw + 1, top - 1, bottom + 1, SHADE.trim)
    L.lancet(wx, hw, top, bottom, (x, y) => {
      const row = bottom - y
      if (hw >= 2 && x === Math.round(wx)) return L.set(x, y, SHADE.body, GLASS.lead)
      if (row % 5 === 4) return L.set(x, y, SHADE.body, GLASS.lead)
      const cell = Math.floor(row / 5) * 3 + (x < wx ? 0 : 1) + (seed & 127)
      L.set(x, y, SHADE.body, palette[hashInt(cell) % palette.length], seed)
    })
  }

  // --- side aisles: two bays each side, ending in a pinnacled pier ---
  for (const dir of [-1, 1] as const) {
    const bay = 24
    const inner = dir === -1 ? -3 : 103
    const outer = inner + dir * bay * 2
    L.rect(
      X(Math.min(inner, outer)),
      Y(84),
      X(Math.max(inner, outer)),
      ground,
      SHADE.body,
    )
    for (let x = X(Math.min(inner, outer)); x <= X(Math.max(inner, outer)); x++) {
      if (x % 3 === 0) L.set(x, Y(84) - 1, SHADE.body)
      L.set(x, Y(84), SHADE.trim)
    }
    L.rect(X(Math.min(inner, outer)), Y(50), X(Math.max(inner, outer)), Y(50), SHADE.trim)
    for (let k = 0; k <= 2; k++) {
      const pier = inner + dir * k * bay
      const px = X(pier)
      L.rect(X(pier - 2), Y(92), X(pier + 2), ground, SHADE.body)
      L.rect(X(pier - 2), Y(92), X(pier - 2), ground, SHADE.trim)
      L.spike(px, Y(92), Y(106), 2 * D + 0.5, SHADE.body)
      L.set(px, Y(106) - 1, SHADE.trim)
      if (k === 2) continue
      const mid = pier + (dir * bay) / 2
      lancetWindow(
        X(mid),
        P(3),
        Y(42),
        Y(14),
        [GLASS.candle, GLASS.candle, GLASS.flame],
        true,
      )
      lancetWindow(X(mid), P(3), Y(78), Y(58), PANES, true)
    }
  }

  // --- the flèche over the crossing, behind the facade ---
  L.spike(X(50), Y(146), Y(196), P(4), SHADE.body)
  L.rect(X(50), Y(196), X(50), Y(146), SHADE.trim)
  cross(L, X(50), Y(196), P(4), SHADE.trim)

  // --- twin towers ---
  for (const left of [0, 74]) {
    const tc = left + 13
    const tx = X(tc)
    L.rect(X(left), Y(140), X(left + 26), ground, SHADE.masonry)
    for (const edge of [left, left + 26]) {
      const out = edge === left ? -1 : 1
      const steps: [number, number, number][] = [
        [0, 50, 3],
        [50, 100, 2],
        [100, 138, 1],
      ]
      for (const [b, t, pr] of steps) {
        L.rect(X(edge), Y(t), X(edge + out * pr), Y(b), SHADE.masonry)
        L.rect(X(edge - out * 3), Y(t), X(edge - out * 3), Y(b), SHADE.trim)
        L.set(X(edge + out * pr), Y(t), SHADE.trim)
      }
    }
    L.arch(tx, P(7.5), Y(38), ground, SHADE.trim)
    L.arch(tx, P(6), Y(35), ground, SHADE.body)
    L.arch(tx, P(4.5), Y(31), ground, SHADE.body, GLASS.lead)
    lancetWindow(tx, P(5), Y(104), Y(68), PANES)
    lights.push({ x: tx, y: Y(86), r: P(18), power: 0.3, color: CANDLE })
    for (const off of [-4.5, 4.5]) {
      const bx = X(tc + off)
      L.arch(bx, P(2) + 1, Y(134) - 1, Y(114) + 1, SHADE.trim)
      L.lancet(bx, P(2), Y(134), Y(114), (x, y) =>
        L.set(x, y, SHADE.body, (Y(114) - y) % 2 ? GLASS.lead : 0),
      )
    }
    L.rect(X(left - 1), Y(144), X(left + 27), Y(140), SHADE.masonry)
    for (let x = X(left - 1); x <= X(left + 27); x++) {
      if (x % 2 === 0) L.set(x, Y(144) - 1, SHADE.trim)
    }
    for (const px of [left + 1.5, left + 24.5]) {
      L.spike(X(px), Y(144), Y(162), P(1.6), SHADE.masonry)
    }
    const base = Y(144)
    const apex = Y(208)
    L.spike(tx, base, apex, P(10), SHADE.masonry)
    L.rect(tx, apex, tx, base, SHADE.trim)
    const every = Math.max(3, P(6))
    for (let y = apex + every; y < base - 1; y += every) {
      const hw = P(10) * ((y - apex) / (base - apex))
      L.set(Math.round(tx - hw) - 1, y, SHADE.trim)
      L.set(Math.round(tx + hw) + 1, y, SHADE.trim)
    }
    L.spike(tx, Y(146), Y(158), P(3.2), SHADE.trim)
    L.arch(tx, Math.max(0, P(1.2) - 1), Y(155), Y(147), SHADE.body, GLASS.candle)
    cross(L, tx, apex, P(6), SHADE.trim)
  }

  // --- the nave front: gable, rose window, gallery of kings, great portal ---
  L.rect(X(26), Y(118), X(74), ground, SHADE.masonry)
  L.spike(X(50), Y(118), Y(148), 24 * D, SHADE.masonry)
  for (let y = Y(148); y <= Y(118); y++) {
    const hw = 24 * D * ((y - Y(148)) / (Y(118) - Y(148)))
    L.set(Math.round(X(50) - hw), y, SHADE.trim)
    L.set(Math.round(X(50) + hw), y, SHADE.trim)
    if ((y - Y(148)) % Math.max(3, P(5)) === 2) {
      L.set(Math.round(X(50) - hw) - 1, y, SHADE.trim)
      L.set(Math.round(X(50) + hw) + 1, y, SHADE.trim)
    }
  }
  cross(L, X(50), Y(148), P(7), SHADE.bright)
  L.disc(X(50), Y(129), P(3.5), SHADE.trim)
  L.disc(X(50), Y(129), Math.max(1, P(3.5) - 1), SHADE.body, GLASS.candle, nextSeed())

  for (const dy of [58, 112]) L.rect(X(-3), Y(dy), X(103), Y(dy), SHADE.trim)

  // gallery of kings: a row of niches, each with a statue
  for (let dx = 29; dx <= 71; dx += 4) {
    const nx = X(dx)
    L.arch(nx, Math.max(1, P(1.3)), Y(72), Y(62), SHADE.body, GLASS.lead)
    L.rect(nx, Y(69), nx, Y(62), SHADE.trim)
  }

  const rx = X(50)
  const ry = Y(91)
  const r = 15.5 * D
  rose(L, rx, ry, r, nextSeed())
  lights.push({ x: rx, y: ry, r: r * 2.6, power: 0.5, color: CANDLE })

  const archs: [number, number, number][] = [
    [14, 62, SHADE.trim],
    [12.5, 59, SHADE.body],
    [11, 56, SHADE.trim],
    [9.5, 53, SHADE.body],
  ]
  for (const [hw, top, shade] of archs) L.arch(X(50), P(hw), Y(top), ground, shade)
  const dhw = P(8)
  const dtop = Y(50)
  const spring = dtop + Math.round(1.732 * dhw)
  L.lancet(X(50), dhw, dtop, ground, (x, y) => {
    if (y < spring) return L.set(x, y, SHADE.masonry)
    if (y === spring || y === spring + 1) return L.set(x, y, SHADE.trim)
    if (x === X(50)) return L.set(x, y, SHADE.body, GLASS.flame, 40)
    const hinge = y === spring + P(9) || y === ground - P(8)
    L.set(x, y, hinge ? SHADE.trim : (x - X(50)) % 2 ? SHADE.masonry : SHADE.body)
  })
  cross(L, X(50), spring - 1, Math.max(3, Math.round((spring - dtop) * 0.7)), SHADE.trim)
  lights.push({ x: X(50), y: ground - P(6), r: P(22), power: 0.7, color: CANDLE })

  return lights
}

/** A rose window: rings of leaded panes divided by stone tracery. */
function rose(L: Layer, cx: number, cy: number, r: number, seed: number) {
  const outer = [GLASS.pale, GLASS.grey, GLASS.dark, GLASS.grey]
  const inner = [GLASS.pale, GLASS.candle]
  for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y++) {
    for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d > r + 1.5) continue
      if (d > r - 0.6) {
        L.set(x, y, SHADE.trim)
        continue
      }
      const a = Math.atan2(y - cy, x - cx) / (Math.PI * 2) + 0.5
      const t = d / r
      if (t < 0.24) {
        L.set(x, y, SHADE.body, d < 1.2 ? GLASS.flame : GLASS.candle, seed)
        continue
      }
      if (Math.abs(d - r * 0.24) < 0.55 || Math.abs(d - r * 0.62) < 0.55) {
        L.set(x, y, SHADE.trim)
        continue
      }
      const n = t < 0.62 ? 8 : 16
      const f = a * n
      const along = Math.min(f % 1, 1 - (f % 1)) * ((Math.PI * 2 * d) / n)
      if (along < 0.55) {
        L.set(x, y, t < 0.62 ? SHADE.trim : SHADE.body, t < 0.62 ? 0 : GLASS.lead)
        continue
      }
      const seg = Math.floor(f)
      const palette = t < 0.62 ? inner : outer
      L.set(x, y, SHADE.body, palette[seg % palette.length], (seed + seg * 29) & 127)
    }
  }
}

/** A Latin cross standing on (x, base), `h` pixels tall. */
export function cross(L: Layer, x: number, base: number, h: number, shade: number) {
  h = Math.max(3, h)
  const top = base - h
  L.rect(x, top, x, base, shade)
  const arm = Math.max(1, Math.round(h * 0.3))
  const ay = top + Math.max(1, Math.round(h * 0.3))
  L.rect(x - arm, ay, x + arm, ay, shade)
}
