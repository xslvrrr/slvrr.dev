import { motion } from 'motion/react'
import type { ReactNode } from 'react'

const ease = [0.65, 0, 0.35, 1] as const

/**
 * Reveals its content top-to-bottom behind a bright ice scan line, once, when
 * scrolled into view. The clip leaves a margin at the end so tilting content
 * isn't cut off.
 */
export function ScanReveal({
  children,
  delay = 0,
}: {
  children: ReactNode
  delay?: number
}) {
  return (
    <motion.div
      className="relative h-full"
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      <motion.div
        className="h-full"
        variants={{
          hidden: { clipPath: 'inset(-10% -10% 110% -10%)' },
          shown: {
            clipPath: 'inset(-10% -10% -10% -10%)',
            transition: { duration: 1, delay, ease },
          },
        }}
      >
        {children}
      </motion.div>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px bg-iri-1 shadow-[0_0_18px_3px_rgb(191_238_255/0.55)]"
        variants={{
          hidden: { top: '0%', opacity: 0 },
          shown: {
            top: ['0%', '100%'],
            opacity: [1, 1, 0],
            transition: { duration: 1, delay, ease, times: [0, 0.85, 1] },
          },
        }}
      />
    </motion.div>
  )
}
