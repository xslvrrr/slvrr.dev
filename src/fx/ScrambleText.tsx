import { useInView, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const GLYPHS = '▓░▒/\\_#<>*+'

/**
 * Decode effect: characters cycle through noise glyphs and resolve left to
 * right. Runs a short requestAnimationFrame loop only while decoding (~500ms).
 * Screen readers always get the real text.
 */
export function ScrambleText({
  text,
  trigger = 'view',
  duration = 520,
  as = 'span',
  className,
}: {
  text: string
  /** 'view': once when scrolled into view · 'hover': every hover · 'mount': on mount */
  trigger?: 'view' | 'hover' | 'mount'
  duration?: number
  as?: 'span' | 'p' | 'time'
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const still = useReducedMotion() ?? false
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  // Before decoding, show noise of the same length so the layout doesn't jump.
  const [shown, setShown] = useState(() =>
    trigger === 'hover' || still
      ? text
      : [...text]
          .map((c) => (c === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(''),
  )
  const raf = useRef(0)

  const run = useCallback(() => {
    if (still) return
    cancelAnimationFrame(raf.current)
    const start = performance.now()
    let lastSwap = 0
    const frame = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      // Swap noise glyphs ~30×/s rather than every frame (calmer, cheaper).
      if (t - lastSwap > 33 || p === 1) {
        lastSwap = t
        const solved = Math.floor(p * text.length)
        let out = text.slice(0, solved)
        for (let i = solved; i < text.length; i++) {
          out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]
        }
        setShown(out)
      }
      if (p < 1) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }, [text, duration, still])

  useEffect(() => {
    if (trigger === 'mount' || (trigger === 'view' && inView)) run()
  }, [trigger, inView, run])

  // Hover decodes when the surrounding link/button is hovered, not just the text.
  useEffect(() => {
    if (trigger !== 'hover') return
    const target = ref.current?.closest('a, button') ?? ref.current
    target?.addEventListener('mouseenter', run)
    return () => target?.removeEventListener('mouseenter', run)
  }, [trigger, run])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // All allowed tags share span's props; narrowing keeps the ref type simple.
  const Tag = as as 'span'
  return (
    <Tag ref={ref as RefObject<HTMLSpanElement>} aria-label={text} className={className}>
      <span aria-hidden>{shown || ' '}</span>
    </Tag>
  )
}
