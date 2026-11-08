import { motion } from 'motion/react'
import { Link } from 'react-router'
import { notes } from '@/content/notes'
import { ScrambleText } from '@/fx/ScrambleText'
import { sfx } from '@/lib/sfx'

export function Notes() {
  return (
    // The graves: notes, like epitaphs.
    <ul className="border-t-2 border-line">
      {notes.map((n, i) => (
        <motion.li
          key={n.slug}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, duration: 0.6 }}
          className="border-b-2 border-line"
        >
          <Link
            to={`/notes/${n.slug}`}
            onMouseEnter={sfx.tick}
            data-cursor="read"
            className="group relative flex flex-col gap-2 overflow-hidden px-2 py-6"
          >
            <span
              aria-hidden
              className="absolute inset-0 -z-10 origin-bottom scale-y-0 bg-ink/70 transition-transform duration-300 ease-[steps(6)] group-hover:scale-y-100"
            />
            <ScrambleText
              as="time"
              trigger="hover"
              text={n.date}
              className="shrink-0 font-mono text-lg text-fg-muted"
            />
            <span className="chroma-hover font-display text-5xl leading-none group-hover:translate-x-3">
              {n.title}
            </span>
            <span className="text-fg-muted">{n.summary}</span>
          </Link>
        </motion.li>
      ))}
    </ul>
  )
}
