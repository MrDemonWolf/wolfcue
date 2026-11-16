# WolfCue - Browser Teleprompter for Moblin

WolfCue is a mobile-first teleprompter, with an English interface, for
reading a script in Moblin's private browser on the same iPhone that records.
Scripts and preferences stay in this browser unless you choose to copy a
script link.
There are no accounts or uploads.
Physical iPhone/Moblin behavior still requires the device checks below.

Paste your script. Set your pace. Start reading.

## Features

- **Timed scrolling:** elapsed-time-based movement, words per minute, or
  approximate target completion time, with pause, seek, and restart. The
  reading line sits in the upper quarter so more upcoming text stays visible.
- **Compact reader:** a top bar and Settings gear sized for small Moblin views,
  adjustable text, line spacing, alignment, mirror, guide, and an optional
  countdown that keeps the first line visible.
- **Local scripts:** paste Unicode or import UTF-8 `.txt` files up to 1 MiB.
  Storage failures keep the current text in memory and show a warning.
- **Script links:** choose **Export > Copy script link**, then open the link
  in Moblin to load a snapshot of the text. Links are compressed when that is
  shorter. No account or sync is needed.
- **Backup options:** share a file where supported, download `.txt`, or copy
  text. In-app browsers may block downloads; verify the saved file.
- **Themes and access:** System, Light, and Dark choices plus a quick
  light/dark button, visible focus, keyboard shortcuts, and optional wake
  lock/fullscreen where supported.
- **Static delivery:** one artifact for the app and Fumadocs guides. No
  camera, microphone, analytics, server, or service worker.

## Getting Started

The documentation source is in [apps/docs/content/docs](apps/docs/content/docs).
Public URL: <https://wolfcue.mrdemonwolf.dev>.

1. Install dependencies and start both apps:

   ```bash
   bun install
   bun run dev
   ```

2. Open `http://localhost:3001`. Documentation is available at `/docs/`.
3. Paste a synthetic script, choose pace and text size, and select
   **Start reading**. Run the device checklist before a real recording.

## Usage

Use Moblin's **private browser**, not a **Browser scene widget**: a scene
widget appears in recorded output. Moblin owns recording; WolfCue cannot
position its native window or guarantee recording continues.

Safari and Moblin have separate storage. Paste or import inside Moblin,
or choose **Export > Copy script link** in WolfCue and open that link in
Moblin's private browser. Review the loaded text, confirm replacement if
asked, and select **Start reading** when ready. Opening a link never starts
scrolling automatically.

The link carries a snapshot of the script text, not a Notion page URL or a
live connection. Copy text from Notion into WolfCue first; later edits to
that document do not update an existing link. Large links can exceed browser
or messaging limits; use a `.txt` file if that happens.

**Saved on this device** means a local write succeeded, not that an archive
exists. Browser storage can fail or be evicted. Export a backup. GitHub
Pages receives IP/request metadata when serving files. WolfCue never uploads
scripts. Only **Copy script link** puts text in a URL fragment (`#script=`),
which is read in the browser and removed from the address after loading.
Anyone with that link can read the text. Offline reopening is not guaranteed.

**Pause** stops scrolling. While paused, seek with **Position**, touch/pen
drag, or mouse wheel. **Restart** resets position and active reading time;
at the end of the script the main button becomes **Restart**. Opening
**Settings** with the gear button pauses; closing it does not resume. Returning from a
hidden page also stays paused. Target time is approximate scroll completion,
not speech measurement. Wake lock cannot prevent every iOS interruption.

### Keyboard shortcuts

These apply in the reader, excluding inputs, editable content, composition,
and Ctrl/Meta/Alt combinations. Focused buttons retain Space/Enter behavior.

| Key               | Action                                                 |
| ----------------- | ------------------------------------------------------ |
| Space / K         | Play or pause                                          |
| Left / Right      | Slower / faster: 5 wpm or target +5 / -5 seconds       |
| Up / Down         | While paused, seek one line back / forward             |
| PageUp / PageDown | While paused, seek most of a screen                    |
| Home / End        | While paused, seek start / end                         |
| R                 | Restart                                                |
| M / G             | Toggle mirror / guide                                  |
| - / =             | Decrease / increase text size                          |
| F                 | Toggle fullscreen when supported                       |
| Escape            | Close Settings, else exit fullscreen, else exit reader |

### Moblin acceptance checklist

These checks remain owner-run on a physical iPhone. Emulated WebKit results
are not device proof. The [full checklist](apps/docs/content/docs/device-checklist.mdx)
also asks for device, iOS, and Moblin versions.

- [ ] Open the private browser in large mode at the deployed WolfCue URL.
- [ ] Paste synthetic text and confirm the saved status.
- [ ] Set pace/text size, switch to small mode, and check Pause, time,
  Settings, and clearance around Moblin's expand button.
- [ ] Compare 28, 32, and 36 px text in small mode at camera distance.
- [ ] Start a local recording, then start reading with the countdown.
- [ ] Read for 60 seconds, pausing/resuming at least twice; check smoothness
  and whether the reading line looks natural on camera.
- [ ] Wait beyond Auto-Lock with keep-awake on and note screen behavior.
- [ ] Toggle small/large while reading; check position and pause behavior.
- [ ] Hide/re-show the browser; confirm paused state with no leap.
- [ ] Rotate the phone and check position and layout.
- [ ] Stop recording and review saved video/audio for interruptions and
  accidental script capture.
- [ ] Try Import and each Export option, including Download in Moblin;
  verify a backup actually saved.
- [ ] Open a script link, force-quit/reopen Moblin, and check
  script/settings persistence and whether Moblin reopens the link.
- [ ] Repeat paste/read checks in Safari and confirm separate storage.

## Tech Stack

| Layer         | Technology                                           |
| ------------- | ---------------------------------------------------- |
| App           | TypeScript, semantic HTML, CSS, Vite                 |
| Docs          | Fumadocs, Next.js static export, React, Tailwind CSS |
| Workspace     | Better-T-Stack, Bun, Turborepo                       |
| Quality       | Biome, Bun unit tests, Playwright WebKit             |
| Intended host | GitHub Pages, one merged static artifact             |
| Fonts         | System script text; local Montserrat and Inter       |

## Development

### Prerequisites

- Bun 1.4.4 (pinned in `package.json`).
- Node 24 for the docs config's TypeScript helper import and Playwright CLI.
- Playwright WebKit browser binaries:

  ```bash
  bunx playwright install webkit
  ```

### Setup

1. Clone and install:

   ```bash
   git clone https://github.com/MrDemonWolf/wolfcue.git
   cd wolfcue
   bun install
   ```

2. Start the app and docs:

   ```bash
   bun run dev
   ```

3. Build the combined artifact and serve it locally:

   ```bash
   bun run build
   bun run serve
   ```

   Open `http://127.0.0.1:4173/`. Build output is `apps/web/dist`.

### Development Scripts

- `bun run dev`: both apps; web port 3001, docs port 3002.
- `bun run dev:web` / `bun run dev:docs`: one workspace.
- `bun run check` / `bun run check:fix`: Biome check / safe fixes.
- `bun run check-types`: TypeScript checks for both apps.
- `bun test` / `bun run test:coverage`: unit tests / coverage.
- `bun run build`: static builds followed by docs merge.
- `bun run test:e2e`: browser tests against the built artifact.
- `bun run test:shots`: screenshots in `artifacts/screenshots`.
- `bun run serve`: static server for the built artifact.
- `bun run ci`: lint, types, unit tests, build, and browser tests.
- `bun scripts/build-og.ts`: regenerate the app/docs share images and icons.

`PORT` or `WEB_PORT` changes the web dev port; `DOCS_PORT` changes docs.
`BASE_PATH` controls the app and docs mount. `SITE_ORIGIN` controls canonical,
OG, and sitemap origins. `COMMIT_SHA` supplies the build stamp.

Share images are local 1200 by 630 PNGs generated from the official SVG
logo, bundled Montserrat font, and HTML in `scripts/build-og.ts`. The app
uses `og-v2.png`; guides use `og-docs-v2.png`. After changing a published
card, use a new filename in the generator and metadata so previews can fetch
the updated image. Run the generator, inspect both images, then rebuild.

### Code Quality

The DOM-free core receives time, storage, and geometry as arguments. Tests
cover timing, target recalculation, anchors, validation, storage failures,
plain-text rendering, contrast, and keyboard guards. Browser checks cover
flows, layouts, themes, lifecycle, imports, docs/search, network/CSP, and
SEO metadata. Metadata checks cover every guide, canonical URLs, sitemaps,
PNG dimensions, image alt text, and script links staying out of metadata.
Screenshots require visual inspection; passing tests do not prove reading
feel, physical-device behavior, or recording continuity.

Run both deployment shapes before delivery:

```bash
BASE_PATH=/ bun run ci
BASE_PATH=/wolfcue/ bun run ci
```

### Deployment

The site is live at <https://wolfcue.mrdemonwolf.dev>. Every push to `main`
runs `deploy.yml`, which builds the root artifact with docs at `/docs/` and
deploys it to GitHub Pages. Before deploying, it checks that the Pages custom
domain and the DNS-only CNAME match and that HTTPS has a valid certificate.
No `CNAME` or `.nojekyll` file is needed for Actions deployment. Push only
when the owner asks, and never cancel a deployment in progress.

To redeploy the current `main` without a new commit:

```bash
gh workflow run deploy.yml -R MrDemonWolf/wolfcue --ref main
```

Local storage is per origin, so keep using the custom-domain origin. The
license-year workflow opens a pull request each January when the year
changes; approve its CI run from the pull request.

## Project Structure

```text
apps/
  web/                  # Framework-free teleprompter and browser tests
    src/core/           # Pure logic and unit tests
    src/ui/             # DOM and browser adapters
    src/styles/         # Tokens and responsive layouts
    public/             # Theme script, icons, notices, OG card
  docs/                 # Fumadocs static export at /docs/
    content/docs/       # Guides and owner-run device checklist
packages/config/        # Shared TypeScript configuration
scripts/                # Path config, merge, server, image generation
.github/workflows/      # CI, guarded deployment, license-year PR
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/wolfcue.svg?style=for-the-badge&logo=github)

[MIT License](LICENSE), Copyright (c) 2026 MrDemonWolf, Inc.
Core logic is adapted from Pocket Teleprompter at the exact commit listed
in [third-party notices](THIRD_PARTY_NOTICES.md), retaining its MIT notice.
Bundled Montserrat and Inter fonts retain their SIL Open Font License
notices. WolfCue is independent and is not affiliated with, endorsed by,
or sponsored by Moblin.

## Contact

Have questions or feedback?

- Discord: [Join my server](https://mrdwolf.net/discord)
- Issues: [GitHub](https://github.com/MrDemonWolf/wolfcue/issues)

## Footer

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
