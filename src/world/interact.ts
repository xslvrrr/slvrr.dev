import { links } from '@/content/links'
import { media } from '@/content/media'
import { profile } from '@/content/profile'
import { projects } from '@/content/projects'
import { timeline } from '@/content/timeline'
import type { LanyardPresence, LanyardState } from '@/hooks/useLanyard'
import { playerStore } from '@/lib/player'
import { createStore, useStore } from '@/lib/store'
import type { Aim } from './state'

/** Live Discord presence, shared by the monitor's texture and its card. */
export const presenceStore = createStore<{
  p: LanyardPresence | null
  state: LanyardState
}>({
  p: null,
  state: 'connecting',
})

/** Everything stuck on the shrine's fence, in order: the bio, then the timeline. */
export const stickies: { title?: string; when?: string; body: string }[] = [
  ...profile.bio.map((body) => ({ body })),
  ...timeline.map((t) => ({ when: t.when, title: t.title, body: t.body })),
]

/** What pressing E does, in a few words. */
export function verb(aim: Aim): string {
  switch (aim.kind) {
    case 'link':
      return `visit ${links[aim.index].label.toLowerCase()}`
    case 'discord':
      return 'open discord'
    case 'album':
      return media[aim.index].href?.includes('youtube') ? 'watch' : 'listen'
    case 'nowplaying':
      return 'open on last.fm'
    case 'walkman':
      return 'pick up'
    case 'fountain':
      return 'throw a coin'
    case 'project':
      return 'visit'
    case 'sticky':
      return 'read'
    case 'note':
      return 'pick up the note'
  }
}

/** Where a project's monument sends you. */
export function projectHref(i: number, stats?: Record<string, { url: string }> | null) {
  const p = projects[i]
  return (
    p.href ??
    (p.repo ? (stats?.[p.repo]?.url ?? `https://github.com/${p.repo}`) : undefined)
  )
}

/** The walkman's state in words, for its on-screen button. */
export function useWalkmanLabel() {
  const { status, track } = useStore(playerStore)
  if (status === 'idle') return 'play'
  if (status === 'loading') return 'tuning in…'
  if (status === 'error') return 'no signal'
  return `${status === 'playing' ? 'pause' : 'play'}${track ? ` · ${track.title}` : ''}`
}
