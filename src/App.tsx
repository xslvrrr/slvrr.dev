import { ReactLenis, useLenis } from 'lenis/react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { Nav } from '@/components/Nav'
import { Cursor } from '@/fx/Cursor'
import { ShaderBackground } from '@/fx/ShaderBackground'
import { useKonami } from '@/hooks/useKonami'
import { sfx } from '@/lib/sfx'
import { modeStore } from '@/lib/store'
import Home from '@/pages/Home'
import NotePage from '@/pages/NotePage'

export default function App() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)

  const unlock = useCallback(() => {
    const next = modeStore.get() === 'chrome' ? 'mercury' : 'chrome'
    modeStore.set(next)
    sfx.unlock()
    setToast(next === 'mercury' ? 'mercury mode unlocked ✦' : 'back to chrome')
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
        <ShaderBackground />
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
              className="panel fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 px-5 py-3 font-mono text-xs uppercase tracking-widest"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
            >
              <span className="text-iri">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </ReactLenis>
  )
}

/** A chrome panel that sweeps across the screen between routes. */
function PageWipe() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70] origin-bottom"
      style={{ background: 'var(--chrome-gradient)' }}
      variants={{
        enter: { scaleY: 1, originY: 0 },
        idle: {
          scaleY: 0,
          originY: 0,
          transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] },
        },
        leave: {
          scaleY: 1,
          originY: 1,
          transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] },
        },
      }}
    />
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
