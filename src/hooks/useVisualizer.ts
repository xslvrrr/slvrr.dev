import { useEffect, type RefObject } from 'react'
import { getAnalyser } from '@/lib/player'

/**
 * Drives a row of bar elements from the listen-along audio. Writes `scaleY`
 * straight to the DOM (no React renders) and only runs while `active` and the
 * tab is visible.
 */
export function useVisualizer(container: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const root = container.current
    if (!active || !root) return
    const bars = [...root.querySelectorAll<HTMLElement>('[data-bar]')]
    const analyser = getAnalyser()
    if (!analyser || !bars.length) return

    const data = new Uint8Array(analyser.frequencyBinCount)
    // Log-spaced bins so bass doesn't hog every bar (music energy is roughly
    // logarithmic in frequency); the top bins are mostly empty on previews.
    const lo = 1
    const hi = Math.floor(data.length * 0.75)
    const bins = bars.map((_, i) =>
      Math.round(lo * Math.pow(hi / lo, i / Math.max(1, bars.length - 1))),
    )
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      analyser.getByteFrequencyData(data)
      bars.forEach((bar, i) => {
        const v = data[bins[i]] / 255
        bar.style.transform = `scaleY(${Math.max(0.08, v * v * 1.1).toFixed(3)})`
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      bars.forEach((bar) => (bar.style.transform = ''))
    }
  }, [container, active])
}
