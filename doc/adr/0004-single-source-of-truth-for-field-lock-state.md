---
status: accepted
date: 2026-06-25

# Governs the lock model: the domain definition of what is locked when, the repo
# enforcement, and the dialog that disables controls from it.
applies_to:
  - "src/domain/tournament-lock.ts"
  - "src/db/repositories/tournaments.ts"
  - "src/components/dialogs/TournamentDialog.tsx"

pre_filter:
  - "isFieldLocked"
  - "LockableField"
  - "tournamentLockState"
  - "showELO"
  - "showGroup"

complexity: standard
---

# 4. Single source of truth for tournament field lock state

> Author: architect · 2026-06-25. Triggered by `showELO`/`showGroup` being
> editable post-lock because they were never added to the lockable set. Relates
> to ADR-0003 (boundary enforcement).

## Context

Once round 1 is paired, scoring/pairing settings must become immutable so results
already entered are not retroactively reinterpreted. Today this is expressed
twice: the `LockableField` union + `isFieldLocked()` in `domain/tournament-lock.ts`,
and a parallel set of guards in `TournamentRepository.update()`. The dialog
disables controls from `isFieldLocked(...)`.

Because the lockable-field list is hand-maintained in more than one place, fields
drift out of it. `showELO` and `showGroup` are disabled in the UI only by the live
`form.chess4` flag — they are absent from `LockableField` and unchecked in
`update()` — so a direct `__lottaApi.updateTournament` PUT on a locked chess4
tournament persists `showELO:true`, a state the UI can never produce. Adding the
two fields by hand in both places is the per-case patch; the real gap is that
"which fields are locked when" has no single owner.

## Decision

We will define **which fields are lockable and when, in one place**, and have both
the repository enforcement and the UI `disabled` state *derive from it*. Adding a
settings field that participates in the lock must be a one-line change in the
single definition, not a remember-to-update-three-files exercise.

**Forbidden pattern:**
```typescript
// ❌ BAD — UI disables via an ad-hoc flag; repo has a separate guard list; the
// field is in neither lock definition, so the api can mutate it post-lock.
<input checked={form.showGroup} disabled={form.chess4} ... />
// ...and tournaments.ts update() never checks showGroup.
```

**Required pattern:**
```typescript
// ✅ GOOD — one definition; repo and UI both consume it.
const LOCKED_AFTER_ROUND_1 = ['chess4','pointsPerGame','pairingSystem',
  'initialPairing','ratingChoice','showELO','showGroup','selectedTiebreaks',
  'barredPairing','compensateWeakPlayerPP'] as const
// repo update(): for each locked field, reject a change when state !== 'draft'
// dialog: disabled={isFieldLocked(field, lockState)}
```

Acceptance is pinned by `e2e/tournament-lock-enforcement.spec.ts`: a direct api
PUT changing `showELO`/`showGroup` on a locked chess4 tournament is rejected /
not persisted, alongside the already-enforced scoring fields.

## Consequences

**Positive:**
- The UI-disabled set and the repo-enforced set cannot drift; a control disabled on screen is genuinely immutable via the api.
- Adding a lockable field is one edit.

**Negative:**
- Requires deciding the intended lock semantics for presentation-only flags (are `showELO`/`showGroup` truly immutable post-lock, or merely chess4-forced?) — this ADR treats fields the chess4 contract forces as locked.

**Neutral:**
- The lock-state *predicate* (draft → in-progress → finalized) is unchanged; only the field set gains a single owner.

## References

- `src/domain/tournament-lock.ts`, `src/db/repositories/tournaments.ts` (`update()` guards)
- CLAUDE.md recurring-bug check #5 (scoring-change-after-results must be blocked at the repo layer)
