import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Landmark } from '@/components/ExploreTrack'
import { PixelCross } from '@/components/PixelCross'
import { profile } from '@/content/profile'
import { useFinePointer } from '@/hooks/useFinePointer'
import { useExplore } from '@/lib/explore'
import { strike } from '@/lib/storm'
import { enteredStore, useStore } from '@/lib/store'

/**
 * A title screen at the churchyard gate: the cathedral (drawn by the page
 * background, NightScene) stands beyond it. Clicking anywhere calls down the
 * lightning. While exploring, the name sits to the left and the gate right.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const fine = useFinePointer()
  const entered = useStore(enteredStore)
  const exploring = useExplore()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const mouseX = useMotionValue(-9999)

  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '-40%'])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <section
      ref={ref}
      data-bg="hero"
      data-landmark="gate"
      className="relative h-svh min-h-[560px] overflow-hidden explore:w-screen explore:shrink-0"
      onPointerMove={(e) => mouseX.set(e.clientX)}
      onPointerLeave={() => mouseX.set(-9999)}
      onClick={(e) => strike(e.clientX / window.innerWidth, true)}
    >
      <Landmark className="absolute inset-y-0 right-[6vw] w-[36vw]" />
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center pb-[12vh] explore:items-start explore:pl-[7vw]"
        style={exploring ? undefined : { y: textY, opacity: fade }}
      >
        <p className="eyebrow pixel-shadow mb-2 flex items-center gap-3 px-6 text-center !text-fg/80 explore:px-0">
          <PixelCross className="h-3 w-2 shrink-0 text-glass-1" />
          {profile.tagline}
          <PixelCross className="h-3 w-2 shrink-0 text-glass-1" />
        </p>
        <h1
          className="pixel-shadow flex font-display text-[30vw] leading-none text-fg md:text-[21vw] explore:text-[min(19vw,34vh)]"
          aria-label={profile.name}
        >
          {[...profile.name].map((ch, i) => (
            <Letter key={i} ch={ch} index={i} mouseX={mouseX} play={entered} />
          ))}
        </h1>
        <Roles />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex items-end justify-between px-4 font-mono text-[10px] uppercase tracking-widest text-fg-muted md:px-8"
        style={exploring ? undefined : { opacity: fade }}
      >
        <span className="pixel-shadow">
          {profile.location ? `based on ${profile.location}` : ''}
        </span>
        <span className="pixel-shadow flex flex-col items-center gap-2">
          {exploring ? 'scroll to wander' : 'descend'}
          <span className="flex flex-col gap-1 explore:flex-row" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 bg-glass-1"
                animate={{ opacity: [0.15, 1, 0.15] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: (t) => Math.round(t * 4) / 4,
                }}
              />
            ))}
          </span>
        </span>
        <span className="pixel-shadow hidden md:inline">
          {fine ? 'click to call the lightning' : 'tap to call the lightning'}
        </span>
      </motion.div>
    </section>
  )
}

/** A letter that lifts and catches candlelight as the cursor passes. */
function Letter({
  ch,
  index,
  mouseX,
  play,
}: {
  ch: string
  index: number
  mouseX: MotionValue<number>
  play: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  // Layout is read at most every 200ms (not on every pointer move); the letter
  // barely moves in between, so the cached centre is plenty accurate.
  const box = useRef({ center: 0, width: 1, at: -1e9 })
  const near = useTransform(mouseX, (x) => {
    const el = ref.current
    if (!el) return 0
    const now = performance.now()
    if (now - box.current.at > 200) {
      const r = el.getBoundingClientRect()
      box.current = { center: r.left + r.width / 2, width: r.width, at: now }
    }
    const d = Math.abs(x - box.current.center)
    return Math.max(0, 1 - d / (box.current.width * 1.4))
  })
  const n = useSpring(near, { stiffness: 180, damping: 22 })
  // Snap the lift to whole "pixels" of the font (~1/24 em).
  const y = useTransform(n, (v) => `${-Math.round(v * 3) / 24}em`)
  const glow = useTransform(n, (v) => Math.round(v * 100))
  const color = useMotionTemplate`color-mix(in srgb, var(--color-glass-1) ${glow}%, var(--color-fg))`

  return (
    // The reveal mask has headroom so the tall glyphs and the lift aren't
    // clipped; negative margins keep the layout tight.
    <span className="-mb-[0.1em] -mt-[0.25em] inline-block overflow-hidden pb-[0.1em] pt-[0.25em]">
      <motion.span
        ref={ref}
        aria-hidden
        className="inline-block"
        style={{ y, color }}
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: play ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)' }}
        transition={{
          delay: 0.6 + index * 0.12,
          duration: 0.8,
          ease: (t) => Math.round(t * 12) / 12,
        }}
      >
        {ch}
      </motion.span>
    </span>
  )
}

const longestRole = profile.roles.reduce((a, b) => (b.length > a.length ? b : a), '')

function Roles() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % profile.roles.length), 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <p className="pixel-shadow mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest md:text-sm explore:mt-2">
      <span className="text-fg/60">i make</span>
      {/* An invisible copy of the longest role sizes the slot, so nothing gets cut off. */}
      <span className="relative inline-grid h-[1.8em] items-center overflow-hidden">
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {longestRole}
        </span>
        <AnimatePresence initial={false}>
          <motion.span
            key={i}
            className="col-start-1 row-start-1 whitespace-nowrap text-glass-1"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.4, ease: (t) => Math.round(t * 6) / 6 }}
          >
            {profile.roles[i]}
          </motion.span>
        </AnimatePresence>
      </span>
    </p>
  )
}
