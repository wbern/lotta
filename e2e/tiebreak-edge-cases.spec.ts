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
import { expect, test } from './fixtures'
import {
  CHESS4_CLUB_SCALING,
  INBORDES_MOTE,
  MEDIAN_BUCHHOLZ_2R,
  PRESTATIONSRATING_LASK,
  PROGRESSIVE_TIEBREAK,
  QUICK_THEN_ELO,
  SSF_BUCHHOLZ_BYES,
  SVARTA_PARTIER,
  TIEBREAK_BYES_WO,
  VINSTER_WO,
} from './tiebreak-edge-cases-snapshots'

function snapshotStanding(s: any) {
  return { place: s.place, name: s.name, score: s.score, tiebreaks: s.tiebreaks }
}

test.describe('Tiebreak edge cases', () => {
  test('Tiebreaks with byes and walkovers', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    // 7 players (odd number -> bye)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Tiebreak-byes-wo',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
        selectedTiebreaks: ['Buchholz', 'SSF Buchholz', 'Median Buchholz', 'Berger', 'Vinster'],
      },
      players,
    )

    // Round 1: higher rated wins
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

    // Round 2: B1=WHITE_WIN_WO, rest=HIGHER_RATED_WINS
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    const r2Script: Record<number, string> = {}
    for (const g of r2.games) {
      if (!g.whitePlayer || !g.blackPlayer) continue
      if (g.boardNr === 1) {
        r2Script[g.boardNr] = 'WHITE_WIN_WO'
      } else {
        r2Script[g.boardNr] = HIGHER_RATED_WINS(g)
      }
    }
    await setResultsFromScript($, tid, 2, r2.games, r2Script)

    // Round 3: higher rated wins
    const r3 = await pairRound($, tid)
    expect(r3.roundNr).toBe(3)
    await setResults($, tid, 3, r3.games, HIGHER_RATED_WINS)

    // Round 4: B1=DRAW, rest=HIGHER_RATED_WINS
    const r4 = await pairRound($, tid)
    expect(r4.roundNr).toBe(4)
    const r4Script: Record<number, string> = {}
    for (const g of r4.games) {
      if (!g.whitePlayer || !g.blackPlayer) continue
      if (g.boardNr === 1) {
        r4Script[g.boardNr] = 'DRAW'
      } else {
        r4Script[g.boardNr] = HIGHER_RATED_WINS(g)
      }
    }
    await setResultsFromScript($, tid, 4, r4.games, r4Script)

    const standings = await fetchStandings($, tid, 4)
    expect(standings.map(snapshotStanding)).toEqual(TIEBREAK_BYES_WO)
  })

  test('Rating choice QUICK_THEN_ELO', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    // 4 players with ratingQ > 0 (used as pairing/display rating)
    // 4 players with ratingQ = 0 (falls back to ratingI)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, ratingQ: 2200 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, ratingQ: 2050 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, ratingQ: 1900 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, ratingQ: 1850 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600, ratingQ: 0 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500, ratingQ: 0 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400, ratingQ: 0 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300, ratingQ: 0 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'QuickThenElo',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        ratingChoice: 'QUICK_THEN_ELO',
        selectedTiebreaks: ['Buchholz', 'Berger', 'Vinster'],
      },
      players,
    )

    // Play 2 rounds with HIGHER_RATED_WINS
    for (let r = 1; r <= 2; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    const standings = await fetchStandings($, tid, 2)
    expect(standings.map(snapshotStanding)).toEqual(QUICK_THEN_ELO)
  })

  test('Median Buchholz equals Buchholz at 2 rounds', async ({ page }) => {
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
        name: 'MedianBuch2R',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        selectedTiebreaks: ['Buchholz', 'Median Buchholz'],
      },
      players,
    )

    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
      2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW', 4: 'BLACK_WIN' },
    }

    for (let r = 1; r <= 2; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    const standings = await fetchStandings($, tid, 2)
    const snapshot = standings.map(snapshotStanding)

    // Structural assert: Buch === M.Buch for every player at 2 rounds
    for (const s of standings) {
      expect(s.tiebreaks['Buch'], `Buch vs M.Buch for ${s.name}`).toBe(s.tiebreaks['M.Buch'])
    }

    expect(snapshot).toEqual(MEDIAN_BUCHHOLZ_2R)
  })

  test('SSF Buchholz vs standard Buchholz with byes', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    // 7 players → odd → byes
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'SSFBuchByes',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        selectedTiebreaks: ['Buchholz', 'SSF Buchholz'],
      },
      players,
    )

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    const standings = await fetchStandings($, tid, 3)
    expect(standings.map(snapshotStanding)).toEqual(SSF_BUCHHOLZ_BYES)
  })

  test('Inbördes möte resolves a tie', async ({ page }) => {
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
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'InbordesMote',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
        selectedTiebreaks: ['Buchholz', 'Inbördes möte'],
      },
      players,
    )

    // Script crafted so that two players end with same score + same Buchholz
    // but one beat the other in their direct encounter
    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN' },
      2: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW' },
      3: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW' },
      4: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'BLACK_WIN' },
    }

    for (let r = 1; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    const standings = await fetchStandings($, tid, 4)
    expect(standings.map(snapshotStanding)).toEqual(INBORDES_MOTE)
  })

  test('Progressive tiebreak', async ({ page }) => {
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
        name: 'Progressive',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        selectedTiebreaks: ['Buchholz', 'Progressiv'],
      },
      players,
    )

    // Craft scenario: some win early (high progressive), some win late (low progressive)
    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
      2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW', 4: 'DRAW' },
      3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN', 4: 'WHITE_WIN' },
    }

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    const standings = await fetchStandings($, tid, 3)
    expect(standings.map(snapshotStanding)).toEqual(PROGRESSIVE_TIEBREAK)
  })

  test('Svarta partier (Black pieces count)', async ({ page }) => {
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
        name: 'SvartaPartier',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
        selectedTiebreaks: ['Buchholz', 'Svarta partier'],
      },
      players,
    )

    for (let r = 1; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    const standings = await fetchStandings($, tid, 4)
    expect(standings.map(snapshotStanding)).toEqual(SVARTA_PARTIER)
  })

  test('Vinster counts WO wins', async ({ page }) => {
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
        name: 'VinsterWO',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        selectedTiebreaks: ['Buchholz', 'Vinster'],
      },
      players,
    )

    // R1: B1=WHITE_WIN_WO, B2=BLACK_WIN_WO, B3=WHITE_WIN, B4=BLACK_WIN
    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)
    await setResultsFromScript($, tid, 1, r1.games, {
      1: 'WHITE_WIN_WO',
      2: 'BLACK_WIN_WO',
      3: 'WHITE_WIN',
      4: 'BLACK_WIN',
    })

    // R2: HIGHER_RATED_WINS
    const r2 = await pairRound($, tid)
    expect(r2.roundNr).toBe(2)
    await setResults($, tid, 2, r2.games, HIGHER_RATED_WINS)

    const standings = await fetchStandings($, tid, 2)
    expect(standings.map(snapshotStanding)).toEqual(VINSTER_WO)
  })

  test('Prestationsrating LASK edge cases', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, ratingN: 1500 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, ratingN: 1500 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, ratingN: 1500 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, ratingN: 1500 },
      { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600, ratingN: 1500 },
      { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500, ratingN: 1500 },
      { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400, ratingN: 1500 },
      { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300, ratingN: 1500 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'PresLASK',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        selectedTiebreaks: ['Prestationsrating LASK'],
      },
      players,
    )

    // Scripted: one player wins all, one loses all
    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
      2: { 1: 'WHITE_WIN', 2: 'WHITE_WIN', 3: 'BLACK_WIN', 4: 'DRAW' },
      3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN', 4: 'WHITE_WIN' },
    }

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    const standings = await fetchStandings($, tid, 3)
    expect(standings.map(snapshotStanding)).toEqual(PRESTATIONSRATING_LASK)
  })

  test('Chess4 club scaling with small clubs', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const clubIds = await ensureClubs($, [
      { name: 'SK Tiny', chess4Members: 5 },
      { name: 'SK Small', chess4Members: 10 },
      { name: 'SK Medium', chess4Members: 15 },
      { name: 'SK Large', chess4Members: 20 },
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
        name: 'Chess4-scaling',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
        chess4: true,
        pointsPerGame: 4,
      },
      players,
    )

    for (let r = 1; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    const chess4 = await fetchChess4Standings($, tid, 4)
    const snapshot = chess4.map((s: any) => ({
      place: s.place,
      club: s.club,
      playerCount: s.playerCount,
      chess4Members: s.chess4Members,
      score: s.score,
    }))

    expect(snapshot).toEqual(CHESS4_CLUB_SCALING)
  })
})
