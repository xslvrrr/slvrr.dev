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
  const active = useInView(ref, { margin: '0px 0px 100px 0px' })
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
      className="relative h-svh min-h-[560px] overflow-hidden"
      onPointerMove={(e) => mouseX.set(e.clientX)}
      onPointerLeave={() => mouseX.set(-9999)}
    >
      <div className="absolute inset-0">
        <ErrorBoundary fallback={<OrbFallback />}>
          <Suspense fallback={<OrbFallback />}>
            <Scene
              eventSource={ref}
              active={active}
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
          className="flex font-display text-[24vw] uppercase leading-[0.8] tracking-[-0.04em] md:text-[19vw]"
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
  const near = useTransform(mouseX, (x) => {
    const el = ref.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const d = Math.abs(x - (r.left + r.width / 2))
    return Math.max(0, 1 - d / (r.width * 1.6))
  })
  const n = useSpring(near, { stiffness: 180, damping: 22 })
  const fontWeight = useTransform(n, [0, 1], [880, 220])
  const scaleY = useTransform(n, [0, 1], [1, 1.18])

  return (
    <span className="inline-block overflow-hidden pb-[0.06em]">
      <motion.span
        ref={ref}
        aria-hidden
        className="inline-block origin-bottom"
        style={{ fontWeight, scaleY }}
        initial={{ y: '105%' }}
        animate={{ y: play ? '0%' : '105%' }}
        transition={{ delay: 0.5 + index * 0.07, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        {ch}
      </motion.span>
    </span>
  )
}

const longestRole = Math.max(...profile.roles.map((r) => r.length))

function Roles() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % profile.roles.length), 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <p className="mt-6 flex items-center gap-2 font-mono text-sm uppercase tracking-widest md:text-base">
      <span className="text-white/60">i make</span>
      <span
        className="relative inline-flex h-[1.4em] overflow-hidden"
        style={{ minWidth: `${longestRole}ch` }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={i}
            className="absolute left-0 whitespace-nowrap"
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
    <div className="grid h-full place-items-center bg-ink">
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
