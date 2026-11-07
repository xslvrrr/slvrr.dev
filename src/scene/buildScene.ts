import { cross, drawCathedral } from './cathedral'
import { GLASS, Layer, rng, SHADE } from './layers'
import { stamp, type SpriteName } from './sprites'

/**
 * Builds the explorable night garden, procedurally, at the background's pixel
 * resolution, in three parallax layers:
 *
 * - far:  the cathedral and a distant tree line on the horizon. It drifts only
 *         a little across the whole walk, like something huge and far away.
 * - mid:  the garden itself, as wide as the whole journey. Each page section
 *         is a stop at a landmark (the gate, a herald angel, a fountain, a
 *         mausoleum, a shrine, the graves, a calvary), with statues, lamps,
 *         graves and cypresses in between. On wide screens it moves exactly
 *         with the page content, so each section stands beside its landmark.
 * - near: dark foreground silhouettes (dead trees, railings, giant urns) that
 *         sweep past faster than the garden.
 */

export type LandmarkKind =
  'gate' | 'herald' | 'fountain' | 'mausoleum' | 'shrine' | 'graves' | 'calvary'

export interface Light {
  /** Position in layer pixels. */
  x: number
  y: number
  /** Halo radius in pixels. */
  r: number
  power: number
  color: [number, number, number]
}

export interface Station {
  landmark: LandmarkKind
  /** Centre of the landmark, in garden (mid layer) pixels. */
  x: number
}

export interface World {
  far: Layer
  mid: Layer
  near: Layer
  farLights: Light[]
  midLights: Light[]
  /** How far the far layer slides over the whole walk, in pixels. */
  farTravel: number
  /** Speed of the near layer relative to the garden. */
  nearSpeed: number
  /** Row of the garden's ground line (for fog). */
  ground: number
  moon: { x: number; y: number; r: number }
}

export const NEAR_SPEED = 1.4
const CANDLE: Light['color'] = [1, 0.93, 0.8]

export function buildWorld(
  W: number,
  H: number,
  stations: Station[],
  worldW: number,
): World {
  const width = Math.max(W, Math.ceil(worldW)) + 2
  const horizon = Math.round(H * 0.79)
  const ground = Math.round(H * 0.88)
  const farTravel = Math.round(W * 0.35)

  // ---- far: the cathedral over a distant tree line ----
  const far = new Layer(W + farTravel + 2, H)
  const D = Math.min((horizon - H * 0.1) / 216, (W * 1.05) / 108)
  const farLights = drawCathedral(far, Math.round(W * 0.64), horizon, D)
  treeLine(far, horizon, rng(5))

  // ---- mid: the garden ----
  const mid = new Layer(width, H)
  const midLights: Light[] = []
  garden(mid, ground, stations, midLights)

  // ---- near: foreground silhouettes ----
  const near = new Layer(Math.ceil(width * NEAR_SPEED) + W, H)
  foreground(near, W, H, rng(23))

  return {
    far,
    mid,
    near,
    farLights,
    midLights,
    farTravel,
    nearSpeed: NEAR_SPEED,
    ground,
    moon: {
      x: Math.round(W * (W > H ? 0.84 : 0.8)),
      y: Math.round(H * 0.15),
      r: Math.max(6, Math.round(Math.min(H, W * 1.4) * 0.055)),
    },
  }
}

/* ------------------------------------------------------------------------ */
/* Far                                                                        */
/* ------------------------------------------------------------------------ */

function treeLine(L: Layer, horizon: number, rand: () => number) {
  L.rect(0, horizon, L.w - 1, L.h - 1, SHADE.body)
  let h = 4
  for (let x = 0; x < L.w; x++) {
    h += (rand() - 0.5) * 2
    h = Math.max(2, Math.min(9, h))
    const bump = Math.round(h + Math.sin(x * 0.21) * 2)
    L.rect(x, horizon - bump, x, horizon, SHADE.body)
    // the odd cypress spire
    if (rand() < 0.025) {
      const t = 10 + Math.floor(rand() * 12)
      L.spike(x, horizon - bump, horizon - bump - t, 2, SHADE.body)
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Mid: the garden                                                            */
/* ------------------------------------------------------------------------ */

/** Landmarks are drawn at double size, so each stop has a real presence. */
const LANDMARK_SCALE = 2

/** Half-width of each landmark at full size, kept clear of other statues. */
const FOOTPRINT: Record<LandmarkKind, number> = {
  gate: 50,
  herald: 34,
  fountain: 38,
  mausoleum: 52,
  shrine: 40,
  graves: 50,
  calvary: 50,
}

function garden(L: Layer, ground: number, stations: Station[], lights: Light[]) {
  const rand = rng(1312)

  // earth and the gravel walk
  L.rect(0, ground, L.w - 1, L.h - 1, SHADE.body)
  for (let y = ground + 1; y < Math.min(L.h, ground + 7); y++) {
    for (let x = 0; x < L.w; x++) {
      if ((x * 7 + y * 13) % 5 === 0 || rand() < 0.15) L.set(x, y, SHADE.masonry)
    }
  }
  for (let x = 0; x < L.w; x++) {
    if (rand() < 0.3)
      L.rect(x, ground - 1 - Math.floor(rand() * 2), x, ground, SHADE.body)
  }

  // the boundary behind everything: hedges, railings and low walls
  for (let x = 0; x < L.w;) {
    const len = 50 + Math.floor(rand() * 110)
    const kind = Math.floor(rand() * 3)
    if (kind === 0) hedge(L, x, x + len, ground, rand)
    else if (kind === 1) railing(L, x, x + len, ground, 20)
    else lowWall(L, x, x + len, ground)
    x += len
  }

  // landmarks, drawn at their own size and then blown up
  const clear = (x: number, pad: number) =>
    stations.every(
      (s) => Math.abs(s.x - x) > FOOTPRINT[s.landmark] * LANDMARK_SCALE + pad,
    )
  for (const s of stations) {
    const k = LANDMARK_SCALE
    const local = new Layer(200, 100)
    const lx = 100
    const lg = 96
    const own: Light[] = []
    // the gate's railings run off at normal size
    if (s.landmark === 'gate') {
      railing(L, Math.round(s.x) - 180, Math.round(s.x) - 48, ground, 22)
      railing(L, Math.round(s.x) + 48, Math.round(s.x) + 180, ground, 22)
    }
    landmark(local, s.landmark, lx, lg, own, rand)
    const ox = Math.round(s.x) - lx * k
    const oy = ground - lg * k
    L.blit(local, ox, oy, k)
    for (const l of own) {
      lights.push({ ...l, x: ox + l.x * k, y: oy + l.y * k, r: l.r * k })
    }
  }

  // statues, lamps, graves and trees in between
  for (let x = 14 + Math.floor(rand() * 20); x < L.w - 10;) {
    const r = rand()
    let span = 0
    if (!clear(x, 16)) {
      x += 8
      continue
    }
    if (r < 0.24) span = statueOnPedestal(L, x, ground, rand)
    else if (r < 0.34) span = bustOnColumn(L, x, ground)
    else if (r < 0.44) span = urnOnPedestal(L, x, ground)
    else if (r < 0.58) span = lampPost(L, x, ground, lights)
    else if (r < 0.72) span = graveCluster(L, x, ground, rand)
    else if (r < 0.88) span = cypress(L, x, ground, rand)
    else span = obelisk(L, x, ground)
    x += span + 22 + Math.floor(rand() * 40)
  }
}

function landmark(
  L: Layer,
  kind: LandmarkKind,
  x: number,
  ground: number,
  lights: Light[],
  rand: () => number,
) {
  switch (kind) {
    case 'gate': {
      for (const side of [-1, 1]) {
        const px = x + side * 24
        L.rect(px - 3, ground - 40, px + 3, ground, SHADE.masonry)
        L.rect(px - 3, ground - 40, px - 3, ground, SHADE.trim)
        L.rect(px - 4, ground - 42, px + 4, ground - 40, SHADE.trim)
        lantern(L, px, ground - 43, lights, 16)
        // gate leaves, swung open
        for (let i = 0; i < 9; i += 2) {
          const bx = px - side * (4 + i)
          L.rect(bx, ground - 30 + i, bx, ground - 2 + Math.floor(i / 3), SHADE.body)
        }
        L.line(px - side * 4, ground - 30, px - side * 12, ground - 22, 1, SHADE.body)
      }
      for (let i = 0; i <= 48; i++) {
        const a = (Math.PI * i) / 48
        L.set(x + Math.cos(a) * 24, ground - 44 - Math.sin(a) * 12, SHADE.body)
      }
      cross(L, x, ground - 57, 8, SHADE.body)
      break
    }
    case 'herald': {
      const top = pedestal(L, x, ground, 8, 30, true)
      stamp(L, 'herald', x + 3, top)
      for (const side of [-1, 1]) cypress(L, x + side * 30, ground, rand)
      break
    }
    case 'fountain': {
      // lower basin
      L.rect(x - 33, ground - 8, x + 33, ground, SHADE.masonry)
      L.rect(x - 35, ground - 9, x + 35, ground - 9, SHADE.trim)
      L.rect(x - 32, ground - 10, x + 32, ground - 10, SHADE.body, GLASS.water)
      // column and upper bowl
      L.rect(x - 2, ground - 30, x + 2, ground - 9, SHADE.masonry)
      L.rect(x - 4, ground - 12, x + 4, ground - 9, SHADE.masonry)
      for (let i = 0; i < 5; i++) {
        const hw = 6 + i * 2
        L.rect(x - hw, ground - 30 - i, x + hw, ground - 30 - i, SHADE.masonry)
      }
      L.rect(x - 15, ground - 35, x + 15, ground - 35, SHADE.trim)
      // falling water, animated by the shader
      for (const side of [-1, 1]) {
        for (let y = ground - 34; y <= ground - 10; y++) {
          const spread = Math.round(((y - (ground - 34)) / 24) ** 2 * 4)
          L.set(x + side * (15 + spread), y, SHADE.body, GLASS.water)
          L.set(x + side * (16 + spread), y, SHADE.body, GLASS.water)
        }
      }
      L.rect(x - 1, ground - 38, x + 1, ground - 36, SHADE.masonry)
      stamp(L, 'cherub', x, ground - 39)
      break
    }
    case 'mausoleum': {
      L.rect(x - 32, ground - 3, x + 32, ground, SHADE.masonry)
      L.rect(x - 30, ground - 6, x + 30, ground - 4, SHADE.masonry)
      L.rect(x - 32, ground - 3, x + 32, ground - 3, SHADE.trim)
      L.rect(x - 30, ground - 6, x + 30, ground - 6, SHADE.trim)
      L.rect(x - 24, ground - 40, x + 24, ground - 7, SHADE.masonry)
      for (const px of [-23, -15, 15, 23]) {
        L.rect(x + px, ground - 40, x + px, ground - 7, SHADE.trim)
      }
      L.rect(x - 26, ground - 42, x + 26, ground - 41, SHADE.trim)
      L.spike(x, ground - 43, ground - 60, 27, SHADE.masonry)
      for (let y = ground - 60; y <= ground - 43; y++) {
        const hw = 27 * ((y - (ground - 60)) / 17)
        L.set(Math.round(x - hw), y, SHADE.trim)
        L.set(Math.round(x + hw), y, SHADE.trim)
      }
      cross(L, x, ground - 61, 9, SHADE.trim)
      for (const side of [-1, 1])
        L.spike(x + side * 25, ground - 43, ground - 52, 2, SHADE.masonry)
      L.disc(x, ground - 50, 3, SHADE.trim)
      L.disc(x, ground - 50, 2, SHADE.body, GLASS.grey, 12)
      // the door, left ajar
      L.arch(x, 7, ground - 33, ground - 7, SHADE.trim)
      L.lancet(x, 6, ground - 32, ground - 7, (px, py) =>
        L.set(px, py, SHADE.body, px === x + 2 ? GLASS.flame : GLASS.lead, 70),
      )
      lights.push({ x: x + 2, y: ground - 14, r: 18, power: 0.55, color: CANDLE })
      stamp(L, 'weeper', x + 42, ground - 1)
      urnOnPedestal(L, x - 38, ground)
      break
    }
    case 'shrine': {
      L.rect(x - 15, ground - 6, x + 15, ground, SHADE.masonry)
      L.rect(x - 15, ground - 6, x + 15, ground - 6, SHADE.trim)
      L.rect(x - 12, ground - 48, x + 12, ground - 7, SHADE.masonry)
      L.arch(x, 10, ground - 48, ground - 7, SHADE.trim)
      L.arch(x, 9, ground - 46, ground - 7, SHADE.body, GLASS.lead)
      stamp(L, 'madonna', x, ground - 8)
      L.spike(x, ground - 49, ground - 64, 14, SHADE.masonry)
      for (const side of [-1, 1])
        L.spike(x + side * 13, ground - 48, ground - 59, 2, SHADE.masonry)
      cross(L, x, ground - 65, 7, SHADE.trim)
      // votive candles along the plinth
      for (let i = -10; i <= 10; i += 4) {
        const h = 2 + (Math.abs(i) % 3)
        L.rect(x + i, ground - 7 - h, x + i, ground - 7, SHADE.trim)
        L.set(x + i, ground - 8 - h, SHADE.body, GLASS.flame, (i * 13) & 127)
      }
      lights.push({ x, y: ground - 12, r: 22, power: 0.85, color: CANDLE })
      stamp(L, 'monk', x - 26, ground - 1)
      lights.push({ x: x - 22, y: ground - 13, r: 18, power: 0.6, color: CANDLE })
      break
    }
    case 'graves': {
      L.rect(x - 16, ground - 9, x + 16, ground, SHADE.masonry)
      L.rect(x - 17, ground - 10, x + 17, ground - 10, SHADE.trim)
      L.rect(x - 13, ground - 7, x + 13, ground - 3, SHADE.body)
      stamp(L, 'weeper', x, ground - 11, { flip: true })
      const offsets = [-44, -35, -27, 25, 34, 43]
      offsets.forEach((o, i) => gravestone(L, x + o, ground + (i % 2), i % 5))
      gravestone(L, x - 20, ground, 3)
      break
    }
    case 'calvary': {
      L.rect(x - 30, ground - 3, x + 30, ground, SHADE.masonry)
      L.rect(x - 22, ground - 6, x + 22, ground - 4, SHADE.masonry)
      L.rect(x - 14, ground - 9, x + 14, ground - 7, SHADE.masonry)
      for (const [hw, y] of [
        [30, 3],
        [22, 6],
        [14, 9],
      ]) {
        L.rect(x - hw, ground - y, x + hw, ground - y, SHADE.trim)
      }
      L.rect(x - 2, ground - 84, x + 2, ground - 10, SHADE.masonry)
      L.rect(x - 15, ground - 68, x + 15, ground - 65, SHADE.masonry)
      L.rect(x + 2, ground - 84, x + 2, ground - 10, SHADE.trim)
      L.rect(x - 15, ground - 68, x + 15, ground - 68, SHADE.trim)
      stamp(L, 'weeper', x - 22, ground - 4, { flip: true })
      stamp(L, 'weeper', x + 22, ground - 4)
      stamp(L, 'monk', x + 42, ground - 1)
      lights.push({ x: x + 46, y: ground - 13, r: 18, power: 0.6, color: CANDLE })
      break
    }
  }
}

/** A stone pedestal; returns the row its top surface is on. */
function pedestal(
  L: Layer,
  x: number,
  ground: number,
  hw: number,
  h: number,
  steps = false,
) {
  let base = ground
  if (steps) {
    L.rect(x - hw - 4, ground - 2, x + hw + 4, ground, SHADE.masonry)
    L.rect(x - hw - 4, ground - 2, x + hw + 4, ground - 2, SHADE.trim)
    base = ground - 3
  }
  L.rect(x - hw - 1, base - 2, x + hw + 1, base, SHADE.masonry)
  L.rect(x - hw, base - h, x + hw, base, SHADE.masonry)
  L.rect(x - hw + 1, base - h + 3, x - hw + 1, base - 4, SHADE.trim)
  L.rect(x - hw - 1, base - h - 2, x + hw + 1, base - h, SHADE.masonry)
  L.rect(x - hw - 1, base - h - 2, x + hw + 1, base - h - 2, SHADE.trim)
  return base - h - 3
}

const STATUES: SpriteName[] = ['angel', 'madonna', 'monk', 'herald', 'weeper', 'angel']

function statueOnPedestal(L: Layer, x: number, ground: number, rand: () => number) {
  const name = STATUES[Math.floor(rand() * STATUES.length)]
  const tall = rand() < 0.5
  const top = pedestal(L, x, ground, name === 'herald' ? 7 : 6, tall ? 18 : 8)
  stamp(L, name, x, top, { flip: rand() < 0.5 })
  return 30
}

function bustOnColumn(L: Layer, x: number, ground: number) {
  const top = pedestal(L, x, ground, 3, 24)
  stamp(L, 'bust', x, top)
  return 12
}

function urnOnPedestal(L: Layer, x: number, ground: number) {
  const top = pedestal(L, x, ground, 5, 14)
  stamp(L, 'urn', x, top)
  return 14
}

function lampPost(L: Layer, x: number, ground: number, lights: Light[]) {
  L.rect(x - 2, ground - 3, x + 2, ground, SHADE.body)
  L.rect(x, ground - 30, x, ground - 3, SHADE.body)
  L.rect(x - 1, ground - 30, x + 1, ground - 30, SHADE.body)
  lantern(L, x, ground - 31, lights)
  return 8
}

function lantern(L: Layer, x: number, base: number, lights: Light[], r = 30) {
  const top = base - 5
  L.rect(x - 2, top, x + 2, base, SHADE.body)
  L.rect(x - 1, top + 1, x + 1, base - 1, SHADE.body, GLASS.candle, (x * 7) & 127)
  L.set(x, top + 2, SHADE.body, GLASS.flame, (x * 7) & 127)
  L.spike(x, top, top - 2, 3, SHADE.body)
  lights.push({ x, y: top + 2, r, power: 0.8, color: CANDLE })
}

function graveCluster(L: Layer, x: number, ground: number, rand: () => number) {
  const n = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    gravestone(L, x + i * 11, ground + Math.floor(rand() * 2), Math.floor(rand() * 5))
  }
  return n * 11
}

function gravestone(L: Layer, x: number, base: number, kind: number) {
  if (kind <= 1) {
    L.rect(x - 3, base - 7, x + 3, base, SHADE.masonry)
    L.disc(x, base - 7, 3, SHADE.masonry)
    L.rect(x, base - 8, x, base - 4, SHADE.trim)
    L.rect(x - 1, base - 7, x + 1, base - 7, SHADE.trim)
  } else if (kind === 2) {
    L.rect(x - 3, base - 2, x + 3, base, SHADE.masonry)
    L.rect(x - 1, base - 16, x, base, SHADE.masonry)
    L.rect(x - 4, base - 12, x + 3, base - 11, SHADE.masonry)
  } else if (kind === 3) {
    L.rect(x - 1, base - 15, x, base, SHADE.masonry)
    L.rect(x - 4, base - 11, x + 3, base - 10, SHADE.masonry)
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24
      L.set(x - 0.5 + Math.cos(a) * 2.6, base - 10.5 + Math.sin(a) * 2.6, SHADE.masonry)
    }
  } else {
    L.rect(x - 3, base - 3, x + 3, base, SHADE.masonry)
    L.rect(x - 2, base - 16, x + 2, base, SHADE.masonry)
    L.spike(x, base - 16, base - 20, 2, SHADE.masonry)
  }
}

function obelisk(L: Layer, x: number, ground: number) {
  L.rect(x - 5, ground - 4, x + 5, ground, SHADE.masonry)
  L.rect(x - 5, ground - 4, x + 5, ground - 4, SHADE.trim)
  L.rect(x - 3, ground - 34, x + 3, ground - 5, SHADE.masonry)
  L.rect(x + 3, ground - 34, x + 3, ground - 5, SHADE.trim)
  L.spike(x, ground - 34, ground - 40, 3, SHADE.masonry)
  return 12
}

function cypress(L: Layer, x: number, ground: number, rand: () => number) {
  const h = 40 + Math.floor(rand() * 26)
  const hw = 4 + Math.floor(rand() * 2)
  for (let i = 0; i <= h; i++) {
    const f = i / h
    const w = f < 0.3 ? hw * (0.7 + f) : hw * Math.pow(1 - (f - 0.3) / 0.7, 0.75)
    const y = ground - i
    L.rect(
      x - w - (rand() < 0.3 ? 1 : 0),
      y,
      x + w + (rand() < 0.3 ? 1 : 0),
      y,
      SHADE.body,
    )
    if (rand() < 0.3) L.set(x + Math.round((rand() - 0.5) * w * 1.6), y, SHADE.masonry)
  }
  return hw * 2 + 2
}

function hedge(L: Layer, from: number, to: number, ground: number, rand: () => number) {
  for (let x = from; x < to; x++) {
    const h = 9 + Math.round(2 * Math.abs(Math.sin(x * 0.35))) + (rand() < 0.2 ? 1 : 0)
    L.rect(x, ground - h, x, ground, SHADE.body)
    if (rand() < 0.12)
      L.set(x, ground - h + 2 + Math.floor(rand() * (h - 3)), SHADE.masonry)
  }
}

function railing(L: Layer, from: number, to: number, ground: number, h: number) {
  for (let x = from; x < to; x += 4) {
    L.rect(x, ground - h, x, ground, SHADE.body)
    L.set(x, ground - h - 1, SHADE.trim)
    L.set(x - 1, ground - h + 1, SHADE.body)
    L.set(x + 1, ground - h + 1, SHADE.body)
  }
  for (const ry of [ground - 4, ground - h + 4]) L.rect(from, ry, to - 1, ry, SHADE.body)
}

function lowWall(L: Layer, from: number, to: number, ground: number) {
  L.rect(from, ground - 7, to - 1, ground, SHADE.body)
  L.rect(from, ground - 8, to - 1, ground - 8, SHADE.masonry)
  for (let x = from; x < to; x++) {
    if (x % 6 === 0) L.rect(x, ground - 7, x, ground - 4, SHADE.masonry)
  }
}

/* ------------------------------------------------------------------------ */
/* Near: foreground silhouettes                                               */
/* ------------------------------------------------------------------------ */

function foreground(L: Layer, W: number, H: number, rand: () => number) {
  const ground = H - Math.round(H * 0.035)
  L.rect(0, ground, L.w - 1, H - 1, SHADE.body)
  for (let x = 0; x < L.w; x++) {
    if (rand() < 0.5) {
      const h = 1 + Math.floor(rand() * rand() * 9)
      L.rect(x, ground - h, x, ground, SHADE.body)
    }
  }
  // the first tree frames the title screen; then something every screen or so
  let x = Math.round(W * 0.03)
  let k = 0
  while (x < L.w) {
    const kind = k === 0 ? 0 : Math.floor(rand() * 4)
    if (kind === 0) tree(L, x, ground, Math.min(H * 0.95, W * 0.55), rand)
    else if (kind === 1) {
      // a close-up stretch of railing
      const len = Math.round(W * 0.3)
      for (let i = 0; i < len; i += 7) {
        L.rect(x + i, ground - Math.round(H * 0.3), x + i + 1, ground, SHADE.body)
        L.spike(
          x + i + 0.5,
          ground - Math.round(H * 0.3),
          ground - Math.round(H * 0.3) - 4,
          2,
          SHADE.body,
        )
      }
      for (const f of [0.08, 0.25]) {
        L.rect(
          x,
          ground - Math.round(H * f),
          x + len,
          ground - Math.round(H * f) + 1,
          SHADE.body,
        )
      }
    } else if (kind === 2) {
      // a giant urn on a plinth, drawn at double size
      const big = new Layer(20, 20)
      stamp(big, 'urn', 9, 19)
      for (let y = 0; y < 20; y++) {
        for (let i = 0; i < 20; i++) {
          if (big.solid(i, y))
            L.rect(
              x + i * 2,
              ground - 60 + y * 2,
              x + i * 2 + 1,
              ground - 59 + y * 2,
              SHADE.body,
            )
        }
      }
      L.rect(x + 2, ground - 22, x + 36, ground, SHADE.body)
    } else {
      // a mound of hedge
      const len = Math.round(W * 0.25)
      for (let i = 0; i < len; i++) {
        const h = Math.round(
          H * 0.08 * Math.sin((Math.PI * i) / len) + 6 + 2 * Math.sin(i * 0.4),
        )
        L.rect(x + i, ground - h, x + i, ground, SHADE.body)
      }
    }
    k++
    x += Math.round(W * (0.9 + rand() * 0.8))
  }
}

function tree(L: Layer, x: number, ground: number, height: number, rand: () => number) {
  const branch = (
    bx: number,
    by: number,
    angle: number,
    len: number,
    thick: number,
    depth: number,
  ) => {
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
  L.rect(x - 6, ground - 3, x + 6, ground, SHADE.body)
  branch(x, ground, Math.PI / 2 + 0.15, height * 0.34, 6, 6)
}
