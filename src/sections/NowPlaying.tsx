import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { SectionHeading } from '@/components/SectionHeading'
import { copy } from '@/content/copy'
import { media } from '@/content/media'
import { profile } from '@/content/profile'
import type { MediaItem } from '@/content/types'
import { JewelCase } from '@/fx/JewelCase'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { usePauseOffscreen } from '@/hooks/usePauseOffscreen'
import { useVisualizer } from '@/hooks/useVisualizer'
import { coverPath } from '@/lib/covers'
import { listenAlong, playerStore, stopListening, togglePlay } from '@/lib/player'
import { sfx } from '@/lib/sfx'
import { useStore } from '@/lib/store'
import { timeAgo } from '@/lib/time'

export function NowPlaying() {
  const np = useNowPlaying()
  const player = useStore(playerStore)
  const panel = useRef<HTMLDivElement>(null)
  usePauseOffscreen(panel)

  const live = np?.playing ?? false
  const listening = player.status === 'playing'

  return (
    <section id="music" data-bg="music" className="section">
      <SectionHeading {...copy.sections.music} />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div
          ref={panel}
          className="panel flex flex-col items-center gap-8 p-8 sm:flex-row lg:flex-col xl:flex-row"
        >
          <Vinyl art={np?.art ?? null} spinning={live || listening} />
          <div className="flex min-w-0 flex-1 flex-col gap-3 self-stretch">
            <p className="eyebrow flex items-center gap-2">
              {live ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-live" /> now
                  playing
                </>
              ) : np ? (
                `last played ${timeAgo(np.playedAt)}`
              ) : (
                'now playing'
              )}
            </p>
            {np ? (
              <a
                href={np.url}
                target="_blank"
                rel="noreferrer"
                className="group"
                data-cursor="open"
              >
                <p className="font-display text-2xl font-bold leading-tight group-hover:underline md:text-3xl">
                  {np.track}
                </p>
                <p className="text-fg-muted">{np.artist}</p>
                {np.album && <p className="text-sm text-fg-faint">{np.album}</p>}
              </a>
            ) : (
              <div>
                <p className="font-display text-2xl font-bold leading-tight md:text-3xl">
                  silence, for now
                </p>
                <p className="text-sm text-fg-faint">
                  {profile.lastfmUser
                    ? 'waiting on last.fm…'
                    : 'set lastfmUser in src/content/profile.ts to go live'}
                </p>
              </div>
            )}
            <ListenAlong disabled={!np} />
            <Bars live={live} listening={listening} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3">
          {media.map((m, i) => (
            <motion.div
              key={m.title + i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <Cover item={m} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Start / control the listen-along player from the panel. */
function ListenAlong({ disabled }: { disabled: boolean }) {
  const { status } = useStore(playerStore)
  const base =
    'inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors'

  if (status === 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            sfx.click()
            void listenAlong()
          }}
          data-cursor="listen"
          className={`${base} border-line-strong hover:border-iri-1 hover:text-iri-1 disabled:opacity-40`}
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
            <path d="M7 4.5v15l13-7.5z" />
          </svg>
          listen along
        </button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-faint">
          30s previews · follows my songs
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={togglePlay}
        className={`${base} border-iri-1/60 text-iri-1`}
      >
        {status === 'loading'
          ? 'tuning in…'
          : status === 'playing'
            ? 'pause'
            : status === 'error'
              ? 'retry'
              : 'resume'}
      </button>
      <button
        type="button"
        onClick={stopListening}
        className={`${base} border-line text-fg-faint hover:text-fg`}
      >
        stop
      </button>
    </div>
  )
}

function Vinyl({ art, spinning }: { art: string | null; spinning: boolean }) {
  return (
    <div className="relative aspect-square w-48 shrink-0 md:w-56">
      {/* CSS spin (transform only) that pauses in place instead of snapping back */}
      <div
        className="absolute inset-0 animate-[spin_3.2s_linear_infinite] rounded-full shadow-[0_20px_60px_-10px_rgb(0_0_0/0.9)]"
        style={{
          animationPlayState: spinning ? 'running' : 'paused',
          background:
            'repeating-radial-gradient(circle, #111 0 2px, #1b1b20 2px 3px), radial-gradient(circle, #222, #050505)',
        }}
      >
        {/* sheen */}
        <div
          className="absolute inset-0 rounded-full opacity-40"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0 10%, rgb(255 255 255 / 0.25) 15%, transparent 22% 60%, rgb(191 238 255 / 0.25) 65%, transparent 72%)',
          }}
        />
        <div className="absolute inset-[30%] overflow-hidden rounded-full border-4 border-ink">
          {art ? (
            <img src={art} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: 'var(--iri-gradient)' }}
            />
          )}
        </div>
        <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
      </div>
    </div>
  )
}

/**
 * Equalizer. Driven by the real audio while the visitor is listening along,
 * a CSS animation while slvrr is live, flat otherwise. Transform-only.
 */
function Bars({ live, listening }: { live: boolean; listening: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useVisualizer(ref, listening)
  const idle = live && !listening

  return (
    <div ref={ref} className="mt-auto flex h-8 items-end gap-1" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          data-bar
          className={`h-full w-1.5 origin-bottom rounded-full bg-gradient-to-t from-chrome-3 to-chrome-1 transition-transform duration-500 ${idle ? 'eq-bar' : ''}`}
          style={{
            transform: idle || listening ? undefined : 'scaleY(0.12)',
            animationDuration: `${0.9 + (i % 5) * 0.17}s`,
            animationDelay: `${-((i * 37) % 100) / 100}s`,
          }}
        />
      ))}
    </div>
  )
}

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997
  return h
}

function Cover({ item }: { item: MediaItem }) {
  const [broken, setBroken] = useState(false)
  // Fallback tile in the site's cold palette (only if the cover file is missing).
  const light = 40 + (hash(item.title + item.by) % 30)

  const art = item.swatch ? (
    <div className="h-full w-full" style={{ background: item.swatch }} />
  ) : broken ? (
    <div
      className="h-full w-full"
      style={{
        background: `radial-gradient(circle at 30% 25%, hsl(200 60% ${light + 30}% / 0.5), transparent 55%), linear-gradient(135deg, hsl(210 20% ${light / 2}%), hsl(220 25% 6%))`,
      }}
    />
  ) : (
    <img
      src={coverPath(item)}
      alt=""
      width={640}
      height={640}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover"
    />
  )

  const body = (
    <>
      <JewelCase>{art}</JewelCase>
      <div className="mt-4 min-w-0">
        <p className="eyebrow !text-[9px]">{item.kind}</p>
        <p className="truncate text-sm font-semibold">{item.title}</p>
        <p className="truncate text-xs text-fg-muted">{item.by}</p>
      </div>
    </>
  )

  return item.href ? (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="block"
      data-cursor={item.href.includes('spotify') ? 'play' : 'open'}
      aria-label={`${item.title} by ${item.by}`}
      onMouseEnter={sfx.tick}
    >
      {body}
    </a>
  ) : (
    <div>{body}</div>
  )
}
