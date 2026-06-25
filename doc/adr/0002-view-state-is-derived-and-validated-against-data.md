---
status: accepted
date: 2026-06-25

# Governs the selection/router layer: how the active tournament/round/tab are
# resolved from URL params, and the actions that change that context.
applies_to:
  - "src/components/layout/AppLayout.tsx"
  - "src/components/layout/TournamentSelector.tsx"
  - "src/routes/**/*.tsx"
  - "src/hooks/useRounds.ts"
  - "src/hooks/useTournaments.ts"

pre_filter:
  - "navigate"
  - "search"
  - "activeRound"
  - "currentRound"
  - "tournamentId"
  - "round"

complexity: standard
---

# 2. View/selection state is derived and validated against the data

> Author: architect · 2026-06-25. Generalises a cluster of "stale view" findings
> (switch tournament, unpair last round, undo a pairing) into one rule. William's
> framing: don't hardcode "when undo of pairing happens, clear ?round" — make the
> view self-heal systemically. Relates to ADR-0001.

## Context

The active context lives in URL params (`?tournamentId`, `?round`, `?tab`) and is
maintained ad-hoc per action. Some actions remember to reconcile the URL when the
data changes — `confirmDelete` and restore-from-backup navigate to clear `round`
and `tournamentId` — while others do not:

- **Switching tournaments** forwards the *old* round: `setTournamentId` navigates
  with `round: currentRound` (`AppLayout.tsx`), so viewing round 3 of A and
  switching to B (which has 1 round) leaves `?round=3` — an empty pairings view
  and a round `<select>` whose value matches no option.
- **Unpairing the last round** updates nothing (`onSuccess: () => setShowUnpairConfirm(false)`),
  so `?round=N` dangles at a round that no longer exists.
- **Undo / redo / restore-to-point** only `invalidateQueries()`; they never
  navigate, so undoing a pairing leaves `?round` pointing at the removed round
  (and undoing a tournament create leaves `?tournamentId` dangling).

These are not three bugs with three fixes. The root is that **view state can
reference data that no longer exists, and nothing reconciles the two.** A
per-action patch would have to be repeated for every current and future action
that mutates rounds/tournaments.

## Decision

We will make the active selection **derived and validated against the current
data in one place**, so an out-of-range or dangling param self-heals regardless
of which action caused the divergence. The resolver clamps to the nearest valid
value (e.g. latest existing round) or clears the param when nothing valid exists.

**Forbidden pattern:**
```typescript
// ❌ BAD — each action hand-maintains the URL; new actions forget to, and the
// view can point at a round/tournament that no longer exists.
const setTournamentId = (id) =>
  navigate({ to: '/', search: { tournamentId: id, round: currentRound, tab } })
```

**Required pattern:**
```typescript
// ✅ GOOD — one resolver validates the requested selection against the data;
// callers express intent, the resolver guarantees a valid view.
const activeRound = resolveActiveRound(requestedRound, tournament.rounds)
//   = requestedRound if it exists, else latest existing round, else undefined
// Actions just change the data / requested id; they never need to remember to
// clear ?round — the resolver does, everywhere, by construction.
```

Acceptance is pinned by `e2e/view-state-invariant.spec.ts`: after switching
tournaments, unpairing the last round, and undoing a pairing, the active round in
the URL must reference an existing round (or be cleared) and the pairings view
must not be a false "empty" for data that exists.

This ADR adopts **derive-and-validate at the selection layer** (option A).
Capturing view state *inside* undo snapshots so undo returns you to the exact
prior view (option B) is a separate, additive product decision deferred to a
future ADR; it is not required to make the view valid.

## Consequences

**Positive:**
- Every "stale view" cause (switch, unpair, undo, redo, restore, delete) is fixed at once and future actions are correct by construction.
- The round/tournament `<select>` can no longer show a value with no matching option.

**Negative:**
- "Undo" will not necessarily restore the *exact* prior view (that is option B, deferred); it guarantees a *valid* view.
- The resolver must run reactively wherever the selection is consumed; getting the dependency tracking right needs care.

**Neutral:**
- Existing explicit `navigate()` clears (delete, restore) become redundant safety nets once the resolver exists; they can stay or be removed.

## References

- `src/components/layout/AppLayout.tsx` (`setTournamentId`, `activeRound`, unpair/undo handlers)
- ADR-0001 (the companion "no silent failure" rule on the write path)
