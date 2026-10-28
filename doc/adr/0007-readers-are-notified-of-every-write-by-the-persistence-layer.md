---
status: accepted
date: 2026-10-28

# Governs how views learn that tournament data changed: the persistence layer
# that announces writes, the one subscriber that refreshes queries, the query
# hooks, the P2P client feed, and the components that must read through hooks.
applies_to:
  - "src/db/database-service.ts"
  - "src/lib/data-changed-bus.ts"
  - "src/lib/query-invalidation.ts"
  - "src/query-client.ts"
  - "src/api/**/*.ts"
  - "src/hooks/**/*.ts"
  - "src/components/**/*.tsx"

pre_filter:
  - "invalidateQueries"
  - "refetchQueries"
  - "resetQueries"
  - "useQuery"
  - "useMemo"
  - "getDatabaseService"
  - "getDataProvider"
  - "Input("
  - "emitDataChanged"
  - "onDataChanged"
  - "save()"

# The forbidden per-site invalidation is caught mechanically; the model still
# reviews new read paths and new write paths.
enforced_by: "biome-plugins/no-direct-query-invalidation.grit, src/lib/data-flow-guard.test.ts"

complexity: standard
---

# 7. Readers are notified of every write by the persistence layer, not by the writer

> Author: architect · 2026-10-28. Owner-approved after an investigation that
> reproduced seven "stale view after a write" bugs, plus an eighth found while
> implementing (a P2P referee's result did not refresh the host's own screen).
> Relates to ADR-0001 (the same write path surfaces failures) and ADR-0002
> (view state derived from data).

## Context

Every view reads tournament data through a TanStack Query hook and is cached
(staleTime 5 s, no refetch on focus). Until now each *writer* refreshed the
views it thought of: a mutation hook's `onSuccess`, or a component handler,
called `invalidateQueries({ queryKey })` for a hand-picked list of keys. About
45 such call sites existed, and the list was wrong whenever a reader lived
under a key the writer did not think of:

- renaming a club refreshed `['clubs']` but not Ställning, Alfabetisk lottning
  or the player dialog's list, which all show the club name;
- switching Namnvisning refreshed `['settings']` but not the names in
  Lottning/Ställning, which are formatted by that setting;
- Ta bort bord refreshed the round list but not the tournament, so the status
  bar kept saying "Rond 1/N" and Turneringsspelare kept removal blocked;
- Editera bord (swap colours) refreshed pairings but not Ställning;
- a Schack4an class size refreshed `['clubs']` but not Schack4an ställning;
- the Alfabetisk lottning print view read the database directly in a `useMemo`,
  so nothing could ever refresh it;
- a result reported by a P2P referee was written on the host outside any
  mutation, so the host's own Lottning/Ställning never refreshed at all.

Each fix added another key to another list. The class of bug is structural: the
writer cannot know every reader, and new readers are added without touching
the writers.

Measured on real data, refetching *every* active DB query after a write costs
7 ms (150 players), 13 ms (7 rounds) and 21 ms (300 players, synthetic): cheap
enough to do on every write, keystroke-speed result entry included.

## Decision

We will notify readers of every write from the persistence layer, and refresh
every DB-derived query in one place:

1. `DatabaseService.save()` — where every local write ends (`withSave`,
   restore, undo/redo/restore-to-point, Derby import) — emits on the
   data-changed bus (`src/lib/data-changed-bus.ts`). It emits in `finally`:
   even if IndexedDB rejected the write, the in-memory database every query
   reads has changed, and the screen must not disagree with it (the failure
   itself is surfaced by ADR-0001's toast).
2. One subscriber, `installDataChangedInvalidation` (installed with the app's
   `queryClient`), invalidates every query whose `meta.source` is not
   `'network'`, coalesced to one invalidation per tick. Background refetches
   keep the previous data, so views do not flash a loading state.
3. Network-backed queries (`versions.json`) opt out with
   `meta: { source: 'network' }`.
4. P2P clients, whose writes never reach a local `save()`, feed the same bus:
   the host's `data-changed` broadcast emits on it, and the client provider
   emits when the host confirms one of the client's own writes.
5. The global `MutationCache.onSuccess` waits for that refresh, so a
   mutation still resolves after the views it changed are up to date
   (per-call `onSuccess` handlers read fresh data).
6. Components read tournament data only through `src/hooks` query hooks —
   never by calling the DB or API layer during render.

**Forbidden pattern:**
```typescript
// ❌ BAD — the writer guesses its readers; every reader it forgets stays stale
useMutation({
  mutationFn: (dto) => api.renameClub(id, dto),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['clubs'] }),
})

// ❌ BAD — a direct read in render: no write can ever refresh it
const printClasses = useMemo(() => buildAlphabeticalPairingsInput(tid, round), [tid, round])
```

**Required pattern:**
```typescript
// ✅ GOOD — the write ends in save(), which announces it; the hook names no keys
useMutation({ mutationFn: (dto) => api.renameClub(id, dto) })

// ✅ GOOD — the view reads through a query hook under the tournament's key
const { data } = useAlphabeticalPairings(tournamentId, roundNr)
```

Exceptions are scope changes, not data changes, and are listed with their
reason in `src/lib/data-flow-guard.test.ts` and the Biome plugin's excludes:
redeeming a club code (`SpectatorLayout.tsx`) changes which data the host lets
the peer read, so it refetches everything.

Acceptance is pinned by `e2e/stale-view-after-write.spec.ts` (the six UI
reproductions, red before this decision) and the WRITE MATRIX in
`src/lib/query-invalidation.test.ts` (every write API against a real database
marks every DB query stale and leaves `versions` alone), plus
`src/api/referee-result-refresh.test.ts` for the P2P referee path.

## Consequences

**Positive:**
- Every current and future write path refreshes every view by construction;
  about 45 hand-maintained invalidation lines are gone.
- New views are refreshed without touching any writer.
- Host and P2P clients use the same refresh path.

**Negative:**
- Every write refetches every active query (≤ 21 ms measured). A future
  expensive query will show up as slow writes, not as a stale view — profile
  before adding one.
- Queries that do not read the tournament database must remember
  `meta: { source: 'network' }`, or they refetch on every write.
- On a P2P client a write is refreshed twice (on the RPC confirmation and on
  the host's broadcast); both are background refetches.

**Neutral:**
- Mutation hooks keep their flow-specific `onSuccess`/`onError` (closing a
  dialog, toasts); they just no longer name query keys.

## References

- `src/db/database-service.ts` (`save()`), `src/lib/data-changed-bus.ts`,
  `src/lib/query-invalidation.ts`, `src/query-client.ts`
- `src/lib/save-error-bus.ts` — the ADR-0001 bus on the same write path
- `src/api/p2p-data-provider.ts` (`createP2pClientProvider`),
  `src/components/SharedView.tsx` (`onDataChanged`)
- 566af71 — precedent: broadcast data-changed on every host DB write
- 91f37cf — a per-site fix of this class (clubs created by an import)
- CLAUDE.md recurring-bug check #12
