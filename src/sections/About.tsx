import { motion, useScroll, useSpring } from 'motion/react'
import { useRef } from 'react'
import { SectionHeading } from '@/components/SectionHeading'
import { profile } from '@/content/profile'
import { timeline } from '@/content/timeline'
import { TextReveal } from '@/fx/TextReveal'

export function About() {
  const line = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({
    target: line,
    offset: ['start 80%', 'end 60%'],
  })
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <section id="about" className="section">
      <SectionHeading index="04" eyebrow="about me" title={`Hi, I'm ${profile.name}`} />
      <div className="grid gap-16 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {profile.bio.map((para, i) => (
            <TextReveal
              key={i}
              text={para}
              className={
                i === 0
                  ? 'font-display text-2xl font-medium leading-snug md:text-3xl'
                  : 'text-lg leading-relaxed text-fg-muted'
              }
            />
          ))}
        </div>

        <ol ref={line} className="relative flex flex-col gap-12 pl-10">
          <span className="absolute bottom-0 left-[7px] top-2 w-px bg-line" aria-hidden />
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-[7px] top-2 w-px origin-top"
            style={{ scaleY, background: 'var(--iri-gradient)' }}
          />
          {timeline.map((t) => (
            <motion.li
              key={t.when + t.title}
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '0px 0px -20% 0px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="absolute -left-10 top-1.5 h-[15px] w-[15px] rounded-full border border-line-strong bg-ink">
                <span className="absolute inset-[4px] rounded-full bg-chrome-2" />
              </span>
              <p className="font-mono text-xs text-fg-faint">{t.when}</p>
              <p className="mt-1 font-display text-xl font-semibold">{t.title}</p>
              <p className="mt-1 text-fg-muted">{t.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
