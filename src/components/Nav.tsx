import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { GlitchHandle } from '@/components/GlitchHandle'
import { cameraX, explore } from '@/lib/explore'
import { sfx } from '@/lib/sfx'
import { soundStore, useStore } from '@/lib/store'

const sections = [
  { id: 'links', label: 'links' },
  { id: 'music', label: 'music' },
  { id: 'work', label: 'work' },
  { id: 'about', label: 'about' },
  { id: 'notes', label: 'notes' },
]

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** While exploring: how far along the garden path you've walked. */
function usePathProgress() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const update = () => {
      if (!ref.current) return
      const p = explore.maxX ? cameraX() / explore.maxX : 0
      ref.current.style.transform = `scaleX(${Math.round(p * 40) / 40})`
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('explore:layout', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('explore:layout', update)
    }
  }, [])
  return ref
}

export function Nav() {
  const time = useClock()
  const sound = useStore(soundStore)
  const path = usePathProgress()

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-4 py-4 font-mono text-[10px] text-fg-muted mix-blend-difference md:px-8"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to="/"
        className="font-display text-2xl leading-none text-fg"
        onMouseEnter={sfx.tick}
      >
        <GlitchHandle />
      </Link>
      <nav className="relative hidden gap-6 md:flex">
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-2 hidden h-0.5 bg-fg/20 explore:block"
        />
        <span
          ref={path}
          aria-hidden
          className="absolute inset-x-0 -bottom-2 hidden h-0.5 origin-left scale-x-0 bg-fg explore:block"
        />
        {sections.map((s) => (
          <Link
            key={s.id}
            to={`/#${s.id}`}
            onMouseEnter={sfx.tick}
            className="uppercase tracking-widest transition-colors hover:text-fg"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4">
        <span className="tabular-nums" title="my local time">
          {time}
        </span>
        <button
          type="button"
          onClick={() => {
            soundStore.set(!sound)
            if (!sound) sfx.click()
          }}
          className="uppercase tracking-widest hover:text-fg"
          aria-pressed={sound}
          data-cursor={sound ? 'mute' : 'unmute'}
        >
          sound {sound ? 'on' : 'off'}
        </button>
      </div>
    </motion.header>
  )
}
