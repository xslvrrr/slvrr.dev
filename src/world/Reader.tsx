import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { ErrorBoundary as Safe } from '@/components/ErrorBoundary'
import { copy } from '@/content/copy'
import { About } from '@/sections/About'
import { Footer } from '@/sections/Footer'
import { Links } from '@/sections/Links'
import { Notes } from '@/sections/Notes'
import { NowPlaying } from '@/sections/NowPlaying'
import { Projects } from '@/sections/Projects'
import { sfx } from '@/lib/sfx'
import type { SectionId } from './stations'

const views: Record<Exclude<SectionId, 'hero'>, () => React.JSX.Element> = {
  links: Links,
  music: NowPlaying,
  work: Projects,
  about: About,
  notes: Notes,
  footer: Footer,
}

/**
 * What you see when you look at something: its section, in a panel beside it
 * (below it on phones). Esc, the close button, or clicking the world steps
 * you back onto the path.
 */
export function Reader({
  section,
  onClose,
}: {
  section: Exclude<SectionId, 'hero'>
  onClose: () => void
}) {
  const View = views[section]
  const head = copy.sections[section]
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
  }, [])

  return (
    <motion.aside
      ref={panel}
      tabIndex={-1}
      data-reader
      aria-label={head.title}
      className="reader panel fixed z-40 overflow-y-auto overscroll-contain px-5 pb-8 pt-5 outline-none"
      initial={{ opacity: 0, x: 40, clipPath: 'inset(0 0 100% 0)' }}
      animate={{
        opacity: 1,
        x: 0,
        clipPath: 'inset(0 0 0% 0)',
        transition: {
          duration: 0.55,
          ease: (t) => Math.round((1 - (1 - t) ** 3) * 12) / 12,
        },
      }}
      exit={{ opacity: 0, x: 30, transition: { duration: 0.25 } }}
    >
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow flex items-center gap-3">
            <span className="text-fg">{head.index}</span>
            <span className="h-px w-8 bg-fg/30" aria-hidden />
            {head.eyebrow}
          </p>
          <h2 className="section-title">{head.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            sfx.click()
            onClose()
          }}
          onMouseEnter={sfx.tick}
          data-cursor="back"
          className="pixel-btn shrink-0 px-3 py-1.5 font-mono text-lg uppercase tracking-wider text-fg-muted hover:text-fg"
        >
          step back <span className="hidden text-fg-faint sm:inline">[esc]</span>
        </button>
      </header>
      <Safe>
        <View />
      </Safe>
    </motion.aside>
  )
}
