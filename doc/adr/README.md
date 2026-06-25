# Architecture Decision Records — index

Canonical index of this project's ADRs. Architectural rules that apply across
changes are recorded here and enforced by [`wbern/adr-lint`](https://github.com/wbern/adr-lint),
which reads each ADR's `applies_to` globs, diffs the branch, and asks Claude
whether any rule was violated.

```bash
# one-time install
brew install wbern/tap/adr-lint   # or: go install github.com/wbern/adr-lint/go/cmd/adr-lint@latest
# check a branch (PR-review mode)
adr-lint --branch
```

`adr-lint` shells out to the Claude Code CLI for its analysis backend.

## How the review gate uses this index

1. Read this table for every ADR's **status** and **applies-to** scope.
2. **Select** only ADRs whose `applies_to` globs match a changed file.
3. **Enforce by status:** `accepted` → enforced · `proposed` → advisory ·
   `superseded`/`deprecated`/`rejected` → skipped.

## Index

| #    | Title                                                  | Status   | Applies to (summary)                                                              | Superseded by |
| ---- | ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------- | ------------- |
| 0001 | Persistence failures must surface to the user          | accepted | `src/api/**`, `src/hooks/**`, `src/components/**/*.tsx`                           | —             |
| 0002 | View/selection state is derived and validated vs data  | accepted | `src/components/layout/AppLayout.tsx`, `TournamentSelector.tsx`, `src/routes/**`  | —             |
| 0003 | Domain invariants validated at the repository boundary | accepted | `src/db/repositories/**`, `src/api/**`                                            | —             |
| 0004 | Single source of truth for field lock state            | accepted | `src/domain/tournament-lock.ts`, `tournaments.ts` repo, `TournamentDialog.tsx`   | —             |
| 0005 | Global keyboard handlers are modal-aware               | accepted | `src/components/dialogs/Dialog.tsx`, `useKeyboardShortcuts.ts`, `PairingsTab.tsx` | —             |
| 0006 | Scoring system is independent of the Schackfyran format | accepted | `src/domain/scoring.ts`, `standings.ts`, `tournament-lock.ts`, `TournamentDialog.tsx` | —         |

## Conventions

- **Numbers are permanent IDs.** Never renumber or reuse; retire in place
  (superseded/deprecated/rejected), don't delete.
- **Status vocabulary:** `proposed` (advisory) · `accepted` (enforced) ·
  `superseded` (replaced — see column) · `deprecated` (no longer applies) ·
  `rejected` (declined).
- **Adding an ADR:** copy `templates/template.md`, fill the `applies_to` /
  `pre_filter` frontmatter, and add a row here in the same change — the gate keys
  off this table.

## Acceptance specs

Each of ADR-0001…0005 has a failing e2e spec that pins its acceptance criteria
(the bug it forbids reproduced as a red test). A correct systemic fix turns the
whole cluster green:

- 0001 → `e2e/create-tournament-save-no-feedback.spec.ts`, `save-failure-*.spec.ts`
- 0002 → `e2e/view-state-invariant.spec.ts`
- 0003 → `e2e/input-validation.spec.ts`, `schack4an-coupling-edge-cases.spec.ts`
- 0004 → `e2e/tournament-lock-enforcement.spec.ts`
- 0005 → `e2e/keybind-modal-context.spec.ts`
- 0006 → `e2e/schack4an-points-locks-settings.spec.ts` (+ a green `scoring.test.ts` unit test added at implementation time)
