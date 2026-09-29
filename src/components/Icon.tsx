import {
  siDiscord,
  siGithub,
  siInstagram,
  siLastdotfm,
  siSpotify,
  siSteam,
  siTwitch,
  siX,
  siYoutube,
} from 'simple-icons'
import type { IconName } from '@/content/types'

const paths: Record<IconName, string> = {
  github: siGithub.path,
  discord: siDiscord.path,
  x: siX.path,
  instagram: siInstagram.path,
  youtube: siYoutube.path,
  twitch: siTwitch.path,
  spotify: siSpotify.path,
  lastfm: siLastdotfm.path,
  steam: siSteam.path,
  // simple line icons for the non-brand ones
  mail: 'M2 5.5A1.5 1.5 0 0 1 3.5 4h17A1.5 1.5 0 0 1 22 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5zm2.2.5 7.8 6.2L19.8 6zM20 7.9l-8 6.3-8-6.3V18h16z',
  link: 'M10.6 13.4a1 1 0 0 1 0-1.4l4-4a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0M8.5 20.5a5 5 0 0 1-3.5-8.5l2-2a1 1 0 1 1 1.4 1.4l-2 2a3 3 0 0 0 4.2 4.2l2-2a1 1 0 0 1 1.4 1.4l-2 2a5 5 0 0 1-3.5 1.5m9-7a1 1 0 0 1-.7-1.7l2-2a3 3 0 0 0-4.2-4.2l-2 2a1 1 0 1 1-1.4-1.4l2-2a5 5 0 0 1 7 7l-2 2a1 1 0 0 1-.7.3',
}

export function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d={paths[name]} />
    </svg>
  )
}
