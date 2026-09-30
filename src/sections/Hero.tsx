import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { profile } from '@/content/profile'
import { useFinePointer } from '@/hooks/useFinePointer'
import { enteredStore, modeStore, useStore } from '@/lib/store'

// Three.js is ~a third of the bundle, so it streams in after first paint.
const Scene = lazy(() => import('@/three/Scene'))

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { margin: '0px 0px 100px 0px' })
  const still = useReducedMotion() ?? false
  const fine = useFinePointer()
  const mode = useStore(modeStore)
  const entered = useStore(enteredStore)
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
      className="relative h-svh min-h-[560px] overflow-hidden"
      onPointerMove={(e) => mouseX.set(e.clientX)}
      onPointerLeave={() => mouseX.set(-9999)}
    >
      {/* Fades out at the bottom so the chrome melts into the page background. */}
      <div className="fade-bottom absolute inset-0">
        <ErrorBoundary fallback={<OrbFallback />}>
          <Suspense fallback={<OrbFallback />}>
            <Scene
              eventSource={ref}
              // Idle behind the splash screen and once scrolled away.
              active={inView && entered}
              still={still}
              lite={!fine}
              mode={mode}
              scroll={scrollYProgress}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <motion.div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-white mix-blend-difference"
        style={{ y: textY, opacity: fade }}
      >
        <p className="eyebrow mb-4 px-6 text-center !text-white/70">{profile.tagline}</p>
        <h1
          className="flex font-display text-[19vw] uppercase leading-none tracking-[-0.04em]"
          aria-label={profile.name}
        >
          {[...profile.name].map((ch, i) => (
            <Letter key={i} ch={ch} index={i} mouseX={mouseX} play={entered} />
          ))}
        </h1>
        <Roles />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex items-end justify-between px-4 font-mono text-[11px] uppercase tracking-widest text-fg-muted md:px-8"
        style={{ opacity: fade }}
      >
        <span>{profile.location ? `based on ${profile.location}` : ''}</span>
        <span className="flex flex-col items-center gap-2">
          scroll
          <span className="relative h-10 w-px overflow-hidden bg-line">
            <motion.span
              className="absolute inset-x-0 top-0 h-1/2 bg-fg"
              animate={{ y: ['-100%', '200%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </span>
        </span>
        <span className="hidden md:inline">
          {fine ? 'click the chrome' : 'tap the chrome'}
        </span>
      </motion.div>
    </section>
  )
}

/** A letter whose weight and stretch react to how close the cursor is. */
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
    return Math.max(0, 1 - d / (box.current.width * 1.6))
  })
  const n = useSpring(near, { stiffness: 180, damping: 22 })
  const fontWeight = useTransform(n, [0, 1], [880, 220])
  const scaleY = useTransform(n, [0, 1], [1, 1.18])

  return (
    // The reveal mask has headroom so the tall glyphs and the cursor stretch
    // (scaleY from the bottom) aren't clipped; negative margins keep the layout tight.
    <span className="-mb-[0.08em] -mt-[0.22em] inline-block overflow-hidden pb-[0.08em] pt-[0.22em]">
      <motion.span
        ref={ref}
        aria-hidden
        className="inline-block origin-bottom"
        style={{ fontWeight, scaleY }}
        initial={{ y: '130%' }}
        animate={{ y: play ? '0%' : '130%' }}
        transition={{ delay: 0.5 + index * 0.07, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
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
    <p className="mt-6 flex items-center gap-2 font-mono text-sm uppercase tracking-widest md:text-base">
      <span className="text-white/60">i make</span>
      {/* An invisible copy of the longest role sizes the slot, so nothing gets cut off. */}
      <span className="relative inline-grid h-[1.6em] items-center overflow-hidden">
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {longestRole}
        </span>
        <AnimatePresence initial={false}>
          <motion.span
            key={i}
            className="col-start-1 row-start-1 whitespace-nowrap"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {profile.roles[i]}
          </motion.span>
        </AnimatePresence>
      </span>
    </p>
  )
}

/** Shown while the 3D chunk loads (and as the look for no-WebGL visitors). */
function OrbFallback() {
  return (
    <div className="grid h-full place-items-center">
      <div
        className="aspect-square w-[min(60vw,60vh)] animate-pulse rounded-full"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, #fff, #c9ced8 18%, #4a4f5a 45%, #0e0e13 70%), var(--iri-gradient)',
          backgroundBlendMode: 'overlay',
          boxShadow: '0 0 120px 10px rgb(199 164 255 / 0.15)',
        }}
      />
    </div>
  )
}
