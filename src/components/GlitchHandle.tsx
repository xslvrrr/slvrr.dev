import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { profile } from '@/content/profile'

const DISPLAY = profile.name // slvrr
const HANDLE = profile.handle.replace(/^@/, '') // sxvrce
const NOISE = '▓░▒/\\_#<>'
const WIDTH = Math.max(DISPLAY.length, HANDLE.length)

const pick = <T,>(xs: ArrayLike<T>) => xs[Math.floor(Math.random() * xs.length)]

/** One corrupted frame: each character comes from either name or the noise set. */
function scramble() {
  const len = Math.random() < 0.5 ? DISPLAY.length : HANDLE.length
  let out = ''
  for (let i = 0; i < len; i++) {
    const r = Math.random()
    out +=
      r < 0.4
        ? (DISPLAY[i] ?? pick(NOISE))
        : r < 0.8
          ? (HANDLE[i] ?? pick(NOISE))
          : pick(NOISE)
  }
  return out
}

interface Frame {
  text: string
  glitching: boolean
  x: number
}

/**
 * The nav handle: shows the display name and every few seconds glitches,
 * sometimes resolving to the @handle for a moment before flickering back.
 * Timer-driven (no animation loop), so it costs nothing between bursts.
 */
export function GlitchHandle() {
  const still = useReducedMotion() ?? false
  const [frame, setFrame] = useState<Frame>({ text: DISPLAY, glitching: false, x: 0 })
  const timers = useRef<number[]>([])
  const showingHandle = useRef(false)
  const settled = useRef(DISPLAY)
  const burstRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (still) return
    // Tracks pending timeouts (for cleanup); each one removes itself once it fires.
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.current = timers.current.filter((t) => t !== id)
        fn()
      }, ms)
      timers.current.push(id)
    }

    // ~12 corrupted frames over ~450ms, then settle on a name.
    const burst = (settle: string, onDone?: () => void) => {
      for (let i = 0; i < 12; i++) {
        later(
          () =>
            setFrame({ text: scramble(), glitching: true, x: (Math.random() - 0.5) * 4 }),
          i * 38 + Math.random() * 12,
        )
      }
      later(() => {
        settled.current = settle
        setFrame({ text: settle, glitching: false, x: 0 })
        onDone?.()
      }, 470)
    }

    const cycle = () => {
      // Every other burst reveals the handle for a moment, then flickers back.
      showingHandle.current = !showingHandle.current
      if (showingHandle.current) {
        burst(HANDLE, () => later(() => burst(DISPLAY), 1800))
      } else {
        burst(DISPLAY)
      }
      later(cycle, 4000 + Math.random() * 4000)
    }

    burstRef.current = () => burst(settled.current)
    later(cycle, 2500)
    return () => {
      timers.current.forEach(window.clearTimeout)
      timers.current = []
    }
  }, [still])

  return (
    <span
      aria-label={`${DISPLAY} (${profile.handle})`}
      onMouseEnter={() => burstRef.current()}
      className="relative inline-block"
      style={{ minWidth: `${WIDTH + 1}ch` }}
    >
      <span
        aria-hidden
        className="inline-block whitespace-pre"
        style={{
          transform: `translateX(${frame.x}px)`,
          textShadow: frame.glitching
            ? '-2px 0 rgb(159 230 255 / 0.9), 2px 0 rgb(255 60 90 / 0.8)'
            : undefined,
        }}
      >
        {frame.text === HANDLE ? `@${HANDLE}` : frame.text}
      </span>
    </span>
  )
}
