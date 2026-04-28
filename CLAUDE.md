# Lotta Chess Pairer

Swedish chess tournament management app. A fully client-side web application.

## Architecture

- **Frontend-only:** React 19 + Vite + TanStack Router/Query + TypeScript. Plain CSS. No backend server required.
- **Database:** sql.js (SQLite compiled to WebAssembly) running in-browser, persisted to IndexedDB. All data lives locally in the user's browser.
- **PWA:** Service worker (vite-plugin-pwa) precaches all assets including WASM for offline use. Uses `registerType: 'prompt'` so users choose when to update.
- **Always use pnpm** (never npm) — the project uses `pnpm-lock.yaml` and CI builds with `pnpm install --frozen-lockfile`.
- **Encoding:** Player TSV export includes UTF-8 BOM for Windows compatibility. Import auto-detects encoding (tries UTF-8, falls back to Windows-1252).

## Running

```bash
pnpm dev    # Dev server on port 5173
```

## Key files

- `src/db/` — Database layer: sql.js init, schema, IndexedDB persistence, repositories
- `src/db/database-service.ts` — `DatabaseService` singleton: creates DB, exposes repositories
- `src/db/repositories/` — Repository classes: clubs, tournaments, settings, available-players, tournament-players, games
- `src/api/` — API layer: thin async wrappers around DatabaseService (used by React hooks)
- `src/domain/` — Pure domain logic: scoring, tiebreaks, standings, pairing algorithms, HTML publishing, LiveChess PGN
- `src/hooks/` — TanStack Query hooks (useTournaments, useRounds, useStandings, etc.)
- `src/components/` — React components: layout, tabs, dialogs
- `src/types/api.ts` — Shared TypeScript interfaces (DTOs)
- `src/main.tsx` — App entry point: initializes DatabaseService from IndexedDB, renders React app

## Database layer

The app uses sql.js (SQLite in WebAssembly). On startup, `DatabaseService.create()` loads a previously saved database from IndexedDB, or creates a fresh one with the schema. All writes go through `withSave()` which auto-persists to IndexedDB after each mutation.

Key patterns:
- `getDatabaseService()` / `setDatabaseService()` — service locator in `api/service-provider.ts`
- `withSave(fn)` — runs sync function, then saves DB to IndexedDB
- Repository classes wrap raw SQL queries and return typed DTOs

## Domain modules

Pure functions with no DB dependency, tested independently:

- `domain/scoring.ts` — Result-to-score mapping (normal, WO, chess4 variants)
- `domain/tiebreaks.ts` — Buchholz, Sonneborn-Berger, median, etc.
- `domain/standings.ts` — Full standings calculation, club standings, chess4 standings
- `domain/pairing.ts` — Shared pairing prep (filter withdrawn, assign bye)
- `domain/pairing-berger.ts` — Berger round-robin pairing
- `domain/pairing-monrad.ts` — Monrad (Swiss) pairing
- `domain/pairing-nordic-schweizer.ts` — Nordic Schweizer pairing
- `domain/html-publisher.ts` — Generate standalone HTML pages for pairings, standings, etc.
- `domain/livechess.ts` — Generate PGN for LiveChess export

## Tests

Unit tests via Vitest, **colocated** with source (`foo.ts` → `foo.test.ts`).
Use `fake-indexeddb` for persistence; each test gets a fresh in-memory SQLite DB.

```bash
pnpm test              # run all unit tests
pnpm test:watch        # watch mode
```

## E2E tests

Playwright, **one project per spec file** (see `playwright.config.ts`). Split into tiers:

- **Tier 1 — default** (21 projects): non-p2p, localhost-only. Runs on every push to `main` via CI.
- **Tier 2 — p2p** (7 projects): needs MQTT broker + HTTPS + second dev server. Opt-in only. New p2p specs **must** be added inside the `runningP2P` conditional spread in `playwright.config.ts` — otherwise they leak into Tier 1 / CI.
- **Tier 3 — browserstack**: real devices, paid. Only runs when `BROWSERSTACK_USERNAME` is set.

```bash
pnpm test:e2e              # Tier 1 (same as CI)
pnpm test:e2e:p2p          # Tier 1 + Tier 2 — run before releases
pnpm test:e2e:browserstack # real devices — NEVER run without explicit ask
pnpm test:e2e:video        # Tier 1 + concat into showcase.mp4
pnpm exec playwright show-report    # open HTML report with per-test videos
```

**BrowserStack**: credentials are stored in macOS Keychain and loaded via `~/.zshrc`. Each run costs real minutes from a limited budget. Edit `browserstack.yml` to change target devices.

### Replay pattern (recorded-tournament tests)

Some e2e specs reproduce a real recorded tournament round-by-round to verify
deterministic behavior end-to-end (`em-setup.spec.ts`, `em-replay.spec.ts`).
The pattern, which is also the baseline for upcoming p2p chaos tests:

1. Capture SQLite backups + JSON fixtures under `e2e/fixtures/<name>/` —
   see that folder's `README.md` for what's required and how to regenerate.
2. Seed the app via `window.__lottaApi.restoreDbBytes(Uint8Array)` (exposed
   in dev mode by `src/dev/e2e-bridge.ts`). Use this when the starting state
   isn't reproducible from the algorithm — e.g. R1 of a `Slumpad` (random)
   pairing. Subsequent rounds are deterministic given identical inputs.
3. Drive each round through `apiClient(page)` (`/api/...` calls routed to
   the in-browser API), wrap each round in `await test.step(...)` for
   per-round failure isolation.
4. Compare app-generated pairings to the recorded fixture by
   `(lastName, firstName, club)` — **never** by the formatted `name` field,
   which is shaped by the `playerPresentation` setting and would silently
   couple the test to that setting. Build a `Map<id, PlayerKey>` from
   `/api/tournaments/:tid/players` and use it to tag both sides for
   comparison.

## Deployment & CI

GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on push to `main`:

1. `test` job — `pnpm test` (unit tests)
2. `deploy` job — `pnpm build` + publish to GitHub Pages

**E2E tests do NOT run on push** — by design; the suite is too slow to gate every merge. The `test-e2e` job is gated on a `workflow_dispatch` input (`run_e2e`, default false), so it only runs when manually triggered. Downstream `release`/`deploy` accept `test-e2e.result == 'skipped'` as success.

No backend required — the app is fully static. Tier 2/3 e2e tests are **not** run in CI either.

The **pre-commit hook does NOT run any test suite** (only lint/typecheck/knip/jscpd). Because nothing automatic runs e2e, if you change specs or covered code, run `pnpm test:e2e` manually before pushing.

## Commit hooks & code quality

Pre-commit and commit-msg hooks via Husky. Linting/formatting is **Biome** (not ESLint/Prettier).

```bash
pnpm format              # Biome: format all files
pnpm format:check        # Biome: check without writing
pnpm lint                # Biome: lint
pnpm check               # Biome: lint + format with --write
pnpm knip                # Dead code detection (unused files, exports, dependencies)
pnpm jscpd               # Copy-paste detection
pnpm secretlint '**/*'   # Secret scanning
```

**Pre-commit hook** (`.husky/pre-commit`): lint-staged (Biome on staged files) → secretlint → knip → jscpd → `tsc -b`. **No test runner.**

**Commit-msg hook** (`.husky/commit-msg`): commitlint enforces [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `chore:`, etc.).

## Domain notes

- 3 pairing algorithms: Berger (round-robin), Monrad (Swiss), NordicSchweizer
- Database backup/restore: download/upload raw SQLite binary
- HTML publishing: standalone HTML pages with embedded CSS
- LiveChess export: PGN format for unfinished games
- TSV import/export: player data with club associations

<claude-commands-template commands="code-review">

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

</claude-commands-template>
