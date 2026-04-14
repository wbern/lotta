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

Unit tests via Vitest. Tests use `fake-indexeddb` for persistence and create fresh in-memory SQLite databases per test.

```bash
pnpm test              # run all tests
pnpm test:watch        # watch mode
```

## E2E tests

```bash
pnpm test:e2e              # run tests
pnpm test:e2e:video        # run tests + concat into showcase.mp4
pnpm exec playwright show-report    # open HTML report with per-test videos
```

## BrowserStack (real device testing)

Runs E2E tests on real phones/tablets via BrowserStack Automate. Credentials are stored in macOS Keychain and loaded via `~/.zshrc`.

```bash
pnpm test:e2e:browserstack e2e/app.spec.ts --grep "loads and shows layout shell"
pnpm test:e2e:browserstack e2e/browserstack-p2p.spec.ts
```

**NEVER run BrowserStack tests unless the user explicitly asks.** Each run costs real minutes from a limited budget. Edit `browserstack.yml` to change target devices.

## Deployment

GitHub Actions workflow builds on push to `main` and deploys to GitHub Pages. No backend required — the app is fully static.

## Commit hooks & code quality

Pre-commit and commit-msg hooks via Husky.

```bash
pnpm format              # Prettier: format all files
pnpm format:check        # Prettier: check without writing
pnpm lint                # ESLint
pnpm knip                # Dead code detection (unused files, exports, dependencies)
pnpm jscpd               # Copy-paste detection
pnpm secretlint '**/*'   # Secret scanning
```

**Pre-commit hook** (`.husky/pre-commit`): lint-staged (ESLint + Prettier on staged src files) → secretlint → knip → jscpd → `tsc --noEmit`.

**Commit-msg hook** (`.husky/commit-msg`): commitlint enforces [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `chore:`, etc.).

## Domain notes

- 3 pairing algorithms: Berger (round-robin), Monrad (Swiss), NordicSchweizer
- Database backup/restore: download/upload raw SQLite binary
- HTML publishing: standalone HTML pages with embedded CSS
- LiveChess export: PGN format for unfinished games
- TSV import/export: player data with club associations
