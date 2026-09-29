/**
 * GET /api/github?repos=owner/a,owner/b
 * Returns live stats for up to 12 repos, cached at the edge for an hour.
 * GITHUB_TOKEN is optional and only raises the rate limit.
 */

interface GithubRepo {
  stargazers_count: number
  forks_count: number
  language: string | null
  description: string | null
  html_url: string
  pushed_at: string
}

const REPO = /^[\w.-]+\/[\w.-]+$/

export async function GET(request: Request) {
  const repos = (new URL(request.url).searchParams.get('repos') ?? '')
    .split(',')
    .filter((r) => REPO.test(r))
    .slice(0, 12)

  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'slvrr.dev',
  }
  if (process.env.GITHUB_TOKEN)
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  const entries = await Promise.all(
    repos.map(async (repo) => {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, { headers })
        if (!res.ok) return null
        const r = (await res.json()) as GithubRepo
        return [
          repo,
          {
            stars: r.stargazers_count,
            forks: r.forks_count,
            language: r.language,
            description: r.description,
            url: r.html_url,
            pushedAt: r.pushed_at,
          },
        ] as const
      } catch {
        return null
      }
    }),
  )

  return Response.json(Object.fromEntries(entries.filter((e) => e !== null)), {
    headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
