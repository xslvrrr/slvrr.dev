import { ReactLenis, useLenis } from 'lenis/react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { MiniPlayer } from '@/components/MiniPlayer'
import { Nav } from '@/components/Nav'
import { PixelCross } from '@/components/PixelCross'
import { Cursor } from '@/fx/Cursor'
import { ResurfaceOverlay } from '@/fx/Resurface'
import { NightScene } from '@/fx/NightScene'
import { useKonami } from '@/hooks/useKonami'
import { sfx } from '@/lib/sfx'
import { modeStore } from '@/lib/store'
import Home from '@/pages/Home'
import NotePage from '@/pages/NotePage'

export default function App() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)

  const unlock = useCallback(() => {
    const next = modeStore.get() === 'night' ? 'bloodmoon' : 'night'
    modeStore.set(next)
    sfx.unlock()
    setToast(next === 'bloodmoon' ? 'the blood moon rises' : 'the moon pales again')
  }, [])
  useKonami(unlock)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  return (
    <ReactLenis root options={{ lerp: 0.1, anchors: true, autoRaf: true }}>
      <MotionConfig reducedMotion="user">
        <NightScene />
        <Cursor key={location.pathname} />
        <Nav />
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial="enter" animate="idle" exit="leave">
            <ScrollToHash />
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/notes/:slug" element={<NotePage />} />
              <Route path="*" element={<NotePage />} />
            </Routes>
            <PageWipe />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {toast && (
            <motion.div
              className="panel fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 px-5 py-3 font-mono text-xs uppercase tracking-widest"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
            >
              <span className="flex items-center gap-3 text-glass-1">
                <PixelCross />
                {toast}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <MiniPlayer />
        <ResurfaceOverlay />
      </MotionConfig>
    </ReactLenis>
  )
}

/** Ease in-out, snapped to 14 steps so the motion reads as pixel animation. */
const stepped = (t: number) => {
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  return Math.round(e * 14) / 14
}

/** A dark shroud with dithered edges that falls between routes, then lifts. */
function PageWipe() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 -top-4 z-[70] grid h-[calc(100vh+2rem)] place-items-center bg-ink"
      variants={{
        enter: { y: '0%' },
        idle: { y: '-110%', transition: { duration: 0.7, ease: stepped } },
        leave: { y: '0%', transition: { duration: 0.5, ease: stepped } },
      }}
    >
      <span className="dither-edge absolute inset-x-0 -bottom-4 h-4" />
      <span className="dither-edge absolute inset-x-0 -top-4 h-4" />
      <PixelCross className="h-14 w-10 text-glass-1" />
    </motion.div>
  )
}

/**
 * Lives inside each page, so it runs once the new route has mounted: jumps to
 * #hash (or the top) instantly, then smooth-scrolls on later in-page hash changes.
 */
function ScrollToHash() {
  const { hash } = useLocation()
  const lenis = useLenis()
  const first = useRef(true)

  useEffect(() => {
    if (!lenis) return
    const immediate = first.current
    first.current = false
    const id = requestAnimationFrame(() => {
      lenis.resize()
      const el = hash ? document.getElementById(hash.slice(1)) : null
      if (el || immediate) lenis.scrollTo(el ?? 0, { immediate, force: true })
    })
    return () => cancelAnimationFrame(id)
  }, [hash, lenis])

  return null
}
