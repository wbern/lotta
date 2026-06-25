---
status: accepted
date: 2026-06-25

# Governs the scoring model and the settings that pick it: the result→points
# mapping, the lock set that protects it, and the dialog that selects it.
applies_to:
  - "src/domain/scoring.ts"
  - "src/domain/standings.ts"
  - "src/domain/tournament-lock.ts"
  - "src/db/repositories/tournaments.ts"
  - "src/components/dialogs/TournamentDialog.tsx"

pre_filter:
  - "chess4"
  - "pointsPerGame"
  - "calculateScores"
  - "getResultKeybinds"
  - "Poängsystem"
  - "maxPointsForWin"

complexity: standard
---

# 6. Scoring system is independent of the Schackfyran (chess4) format

> Author: architect · William ruling 2026-06-25: "you should be able to change the
> scoring to different types without it being explicitly a Schackfyran tournament
> — I never said you shouldn't be allowed to choose that if it's not a chess4
> tournament." Relates to ADR-0004 (lock SSOT) and ADR-0003 (boundary validation).

## Context

Scoring and the Schackfyran competition format are currently the same switch. The
3-2-1 result mapping (winner 3, draw 2, loser **1**) exists *only* inside the
`chess4` branch of `calculateScores`:

```typescript
const maxPointsForWin = chess4 ? pointsPerGame - 1 : pointsPerGame
// loser points = pointsPerGame - maxPointsForWin  → 1 only when chess4
```

So choosing "Schack4an (3-2-1)" in the Poängsystem selector forces `chess4: true`,
which in turn forces the Schackfyran pairing format and locks unrelated settings.
A user who just wants 3-2-1 scoring for an ordinary tournament cannot have it; and
no `pointsPerGame` value yields "loser scores 1" without `chess4`.

`chess4` legitimately carries the Schackfyran *format* (club/team competition,
member counts / klasstorlek, club standings, its pairing defaults). Scoring is a
separate dimension that was incorrectly welded to it.

## Decision

We will model the **scoring system as its own dimension**, independent of the
`chess4` format flag. `calculateScores` / `getResultKeybinds` derive the
result→points mapping from a scoring configuration (a result-points mapping or a
point-system value), **not** from the `chess4` boolean. Any scoring system —
standard 1-½-0, 3-2-1, 2-1-0, custom — is selectable for any tournament.

- The Poängsystem selector sets **scoring only**; it never toggles `chess4` and
  never locks unrelated pairing settings.
- `chess4` ("Detta är en schack4an-tävling") keeps the Schackfyran *format*
  concerns. It may **default** the scoring to 3-2-1, but it does not own or gate
  the scoring choice — a non-chess4 tournament may still be 3-2-1.

**Forbidden pattern:**
```typescript
// ❌ BAD — scoring derived from the format flag; 3-2-1 requires chess4
const maxPointsForWin = chess4 ? pointsPerGame - 1 : pointsPerGame
// ❌ BAD — selecting a scoring preset forces the format
if (preset === 'schack4an') handleChess4Toggle(true)
```

**Required pattern:**
```typescript
// ✅ GOOD — scoring derived from a config independent of chess4
const { win, draw, loss } = resultPoints(scoring) // 3-2-1 available with chess4=false
// ✅ GOOD — picking a scoring preset sets scoring only
if (preset === 'three-two-one') update({ scoring: THREE_TWO_ONE }) // chess4 untouched
```

Acceptance is pinned by `e2e/schack4an-points-locks-settings.spec.ts` (choosing
3-2-1 does not enable chess4 and does not lock pairing settings). The scoring
*math* itself (3-2-1 with `chess4=false` yields loser=1) is pinned by a
**green** unit test added in `src/domain/scoring.test.ts` as part of the
implementation — not a red unit test now, because the colocated vitest suite gates
CI/deploy (see CLAUDE.md). Failing acceptance specs live only in e2e, which does
not gate CI.

## Consequences

**Positive:**
- 3-2-1 (and other systems) become usable for ordinary tournaments.
- `chess4` narrows to a coherent "Schackfyran format" concept; scoring is reusable.

**Negative:**
- Needs a scoring representation and a migration so existing chess4 tournaments
  read as "3-2-1 scoring" explicitly rather than implicitly via the flag.
- Two dimensions to reason about (format × scoring) where there was one switch.

**Neutral:**
- `chess4` may still apply Schackfyran pairing defaults and seed the scoring to
  3-2-1; that is a default, not a lock.

## References

- `src/domain/scoring.ts` (`calculateScores`, `getResultKeybinds`), `src/components/dialogs/TournamentDialog.tsx` (`handlePresetChange`)
- ADR-0004 (the scoring config is part of the single lock source of truth)
