import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { onResurface } from '@/lib/resurface'
import { sfx } from '@/lib/sfx'

const DURATION = 1.3

/**
 * Full-screen overlay for "back to the gate": a line of light with a dithered
 * wake rises up the screen while the world fades and puts you back inside the
 * gate (World listens for the same event). Renders nothing when idle.
 */
export function ResurfaceOverlay() {
  const still = useReducedMotion() ?? false
  const [active, setActive] = useState(false)
  const y = useMotionValue('100vh')

  useEffect(() => {
    const run = () => {
      sfx.resurface()
      window.setTimeout(sfx.enter, 900)
      if (still) return
      setActive(true)
      y.set('100vh')
      void animate(y, '-75vh', {
        duration: DURATION,
        ease: [0.65, 0, 0.35, 1],
      }).then(() => setActive(false))
    }
    return onResurface(run)
  }, [still, y])

  if (!active) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[75] overflow-hidden">
      <motion.div className="absolute inset-x-0 top-0 h-[75vh]" style={{ y }}>
        <div className="h-1 bg-glass-3 shadow-[0_0_24px_4px_rgb(236_236_240/0.45)]" />
        <div className="ascend-wake h-full" />
      </motion.div>
    </div>
  )
}
