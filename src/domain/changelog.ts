export type ChangelogType = 'feat' | 'fix' | 'perf'

export interface ChangelogCommit {
  sha: string
  type: ChangelogType
  scope: string | null
  breaking: boolean
  message: string
}

export interface ChangelogRelease {
  /** `null` on the leading "unreleased" bucket for commits after the newest tag. */
  version: string | null
  /** ISO date (YYYY-MM-DD) of the tag. `null` when unreleased. */
  date: string | null
  commits: ChangelogCommit[]
}

interface ChangelogTypeGroup {
  type: ChangelogType
  label: string
  commits: ChangelogCommit[]
}

const GROUP_LABELS: Record<ChangelogType, string> = {
  feat: 'Nyheter',
  fix: 'Buggfixar',
  perf: 'Förbättringar',
}

const GROUP_ORDER: ChangelogType[] = ['feat', 'fix', 'perf']

interface Semver {
  major: number
  minor: number
  patch: number
  pre: string | null
}

function parseSemver(s: string): Semver | null {
  const m = s.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null }
}

/** Returns negative if a<b, positive if a>b, zero if equal. Handles prereleases. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  if (pa.pre === null && pb.pre === null) return 0
  if (pa.pre === null) return 1
  if (pb.pre === null) return -1
  return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0
}

/**
 * Releases newer than the running build. The unreleased bucket (version null)
 * is always surfaced since it represents commits past the newest tag. Empty
 * `currentVersion` (dev server, untagged checkout) collapses to the unreleased
 * bucket only — we don't know where the user is, so labelling the archive as
 * "new" would be misleading. Users can still click "Visa tidigare versioner"
 * to expand the full history.
 */
export function releasesSince(
  releases: ChangelogRelease[],
  currentVersion: string,
): ChangelogRelease[] {
  const cv = currentVersion.replace(/^v/, '')
  if (!cv) return releases.filter((r) => r.version === null)
  return releases.filter((r) => r.version === null || compareSemver(r.version, cv) > 0)
}

/** Groups commits by conventional-commit type in feat → fix → perf order. */
export function groupCommitsByType(commits: ChangelogCommit[]): ChangelogTypeGroup[] {
  const byType = new Map<ChangelogType, ChangelogCommit[]>()
  for (const commit of commits) {
    const bucket = byType.get(commit.type) ?? []
    bucket.push(commit)
    byType.set(commit.type, bucket)
  }
  return GROUP_ORDER.flatMap((type) => {
    const bucket = byType.get(type)
    return bucket && bucket.length > 0 ? [{ type, label: GROUP_LABELS[type], commits: bucket }] : []
  })
}

export async function fetchChangelog(baseUrl: string): Promise<ChangelogRelease[]> {
  try {
    const response = await fetch(`${baseUrl}changelog.json?t=${Date.now()}`)
    if (!response.ok) return []
    const data = (await response.json()) as ChangelogRelease[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
