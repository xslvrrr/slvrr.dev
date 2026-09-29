import { motion, type Variants } from 'motion/react'

const container: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.035 } },
}
const word: Variants = {
  hidden: { y: '110%', rotate: 4 },
  shown: { y: '0%', rotate: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
}

/** Words slide up from behind a mask as the text scrolls into view. */
export function TextReveal({
  text,
  as = 'p',
  className,
}: {
  text: string
  as?: 'p' | 'h1' | 'h2' | 'h3'
  className?: string
}) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      variants={container}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      aria-label={text}
    >
      {text.split(' ').map((w, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block overflow-hidden pb-[0.1em] align-top"
        >
          <motion.span data-word className="inline-block" variants={word}>
            {w}
            {' '}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}
