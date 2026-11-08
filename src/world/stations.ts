/**
 * The layout of the churchyard: the path you walk and the places along it.
 *
 * Coordinates are metres, three.js style: y is up, and you start outside the
 * gate looking down -z. The path is a polyline (corners get rounded when it's
 * built); each station is a stop on it. Most stations have a point of
 * interest beside the path that you can click to turn and look at, and that
 * is where a section of the site lives.
 */
export type SectionId = 'hero' | 'links' | 'music' | 'work' | 'about' | 'notes' | 'footer'

export type V2 = readonly [number, number]
export type V3 = readonly [number, number, number]

export interface Weather {
  /** Rain density, 0–1. */
  rain: number
  /** Fog density (FogExp2). */
  fog: number
  /** Average lightning strikes per minute. */
  storm: number
  /** How loud the wind is, 0–1. */
  wind: number
}

export interface Station {
  id: string
  /** Shown as the place name when you arrive. */
  place: string
  /** Where you stand, on the path. */
  at: V2
  /** The section shown when you look at this station's point of interest. */
  section?: SectionId
  /** What you're looking at: the label on hover, e.g. "the signpost". */
  poi?: {
    label: string
    /** The point the camera looks at. */
    look: V3
    /** Where the camera steps to while looking (defaults to `at`). */
    from?: V2
    /** Half-size of the clickable box around `look`. */
    hit: V3
  }
  weather: Weather
}

/** The path, from outside the gate to the foot of the calvary. */
export const PATH: V2[] = [
  [0, 11],
  [0, -18], // first turn: right
  [20, -18], // left
  [20, -40], // left
  [-4, -40], // right
  [-4, -64],
]

/** Where the churchyard wall and its gate stand (z). */
export const GATE_Z = 4

export const stations: Station[] = [
  {
    id: 'gate',
    place: 'the churchyard gate',
    at: [0, 11],
    section: 'hero',
    weather: { rain: 0.5, fog: 0.05, storm: 1.5, wind: 0.6 },
  },
  {
    id: 'entry',
    place: 'the hedge walk',
    at: [0, 0.5],
    weather: { rain: 0.45, fog: 0.06, storm: 1, wind: 0.5 },
  },
  {
    id: 'sign',
    place: 'the signpost',
    at: [0, -9.5],
    section: 'links',
    poi: {
      label: 'read the signpost',
      look: [-1.25, 1.65, -11.2],
      from: [0.75, -8.6],
      hit: [0.9, 1.2, 0.9],
    },
    weather: { rain: 0.55, fog: 0.065, storm: 2, wind: 0.6 },
  },
  {
    id: 'fountain',
    place: 'the fountain',
    at: [11, -18],
    section: 'music',
    poi: {
      label: 'look at the fountain',
      look: [11, 1.3, -24.5],
      from: [11, -18.3],
      hit: [3.2, 1.8, 3.2],
    },
    weather: { rain: 0.5, fog: 0.06, storm: 3, wind: 0.55 },
  },
  {
    id: 'mausoleum',
    place: 'the mausoleum',
    at: [20, -30],
    section: 'work',
    poi: {
      label: 'enter the mausoleum',
      look: [27.5, 2.1, -30],
      from: [21.2, -30],
      hit: [3.6, 3, 3.6],
    },
    weather: { rain: 0.8, fog: 0.07, storm: 5, wind: 0.8 },
  },
  {
    id: 'shrine',
    place: 'the wayside shrine',
    at: [9, -40],
    section: 'about',
    poi: {
      label: 'kneel at the shrine',
      look: [9, 1.5, -45.2],
      from: [9, -41.4],
      hit: [1.6, 2, 1.4],
    },
    weather: { rain: 0.25, fog: 0.075, storm: 0.5, wind: 0.3 },
  },
  {
    id: 'graves',
    place: 'the old graves',
    at: [-4, -52],
    section: 'notes',
    poi: {
      label: 'read the epitaphs',
      look: [-10.5, 1.0, -52],
      from: [-5.4, -52],
      hit: [3.5, 1.6, 4],
    },
    weather: { rain: 0.4, fog: 0.085, storm: 1, wind: 0.4 },
  },
  {
    id: 'calvary',
    place: 'the calvary',
    at: [-4, -62.5],
    section: 'footer',
    poi: {
      label: 'look up at the cross',
      look: [-4, 3.2, -70],
      from: [-4, -64],
      hit: [2.2, 4, 1.5],
    },
    weather: { rain: 0.9, fog: 0.06, storm: 7, wind: 0.9 },
  },
]

export const stationIndex = (id: string) => stations.findIndex((s) => s.id === id)
export const stationForSection = (section: string) =>
  stations.findIndex((s) => s.section === section)
