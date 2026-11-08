import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { copy } from '@/content/copy'
import { sfx } from '@/lib/sfx'
import type { Engine } from './engine'

/**
 * Out of bounds. The picture cuts to black and every sound stops; three
 * seconds later, a line of text. Then a glitch, and you're back at the gate
 * as if nothing happened.
 */
export function Lost({ engine }: { engine: Engine }) {
  const [phase, setPhase] = useState<'black' | 'text' | 'glitch'>('black')

  useEffect(() => {
    engine.blackout(true)
    sfx.silence(true)
    const timers = [
      window.setTimeout(() => setPhase('text'), 3000),
      window.setTimeout(() => {
        setPhase('glitch')
        sfx.glitch()
      }, 6200),
      window.setTimeout(() => {
        engine.respawn()
        engine.blackout(false)
        sfx.silence(false)
      }, 6650),
    ]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [engine])

  return (
    <motion.div
      role="alert"
      className="fixed inset-0 z-[95] grid place-items-center overflow-hidden bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      {phase !== 'black' && (
        <motion.p
          className={`lost-text px-6 text-center font-mono text-3xl tracking-wider text-[#e9e3d6] md:text-5xl ${phase === 'glitch' ? 'lost-glitch' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7, 1] }}
          transition={{ duration: 1.4, times: [0, 0.3, 0.45, 1] }}
        >
          {copy.lost}
        </motion.p>
      )}
      {phase === 'glitch' && <div aria-hidden className="lost-tear absolute inset-0" />}
    </motion.div>
  )
}
