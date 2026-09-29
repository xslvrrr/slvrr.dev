import { motion } from 'motion/react'
import { SectionHeading } from '@/components/SectionHeading'
import { media } from '@/content/media'
import { profile } from '@/content/profile'
import type { MediaItem } from '@/content/types'
import { TiltCard } from '@/fx/TiltCard'
import { useNowPlaying } from '@/hooks/useNowPlaying'

export function NowPlaying() {
  const np = useNowPlaying()
  const playing = np?.playing ?? false

  return (
    <section id="music" className="section">
      <SectionHeading index="02" eyebrow="on rotation" title="What I'm into" />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="panel flex flex-col items-center gap-8 p-8 sm:flex-row lg:flex-col xl:flex-row">
          <Vinyl art={np?.art ?? null} spinning={playing} />
          <div className="flex min-w-0 flex-1 flex-col gap-3 self-stretch">
            <p className="eyebrow flex items-center gap-2">
              {playing ? (
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
                data-cursor="play"
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
            <Bars active={playing} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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

function Vinyl({ art, spinning }: { art: string | null; spinning: boolean }) {
  return (
    <div className="relative aspect-square w-48 shrink-0 md:w-56">
      <motion.div
        className="absolute inset-0 rounded-full shadow-[0_20px_60px_-10px_rgb(0_0_0/0.9)]"
        style={{
          background:
            'repeating-radial-gradient(circle, #111 0 2px, #1b1b20 2px 3px), radial-gradient(circle, #222, #050505)',
        }}
        animate={{ rotate: spinning ? 360 : 0 }}
        transition={
          spinning
            ? { duration: 3.2, repeat: Infinity, ease: 'linear' }
            : { duration: 1.2 }
        }
      >
        {/* sheen */}
        <div
          className="absolute inset-0 rounded-full opacity-40"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0 10%, rgb(255 255 255 / 0.25) 15%, transparent 22% 60%, rgb(199 164 255 / 0.25) 65%, transparent 72%)',
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
      </motion.div>
    </div>
  )
}

function Bars({ active }: { active: boolean }) {
  return (
    <div className="mt-auto flex h-8 items-end gap-1" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-chrome-3 to-chrome-1"
          animate={
            active
              ? {
                  height: [
                    '20%',
                    `${30 + ((i * 37) % 70)}%`,
                    '15%',
                    `${50 + ((i * 53) % 50)}%`,
                  ],
                }
              : { height: '12%' }
          }
          transition={
            active
              ? { duration: 1 + (i % 5) * 0.15, repeat: Infinity, repeatType: 'mirror' }
              : { duration: 0.6 }
          }
        />
      ))}
    </div>
  )
}

function hue(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

function Cover({ item }: { item: MediaItem }) {
  const h = hue(item.title + item.by)
  const body = (
    <TiltCard className="aspect-square !rounded-2xl" max={14}>
      <div className="relative aspect-square">
        {item.cover ? (
          <img
            src={item.cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 30% 25%, hsl(${h} 90% 85% / 0.9), transparent 55%), linear-gradient(135deg, hsl(${h} 30% 30%), hsl(${(h + 60) % 360} 40% 12%))`,
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
          <p className="eyebrow !text-[9px] !text-white/60">{item.kind}</p>
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="truncate text-xs text-white/60">{item.by}</p>
        </div>
      </div>
    </TiltCard>
  )
  return item.href ? (
    <a href={item.href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    body
  )
}

function timeAgo(uts: number | null) {
  if (!uts) return 'a while ago'
  const s = Math.max(0, Date.now() / 1000 - uts)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
