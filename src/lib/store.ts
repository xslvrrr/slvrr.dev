import { useSyncExternalStore } from 'react'

/** Tiny global store: enough for a handful of site-wide flags. */
export function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

export type Mode = 'chrome' | 'mercury'

export const modeStore = createStore<Mode>('chrome')
export const soundStore = createStore<boolean>(readSound())
/** Whether the splash gate has been passed (remembered for the browser session). */
export const enteredStore = createStore<boolean>(readEntered())

modeStore.subscribe(() => {
  document.documentElement.dataset.mode = modeStore.get()
})
enteredStore.subscribe(() => {
  try {
    if (enteredStore.get()) sessionStorage.setItem('slvrr:entered', '1')
  } catch {
    // ignore storage errors
  }
})
soundStore.subscribe(() => {
  try {
    localStorage.setItem('slvrr:sound', soundStore.get() ? '1' : '0')
  } catch {
    // storage can be unavailable (private mode); sound just won't persist
  }
})

function readEntered() {
  try {
    return sessionStorage.getItem('slvrr:entered') === '1'
  } catch {
    return false
  }
}

function readSound() {
  try {
    return localStorage.getItem('slvrr:sound') !== '0'
  } catch {
    return true
  }
}

export function useStore<T>(store: ReturnType<typeof createStore<T>>) {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
