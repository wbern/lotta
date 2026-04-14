# Lotta Chess Pairer

A chess tournament management tool for running club-level and regional events: pairings, standings, player lists, live spectator views, and result publishing. Lotta runs entirely in your browser — no accounts, no servers, no subscriptions.

Lotta is a client-side progressive web app that's free to use and free to self-host.

## Try it

**[https://lotta.bernting.se](https://lotta.bernting.se)** — the hosted version is free, requires no signup, and works offline once loaded.

Because Lotta has no backend, "hosted" and "self-hosted" are functionally equivalent: both serve the same static files to your browser, and all tournament data lives in your browser's local storage (IndexedDB). The hosted version is simply a convenience for people who don't want to build and deploy their own copy.

## Demo

Full tournament lifecycle across three devices with P2P sync (organizer desktop, referee phone, club spectator phone):

https://github.com/wbern/lotta/raw/main/docs/tournament-lifecycle-demo.mp4

## Features

- **Three pairing algorithms** — Berger (round-robin), Monrad (Swiss), and Nordic Schweizer
- **Standings with configurable tiebreaks** — Buchholz, Sonneborn-Berger, median, progress, and more
- **Club standings** — aggregate individual results into team standings
- **Schack-4 variant support** — dedicated setup and scoring for the Swedish Schack-4 team format
- **Live P2P sharing** — broadcast pairings, boards, and scores to referees and spectators over WebRTC without any central server
- **HTML publishing** — generate standalone result pages (single HTML file with embedded CSS) for easy distribution
- **LiveChess PGN export** — export ongoing games in PGN for downstream broadcast tools
- **TSV import/export** — move player lists between Lotta and spreadsheet tools; handles both UTF-8 and Windows-1252 encodings
- **Backup and restore** — download or upload the full SQLite database as a single file
- **Undo** — step backwards through recent edits
- **Offline-capable PWA** — install as an app and keep running without a network connection after the first load
- **Swedish-first interface** — the UI is in Swedish, matching the audience the tool was designed for

## How it works

Lotta is a pure frontend application:

- **Runtime:** React 19, Vite, TanStack Router/Query, TypeScript
- **Database:** SQLite compiled to WebAssembly via [sql.js](https://github.com/sql-js/sql.js), persisted to IndexedDB on every mutation
- **Live sync:** [Trystero](https://github.com/dmotz/trystero) over Nostr (default) or MQTT, for serverless peer-to-peer connections between organizer, referees, and spectators
- **Hosting:** Any static file host — nothing runs server-side

There is no backend server in this architecture, and no database that the project maintainers control. Tournament data stays on the device you enter it on. Live sync flows directly between browsers over WebRTC; public Nostr relays or MQTT brokers are used only for signalling.

## Self-hosting

Because Lotta is a static single-page application, it deploys anywhere that can serve files. Pick whichever path fits your needs:

### Option 1 — Fork and deploy to GitHub Pages (easiest)

This is exactly what `lotta.bernting.se` does.

1. Fork this repository.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Push any commit to `main`. The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests, builds the site, and deploys it to Pages.
4. (Optional) Set a custom domain under **Settings → Pages** and add a CNAME record at your DNS provider pointing to `<your-username>.github.io`. GitHub will provision a Let's Encrypt certificate automatically.

### Option 2 — Any static host

Build locally and upload the `dist/` directory:

```bash
pnpm install
pnpm build
# Upload dist/ to your host of choice
```

This works on Cloudflare Pages, Netlify, Vercel, AWS S3 + CloudFront, nginx, Caddy, Apache, or a thumb drive you carry around. The only server-side requirement is falling back to `dist/index.html` for unknown routes (SPA routing). The GitHub Pages workflow handles this by copying `dist/index.html` to `dist/404.html` — replicate that trick on any host that doesn't natively support SPA fallback.

### Option 3 — Run it on an offline machine

Once Lotta has been loaded once in a browser, the service worker caches everything it needs to run offline. For a permanent offline setup (e.g., a club laptop that never touches the internet):

```bash
pnpm install
pnpm build
pnpm preview   # Serves dist/ on http://localhost:4173
```

Any static file server pointed at `dist/` works — `python3 -m http.server`, `npx serve`, or a pre-built nginx container.

### Optional configuration

Copy `.env.example` to `.env.local` and fill in any values you want baked into the build:

- `VITE_METERED_API_KEY` — a [metered.ca](https://metered.ca) account key used to fetch geographically closer TURN servers for the P2P live features. Optional; if left blank, Lotta falls back to public openrelay TURN servers. Most self-hosted setups do not need this.

In GitHub Actions deployments, these are supplied via repository or environment secrets. See the deploy workflow for the wiring.

## Development

```bash
pnpm install
pnpm dev           # Dev server on http://localhost:5173
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright)
pnpm lint
pnpm format
pnpm build         # Production build into dist/
```

Use **pnpm**, not npm — the project is committed to `pnpm-lock.yaml` and CI installs with `pnpm install --frozen-lockfile`.

See [`CLAUDE.md`](CLAUDE.md) for an overview of the architecture, key directories, and domain conventions.

## License

[MIT](LICENSE) — © 2026 William Bernting. Free to fork, modify, self-host, or redistribute. No warranty.
