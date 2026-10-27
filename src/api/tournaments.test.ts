import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseService } from '../db/database-service.ts'
import { deleteDatabase } from '../db/persistence.ts'
import { setLocalProviderFactory } from './active-provider.ts'
import { dispatchBroadcast } from './broadcast-hook.ts'
import { getLocalProvider } from './local-data-provider.ts'
import { setDatabaseService } from './service-provider.ts'
import {
  createTournament,
  deleteTournament,
  exportTournamentPlayers,
  getTournament,
  importPlayers,
  listTournaments,
  updateTournament,
} from './tournaments.ts'

vi.mock('./broadcast-hook.ts', async () => {
  const actual = await vi.importActual<typeof import('./broadcast-hook.ts')>('./broadcast-hook.ts')
  return { ...actual, dispatchBroadcast: vi.fn().mockResolvedValue(undefined) }
})

describe('tournaments API (local)', () => {
  let service: DatabaseService

  beforeEach(async () => {
    service = await DatabaseService.create()
    setDatabaseService(service)
    setLocalProviderFactory(() => getLocalProvider())
  })

  afterEach(async () => {
    service.close()
    await deleteDatabase()
  })

  it('creates, reads, updates, and deletes a tournament', async () => {
    const created = await createTournament({
      name: 'Höstturneringen',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })

    expect(created.name).toBe('Höstturneringen')

    const list = await listTournaments()
    expect(list).toHaveLength(1)

    const fetched = await getTournament(created.id)
    expect(fetched.name).toBe('Höstturneringen')

    const updated = await updateTournament(created.id, {
      name: 'Vårturneringen',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 9,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    expect(updated.nrOfRounds).toBe(9)

    await deleteTournament(created.id)
    const afterDelete = await listTournaments()
    expect(afterDelete).toEqual([])
  })

  it('broadcasts a tournament-delete notice after deleting through the API', async () => {
    const created = await createTournament({
      name: 'Broadcast Test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })

    vi.mocked(dispatchBroadcast).mockClear()
    await deleteTournament(created.id)

    expect(dispatchBroadcast).toHaveBeenCalledWith({
      kind: 'tournamentDeleted',
      tournamentId: created.id,
    })
  })

  it('exports tournament players as TSV with UTF-8 BOM', async () => {
    const t = await createTournament({
      name: 'Export Test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })

    // Add a club first
    const club = service.clubs.create({ name: 'SK Linköping' })

    // Add players to the tournament
    service.tournamentPlayers.add(t.id, {
      lastName: 'Andersson',
      firstName: 'Anna',
      clubIndex: club.id,
    })
    service.tournamentPlayers.add(t.id, {
      lastName: 'Björk',
      firstName: 'Bo',
      // Group is never exported: old Lotta reads exactly three columns, and a
      // fourth column after an empty club makes it create a club named "".
      playerGroup: 'Junior',
    })

    const blob = await exportTournamentPlayers(t.id)
    const bytes = new Uint8Array(await blob.arrayBuffer())

    // Check UTF-8 BOM
    expect(bytes[0]).toBe(0xef)
    expect(bytes[1]).toBe(0xbb)
    expect(bytes[2]).toBe(0xbf)

    // Check content (after BOM)
    const text = new TextDecoder().decode(bytes.slice(3))
    const lines = text.split('\n').filter((l) => l !== '')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Andersson\tAnna\tSK Linköping')
    expect(lines[1]).toBe('Björk\tBo\t')
  })

  it('exports empty TSV for tournament with no players', async () => {
    const t = await createTournament({
      name: 'Empty',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })

    const blob = await exportTournamentPlayers(t.id)
    const bytes = new Uint8Array(await blob.arrayBuffer())

    // Should still have BOM
    expect(bytes[0]).toBe(0xef)
    expect(bytes[1]).toBe(0xbb)
    expect(bytes[2]).toBe(0xbf)

    // No content after BOM
    const text = new TextDecoder().decode(bytes.slice(3))
    expect(text).toBe('')
  })

  it('imports players from TSV file', async () => {
    const tsv = 'Andersson\tAnna\tSK Linköping\nBjörk\tBo\n'
    const file = new File([tsv], 'spelare.tsv', {
      type: 'text/tab-separated-values',
    })

    const result = await importPlayers(file)
    expect(result.imported).toBe(2)

    // Verify players were added to the available players pool
    const players = service.availablePlayers.list()
    expect(players).toHaveLength(2)
    expect(players[0].lastName).toBe('Andersson')
    expect(players[0].firstName).toBe('Anna')
    expect(players[0].club).toBe('SK Linköping')
    expect(players[1].lastName).toBe('Björk')
    expect(players[1].firstName).toBe('Bo')
  })

  it('import skips duplicate players (case-insensitive)', async () => {
    // Pre-create a player
    service.availablePlayers.create({
      lastName: 'Andersson',
      firstName: 'Anna',
    })

    const tsv = 'andersson\tanna\tSK Lund\nBjörk\tBo\n'
    const file = new File([tsv], 'spelare.tsv', {
      type: 'text/tab-separated-values',
    })

    const result = await importPlayers(file)
    expect(result.imported).toBe(1) // Only Björk imported

    const players = service.availablePlayers.list()
    expect(players).toHaveLength(2)
  })

  it('import auto-creates clubs', async () => {
    const tsv = 'Andersson\tAnna\tSK Norrköping\n'
    const file = new File([tsv], 'spelare.tsv', {
      type: 'text/tab-separated-values',
    })

    await importPlayers(file)

    // Verify club was created
    const clubs = service.clubs.list()
    expect(clubs.some((c) => c.name === 'SK Norrköping')).toBe(true)

    // Verify player has club association
    const players = service.availablePlayers.list()
    expect(players[0].club).toBe('SK Norrköping')
  })

  it('import handles UTF-8 BOM', async () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const content = new TextEncoder().encode('Åkesson\tÖrjan\n')
    const combined = new Uint8Array(bom.length + content.length)
    combined.set(bom)
    combined.set(content, bom.length)

    const file = new File([combined], 'spelare.tsv', {
      type: 'text/tab-separated-values',
    })

    const result = await importPlayers(file)
    expect(result.imported).toBe(1)

    const players = service.availablePlayers.list()
    expect(players[0].lastName).toBe('Åkesson')
    expect(players[0].firstName).toBe('Örjan')
  })

  it('import skips lines with fewer than 2 columns', async () => {
    const tsv = 'OnlyLastName\nAndersson\tAnna\n\n'
    const file = new File([tsv], 'spelare.tsv', {
      type: 'text/tab-separated-values',
    })

    const result = await importPlayers(file)
    expect(result.imported).toBe(1)

    const players = service.availablePlayers.list()
    expect(players).toHaveLength(1)
    expect(players[0].lastName).toBe('Andersson')
  })

  const tsvFile = (content: string | Uint8Array<ArrayBuffer>) =>
    new File([content], 'spelare.tsv', { type: 'text/tab-separated-values' })

  it('import reports duplicates and unreadable lines separately', async () => {
    const tsv = 'Andersson\tAnna\nandersson\tanna\nOnlyLast\n\t\tSK\n'

    const result = await importPlayers(tsvFile(tsv))

    expect(result).toEqual({ imported: 1, duplicates: 1, unreadable: 2 })
  })

  it('import ignores blank and tab-only lines without counting them as unreadable', async () => {
    const tsv = 'Andersson\tAnna\n\t\t\n   \n\n'

    const result = await importPlayers(tsvFile(tsv))

    expect(result).toEqual({ imported: 1, duplicates: 0, unreadable: 0 })
  })

  it('import rejects a file without tabs and writes nothing', async () => {
    const tsv = 'Andersson;Anna;SK Lund\nBjörk;Bo;SK Lund\n'

    await expect(importPlayers(tsvFile(tsv))).rejects.toThrow(/tabbseparerad/)
    expect(service.availablePlayers.list()).toHaveLength(0)
    expect(service.clubs.list()).toHaveLength(0)
  })

  it('import rejects an empty file as containing no players', async () => {
    await expect(importPlayers(tsvFile(''))).rejects.toThrow('Filen innehåller inga spelare.')
    await expect(importPlayers(tsvFile(' \n\t\n'))).rejects.toThrow(
      'Filen innehåller inga spelare.',
    )
    expect(service.availablePlayers.list()).toHaveLength(0)
  })

  it('import skips a leading Efternamn/Förnamn header row', async () => {
    const tsv = 'Efternamn\tFörnamn\tKlubb\nAndersson\tAnna\tSK Lund\n'

    const result = await importPlayers(tsvFile(tsv))

    expect(result).toEqual({ imported: 1, duplicates: 0, unreadable: 0 })
    expect(service.availablePlayers.list().map((p) => p.lastName)).toEqual(['Andersson'])
    expect(service.clubs.list().map((c) => c.name)).toEqual(['SK Lund'])
  })

  it('import only treats the first line as a header', async () => {
    const tsv = 'Andersson\tAnna\nEfternamn\tFörnamn\n'

    const result = await importPlayers(tsvFile(tsv))

    expect(result.imported).toBe(2)
  })

  it('import splits lines on lone carriage returns', async () => {
    const tsv = 'Andersson\tAnna\tSK Lund\rBjörk\tBo\tSK Lund\r'

    const result = await importPlayers(tsvFile(tsv))

    expect(result.imported).toBe(2)
    expect(service.availablePlayers.list().map((p) => p.club)).toEqual(['SK Lund', 'SK Lund'])
  })

  it('import reads old Lotta exports (Windows-1252, CRLF)', async () => {
    // "Åkesson\tÖrjan\tSK Lund\r\nBjörk\tBo\t\r\n" encoded as Windows-1252
    const bytes = new Uint8Array([
      0xc5, 0x6b, 0x65, 0x73, 0x73, 0x6f, 0x6e, 0x09, 0xd6, 0x72, 0x6a, 0x61, 0x6e, 0x09, 0x53,
      0x4b, 0x20, 0x4c, 0x75, 0x6e, 0x64, 0x0d, 0x0a, 0x42, 0x6a, 0xf6, 0x72, 0x6b, 0x09, 0x42,
      0x6f, 0x09, 0x0d, 0x0a,
    ])

    const result = await importPlayers(tsvFile(bytes))

    expect(result).toEqual({ imported: 2, duplicates: 0, unreadable: 0 })
    const players = service.availablePlayers.list()
    expect(players.find((p) => p.lastName === 'Åkesson')).toMatchObject({
      firstName: 'Örjan',
      club: 'SK Lund',
    })
    expect(players.find((p) => p.lastName === 'Björk')).toMatchObject({
      firstName: 'Bo',
      club: null,
    })
  })

  it('import keeps the existing column handling for lines starting with a tab', async () => {
    // Old Lotta trims the whole line before splitting; keep that parity.
    const tsv = '\tAnna\tSK\tKlubb\n'

    await importPlayers(tsvFile(tsv))

    expect(service.availablePlayers.list()[0]).toMatchObject({
      lastName: 'Anna',
      firstName: 'SK',
      club: 'Klubb',
    })
  })

  it('import reads an optional fourth column as player group', async () => {
    const tsv = 'Andersson\tAnna\tSK Lund\t1\nBjörk\tBo\tSK Lund\n'

    await importPlayers(tsvFile(tsv))

    const players = service.availablePlayers.list()
    expect(players.find((p) => p.lastName === 'Andersson')?.playerGroup).toBe('1')
    expect(players.find((p) => p.lastName === 'Björk')?.playerGroup).toBe('')
  })

  it('import reads a group without a club', async () => {
    await importPlayers(tsvFile('Andersson\tAnna\t\tJunior\n'))

    expect(service.availablePlayers.list()[0]).toMatchObject({ club: null, playerGroup: 'Junior' })
    expect(service.clubs.list()).toHaveLength(0)
  })

  it('import trims the group and ignores columns after it', async () => {
    await importPlayers(tsvFile('Andersson\tAnna\tSK Lund\t B \textra\n'))

    expect(service.availablePlayers.list()[0].playerGroup).toBe('B')
  })

  it('import does not change the group of an existing player', async () => {
    service.availablePlayers.create({ lastName: 'Andersson', firstName: 'Anna', playerGroup: 'X' })

    const result = await importPlayers(tsvFile('Andersson\tAnna\tSK Lund\tY\n'))

    expect(result.duplicates).toBe(1)
    expect(service.availablePlayers.list()[0].playerGroup).toBe('X')
  })

  it('import accepts a header row with a Grupp column', async () => {
    const result = await importPlayers(
      tsvFile('Efternamn\tFörnamn\tKlubb\tGrupp\nAndersson\tAnna\tSK Lund\t2\n'),
    )

    expect(result).toEqual({ imported: 1, duplicates: 0, unreadable: 0 })
    expect(service.availablePlayers.list()[0].playerGroup).toBe('2')
  })

  it('import reuses existing clubs', async () => {
    service.clubs.create({ name: 'SK Lund' })

    const tsv = 'Andersson\tAnna\tSK Lund\nBjörk\tBo\tSK Lund\n'
    const file = new File([tsv], 'spelare.tsv', {
      type: 'text/tab-separated-values',
    })

    await importPlayers(file)

    // Should still have only 1 club
    const clubs = service.clubs.list()
    expect(clubs.filter((c) => c.name === 'SK Lund')).toHaveLength(1)

    // Both players should reference the same club
    const players = service.availablePlayers.list()
    expect(players[0].club).toBe('SK Lund')
    expect(players[1].club).toBe('SK Lund')
  })
})
