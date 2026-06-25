# GOAL — systemic remediation of cross-cutting reliability & integrity gaps

Implement the six architectural decisions in `doc/adr/0001`–`0006` as **systemic**
changes, turning their failing acceptance specs green. This file is the contract
for the session.

## Progress

- ✅ **ADR-0001** — shared save-error surface (save() emits, one toast subscriber). Done.
- ✅ **ADR-0005** — Dialog owns focus; background keybinds suppressed under a modal. Done.
- ✅ **ADR-0003** — repository-boundary validation (nrOfRounds, pointsPerGame, blank names). Done.
- ✅ **ADR-0002** — active round derived & validated against data; URL self-heals. Done.
- ✅ **ADR-0004** — showELO/showGroup in the LockableField set, enforced in the repo. Done.
- ⏸️ **ADR-0006** — scoring decoupled from chess4. **Not started — large fork.** Needs a
  scoring representation decision (point-system enum vs win/draw/loss triple) and a
  schema + data migration for existing chess4 tournaments. Stopped here for that call.

Acceptance status: 25 acceptance tests green; the 3 remaining reds are all ADR-0006
(`schack4an-points-locks-settings` ×2 and the `edit-untoggle` restore in
`schack4an-coupling-edge-cases`). Unit suite (1367) and all quality gates green.

## Prime directive

Fix each concern **once, at the right layer** — never a hardcoded per-action
patch. If a fix looks like "when action X happens, also do Y," stop and find the
systemic root (that is exactly what these ADRs encode). See ADR bodies for the
forbidden vs required patterns.

## Hard guardrails

- **Never commit a red unit test.** The colocated vitest suite (`pnpm test`) gates
  CI/deploy. Failing *acceptance* specs live only in `e2e/` (which does not gate
  CI). New unit tests you add must be **green**.
- **Don't weaken or delete the acceptance specs** to make them pass — make the
  product behave. The `e2e/*` specs listed below are the definition of done.
- **pnpm only.** Never npm. Never run `pnpm test:e2e:browserstack`.
- Keep the existing test-only `data-testid`s (`club-add/rename/delete`,
  `pool-add-player`).
- Respect existing CLAUDE.md recurring-bug checks (esp. #1 P2P broadcast on host
  mutations — any new write path must still broadcast).
- Work on a feature branch (not `main`). Conventional Commits. One coherent commit
  per ADR is ideal.

## Per-change gate (run after each ADR)

```bash
pnpm check        # biome lint+format
pnpm exec tsc -b  # types
pnpm test         # unit — must stay green
pnpm knip         # dead code
pnpm jscpd        # copy-paste
pnpm exec playwright test --project=<the ADR's project(s)>   # acceptance → green
```

Final gate before done: `pnpm test:e2e` (Tier 1) green, and `adr-lint --branch`
clean.

---

## Work items (suggested order)

### 1. ADR-0001 — Persistence failures must surface
- **Systemic approach:** one shared failure surface on the write path — a global
  React Query `MutationCache.onError` (in the QueryClient setup) that shows a
  toast, and/or a failure signal from `withSave` (`src/api/service-provider.ts`).
  Route imperative writes (`deleteGame`, undo/redo) through the same channel.
  Do **not** add 17 individual `onError`s.
- **Likely files:** QueryClient setup, `src/api/service-provider.ts`, the toast
  system, the imperative write sites in `AppLayout.tsx` / `PairingsTab.tsx` /
  `useUndo.ts`.
- **Acceptance (→ green):** `create-tournament-save-no-feedback`,
  `save-failure-feedback`, `save-failure-pool`, `save-failure-tournament-players`,
  `save-failure-actions`.

### 2. ADR-0005 — Global keyboard handlers are modal-aware
- **Systemic approach:** make the `Dialog` primitive own focus (focus-trap on open,
  restore on close) and/or expose a shared "a modal is open" signal that global
  keybind hooks honour. Don't add per-handler `activeElement` special-cases.
- **Likely files:** `src/components/dialogs/Dialog.tsx`,
  `src/hooks/useKeyboardShortcuts.ts`, `src/components/tabs/PairingsTab.tsx`.
- **Acceptance (→ green):** `keybind-modal-context`.

### 3. ADR-0003 — Validate domain invariants at the repository boundary
- **Systemic approach:** a validation/normalisation step on the DTOs at the repo/
  api boundary (one validator per entity), so every entry path is covered. Surface
  rejections via the ADR-0001 channel (don't crash on raw SQLite errors).
- **Likely files:** `src/db/repositories/**`, `src/api/**`, a shared validator.
- **Acceptance (→ green):** `input-validation` (nrOfRounds=0, blank player), plus
  the ppg=0 test in `schack4an-coupling-edge-cases`.

### 4. ADR-0002 — Derive & validate view state against data
- **Systemic approach:** resolve the active tournament/round in one place,
  validated against existing data (clamp to nearest valid, else clear). Actions
  change data/intent; the resolver guarantees a valid view. (Option B — view state
  inside undo snapshots — is explicitly deferred.)
- **Likely files:** `src/components/layout/AppLayout.tsx` (`setTournamentId`,
  `activeRound`, unpair/undo handlers), `TournamentSelector.tsx`, route search params.
- **Acceptance (→ green):** `view-state-invariant`.

### 5. ADR-0006 — Scoring system independent of the Schackfyran (chess4) format
- **Decision (settled):** any scoring (1-½-0, 3-2-1, 2-1-0, custom) is selectable
  for any tournament; `chess4` is the Schackfyran *format* only.
- **Systemic approach:** derive `calculateScores` / `getResultKeybinds` from a
  scoring config (result→points / point-system), **not** the `chess4` boolean. The
  Poängsystem selector sets scoring only and never toggles chess4 or locks pairing.
  Provide a migration so existing chess4 tournaments read as explicit 3-2-1 scoring.
- **Likely files:** `src/domain/scoring.ts`, `src/domain/standings.ts`,
  `src/components/dialogs/TournamentDialog.tsx` (`handlePresetChange`),
  `src/db/repositories/tournaments.ts` + schema/migration.
- **Acceptance:** `schack4an-points-locks-settings` (→ green) **and** add a
  **green** unit test in `src/domain/scoring.test.ts` proving 3-2-1 (loser scores 1)
  with `chess4=false`. Also fix the `edit-untoggle` restore in
  `schack4an-coupling-edge-cases` (seed the pre-format snapshot in edit mode).

### 6. ADR-0004 — Single source of truth for field lock state
- **Do after/with 0006** (the scoring config becomes part of the lock set).
- **Systemic approach:** one definition of "which fields lock when"; both the repo
  `update()` enforcement and the dialog `disabled` state derive from it. Add
  `showELO`/`showGroup` to that single set (per the ruling that chess4-forced
  fields are locked post-round-1).
- **Likely files:** `src/domain/tournament-lock.ts`,
  `src/db/repositories/tournaments.ts` (`update()`), `TournamentDialog.tsx`.
- **Acceptance (→ green):** `tournament-lock-enforcement`.

---

## Definition of done

- Every acceptance project above passes; `pnpm test:e2e` (Tier 1) is green.
- `pnpm test` (unit) green, including the new scoring unit test.
- `pnpm check`, `pnpm exec tsc -b`, `pnpm knip`, `pnpm jscpd` clean.
- `adr-lint --branch` reports no violations of 0001–0006.
- No hardcoded per-action band-aids; each fix lives at the shared layer its ADR names.
