import {
  type ApiClient,
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
import {
  ADD_PLAYER_MID_TOURNAMENT,
  BERGER_EXTRA,
  BLACK_WIN_WO_SCORING,
  CANCELLED_RESULT,
  CHESS4_SPECIAL,
  COMPENSATE_WEAK_PP,
  DOUBLE_WO_SCORING,
  MID_TOURNAMENT_TIEBREAK,
  PLACE_NUMBERING,
  POSTPONED_ONLY_ROUND,
  POSTPONED_SCORE,
  PPG2_TIEBREAKS,
  UNPAIR_REPAIR_CYCLE,
  WITHDRAWN_PLAYER,
} from './edge-cases-snapshots'
import { expect, test } from './fixtures'

function snapshotStanding(s: any) {
  return { place: s.place, name: s.name, score: s.score, tiebreaks: s.tiebreaks }
}

function snapshotStandingBasic(s: any) {
  return { place: s.place, name: s.name, score: s.score }
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

  test('POSTPONED pairing score vs display score', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'PostponedScore',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        selectedTiebreaks: ['Buchholz'],
      },
      players,
    )

    // Round 1: mix of results including POSTPONED
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResultsFromScript($, tid, 1, r1.games, {
      1: 'WHITE_WIN',
      2: 'BLACK_WIN',
      3: 'POSTPONED',
      4: 'DRAW',
    })

    const standingsR1 = await fetchStandings($, tid, 1)

    // Round 2: higher rated wins
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResults($, tid, 2, r2.games, HIGHER_RATED_WINS)

    const standingsR2 = await fetchStandings($, tid, 2)

    expect({
      standingsR1: standingsR1.map(snapshotStanding),
      standingsR2: standingsR2.map(snapshotStanding),
    }).toEqual(POSTPONED_SCORE)
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

  test('Tiebreaks with pointsPerGame=2', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'PPG2-tiebreaks',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        pointsPerGame: 2,
        selectedTiebreaks: ['Buchholz', 'Berger', 'Vinster'],
      },
      players,
    )

    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
      2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'WHITE_WIN', 4: 'DRAW' },
      3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN', 4: 'WHITE_WIN' },
    }

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    const standings = await fetchStandings($, tid, 3)
    expect(standings.map(snapshotStanding)).toEqual(PPG2_TIEBREAKS)
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

  test('Place numbering with ties — all draws', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'PlaceNumbering',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        selectedTiebreaks: [],
      },
      players,
    )

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, () => 'DRAW')
    }

    const standings = await fetchStandings($, tid, 3)
    expect(standings.map(snapshotStandingBasic)).toEqual(PLACE_NUMBERING)
  })

  test('Withdrawn player in standings', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const clubIds = await ensureClubs($, [{ name: 'SK Kungälv' }, { name: 'SK Linköping' }])

    const players: PlayerInput[] = [
      {
        lastName: 'Ödinson',
        firstName: 'Thor',
        ratingI: 2100,
        fideId: 9900001,
        federation: 'NOR',
        birthdate: '1990-11-30',
        clubIndex: clubIds[0],
      },
      {
        lastName: 'Läufeyson',
        firstName: 'Loki',
        ratingI: 1950,
        fideId: 9900002,
        federation: 'UKR',
        birthdate: '1990-01-12',
        clubIndex: clubIds[0],
      },
      {
        lastName: 'Järnsida',
        firstName: 'Björn',
        ratingI: 1800,
        fideId: 9900003,
        federation: 'SWE',
        birthdate: '1951-06-27',
        clubIndex: clubIds[0],
      },
      {
        lastName: 'Åskväder',
        firstName: 'Odin',
        ratingI: 1750,
        fideId: 0,
        federation: 'SWE',
        birthdate: '1985-03-15',
        clubIndex: clubIds[0],
      },
      {
        lastName: 'Stormöga',
        firstName: 'Frej',
        ratingI: 1600,
        fideId: 0,
        federation: 'SWE',
        birthdate: '1992-08-20',
        clubIndex: clubIds[1],
      },
      {
        lastName: 'Svärdhand',
        firstName: 'Tyr',
        ratingI: 1500,
        fideId: 0,
        federation: 'SWE',
        birthdate: '1988-12-01',
        clubIndex: clubIds[1],
      },
      {
        lastName: 'Stjärnljus',
        firstName: 'Freja',
        ratingI: 1400,
        fideId: 0,
        federation: 'SWE',
        sex: 'F',
        birthdate: '1995-04-10',
        clubIndex: clubIds[1],
      },
      {
        lastName: 'Nattskärm',
        firstName: 'Sigrid',
        ratingI: 1300,
        fideId: 0,
        federation: 'SWE',
        sex: 'F',
        birthdate: '1998-07-22',
        clubIndex: clubIds[1],
      },
    ]

    const { tid, addedPlayers } = await createTournament(
      $,
      {
        name: 'Withdrawn-player',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
        selectedTiebreaks: ['Buchholz'],
        city: 'Stockholm',
        startDate: '2025-06-01',
        endDate: '2025-06-04',
        chiefArbiter: 'Tor Blixtensson',
        timeControl: '90/40+30+30',
        federation: 'SWE',
        roundDates: [
          { round: 1, date: '2025-06-01' },
          { round: 2, date: '2025-06-02' },
          { round: 3, date: '2025-06-03' },
          { round: 4, date: '2025-06-04' },
        ],
      },
      players,
    )

    // Play rounds 1-2
    for (let r = 1; r <= 2; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    // Withdraw player 8 (Sigrid Nattskärm)
    const eva = addedPlayers[7]
    await $.put(`/api/tournaments/${tid}/players/${eva.id}`, {
      ...eva,
      withdrawnFromRound: 3,
    })

    // Play rounds 3-4
    for (let r = 3; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    const standings = await fetchStandings($, tid, 4)
    expect({
      standings: standings.map(snapshotStanding),
    }).toEqual(WITHDRAWN_PLAYER)
  })

  test('BLACK_WIN_WO scoring and tiebreaks', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'BlackWinWO',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        selectedTiebreaks: ['Buchholz', 'Berger', 'Vinster'],
      },
      players,
    )

    // Round 1: B1=BLACK_WIN_WO, B2=WHITE_WIN, B3=BLACK_WIN, B4=DRAW
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResultsFromScript($, tid, 1, r1.games, {
      1: 'BLACK_WIN_WO',
      2: 'WHITE_WIN',
      3: 'BLACK_WIN',
      4: 'DRAW',
    })

    // Round 2: higher rated wins
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResults($, tid, 2, r2.games, HIGHER_RATED_WINS)

    const standings = await fetchStandings($, tid, 2)
    expect(standings.map(snapshotStanding)).toEqual(BLACK_WIN_WO_SCORING)
  })

  test('CANCELLED result type', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'CancelledResult',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        selectedTiebreaks: ['Buchholz'],
      },
      players,
    )

    // Round 1: B1=CANCELLED, B2=WHITE_WIN, B3=BLACK_WIN, B4=DRAW
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResultsFromScript($, tid, 1, r1.games, {
      1: 'CANCELLED',
      2: 'WHITE_WIN',
      3: 'BLACK_WIN',
      4: 'DRAW',
    })

    const standingsR1 = await fetchStandings($, tid, 1)

    // Round 2: higher rated wins
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResults($, tid, 2, r2.games, HIGHER_RATED_WINS)

    const standingsR2 = await fetchStandings($, tid, 2)

    expect({
      standingsR1: standingsR1.map(snapshotStanding),
      standingsR2: standingsR2.map(snapshotStanding),
    }).toEqual(CANCELLED_RESULT)
  })

  test('Mid-tournament tiebreak addition', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'MidTiebreak',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        selectedTiebreaks: ['Buchholz'],
      },
      players,
    )

    // Play 3 rounds with HIGHER_RATED_WINS
    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    const standingsBefore = await fetchStandings($, tid, 3)

    // Add Berger + Vinster tiebreaks via PUT
    const tournament = await $.get(`/api/tournaments/${tid}`)
    await $.put(`/api/tournaments/${tid}`, {
      ...tournament,
      selectedTiebreaks: ['Buchholz', 'Berger', 'Vinster'],
    })

    const standingsAfter = await fetchStandings($, tid, 3)

    expect({
      standingsBefore: standingsBefore.map(snapshotStanding),
      standingsAfter: standingsAfter.map(snapshotStanding),
    }).toEqual(MID_TOURNAMENT_TIEBREAK)
  })

  test('Unpair-repair cycle (Monrad)', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'UnpairRepair',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
      },
      players,
    )

    // Play rounds 1-2
    for (let r = 1; r <= 2; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    // Pair round 3
    const r3 = await pairRound($, tid)
    expect(r3.roundNr).toBe(3)
    const pairingsBefore = r3.games.map((g: any) => ({
      boardNr: g.boardNr,
      white: g.whitePlayer?.name ?? '(bye)',
      black: g.blackPlayer?.name ?? '(bye)',
    }))

    // Unpair round 3
    await $.del(`/api/tournaments/${tid}/rounds/latest?confirm=true`)
    const roundsAfterUnpair = await $.get(`/api/tournaments/${tid}/rounds`)
    expect(roundsAfterUnpair.length).toBe(2)

    // Re-pair round 3
    const r3b = await pairRound($, tid)
    expect(r3b.roundNr).toBe(3)
    const pairingsAfter = r3b.games.map((g: any) => ({
      boardNr: g.boardNr,
      white: g.whitePlayer?.name ?? '(bye)',
      black: g.blackPlayer?.name ?? '(bye)',
    }))

    expect({
      pairingsBefore,
      pairingsAfter,
    }).toEqual(UNPAIR_REPAIR_CYCLE)
  })

  test('DOUBLE_WO scoring and tiebreaks', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'DoubleWO',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        selectedTiebreaks: ['Buchholz', 'Berger', 'Vinster'],
      },
      players,
    )

    // R1: B1=DOUBLE_WO, B2=WHITE_WIN, B3=BLACK_WIN, B4=DRAW
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResultsFromScript($, tid, 1, r1.games, {
      1: 'DOUBLE_WO',
      2: 'WHITE_WIN',
      3: 'BLACK_WIN',
      4: 'DRAW',
    })

    // R2: HIGHER_RATED_WINS
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResults($, tid, 2, r2.games, HIGHER_RATED_WINS)

    const standings = await fetchStandings($, tid, 2)
    expect(standings.map(snapshotStanding)).toEqual(DOUBLE_WO_SCORING)
  })

  test('Add player mid-tournament', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'AddPlayerMid',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
      },
      players,
    )

    // Pair R1, HIGHER_RATED_WINS
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

    // Add 5th player mid-tournament
    await $.post(`/api/tournaments/${tid}/players`, {
      firstName: 'Frej',
      lastName: 'Stormöga',
      ratingI: 1700,
      ratingN: 0,
      ratingQ: 0,
      ratingB: 0,
      ratingK: 0,
      ratingKQ: 0,
      ratingKB: 0,
      clubIndex: 0,
      title: '',
      sex: '',
      federation: 'SWE',
      fideId: 0,
      ssfId: 0,
      playerGroup: '',
      withdrawnFromRound: 0,
      manualTiebreak: 0,
    })

    // Pair R2 (5 players → odd → bye)
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResults($, tid, 2, r2.games, HIGHER_RATED_WINS)

    const r2Pairings = r2.games.map((g: any) => ({
      boardNr: g.boardNr,
      white: g.whitePlayer?.name ?? '(bye)',
      black: g.blackPlayer?.name ?? '(bye)',
    }))

    const standingsR2 = await fetchStandings($, tid, 2)
    expect({
      r2Pairings,
      standingsR2: standingsR2.map(snapshotStanding),
    }).toEqual(ADD_PLAYER_MID_TOURNAMENT)
  })

  test('POSTPONED-only round then pair next', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'PostponedOnly',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        selectedTiebreaks: ['Buchholz'],
      },
      players,
    )

    // R1: ALL 4 games POSTPONED
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResultsFromScript($, tid, 1, r1.games, {
      1: 'POSTPONED',
      2: 'POSTPONED',
      3: 'POSTPONED',
      4: 'POSTPONED',
    })

    const standingsR1 = await fetchStandings($, tid, 1)

    // R2 should succeed (POSTPONED counts as "has result")
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResults($, tid, 2, r2.games, HIGHER_RATED_WINS)

    const r2Pairings = r2.games.map((g: any) => ({
      boardNr: g.boardNr,
      white: g.whitePlayer?.name ?? '(bye)',
      black: g.blackPlayer?.name ?? '(bye)',
    }))

    const standingsR2 = await fetchStandings($, tid, 2)

    expect({
      standingsR1: standingsR1.map(snapshotStanding),
      r2Pairings,
      standingsR2: standingsR2.map(snapshotStanding),
    }).toEqual(POSTPONED_ONLY_ROUND)
  })
})
