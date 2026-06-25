# [1.21.0](https://github.com/wbern/lotta/compare/v1.20.3...v1.21.0) (2026-06-25)


### Features

* decouple the scoring system from the Schackfyran (chess4) format ([251d3e2](https://github.com/wbern/lotta/commit/251d3e274352e7a2030fb5aab52845b1e59b035e))
* derive and validate the active round against existing data ([42d7113](https://github.com/wbern/lotta/commit/42d7113781567d79141627483f7619cd01273947))
* lock showELO/showGroup with a single source of truth for lock fields ([aa85b17](https://github.com/wbern/lotta/commit/aa85b17248e3075e7f9064acaca261b17573367a))
* make dialogs own focus so global keybinds don't act behind a modal ([83fa1f7](https://github.com/wbern/lotta/commit/83fa1f70b3467cb92aec986bb31737aee5b28ab6))
* surface all persistence failures via a shared save-error toast ([0461f6d](https://github.com/wbern/lotta/commit/0461f6d33c17c9c29b358d702f16093f37503078))
* validate domain invariants at the repository boundary ([5077c15](https://github.com/wbern/lotta/commit/5077c15606b9672b9bec9c91b9b4914a716cde92))

## [1.20.3](https://github.com/wbern/lotta/compare/v1.20.2...v1.20.3) (2026-05-28)


### Bug Fixes

* **recovery:** retry/back buttons after action error, brighter error red in dark mode ([065c054](https://github.com/wbern/lotta/commit/065c05492b2220c01402ac05684ab9723f522fe8))

## [1.20.2](https://github.com/wbern/lotta/compare/v1.20.1...v1.20.2) (2026-05-28)


### Bug Fixes

* **recovery:** clear stale countdown on action error, cap diagnostics list height ([5e54a55](https://github.com/wbern/lotta/commit/5e54a55b66fbb0af77a9201432154e6075b8e5b2))

## [1.20.1](https://github.com/wbern/lotta/compare/v1.20.0...v1.20.1) (2026-05-28)


### Bug Fixes

* **recovery:** action panel now hides, cancel + nuke get their colors, no duplicate 'om' ([e7c3cf0](https://github.com/wbern/lotta/commit/e7c3cf09c0cfb58981c670890d9219e5cd8ac62b)), closes [#root](https://github.com/wbern/lotta/issues/root) [#root](https://github.com/wbern/lotta/issues/root)

# [1.20.0](https://github.com/wbern/lotta/compare/v1.19.0...v1.20.0) (2026-05-28)


### Features

* **#lt-gqt,#lt-79g,#lt-l88,#lt-y0g,#lt-15v,#lt-3jw:** polish recovery safe-mode panel ([ba779ee](https://github.com/wbern/lotta/commit/ba779ee90dc5381346c2b735d1fe284357a6cd23)), closes [#lt-gqt](https://github.com/wbern/lotta/issues/lt-gqt) [#lt-79g](https://github.com/wbern/lotta/issues/lt-79g) [#lt-l88](https://github.com/wbern/lotta/issues/lt-l88) [#lt-y0g](https://github.com/wbern/lotta/issues/lt-y0g) [#lt-15v](https://github.com/wbern/lotta/issues/lt-15v) [#lt-3jw](https://github.com/wbern/lotta/issues/lt-3jw)

# [1.19.0](https://github.com/wbern/lotta/compare/v1.18.0...v1.19.0) (2026-05-28)


### Features

* **#lt-0ux:** link 'Säkert läge' from 'Om Lotta' dialog to /recovery.html ([6cccb59](https://github.com/wbern/lotta/commit/6cccb5927d0c14df0abc01ab5b99acfecd6c40d4)), closes [#lt-0ux](https://github.com/wbern/lotta/issues/lt-0ux)
* **#lt-3jw:** detect iOS PWA standalone mode ([b3e43ad](https://github.com/wbern/lotta/commit/b3e43ada1b0924da26f70dcda33107334533be1d)), closes [#lt-3jw](https://github.com/wbern/lotta/issues/lt-3jw)
* **#lt-79g:** gather PWA diagnostics (version, SW count, caches, storage) ([6a0ce65](https://github.com/wbern/lotta/commit/6a0ce65ece80f7dc5d267dc381039265a8605fff)), closes [#lt-79g](https://github.com/wbern/lotta/issues/lt-79g)
* **#lt-gqt,#lt-79g,#lt-l88,#lt-y0g,#lt-15v,#lt-3jw:** rebuild recovery page as safe-mode panel ([371be21](https://github.com/wbern/lotta/commit/371be218cd126d2b0c36ef42dbfcb37efb5d55d6)), closes [#lt-gqt](https://github.com/wbern/lotta/issues/lt-gqt) [#lt-79g](https://github.com/wbern/lotta/issues/lt-79g) [#lt-l88](https://github.com/wbern/lotta/issues/lt-l88) [#lt-y0g](https://github.com/wbern/lotta/issues/lt-y0g) [#lt-15v](https://github.com/wbern/lotta/issues/lt-15v) [#lt-3jw](https://github.com/wbern/lotta/issues/lt-3jw) [#lt-l88](https://github.com/wbern/lotta/issues/lt-l88) [#lt-79g](https://github.com/wbern/lotta/issues/lt-79g) [#lt-gqt](https://github.com/wbern/lotta/issues/lt-gqt) [#lt-y0g](https://github.com/wbern/lotta/issues/lt-y0g) [#lt-15v](https://github.com/wbern/lotta/issues/lt-15v) [#lt-3jw](https://github.com/wbern/lotta/issues/lt-3jw)
* **#lt-gqt:** read raw SQLite backup bytes from IndexedDB ([32be738](https://github.com/wbern/lotta/commit/32be73838c345e04bc41f5dd395327f26504f4c0)), closes [#lt-gqt](https://github.com/wbern/lotta/issues/lt-gqt)

# [1.18.0](https://github.com/wbern/lotta/compare/v1.17.0...v1.18.0) (2026-05-28)


### Features

* **#lt-n7z:** add /recovery.html safe-mode lifeboat page ([dd55ef5](https://github.com/wbern/lotta/commit/dd55ef50c5e5ffd66b7eaa02ac884c6cc60591d2)), closes [#lt-n7z](https://github.com/wbern/lotta/issues/lt-n7z)

# [1.17.0](https://github.com/wbern/lotta/compare/v1.16.2...v1.17.0) (2026-05-28)


### Features

* **#lt-4d9:** add ?reset=1 killswitch URL to unstick broken installs ([c10cce8](https://github.com/wbern/lotta/commit/c10cce8c735ccd364a7307d29bbd92d4b5673c74)), closes [#lt-4d9](https://github.com/wbern/lotta/issues/lt-4d9)

## [1.16.2](https://github.com/wbern/lotta/compare/v1.16.1...v1.16.2) (2026-05-28)


### Bug Fixes

* **context-menu:** use pointerdown, cleanup keydown listener, .btn touch-action ([03a4bee](https://github.com/wbern/lotta/commit/03a4beea740a5bd4063b97daf6c078feea95c095))

## [1.16.1](https://github.com/wbern/lotta/compare/v1.16.0...v1.16.1) (2026-05-27)


### Bug Fixes

* **menu:** use pointerdown + touch-action so iOS taps register reliably ([784693b](https://github.com/wbern/lotta/commit/784693b0b6527bde7791f39192a21aa48f5504e9))

# [1.16.0](https://github.com/wbern/lotta/compare/v1.15.0...v1.16.0) (2026-04-29)


### Features

* **backup:** persist legacy-compat checkbox in localStorage ([a075d66](https://github.com/wbern/lotta/commit/a075d66d6790bccdf2f96de8270f0cf5026597df))

# [1.15.0](https://github.com/wbern/lotta/compare/v1.14.0...v1.15.0) (2026-04-29)


### Features

* **backup:** add 'Bakåtkompatibel med gammal Lotta' export option ([446bdcc](https://github.com/wbern/lotta/commit/446bdccf21fea1ed9028a2d73e85d8d753bb79c9))

# [1.14.0](https://github.com/wbern/lotta/compare/v1.13.0...v1.14.0) (2026-04-29)


### Features

* **tournament-players:** toggle bye protection in edit mode + harden coverage ([108a023](https://github.com/wbern/lotta/commit/108a02353233664fa840a0b9cfa6e46da33019b9))

# [1.13.0](https://github.com/wbern/lotta/compare/v1.12.0...v1.13.0) (2026-04-29)


### Features

* **tournament-players:** protect late-added players from frirond in debut round ([ba19cbf](https://github.com/wbern/lotta/commit/ba19cbfebda7745d2be02d6fb89ddbc75a4cf130))

# [1.12.0](https://github.com/wbern/lotta/compare/v1.11.0...v1.12.0) (2026-04-29)


### Features

* **toast:** add promise() helper for loading→success/error in place ([1d6a914](https://github.com/wbern/lotta/commit/1d6a9143f17d4b4ee8f0b6978759c405eb1d9957))
* **toast:** add stable id dedup, page-visibility pause, maxVisible queue ([6c8ceb0](https://github.com/wbern/lotta/commit/6c8ceb0b38a30007dec7fae7e8f10c02104b0693))
* **toast:** migrate seed and player-import alert() to unified toast ([0614c7a](https://github.com/wbern/lotta/commit/0614c7a8ea9de1d2e491c64fea39b78f0a9ebbd3))
* **toast:** replace single action with actions[] and migrate version-update prompt ([5a9d979](https://github.com/wbern/lotta/commit/5a9d979407837d63fb0db1457a17c8c0d122115f))

# [1.11.0](https://github.com/wbern/lotta/compare/v1.10.0...v1.11.0) (2026-04-29)


### Features

* **toast:** migrate result-conflict notification to unified toast ([42e8604](https://github.com/wbern/lotta/commit/42e86047a8554dba93ea928886eac9f690c047b6))

# [1.10.0](https://github.com/wbern/lotta/compare/v1.9.0...v1.10.0) (2026-04-29)


### Features

* **toast:** unified toast system replaces ad-hoc inline notifications ([a3c25a7](https://github.com/wbern/lotta/commit/a3c25a7b6eb551385b3503f45337f3cd6fd991ad))

# [1.9.0](https://github.com/wbern/lotta/compare/v1.8.0...v1.9.0) (2026-04-28)


### Features

* **tournament-players:** block 'Lägg till' for Berger past draft ([00c80bd](https://github.com/wbern/lotta/commit/00c80bd9df25153873def5a6b1284313c296b9f9))

# [1.8.0](https://github.com/wbern/lotta/compare/v1.7.4...v1.8.0) (2026-04-27)


### Features

* **tournament-players:** block 'Ta bort' outside draft phase ([9c067ef](https://github.com/wbern/lotta/commit/9c067ef67b6b87681886b26fa2e1d3f62cc88b97))

## 1.7.4 (2026-04-27)


### Bug Fixes

* **e2e:** repair Player pool dialog tests for new editor sub-tabs
* **e2e:** repair Settings dialog tests for theme-select disambiguation and nested clear-db dialog
* **e2e:** repair Tournament dialog + Player encoding tests; add Windows-1252 import fallback
* **e2e:** repair Tournament players, EditScore, and Confirm dialog tests
* **query:** default to networkMode 'always' for IDB-backed queries

## 1.7.3 (2026-04-26)


### Bug Fixes

* **p2p:** surface failure on reconnect drop and tolerate legacy acks

## 1.7.2 (2026-04-26)


### Bug Fixes

* **e2e:** derive expected spectator result from recorded scores

## 1.7.1 (2026-04-26)


### Bug Fixes

* **live:** broadcast data-changed on every host DB mutation
* **live:** view-mode shows the tournament the host is sharing

# 1.7.0 (2026-04-26)


### Features

* **p2p:** pending-sync badge and optimistic locking for ref submissions

# 1.6.0 (2026-04-25)


### Features

* **tournament-lock:** lock destructive settings and gate deletion past draft

# 1.5.0 (2026-04-25)


### Features

* **player-form:** confirm before discarding unsaved input on double-click

## 1.4.7 (2026-04-25)


### Bug Fixes

* **player-form:** reset form state when dialog reopens

## 1.4.6 (2026-04-25)


### Bug Fixes

* **ux:** suppress browser text selection on shift+click row range

## 1.4.5 (2026-04-25)


### Bug Fixes

* **live:** gate live-context on isHosting and lock in title coverage
* **rounds:** focus pairings tab and latest round after seeding

## 1.4.4 (2026-04-25)


### Bug Fixes

* **chess4:** hide clubs with zero participants from setup and standings

## 1.4.3 (2026-04-25)


### Bug Fixes

* **player-form:** clarify reset button label

## 1.4.2 (2026-04-25)


### Bug Fixes

* **live:** stop overriding document title when not hosting

## 1.4.1 (2026-04-25)


### Bug Fixes

* **publish:** show actual board number in alphabetical pairings print

# 1.4.0 (2026-04-24)


### Bug Fixes

* **live:** broadcast empty manifest on tournament delete
* **live:** broadcast state when host switches tournament
* **live:** reconcile viewer cache against host round manifest
* **live:** scope tournament-delete broadcast to live/shared set


### Features

* **live:** explicit shared tournament set with per-tournament scoping


### Reverts

* Revert "fix(live): broadcast state when host switches tournament"

# 1.3.0 (2026-04-24)


### Features

* **publish:** add option to hide opponent's last name in alphabetical pairings

## 1.2.1 (2026-04-24)


### Bug Fixes

* **publish:** group alphabetical pairings by club in non-chess4 mode

# 1.2.0 (2026-04-24)


### Features

* **publish:** repeat title on each alphabetical pairings page

## 1.1.3 (2026-04-23)


### Bug Fixes

* **live:** stop club-scoping referees who never redeemed a club code

## 1.1.2 (2026-04-23)


### Bug Fixes

* **live:** broadcast state to peers after host undo/redo

## 1.1.1 (2026-04-22)


### Bug Fixes

* **live:** send state to peers who miss the initial push

# 1.1.0 (2026-04-21)


### Features

* **e2e-bridge:** expose DB export/restore for chaos-hunt roundtrip

## 1.0.3 (2026-04-21)


### Bug Fixes

* **rollback:** rephrase warning to describe per-version DB isolation

## 1.0.2 (2026-04-21)


### Bug Fixes

* **ci:** harden release dispatch + rollback versions.json push, closes [#pages](https://github.com/wbern/lotta/issues/pages)
* **ui:** tighten WhatsNewDialog edge cases

## 1.0.1 (2026-04-21)


### Bug Fixes

* **ci:** dispatch rollback-deploy after semantic-release cuts a tag

# 1.0.0 (2026-04-21)


### Bug Fixes

* **build:** use /v/<version>/ base for rollback bundles
* **ci:** check out repo at default path so JamesIves can init git, closes [#pages](https://github.com/wbern/lotta/issues/pages)
* flip result context menu upward near bottom of viewport
* keep share button inline with club label in picker tree
* **live:** harden host-refreshing hint with role check and dedicated CSS
* **live:** improve grant form accessibility and keyboard UX
* **live:** make LiveTab wrapper fill height so sharing panels can scroll
* **live:** revoking a grant deauthorizes already-connected peers
* **live:** show entered name in chat for Domare grants
* **pairings:** adapt result keybinds to scoring system (lt-4aa)
* **pairings:** only handle result-entry keys when a row has focus
* **players:** display player names as "FirstName LastName" in list dialogs
* **players:** sort alphabetically by first name, last name as tiebreak
* **publish:** group Schackfyran alphabetical pairings by school class
* **tournament:** block scoring-system change once results are recorded


### Features

* add "Lägg till grupp" flow for spawning tournament groups
* **build:** add rollback build flavor with namespaced DB and PWA identity
* **build:** generate versions.json manifest, closes [#pages](https://github.com/wbern/lotta/issues/pages) [#pages](https://github.com/wbern/lotta/issues/pages)
* **build:** skip VitePWA plugin in rollback builds
* club-code spectator view with per-club share dialog
* initial public release
* **live:** add grants domain module
* **live:** add native share button for spectator and grant links
* **live:** add native share button to club-code share dialog
* **live:** download PDFs for QR codes and simpler club-code sharing
* **live:** host auto-resumes hosting on page load from saved session
* **live:** host broadcasts 'refreshing' hint on pagehide for friendlier viewer UX
* **live:** mint stable hostId for host refresh recovery
* **live:** per-permission checkboxes for granting live access
* **live:** persist grants across session refresh and migrate legacy sessions
* **live:** replace single-token Domarstyrning with grants list
* **live:** revoke grants individually and deauthorize their tokens
* **live:** show disconnect button when connected to another host
* **live:** viewer keeps host peer alive across refresh and rebinds by hostId
* **p2p:** host-wide club-code rate limit with escalating lockout
* **pairing:** guard round pairing with a 10s deadline
* **pairings:** arrow keys move row selection and focus
* **pairing:** show a "Lottar..." progress dialog with elapsed timer
* **pwa:** hide already-installed versions in Vad är nytt by default
* **pwa:** opt-in changelog view and working update check
* **pwa:** surface release changes in update prompt and menu
* **rollback:** add version-picker dialog with forced export gate
* **rollback:** replace forced-export gate with backup advisory warning
* seed test players into selected or random tournament
* **sw:** runtime-cache rollback bundles under /v/**
