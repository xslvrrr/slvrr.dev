import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import type { ReactNode } from 'react'

/** Resting tilt (0–1 pointer space) so the case still reads as 3D when idle / on touch. */
const REST = { x: 0.62, y: 0.4 }
const MAX = 16
/** Case thickness in px: the lid sits at +LID, the back tray at -(DEPTH - LID). */
const DEPTH = 16
const LID = 6

/**
 * A CD jewel case: back tray, side walls, the art, and a clear lid with a
 * ridged hinge. Tilting it toward the cursor reveals the walls, sweeps a
 * glossy sheen across the lid and runs a glint along its edges.
 * Transform- and opacity-only, so it's cheap to animate.
 */
export function JewelCase({ children }: { children: ReactNode }) {
  const px = useMotionValue(REST.x)
  const py = useMotionValue(REST.y)
  const sx = useSpring(px, { stiffness: 180, damping: 18 })
  const sy = useSpring(py, { stiffness: 180, damping: 18 })
  const hover = useMotionValue(0)
  const lift = useSpring(hover, { stiffness: 220, damping: 22 })

  const rotateY = useTransform(sx, [0, 1], [-MAX, MAX])
  const rotateX = useTransform(sy, [0, 1], [MAX, -MAX])
  const z = useTransform(lift, [0, 1], [0, 18])

  // How far from flat the case is (0 flat → ~0.7 at a corner).
  const tilt = useTransform([sx, sy], ([x, y]: number[]) => Math.hypot(x - 0.5, y - 0.5))
  // Sheen: a diagonal band that slides across against the tilt and brightens with it.
  const sheenPos = useTransform(
    sx,
    (v) => `${(1 - Math.min(1, Math.max(0, v))) * 100}% 0`,
  )
  const sheenOpacity = useTransform(tilt, [0, 0.5], [0.08, 0.9])
  // Glint: a bright spot that travels around the lid edges with the tilt direction.
  const glintAngle = useTransform([sx, sy], ([x, y]: number[]) =>
    Math.round((Math.atan2(y - 0.5, x - 0.5) * 180) / Math.PI + 90),
  )
  const glint = useMotionTemplate`linear-gradient(${glintAngle}deg, transparent 30%, rgb(235 248 255 / 0.95) 50%, transparent 70%)`
  const glintOpacity = useTransform(tilt, [0, 0.45], [0.2, 1])
  const shadowScale = useTransform(lift, [0, 1], [1, 1.15])
  const shadowOpacity = useTransform(lift, [0, 1], [0.55, 0.35])

  return (
    <div className="[perspective:900px]">
      <motion.div
        className="relative aspect-square [transform-style:preserve-3d]"
        style={{ rotateX, rotateY, z }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return
          const r = e.currentTarget.getBoundingClientRect()
          px.set((e.clientX - r.left) / r.width)
          py.set((e.clientY - r.top) / r.height)
          hover.set(1)
        }}
        onPointerLeave={() => {
          px.set(REST.x)
          py.set(REST.y)
          hover.set(0)
        }}
      >
        {/* contact shadow */}
        <motion.div
          aria-hidden
          className="absolute inset-x-[4%] -bottom-[9%] h-[14%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.8),transparent)]"
          style={{ scaleX: shadowScale, opacity: shadowOpacity, z: -DEPTH }}
        />
        {/* back tray */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-[6px] border border-white/5 bg-[#07090d]"
          style={{ transform: `translateZ(${LID - DEPTH}px)` }}
        />
        {/* side walls: each rotated 90° about one edge, running from the lid back to the tray */}
        <Wall
          className="right-0 top-0 h-full origin-right"
          size={DEPTH}
          axis="y"
          sign={-1}
        />
        <Wall
          className="left-0 top-0 h-full origin-left"
          size={DEPTH}
          axis="y"
          sign={1}
        />
        <Wall
          className="bottom-0 left-0 w-full origin-bottom"
          size={DEPTH}
          axis="x"
          sign={1}
        />
        <Wall
          className="left-0 top-0 w-full origin-top"
          size={DEPTH}
          axis="x"
          sign={-1}
        />

        {/* the art: sits right of the hinge, like a booklet in a real case */}
        <div className="absolute inset-y-[3%] left-[8%] right-[3%] overflow-hidden rounded-[2px] bg-ink-3">
          {children}
        </div>

        {/* the clear lid */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-[6px] border border-white/15 bg-white/[0.025]"
          style={{ transform: `translateZ(${LID}px)` }}
        >
          {/* hinge spine with moulded ridges */}
          <div className="absolute inset-y-0 left-0 w-[8%] rounded-l-[6px] border-r border-white/10 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.09)_0_1px,transparent_1px_3px),linear-gradient(90deg,rgb(255_255_255/0.08),rgb(255_255_255/0.02))]" />
          <motion.div
            className="absolute inset-0 rounded-[6px] bg-[linear-gradient(115deg,transparent_32%,rgb(255_255_255/0.32)_45%,rgb(255_255_255/0.06)_52%,transparent_62%)] bg-[length:260%_100%] bg-no-repeat"
            style={{ backgroundPosition: sheenPos, opacity: sheenOpacity }}
          />
          <motion.div
            className="edge-glint absolute inset-0 rounded-[6px]"
            style={{ backgroundImage: glint, opacity: glintOpacity }}
          />
        </div>
      </motion.div>
    </div>
  )
}

/** One plastic side wall of the case. */
function Wall({
  className,
  size,
  axis,
  sign,
}: {
  className: string
  size: number
  axis: 'x' | 'y'
  sign: 1 | -1
}) {
  const rotate = axis === 'y' ? `rotateY(${sign * 90}deg)` : `rotateX(${sign * 90}deg)`
  return (
    <div
      aria-hidden
      className={`absolute bg-gradient-to-b from-[#1b222c] via-[#0e1218] to-[#1b222c] ${className}`}
      style={{
        [axis === 'y' ? 'width' : 'height']: size,
        transform: `translateZ(${LID}px) ${rotate}`,
      }}
    />
  )
}
