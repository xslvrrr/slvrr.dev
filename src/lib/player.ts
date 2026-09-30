import { nowPlayingStore, retainNowPlaying, trackKey } from './nowPlaying'
import { createStore } from './store'
import type { NowPlaying } from './types'

/**
 * "Listen along": plays a 30-second preview of whatever slvrr is playing on
 * Last.fm, and follows along when the song changes. One shared audio element,
 * so the miniplayer keeps playing across scrolling and page changes.
 */

export interface PlayerTrack {
  key: string
  title: string
  artist: string
  cover: string | null
  link: string
  audio: string
}

export interface PlayerState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error'
  track: PlayerTrack | null
  /** Short-lived message, e.g. when following to a new song. */
  flash: string | null
}

export const playerStore = createStore<PlayerState>({
  status: 'idle',
  track: null,
  flash: null,
})

const patch = (p: Partial<PlayerState>) => playerStore.set({ ...playerStore.get(), ...p })

let el: HTMLAudioElement | null = null
let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let release: (() => void) | null = null
let unfollow: (() => void) | null = null
let flashTimer: number | undefined
let loadId = 0

function audio() {
  if (el) return el
  el = new Audio()
  el.loop = true // previews loop until the next song
  el.preload = 'auto'
  el.crossOrigin = 'anonymous'
  el.addEventListener('playing', () => patch({ status: 'playing' }))
  el.addEventListener('pause', () => {
    if (playerStore.get().status === 'playing') patch({ status: 'paused' })
  })
  el.addEventListener('error', () => {
    if (playerStore.get().status !== 'idle') patch({ status: 'error' })
  })
  return el
}

/** Web Audio analyser for the visualizers (created on first play, from a click). */
export function getAnalyser() {
  if (analyser || !el) return analyser
  try {
    ctx = new AudioContext()
    const source = ctx.createMediaElementSource(el)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.75
    source.connect(analyser).connect(ctx.destination)
  } catch {
    analyser = null
  }
  return analyser
}

function flash(message: string) {
  window.clearTimeout(flashTimer)
  patch({ flash: message })
  flashTimer = window.setTimeout(() => patch({ flash: null }), 2600)
}

async function load(np: NowPlaying) {
  const id = ++loadId
  const key = trackKey(np)
  patch({ status: 'loading' })
  try {
    const params = new URLSearchParams({ artist: np.artist, track: np.track })
    const res = await fetch(`/api/preview?${params}`)
    if (id !== loadId) return
    if (!res.ok) throw new Error('no preview')
    const found = (await res.json()) as Omit<PlayerTrack, 'key'>
    if (id !== loadId) return
    const a = audio()
    a.src = found.audio
    patch({ track: { ...found, key, cover: found.cover ?? np.art } })
    getAnalyser()
    await ctx?.resume()
    await a.play()
  } catch {
    if (id !== loadId) return
    patch({
      status: 'error',
      track: {
        key,
        title: np.track,
        artist: np.artist,
        cover: np.art,
        link: np.url,
        audio: '',
      },
    })
    flash('no preview for this one')
  }
}

/** Start listening along to the current song (call from a click). */
export async function listenAlong() {
  release ??= retainNowPlaying()
  unfollow ??= nowPlayingStore.subscribe(() => {
    const np = nowPlayingStore.get()
    const { status, track } = playerStore.get()
    if (!np || status === 'idle' || status === 'paused') return
    if (track && trackKey(np) === track.key) return
    flash(`↻ now: ${np.track}`)
    void load(np)
  })
  const np = nowPlayingStore.get()
  if (np) await load(np)
}

export function togglePlay() {
  const a = audio()
  if (playerStore.get().status === 'error') {
    const np = nowPlayingStore.get()
    if (np) void load(np)
    return
  }
  if (a.paused) {
    void ctx?.resume()
    void a.play()
  } else {
    a.pause()
  }
}

/** Stop and hide the miniplayer. */
export function stopListening() {
  loadId++
  if (el) {
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
  unfollow?.()
  unfollow = null
  release?.()
  release = null
  window.clearTimeout(flashTimer)
  playerStore.set({ status: 'idle', track: null, flash: null })
}

/** Current playback position as a 0–1 fraction (for progress bars). */
export function progress() {
  if (!el || !el.duration || !Number.isFinite(el.duration)) return 0
  return el.currentTime / el.duration
}

/** Subscribe to position updates from the audio element (~4×/s, no rAF). */
export function onTimeUpdate(cb: () => void) {
  const a = audio()
  a.addEventListener('timeupdate', cb)
  return () => a.removeEventListener('timeupdate', cb)
}
