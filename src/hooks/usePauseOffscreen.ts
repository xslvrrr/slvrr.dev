import { useEffect, type RefObject } from 'react'

/**
 * Marks an element with `data-offscreen` while it's out of view, which pauses
 * its infinite CSS animations (see `[data-offscreen]` in index.css).
 */
export function usePauseOffscreen(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) delete el.dataset.offscreen
      else el.dataset.offscreen = ''
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
}
