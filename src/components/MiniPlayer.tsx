import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { profile } from '@/content/profile'
import { useVisualizer } from '@/hooks/useVisualizer'
import { nowPlayingStore } from '@/lib/nowPlaying'
import {
  onTimeUpdate,
  playerStore,
  progress,
  stopListening,
  togglePlay,
} from '@/lib/player'
import { useStore } from '@/lib/store'
import { timeAgo } from '@/lib/time'

/**
 * Bottom-centre listen-along pill. Appears once a visitor hits "listen along"
 * and stays across scrolling and page changes until closed.
 */
export function MiniPlayer() {
  const { status, track, flash } = useStore(playerStore)
  const np = useStore(nowPlayingStore)
  const bar = useRef<HTMLSpanElement>(null)
  const bars = useRef<HTMLSpanElement>(null)
  const open = status !== 'idle' && track !== null
  const playing = status === 'playing'

  useVisualizer(bars, open && playing)

  // Progress is written straight to the DOM on `timeupdate` (~4×/s); a CSS
  // transition smooths it, so there's no per-frame work.
  useEffect(() => {
    if (!open) return
    return onTimeUpdate(() => {
      if (bar.current) bar.current.style.transform = `scaleX(${progress()})`
    })
  }, [open])

  const live = np?.playing ?? false

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mini"
          role="region"
          aria-label="Listen along player"
          className="panel fixed bottom-4 left-1/2 z-[65] flex !bg-ink-2/95 w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-3 overflow-hidden !rounded-2xl p-2 pr-3"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          <a
            href={track.link || undefined}
            target="_blank"
            rel="noreferrer"
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ink-3"
            data-cursor="open"
          >
            {track.cover && (
              <img src={track.cover} alt="" className="h-full w-full object-cover" />
            )}
          </a>

          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={flash ?? track.key}
                className="truncate text-sm font-semibold"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {flash ?? track.title}
              </motion.p>
            </AnimatePresence>
            <p className="truncate text-xs text-fg-muted">{track.artist}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-widest text-fg-faint">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? 'bg-live animate-pulse' : 'bg-fg-faint'}`}
              />
              {live
                ? `listening with ${profile.name} · live`
                : `${profile.name} went quiet · ${timeAgo(np?.playedAt ?? null)}`}
            </p>
          </div>

          <span ref={bars} aria-hidden className="flex h-6 items-end gap-[3px]">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                data-bar
                className="h-full w-[3px] origin-bottom scale-y-[0.08] rounded-full bg-iri-1"
              />
            ))}
          </span>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            data-cursor={playing ? 'pause' : 'play'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fg text-ink transition-transform hover:scale-105"
          >
            {status === 'loading' ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
            ) : playing ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M7 4.5v15l13-7.5z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={stopListening}
            aria-label="Stop listening"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-faint hover:text-fg"
          >
            ✕
          </button>

          <span
            ref={bar}
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-iri-1 transition-transform duration-300 ease-linear"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
