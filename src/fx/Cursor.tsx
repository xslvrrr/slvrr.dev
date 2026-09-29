import { motion, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useState } from 'react'
import { useFinePointer } from '@/hooks/useFinePointer'

/**
 * Custom cursor: a crisp dot plus a springy trailing ring that swells over
 * anything interactive. Add `data-cursor="label"` to show a word inside it.
 */
export function Cursor() {
  const fine = useFinePointer()
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const rx = useSpring(x, { stiffness: 350, damping: 30, mass: 0.6 })
  const ry = useSpring(y, { stiffness: 350, damping: 30, mass: 0.6 })
  const [hover, setHover] = useState<string | null>(null)
  const [down, setDown] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!fine) return
    document.documentElement.classList.add('has-cursor')
    const move = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true)
      const el = (e.target as Element | null)?.closest?.('a, button, [data-cursor]')
      setHover(el ? (el.getAttribute('data-cursor') ?? '') : null)
    }
    const leave = () => setVisible(false)
    const press = () => setDown(true)
    const release = () => setDown(false)
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', leave)
    window.addEventListener('pointerdown', press)
    window.addEventListener('pointerup', release)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerdown', press)
      window.removeEventListener('pointerup', release)
    }
  }, [fine, x, y])

  if (!fine) return null
  const size = hover === null ? 34 : hover ? 84 : 56

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] mix-blend-difference"
    >
      <motion.div
        className="absolute left-0 top-0 grid place-items-center rounded-full border border-white/80"
        style={{ x: rx, y: ry, translateX: '-50%', translateY: '-50%' }}
        animate={{
          width: size,
          height: size,
          opacity: visible ? 1 : 0,
          scale: down ? 0.8 : 1,
          backgroundColor: hover ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {hover ? (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-black">
            {hover}
          </span>
        ) : null}
      </motion.div>
      <motion.div
        className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-white"
        style={{ x, y, translateX: '-50%', translateY: '-50%' }}
        animate={{ opacity: visible && hover === null ? 1 : 0 }}
      />
    </div>
  )
}
