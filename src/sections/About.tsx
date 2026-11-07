import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useEffect, useRef } from 'react'
import { Landmark } from '@/components/ExploreTrack'
import { SectionHeading } from '@/components/SectionHeading'
import { copy } from '@/content/copy'
import { profile } from '@/content/profile'
import { timeline } from '@/content/timeline'
import type { TimelineEntry } from '@/content/types'
import { ScrambleText } from '@/fx/ScrambleText'
import { TextReveal } from '@/fx/TextReveal'
import { useExplore } from '@/lib/explore'

export function About() {
  const line = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({
    target: line,
    offset: ['start 80%', 'end 60%'],
  })
  // While exploring sideways, the line draws itself once it comes into view.
  const exploring = useExplore()
  const seen = useInView(line, { once: true, margin: '0px 0px -20% 0px' })
  const drawn = useMotionValue(0)
  useEffect(() => {
    if (!exploring || !seen) return
    const run = animate(drawn, 1, { duration: 1.8, ease: 'easeInOut', delay: 0.3 })
    return () => run.stop()
  }, [exploring, seen, drawn])
  const scaleY = useSpring(exploring ? drawn : scrollYProgress, {
    stiffness: 120,
    damping: 30,
  })

  return (
    // A wayside shrine, with a monk keeping watch: the confessional.
    <section id="about" data-bg="about" data-landmark="shrine" className="section">
      <SectionHeading {...copy.sections.about} />
      <div className="grid gap-16 lg:grid-cols-2 explore:flex explore:items-start explore:gap-0">
        <div className="flex flex-col gap-6 explore:w-[34vw]">
          {profile.bio.map((para, i) =>
            i === 0 ? (
              // The opening line decrypts itself as it scrolls in.
              <ScrambleText
                key={i}
                as="p"
                text={para}
                duration={1200}
                className="text-2xl font-medium leading-snug text-fg md:text-3xl"
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

        <Landmark className="w-[30vw]" />
        <ol ref={line} className="relative flex flex-col gap-12 pl-10 explore:w-[26vw]">
          <span className="absolute bottom-0 left-[7px] top-2 w-px bg-line" aria-hidden />
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-[7px] top-2 w-px origin-top"
            style={{ scaleY, background: 'var(--glass-gradient)' }}
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
    (v) => `0 0 ${v * 14}px ${v * 3}px rgb(240 240 236 / ${v * 0.5})`,
  )

  return (
    <motion.li
      className="relative"
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '0px 0px -20% 0px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="absolute -left-10 top-1.5 h-[15px] w-[15px] rotate-45 border-2 border-line-strong bg-ink">
        <span className="absolute inset-[3px] bg-stone-4" />
        <motion.span
          className="absolute inset-[3px] bg-glass-1"
          style={{ opacity: lit, boxShadow: glow }}
        />
      </span>
      <p className="font-mono text-[10px] text-glass-1/80">{entry.when}</p>
      <p className="mt-1 font-display text-3xl leading-tight">{entry.title}</p>
      <p className="mt-1 text-fg-muted">{entry.body}</p>
    </motion.li>
  )
}
