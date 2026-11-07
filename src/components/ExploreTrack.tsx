import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { explore, useExplore } from '@/lib/explore'

/**
 * Turns vertical scrolling into a walk sideways through the garden. The
 * sections sit side by side on a strip inside a sticky, screen-sized window;
 * the outer box is as tall as the strip is wide, so scrolling down moves the
 * strip left. Below the `explore` breakpoint it's a plain vertical stack.
 *
 * Elements inside the strip can't use `position: fixed` (the transform makes
 * them relative to the strip), so overlays are portalled to the body.
 */
export function ExploreTrack({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const active = useExplore()

  useLayoutEffect(() => {
    const o = outer.current
    const t = track.current
    if (!o || !t) return
    const announce = () => window.dispatchEvent(new Event('explore:layout'))
    if (!active) {
      o.style.height = ''
      t.style.transform = ''
      explore.track = null
      announce()
      return
    }

    const apply = () => {
      const x = Math.min(explore.maxX, Math.max(0, window.scrollY - explore.outerTop))
      t.style.transform = `translate3d(${-x}px, 0, 0)`
    }
    const measure = () => {
      const maxX = Math.max(0, t.scrollWidth - window.innerWidth)
      o.style.height = `${maxX + window.innerHeight}px`
      explore.outerTop = o.getBoundingClientRect().top + window.scrollY
      explore.maxX = maxX
      apply()
      announce()
    }

    explore.track = t
    const ro = new ResizeObserver(measure)
    ro.observe(t)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', apply, { passive: true })
    measure()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', apply)
      explore.track = null
    }
  }, [active])

  return (
    <div ref={outer} className="relative">
      <div className="explore:sticky explore:top-0 explore:h-svh explore:overflow-clip">
        <div
          ref={track}
          data-track
          className="explore:flex explore:h-full explore:w-max explore:will-change-transform"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * An empty column in a section where its landmark (a statue, the fountain...)
 * stands in the garden behind. Only takes up space while exploring.
 */
export function Landmark({ className = 'w-[24vw]' }: { className?: string }) {
  return (
    <div
      data-anchor
      aria-hidden
      className={`hidden shrink-0 self-stretch explore:block ${className}`}
    />
  )
}
