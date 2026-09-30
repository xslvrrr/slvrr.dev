import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useRef } from 'react'
import { SectionHeading } from '@/components/SectionHeading'
import { copy } from '@/content/copy'
import { profile } from '@/content/profile'
import { timeline } from '@/content/timeline'
import type { TimelineEntry } from '@/content/types'
import { ScrambleText } from '@/fx/ScrambleText'
import { TextReveal } from '@/fx/TextReveal'

export function About() {
  const line = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({
    target: line,
    offset: ['start 80%', 'end 60%'],
  })
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <section id="about" data-bg="about" className="section">
      <SectionHeading {...copy.sections.about} />
      <div className="grid gap-16 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {profile.bio.map((para, i) =>
            i === 0 ? (
              // The opening line decrypts itself as it scrolls in.
              <ScrambleText
                key={i}
                as="p"
                text={para}
                duration={1200}
                className="font-display text-2xl font-medium leading-snug md:text-3xl"
              />
            ) : (
              <TextReveal
                key={i}
                text={para}
                className="text-lg leading-relaxed text-fg-muted"
              />
            ),
          )}
        </div>

        <ol ref={line} className="relative flex flex-col gap-12 pl-10">
          <span className="absolute bottom-0 left-[7px] top-2 w-px bg-line" aria-hidden />
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-[7px] top-2 w-px origin-top"
            style={{ scaleY, background: 'var(--iri-gradient)' }}
          />
          {timeline.map((t, i) => (
            <TimelineItem
              key={t.when + t.title}
              entry={t}
              // Roughly where along the line this entry's dot sits (0–1).
              at={timeline.length > 1 ? i / (timeline.length - 1) : 0}
              progress={scaleY}
            />
          ))}
        </ol>
      </div>
    </section>
  )
}

/** A timeline entry whose dot lights up when the drawn line reaches it. */
function TimelineItem({
  entry,
  at,
  progress,
}: {
  entry: TimelineEntry
  at: number
  progress: MotionValue<number>
}) {
  const lit = useTransform(progress, [Math.max(0, at * 0.95 - 0.05), at * 0.95], [0, 1])
  const glow = useTransform(
    lit,
    (v) => `0 0 ${v * 14}px ${v * 3}px rgb(191 238 255 / ${v * 0.6})`,
  )

  return (
    <motion.li
      className="relative"
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '0px 0px -20% 0px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="absolute -left-10 top-1.5 h-[15px] w-[15px] rounded-full border border-line-strong bg-ink">
        <span className="absolute inset-[4px] rounded-full bg-chrome-3" />
        <motion.span
          className="absolute inset-[4px] rounded-full bg-iri-3"
          style={{ opacity: lit, boxShadow: glow }}
        />
      </span>
      <p className="font-mono text-xs text-fg-faint">{entry.when}</p>
      <p className="mt-1 font-display text-xl font-semibold">{entry.title}</p>
      <p className="mt-1 text-fg-muted">{entry.body}</p>
    </motion.li>
  )
}
