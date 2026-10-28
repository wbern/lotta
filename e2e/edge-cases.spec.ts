import {
  apiClient,
  createTournament,
  ensureClubs,
  fetchChess4Standings,
  fetchStandings,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  setResultsFromScript,
  waitForApi,
} from './api-helpers'
import { BERGER_EXTRA, CHESS4_SPECIAL, COMPENSATE_WEAK_PP } from './edge-cases-snapshots'
import { expect, test } from './fixtures'

function snapshotStanding(s: any) {
  return { place: s.place, name: s.name, score: s.score, tiebreaks: s.tiebreaks }
}

test.describe('Edge cases', () => {
  test('Compensate weak player PP', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Stark', firstName: 'S', ratingI: 2000 },
      { lastName: 'Medel', firstName: 'M', ratingI: 1700 },
      { lastName: 'Svag', firstName: 'V', ratingI: 1500 },
      { lastName: 'Svagast', firstName: 'W', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'CompensateWeakPP',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        compensateWeakPlayerPP: true,
      },
      players,
    )

    // Round 1: higher rated wins
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

    // Round 2: all POSTPONED
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResultsFromScript(
      $,
      tid,
      2,
      r2.games,
      Object.fromEntries(
        r2.games
          .filter((g: any) => g.whitePlayer && g.blackPlayer)
          .map((g: any) => [g.boardNr, 'POSTPONED']),
      ),
    )

    const standingsR2 = await fetchStandings($, tid, 2)

    // Round 3: higher rated wins
    const r3 = await pairRound($, tid)
    expect(r3.roundNr).toBe(3)

    const r3Pairings = r3.games.map((g: any) => ({
      boardNr: g.boardNr,
      white: g.whitePlayer?.name ?? '(bye)',
      black: g.blackPlayer?.name ?? '(bye)',
    }))

    await setResults($, tid, 3, r3.games, HIGHER_RATED_WINS)
    const standingsR3 = await fetchStandings($, tid, 3)

    expect({
      standingsR2: standingsR2.map(snapshotStanding),
      r3Pairings,
      standingsR3: standingsR3.map(snapshotStanding),
    }).toEqual(COMPENSATE_WEAK_PP)
  })

  test('Chess4 + special results', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const clubIds = await ensureClubs($, [
      { name: 'SK Alfa', chess4Members: 12 },
      { name: 'SK Beta', chess4Members: 8 },
      { name: 'SK Gamma', chess4Members: 15 },
      { name: 'SK Delta', chess4Members: 10 },
    ])

    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, clubIndex: clubIds[0] },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, clubIndex: clubIds[0] },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, clubIndex: clubIds[1] },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, clubIndex: clubIds[1] },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600, clubIndex: clubIds[2] },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500, clubIndex: clubIds[2] },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400, clubIndex: clubIds[3] },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300, clubIndex: clubIds[3] },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Chess4-special',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        chess4: true,
        pointsPerGame: 4,
      },
      players,
    )

    // Round 1: special results
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResultsFromScript($, tid, 1, r1.games, {
      1: 'WHITE_WIN',
      2: 'WHITE_WIN_WO',
      3: 'DOUBLE_WO',
      4: 'DRAW',
    })

    const round1 = await $.get(`/api/tournaments/${tid}/rounds/1`)
    const gameDtos = round1.games.map((g: any) => ({
      boardNr: g.boardNr,
      resultType: g.resultType,
      whiteScore: g.whiteScore,
      blackScore: g.blackScore,
    }))

    const chess4Standings = await fetchChess4Standings($, tid, 1)
    const chess4Snapshot = chess4Standings.map((s: any) => ({
      place: s.place,
      club: s.club,
      playerCount: s.playerCount,
      chess4Members: s.chess4Members,
      score: s.score,
    }))

    expect({
      gameDtos,
      chess4Standings: chess4Snapshot,
    }).toEqual(CHESS4_SPECIAL)
  })

  test('Berger extra rounds + unpair-all', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1800 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1700 },
      { lastName: 'Epsilon', firstName: 'E', ratingI: 1600 },
      { lastName: 'Zeta', firstName: 'F', ratingI: 1500 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Berger-extra',
        pairingSystem: 'Berger',
        nrOfRounds: 7,
      },
      players,
    )

    // Berger pairs all rounds at once
    await $.post(`/api/tournaments/${tid}/pair?confirm=true`)

    const rounds = await $.get(`/api/tournaments/${tid}/rounds`)
    const allPairings = rounds.map((r: any) => ({
      roundNr: r.roundNr,
      games: r.games.map((g: any) => ({
        boardNr: g.boardNr,
        white: g.whitePlayer?.name ?? '(bye)',
        black: g.blackPlayer?.name ?? '(bye)',
      })),
    }))

    // Unpair — Berger unpair removes ALL rounds
    await $.del(`/api/tournaments/${tid}/rounds/latest?confirm=true`)
    const roundsAfterUnpair = await $.get(`/api/tournaments/${tid}/rounds`)

    expect({
      pairings: allPairings,
      roundCountAfterUnpair: roundsAfterUnpair.length,
    }).toEqual(BERGER_EXTRA)
  })
})
