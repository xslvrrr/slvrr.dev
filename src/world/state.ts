import { createStore } from '@/lib/store'

/**
 * What the 3D walk is doing, for the React overlays (wedges, captions, the
 * reading panel). The engine updates it on changes, never per frame.
 *
 *   loading  building the world
 *   gate     standing at the closed gate (the title screen)
 *   opening  the gate swinging open
 *   walking  moving along the path
 *   idle     standing at a station, free to walk on or look around
 *   turning  turning towards / away from a point of interest
 *   reading  looking at a point of interest; its section is open
 *   failed   no WebGL: the site falls back to a plain page
 */
export type Mode =
  'loading' | 'gate' | 'opening' | 'walking' | 'idle' | 'turning' | 'reading' | 'failed'

export interface WorldState {
  mode: Mode
  /** The station you're at (or last passed). */
  station: number
  /** The point of interest under the pointer, if any. */
  hover: string | null
  /** 0–1 while the world loads. */
  progress: number
}

export const worldStore = createStore<WorldState>({
  mode: 'loading',
  station: 0,
  hover: null,
  progress: 0,
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
