import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { profile } from '@/content/profile'
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

export function Nav() {
  const time = useClock()
  const sound = useStore(soundStore)

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-4 py-4 font-mono text-xs text-fg-muted mix-blend-difference md:px-8"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to="/" className="font-semibold text-fg" onMouseEnter={sfx.tick}>
        {profile.handle}
      </Link>
      <nav className="hidden gap-6 md:flex">
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
