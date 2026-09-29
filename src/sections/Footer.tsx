import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { profile } from '@/content/profile'
import { Magnetic } from '@/fx/Magnetic'
import { modeStore, useStore } from '@/lib/store'

const year = new Date().getFullYear()

export function Footer() {
  const [stats, setStats] = useState(false)

  return (
    <footer className="relative overflow-hidden border-t border-line">
      <div className="section flex flex-col gap-16 !pb-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <p className="max-w-md text-lg text-fg-muted">
            That's the end of the page. Thanks for scrolling all the way down here.
          </p>
          <Magnetic>
            <a
              href="#top"
              data-cursor="up"
              className="grid h-28 w-28 place-items-center rounded-full border border-line-strong font-mono text-xs uppercase tracking-widest transition-colors hover:bg-fg hover:text-ink"
            >
              back up
            </a>
          </Magnetic>
        </div>
        <p
          className="select-none text-center font-display text-[22vw] font-black uppercase leading-[0.75] tracking-tighter text-chrome"
          aria-hidden
        >
          {profile.name}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-widest text-fg-faint">
          <span>
            © {year} {profile.name}
          </span>
          <span>built with react, three.js &amp; too much chrome</span>
          <button
            type="button"
            onClick={() => setStats((v) => !v)}
            className="h-6 w-6 rounded-full border border-line opacity-30 hover:opacity-100"
            aria-label="Toggle stats"
            data-cursor="?"
          >
            ?
          </button>
        </div>
      </div>
      <AnimatePresence>
        {stats && <StatsOverlay onClose={() => setStats(false)} />}
      </AnimatePresence>
    </footer>
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
    ['secret', mode === 'mercury' ? 'unlocked ✦' : '↑↑↓↓←→←→ b a'],
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
