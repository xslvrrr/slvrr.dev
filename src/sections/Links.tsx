import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useRef } from 'react'
import { Icon } from '@/components/Icon'
import { copy } from '@/content/copy'
import { Landmark } from '@/components/ExploreTrack'
import { SectionHeading } from '@/components/SectionHeading'
import { links } from '@/content/links'
import { profile } from '@/content/profile'
import type { SocialLink } from '@/content/types'
import {
  activityImage,
  avatarUrl,
  useLanyard,
  type DiscordStatus,
} from '@/hooks/useLanyard'
import { ScrambleText } from '@/fx/ScrambleText'
import { sfx } from '@/lib/sfx'

export function Links() {
  const mouseX = useMotionValue(Infinity)

  return (
    // A herald angel: this is where my voice carries from.
    <section id="links" data-bg="links" data-landmark="herald" className="section">
      <SectionHeading {...copy.sections.links} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[1.4fr_1fr] explore:flex explore:gap-0">
        <div className="flex min-w-0 flex-col gap-6 explore:w-[40vw]">
          {/* macOS-style magnifying dock */}
          <nav
            aria-label="Social links"
            className="panel flex h-28 items-end justify-center gap-2 overflow-x-auto px-4 pb-4 md:gap-3"
            onPointerMove={(e) => e.pointerType === 'mouse' && mouseX.set(e.clientX)}
            onPointerLeave={() => mouseX.set(Infinity)}
          >
            {links.map((l) => (
              <DockItem key={l.label} link={l} mouseX={mouseX} />
            ))}
          </nav>
          <ul className="grid gap-2 sm:grid-cols-2">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  onMouseEnter={sfx.tick}
                  className="group flex items-center justify-between border-2 border-line bg-ink/70 px-4 py-3 transition-colors hover:border-glass-1/50 hover:text-glass-3"
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      name={l.icon}
                      className="h-4 w-4 text-fg-muted group-hover:text-fg"
                    />
                    <ScrambleText text={l.label} trigger="hover" />
                  </span>
                  <span className="font-mono text-xs text-fg-faint transition-transform group-hover:translate-x-1 group-hover:text-glass-1">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <Landmark className="w-[30vw]" />
        <div className="explore:w-[26vw]">
          <DiscordCard />
        </div>
      </div>
    </section>
  )
}

function DockItem({ link, mouseX }: { link: SocialLink; mouseX: MotionValue<number> }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const distance = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect()
    return r ? x - (r.left + r.width / 2) : Infinity
  })
  const size = useSpring(useTransform(distance, [-160, 0, 160], [52, 84, 52]), {
    stiffness: 300,
    damping: 22,
    mass: 0.2,
  })
  const iconSize = useTransform(size, (s) => s * 0.42)

  return (
    <motion.a
      ref={ref}
      href={link.href}
      target="_blank"
      rel="noreferrer"
      aria-label={link.label}
      data-cursor={link.label}
      onMouseEnter={sfx.tick}
      onClick={sfx.click}
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center border-2 border-line-strong bg-gradient-to-b from-stone-4 from-50% to-ink to-50% text-fg-muted shadow-[3px_3px_0_rgb(0_0_0/0.7),inset_2px_2px_0_rgb(255_255_255/0.08)] transition-colors hover:border-glass-1/70 hover:text-glass-3"
      whileTap={{ scale: 0.9 }}
    >
      <motion.span style={{ width: iconSize, height: iconSize }} className="grid">
        <Icon name={link.icon} className="h-full w-full" />
      </motion.span>
    </motion.a>
  )
}

const statusColor: Record<DiscordStatus, string> = {
  online: '#43d17a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
}

function DiscordCard() {
  const { presence: p, state } = useLanyard(profile.discordId)
  const activity = p?.activities.find((a) => a.type !== 4 && a.type !== 2)
  const custom = p?.activities.find((a) => a.type === 4)?.state
  const img = activity ? activityImage(activity) : null

  return (
    <div className="panel flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">discord</p>
        <span className="flex items-center gap-2 font-mono text-xs text-fg-muted">
          <span className="relative grid h-2 w-2 place-items-center">
            {/* radar ping while online (transform + opacity only) */}
            {p && p.discord_status !== 'offline' && (
              <>
                <span
                  className="absolute inset-0 animate-ping opacity-60"
                  style={{ background: statusColor[p.discord_status] }}
                />
                <span
                  className="absolute inset-0 animate-ping opacity-40 [animation-delay:0.5s]"
                  style={{ background: statusColor[p.discord_status] }}
                />
              </>
            )}
            <span
              className="relative h-2 w-2"
              style={{
                background: statusColor[p?.discord_status ?? 'offline'],
                boxShadow: `0 0 12px ${statusColor[p?.discord_status ?? 'offline']}`,
              }}
            />
          </span>
          {
            {
              live: p?.discord_status,
              connecting: 'connecting…',
              unmonitored: 'offline',
              off: 'not linked',
            }[state]
          }
        </span>
      </div>

      <div className="flex items-center gap-4">
        {p ? (
          <img
            src={avatarUrl(p)}
            alt=""
            className="mono-img h-16 w-16 border-2 border-line-strong shadow-[3px_3px_0_rgb(0_0_0/0.7)]"
          />
        ) : (
          <div className="h-16 w-16 border-2 border-line-strong bg-gradient-to-br from-stone-3 from-50% to-stone-4 to-50%" />
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-3xl leading-tight">
            {p?.discord_user.global_name ?? p?.discord_user.username ?? profile.name}
          </p>
          <p className="truncate font-mono text-xs text-fg-muted">
            {custom ?? (p ? `@${p.discord_user.username}` : profile.handle)}
          </p>
        </div>
      </div>

      <div className="border-2 border-line bg-black/30 p-4">
        {p?.listening_to_spotify && p.spotify ? (
          <Activity
            img={p.spotify.album_art_url}
            label="listening to spotify"
            title={p.spotify.song}
            sub={p.spotify.artist}
          />
        ) : activity ? (
          <Activity
            img={img}
            label={
              activity.type === 3
                ? 'watching'
                : activity.type === 1
                  ? 'streaming'
                  : 'playing'
            }
            title={activity.name}
            sub={activity.details ?? activity.state}
          />
        ) : (
          <p className="font-mono text-xs text-fg-faint">
            {state === 'off'
              ? 'set discordId in src/content/profile.ts to show live presence'
              : state === 'unmonitored' && import.meta.env.DEV
                ? 'Lanyard isn’t tracking this account yet: join discord.gg/lanyard'
                : 'nothing going on right now'}
          </p>
        )}
      </div>
    </div>
  )
}

function Activity({
  img,
  label,
  title,
  sub,
}: {
  img: string | null
  label: string
  title: string
  sub?: string
}) {
  return (
    <div className="flex items-center gap-4">
      {img ? (
        <img src={img} alt="" className="mono-img h-14 w-14 object-cover" />
      ) : (
        <div className="h-14 w-14 bg-ink-3" />
      )}
      <div className="min-w-0">
        <p className="eyebrow !text-[10px]">{label}</p>
        <p className="truncate font-semibold">{title}</p>
        {sub && <p className="truncate text-sm text-fg-muted">{sub}</p>}
      </div>
    </div>
  )
}
