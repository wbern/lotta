import {
  type ApiClient,
  apiClient,
  createTournament,
  ensureClubs,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  waitForApi,
} from './api-helpers'
import {
  EXPORT_FIDE_REPORT,
  EXPORT_LIVECHESS_FINISHED,
  EXPORT_LIVECHESS_UNFINISHED,
  EXPORT_PLAYERS_TSV,
  PUBLISH_ALPHABETICAL_HTML,
  PUBLISH_CLUB_STANDINGS_HTML,
  PUBLISH_CROSS_TABLE_HTML,
  PUBLISH_PAIRINGS_HTML,
  PUBLISH_PLAYERS_HTML,
  PUBLISH_STANDINGS_HTML,
} from './exports-snapshots'
import { expect, test } from './fixtures'

const CLUBS = [{ name: 'SK Kungälv' }, { name: 'SK Linköping' }, { name: 'SK Malmö' }]

const PLAYERS_8: PlayerInput[] = [
  {
    lastName: 'Ödinson',
    firstName: 'Thor',
    ratingI: 2100,
    fideId: 9900001,
    federation: 'NOR',
    birthdate: '1990-11-30',
    clubIndex: -1,
  },
  {
    lastName: 'Läufeyson',
    firstName: 'Loki',
    ratingI: 1950,
    fideId: 9900002,
    federation: 'UKR',
    birthdate: '1990-01-12',
    clubIndex: -1,
  },
  {
    lastName: 'Järnsida',
    firstName: 'Björn',
    ratingI: 1800,
    fideId: 9900003,
    federation: 'SWE',
    birthdate: '1951-06-27',
    clubIndex: -1,
  },
  {
    lastName: 'Åskväder',
    firstName: 'Odin',
    ratingI: 1750,
    fideId: 0,
    federation: 'SWE',
    birthdate: '1985-03-15',
    clubIndex: -1,
  },
  {
    lastName: 'Stormöga',
    firstName: 'Frej',
    ratingI: 1600,
    fideId: 0,
    federation: 'SWE',
    birthdate: '1992-08-20',
    clubIndex: -1,
  },
  {
    lastName: 'Svärdhand',
    firstName: 'Tyr',
    ratingI: 1500,
    fideId: 0,
    federation: 'SWE',
    birthdate: '1988-12-01',
    clubIndex: -1,
  },
  {
    lastName: 'Stjärnljus',
    firstName: 'Freja',
    ratingI: 1400,
    fideId: 0,
    federation: 'SWE',
    sex: 'F',
    birthdate: '1995-04-10',
    clubIndex: -1,
  },
  {
    lastName: 'Nattskärm',
    firstName: 'Sigrid',
    ratingI: 1300,
    fideId: 0,
    federation: 'SWE',
    sex: 'F',
    birthdate: '1998-07-22',
    clubIndex: -1,
  },
]

const TOURNAMENT_OPTS = {
  name: 'Export Tournament',
  pairingSystem: 'Monrad',
  nrOfRounds: 7,
  city: 'Stockholm',
  startDate: '2025-06-01',
  endDate: '2025-06-07',
  chiefArbiter: 'Tor Blixtensson',
  deputyArbiter: 'Astrid Väktarsdotter',
  timeControl: '90/40+30+30',
  federation: 'SWE',
  selectedTiebreaks: ['Buchholz', 'Berger'],
  roundDates: [
    { round: 1, date: '2025-06-01' },
    { round: 2, date: '2025-06-02' },
    { round: 3, date: '2025-06-03' },
    { round: 4, date: '2025-06-04' },
    { round: 5, date: '2025-06-05' },
    { round: 6, date: '2025-06-06' },
    { round: 7, date: '2025-06-07' },
  ],
} as const

// Shared tournament — created once and reused by all read-only tests
let sharedTid: number | null = null

async function getSharedTournament($: ApiClient): Promise<number> {
  if (sharedTid != null) return sharedTid

  const clubIds = await ensureClubs($, CLUBS)
  const players = PLAYERS_8.map((p, i) => ({
    ...p,
    clubIndex: clubIds[i < 3 ? 0 : i < 6 ? 1 : 2],
  }))

  const { tid } = await createTournament($, TOURNAMENT_OPTS, players)

  for (let r = 1; r <= 7; r++) {
    const round = await pairRound($, tid)
    expect(round.roundNr).toBe(r)
    await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
  }

  sharedTid = tid
  return tid
}

// Separate tournament for destructive LiveChess unfinished test
let livechessUnfinishedTid: number | null = null

async function getLivechessUnfinishedTournament($: ApiClient): Promise<number> {
  if (livechessUnfinishedTid != null) return livechessUnfinishedTid

  const clubIds = await ensureClubs($, CLUBS)
  const players = PLAYERS_8.map((p, i) => ({
    ...p,
    clubIndex: clubIds[i < 3 ? 0 : i < 6 ? 1 : 2],
  }))

  const { tid } = await createTournament(
    $,
    {
      ...TOURNAMENT_OPTS,
      name: 'Export Tournament',
      group: 'LiveChess',
    },
    players,
  )

  for (let r = 1; r <= 7; r++) {
    const round = await pairRound($, tid)
    expect(round.roundNr).toBe(r)
    await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
  }

  // Unpair last round to create unfinished state, then pair without results
  await $.del(`/api/tournaments/${tid}/rounds/latest?confirm=true`)
  const r7 = await pairRound($, tid)
  expect(r7.roundNr).toBe(7)
  // Don't set results — this simulates an in-progress round

  livechessUnfinishedTid = tid
  return tid
}

// All export tests share one completed tournament (read-only queries)
test.describe('Exports and publish formats', () => {
  test('Export players TSV', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const bytes = await $.getBytes(`/api/tournaments/${tid}/export/players`)
    // Strip UTF-8 BOM (EF BB BF)
    const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
    const tsv = bytes.subarray(start).toString('utf-8')
    expect(tsv).toEqual(EXPORT_PLAYERS_TSV)
  })

  test('Export FIDE report', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const text = await $.getText(`/api/tournaments/${tid}/export/fide`)
    expect(text).toEqual(EXPORT_FIDE_REPORT)
  })

  test('Export LiveChess PGN (unfinished round)', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getLivechessUnfinishedTournament($)

    const pgn = await $.getText(`/api/tournaments/${tid}/export/livechess?round=7`)
    expect(pgn).toEqual(EXPORT_LIVECHESS_UNFINISHED)
  })

  test('Export LiveChess PGN (all results set)', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    // All results are set — PGN should be empty or minimal
    const pgn = await $.getText(`/api/tournaments/${tid}/export/livechess?round=7`)
    expect(pgn).toEqual(EXPORT_LIVECHESS_FINISHED)
  })

  test('Publish pairings HTML', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const html = await $.getText(`/api/tournaments/${tid}/publish/pairings?round=1`)
    expect(html).toEqual(PUBLISH_PAIRINGS_HTML)
  })

  test('Publish standings HTML', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const html = await $.getText(`/api/tournaments/${tid}/publish/standings?round=7`)
    expect(html).toEqual(PUBLISH_STANDINGS_HTML)
  })

  test('Publish player list HTML', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const html = await $.getText(`/api/tournaments/${tid}/publish/players`)
    expect(html).toEqual(PUBLISH_PLAYERS_HTML)
  })

  test('Publish club standings HTML', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const html = await $.getText(`/api/tournaments/${tid}/publish/club-standings?round=7`)
    expect(html).toEqual(PUBLISH_CLUB_STANDINGS_HTML)
  })

  test('Publish alphabetical pairings HTML', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const html = await $.getText(`/api/tournaments/${tid}/publish/alphabetical?round=1&columns=2`)
    expect(html).toEqual(PUBLISH_ALPHABETICAL_HTML)
  })

  test('Publish cross-table HTML', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await getSharedTournament($)

    const html = await $.getText(`/api/tournaments/${tid}/publish/cross-table`)
    expect(html).toEqual(PUBLISH_CROSS_TABLE_HTML)
  })
})
