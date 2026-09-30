// Downloads cover art for every item in src/content/media.ts into public/covers/.
// Usage: npm run covers  (existing files are kept; delete one to re-fetch it)
//
// Sources, in order: the item's `art` URL, Spotify's public oEmbed for
// open.spotify.com links (no API key needed), YouTube thumbnails for videos.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { media } from '../src/content/media.ts'
import { coverPath } from '../src/lib/covers.ts'

const root = new URL('../public', import.meta.url)

async function artFor(item) {
  if (item.art) return item.art
  const href = item.href ?? ''
  if (href.includes('open.spotify.com/')) {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(href)}`,
    )
    if (!res.ok) throw new Error(`spotify oembed ${res.status}`)
    const { thumbnail_url } = await res.json()
    // oEmbed gives the 300px image; the same id with this prefix is 640px.
    return thumbnail_url.replace(/ab67616d[0-9a-f]{8}/, 'ab67616d0000b273')
  }
  const yt = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`
  return null
}

mkdirSync(new URL('./covers', root + '/'), { recursive: true })
let failed = 0
for (const item of media) {
  const out = new URL('.' + coverPath(item), root + '/')
  const name = `${item.by} – ${item.title}`
  if (item.swatch) {
    console.log(`■ ${name} (flat colour, no image needed)`)
    continue
  }
  if (existsSync(out)) {
    console.log(`✓ ${name} (exists)`)
    continue
  }
  try {
    const url = await artFor(item)
    if (!url) throw new Error('no source: add an `art` URL to this item')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download ${res.status}`)
    writeFileSync(out, Buffer.from(await res.arrayBuffer()))
    console.log(`↓ ${name} → public${coverPath(item)}`)
  } catch (err) {
    failed++
    console.warn(`✗ ${name}: ${err.message}`)
  }
}
process.exitCode = failed ? 1 : 0
