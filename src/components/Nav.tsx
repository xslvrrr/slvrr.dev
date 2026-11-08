import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { GlitchHandle } from '@/components/GlitchHandle'
import { sfx } from '@/lib/sfx'
import { enteredStore, soundStore, useStore } from '@/lib/store'
import { worldStore } from '@/world/state'
import { stations } from '@/world/stations'

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
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * The HUD: name, a map of where you can go (each link walks you there), the
 * time, and the sound toggle. Hidden on the title screen.
 */
export function Nav() {
  const time = useClock()
  const sound = useStore(soundStore)
  const entered = useStore(enteredStore)
  const { mode, station } = useStore(worldStore)
  const { hash } = useLocation()
  const show =
    mode === 'failed' ||
    (entered && mode !== 'loading' && mode !== 'gate' && mode !== 'opening')
  const here = stations[station]?.section

  return (
    <AnimatePresence>
      {show && (
        <motion.header
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-3 font-mono text-lg text-fg-muted md:px-8"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            to="/"
            className="font-display text-3xl leading-none text-fg [text-shadow:2px_2px_0_#000]"
            onMouseEnter={sfx.tick}
            aria-label="slvrr, home"
          >
            <GlitchHandle />
          </Link>
          <nav className="hidden gap-5 md:flex" aria-label="Places">
            {sections.map((s) => {
              const current = hash === `#${s.id}` || (!hash && here === s.id)
              return (
                <Link
                  key={s.id}
                  to={`/#${s.id}`}
                  onMouseEnter={sfx.tick}
                  aria-current={current ? 'location' : undefined}
                  className={`uppercase tracking-widest transition-colors [text-shadow:2px_2px_0_#000] hover:text-fg ${current ? 'text-fg' : ''}`}
                >
                  {current ? `▸ ${s.label}` : s.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-4 [text-shadow:2px_2px_0_#000]">
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
      )}
    </AnimatePresence>
  )
}
