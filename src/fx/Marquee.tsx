import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from 'motion/react'
import { useRef } from 'react'
import { usePauseOffscreen } from '@/hooks/usePauseOffscreen'

/**
 * Endless ticker that speeds up, reverses and skews with scroll velocity.
 */
export function Marquee({ items, speed = 3 }: { items: string[]; speed?: number }) {
  const base = useMotionValue(0)
  const { scrollY } = useScroll()
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 })
  const boost = useTransform(velocity, [-2000, 0, 2000], [-5, 0, 5], { clamp: false })
  const skew = useTransform(velocity, [-3000, 3000], [12, -12])
  const x = useTransform(base, (v) => `${wrap(-50, 0, v)}%`)
  const dir = useRef(-1)
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref)
  // Also pause the shimmering star glyphs' CSS animation while off screen.
  usePauseOffscreen(ref)

  useAnimationFrame((_, delta) => {
    if (!visible) return
    const b = boost.get()
    if (b < 0) dir.current = 1
    else if (b > 0) dir.current = -1
    base.set(base.get() + dir.current * speed * (delta / 1000) * (1 + Math.abs(b)))
  })

  const row = (
    <span className="flex">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-8 pr-8">
          <span>{item}</span>
          <span className="text-iri">✦</span>
        </span>
      ))}
    </span>
  )

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border-y border-line py-5"
      aria-hidden
    >
      <motion.div
        className="flex w-max whitespace-nowrap py-[0.1em] font-display text-4xl font-bold uppercase leading-[1.25] tracking-tight text-chrome md:text-6xl"
        style={{ x, skewX: skew }}
      >
        {row}
        {row}
      </motion.div>
    </div>
  )
}
