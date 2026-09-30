import { useEffect } from 'react'
import { profile } from '@/content/profile'
import { createStore, useStore } from './store'
import type { NowPlaying } from './types'

/**
 * One shared Last.fm feed for the whole page (the Now Playing section and the
 * listen-along player both read it). Polls only while something is using it and
 * the tab is visible, and backs off when the API is failing.
 */
export const nowPlayingStore = createStore<NowPlaying | null>(null)

const FAST = 15_000
const SLOW = 60_000

let users = 0
let timer: number | undefined
let delay = FAST
let inFlight = false

/** Identifies a song (for detecting track changes). */
export const trackKey = (np: Pick<NowPlaying, 'artist' | 'track'>) =>
  `${np.artist}—${np.track}`.toLowerCase()

async function tick() {
  timer = undefined
  if (!profile.lastfmUser || users === 0 || inFlight) return
  inFlight = true
  if (!document.hidden) {
    try {
      const res = await fetch(
        `/api/lastfm?user=${encodeURIComponent(profile.lastfmUser)}`,
      )
      if (res.ok) {
        const next = (await res.json()) as NowPlaying
        const prev = nowPlayingStore.get()
        // Only notify subscribers when something visible actually changed.
        if (
          !prev ||
          trackKey(prev) !== trackKey(next) ||
          prev.playing !== next.playing ||
          prev.playedAt !== next.playedAt
        ) {
          nowPlayingStore.set(next)
        }
        delay = FAST
      } else {
        delay = SLOW
      }
    } catch {
      delay = SLOW
    }
  }
  inFlight = false
  if (users > 0) timer = window.setTimeout(tick, delay)
}

/** Refresh straight away when the visitor comes back to the tab. */
function onVisible() {
  if (document.hidden || users === 0 || inFlight) return
  window.clearTimeout(timer)
  void tick()
}

/** Start polling (reference counted). Returns a function that stops it. */
export function retainNowPlaying() {
  users++
  if (users === 1) {
    document.addEventListener('visibilitychange', onVisible)
    void tick()
  }
  return () => {
    users--
    if (users === 0) {
      window.clearTimeout(timer)
      timer = undefined
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

export function useNowPlaying() {
  useEffect(() => retainNowPlaying(), [])
  return useStore(nowPlayingStore)
}
