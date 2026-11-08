import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { MiniPlayer } from '@/components/MiniPlayer'
import { PixelCross } from '@/components/PixelCross'
import { Cursor } from '@/fx/Cursor'
import { ResurfaceOverlay } from '@/fx/Resurface'
import { useKonami } from '@/hooks/useKonami'
import { sfx } from '@/lib/sfx'
import { modeStore, useStore } from '@/lib/store'
import NotePage from '@/pages/NotePage'
import Plain from '@/pages/Plain'
import { worldStore } from '@/world/state'
import { World } from '@/world/World'

/**
 * The site is a place: a churchyard at night you walk around in (World). Each
 * section is something in it you can walk up to and use. Notes open as pages
 * over the world. Without WebGL it falls back to a plain
 * page with the same sections (Plain).
 */
export default function App() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)
  const { mode } = useStore(worldStore)

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
    <MotionConfig reducedMotion="user">
      {mode === 'failed' ? <Plain /> : <World />}
      <Cursor />
      <Routes location={location}>
        <Route path="/" element={null} />
        <Route path="/notes/:slug" element={<NotePage />} />
        <Route path="*" element={<NotePage />} />
      </Routes>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="panel fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 px-5 py-3 font-mono text-lg uppercase tracking-widest"
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
      {/* in the churchyard, the walkman you can pick up is the player */}
      {mode === 'failed' && <MiniPlayer />}
      <ResurfaceOverlay />
    </MotionConfig>
  )
}
