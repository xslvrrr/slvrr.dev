import { useLenis } from 'lenis/react'
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { onResurface } from '@/lib/resurface'
import { sfx } from '@/lib/sfx'

const DURATION = 1.3

/**
 * Full-screen overlay for the resurface transition: an ice waterline with a
 * dithered wake rises from the bottom of the screen while the page scrolls to
 * the top underneath it. Mounted once in App; renders nothing when idle.
 */
export function ResurfaceOverlay() {
  const lenis = useLenis()
  const still = useReducedMotion() ?? false
  const [active, setActive] = useState(false)
  const y = useMotionValue('100vh')

  useEffect(() => {
    const run = () => {
      sfx.resurface()
      if (still) {
        lenis?.scrollTo(0, { immediate: true })
        return
      }
      lenis?.scrollTo(0, {
        duration: DURATION - 0.1,
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      })
      setActive(true)
      y.set('100vh')
      void animate(y, '-75vh', {
        duration: DURATION,
        ease: [0.65, 0, 0.35, 1],
      }).then(() => setActive(false))
    }
    return onResurface(run)
  }, [lenis, still, y])

  if (!active) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[75] overflow-hidden">
      <motion.div className="absolute inset-x-0 top-0 h-[75vh]" style={{ y }}>
        {/* the waterline */}
        <div className="h-[2px] bg-iri-3 shadow-[0_0_24px_4px_rgb(191_238_255/0.55)]" />
        {/* the wake: a cold wash fading out, with a dithered pixel texture */}
        <div className="resurface-wake h-full" />
      </motion.div>
    </div>
  )
}
