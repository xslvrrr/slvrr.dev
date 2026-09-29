/**
 * GET /api/lastfm?user=<lastfm username>
 * Proxies Last.fm's recent tracks so the API key stays server-side.
 * Needs LASTFM_API_KEY in the Vercel environment.
 */

interface LastfmTrack {
  name: string
  url: string
  artist: { '#text': string }
  album: { '#text': string }
  image: { size: string; '#text': string }[]
  date?: { uts: string }
  '@attr'?: { nowplaying?: string }
}

const json = (body: unknown, status = 200, cache = 'no-store') =>
  Response.json(body, { status, headers: { 'cache-control': cache } })

export async function GET(request: Request) {
  const user = new URL(request.url).searchParams.get('user') ?? ''
  const key = process.env.LASTFM_API_KEY

  if (!/^[\w-]{2,15}$/.test(user)) return json({ error: 'invalid user' }, 400)
  if (!key) return json({ error: 'LASTFM_API_KEY is not set' }, 503)

  const url = new URL('https://ws.audioscrobbler.com/2.0/')
  url.search = new URLSearchParams({
    method: 'user.getrecenttracks',
    user,
    api_key: key,
    format: 'json',
    limit: '1',
  }).toString()

  const res = await fetch(url)
  if (!res.ok) return json({ error: 'last.fm request failed' }, 502)

  const data = (await res.json()) as { recenttracks?: { track?: LastfmTrack[] } }
  const track = data.recenttracks?.track?.[0]
  if (!track) return json({ error: 'no tracks' }, 404)

  const art = track.image.at(-1)?.['#text'] || null

  return json(
    {
      playing: track['@attr']?.nowplaying === 'true',
      track: track.name,
      artist: track.artist['#text'],
      album: track.album['#text'],
      art,
      url: track.url,
      playedAt: track.date ? Number(track.date.uts) : null,
    },
    200,
    'public, s-maxage=10, stale-while-revalidate=30',
  )
}
