import { describe, expect, it } from 'vitest'
import {
  backupFilename,
  DEFAULT_PUBLISH_PAGES,
  playerExportFilename,
  publishFilename,
  sanitizeUserFilename,
  slugifyFilename,
  tournamentSlug,
} from './filenames'

const T = { name: 'Göteborgs KM – Vår 2026', group: 'A' }
const SLUG = 'goteborgs-km-var-2026-a'
const NO_OVERRIDES = {
  resultsPage: '',
  standingsPage: '',
  playerListPage: '',
  roundForRoundPage: '',
  clubStandingsPage: '',
}
const tournament = (overrides: Partial<typeof NO_OVERRIDES> = {}) => ({
  ...T,
  ...NO_OVERRIDES,
  ...overrides,
})

describe('slugifyFilename', () => {
  it('given a Swedish tournament name with a dash and group, when slugified, then it becomes lowercase ascii joined by single dashes', () => {
    expect(tournamentSlug('Göteborgs KM – Vår 2026', 'A')).toBe(SLUG)
  })

  it('given Nordic letters and accents, when slugified, then å/ä/ö/é/ø fold to plain letters', () => {
    expect(slugifyFilename('ÅÄÖ åäö é ø')).toBe('aao-aao-e-o')
  })

  it('given æ, ß, đ and ł, when slugified, then they are spelled out', () => {
    expect(slugifyFilename('Æble Straße Đak Łódź')).toBe('aeble-strasse-dak-lodz')
  })

  it('given only separators, when slugified, then the fallback is used', () => {
    expect(slugifyFilename('///')).toBe('turnering')
    expect(slugifyFilename('', 'spelare')).toBe('spelare')
  })

  it('given leading and trailing junk, when slugified, then no dash is left at either end', () => {
    expect(slugifyFilename('  --Höst!!  ')).toBe('host')
  })

  it('given a very long name, when slugified, then it is capped at 60 characters without a trailing dash', () => {
    const slug = slugifyFilename(`${'a'.repeat(59)} bbbb`)
    expect(slug).toBe('a'.repeat(59))
    expect(slugifyFilename('x'.repeat(100))).toHaveLength(60)
  })

  it('given an empty group, when the tournament slug is built, then no trailing dash appears', () => {
    expect(tournamentSlug('Vårblixten', '')).toBe('varblixten')
  })
})

describe('publishFilename scheme', () => {
  it.each([
    ['pairings', 3, `${SLUG}-lottning-rond-3.html`],
    ['alphabetical?groupByClass=0&columns=4', 2, `${SLUG}-alfabetisk-lottning-rond-2.html`],
    ['standings', 5, `${SLUG}-stallning-rond-5.html`],
    ['club-standings', 4, `${SLUG}-klubbstallning-rond-4.html`],
    ['chess4-standings', 1, `${SLUG}-schack4an-stallning-rond-1.html`],
    ['cross-table', 7, `${SLUG}-korstabell.html`],
    ['players', 7, `${SLUG}-spelarlista.html`],
  ])('given no override, when %s is published for round %i, then the file is %s', (what, round, expected) => {
    expect(publishFilename(tournament(), what, round)).toBe(expected)
  })

  it('given the tournament still has the pre-filled default page names, when published, then the descriptive scheme is used', () => {
    expect(publishFilename(tournament(DEFAULT_PUBLISH_PAGES), 'standings', 2)).toBe(
      `${SLUG}-stallning-rond-2.html`,
    )
  })
})

describe('publishFilename overrides (Java parity)', () => {
  it('given resultsPage, when pairings or alphabetical are published, then that name is used', () => {
    const t = tournament({ resultsPage: 'resultat' })
    expect(publishFilename(t, 'pairings', 1)).toBe('resultat.html')
    expect(publishFilename(t, 'alphabetical', 1)).toBe('resultat.html')
  })

  it('given standingsPage, when standings are published, then it is used verbatim without a round suffix', () => {
    expect(publishFilename(tournament({ standingsPage: 'Ställning.htm' }), 'standings', 4)).toBe(
      'Ställning.htm',
    )
  })

  it('given clubStandingsPage, when club or Schack4an standings are published, then it is used for both', () => {
    const t = tournament({ clubStandingsPage: 'klubbar.htm' })
    expect(publishFilename(t, 'club-standings', 2)).toBe('klubbar.htm')
    expect(publishFilename(t, 'chess4-standings', 2)).toBe('klubbar.htm')
  })

  it('given roundForRoundPage and playerListPage, when cross table and player list are published, then they are used', () => {
    const t = tournament({ roundForRoundPage: 'kors.htm', playerListPage: 'deltagare.htm' })
    expect(publishFilename(t, 'cross-table', 3)).toBe('kors.htm')
    expect(publishFilename(t, 'players', 3)).toBe('deltagare.htm')
  })

  it('given an override for another page, when standings are published, then the scheme is used', () => {
    expect(publishFilename(tournament({ resultsPage: 'resultat' }), 'standings', 1)).toBe(
      `${SLUG}-stallning-rond-1.html`,
    )
  })
})

describe('sanitizeUserFilename', () => {
  it('given a name without extension, when sanitised, then .html is appended', () => {
    expect(sanitizeUserFilename('resultat', '.html')).toBe('resultat.html')
  })

  it('given a name with an extension, when sanitised, then it is kept verbatim', () => {
    expect(sanitizeUserFilename('Ställning.htm', '.html')).toBe('Ställning.htm')
  })

  it('given path separators and leading dots, when sanitised, then they are stripped', () => {
    expect(sanitizeUserFilename('../x/y.php', '.html')).toBe('xy.php')
    expect(sanitizeUserFilename('a<b>:c"d|e?f*g\\h\u0001', '.html')).toBe('abcdefgh.html')
  })

  it('given a blank value, when sanitised, then there is no override', () => {
    expect(sanitizeUserFilename('   ', '.html')).toBeNull()
    expect(sanitizeUserFilename(undefined, '.html')).toBeNull()
  })

  it('given the pre-filled default (any case), when sanitised, then there is no override', () => {
    expect(sanitizeUserFilename('Stallning.HTM', '.html', 'stallning.htm')).toBeNull()
  })

  it('given only forbidden characters, when sanitised, then there is no override', () => {
    expect(sanitizeUserFilename('../', '.html')).toBeNull()
  })
})

describe('playerExportFilename', () => {
  it('given a tournament, when players are exported, then the file is <slug>-spelare.tsv', () => {
    expect(playerExportFilename(T.name, T.group)).toBe(`${SLUG}-spelare.tsv`)
  })
})

describe('backupFilename', () => {
  const at = new Date(2026, 2, 7, 9, 5)

  it('given a plain backup, when named, then it carries the zero-padded local date and time', () => {
    expect(backupFilename(at, { legacy: false, encrypted: false })).toBe(
      'lotta-backup-2026-03-07-0905.sqlite',
    )
  })

  it('given a legacy backup, when named, then it is marked gammal', () => {
    expect(backupFilename(at, { legacy: true, encrypted: false })).toBe(
      'lotta-backup-gammal-2026-03-07-0905.sqlite',
    )
  })

  it('given an encrypted backup, when named, then .enc is appended (also for legacy)', () => {
    expect(backupFilename(at, { legacy: false, encrypted: true })).toBe(
      'lotta-backup-2026-03-07-0905.sqlite.enc',
    )
    expect(backupFilename(at, { legacy: true, encrypted: true })).toBe(
      'lotta-backup-gammal-2026-03-07-0905.sqlite.enc',
    )
  })
})
