/** "just now", "4m ago", "3h ago", "2d ago" from a Unix timestamp in seconds. */
export function timeAgo(uts: number | null) {
  if (!uts) return 'a while ago'
  const s = Math.max(0, Date.now() / 1000 - uts)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
