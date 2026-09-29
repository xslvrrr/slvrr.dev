import { motion } from 'motion/react'
import { SectionHeading } from '@/components/SectionHeading'
import { projects } from '@/content/projects'
import { TiltCard } from '@/fx/TiltCard'
import { useRepoStats } from '@/hooks/useRepoStats'
import { sfx } from '@/lib/sfx'

export function Projects() {
  const stats = useRepoStats()

  return (
    <section id="work" className="section">
      <SectionHeading index="03" eyebrow="selected work" title="Things I've built" />
      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((p, i) => {
          const live = p.repo ? stats?.[p.repo] : undefined
          const href =
            p.href ?? live?.url ?? (p.repo ? `https://github.com/${p.repo}` : undefined)
          const card = (
            <TiltCard className="h-full">
              <div className="flex h-full min-h-64 flex-col gap-6 p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-xs text-fg-faint">
                    {String(i + 1).padStart(2, '0')} / {p.year}
                  </span>
                  {live && (
                    <span className="flex gap-3 font-mono text-xs text-fg-muted">
                      <span>★ {live.stars}</span>
                      {live.language && <span>{live.language}</span>}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {p.name}
                </h3>
                <p className="text-fg-muted">{p.blurb}</p>
                <ul className="mt-auto flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-fg-muted"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </TiltCard>
          )
          return (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              transition={{
                delay: (i % 2) * 0.12,
                duration: 0.9,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor="view"
                  onMouseEnter={sfx.tick}
                  className="block h-full"
                >
                  {card}
                </a>
              ) : (
                card
              )}
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
