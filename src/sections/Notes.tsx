import { motion } from 'motion/react'
import { Link } from 'react-router'
import { copy } from '@/content/copy'
import { SectionHeading } from '@/components/SectionHeading'
import { notes } from '@/content/notes'
import { sfx } from '@/lib/sfx'

export function Notes() {
  return (
    <section id="notes" data-bg="notes" className="section">
      <SectionHeading {...copy.sections.notes} />
      <ul className="border-t border-line">
        {notes.map((n, i) => (
          <motion.li
            key={n.slug}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.6 }}
            className="border-b border-line"
          >
            <Link
              to={`/notes/${n.slug}`}
              onMouseEnter={sfx.tick}
              data-cursor="read"
              className="group relative flex flex-col gap-2 overflow-hidden py-8 md:flex-row md:items-baseline md:gap-10"
            >
              <span
                aria-hidden
                className="absolute inset-0 -z-10 origin-bottom scale-y-0 bg-white/[0.03] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-y-100"
              />
              <time className="shrink-0 font-mono text-xs text-fg-faint md:w-32">
                {n.date}
              </time>
              <span className="font-display text-2xl font-semibold transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-3 md:text-4xl">
                {n.title}
              </span>
              <span className="text-fg-muted md:ml-auto md:max-w-sm md:text-right">
                {n.summary}
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
