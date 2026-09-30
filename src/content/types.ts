export type IconName =
  | 'github'
  | 'discord'
  | 'roblox'
  | 'instagram'
  | 'youtube'
  | 'twitch'
  | 'spotify'
  | 'lastfm'
  | 'steam'
  | 'mail'
  | 'link'

export interface Profile {
  /** Big display name in the hero. */
  name: string
  /** Handle shown in small type, e.g. "@slvrr". */
  handle: string
  tagline: string
  /** Short paragraphs for the About section. */
  bio: string[]
  location?: string
  /** Rotating words in the hero ("I build ___"). */
  roles: string[]
  /** Discord user ID for Lanyard presence. Leave empty to hide the card. */
  discordId: string
  /** Last.fm username for Now Playing. Leave empty to hide live data. */
  lastfmUser: string
  /** GitHub username used for live repo stats. */
  githubUser: string
}

export interface SocialLink {
  label: string
  href: string
  icon: IconName
}

export interface Project {
  name: string
  /** "owner/repo". When set, live stars/language are fetched from GitHub. */
  repo?: string
  href?: string
  blurb: string
  tags: string[]
  /** Year or range, e.g. "2025" or "2023 — now". */
  year: string
}

export interface TimelineEntry {
  when: string
  title: string
  body: string
}

export interface MediaItem {
  kind: 'album' | 'game' | 'show' | 'book'
  title: string
  by: string
  /** Where clicking the cover goes (Spotify album, store page, video…). */
  href?: string
  /**
   * Remote artwork for `npm run covers` to download when it can't be found from
   * `href` (Spotify and YouTube links are resolved automatically).
   */
  art?: string
}
