import { projects } from '@/content/projects'
import type { RepoStats } from '@/lib/types'
import { usePoll } from '@/lib/usePoll'

const repos = projects.flatMap((p) => (p.repo ? [p.repo] : []))

export function useRepoStats() {
  return usePoll<Record<string, RepoStats>>(
    repos.length ? `/api/github?repos=${encodeURIComponent(repos.join(','))}` : null,
  )
}
