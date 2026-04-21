import { useEffect, useState } from 'react'
import {
  type ChangelogRelease,
  type ChangelogType,
  fetchChangelog,
  groupCommitsByType,
  releasesSince,
} from '../../domain/changelog'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
}

const GROUP_ICONS: Record<ChangelogType, string> = {
  feat: '✨',
  fix: '🐛',
  perf: '⚡',
}

function releaseHeading(release: ChangelogRelease): string {
  if (release.version === null) return 'Kommande'
  return release.date ? `v${release.version} (${release.date})` : `v${release.version}`
}

export function WhatsNewDialog({ open, onClose }: Props) {
  const [releases, setReleases] = useState<ChangelogRelease[] | null>(null)
  const [showOlder, setShowOlder] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setReleases(null)
    setShowOlder(false)
    fetchChangelog(import.meta.env.BASE_URL).then((data) => {
      if (!cancelled) setReleases(data)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const newer = releases ? releasesSince(releases, __GIT_TAG__) : []
  const hasOlder = releases !== null && releases.length > newer.length
  const visible = showOlder ? (releases ?? []) : newer

  return (
    <Dialog
      title="Vad är nytt"
      open={open}
      onClose={onClose}
      width={520}
      height={480}
      footer={
        <button className="btn" onClick={onClose}>
          Stäng
        </button>
      }
    >
      {releases === null && <p>Laddar ändringslogg…</p>}
      {releases !== null && visible.length === 0 && <p>Inga nya ändringar sedan din version.</p>}
      {visible.length > 0 && (
        <div className="changelog-archive">
          {visible.map((release) => (
            <section
              key={release.version ?? 'unreleased'}
              className="changelog-release"
              data-testid="changelog-release"
            >
              <h3>{releaseHeading(release)}</h3>
              {groupCommitsByType(release.commits).map((group) => (
                <div key={group.type} className="changelog-group" data-testid="changelog-group">
                  <h4>
                    <span className="changelog-group-icon" aria-hidden="true">
                      {GROUP_ICONS[group.type]}
                    </span>
                    {group.label}
                  </h4>
                  <ul>
                    {group.commits.map((commit) => (
                      <li key={commit.sha}>
                        {commit.breaking && <strong>Brytande ändring: </strong>}
                        {commit.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      {hasOlder && !showOlder && (
        <p className="changelog-show-older">
          <button
            type="button"
            className="changelog-show-older-link"
            onClick={() => setShowOlder(true)}
          >
            Visa tidigare versioner
          </button>
        </p>
      )}
    </Dialog>
  )
}
