import { useMemo, useState } from 'react'
import { codeLength, verifyClubCode } from '../domain/club-codes'
import { CLUBLESS_KEY, filterGamesByClubs, redactPlayerName } from '../domain/club-filter'
import { useRound, useRounds } from '../hooks/useRounds'
import { useTournamentPlayers } from '../hooks/useTournamentPlayers'
import { useTournaments } from '../hooks/useTournaments'
import { setClubFilter, useClientP2PStore } from '../stores/client-p2p-store'
import type { PlayerDto } from '../types/api'
import { Dialog } from './dialogs/Dialog'

function buildFirstNameMap(players: PlayerDto[] | undefined): Map<number, string> {
  const map = new Map<number, string>()
  if (!players) return map
  for (const p of players) {
    map.set(p.id, p.firstName)
  }
  return map
}

export function SpectatorLayout() {
  const { clubFilter, shareMode } = useClientP2PStore()
  const [codeInput, setCodeInput] = useState('')
  const [showCodeDialog, setShowCodeDialog] = useState(true)

  const { data: tournaments } = useTournaments()
  const tournament = tournaments?.[0]
  const tournamentId = tournament?.id

  const { data: rounds } = useRounds(tournamentId)
  const latestRoundNr = rounds && rounds.length > 0 ? rounds[rounds.length - 1].roundNr : undefined

  const { data: roundData } = useRound(tournamentId, latestRoundNr)
  const { data: players } = useTournamentPlayers(tournamentId)

  const firstNameMap = useMemo(() => buildFirstNameMap(players), [players])

  const allClubs = useMemo(() => {
    const clubNames = [...new Set(players?.filter((p) => p.club).map((p) => p.club!))].sort()
    if (players?.some((p) => !p.club)) clubNames.push(CLUBLESS_KEY)
    return clubNames
  }, [players])

  const clubCodeSecret = tournament ? `${tournament.name}/${tournament.group}` : null

  const shouldShowDialog =
    showCodeDialog && shareMode === 'view' && !clubFilter && clubCodeSecret && allClubs.length > 0

  const expectedCodeLength = allClubs.length > 0 ? codeLength(allClubs.length) : 6
  const codeMidpoint = expectedCodeLength / 2

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, expectedCodeLength)
    if (digits.length <= codeMidpoint) {
      setCodeInput(digits)
    } else {
      setCodeInput(`${digits.slice(0, codeMidpoint)} ${digits.slice(codeMidpoint)}`)
    }
  }

  const handleCodeSubmit = () => {
    if (!clubCodeSecret || !codeInput.trim()) return
    const normalized = codeInput.trim().replace(/[-\s]/g, '').toUpperCase()
    const clubs = verifyClubCode(normalized, allClubs, clubCodeSecret)
    if (clubs) {
      setClubFilter(clubs)
      setShowCodeDialog(false)
    }
  }

  const games = useMemo(() => {
    if (!roundData?.games) return []
    if (!clubFilter) return roundData.games
    return filterGamesByClubs(roundData.games, clubFilter)
  }, [roundData, clubFilter])

  if (!tournament) {
    return (
      <div className="spectator-layout">
        <div className="spectator-empty">V\u00E4ntar p\u00E5 turneringsdata\u2026</div>
      </div>
    )
  }

  return (
    <div className="spectator-layout" data-testid="spectator-layout">
      <div className="spectator-header">
        <div className="spectator-header-top">
          <h2 className="spectator-title">{tournament.name}</h2>
          {latestRoundNr != null && <span className="spectator-round">Rond {latestRoundNr}</span>}
        </div>
        {clubFilter && (
          <span className="spectator-club-badge">
            {clubFilter.map((c) => (c === CLUBLESS_KEY ? 'Klubblösa' : c)).join(', ')}
          </span>
        )}
      </div>

      {games.length === 0 ? (
        <div className="spectator-empty">
          {latestRoundNr == null ? 'Ingen rond lottad \u00E4nnu.' : 'Inga lottningar att visa.'}
        </div>
      ) : (
        <table className="data-table spectator-table" data-testid="spectator-pairings">
          <thead>
            <tr>
              <th className="spectator-board-cell">#</th>
              <th>Vit</th>
              <th className="spectator-result-cell">Res.</th>
              <th>Svart</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => {
              const isBye = !game.whitePlayer || !game.blackPlayer
              const clubSet = clubFilter ? new Set(clubFilter) : null
              const whiteAuth =
                clubSet != null &&
                game.whitePlayer != null &&
                (game.whitePlayer.club != null
                  ? clubSet.has(game.whitePlayer.club)
                  : clubSet.has(CLUBLESS_KEY))
              const blackAuth =
                clubSet != null &&
                game.blackPlayer != null &&
                (game.blackPlayer.club != null
                  ? clubSet.has(game.blackPlayer.club)
                  : clubSet.has(CLUBLESS_KEY))
              return (
                <tr key={game.boardNr} className={isBye ? 'spectator-bye-row' : undefined}>
                  <td className="spectator-board-cell">{game.boardNr}</td>
                  <td className={whiteAuth ? 'spectator-club-player' : undefined}>
                    {clubFilter
                      ? redactPlayerName(game.whitePlayer, clubFilter, firstNameMap)
                      : (game.whitePlayer?.name ?? 'BYE')}
                  </td>
                  <td className="spectator-result-cell">{game.resultDisplay}</td>
                  <td className={blackAuth ? 'spectator-club-player' : undefined}>
                    {clubFilter
                      ? redactPlayerName(game.blackPlayer, clubFilter, firstNameMap)
                      : (game.blackPlayer?.name ?? 'BYE')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <Dialog
        title="Klubbkod"
        open={!!shouldShowDialog}
        onClose={() => setShowCodeDialog(false)}
        width={360}
        footer={
          <button
            className="btn btn-primary club-code-submit"
            data-testid="club-code-submit"
            onClick={handleCodeSubmit}
          >
            OK
          </button>
        }
      >
        <div className="club-code-dialog-body" data-testid="club-code-dialog">
          <p className="club-code-dialog-prompt">
            Ange klubbkod f&ouml;r att se dina spelares placeringar:
          </p>
          <input
            className="club-code-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]*"
            autoComplete="off"
            placeholder="### ###"
            value={codeInput}
            onChange={handleCodeChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCodeSubmit()
            }}
            autoFocus
          />
        </div>
      </Dialog>
    </div>
  )
}
