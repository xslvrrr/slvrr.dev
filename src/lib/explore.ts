import { useSyncExternalStore } from 'react'

/**
 * On wide screens the home page is a side-scroller: scrolling walks you
 * sideways through the garden, one landmark per section (see ExploreTrack).
 * This query decides when; narrower or shorter screens keep a vertical page.
 * Keep it in sync with the `explore:` variant in src/styles/index.css.
 */
export const EXPLORE_QUERY = '(min-width: 1024px) and (min-height: 600px)'

/** Shared state of the horizontal walk, kept up to date by ExploreTrack. */
export const explore = {
  /** The horizontally moving strip of sections, while exploring. */
  track: null as HTMLElement | null,
  /** Document scroll position where the walk starts. */
  outerTop: 0,
  /** How far the strip can move, in CSS pixels. */
  maxX: 0,
}

/** How far along the walk the camera is, in CSS pixels. */
export function cameraX() {
  if (!explore.track) return 0
  return Math.min(explore.maxX, Math.max(0, window.scrollY - explore.outerTop))
}

/** The document scroll position that brings `el` into view, in either layout. */
export function scrollTargetFor(el: HTMLElement) {
  const track = explore.track
  if (track?.contains(el)) {
    const left = el.getBoundingClientRect().left - track.getBoundingClientRect().left
    return explore.outerTop + Math.min(explore.maxX, Math.max(0, left))
  }
  return el.getBoundingClientRect().top + window.scrollY
}

const media = typeof window === 'undefined' ? null : window.matchMedia(EXPLORE_QUERY)

/** Whether the page is currently laid out as a side-scroller. */
export function useExplore() {
  return useSyncExternalStore(
    (cb) => {
      media?.addEventListener('change', cb)
      return () => media?.removeEventListener('change', cb)
    },
    () => media?.matches ?? false,
    () => false,
  )
}
