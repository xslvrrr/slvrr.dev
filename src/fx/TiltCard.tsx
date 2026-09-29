import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import type { ReactNode } from 'react'

/**
 * 3D tilt toward the cursor with a holographic foil sheen that tracks it,
 * like a rare trading card.
 */
export function TiltCard({
  children,
  className = '',
  max = 10,
}: {
  children: ReactNode
  className?: string
  max?: number
}) {
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 200, damping: 20 })
  const sy = useSpring(py, { stiffness: 200, damping: 20 })
  const rotateY = useTransform(sx, [0, 1], [-max, max])
  const rotateX = useTransform(sy, [0, 1], [max, -max])
  const gx = useTransform(sx, (v) => `${v * 100}%`)
  const gy = useTransform(sy, (v) => `${v * 100}%`)
  const foilPos = useTransform(sx, (v) => `${v * 200}% 50%`)
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgb(255 255 255 / 0.28), transparent 45%)`
  const hover = useMotionValue(0)
  const foilOpacity = useSpring(hover, { stiffness: 200, damping: 30 })
  const foilAlpha = useTransform(foilOpacity, [0, 1], [0, 0.35])

  return (
    <div className="[perspective:1000px]">
      <motion.div
        className={`panel group relative h-full overflow-hidden [transform-style:preserve-3d] ${className}`}
        style={{ rotateX, rotateY }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          px.set((e.clientX - r.left) / r.width)
          py.set((e.clientY - r.top) / r.height)
          hover.set(1)
        }}
        onPointerLeave={() => {
          px.set(0.5)
          py.set(0.5)
          hover.set(0)
        }}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
          style={{
            opacity: foilAlpha,
            backgroundImage: 'var(--iri-gradient)',
            backgroundSize: '300% 300%',
            backgroundPosition: foilPos,
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: glare, opacity: foilOpacity }}
        />
        <div className="relative [transform:translateZ(30px)]">{children}</div>
      </motion.div>
    </div>
  )
}
