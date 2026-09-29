/** Reads a design token (e.g. "--color-iri-1") from :root at runtime. */
export function cssVar(name: string, fallback = '#ffffff') {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
