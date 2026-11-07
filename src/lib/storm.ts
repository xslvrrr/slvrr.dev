/**
 * Tiny event bus for lightning: anything can call `strike()` (the hero does on
 * click) and the night scene draws a bolt and flashes the sky.
 */
type Listener = (x: number, loud: boolean) => void
const listeners = new Set<Listener>()

/**
 * @param x where the bolt lands, as a fraction of the screen width (0 to 1)
 * @param loud whether it comes with a thunderclap (user-triggered strikes)
 */
export function strike(x = Math.random(), loud = false) {
  listeners.forEach((l) => l(x, loud))
}

export function onStrike(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
