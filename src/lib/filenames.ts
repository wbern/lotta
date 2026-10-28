/**
 * Download filenames for published pages, player exports and backups.
 *
 * Published pages follow `<tournament-slug>-<page>[-rond-N].html` unless the
 * tournament has its own page name (Java Lotta parity). A page name that is
 * still the pre-filled default counts as "not filled in".
 */

export const DEFAULT_PUBLISH_PAGES = {
  resultsPage: 'lottning.htm',
  standingsPage: 'stallning.htm',
  playerListPage: 'spelare.htm',
  roundForRoundPage: 'korstabell.htm',
  clubStandingsPage: 'klubbstallning.htm',
} as const

type PublishPageKey = keyof typeof DEFAULT_PUBLISH_PAGES

type PublishFilenameTournament = { name: string; group: string } & Record<
  PublishPageKey,
  string | undefined
>

const MAX_SLUG_LENGTH = 60

const SPELLED_OUT: Record<string, string> = { ø: 'o', æ: 'ae', ß: 'ss', đ: 'd', ł: 'l' }

export function slugifyFilename(input: string, fallback = 'turnering'): string {
  const slug = input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øæßđł]/g, (c) => SPELLED_OUT[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')
  return slug || fallback
}

export function tournamentSlug(name: string, group: string): string {
  return slugifyFilename(`${name} ${group}`.trim())
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what we strip
const FORBIDDEN_FILENAME_CHARS = /[/\\<>:"|?*\u0000-\u001f\u007f]/g

/**
 * Turn a user-entered page name into a safe download filename, or null when
 * there is no usable override (blank, the pre-filled default, or nothing left
 * after sanitising) so the caller falls back to the descriptive scheme.
 */
export function sanitizeUserFilename(
  value: string | undefined,
  extension: string,
  defaultValue?: string,
): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  if (defaultValue && trimmed.toLowerCase() === defaultValue.toLowerCase()) return null
  const cleaned = trimmed.replace(FORBIDDEN_FILENAME_CHARS, '').replace(/^\.+/, '')
  if (!cleaned) return null
  return /\.[a-z0-9]{1,5}$/i.test(cleaned) ? cleaned : `${cleaned}${extension}`
}

const PUBLISH_SCHEME: Record<
  string,
  { page: string; perRound: boolean; override: PublishPageKey }
> = {
  pairings: { page: 'lottning', perRound: true, override: 'resultsPage' },
  alphabetical: { page: 'alfabetisk-lottning', perRound: true, override: 'resultsPage' },
  standings: { page: 'stallning', perRound: true, override: 'standingsPage' },
  'club-standings': { page: 'klubbstallning', perRound: true, override: 'clubStandingsPage' },
  'chess4-standings': {
    page: 'schack4an-stallning',
    perRound: true,
    override: 'clubStandingsPage',
  },
  'cross-table': { page: 'korstabell', perRound: false, override: 'roundForRoundPage' },
  players: { page: 'spelarlista', perRound: false, override: 'playerListPage' },
}

/** `round` is the round actually rendered (already resolved by the caller). */
export function publishFilename(
  tournament: PublishFilenameTournament,
  what: string,
  round: number,
): string {
  const baseName = what.split('?')[0]
  const scheme = PUBLISH_SCHEME[baseName]
  if (!scheme) throw new Error(`Unknown publish type: ${what}`)
  const override = sanitizeUserFilename(
    tournament[scheme.override],
    '.html',
    DEFAULT_PUBLISH_PAGES[scheme.override],
  )
  if (override) return override
  const suffix = scheme.perRound ? `-rond-${round}` : ''
  return `${tournamentSlug(tournament.name, tournament.group)}-${scheme.page}${suffix}.html`
}

export function playerExportFilename(name: string, group: string): string {
  return `${tournamentSlug(name, group)}-spelare.tsv`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Local date and time, so two backups on the same day do not collide. */
export function backupFilename(
  date: Date,
  { legacy, encrypted }: { legacy: boolean; encrypted: boolean },
): string {
  const stamp = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}`
  return `lotta-backup-${legacy ? 'gammal-' : ''}${stamp}.sqlite${encrypted ? '.enc' : ''}`
}
