import { motion } from 'motion/react'
import { useEffect } from 'react'
import { sfx } from '@/lib/sfx'
import { stickies } from './interact'

/**
 * A sticky note from the shrine's fence, up close. Arrows (or A/D) go through
 * them in order; Esc or E puts it back.
 */
export function StickyZoom({
  index,
  onChange,
  onClose,
}: {
  index: number
  onChange: (i: number) => void
  onClose: () => void
}) {
  const s = stickies[index]
  const n = stickies.length
  const go = (d: number) => {
    const next = (index + d + n) % n
    sfx.turn()
    onChange(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'KeyD'].includes(e.code)) go(1)
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) go(-1)
      else if (['Escape', 'KeyE'].includes(e.code)) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.article
        key={index}
        onClick={(e) => e.stopPropagation()}
        className="sticky-note relative flex aspect-square w-[min(88vw,26rem)] flex-col gap-3 p-7 text-[#2b2414]"
        initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: index % 2 ? 1.5 : -1.5, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <span className="absolute right-5 top-4 font-mono text-2xl text-[#7a2020]">
          {index + 1}
        </span>
        {s.when && (
          <p className="font-mono text-2xl leading-none text-[#5a4c28]">{s.when}</p>
        )}
        {s.title && <h2 className="font-display text-5xl leading-none">{s.title}</h2>}
        <p className={s.title ? 'text-xl leading-snug' : 'mt-4 text-2xl leading-snug'}>
          {s.body}
        </p>
        <div className="mt-auto flex items-center justify-between font-mono text-xl text-[#4a3f22]">
          <button
            type="button"
            onClick={() => go(-1)}
            className="px-2 hover:text-black"
            aria-label="Previous note"
          >
            ← prev
          </button>
          <span>
            {index + 1} / {n}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            className="px-2 hover:text-black"
            aria-label="Next note"
          >
            next →
          </button>
        </div>
      </motion.article>
      <p className="pointer-events-none fixed bottom-6 font-mono text-lg uppercase tracking-wider text-fg/70">
        [esc] put it back
      </p>
    </motion.div>
  )
}
