import { useEffect, useState } from 'react'

/**
 * Fetches JSON from `url` (and again every `intervalMs` if given).
 * Returns null until the first success and keeps the last good value on errors,
 * so widgets can fall back to static content.
 */
export function usePoll<T>(url: string | null, intervalMs?: number): T | null {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    if (!url) return
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const json = (await res.json()) as T
        if (alive) setData(json)
      } catch {
        // network failures keep the previous value
      }
    }
    load()
    const id = intervalMs ? window.setInterval(load, intervalMs) : undefined
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [url, intervalMs])

  return data
}
