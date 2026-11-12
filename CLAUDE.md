# WolfCue

## Hard rules

- Run `git status` first. Preserve unrelated work.
- No em dashes or emojis in code, copy, commits, or docs. UI is English.
- Preserve arbitrary Unicode in user scripts; UI language is not an input restriction.
- TypeScript strict. Prefer platform APIs and existing dependencies.
- No server, accounts, analytics, AI, camera, microphone, or service worker.
- Never commit real scripts, script URLs, credentials, `PLAN.md`, or `.plan/`.
- Conventional Commits. Do not push, publish, change Pages, DNS, or repository
  settings until the owner explicitly authorizes Phase 9.

## Commands

Use Bun 1.4.4 and Node 24. Playwright's CLI runs under Node.

```bash
bun install
bun run dev
bun run check
bun run check-types
bun test
bun run build
bun run test:e2e
bun run test:shots
BASE_PATH=/wolfcue/ bun run ci
```

`bun run check:fix` applies Biome formatting and safe fixes. Build combines
`apps/web/dist` and `apps/docs/out` into one artifact at `apps/web/dist`.

## Architecture

- `apps/web`: Vite, semantic HTML, CSS, TypeScript, no UI framework.
- `apps/web/src/core`: pure logic; receive time, storage, and geometry as
  arguments. No DOM, timers, or browser globals.
- `apps/web/src/ui`: DOM and browser API adapters. One rAF loop.
- `apps/docs`: Fumadocs static export mounted at `/docs/`.
- `scripts`: base-path normalization, artifact merge, static test server,
  and one-off image generation.
- All build and test paths must work at `/` and `/wolfcue/`.

## Moblin and WebKit constraints

The intended workflow uses Moblin's private browser, not its Browser scene
widget. The widget appears in the video. Web code cannot position Moblin's
window or guarantee uninterrupted recording.

Support compact viewports down to 200 by 180 CSS pixels. Keep the lower-right
60 by 60 pixels free of reader controls in compact mode for Moblin's expand
button. Essential controls have text and targets at least 44 by 44 pixels.

Keep a floating-point engine position; never derive it from `scrollTop`.
Use elapsed time with a 250 ms frame cap, compositor transforms, and cached
geometry outside the frame loop. Preserve the current line and fraction on
resize and typography changes. Hidden/pagehide pauses; returning never
silently resumes. Countdown time is excluded from elapsed reading time.

Feature-detect fullscreen and wake lock. Both are optional. Wake lock does
not guarantee iOS will keep recording or prevent every interruption.
Emulated WebKit is evidence only; never mark physical-device checks passed
without owner-supplied evidence.

## Storage, import, and export

Use only `wolfcue:theme`, `wolfcue:v1:prefs`, and `wolfcue:v1:script`.
Guard the localStorage getter and every operation. Keep the current script
in memory after a failed write and report that it is not saved. Debounce
script writes 400 ms, flushing on pagehide and hidden visibility.

Validate `.txt` imports fully before replacement: UTF-8, maximum 1 MiB
(1,048,576 bytes, inclusive), no NUL, non-empty, normalize CRLF/CR. Drop stale
async reads. Confirm replacement/clear/erase in-page with Cancel focused.
Render scripts with `textContent` only. Do not introduce HTML sinks.

Only an explicit **Copy script link** action may place script text in a URL,
using the `#script=` fragment. Never put scripts in URL paths or query strings,
and never upload them. Incoming script fragments use the same UTF-8/1 MiB
validation as file imports, ask before replacing different non-empty content,
and never start reading automatically. Remove the fragment from the address
with `history.replaceState` after reading it; handle `hashchange` for reused
Moblin views. Script links contain a text snapshot, not a Notion page URL or
live document connection. Anyone with the link can read its text.

Safari and Moblin have separate storage. Export is the backup; a download
click does not prove a file saved.

## Themes and visuals

Follow system appearance initially; persist explicit Light or Dark via
`wolfcue:theme` and apply the classic theme script before paint. App and docs
use separate theme keys. Use the palette in `src/styles/tokens.css` rather
than guessing cyan values. Script and controls use system fonts; headings
use local Montserrat. No external fonts, invented wolf artwork, or gradients.

## SEO and notices

Canonical origin: `https://wolfcue.mrdemonwolf.dev`. Respect `BASE_PATH`.
Keep strict app CSP; docs use their documented inline-script exception.
Do not loosen app CSP to fix a build problem. Keep the root 404 functional
at arbitrary depth, with base-absolute app and docs links.

Keep the upstream MIT attribution and exact pinned commit in
`THIRD_PARTY_NOTICES.md`, its public text copy, and adapted source headers.
Preserve bundled fonts' OFL notices. Do not call derived code wholly original.

## Copy and documentation

Plain verbs, sentence case, one real limitation near the top. No corporate
filler. Keep README in the MrDemonWolf house section order. Credit:
`WolfCue by MrDemonWolf, Inc.`. State that WolfCue is independent and is not
affiliated with, endorsed by, or sponsored by Moblin.

## Deployment

Phase 9 requires explicit owner authorization. Until then all work is local.
The prepared workflow deploys one merged artifact at the custom-domain root
and checks Pages cname, DNS-only CNAME, and HTTPS first. Do not add `CNAME` or
`.nojekyll` files. Never cancel an in-flight Pages deploy.

## Verifying changes

Run scoped tests, then `bun run ci` at both base paths. Inspect screenshots
at 250x250, 390x844, and 844x390 in both themes, including Settings. Report
which commands passed and any unresolved failures. Source review and tests
do not establish real Moblin recording, persistence, or export behavior.
