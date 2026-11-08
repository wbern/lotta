import { sv } from '../lib/swedish-text'

interface Props {
  round: number | undefined
  latestRound: number | undefined
  onShowLatest: () => void
}

/**
 * Warns that a standings view is cut off at an earlier round than the latest
 * one, since the round selector is global and easy to leave behind. Renders
 * nothing when the latest round is shown: the selector and status bar already
 * say which round that is.
 */
export function StandingsCaption({ round, latestRound, onShowLatest }: Props) {
  if (round == null || latestRound == null || round >= latestRound) return null
  return (
    <div className="standings-caption" data-testid="standings-caption">
      <span>{sv.standings.afterRound(round)}</span>
      <button
        type="button"
        className="standings-caption-link"
        data-testid="standings-show-latest"
        onClick={onShowLatest}
      >
        {sv.standings.showLatest(latestRound)}
      </button>
    </div>
  )
}
