const listeners = new Set<() => void>()

/** Scroll back to the top behind the "rising water surface" sweep (see fx/Resurface). */
export function resurface() {
  listeners.forEach((l) => l())
}

export function onResurface(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
