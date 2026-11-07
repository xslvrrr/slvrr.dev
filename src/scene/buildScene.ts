import { GLASS, hashInt, Layer, rng, SHADE } from './layers'

/**
 * Draws the static parts of the night scene, procedurally, at the background's
 * pixel resolution: a gothic cathedral (twin spires, rose window, a door left
 * ajar) and, in front of it, a churchyard garden (iron fence, lanterns,
 * gravestones, cypresses, an angel, two dead trees).
 *
 * Each layer is taller than the screen. As the page scrolls, NightScene slides
 * them up at different speeds, so you slowly descend from the spires into the
 * garden (the garden, being closer, moves faster).
 */

/** Layer heights, in screen heights. Taller = more parallax travel. */
export const CATHEDRAL_HEIGHT = 1.25
export const GARDEN_HEIGHT = 1.85

export interface Light {
  /** Position in layer pixels. */
  x: number
  y: number
  /** Halo radius in pixels. */
  r: number
  power: number
  color: [number, number, number]
}

export interface Scene {
  cathedral: Layer
  garden: Layer
  cathedralLights: Light[]
  gardenLights: Light[]
  /** Row of the garden's ground line, in garden layer pixels. */
  gardenGround: number
  moon: { x: number; y: number; r: number }
}

const CANDLE: Light['color'] = [1, 0.7, 0.32]
const ROSE: Light['color'] = [0.95, 0.42, 0.42]

export function buildScene(W: number, H: number): Scene {
  const cathedral = new Layer(W, Math.round(H * CATHEDRAL_HEIGHT))
  const garden = new Layer(W, Math.round(H * GARDEN_HEIGHT))
  const cathedralLights = drawCathedral(cathedral, W, H)
  const { lights: gardenLights, ground } = drawGarden(garden, W, H)
  return {
    cathedral,
    garden,
    cathedralLights,
    gardenLights,
    gardenGround: ground,
    moon: {
      x: Math.round(W * (W > H ? 0.8 : 0.78)),
      y: Math.round(H * 0.17),
      r: Math.max(6, Math.round(Math.min(H, W * 1.4) * 0.06)),
    },
  }
}

/* ------------------------------------------------------------------------ */
/* Cathedral                                                                  */
/* ------------------------------------------------------------------------ */

function drawCathedral(L: Layer, W: number, H: number): Light[] {
  const rand = rng(7)
  const lights: Light[] = []
  const ground = Math.round(H * 1.12)
  // One design unit. The facade is ~106 units wide and 214 tall to the crosses.
  const D = Math.min((ground - H * 0.1) / 216, (W * 0.94) / 108)
  const cx = Math.round(W / 2)
  const X = (dx: number) => Math.round(cx + (dx - 50) * D)
  const Y = (dy: number) => Math.round(ground - dy * D)
  const P = (n: number) => Math.max(1, Math.round(n * D))
  let windowSeed = 1
  const nextSeed = () => hashInt(windowSeed++) & 255

  /** A stained glass lancet with lead cames and a stone surround. */
  const stainedWindow = (
    wx: number,
    hw: number,
    top: number,
    bottom: number,
    palette: number[],
    dim = false,
  ) => {
    const seed = (nextSeed() & 127) | (dim ? 128 : 0)
    L.arch(wx, hw + 1, top - 1, bottom + 1, SHADE.trim)
    L.lancet(wx, hw, top, bottom, (x, y) => {
      const row = bottom - y
      if (hw >= 2 && x === Math.round(wx)) return L.set(x, y, SHADE.body, GLASS.lead)
      if (row % 5 === 4) return L.set(x, y, SHADE.body, GLASS.lead)
      const cell = Math.floor(row / 5) * 3 + (x < wx ? 0 : 1) + (seed & 127)
      L.set(x, y, SHADE.body, palette[hashInt(cell) % palette.length], seed)
    })
  }

  // Earth under everything.
  L.rect(0, ground, W - 1, L.h - 1, SHADE.body)

  // --- side wings: aisles and clerestory, out to the edges of the screen ---
  const wing = (from: number, to: number, dir: 1 | -1) => {
    const a = Math.min(from, to)
    const b = Math.max(from, to)
    L.rect(a, Y(84), b, ground, SHADE.body)
    // roof cresting: a row of little iron spikes
    for (let x = a; x <= b; x++) {
      if (x % 3 === 0) L.set(x, Y(84) - 1, SHADE.body)
      L.set(x, Y(84), SHADE.trim)
    }
    L.rect(a, Y(50), b, Y(50), SHADE.trim)
    // bays between piers, walking outward from the tower
    const bay = 24
    for (let k = 0; ; k++) {
      const pier = (dir === -1 ? -3 : 103) + dir * k * bay
      const px = X(pier)
      if (dir === -1 ? px < -P(30) : px > W + P(30)) break
      // pier, rising above the roof with a pinnacle
      L.rect(X(pier - 2), Y(92), X(pier + 2), ground, SHADE.body)
      L.rect(X(pier - 2), Y(92), X(pier - 2), ground, SHADE.trim)
      L.spike(px, Y(92), Y(106), 2 * D + 0.5, SHADE.body)
      L.set(px, Y(106) - 1, SHADE.trim)
      // windows in the bay beyond this pier
      const mid = pier + (dir * bay) / 2
      if (X(mid) < -P(8) || X(mid) > W + P(8)) continue
      const lit = hashInt(k + (dir === 1 ? 50 : 0)) % 4
      stainedWindow(
        X(mid),
        P(3),
        Y(42),
        Y(14),
        lit === 0 ? [GLASS.lead] : [GLASS.candle, GLASS.candle, GLASS.flame],
        true,
      )
      stainedWindow(
        X(mid),
        P(3),
        Y(78),
        Y(58),
        lit === 1
          ? [GLASS.lead]
          : [GLASS.crimson, GLASS.sapphire, GLASS.violet, GLASS.sapphire, GLASS.emerald],
        true,
      )
    }
  }
  wing(X(-3), 0, -1)
  wing(X(103), W - 1, 1)

  // --- the flèche: a slender spire over the crossing, behind the facade ---
  L.spike(X(50), Y(146), Y(196), P(4), SHADE.body)
  L.rect(X(50), Y(196), X(50), Y(146), SHADE.trim)
  cross(L, X(50), Y(196), P(4), SHADE.trim)

  // --- twin towers ---
  for (const left of [0, 74]) {
    const tc = left + 13
    const tx = X(tc)
    L.rect(X(left), Y(140), X(left + 26), ground, SHADE.masonry)
    // stepped corner buttresses
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
    // side portal
    L.arch(tx, P(7.5), Y(38), ground, SHADE.trim)
    L.arch(tx, P(6), Y(35), ground, SHADE.body)
    L.arch(tx, P(4.5), Y(31), ground, SHADE.body, GLASS.lead)
    // the great window
    stainedWindow(tx, P(5), Y(104), Y(68), [
      GLASS.crimson,
      GLASS.sapphire,
      GLASS.candle,
      GLASS.violet,
    ])
    lights.push({ x: tx, y: Y(86), r: P(18), power: 0.35, color: CANDLE })
    // belfry openings with louvres
    for (const off of [-4.5, 4.5]) {
      const bx = X(tc + off)
      L.arch(bx, P(2) + 1, Y(134) - 1, Y(114) + 1, SHADE.trim)
      L.lancet(bx, P(2), Y(134), Y(114), (x, y) =>
        L.set(x, y, SHADE.body, (Y(114) - y) % 2 ? GLASS.lead : 0),
      )
    }
    // balustrade, corner pinnacles, and the spire
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
    // crockets: little stone leaves climbing the spire's edges
    const every = Math.max(3, P(6))
    for (let y = apex + every; y < base - 1; y += every) {
      const hw = P(10) * ((y - apex) / (base - apex))
      L.set(Math.round(tx - hw) - 1, y, SHADE.trim)
      L.set(Math.round(tx + hw) + 1, y, SHADE.trim)
    }
    // a lucarne (small gabled window) at the spire's foot
    L.spike(tx, Y(146), Y(158), P(3.2), SHADE.trim)
    L.arch(tx, Math.max(0, P(1.2) - 1), Y(155), Y(147), SHADE.body, GLASS.candle)
    cross(L, tx, apex, P(6), SHADE.trim)
  }

  // --- the nave front: gable, rose window, gallery of kings, great portal ---
  L.rect(X(26), Y(118), X(74), ground, SHADE.masonry)
  L.spike(X(50), Y(118), Y(148), 24 * D, SHADE.masonry)
  // gable edge with crockets
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

  // string courses across the whole facade
  for (const dy of [58, 112]) L.rect(X(-3), Y(dy), X(103), Y(dy), SHADE.trim)

  // gallery of kings: a row of niches, each with a statue
  for (let dx = 29; dx <= 71; dx += 4) {
    const nx = X(dx)
    L.arch(nx, Math.max(1, P(1.3)), Y(72), Y(62), SHADE.body, GLASS.lead)
    L.rect(nx, Y(69), nx, Y(62), SHADE.masonry)
  }

  // the rose window
  const rx = X(50)
  const ry = Y(91)
  const r = 15.5 * D
  rose(L, rx, ry, r, nextSeed())
  lights.push({ x: rx, y: ry, r: r * 2.6, power: 0.55, color: ROSE })

  // the great portal: layered archivolts around a door left slightly ajar
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
    if (y < spring) return L.set(x, y, SHADE.masonry) // tympanum
    if (y === spring || y === spring + 1) return L.set(x, y, SHADE.trim) // lintel
    if (x === X(50)) return L.set(x, y, SHADE.body, GLASS.flame, 40) // light through the gap
    const hinge = y === spring + P(9) || y === ground - P(8)
    L.set(x, y, hinge ? SHADE.trim : (x - X(50)) % 2 ? SHADE.masonry : SHADE.body)
  })
  cross(L, X(50), spring - 1, Math.max(3, Math.round((spring - dtop) * 0.7)), SHADE.trim)
  lights.push({ x: X(50), y: ground - P(6), r: P(22), power: 0.75, color: CANDLE })

  // steps up to the doors
  for (let i = 0; i < 3; i++) {
    const y = ground + i * Math.max(1, P(1.5))
    L.rect(X(34 - i * 3), y, X(66 + i * 3), y, SHADE.trim)
  }

  // a scatter of lighter and darker stones, so the walls aren't flat
  for (let i = 0; i < W * H * 0.03; i++) {
    const x = Math.floor(rand() * W)
    const y = Math.floor(rand() * ground)
    const k = (y * W + x) * 4
    if (!L.data[k + 3] || L.data[k + 1]) continue
    if (L.data[k] === SHADE.body * 50) L.data[k] = SHADE.masonry * 50
    else if (L.data[k] === SHADE.masonry * 50) L.data[k] = SHADE.body * 50
  }

  return lights
}

/** A rose window: rings of petals in stained glass, divided by lead and stone tracery. */
function rose(L: Layer, cx: number, cy: number, r: number, seed: number) {
  const outer = [GLASS.sapphire, GLASS.crimson, GLASS.sapphire, GLASS.violet]
  const inner = [GLASS.crimson, GLASS.candle]
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
      // lead rings between the bands
      if (Math.abs(d - r * 0.24) < 0.55 || Math.abs(d - r * 0.62) < 0.55) {
        L.set(x, y, SHADE.trim)
        continue
      }
      const n = t < 0.62 ? 8 : 16
      const f = a * n
      // spokes: stone tracery between petals, ~1px wide at any radius
      const along = Math.min(f % 1, 1 - (f % 1)) * ((Math.PI * 2 * d) / n)
      if (along < 0.55) {
        L.set(x, y, t < 0.62 ? SHADE.trim : SHADE.body, t < 0.62 ? 0 : GLASS.lead)
        continue
      }
      const seg = Math.floor(f)
      const palette = t < 0.62 ? inner : outer
      L.set(x, y, SHADE.body, palette[seg % palette.length], (seed + seg * 29) & 255)
    }
  }
}

/** A Latin cross standing on (x, base), `h` pixels tall. */
function cross(L: Layer, x: number, base: number, h: number, shade: number) {
  h = Math.max(3, h)
  const top = base - h
  L.rect(x, top, x, base, shade)
  const arm = Math.max(1, Math.round(h * 0.3))
  const ay = top + Math.max(1, Math.round(h * 0.3))
  L.rect(x - arm, ay, x + arm, ay, shade)
}

/* ------------------------------------------------------------------------ */
/* Garden                                                                     */
/* ------------------------------------------------------------------------ */

function drawGarden(L: Layer, W: number, H: number) {
  const rand = rng(1312)
  const lights: Light[] = []
  const G = Math.max(1, Math.min(H, W * 1.3) / 230)
  const g = (n: number) => Math.max(1, Math.round(n * G))
  const ground = L.h - Math.round(H * 0.1)
  const cx = Math.round(W / 2)

  // earth, with grass tufts along the top
  L.rect(0, ground, W - 1, L.h - 1, SHADE.body)
  for (let x = 0; x < W; x++) {
    if (rand() < 0.35)
      L.rect(x, ground - 1 - Math.floor(rand() * g(3)), x, ground, SHADE.body)
  }

  // the flagstone path to the cathedral doors
  for (let y = ground; y < L.h; y++) {
    const f = (y - ground) / (L.h - ground)
    const hw = Math.round(g(9) + f * g(46))
    const row = Math.floor((y - ground) / g(3))
    for (let x = cx - hw; x <= cx + hw; x++) {
      const joint = (y - ground) % g(3) === 0 || (x + row * g(4)) % g(9) === 0
      const edge = x === cx - hw || x === cx + hw
      L.set(x, y, edge ? SHADE.trim : joint ? SHADE.body : SHADE.masonry)
    }
  }

  // dead trees at the edges, framing everything
  const treeH = Math.min(H * 1.05, W * 0.55)
  tree(L, Math.round(W * 0.05), ground, treeH, -1, g, rng(3))
  tree(L, Math.round(W * 0.95), ground, treeH * 0.92, 1, g, rng(11))

  // cypresses, if there's room
  if (W > H * 0.9) {
    for (const side of [-1, 1])
      cypress(L, cx + side * Math.round(W * 0.22), ground, g, rand)
  }

  // the iron fence, with a gate opening on the path
  const fenceH = g(24)
  const gateHW = g(15)
  const pillarW = g(3)
  const pillarH = g(36)
  for (let x = 0; x < W; x += g(4)) {
    if (Math.abs(x - cx) < gateHW + pillarW + g(2)) continue
    L.rect(x, ground - fenceH, x + g(1) - 1, ground, SHADE.body)
    // spear tip
    L.set(x, ground - fenceH - 1, SHADE.trim)
    L.set(x - 1, ground - fenceH + 1, SHADE.body)
    L.set(x + 1, ground - fenceH + 1, SHADE.body)
  }
  for (const ry of [ground - g(5), ground - g(20)]) {
    L.rect(0, ry, cx - gateHW - pillarW, ry, SHADE.body)
    L.rect(cx + gateHW + pillarW, ry, W - 1, ry, SHADE.body)
  }

  // stone pillars along the fence, with ball finials
  for (let k = 1; ; k++) {
    const off = gateHW + pillarW + k * g(110)
    if (off > W / 2 + g(10)) break
    for (const side of [-1, 1]) {
      const px = cx + side * off
      L.rect(px - g(3), ground - g(32), px + g(3), ground, SHADE.body)
      L.rect(px - g(4), ground - g(33), px + g(4), ground - g(32), SHADE.trim)
      L.disc(px, ground - g(33) - g(2.5), g(2.2), SHADE.body)
    }
  }

  // the gate: two pillars with lanterns, joined by an iron arch with a cross
  for (const side of [-1, 1]) {
    const px = cx + side * (gateHW + pillarW)
    L.rect(px - pillarW, ground - pillarH, px + pillarW, ground, SHADE.body)
    L.rect(px - pillarW, ground - pillarH, px - pillarW, ground, SHADE.trim)
    L.rect(
      px - pillarW - 1,
      ground - pillarH - g(2),
      px + pillarW + 1,
      ground - pillarH,
      SHADE.trim,
    )
    lantern(L, px, ground - pillarH - g(2) - 1, g, lights)
  }
  const archR = gateHW + pillarW
  const archTop = ground - pillarH - g(2)
  for (let i = 0; i <= 64; i++) {
    const a = (Math.PI * i) / 64
    L.set(cx + Math.cos(a) * archR, archTop - Math.sin(a) * archR * 0.5, SHADE.body)
  }
  cross(L, cx, archTop - Math.round(archR * 0.5) - 1, g(7), SHADE.body)

  // low hedges along the fence on either side of the gate
  for (const side of [-1, 1]) {
    const start = cx + side * (gateHW + pillarW * 2 + g(2))
    const len = Math.round(W * 0.16)
    for (let i = 0; i < len; i++) {
      const x = start + side * i
      const h =
        g(8) +
        Math.round(2 * G * Math.abs(Math.sin((i * 0.4) / G))) +
        (rand() < 0.2 ? 1 : 0)
      L.rect(x, ground - h, x, ground, SHADE.body)
      if (rand() < 0.15)
        L.set(x, ground - h + 2 + Math.floor(rand() * (h - 3)), SHADE.masonry)
    }
  }

  // a weeping angel on a plinth
  if (W > H * 0.75) angel(L, cx - Math.round(W * 0.33), ground, g)

  // a lantern on a post, further out
  if (W > H) {
    for (const side of [-1, 1]) {
      const px = cx + side * Math.round(W * 0.4)
      L.rect(px, ground - g(24), px, ground, SHADE.body)
      L.rect(px, ground - g(24), px + side * g(4), ground - g(24), SHADE.body)
      lantern(L, px + side * g(4), ground - g(16), g, lights, true)
    }
  }

  // gravestones, back to front, leaving the path clear
  const stones: { x: number; y: number; kind: number; s: number }[] = []
  const count = Math.round(W / g(20))
  for (let i = 0; i < count * 3 && stones.length < count; i++) {
    const depth = rand()
    const y = ground + Math.round(depth * (L.h - ground - g(4)))
    const x = Math.round(rand() * W)
    const pathHW = g(9) + depth * g(46) + g(10)
    if (Math.abs(x - cx) < pathHW) continue
    if (stones.some((s) => Math.abs(s.x - x) < g(9) && Math.abs(s.y - y) < g(4))) continue
    stones.push({ x, y, kind: Math.floor(rand() * 5), s: 1 + depth * 0.6 })
  }
  stones.sort((a, b) => a.y - b.y)
  for (const s of stones) gravestone(L, s.x, s.y, s.kind, s.s, g)

  return { lights, ground }
}

function lantern(
  L: Layer,
  x: number,
  base: number,
  g: (n: number) => number,
  lights: Light[],
  hanging = false,
) {
  const hw = g(2)
  const h = g(5)
  const top = hanging ? base : base - h
  const bottom = top + h
  L.rect(x - hw, top, x + hw, bottom, SHADE.body)
  L.rect(x - hw + 1, top + 1, x + hw - 1, bottom - 1, SHADE.body, GLASS.candle, 90)
  L.set(x, Math.round((top + bottom) / 2), SHADE.body, GLASS.flame, 90)
  L.spike(x, top, top - g(2), hw + 1, SHADE.body)
  lights.push({ x, y: (top + bottom) / 2, r: g(30), power: 0.9, color: [1, 0.72, 0.36] })
}

function gravestone(
  L: Layer,
  x: number,
  base: number,
  kind: number,
  s: number,
  g: (n: number) => number,
) {
  const k = (n: number) => g(n * s)
  if (kind <= 1) {
    // rounded slab with a carved cross
    const hw = k(3)
    const h = k(10)
    L.rect(x - hw, base - h + hw, x + hw, base, SHADE.body)
    L.disc(x, base - h + hw, hw, SHADE.body)
    L.rect(x, base - h + hw - 1, x, base - h + hw + k(4), SHADE.trim)
    L.rect(x - k(1.2), base - h + hw + 1, x + k(1.2), base - h + hw + 1, SHADE.trim)
  } else if (kind === 2) {
    // Latin cross on a step
    L.rect(x - k(3), base - k(2), x + k(3), base, SHADE.body)
    L.rect(x - k(0.8), base - k(16), x + k(0.8), base, SHADE.body)
    L.rect(x - k(4), base - k(12), x + k(4), base - k(11), SHADE.body)
  } else if (kind === 3) {
    // Celtic cross with its ring
    L.rect(x - k(0.8), base - k(15), x + k(0.8), base, SHADE.body)
    L.rect(x - k(4), base - k(11), x + k(4), base - k(10), SHADE.body)
    const cy = base - k(10.5)
    const r = k(2.6)
    for (let i = 0; i < 32; i++) {
      const a = (Math.PI * 2 * i) / 32
      L.set(x + Math.cos(a) * r, cy + Math.sin(a) * r, SHADE.body)
    }
    L.set(x, cy, SHADE.trim)
  } else {
    // obelisk
    L.rect(x - k(3), base - k(3), x + k(3), base, SHADE.body)
    L.rect(x - k(2), base - k(16), x + k(2), base, SHADE.body)
    L.spike(x, base - k(16), base - k(20), k(2), SHADE.body)
  }
}

function tree(
  L: Layer,
  x: number,
  ground: number,
  height: number,
  side: -1 | 1,
  g: (n: number) => number,
  rand: () => number,
) {
  const branch = (
    bx: number,
    by: number,
    angle: number,
    len: number,
    thick: number,
    depth: number,
  ) => {
    // two segments with a kink, so limbs look gnarled
    const kink = (rand() - 0.5) * 0.5
    const mx = bx + Math.cos(angle) * len * 0.5
    const my = by - Math.sin(angle) * len * 0.5
    const ex = mx + Math.cos(angle + kink) * len * 0.5
    const ey = my - Math.sin(angle + kink) * len * 0.5
    L.line(bx, by, mx, my, thick, SHADE.body)
    L.line(mx, my, ex, ey, Math.max(1, thick * 0.85), SHADE.body)
    if (depth === 0) return
    const n = rand() < 0.3 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * (0.45 + rand() * 0.4)
      branch(
        ex,
        ey,
        angle + kink + spread + (rand() - 0.5) * 0.3,
        len * (0.62 + rand() * 0.16),
        Math.max(1, thick * 0.62),
        depth - 1,
      )
    }
  }
  // lean out toward the edge of the screen, so the crowns frame the page
  const lean = Math.PI / 2 - side * 0.22
  const trunk = Math.max(3, g(6))
  // root flare
  L.rect(x - trunk, ground - g(3), x + trunk, ground, SHADE.body)
  branch(x, ground, lean, height * 0.34, trunk, 6)
}

function cypress(
  L: Layer,
  x: number,
  ground: number,
  g: (n: number) => number,
  rand: () => number,
) {
  const h = g(58)
  const hw = g(5)
  for (let i = 0; i <= h; i++) {
    const f = i / h
    const w = f < 0.3 ? hw * (0.7 + f) : hw * Math.pow(1 - (f - 0.3) / 0.7, 0.75)
    const jag = rand() < 0.3 ? 1 : 0
    const y = ground - i
    L.rect(x - w - jag, y, x + w + (rand() < 0.3 ? 1 : 0), y, SHADE.body)
    if (rand() < 0.35) L.set(x + Math.round((rand() - 0.5) * w * 1.6), y, SHADE.masonry)
  }
}

/** A stone angel with bowed head and raised wings, on a plinth. */
function angel(L: Layer, x: number, ground: number, g: (n: number) => number) {
  const plinth = g(12)
  L.rect(x - g(5), ground - plinth, x + g(5), ground, SHADE.body)
  L.rect(x - g(6), ground - plinth - 1, x + g(6), ground - plinth, SHADE.trim)
  L.rect(x - g(6), ground - g(2), x + g(6), ground, SHADE.body)
  const feet = ground - plinth - 1
  const robe = g(15)
  // robe
  for (let i = 0; i <= robe; i++) {
    const w = g(4) - (g(2) * i) / robe
    L.rect(x - w, feet - i, x + w, feet - i, SHADE.body)
  }
  const shoulder = feet - robe
  // bowed head, slightly forward
  L.disc(x - 1, shoulder - g(2), g(1.6), SHADE.body)
  // wings: swept up and back on both sides
  for (const side of [-1, 1]) {
    for (let i = 0; i <= g(12); i++) {
      const f = i / g(12)
      const wx = x + side * (g(1) + f * g(5))
      const top = shoulder - g(9) * f - g(2)
      const bottom = shoulder + g(6) * (1 - f * 0.6)
      L.rect(wx, top, wx, bottom, SHADE.body)
      if (i % 3 === 1) L.set(wx, bottom - 1, SHADE.masonry)
    }
  }
  // hands together in prayer
  L.set(x, shoulder + g(3), SHADE.trim)
}
