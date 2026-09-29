/** Shape returned by /api/lastfm. */
export interface NowPlaying {
  playing: boolean
  track: string
  artist: string
  album: string
  art: string | null
  url: string
  /** Unix seconds; null while playing. */
  playedAt: number | null
}

/** Shape returned by /api/github, keyed by "owner/repo". */
export interface RepoStats {
  stars: number
  forks: number
  language: string | null
  description: string | null
  url: string
  pushedAt: string
}
