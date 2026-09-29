import { profile } from '@/content/profile'
import type { NowPlaying } from '@/lib/types'
import { usePoll } from '@/lib/usePoll'

export function useNowPlaying() {
  const user = profile.lastfmUser
  return usePoll<NowPlaying>(
    user ? `/api/lastfm?user=${encodeURIComponent(user)}` : null,
    15_000,
  )
}
