import { Cell, Grid } from './grid'

/**
 * The floor plan of the churchyard. Metres, three.js style: y is up, and you
 * start outside the gate looking down -z.
 *
 * A hedge-lined walk with four junctions. At each one the trail turns and a
 * straight branch carries on to a dead end; a signpost at each junction says
 * which way is which. Off the walk: the signpost (links), the fountain
 * (music), the mausoleum yard (work), the shrine (about), the old graves
 * (notes) and the calvary at the end. One dead end hides a gap in the hedge.
 */
export type V2 = readonly [number, number]
export type V3 = readonly [number, number, number]

/** The worn trail, from the road outside the gate to the calvary. */
export const PATH: V2[] = [
  [0, 16],
  [0, -18],
  [20, -18],
  [20, -40],
  [-4, -40],
  [-4, -66],
]

export const GATE_Z = 4
/** Where you stand on the title screen, and where you start inside. */
export const GATE_VIEW: V2 = [0, 11]
export const SPAWN: V2 = [0, 1.2]

// landmarks
export const SIGN: V2 = [-1.25, -11.2]
export const MONITOR: V3 = [-1.1, 1.75, -14.2]
export const FOUNTAIN: V2 = [11, -24.5]
export const MAUSOLEUM: V2 = [33.4, -30]
export const SHRINE: V2 = [9, -47.2]
export const CALVARY: V2 = [-4, -70]

export interface Weather {
  rain: number
  fog: number
  storm: number
  wind: number
}

interface Zone {
  name: string
  /** x0, z0, x1, z1 */
  rect: [number, number, number, number]
  weather: Weather
}

/** Named places, for the caption as you arrive and the weather there. First match wins. */
export const zones: Zone[] = [
  {
    name: 'the churchyard gate',
    rect: [-3, 3, 3, 17],
    weather: { rain: 0.5, fog: 0.05, storm: 1.5, wind: 0.6 },
  },
  {
    name: 'a dead end',
    rect: [-2, -29, 2, -21],
    weather: { rain: 0.4, fog: 0.08, storm: 1, wind: 0.4 },
  },
  {
    name: 'a dead end',
    rect: [23, -20, 31, -16],
    weather: { rain: 0.4, fog: 0.08, storm: 1, wind: 0.4 },
  },
  {
    name: 'a dead end',
    rect: [18, -54, 22, -43],
    weather: { rain: 0.3, fog: 0.09, storm: 0.5, wind: 0.3 },
  },
  {
    name: 'a dead end',
    rect: [-16, -42, -7, -38],
    weather: { rain: 0.4, fog: 0.08, storm: 1, wind: 0.4 },
  },
  {
    name: 'the fountain',
    rect: [5, -30, 17, -19.5],
    weather: { rain: 0.5, fog: 0.06, storm: 3, wind: 0.55 },
  },
  {
    name: 'the mausoleum',
    rect: [22.5, -38, 39, -22],
    weather: { rain: 0.8, fog: 0.07, storm: 5, wind: 0.8 },
  },
  {
    name: 'the wayside shrine',
    rect: [4.5, -50, 13.5, -42.2],
    weather: { rain: 0.25, fog: 0.075, storm: 0.5, wind: 0.3 },
  },
  {
    name: 'the old graves',
    rect: [-22, -61, -6.2, -43],
    weather: { rain: 0.4, fog: 0.085, storm: 1, wind: 0.4 },
  },
  {
    name: 'the calvary',
    rect: [-16, -78, 8, -60.5],
    weather: { rain: 0.9, fog: 0.06, storm: 7, wind: 0.9 },
  },
  {
    name: 'the hedge walk',
    rect: [-100, -100, 100, 100],
    weather: { rain: 0.5, fog: 0.065, storm: 2, wind: 0.55 },
  },
]

export const zoneAt = (x: number, z: number) =>
  zones.find(
    (z0) => x >= z0.rect[0] && x <= z0.rect[2] && z >= z0.rect[1] && z <= z0.rect[3],
  ) ?? zones[zones.length - 1]

/** Directions at each junction: [label, world direction (dx, dz)]. */
export const signposts: { at: V2; arrows: [string, V2][] }[] = [
  {
    at: [-0.95, -16.9],
    arrows: [
      ['fountain', [1, 0]],
      ['no way through', [0, -1]],
      ['the gate', [0, 1]],
    ],
  },
  {
    at: [20.95, -16.9],
    arrows: [
      ['mausoleum', [0, -1]],
      ['no way through', [1, 0]],
      ['fountain', [-1, 0]],
    ],
  },
  {
    at: [21.0, -39.0],
    arrows: [
      ['shrine', [-1, 0]],
      ['no way through', [0, -1]],
      ['mausoleum', [0, 1]],
    ],
  },
  {
    at: [-3.0, -39.0],
    arrows: [
      ['graves', [0, -1]],
      ['calvary', [0, -1]],
      ['no way through', [-1, 0]],
      ['shrine', [1, 0]],
    ],
  },
]

/** The floor plan. Everything not opened up here is hedge. */
export function buildGrid() {
  const g = new Grid(-34, -90, 50, 22)
  const F = Cell.Floor
  const W = 1.9 // half the width of the walk

  // the road outside, the wall, and the gateway through it
  g.rect(-2.6, 4.8, 2.6, 18, F)
  g.rect(-60, GATE_Z - 0.8, 60, GATE_Z + 0.8, Cell.Wall)
  g.rect(-1.6, GATE_Z - 0.8, 1.6, GATE_Z + 0.8, F)

  // the walk, each leg running on past its junction to a dead end
  g.rect(-W, GATE_Z - 0.8, W, -28.9, F) // gate → first junction → dead end
  g.rect(-W, -18 - W, 30.9, -18 + W, F) // → second junction → dead end
  g.rect(20 - W, -18, 20 + W, -51.9, F) // → third junction → dead end
  g.rect(-15.9, -40 - W, 20 + W, -40 + W, F) // dead end ← fourth junction ←
  g.rect(-4 - W, -40, -4 + W, -61, F) // → the calvary

  // the fountain clearing
  g.circle(FOUNTAIN[0], FOUNTAIN[1], 6.6, F)
  // the mausoleum yard, through a gap in the hedge
  g.rect(23, -37, 39, -23, F)
  g.rect(21.5, -32, 23.5, -28, F)
  // the shrine alcove
  g.rect(5, -49.5, 13, -43.5, F)
  g.rect(7, -44, 11, -41.5, F)
  // the old graves
  g.rect(-21, -60, -7.5, -44, F)
  g.rect(-8, -55, -5.5, -46.5, F)
  // the calvary
  g.rect(-15, -77, 7, -60.5, F)

  // A gap at the back of the third dead end, just wide enough to squeeze
  // through, and beyond it ground that was never meant to be walked on.
  g.rect(19.6, -51.9, 20.4, -53.6, F)
  g.rect(15, -53.6, 25, -64, Cell.OutOfBounds)

  return g
}
