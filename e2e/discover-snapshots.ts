/**
 * Discovery script: runs tournament setups against the backend and dumps
 * actual API responses as JSON. Run with:
 *   npx tsx e2e/discover-snapshots.ts <port>
 *
 * Writes snapshot data to e2e/discovered/ directory.
 */

const PORT = parseInt(process.argv[2] || '9001')
const BASE = `http://localhost:${PORT}`

async function req(method: string, path: string, body?: any) {
  const opts: RequestInit = { method }
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function getText(path: string) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.text()
}

async function getBytes(path: string) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const $ = {
  get: (p: string) => req('GET', p),
  post: (p: string, b?: any) => req('POST', p, b),
  put: (p: string, b: any) => req('PUT', p, b),
  del: async (p: string) => {
    const r = await fetch(`${BASE}${p}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`DELETE ${p} → ${r.status}`)
  },
  getText,
  getBytes,
}

async function createTournament(opts: any, players: any[]) {
  const t = await $.post('/api/tournaments', {
    name: opts.name,
    group: 'Snapshot',
    pairingSystem: opts.pairingSystem,
    initialPairing: opts.initialPairing ?? 'Rating',
    nrOfRounds: opts.nrOfRounds,
    barredPairing: opts.barredPairing ?? false,
    compensateWeakPlayerPP: opts.compensateWeakPlayerPP ?? false,
    pointsPerGame: opts.pointsPerGame ?? 1,
    chess4: opts.chess4 ?? false,
    ratingChoice: opts.ratingChoice ?? 'ELO',
    showELO: opts.showELO ?? true,
    showGroup: opts.showGroup ?? false,
    selectedTiebreaks: opts.selectedTiebreaks,
    city: opts.city,
    startDate: opts.startDate,
    endDate: opts.endDate,
    chiefArbiter: opts.chiefArbiter,
    deputyArbiter: opts.deputyArbiter,
    timeControl: opts.timeControl,
    federation: opts.federation,
    roundDates: opts.roundDates,
  })
  const added: any[] = []
  for (const p of players) {
    const a = await $.post(`/api/tournaments/${t.id}/players`, {
      firstName: p.firstName,
      lastName: p.lastName,
      ratingI: p.ratingI ?? 0,
      ratingN: p.ratingN ?? 0,
      ratingQ: p.ratingQ ?? 0,
      ratingB: p.ratingB ?? 0,
      ratingK: p.ratingK ?? 0,
      ratingKQ: p.ratingKQ ?? 0,
      ratingKB: p.ratingKB ?? 0,
      clubIndex: p.clubIndex ?? 0,
      title: p.title ?? '',
      sex: p.sex ?? '',
      federation: p.federation ?? 'SWE',
      fideId: p.fideId ?? 0,
      ssfId: p.ssfId ?? 0,
      playerGroup: p.playerGroup ?? '',
      withdrawnFromRound: 0,
      manualTiebreak: 0,
      birthdate: p.birthdate,
    })
    added.push(a)
  }
  return { tid: t.id, added }
}

async function pair(tid: number) {
  return $.post(`/api/tournaments/${tid}/pair?confirm=true`)
}

async function setResultsFn(tid: number, roundNr: number, games: any[], fn: (g: any) => string) {
  for (const g of games) {
    if (!g.whitePlayer || !g.blackPlayer) continue
    await $.put(`/api/tournaments/${tid}/rounds/${roundNr}/games/${g.boardNr}/result`, {
      resultType: fn(g),
    })
  }
}

async function setResultsScript(
  tid: number,
  roundNr: number,
  games: any[],
  script: Record<number, string>,
) {
  for (const g of games) {
    if (!g.whitePlayer || !g.blackPlayer) continue
    await $.put(`/api/tournaments/${tid}/rounds/${roundNr}/games/${g.boardNr}/result`, {
      resultType: script[g.boardNr],
    })
  }
}

const HRW = (g: any) => (g.whitePlayer.rating > g.blackPlayer.rating ? 'WHITE_WIN' : 'BLACK_WIN')

const PLAYERS_8 = [
  { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
  { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
  { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
  { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
  { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
  { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
  { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
  { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
]

const PLAYERS_4 = PLAYERS_8.slice(0, 4)

// ── RESULTS ────────────────────────────────────────────────────────────
async function discoverResults() {
  console.log('=== RESULTS ===')
  const { tid } = await createTournament(
    {
      name: 'Results-test',
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
      selectedTiebreaks: ['Buchholz', 'Vinster'],
    },
    PLAYERS_8,
  )

  const r1 = await pair(tid)
  await setResultsFn(tid, 1, r1.games, HRW)

  const r2 = await pair(tid)
  await setResultsScript(tid, 2, r2.games, {
    1: 'WHITE_WIN_WO',
    2: 'BLACK_WIN_WO',
    3: 'DOUBLE_WO',
    4: 'POSTPONED',
  })

  const r3 = await pair(tid)
  await setResultsScript(tid, 3, r3.games, {
    1: 'CANCELLED',
    2: 'WHITE_WIN',
    3: 'DRAW',
    4: 'BLACK_WIN',
  })

  const round2 = await $.get(`/api/tournaments/${tid}/rounds/2`)
  const games2 = round2.games.map((g: any) => ({
    boardNr: g.boardNr,
    resultType: g.resultType,
    whiteScore: g.whiteScore,
    blackScore: g.blackScore,
    resultDisplay: g.resultDisplay,
  }))
  console.log('RESULTS_ROUND2_GAMES=' + JSON.stringify(games2))

  const s2 = await $.get(`/api/tournaments/${tid}/standings?round=2`)
  console.log(
    'RESULTS_STANDINGS_AFTER_R2=' +
      JSON.stringify(
        s2.map((s: any) => ({
          place: s.place,
          name: s.name,
          score: s.score,
          tiebreaks: s.tiebreaks,
        })),
      ),
  )

  const s3 = await $.get(`/api/tournaments/${tid}/standings?round=3`)
  console.log(
    'RESULTS_STANDINGS_AFTER_R3=' +
      JSON.stringify(
        s3.map((s: any) => ({
          place: s.place,
          name: s.name,
          score: s.score,
          tiebreaks: s.tiebreaks,
        })),
      ),
  )
}

// ── STANDINGS ──────────────────────────────────────────────────────────
async function discoverStandings() {
  console.log('=== STANDINGS ===')

  // 8 tiebreakers
  const { tid } = await createTournament(
    {
      name: 'Standings-8TB',
      pairingSystem: 'Monrad',
      nrOfRounds: 5,
      selectedTiebreaks: [
        'Buchholz',
        'Berger',
        'Median Buchholz',
        'SSF Buchholz',
        'Progressiv',
        'Vinster',
        'Svarta partier',
        'Prestationsrating LASK',
      ],
    },
    PLAYERS_8,
  )

  const scripted: Record<number, Record<number, string>> = {
    1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN', 4: 'DRAW' },
    2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
    3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN', 4: 'WHITE_WIN' },
    4: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
    5: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
  }
  const allRounds: any[][] = []
  for (let r = 1; r <= 5; r++) {
    const round = await pair(tid)
    await setResultsScript(tid, r, round.games, scripted[r])
    const s = await $.get(`/api/tournaments/${tid}/standings?round=${r}`)
    allRounds.push(
      s.map((x: any) => ({ place: x.place, name: x.name, score: x.score, tiebreaks: x.tiebreaks })),
    )
  }
  console.log('STANDINGS_8TB_BY_ROUND=' + JSON.stringify(allRounds))

  // Inbördes möte
  const players6 = [
    { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
    { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
    { lastName: 'Gamma', firstName: 'C', ratingI: 1800 },
    { lastName: 'Delta', firstName: 'D', ratingI: 1700 },
    { lastName: 'Epsilon', firstName: 'E', ratingI: 1600 },
    { lastName: 'Zeta', firstName: 'F', ratingI: 1500 },
  ]
  const { tid: tid2 } = await createTournament(
    {
      name: 'Standings-Inbordes',
      pairingSystem: 'Monrad',
      nrOfRounds: 4,
      selectedTiebreaks: ['Buchholz', 'Inbördes möte'],
    },
    players6,
  )

  const inbordesScript: Record<number, Record<number, string>> = {
    1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN' },
    2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW' },
    3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN' },
    4: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'BLACK_WIN' },
  }
  for (let r = 1; r <= 4; r++) {
    const round = await pair(tid2)
    await setResultsScript(tid2, r, round.games, inbordesScript[r])
  }
  const sInb = await $.get(`/api/tournaments/${tid2}/standings?round=4`)
  console.log(
    'STANDINGS_INBORDES=' +
      JSON.stringify(
        sInb.map((x: any) => ({
          place: x.place,
          name: x.name,
          score: x.score,
          tiebreaks: x.tiebreaks,
        })),
      ),
  )

  // Manuell
  const { tid: tid3, added: added3 } = await createTournament(
    {
      name: 'Standings-Manuell',
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
      selectedTiebreaks: ['Buchholz', 'Manuell'],
    },
    PLAYERS_8,
  )

  const manuellScript: Record<number, Record<number, string>> = {
    1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'DRAW' },
    2: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
    3: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'BLACK_WIN', 4: 'WHITE_WIN' },
  }
  for (let r = 1; r <= 3; r++) {
    const round = await pair(tid3)
    await setResultsScript(tid3, r, round.games, manuellScript[r])
  }
  const ulf = added3[2]
  await $.put(`/api/tournaments/${tid3}/players/${ulf.id}`, { ...ulf, manualTiebreak: 10 })
  const sMan = await $.get(`/api/tournaments/${tid3}/standings?round=3`)
  console.log(
    'STANDINGS_MANUELL=' +
      JSON.stringify(
        sMan.map((x: any) => ({
          place: x.place,
          name: x.name,
          score: x.score,
          tiebreaks: x.tiebreaks,
        })),
      ),
  )
}

// ── CLUB STANDINGS ─────────────────────────────────────────────────────
async function discoverClubStandings() {
  console.log('=== CLUB STANDINGS ===')

  const clubs = ['SK Vit', 'SK Svart', 'SK Grön']
  const clubIds: number[] = []
  for (const n of clubs) {
    const c = await $.post('/api/clubs', { name: n })
    clubIds.push(c.id)
  }

  const players6 = [
    { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, clubIndex: clubIds[0] },
    { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, clubIndex: clubIds[0] },
    { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, clubIndex: clubIds[1] },
    { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, clubIndex: clubIds[1] },
    { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600, clubIndex: clubIds[2] },
    { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500, clubIndex: clubIds[2] },
  ]

  // Round-by-round
  const { tid } = await createTournament(
    {
      name: 'ClubStandings-base',
      pairingSystem: 'Monrad',
      nrOfRounds: 4,
    },
    players6,
  )

  const csScript: Record<number, Record<number, string>> = {
    1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN' },
    2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW' },
    3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN' },
    4: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'BLACK_WIN' },
  }

  const allCS: any[][] = []
  for (let r = 1; r <= 4; r++) {
    const round = await pair(tid)
    await setResultsScript(tid, r, round.games, csScript[r])
    const cs = await $.get(`/api/tournaments/${tid}/club-standings?round=${r}`)
    allCS.push(cs.map((s: any) => ({ place: s.place, club: s.club, score: s.score })))
  }
  console.log('CLUB_STANDINGS_BY_ROUND=' + JSON.stringify(allCS))

  // All draws
  const { tid: tid2 } = await createTournament(
    {
      name: 'ClubStandings-draws',
      pairingSystem: 'Monrad',
      nrOfRounds: 4,
    },
    players6,
  )
  for (let r = 1; r <= 4; r++) {
    const round = await pair(tid2)
    await setResultsFn(tid2, r, round.games, () => 'DRAW')
  }
  const csDraws = await $.get(`/api/tournaments/${tid2}/club-standings?round=4`)
  console.log(
    'CLUB_STANDINGS_ALL_DRAWS=' +
      JSON.stringify(csDraws.map((s: any) => ({ place: s.place, club: s.club, score: s.score }))),
  )
}

// ── SETTINGS ───────────────────────────────────────────────────────────
async function discoverSettings() {
  console.log('=== SETTINGS ===')

  // FIRST_LAST / LAST_FIRST
  const { tid } = await createTournament(
    {
      name: 'Settings-presentation',
      pairingSystem: 'Monrad',
      nrOfRounds: 2,
    },
    PLAYERS_4,
  )
  const r1 = await pair(tid)
  await setResultsFn(tid, 1, r1.games, HRW)

  const sFL = await $.get(`/api/tournaments/${tid}/standings?round=1`)
  console.log(
    'SETTINGS_FIRST_LAST_STANDINGS=' +
      JSON.stringify(
        sFL.map((s: any) => ({
          place: s.place,
          name: s.name,
          rating: s.rating,
          score: s.score,
        })),
      ),
  )

  await $.put('/api/settings', { playerPresentation: 'LAST_FIRST' })
  const sLF = await $.get(`/api/tournaments/${tid}/standings?round=1`)
  console.log(
    'SETTINGS_LAST_FIRST_STANDINGS=' +
      JSON.stringify(
        sLF.map((s: any) => ({
          place: s.place,
          name: s.name,
          rating: s.rating,
          score: s.score,
        })),
      ),
  )
  await $.put('/api/settings', { playerPresentation: 'FIRST_LAST' })

  // QUICK rating
  const quickPlayers = PLAYERS_4.map((p) => ({ ...p, ratingQ: 1500 }))
  const { tid: tid2 } = await createTournament(
    {
      name: 'Settings-quick-rating',
      pairingSystem: 'Monrad',
      nrOfRounds: 2,
      ratingChoice: 'QUICK',
    },
    quickPlayers,
  )
  const r2 = await pair(tid2)
  await setResultsFn(tid2, 1, r2.games, HRW)
  const sQ = await $.get(`/api/tournaments/${tid2}/standings?round=1`)
  console.log(
    'SETTINGS_QUICK_RATING=' +
      JSON.stringify(
        sQ.map((s: any) => ({
          place: s.place,
          name: s.name,
          rating: s.rating,
          score: s.score,
        })),
      ),
  )

  // QUICK_THEN_ELO
  const qte = [
    { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, ratingQ: 1800 },
    { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, ratingQ: 0 },
    { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, ratingQ: 1600 },
    { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, ratingQ: 0 },
  ]
  const { tid: tid3 } = await createTournament(
    {
      name: 'Settings-quick-fallback',
      pairingSystem: 'Monrad',
      nrOfRounds: 2,
      ratingChoice: 'QUICK_THEN_ELO',
    },
    qte,
  )
  const r3 = await pair(tid3)
  await setResultsFn(tid3, 1, r3.games, HRW)
  const sQTE = await $.get(`/api/tournaments/${tid3}/standings?round=1`)
  console.log(
    'SETTINGS_QUICK_THEN_ELO_FALLBACK=' +
      JSON.stringify(
        sQTE.map((s: any) => ({
          place: s.place,
          name: s.name,
          rating: s.rating,
          score: s.score,
        })),
      ),
  )

  // pointsPerGame=2
  const { tid: tid4 } = await createTournament(
    {
      name: 'Settings-ppg2',
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
      pointsPerGame: 2,
    },
    PLAYERS_4,
  )
  for (let r = 1; r <= 3; r++) {
    const round = await pair(tid4)
    await setResultsFn(tid4, r, round.games, HRW)
  }
  const sPPG = await $.get(`/api/tournaments/${tid4}/standings?round=3`)
  console.log(
    'SETTINGS_POINTS_PER_GAME_2=' +
      JSON.stringify(
        sPPG.map((s: any) => ({
          place: s.place,
          name: s.name,
          rating: s.rating,
          score: s.score,
        })),
      ),
  )
}

// ── CHESS4 ──────────────────────────────────────────────────────────────
async function discoverChess4() {
  console.log('=== CHESS4 ===')

  const clubDefs = [
    { name: 'SK Alfa', chess4Members: 12 },
    { name: 'SK Beta', chess4Members: 8 },
    { name: 'SK Gamma', chess4Members: 15 },
    { name: 'SK Delta', chess4Members: 10 },
  ]
  const clubIds: number[] = []
  for (const c of clubDefs) {
    const club = await $.post('/api/clubs', { name: c.name })
    await $.put(`/api/clubs/${club.id}`, { name: c.name, chess4Members: c.chess4Members })
    clubIds.push(club.id)
  }
  const players = PLAYERS_8.map((p, i) => ({ ...p, clubIndex: clubIds[Math.floor(i / 2)] }))

  // Game scoring test
  const { tid } = await createTournament(
    {
      name: 'Chess4-scoring',
      pairingSystem: 'Monrad',
      nrOfRounds: 4,
      chess4: true,
      pointsPerGame: 4,
    },
    players,
  )

  const r1 = await pair(tid)
  await setResultsScript(tid, 1, r1.games, {
    1: 'WHITE_WIN',
    2: 'BLACK_WIN',
    3: 'DRAW',
    4: 'WHITE_WIN',
  })
  const round1 = await $.get(`/api/tournaments/${tid}/rounds/1`)
  console.log(
    'CHESS4_GAME_SCORING=' +
      JSON.stringify(
        round1.games.map((g: any) => ({
          boardNr: g.boardNr,
          resultType: g.resultType,
          whiteScore: g.whiteScore,
          blackScore: g.blackScore,
        })),
      ),
  )

  // Continue playing for standings
  for (let r = 2; r <= 4; r++) {
    const round = await pair(tid)
    await setResultsFn(tid, r, round.games, HRW)
  }

  const cs4 = await $.get(`/api/tournaments/${tid}/chess4-standings?round=4`)
  console.log(
    'CHESS4_STANDINGS_FINAL=' +
      JSON.stringify(
        cs4.map((s: any) => ({
          place: s.place,
          club: s.club,
          playerCount: s.playerCount,
          chess4Members: s.chess4Members,
          score: s.score,
        })),
      ),
  )

  // Round-by-round (fresh tournament)
  const { tid: tid2 } = await createTournament(
    {
      name: 'Chess4-rr',
      pairingSystem: 'Monrad',
      nrOfRounds: 4,
      chess4: true,
      pointsPerGame: 4,
    },
    players,
  )

  const allCS: any[][] = []
  for (let r = 1; r <= 4; r++) {
    const round = await pair(tid2)
    await setResultsFn(tid2, r, round.games, HRW)
    const cs = await $.get(`/api/tournaments/${tid2}/chess4-standings?round=${r}`)
    allCS.push(
      cs.map((s: any) => ({
        place: s.place,
        club: s.club,
        playerCount: s.playerCount,
        chess4Members: s.chess4Members,
        score: s.score,
      })),
    )
  }
  console.log('CHESS4_STANDINGS_BY_ROUND=' + JSON.stringify(allCS))

  // HTML
  const html = await $.getText(`/api/tournaments/${tid2}/publish/chess4-standings`)
  console.log('CHESS4_PUBLISH_HTML=' + JSON.stringify(html))
}

// ── EXPORTS ────────────────────────────────────────────────────────────
async function discoverExports() {
  console.log('=== EXPORTS ===')

  const clubs = ['SK Kungälv', 'SK Linköping', 'SK Malmö']
  const clubIds: number[] = []
  for (const n of clubs) {
    const c = await $.post('/api/clubs', { name: n })
    clubIds.push(c.id)
  }

  const exportPlayers = [
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
      clubIndex: clubIds[1],
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
      clubIndex: clubIds[2],
    },
    {
      lastName: 'Nattskärm',
      firstName: 'Sigrid',
      ratingI: 1300,
      fideId: 0,
      federation: 'SWE',
      sex: 'F',
      birthdate: '1998-07-22',
      clubIndex: clubIds[2],
    },
  ]

  const { tid } = await createTournament(
    {
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
    },
    exportPlayers,
  )

  for (let r = 1; r <= 7; r++) {
    const round = await pair(tid)
    await setResultsFn(tid, r, round.games, HRW)
  }

  // Player TSV
  const bytes = await $.getBytes(`/api/tournaments/${tid}/export/players`)
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  console.log('EXPORT_PLAYERS_TSV=' + JSON.stringify(bytes.subarray(start).toString('utf-8')))

  // FIDE
  const fide = await $.getText(`/api/tournaments/${tid}/export/fide`)
  console.log('EXPORT_FIDE_REPORT=' + JSON.stringify(fide))

  // LiveChess finished (all results set)
  const lcFinished = await $.getText(`/api/tournaments/${tid}/export/livechess?round=7`)
  console.log('EXPORT_LIVECHESS_FINISHED=' + JSON.stringify(lcFinished))

  // Unpair round 7, pair again without results → unfinished
  await $.del(`/api/tournaments/${tid}/rounds/latest?confirm=true`)
  await pair(tid)
  const lcUnfinished = await $.getText(`/api/tournaments/${tid}/export/livechess?round=7`)
  console.log('EXPORT_LIVECHESS_UNFINISHED=' + JSON.stringify(lcUnfinished))

  // Set results again for round 7 for publish tests
  const round7 = await $.get(`/api/tournaments/${tid}/rounds/7`)
  await setResultsFn(tid, 7, round7.games, HRW)

  // Publish
  const pairingsHTML = await $.getText(`/api/tournaments/${tid}/publish/pairings?round=1`)
  console.log('PUBLISH_PAIRINGS_HTML=' + JSON.stringify(pairingsHTML))

  const standingsHTML = await $.getText(`/api/tournaments/${tid}/publish/standings?round=7`)
  console.log('PUBLISH_STANDINGS_HTML=' + JSON.stringify(standingsHTML))

  const playersHTML = await $.getText(`/api/tournaments/${tid}/publish/players`)
  console.log('PUBLISH_PLAYERS_HTML=' + JSON.stringify(playersHTML))

  const clubHTML = await $.getText(`/api/tournaments/${tid}/publish/club-standings?round=7`)
  console.log('PUBLISH_CLUB_STANDINGS_HTML=' + JSON.stringify(clubHTML))

  const alphaHTML = await $.getText(
    `/api/tournaments/${tid}/publish/alphabetical?round=1&columns=2`,
  )
  console.log('PUBLISH_ALPHABETICAL_HTML=' + JSON.stringify(alphaHTML))

  const crossHTML = await $.getText(`/api/tournaments/${tid}/publish/cross-table`)
  console.log('PUBLISH_CROSS_TABLE_HTML=' + JSON.stringify(crossHTML))
}

async function main() {
  try {
    await discoverResults()
    await discoverStandings()
    await discoverClubStandings()
    await discoverSettings()
    await discoverChess4()
    await discoverExports()
    console.log('\n=== DISCOVERY COMPLETE ===')
  } catch (e) {
    console.error('Discovery failed:', e)
    process.exit(1)
  }
}

main()
