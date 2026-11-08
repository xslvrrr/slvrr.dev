import { Icon } from '@/components/Icon'
import { links } from '@/content/links'
import { media } from '@/content/media'
import { notes } from '@/content/notes'
import { profile } from '@/content/profile'
import { projects } from '@/content/projects'
import { useRepoStats } from '@/hooks/useRepoStats'
import { nowPlayingStore } from '@/lib/nowPlaying'
import { useStore } from '@/lib/store'
import { timeAgo } from '@/lib/time'
import { presenceStore, stickies } from './interact'
import type { Aim } from './state'

const STATUS: Record<string, string> = {
  online: '#43d17a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
}

/** A short, readable description of whatever you're aiming at. */
export function Card({ aim }: { aim: Aim }) {
  switch (aim.kind) {
    case 'link': {
      const l = links[aim.index]
      return (
        <Row>
          <Icon name={l.icon} className="h-5 w-5 text-fg" />
          <span className="font-display text-3xl leading-none">{l.label}</span>
          <span className="font-mono text-lg text-fg-muted">
            {new URL(l.href).hostname.replace(/^www\./, '')}
          </span>
        </Row>
      )
    }
    case 'discord':
      return <DiscordCard />
    case 'album': {
      const m = media[aim.index]
      return (
        <div>
          <p className="eyebrow">{m.kind}</p>
          <p className="font-display text-3xl leading-none">{m.title}</p>
          <p className="text-fg-muted">{m.by}</p>
        </div>
      )
    }
    case 'nowplaying':
      return <MusicCard />
    case 'walkman':
      return (
        <p className="text-fg-muted">
          a walkman, headphones wrapped round it. the tape is still turning.
        </p>
      )
    case 'fountain':
      return <p className="text-fg-muted">the water's full of coins.</p>
    case 'project':
      return <ProjectCard i={aim.index} />
    case 'sticky': {
      const s = stickies[aim.index]
      return (
        <div>
          <p className="eyebrow">
            note {aim.index + 1} of {stickies.length}
          </p>
          <p className="line-clamp-1 text-fg-muted">{s.title ?? s.body}</p>
        </div>
      )
    }
    case 'note': {
      const n = notes[aim.index]
      return (
        <div>
          <p className="font-mono text-lg text-fg-muted">{n.date}</p>
          <p className="font-display text-3xl leading-none">{n.title}</p>
          <p className="text-fg-muted">{n.summary}</p>
        </div>
      )
    }
  }
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-baseline gap-3">{children}</div>
}

function DiscordCard() {
  const { p, state } = useStore(presenceStore)
  const act = p?.activities.find((a) => a.type !== 4 && a.type !== 2)
  const custom = p?.activities.find((a) => a.type === 4)?.state
  const status = p?.discord_status ?? 'offline'
  return (
    <div>
      <p className="eyebrow flex items-center gap-2">
        discord
        <span className="inline-block h-2 w-2" style={{ background: STATUS[status] }} />
        {state === 'live' ? status : state === 'connecting' ? 'connecting…' : 'offline'}
      </p>
      <p className="font-display text-3xl leading-none">
        {p?.discord_user.global_name ?? p?.discord_user.username ?? profile.name}
      </p>
      <p className="text-fg-muted">
        {p?.listening_to_spotify && p.spotify
          ? `listening to ${p.spotify.song} — ${p.spotify.artist}`
          : act
            ? `${act.type === 3 ? 'watching' : 'playing'} ${act.name}`
            : (custom ??
              `@${p?.discord_user.username ?? profile.handle.replace(/^@/, '')}`)}
      </p>
    </div>
  )
}

function MusicCard() {
  const np = useStore(nowPlayingStore)
  return (
    <div>
      <p className="eyebrow">
        {np?.playing
          ? 'now playing'
          : np?.playedAt
            ? `last played ${timeAgo(np.playedAt)}`
            : 'now playing'}
      </p>
      <p className="font-display text-3xl leading-none">
        {np?.track ?? 'silence, for now'}
      </p>
      <p className="text-fg-muted">
        {np ? `${np.artist}${np.album ? ` · ${np.album}` : ''}` : 'waiting on last.fm…'}
      </p>
    </div>
  )
}

function ProjectCard({ i }: { i: number }) {
  const p = projects[i]
  const stats = useRepoStats()
  const live = p.repo ? stats?.[p.repo] : undefined
  return (
    <div className="flex flex-col gap-1">
      <p className="eyebrow flex gap-3">
        <span>{p.year}</span>
        {live && <span>★ {live.stars}</span>}
        {live?.language && <span>{live.language}</span>}
      </p>
      <p className="font-display text-4xl leading-none">{p.name}</p>
      <p className="text-fg-muted">{p.blurb}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {p.tags.map((t) => (
          <li
            key={t}
            className="border border-line-strong px-1.5 font-mono text-base uppercase text-fg-muted"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}
