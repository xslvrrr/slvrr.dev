import { useSyncExternalStore } from 'react'

const query = '(hover: hover) and (pointer: fine)'

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(query)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

/** True on devices with a real mouse (enables cursor + hover-only effects). */
export function useFinePointer() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
