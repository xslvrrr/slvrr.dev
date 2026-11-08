import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { profile } from '@/content/profile'
import { soundStore, useStore } from '@/lib/store'
import { worldStore } from './state'

const stepped = (n: number) => (t: number) => Math.round(t * n) / n

/**
 * The title screen, laid over the 3D view of the churchyard gate: the name
 * above the iron arch, and a prompt to push the gate open. Clicking anywhere
 * opens it (that click also unlocks the audio).
 */
export function GateTitle({ onEnter }: { onEnter: () => void }) {
  const { mode, progress } = useStore(worldStore)
  const sound = useStore(soundStore)
  const ready = mode === 'gate'
  const away = mode !== 'gate' && mode !== 'loading'

  return (
    <motion.div
      className="fixed inset-0 z-30 flex flex-col items-center justify-between px-4 pb-[8vh] pt-[9vh] text-center"
      onClick={ready ? onEnter : undefined}
      data-cursor={ready ? 'open' : undefined}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.4 } }}
    >
      {mode === 'loading' && (
        <div aria-hidden className="absolute inset-0 -z-10 bg-ink" />
      )}
      <motion.div
        className="flex flex-col items-center gap-3"
        // hidden from the moment the gate starts to open and for good after
        // (it used to come back while the overlay faded out)
        animate={{ opacity: away ? 0 : 1, y: away ? -20 : 0 }}
        transition={{ duration: 1 }}
      >
        <p className="font-mono text-lg uppercase tracking-[0.2em] text-fg/80 [text-shadow:2px_2px_0_#000] md:text-xl">
          {profile.tagline}
        </p>
        <h1 className="font-display text-[26vw] leading-[0.8] text-fg [text-shadow:0.04em_0.04em_0_#000,0_0_0.4em_rgb(0_0_0/0.8)] md:text-[12rem]">
          {profile.name}
        </h1>
        <Roles />
      </motion.div>

      <div className="flex w-72 flex-col items-center gap-4">
        {mode === 'loading' ? (
          <>
            <span className="h-2 w-full border-2 border-fg/40 bg-ink p-px">
              <span
                className="block h-full origin-left bg-fg"
                style={{ transform: `scaleX(${Math.round(progress * 20) / 20})` }}
              />
            </span>
            <span className="font-mono text-lg uppercase tracking-widest text-fg/70">
              the lanterns are being lit…
            </span>
          </>
        ) : (
          <AnimatePresence>
            {ready && (
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEnter()
                }}
                className="flex flex-col items-center gap-2 font-mono uppercase tracking-widest text-fg [text-shadow:2px_2px_0_#000]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  className="text-2xl md:text-3xl"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: stepped(8) }}
                >
                  push the gate open
                </motion.span>
                <span className="text-base text-fg/60">
                  {sound ? 'sound on · headphones recommended' : 'sound is off'}
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  )
}

const longestRole = profile.roles.reduce((a, b) => (b.length > a.length ? b : a), '')

function Roles() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % profile.roles.length), 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <p className="flex items-center gap-2 font-mono text-xl uppercase tracking-widest text-fg/70 [text-shadow:2px_2px_0_#000] md:text-2xl">
      <span>i make</span>
      <span className="relative inline-grid h-[1.3em] items-center overflow-hidden">
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {longestRole}
        </span>
        <AnimatePresence initial={false}>
          <motion.span
            key={i}
            className="col-start-1 row-start-1 whitespace-nowrap text-left text-fg"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.4, ease: stepped(6) }}
          >
            {profile.roles[i]}
          </motion.span>
        </AnimatePresence>
      </span>
    </p>
  )
}
