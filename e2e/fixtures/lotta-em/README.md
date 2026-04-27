# lotta-em fixtures

Recorded state from a real chess4 (schack4an) regional final tournament:
**Regionfinal Schackfyran 2 / Lördag em** — 12 schools, 70 players, 5 rounds,
36 boards per round. Used by `em-setup.spec.ts` and `em-replay.spec.ts` to
verify that the app deterministically reproduces a real tournament.

> **PII**: real surnames and school names have been replaced with deterministic
> hashes (`Spelare_<hex8>`, `Skola_<hex8>`) by `scripts/scrub-em-fixtures.ts`.
> First names, ratings, federation, ssfId/fideId (all empty), and the
> tournament name are unchanged. The mapping is sha256-derived, so re-running
> the scrub on the same input is a no-op. If you ever import a fresh real
> backup into this directory, run the scrub script before committing.

## What's here

### SQLite backups (raw exports of `lotta-backup (N).sqlite`)

| File | Captured at | Used by |
|---|---|---|
| `backup-pre-r1.sqlite` | Tournament configured, 70 players entered, 0 rounds | reference only |
| `backup-r1-paired.sqlite` | R1 paired (Slumpad / random), 2 results entered, 71 players | `em-replay.spec.ts` (seed) |
| `backup-r3-done-r4-partial.sqlite` | R3 complete, R4 partially entered | reference only |
| `backup-final-r5.sqlite` | All 5 rounds complete, every board has a result | source for `rounds.json` |

Only `backup-r1-paired.sqlite` is loaded at runtime — the replay test seeds
from there because R1 was paired with `Slumpad` (random) which is **not**
reproducible by re-running the algorithm. R2–R5 are deterministic given
identical inputs (Monrad).

### JSON fixtures (extracted from the SQLite files)

| File | Source | Contents |
|---|---|---|
| `clubs.json` | `backup-pre-r1.sqlite` | 12 schools (`name`, `chess4Members`) |
| `players-pre-r1.json` | `backup-pre-r1.sqlite` | 70 players with full rating columns, club name, etc. |
| `tournament-config.json` | `backup-pre-r1.sqlite` | Tournament settings (chess4, pointsPerGame=4, Monrad, …) |
| `rounds.json` | `backup-final-r5.sqlite` | 5 rounds × 36 games — pairings + result types + per-game scores |

## Regenerating fixtures

If the source `.sqlite` files change (e.g. a new tournament is recorded), the
JSONs can be re-derived from them. Quick recipe in Python:

```python
import json, sqlite3
con = sqlite3.connect('backup-pre-r1.sqlite')
con.row_factory = sqlite3.Row

# clubs.json
clubs = [dict(r) for r in con.execute(
    'SELECT clubIndex, name, chess4Members FROM clubs ORDER BY clubIndex')]

# rounds.json from backup-final-r5.sqlite — join games to tournamentPlayers
# and clubs to embed lastName/firstName/clubName for each side.
```

The schemas are stable across these snapshots; if Lotta's schema evolves,
update the queries to match.

## Why the replay pattern works

The app exposes `window.__lottaApi.restoreDbBytes(Uint8Array)` in dev mode
(see `src/dev/e2e-bridge.ts`). The replay test injects the post-R1 backup
directly, then drives the app through R2–R5 via `apiClient(page)` (`/api/...`
calls routed to the in-browser API). Pairings produced by the app are
compared to the recorded pairings in `rounds.json` by `(lastName, firstName,
club)` — **not** by the formatted `name` field, which is shaped by the
`playerPresentation` setting (FIRST_LAST vs LAST_FIRST) and would silently
couple the test to that setting.

This same pattern will be the baseline for upcoming p2p chaos tests:
multiple devices each replay the same recorded tournament under network
disruption, and we assert their final state still matches `backup-final-r5`.
