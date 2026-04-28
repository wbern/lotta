---
description: Code review using dynamic category detection and domain-specific analysis
argument-hint: (optional) [branch, PR#, or PR URL] - defaults to current branch
---

## General Guidelines

### Output Style

- **Never explicitly mention TDD** in code, comments, commits, PRs, or issues
- Write natural, descriptive code without meta-commentary about the development process
- The code should speak for itself - TDD is the process, not the product

# Code Review

Perform a code review using dynamic category detection.

## Phase 0: Setup & Categorization

### Determine What to Review

Parse the argument to determine the review target:

| Input | Action |
|-------|--------|
| No argument | Detect divergence point, confirm scope with user |
| Branch name | Use specified branch as base |
| PR number (e.g., `123`) | Fetch PR diff from GitHub |
| PR URL (e.g., `https://github.com/owner/repo/pull/123`) | Extract PR number and fetch diff |

**For GitHub PRs:**

1. Try GitHub MCP first: `mcp__github__pull_request_read` with `method: "get_diff"`
2. Fall back to `gh` CLI: `gh pr diff <number>`
3. If neither works, report error and stop

**For local branches (no argument or branch name provided):**

1. **Get current branch**: `git rev-parse --abbrev-ref HEAD`

2. **Check for uncommitted changes**: `git status --porcelain`
   - If output is non-empty, note that uncommitted changes exist

3. **Detect divergence point** (skip if branch name was provided as argument):
   - Get all local branches except current: `git branch --format='%(refname:short)'`
   - For each branch, find merge-base: `git merge-base HEAD <branch>`
   - Count commits from merge-base to HEAD: `git rev-list --count <merge-base>..HEAD`
   - The branch with the **fewest commits back** (closest merge-base) is the likely parent
   - If no other branches exist, fall back to `main`, `master`, or `develop` if they exist as remote tracking branches

4. **Confirm scope with user** using `AskUserQuestion`:

   **Question 1 - "Review scope"** (header: "Base branch"):
   - Option A: `From <detected-branch>` — "Review N commits since diverging from <branch>"
   - Option B: `Different branch` — "Specify another branch to compare against"
   - Option C: `Uncommitted only` — "Review only staged/unstaged changes, skip committed work"

   **Question 2 - "Include uncommitted?"** (header: "Uncommitted", only ask if uncommitted changes exist AND user didn't pick option C):
   - Option A: `Yes` — "Include N staged/unstaged files in review"
   - Option B: `No` — "Review only committed changes"

5. **Collect changed files** based on user selection:
   - From branch: `git diff --name-only <base>...HEAD`
   - Uncommitted unstaged: `git diff --name-only`
   - Uncommitted staged: `git diff --name-only --cached`
   - Combine and deduplicate the file list

6. **If no changes**: Report "Nothing to review" and stop

### Categorize Files

Check for CLAUDE.md - if it exists, note any project-specific review patterns.

Categorize each changed file into ONE primary category based on these patterns:

| Category | File Patterns |
|----------|---------------|
| Frontend/UI | `*.tsx`, `*.jsx`, `components/`, `pages/`, `views/`, `*.vue` |
| Frontend/Styling | `*.css`, `*.scss`, `*.less`, `styles/`, `*.tailwind*`, `*.styled.*` |
| Backend/API | `routes/`, `api/`, `controllers/`, `services/`, `*.controller.*`, `*.service.*`, `*.resolver.*` |
| Backend/Data | `migrations/`, `models/`, `prisma/`, `schema.*`, `*.model.*`, `*.entity.*` |
| Tooling/Config | `scripts/`, `*.config.*`, `package.json`, `tsconfig.*`, `vite.*`, `webpack.*`, `eslint.*` |
| CI/CD | `.github/`, `.gitlab-ci.*`, `Dockerfile`, `docker-compose.*`, `*.yml` in CI paths |
| Tests | `*.test.*`, `*.spec.*`, `__tests__/`, `__mocks__/`, `*.stories.*` |
| Docs | `*.md`, `docs/`, `README*`, `CHANGELOG*` |

Output the categorization:

```
## Categorization

Base branch: <branch>
Total files changed: <n>

| Category | Files |
|----------|-------|
| <category> | <count> |
...
```

## Phase 1: Branch Brief

From the diff and recent commit messages (`git log <base>...HEAD --oneline`), infer:

- **Goal**: What this branch accomplishes (1-3 sentences)
- **Constraints**: Any implied requirements (security, performance, backwards compatibility)
- **Success checklist**: What must work after this change, what must not break

```
## Branch Brief

**Goal**: ...
**Constraints**: ...
**Checklist**:
- [ ] ...
```

## Phase 2: Category Reviews

For each detected category with changes, run a targeted review. Skip categories with no changes.

### Frontend/UI Review Criteria

- Accessibility: ARIA attributes, keyboard navigation, screen reader support
- Component patterns: Composition, prop drilling, context usage
- State management: Unnecessary re-renders, stale closures
- Performance: memo/useMemo/useCallback usage, lazy loading, bundle impact

### Frontend/Styling Review Criteria

- Responsive design: Breakpoints, mobile-first
- Design system: Token usage, consistent spacing/colors
- CSS specificity: Overly specific selectors, !important usage
- Theme support: Dark mode, CSS variables

### Backend/API Review Criteria

- Input validation: Sanitization, type checking, bounds
- Security: Authentication checks, authorization, injection risks
- Error handling: Proper status codes, meaningful messages, logging
- Performance: N+1 queries, missing indexes, pagination

### Backend/Data Review Criteria

- Migration safety: Reversibility, data preservation
- Data integrity: Constraints, foreign keys, nullability
- Index usage: Queries have appropriate indexes
- Backwards compatibility: Existing data still works

### Tooling/Config Review Criteria

- Breaking changes: Does this affect developer workflow?
- Dependency compatibility: Version conflicts, peer deps
- Build performance: Added build time, bundle size

### CI/CD Review Criteria

- Secrets exposure: Credentials in logs, env vars
- Pipeline efficiency: Caching, parallelization
- Failure handling: Notifications, rollback strategy

### Tests Review Criteria

#### FIRST Principles

| Principle | What to Check |
|-----------|---------------|
| **Fast** | Tests complete quickly, no I/O, no network calls, no sleep()/setTimeout delays |
| **Independent** | No shared mutable state, no execution order dependencies between tests |
| **Repeatable** | No Date.now(), no Math.random() without seeding, no external service dependencies |
| **Self-validating** | Meaningful assertions that verify behavior, no manual verification needed |

#### TDD Anti-patterns

| Anti-pattern | Detection Signals |
|--------------|-------------------|
| **The Liar** | `expect(true).toBe(true)`, empty test bodies, tests with no assertions |
| **Excessive Setup** | >20 lines of arrange code, >5 mocks, deep nested object construction |
| **The One** | >5 assertions testing unrelated behaviors in a single test |
| **The Peeping Tom** | Testing private methods, asserting on internal state, tests that break on any refactor |
| **The Slow Poke** | Real database/network calls, file I/O, hard-coded timeouts |

#### Test Structure (AAA Pattern)

- **Arrange**: Clear setup with minimal fixtures
- **Act**: Single action being tested
- **Assert**: Specific, behavior-focused assertions

### Docs Review Criteria

- Technical accuracy: Code examples work, APIs documented correctly
- Completeness: All new features documented
- Clarity: Easy to follow, good examples

**Output format per category:**

```
## <Category> Review (<n> files)

### file:line - [blocker|risky|nit] Title
Description of the issue and why it matters.
Suggested fix or question to investigate.

...
```

## Phase 3: Cross-Cutting Analysis

After reviewing all categories, check for cross-cutting issues:

- API changed but tests didn't update?
- New feature but no documentation?
- Migration added but no rollback tested?
- Config changed but README not updated?
- Security-sensitive code without corresponding test?

```
## Cross-Cutting Issues

- [ ] <issue description>
...
```

## Phase 4: Summary

### PR Description (draft)

Provide a ready-to-paste PR description:

```
## What changed
- <by category, 1-2 bullets each>

## Why
- <motivation>

## Testing
- <how to verify>

## Notes
- <migration steps, breaking changes, etc.>
```

### Review Checklist

```
## Before Merge

### Blockers (must fix)
- [ ] ...

### Risky (highlight to reviewers)
- [ ] ...

### Follow-ups (can defer)
- [ ] ...
```

---

**User arguments:**

Code-review: $ARGUMENTS

**End of user arguments**

## Project-specific recurring-bug checks

Before grading, walk this checklist of bug classes we've actually shipped and had to fix. Each entry says **what to look for** and **how to verify**, with commit SHAs as evidence — `git show <sha>` if you need full context. Skip checks that don't apply. Issues found here are usually MAJOR or CRITICAL.

Note: Biome plugins (`pnpm check`) already catch four mechanically-detectable rules: `no-wait-for-response`, `no-hardcoded-resource-ids`, `no-navigator-online`, `no-online-network-mode`. Don't re-flag what Biome would catch — focus on the semantic checks below.

**1. P2P broadcast coverage on host state changes**

- Look for: a new host-side mutation (DB write, tournament switch, undo/redo, delete, restore, snapshot, round seed) without a corresponding P2P broadcast.
- Verify: every host mutation reaches `broadcastDataChanged` (or a more specific page/manifest broadcast). Direct DB writes via `__lottaApi` and backup/restore must trigger it too — not only React Query mutations.
- History: bbcd024, 3df14d5, 384ea7a, a643603, e0c0277, 37a8aa7, 566af71, 4efb1ba.

**2. Late-joiner / reconnect P2P state-sync**

- Look for: a new broadcast path that fires on the live mutation only, with nothing in `onPeerReconnected` or `sendCurrentStateToPeer`.
- Verify: late joiners and reconnecting peers receive the same state. P2P submission paths emit failure acks on disconnect, not silent drops.
- History: bbcd024, 7b00de8, aadcb1b.

**3. Long-mounted (`display:none`) component side effects**

- Look for: components like `LiveTab`, `PlayerPoolDialog`, `TournamentPlayersDialog`, dialogs kept mounted when closed.
- Verify: every `useEffect` is gated by an active flag (`isHosting`, `open`); document-title and live-context writes don't leak when the panel is hidden; state resets via a previous-value ref on the false→true transition when the panel reopens.
- History: 2177ca0, 8acd05f, c8a3c55.

**4. Permission/role inferred from absence**

- Look for: code branching on the *lack* of a permission to assign a role (e.g. "no write perm → must be Avläsare → club-scope them").
- Verify: classification uses positive signals (presence of write perms, redeemed code, sender role validation). Revoking a permission must re-evaluate already-connected peers, not only future handshakes.
- History: 7b00de8, d84b37b, d777522.

**5. Hardcoded scoring assumptions (chess4 / custom ppg)**

- Look for: `1`/`0.5`/`0` literals, numeric keybind tables, score→display strings hardcoded outside `src/domain/scoring.ts`.
- Verify: result mappings derive from the tournament's scoring config. Test mentally with Schackfyran (ppg=2) and custom ppg>1. Scoring-system change after results exist must be blocked at the repo layer, not only the UI.
- History: c77da46, 73f1c04, d6dff12.

**6. Publish/print grouping & data-source mismatches**

- Look for: pairings/standings HTML grouping by `playerGroup` when source is `club` (or vice versa), printing `lotNr` instead of `boardNr`, lists of clubs/groups not filtered to the tournament's participants.
- Verify: published output matches the on-screen source field. Toggle labels describe the actual grouping field. Multi-class chess4 and rounds where lotNr ≠ boardNr render correctly.
- History: 03eeb47, 4447b34, 26999aa, ebbadfa.

**7. Stale URL/router state across actions**

- Look for: actions that change context (pair new round, clear DB, switch tournament, delete) without clearing related query params (`?round=N`, `?tournamentId=N`).
- Verify: obsolete params are cleared on the action. E2E tests that check URL state should use functional probes when params can legitimately persist after a reload.
- History: 101b723, 97fdec5.

**8. Document-level event handlers firing in wrong context**

- Look for: `keydown`/`keyup` handlers attached to `document` that mutate data based on a selected row.
- Verify: handler scopes to `document.activeElement` matching an expected element type, and uses `mousedown` (not `click`) for selection-suppression `preventDefault`.
- History: b2516f4, a02910a, 5f13489.

**9. Sort order vs. display order**

- Look for: a table sorted by one field and rendered with another (e.g. sorts by first name, displays "LastName, FirstName"), or lists that include rows not in the current scope (zero-participant clubs in a tournament).
- Verify: visible primary column matches sort key; tournament-scoped lists filter to that tournament.
- History: 5889c1e, 9fedf0e, ebbadfa.

**10. E2E selector disambiguation**

- Look for: new UI introducing duplicate semantic elements (multiple selects, nested dialogs, sibling tabs) without `data-testid`.
- Verify: when adding a duplicate `<select>`, dialog, or tab, give the new one a `data-testid` so existing locators don't ambiguously match.
- History: 97fdec5, 39abbe8.
