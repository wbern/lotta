/**
 * Guard for ADR-0007 ("readers are notified of every write by the persistence
 * layer, not by the writer"). Scans the source so the two patterns behind the
 * stale-view bugs cannot come back unnoticed:
 *
 * 1. A writer invalidating the query keys it happens to think of. Every write
 *    already refreshes every DB-derived query via the data-changed bus.
 * 2. A component reading tournament data outside a query hook (direct DB or API
 *    read in render/useMemo). Such a read is never refreshed by the bus — the
 *    Alfabetisk lottning print view kept printing renamed players' old names.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

function sourceFiles(dir: string, ext: RegExp): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(path, ext))
    else if (ext.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

const rel = (path: string) => relative(SRC, path).split('\\').join('/')

/** Files allowed to invalidate queries directly, each with its reason. */
const INVALIDATION_ALLOWLIST: Record<string, string> = {
  'lib/query-invalidation.ts': 'the one data-changed subscriber',
  'components/SpectatorLayout.tsx':
    'club-code redeem changes what the host lets this peer read (scope, not data)',
}

/**
 * Components that may call the API layer directly: event handlers that write,
 * export or wire up P2P — never to read data for rendering.
 */
const API_IMPORT_ALLOWLIST = new Set([
  'components/layout/AppLayout.tsx',
  'components/dialogs/EditBoardDialog.tsx',
  'components/dialogs/SeedPlayersDialog.tsx',
  'components/SpectatorLayout.tsx',
  'components/SharedView.tsx',
  'components/LivePage.tsx',
  'components/tabs/LiveTab.tsx',
  'components/tabs/PairingsTab.tsx',
])

/** Components that may import runtime values from the DB layer. */
const DB_IMPORT_ALLOWLIST = new Set([
  // Rensa databas: deletes the IndexedDB database and reloads.
  'components/dialogs/SettingsDialog.tsx',
])

const INVALIDATION_CALL = /\.(invalidateQueries|refetchQueries|resetQueries)\(/
const DIRECT_READ_CALL =
  /\b(getDatabaseService|getDataProvider|getActiveDataProvider)\(|\bbuild\w+Input\(/

/** Runtime (non `import type`) imports of the given layer, e.g. '../../api/x'. */
function valueImportsFrom(source: string, layer: 'api' | 'db'): string[] {
  const re = new RegExp(`^import\\s+(?!type\\b)[^;]*?from\\s+'((?:\\.\\./)+${layer}/[^']+)'`, 'gm')
  return [...source.matchAll(re)].map((m) => m[1])
}

function directReadViolations(file: string, source: string): string[] {
  const problems: string[] = []
  if (DIRECT_READ_CALL.test(source)) problems.push(`${file}: reads data outside a query hook`)
  if (!API_IMPORT_ALLOWLIST.has(file)) {
    for (const spec of valueImportsFrom(source, 'api')) {
      problems.push(`${file}: imports ${spec} — read through a src/hooks query instead`)
    }
  }
  if (!DB_IMPORT_ALLOWLIST.has(file)) {
    for (const spec of valueImportsFrom(source, 'db')) {
      problems.push(`${file}: imports ${spec} — components must not touch the DB layer`)
    }
  }
  return problems
}

describe('ADR-0007 data-flow guard', () => {
  it('only the data-changed subscriber (and listed scope changes) invalidate queries', () => {
    const offenders = sourceFiles(SRC, /\.tsx?$/)
      .filter((f) => INVALIDATION_CALL.test(readFileSync(f, 'utf8')))
      .map(rel)
      .filter((f) => !(f in INVALIDATION_ALLOWLIST))
    expect(
      offenders,
      'Writes already refresh every DB-derived query (ADR-0007). Remove the ' +
        'invalidateQueries call; if it is a scope change, add the file to ' +
        'INVALIDATION_ALLOWLIST with the reason.',
    ).toEqual([])
  })

  it('components read tournament data only through query hooks', () => {
    const problems = sourceFiles(join(SRC, 'components'), /\.tsx$/).flatMap((f) =>
      directReadViolations(rel(f), readFileSync(f, 'utf8')),
    )
    expect(problems).toEqual([])
  })

  it('would have flagged the old Alfabetisk lottning print view', () => {
    const before = `import { useCallback, useMemo } from 'react'
import { buildAlphabeticalPairingsInput } from '../../api/publish-data'
import type { RoundDto } from '../../types/api'
const printClasses = useMemo(() => buildAlphabeticalPairingsInput(tournamentId, roundNr), [])`

    expect(directReadViolations('components/tabs/AlphabeticalPairingTab.tsx', before)).toEqual([
      'components/tabs/AlphabeticalPairingTab.tsx: reads data outside a query hook',
      'components/tabs/AlphabeticalPairingTab.tsx: imports ../../api/publish-data — read through a src/hooks query instead',
    ])
  })

  it('allows type-only imports from the API and DB layers', () => {
    const source = `import type { AuditEntry } from '../../db/undo-manager'
import type { RpcPermissions } from '../../api/p2p-data-provider'`

    expect(directReadViolations('components/layout/TimelinePanel.tsx', source)).toEqual([])
  })
})
