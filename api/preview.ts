/**
 * GET /api/preview?artist=<artist>&track=<track>
 * Finds a 30-second preview for a song (Deezer first, then iTunes; neither
 * needs a key). The audio URL points at /api/audio so the browser can read it
 * for the visualizer.
 */

interface Found {
  title: string
  artist: string
  cover: string | null
  link: string
  preview: string
}

const json = (body: unknown, status: number, cache: string) =>
  Response.json(body, { status, headers: { 'cache-control': cache } })

async function deezer(artist: string, track: string): Promise<Found | null> {
  const clean = (s: string) => s.replace(/"/g, '')
  for (const q of [
    `artist:"${clean(artist)}" track:"${clean(track)}"`,
    `${artist} ${track}`,
  ]) {
    try {
      const res = await fetch(
        `https://api.deezer.com/search?limit=5&q=${encodeURIComponent(q)}`,
      )
      if (!res.ok) continue
      const data = (await res.json()) as {
        data?: {
          title: string
          link: string
          preview: string
          artist: { name: string }
          album: { cover_big?: string }
        }[]
      }
      const hit = data.data?.find((d) => d.preview)
      if (hit) {
        return {
          title: hit.title,
          artist: hit.artist.name,
          cover: hit.album.cover_big ?? null,
          link: hit.link,
          preview: hit.preview,
        }
      }
    } catch {
      // try the next query / provider
    }
  }
  return null
}

async function itunes(artist: string, track: string): Promise<Found | null> {
  try {
    const term = encodeURIComponent(`${artist} ${track}`)
    const res = await fetch(
      `https://itunes.apple.com/search?entity=song&limit=5&term=${term}`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: {
        trackName: string
        artistName: string
        artworkUrl100?: string
        trackViewUrl: string
        previewUrl?: string
      }[]
    }
    const hit = data.results?.find((r) => r.previewUrl)
    if (!hit?.previewUrl) return null
    return {
      title: hit.trackName,
      artist: hit.artistName,
      cover: hit.artworkUrl100?.replace('100x100', '600x600') ?? null,
      link: hit.trackViewUrl,
      preview: hit.previewUrl,
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const artist = (params.get('artist') ?? '').trim().slice(0, 200)
  const track = (params.get('track') ?? '').trim().slice(0, 200)
  if (!artist || !track)
    return json({ error: 'artist and track are required' }, 400, 'no-store')

  const found = (await deezer(artist, track)) ?? (await itunes(artist, track))
  if (!found) return json({ error: 'no preview found' }, 404, 'public, s-maxage=1800')

  const { preview, ...rest } = found
  return json(
    { ...rest, audio: `/api/audio?src=${encodeURIComponent(preview)}` },
    200,
    // Deezer's preview links are signed and expire after a few hours.
    'public, s-maxage=1800, stale-while-revalidate=1800',
  )
}
