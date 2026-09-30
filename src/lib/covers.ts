/** Where a media item's cover lives (downloaded by `npm run covers`). */
export function coverPath(item: { title: string; by: string }) {
  const slug = `${item.by}-${item.title}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `/covers/${slug}.jpg`
}
