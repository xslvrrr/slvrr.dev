import { createStore } from '@/lib/store'
import type { Kind } from './build'

/**
 * What the churchyard is doing, for the React overlays. The engine updates it
 * on changes, never per frame.
 *
 *   loading  building the world
 *   gate     standing at the closed gate (the title screen)
 *   opening  the gate swinging open as you walk in
 *   play     free to walk around
 *   paused   reading something up close (a note, a sticky note)
 *   lost     out of bounds: the screen has gone black
 *   failed   no WebGL: the site falls back to a plain page
 */
export type Mode = 'loading' | 'gate' | 'opening' | 'play' | 'paused' | 'lost' | 'failed'

export interface Aim {
  kind: Kind
  index: number
}

export interface WorldState {
  mode: Mode
  /** 0–1 while the world loads. */
  progress: number
  /** What the crosshair (or cursor) is on, if it's in reach. */
  aim: Aim | null
  /** Whether the mouse is captured for looking around. */
  locked: boolean
  /** The place you're in, e.g. "the fountain". */
  place: string
  /** A subtitle: something you think to yourself. */
  line: { text: string; id: number } | null
  /** Whether you've picked up the walkman. */
  carrying: boolean
  /** The sticky note being read up close. */
  sticky: number | null
}

export const worldStore = createStore<WorldState>({
  mode: 'loading',
  progress: 0,
  aim: null,
  locked: false,
  place: '',
  line: null,
  carrying: false,
  sticky: null,
})

export function patchWorld(patch: Partial<WorldState>) {
  const cur = worldStore.get()
  let changed = false
  for (const k in patch) {
    const key = k as keyof WorldState
    if (cur[key] !== patch[key]) changed = true
  }
  if (changed) worldStore.set({ ...cur, ...patch })
}

let lineId = 0
/** Shows a line as a subtitle. */
export function say(text: string) {
  patchWorld({ line: { text, id: ++lineId } })
}

export const sameAim = (a: Aim | null, b: Aim | null) =>
  a === b || (!!a && !!b && a.kind === b.kind && a.index === b.index)
