---
status: accepted
date: 2026-06-25

# Governs the data boundary: the repositories that write entities and the thin
# api wrappers over them. UI handlers may add convenience validation on top, but
# the boundary is the enforcement point.
applies_to:
  - "src/db/repositories/**/*.ts"
  - "src/api/**/*.ts"

pre_filter:
  - "create("
  - "update("
  - "insertRow"
  - "pointsPerGame"
  - "nrOfRounds"
  - "firstName"

complexity: standard
---

# 3. Domain invariants are validated at the repository boundary

> Author: architect · 2026-06-25. Triggered by `pointsPerGame=0` (and siblings
> `nrOfRounds=0`, whitespace-only player names, negative/NaN ratings) reaching
> persistence unguarded. Relates to ADR-0001 (failures must surface).

## Context

Repositories trust the DTOs they are handed. `TournamentRepository.create()`
writes `nrOfRounds`, `pointsPerGame`, etc. with no validation; player repos store
names without trimming. What validation exists lives in UI handlers as soft HTML
hints (`min={1}`) and truthiness checks — all bypassable by `page.fill()`, paste,
a direct `__lottaApi`/api call, a restored backup, or a future P2P submission.

Concrete corruption that persists today:
- `nrOfRounds = 0` bricks a tournament: `domain/pairing.ts` throws "Alla ronder är
  spelade!" on round 1 (`0 >= 0`), and it can never finalise.
- `pointsPerGame = 0` (or `NaN`, which SQLite coerces to 0 in the NOT NULL column)
  collapses all scoring to zero.
- A whitespace-only name passes the `firstName || lastName` truthiness guard
  (it isn't `.trim()`-ed like `TournamentDialog` does), creating blank players.
- Negative / `NaN` ratings persist and destabilise the rating sort used by pairing
  and standings.

Validation scattered across UI handlers is the wrong layer: it is duplicated,
inconsistent (some `.trim()`, some don't), and every non-UI entry path skips it.

## Decision

We will validate and normalise domain invariants **at the repository/api boundary**,
so invalid values are rejected (or normalised) on every entry path, and the
rejection is reported (per ADR-0001) rather than swallowed or crashing on a raw
SQLite error.

A shared validator/normaliser per DTO (e.g. on `CreateTournamentRequest`, the
player DTO) is the mechanism; the invariant is that **the repository never writes
a value that violates a domain rule, regardless of who called it.**

**Forbidden pattern:**
```typescript
// ❌ BAD — repo trusts the DTO; UI is the only (bypassable) guard
create(req: CreateTournamentRequest) {
  this.db.run(`INSERT INTO tournaments (...) VALUES (...)`, [req.nrOfRounds, req.pointsPerGame, ...])
}
```

**Required pattern:**
```typescript
// ✅ GOOD — boundary validates/normalises; invalid input is rejected uniformly
create(req: CreateTournamentRequest) {
  const v = validateTournament(req) // nrOfRounds >= 1, pointsPerGame >= 1 (finite int), name/group trimmed non-empty...
  this.db.run(`INSERT INTO tournaments (...) VALUES (...)`, [v.nrOfRounds, v.pointsPerGame, ...])
}
```

Acceptance is pinned by `e2e/input-validation.spec.ts` (creating with
`nrOfRounds=0` and a whitespace-only player are both rejected / not persisted) and
the existing `pointsPerGame=0` case in
`e2e/schack4an-coupling-edge-cases.spec.ts`. A `scoring.test.ts` boundary case may
document the scoring collapse for `ppg<1`.

## Consequences

**Positive:**
- One validator protects UI, direct api, restore, and future P2P paths alike.
- Raw SQLite/`UNIQUE constraint` errors become friendly, surfaced messages.

**Negative:**
- Some currently-accepted (degenerate) states become impossible; if any real data relies on them, a migration/normalisation is needed.
- Validation rules are a contract that must be kept in sync with domain expectations as scoring systems evolve.

**Neutral:**
- UI handlers may keep lightweight inline validation for fast feedback, but it is a convenience, not the enforcement point.

## References

- `src/db/repositories/tournaments.ts`, `src/db/repositories/available-players.ts`, `src/domain/scoring.ts`, `src/domain/pairing.ts`
- ADR-0001 (the surfaced-error half of "reject loudly")
