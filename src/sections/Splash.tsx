import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLenis } from 'lenis/react'
import { profile } from '@/content/profile'
import { sfx } from '@/lib/sfx'
import { enteredStore, useStore } from '@/lib/store'

/**
 * "Click to enter" gate in the guns.lol tradition. The click is the user
 * gesture that lets the browser play sound. Skipped on reloads within a session.
 */
export function Splash() {
  const entered = useStore(enteredStore)
  const [progress, setProgress] = useState(0)
  const lenis = useLenis()

  useEffect(() => {
    if (entered) lenis?.start()
    else lenis?.stop()
  }, [entered, lenis])

  // A short fake loader: the real work (3D chunk) streams in behind it.
  useEffect(() => {
    if (entered) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1400)
      setProgress(1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [entered])

  const enter = () => {
    sfx.enter()
    enteredStore.set(true)
  }

  return (
    <AnimatePresence>
      {!entered && (
        <motion.button
          key="splash"
          type="button"
          onClick={enter}
          data-cursor="enter"
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-10 bg-ink text-center"
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1] }}
          aria-label="Enter site"
        >
          <motion.span
            className="font-display text-[18vw] font-black leading-none tracking-tighter text-chrome md:text-[12vw]"
            initial={{ opacity: 0, filter: 'blur(20px)', scale: 1.1 }}
            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="shimmer">{profile.name}</span>
          </motion.span>
          <span className="flex w-56 flex-col items-center gap-3">
            <span className="h-px w-full overflow-hidden bg-line">
              <span
                className="block h-full origin-left bg-chrome-1"
                style={{ transform: `scaleX(${progress})` }}
              />
            </span>
            <motion.span
              className="eyebrow"
              animate={{ opacity: progress === 1 ? [0.4, 1, 0.4] : 0.4 }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              {progress === 1
                ? 'click anywhere to enter'
                : `${Math.round(progress * 100)}%`}
            </motion.span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
