import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { copy } from '@/content/copy'
import { profile } from '@/content/profile'
import { createPortal } from 'react-dom'
import { Landmark } from '@/components/ExploreTrack'
import { PixelCross } from '@/components/PixelCross'
import { Magnetic } from '@/fx/Magnetic'
import { resurface } from '@/lib/resurface'
import { modeStore, useStore } from '@/lib/store'

const year = new Date().getFullYear()

export function Footer() {
  const [stats, setStats] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])

  return (
    // The calvary at the end of the walk; "ascend" goes back to the gate.
    <footer
      data-bg="footer"
      data-landmark="calvary"
      className="relative overflow-hidden border-t-2 border-line explore:flex explore:shrink-0 explore:border-t-0"
    >
      <div className="section flex flex-col gap-16 !pb-10 explore:w-[54vw] explore:gap-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <p className="max-w-md text-lg text-fg-muted">{copy.footer.outro}</p>
          <Magnetic>
            <a
              href="#top"
              data-cursor="up"
              onClick={(e) => {
                e.preventDefault()
                setRipples((r) => [...r, Date.now()])
                resurface()
              }}
              className="pixel-btn relative flex h-32 w-24 flex-col items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest hover:!bg-glass-1 hover:!text-ink [clip-path:polygon(0_30%,15%_15%,30%_6%,50%_0,70%_6%,85%_15%,100%_30%,100%_100%,0_100%)]"
            >
              <PixelCross className="h-5 w-3.5" />
              {copy.footer.backUp}
              <AnimatePresence>
                {ripples.map((id) => (
                  <motion.span
                    key={id}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 border-2 border-glass-1"
                    initial={{ scale: 1, opacity: 0.9 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    onAnimationComplete={() =>
                      setRipples((r) => r.filter((x) => x !== id))
                    }
                  />
                ))}
              </AnimatePresence>
            </a>
          </Magnetic>
        </div>
        <WaveWord word={profile.name} />
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-widest text-fg-faint">
          <span>
            © {year} {profile.name}
          </span>
          <span>{copy.footer.credit}</span>
          <button
            type="button"
            onClick={() => setStats((v) => !v)}
            className="h-6 w-6 border-2 border-line opacity-30 hover:opacity-100"
            aria-label="Toggle stats"
            data-cursor="?"
          >
            ?
          </button>
        </div>
      </div>
      <Landmark className="w-[40vw]" />
      {/* Portalled: inside the sideways-moving track, position: fixed wouldn't stay put. */}
      {createPortal(
        <AnimatePresence>
          {stats && <StatsOverlay onClose={() => setStats(false)} />}
        </AnimatePresence>,
        document.body,
      )}
    </footer>
  )
}

/**
 * The big stone wordmark. Sized in container units (cqw) so it always fits its
 * column (vw overflowed on wide laptops, where the column is capped), and the
 * letters ripple upward as the cursor passes over them.
 */
function WaveWord({ word }: { word: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(-1e5)
  // Letter centres relative to the container, measured on pointer enter
  // instead of reading layout on every move.
  const centers = useRef<number[]>([])
  const spread = useRef(1)

  const measure = () => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const letters = [...el.querySelectorAll<HTMLElement>('[data-letter]')]
    centers.current = letters.map((l) => {
      const r = l.getBoundingClientRect()
      return r.left - box.left + r.width / 2
    })
    spread.current = box.width / Math.max(1, letters.length)
  }

  return (
    <div
      ref={ref}
      aria-hidden
      className="@container select-none"
      onPointerEnter={measure}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        mouseX.set(e.clientX - e.currentTarget.getBoundingClientRect().left)
      }}
      onPointerLeave={() => mouseX.set(-1e5)}
    >
      <p className="-my-[0.1em] flex justify-center py-[0.1em] font-display text-[28cqw] leading-none [filter:drop-shadow(0.03em_0.03em_0_rgb(0_0_0/0.85))]">
        {[...word].map((ch, i) => (
          <WaveLetter
            key={i}
            ch={ch}
            index={i}
            mouseX={mouseX}
            centers={centers}
            spread={spread}
          />
        ))}
      </p>
    </div>
  )
}

function WaveLetter({
  ch,
  index,
  mouseX,
  centers,
  spread,
}: {
  ch: string
  index: number
  mouseX: MotionValue<number>
  centers: RefObject<number[]>
  spread: RefObject<number>
}) {
  const near = useTransform(mouseX, (x) => {
    const c = centers.current[index]
    if (c === undefined) return 0
    return Math.max(0, 1 - Math.abs(x - c) / (spread.current * 1.4))
  })
  const n = useSpring(near, { stiffness: 220, damping: 16, mass: 0.6 })
  const y = useTransform(n, [0, 1], ['0%', '-10%'])
  const scaleY = useTransform(n, [0, 1], [1, 1.08])

  return (
    <motion.span
      data-letter
      className="text-stone inline-block origin-bottom"
      style={{ y, scaleY }}
    >
      {ch}
    </motion.span>
  )
}

function useFps() {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const loop = (t: number) => {
      frames++
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)))
        frames = 0
        last = t
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return fps
}

function StatsOverlay({ onClose }: { onClose: () => void }) {
  const fps = useFps()
  const mode = useStore(modeStore)
  const rows: [string, string][] = [
    ['fps', String(fps)],
    [
      'viewport',
      `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    ],
    ['mode', mode],
    ['secret', mode === 'bloodmoon' ? 'the moon is red' : '↑↑↓↓←→←→ b a'],
  ]
  return (
    <motion.div
      className="panel fixed bottom-6 right-6 z-[80] w-72 p-5 font-mono text-xs"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">stats for nerds</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stats"
          className="hover:text-fg"
        >
          ✕
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-faint">{k}</dt>
            <dd className="text-right text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}
