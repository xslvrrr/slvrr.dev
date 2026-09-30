import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useRef } from 'react'
import { Icon } from '@/components/Icon'
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
import { sfx } from '@/lib/sfx'

export function Links() {
  const mouseX = useMotionValue(Infinity)

  return (
    <section id="links" data-bg="links" className="section">
      <SectionHeading index="01" eyebrow="find me" title="Links & presence" />
      <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
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
                  className="group flex items-center justify-between rounded-xl border border-line px-4 py-3 transition-colors hover:border-line-strong hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      name={l.icon}
                      className="h-4 w-4 text-fg-muted group-hover:text-fg"
                    />
                    {l.label}
                  </span>
                  <span className="font-mono text-xs text-fg-faint transition-transform group-hover:translate-x-1 group-hover:text-fg">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <DiscordCard />
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
      className="grid shrink-0 place-items-center rounded-2xl border border-line-strong bg-gradient-to-b from-chrome-2/20 to-chrome-4/40 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-colors hover:text-white"
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
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: statusColor[p?.discord_status ?? 'offline'],
              boxShadow: `0 0 12px ${statusColor[p?.discord_status ?? 'offline']}`,
            }}
          />
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
            className="h-16 w-16 rounded-full border border-line-strong"
          />
        ) : (
          <div className="h-16 w-16 rounded-full border border-line-strong bg-gradient-to-br from-chrome-1 via-chrome-3 to-chrome-4" />
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-semibold">
            {p?.discord_user.global_name ?? p?.discord_user.username ?? profile.name}
          </p>
          <p className="truncate font-mono text-xs text-fg-muted">
            {custom ?? (p ? `@${p.discord_user.username}` : profile.handle)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-black/20 p-4">
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
        <img src={img} alt="" className="h-14 w-14 rounded-lg object-cover" />
      ) : (
        <div className="h-14 w-14 rounded-lg bg-ink-3" />
      )}
      <div className="min-w-0">
        <p className="eyebrow !text-[10px]">{label}</p>
        <p className="truncate font-semibold">{title}</p>
        {sub && <p className="truncate text-sm text-fg-muted">{sub}</p>}
      </div>
    </div>
  )
}
