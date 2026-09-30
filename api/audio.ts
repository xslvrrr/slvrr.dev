/**
 * GET /api/audio?src=<preview url>
 * Same-origin pass-through for 30-second previews, so the page's Web Audio
 * visualizer can read the samples (cross-origin audio can't be analysed).
 * Only preview CDNs are allowed, so this can't be used as an open proxy.
 */

const ALLOWED_HOSTS = [
  /(^|\.)dzcdn\.net$/,
  /(^|\.)itunes\.apple\.com$/,
  /(^|\.)mzstatic\.com$/,
]

export async function GET(request: Request) {
  let src: URL
  try {
    src = new URL(new URL(request.url).searchParams.get('src') ?? '')
  } catch {
    return new Response('bad src', { status: 400 })
  }
  if (src.protocol !== 'https:' || !ALLOWED_HOSTS.some((re) => re.test(src.hostname))) {
    return new Response('host not allowed', { status: 403 })
  }

  // Pass Range through: Safari needs partial responses to play media.
  const range = request.headers.get('range')
  const upstream = await fetch(src, { headers: range ? { range } : {} })
  if (!upstream.ok && upstream.status !== 206) {
    return new Response('upstream error', { status: 502 })
  }

  const headers = new Headers({
    // Never let the CDN cache a partial (206) response under the plain URL.
    'cache-control': upstream.status === 206 ? 'no-store' : 'public, s-maxage=3600',
  })
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}
