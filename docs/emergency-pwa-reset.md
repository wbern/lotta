# Emergency PWA reset (selfDestroying release)

A one-time release that wipes every installed service worker and Cache
Storage entry on next visit. Use only as a last resort.

## When to use

Only when monitoring/support reports show users stuck >24h on a broken
cached build that lower-impact recovery paths cannot fix:

1. **`?reset=1` URL** (lt-4d9) — inline killswitch in `index.html`. Works
   if the user can load any page on the site at all.
2. **`/recovery.html` Säkert läge** (lt-n7z + lt-gqt/79g/l88/y0g/15v/3jw)
   — standalone lifeboat page that bypasses the SW navigation route.
   Renders a diagnostics panel, lets users download a raw SQLite backup
   first, copy diagnostics to clipboard, and choose between three
   granular destructive actions (clear caches / unregister SWs / full
   nuke). Linked from "Om Lotta → Säkert läge / Återställning" (lt-0ux).
   Works if the user can be told the URL or open the in-app dialog.
3. **selfDestroying release** — this document. The nuclear option, shipped
   to all users automatically.

If the first two don't apply (e.g. users can't act on instructions, or the
broken build doesn't ship the killswitch), go to step 3.

## Preconditions

- `vite-plugin-pwa` is at >= 0.17.2 (caches are wiped on activate). The
  project is currently on 1.x — verify in `package.json`.
- A normal release process is functional (the broken build is in the
  cache, not in the deploy pipeline).

## Procedure

1. In `vite.config.ts`, inside the `VitePWA({ ... })` block, add
   `selfDestroying: true`. Keep `registerType: 'prompt'` and do **not**
   rename the service worker file.
2. Commit, tag, and deploy via the normal flow.
3. Wait ~1 week for the SW update cycle to reach all users. iOS Safari
   caps SW lifetime at 24h but reaches only users who open the app in
   that window; sporadic openers need longer.
4. Ship a follow-up release that flips `selfDestroying` back to `false`.

## What this does

On the next page load for any user, the installed SW unregisters itself
and deletes all Cache Storage entries. The page then reloads against the
network, picking up the fresh deploy.

## IndexedDB safety

**IndexedDB is preserved** by vite-plugin-pwa's selfDestroying behavior.
Lotta's tournament data lives in IndexedDB and is untouched. Only Cache
Storage (precached JS/CSS/HTML) is wiped.

## Rollback

If a selfDestroying release itself ships with a bug, flip the flag back to
`false` in the next deploy. Users who already activated the selfDestroying
SW have no SW installed; they will fetch the next release normally and the
new SW will register on first visit.
