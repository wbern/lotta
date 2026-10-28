import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseService } from '../db/database-service.ts'
import { deleteDatabase } from '../db/persistence.ts'
import { publishStandings } from '../domain/html-publisher.ts'
import { setLocalProviderFactory } from './active-provider.ts'
import { getLocalProvider } from './local-data-provider.ts'
import {
  publishClubStandingsHtml,
  publishCrossTableHtml,
  publishFile,
  publishHtml,
  publishPairingsHtml,
  publishPlayerListHtml,
  publishStandingsHtml,
} from './publish.ts'
import { buildStandingsInput } from './publish-data.ts'
import { setResult } from './results.ts'
import { pairNextRound } from './rounds.ts'
import { setDatabaseService } from './service-provider.ts'

describe('publish API (local)', () => {
  let service: DatabaseService
  let tournamentId: number

  beforeEach(async () => {
    service = await DatabaseService.create()
    setDatabaseService(service)
    setLocalProviderFactory(() => getLocalProvider())

    const t = service.tournaments.create({
      name: 'Testturneringen',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    tournamentId = t.id

    const club = service.clubs.create({ name: 'SK Lund' })
    service.tournamentPlayers.add(tournamentId, {
      lastName: 'Andersson',
      firstName: 'Anna',
      ratingI: 1800,
      clubIndex: club.id,
    })
    service.tournamentPlayers.add(tournamentId, {
      lastName: 'Björk',
      firstName: 'Bo',
      ratingI: 1700,
    })
    service.tournamentPlayers.add(tournamentId, {
      lastName: 'Carlsson',
      firstName: 'Cilla',
      ratingI: 1600,
      clubIndex: club.id,
    })
    service.tournamentPlayers.add(tournamentId, {
      lastName: 'Dahl',
      firstName: 'Dan',
      ratingI: 1500,
    })
  })

  afterEach(async () => {
    service.close()
    await deleteDatabase()
  })

  it('publishPlayerListHtml generates HTML with all players', async () => {
    const blob = await publishPlayerListHtml(tournamentId)
    const html = await blob.text()

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Spelarlista')
    expect(html).toContain('Testturneringen')
    expect(html).toContain('Anna Andersson')
    expect(html).toContain('Bo Björk')
    expect(html).toContain('SK Lund')
    expect(html).toContain('1800')
  })

  it('publishPairingsHtml generates HTML after pairing', async () => {
    await pairNextRound(tournamentId)

    const blob = await publishPairingsHtml(tournamentId)
    const html = await blob.text()

    expect(html).toContain('Lottning rond 1')
    expect(html).toContain('Testturneringen')
    expect(html).toContain('Bord')
    expect(html).toContain('Vit')
    expect(html).toContain('Svart')
  })

  it('publishStandingsHtml generates HTML after round with results', async () => {
    const round = await pairNextRound(tournamentId)
    for (const g of round.games) {
      await setResult(tournamentId, 1, g.boardNr, { resultType: 'WHITE_WIN' })
    }

    const blob = await publishStandingsHtml(tournamentId)
    const html = await blob.text()

    expect(html).toContain('Ställning efter rond 1')
    expect(html).toContain('Plac')
    expect(html).toContain('Poäng')
  })

  it('given a player withdrawn from round 2, when standings are published, then the name cell carries the escaped "(utgått r2)" suffix', async () => {
    const round = await pairNextRound(tournamentId)
    for (const g of round.games) {
      await setResult(tournamentId, 1, g.boardNr, { resultType: 'WHITE_WIN' })
    }
    const dahl = service.tournamentPlayers.list(tournamentId).find((p) => p.lastName === 'Dahl')!
    service.tournamentPlayers.update(dahl.id, { withdrawnFromRound: 2 })

    const html = await (await publishStandingsHtml(tournamentId, 1)).text()

    expect(html).toContain('<td class="CP_Player">Dan Dahl (utgått r2)</td>')
    expect(html).toContain('<td class="CP_Player">Anna Andersson</td>')
  })

  it('given a tournament with Buchholz and Vinster selected, when standings are published, then the tiebreak cells carry the computed values', async () => {
    service.tournaments.update(tournamentId, {
      name: 'Testturneringen',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
      selectedTiebreaks: ['Buchholz', 'Vinster'],
    })
    const round = await pairNextRound(tournamentId)
    for (const g of round.games) {
      await setResult(tournamentId, 1, g.boardNr, { resultType: 'WHITE_WIN' })
    }

    const html = await (await publishStandingsHtml(tournamentId, 1)).text()

    // After one round with two decisive games the two winners (1 point) rank
    // first: Buchholz = their opponent's score 0, Vinster 1. The two losers
    // follow: Buchholz = their opponent's score 1, Vinster 0.
    const cells = [...html.matchAll(/<td class="CP_Tiebreak">([^<]*)<\/td>/g)].map((m) => m[1])
    expect(cells).toHaveLength(8)
    expect(cells.every((c) => c !== '')).toBe(true)
    expect(cells.slice(0, 4)).toEqual(['0', '1', '0', '1'])
    expect(cells.slice(4)).toEqual(['1', '0', '1', '0'])
  })

  it('given Buchholz and Prestationsrating LASK, when buildStandingsInput feeds publishStandings, then both cells are filled and the header has no "LASK"', async () => {
    service.tournaments.update(tournamentId, {
      name: 'Testturneringen',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
      selectedTiebreaks: ['Buchholz', 'Prestationsrating LASK'],
    })
    const round = await pairNextRound(tournamentId)
    for (const g of round.games) {
      await setResult(tournamentId, 1, g.boardNr, { resultType: 'WHITE_WIN' })
    }

    const input = await buildStandingsInput(tournamentId, 1)
    const html = publishStandings(input!)

    // Monrad by rating pairs Anna 1800 – Bo 1700 and Cilla 1600 – Dan 1500.
    // White won both, so each winner's Pres = opponent rating + 800 (p = 1)
    // and each loser's = opponent rating − 800 (p = 0 mirrored to 1).
    const pres = Object.fromEntries(input!.standings.map((s) => [s.name, s.tiebreaks.Pres]))
    const games = round.games.map((g) => [g.whitePlayer!, g.blackPlayer!])
    for (const [w, b] of games) {
      expect(pres[w.name]).toBe(String(b.rating + 800))
      expect(pres[b.name]).toBe(String(w.rating - 800))
    }
    expect(html).toContain('<td>Buchholz</td><td>Prestationsrating</td>')
    expect(html).not.toContain('LASK')
    const cells = [...html.matchAll(/<td class="CP_Tiebreak">([^<]*)<\/td>/g)].map((m) => m[1])
    expect(cells).toHaveLength(8)
    expect(cells.every((c) => c !== '')).toBe(true)
  })

  it('given a Schackfyran tournament, when chess4 standings are published, then each club row shows players, class size and the scaled score', async () => {
    const t = service.tournaments.create({
      name: 'Schackfyran',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 4,
      chess4: true,
      ratingChoice: 'ELO',
      showELO: false,
      showGroup: false,
    })
    const c4a = service.clubs.create({ name: '4A', chess4Members: 12 })
    const c4b = service.clubs.create({ name: '4B', chess4Members: 8 })
    for (const [firstName, lastName, clubIndex, ratingI] of [
      ['Anna', 'Ahl', c4a.id, 1200],
      ['Bo', 'Berg', c4a.id, 1100],
      ['Cilla', 'Cedh', c4b.id, 1150],
      ['Dan', 'Dahl', c4b.id, 1050],
    ] as [string, string, number, number][]) {
      service.tournamentPlayers.add(t.id, { firstName, lastName, clubIndex, ratingI })
    }
    // Lots by rating: Ahl 1, Cedh 2, Berg 3, Dahl 4 → Cedh–Ahl, Dahl–Berg
    // (lower lot white). White wins both: win 3, loss 4 − 3 = 1.
    const round = await pairNextRound(t.id)
    for (const g of round.games) {
      await setResult(t.id, 1, g.boardNr, { resultType: 'WHITE_WIN' })
    }

    const html = await (await publishHtml(t.id, 'chess4-standings', 1)).text()

    // 4B: Cedh 3 + Dahl 3 = 6 points, class size 8 → max(10, 8) = 10 → round(40/10·6) = 24.
    // 4A: Ahl 1 + Berg 1 = 2 points, class size 12 → round(40/12·2) = round(6.67) = 7.
    expect(html).toContain(
      '<td class="CP_Place">1</td><td class="CP_Player">4B</td><td class="CP_Rating">2</td><td class="CP_Rating">8</td><td class="CP_Score">24</td>',
    )
    expect(html).toContain(
      '<td class="CP_Place">2</td><td class="CP_Player">4A</td><td class="CP_Rating">2</td><td class="CP_Rating">12</td><td class="CP_Score">7</td>',
    )
  })

  it('publishClubStandingsHtml generates HTML', async () => {
    const round = await pairNextRound(tournamentId)
    for (const g of round.games) {
      await setResult(tournamentId, 1, g.boardNr, { resultType: 'DRAW' })
    }

    const blob = await publishClubStandingsHtml(tournamentId)
    const html = await blob.text()

    expect(html).toContain('Klubbställning efter rond 1')
    expect(html).toContain('SK Lund')
  })

  it('publishCrossTableHtml generates cross table', async () => {
    const round = await pairNextRound(tournamentId)
    for (const g of round.games) {
      await setResult(tournamentId, 1, g.boardNr, { resultType: 'WHITE_WIN' })
    }

    const blob = await publishCrossTableHtml(tournamentId)
    const html = await blob.text()

    expect(html).toContain('Korstabell')
    expect(html).toContain('R1')
    expect(html).toContain('Poäng')
    // Should contain opponent references with color
    expect(html).toMatch(/\d[vs]/)
  })

  it('publishHtml dispatches correctly', async () => {
    await pairNextRound(tournamentId)

    const pairingsBlob = await publishHtml(tournamentId, 'pairings', 1)
    const pairingsHtml = await pairingsBlob.text()
    expect(pairingsHtml).toContain('Lottning')

    const playersBlob = await publishHtml(tournamentId, 'players')
    const playersHtml = await playersBlob.text()
    expect(playersHtml).toContain('Spelarlista')
  })

  it('publishHtml alphabetical default renders table per class with real board numbers', async () => {
    await pairNextRound(tournamentId)

    const blob = await publishHtml(tournamentId, 'alphabetical', 1)
    const html = await blob.text()

    expect(html).toContain('CP_AlphabeticalClass')
    expect(html).not.toContain('2147483647')
    // 4 players → 2 games on boards 1 and 2. Each player's row shows the
    // board they actually sit at (must match the on-screen pairings list).
    const round = service.games.getRound(tournamentId, 1)!
    const boardByName = new Map<string, number>()
    for (const g of round.games) {
      if (g.whitePlayer) boardByName.set(g.whitePlayer.name, g.boardNr)
      if (g.blackPlayer) boardByName.set(g.blackPlayer.name, g.boardNr)
    }
    for (const [name, board] of boardByName) {
      const re = new RegExp(
        `<td class="CP_Player">${name}</td><td class="CP_Board">${board} [VS]</td>`,
      )
      expect(html).toMatch(re)
    }
  })

  it('publishHtml alphabetical honors groupByClass=0 + columns query params', async () => {
    await pairNextRound(tournamentId)

    const blob = await publishHtml(tournamentId, 'alphabetical?groupByClass=0&columns=3', 1)
    const html = await blob.text()

    expect(html).toContain('CP_AlphabeticalFlat')
    expect(html).toContain('column-count: 3')
    // The per-class wrapper div should not be emitted in the flat layout
    // (the class name may still appear inside the inline CSS block)
    expect(html).not.toContain('class="CP_AlphabeticalClass"')
    const annaBoard = service.games
      .getRound(tournamentId, 1)!
      .games.find(
        (g) => g.whitePlayer?.name === 'Anna Andersson' || g.blackPlayer?.name === 'Anna Andersson',
      )!.boardNr
    expect(html).toMatch(
      new RegExp(`Anna Andersson <span class="CP_RowBoard">${annaBoard} [VS]</span>`),
    )
  })

  it('publishHtml alphabetical ignores non-numeric columns values', async () => {
    await pairNextRound(tournamentId)

    const blob = await publishHtml(tournamentId, 'alphabetical?groupByClass=0&columns=foo', 1)
    const html = await blob.text()

    // Should fall back to the default (1 column) rather than emitting NaN.
    expect(html).not.toContain('column-count: NaN')
    expect(html).toContain('column-count: 1')
  })

  it('publishHtml alphabetical hides opponent last names when hideOppLast=1', async () => {
    await pairNextRound(tournamentId)

    const blob = await publishHtml(tournamentId, 'alphabetical?hideOppLast=1', 1)
    const html = await blob.text()

    // Anna's opponent in rating-desc pairing should be Bo Björk — with the
    // flag on, only "Bo" should appear as her opponent cell. Players' own
    // rows still keep their full names.
    expect(html).toContain('<td class="CP_Player">Anna Andersson</td>')
    expect(html).toContain('<td class="CP_Player">Bo Björk</td>')
    // Only Bo's own row should contain "Bo Björk" — Anna's opponent cell
    // should have been shortened to "Bo".
    const boBjorkMatches = html.match(/<td class="CP_Player">Bo Björk<\/td>/g) ?? []
    expect(boBjorkMatches).toHaveLength(1)
    expect(html).toMatch(/<td class="CP_Player">Bo<\/td>/)
  })

  it('publishHtml alphabetical applies CP_compact when compact=1', async () => {
    await pairNextRound(tournamentId)

    const blob = await publishHtml(tournamentId, 'alphabetical?compact=1', 1)
    const html = await blob.text()

    expect(html).toContain('<body class="CP_compact">')
  })

  it('publishPairingsHtml throws with no rounds', async () => {
    await expect(publishPairingsHtml(tournamentId)).rejects.toThrow('No rounds available')
  })

  it('given round 2 is the latest round, when standings are published without a round, then the file is named after the rendered round', async () => {
    for (let r = 1; r <= 2; r++) {
      const round = await pairNextRound(tournamentId)
      for (const g of round.games) {
        if (g.blackPlayer) await setResult(tournamentId, r, g.boardNr, { resultType: 'DRAW' })
      }
    }

    const { blob, filename } = await publishFile(tournamentId, 'standings')

    expect(filename).toBe('testturneringen-a-stallning-rond-2.html')
    expect(await blob.text()).toContain('<!DOCTYPE html>')
    expect((await publishFile(tournamentId, 'pairings', 1)).filename).toBe(
      'testturneringen-a-lottning-rond-1.html',
    )
    expect((await publishFile(tournamentId, 'players')).filename).toBe(
      'testturneringen-a-spelarlista.html',
    )
  })

  it('given the arbiter set a standings page name, when standings are published, then that name is used', async () => {
    service.tournaments.update(tournamentId, {
      name: 'Testturneringen',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
      standingsPage: 'ställning-a',
    })
    await pairNextRound(tournamentId)

    const { filename } = await publishFile(tournamentId, 'standings')

    expect(filename).toBe('ställning-a.html')
  })

  it('given no rounds, when pairings are published as a file, then it fails like publishHtml', async () => {
    await expect(publishFile(tournamentId, 'pairings')).rejects.toThrow('No rounds available')
  })
})
