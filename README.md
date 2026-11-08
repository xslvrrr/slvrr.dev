# slvrr.dev

A personal landing page in the style of carrd / guns.lol, with a lot more going on. **V3** is a
place rather than a page: a first-person walk through a churchyard at night, rendered small and
pixelated like a late-90s console game. You push open the iron garden gates and follow a path
between clipped hedges, and each section of the site is something along the way that you stop and
look at: a signpost, a fountain, a mausoleum, a shrine, old graves, a calvary, with the cathedral
looming over all of it. There's rain, ground mist, lightning, lanterns, head bob, footsteps in wet
grass and an ambience bed, all synthesized. Nothing jumps out at you; it's the map of a horror game
with the horror taken out.

Built with **Vite + React + TypeScript**, **three.js**, **Tailwind CSS v4**, **Motion** and
**MDX**. Deployed on **Vercel**. (V1, liquid chrome, and V2, the side-scrolling garden, are in the
git history.)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run lint       # oxlint
npm run format     # prettier
```

## Where to change what

| I want to change…                  | Edit                                             |
| ---------------------------------- | ------------------------------------------------ |
| Name, tagline, bio, rotating words | `src/content/profile.ts`                         |
| Social links (and dock order)      | `src/content/links.ts`                           |
| Projects                           | `src/content/projects.ts`                        |
| Timeline                           | `src/content/timeline.ts`                        |
| Favourite albums / games / shows   | `src/content/media.ts`, then `npm run covers`    |
| Section headings, footer lines     | `src/content/copy.ts`                            |
| Write a note                       | add `src/content/notes/<slug>.mdx` with a `meta` |
| Colors, fonts, radii, easing       | `src/styles/tokens.css`                          |
| Floor plan, signposts, weather     | `src/world/layout.ts`                            |
| The churchyard itself              | `src/world/build.ts`                             |
| Statues                            | `src/world/sprites.ts`                           |
| Sounds                             | `src/lib/sfx.ts`                                 |

All copy lives in `src/content/`. The bio and section headings are drafts, so rewrite them freely.

### Covers

`npm run covers` downloads artwork for every item in `src/content/media.ts` into
`public/covers/`. Spotify album links and YouTube links are resolved automatically; for anything
else, add an `art` URL to the item. Existing files are kept, so delete one to re-fetch it. Set
`swatch: '#hex'` instead to use a flat colour as the cover (like solace's pink). Items without a
cover show a generated tile. Covers sit in 3D jewel cases (`src/fx/JewelCase.tsx`).

### The churchyard

The whole site is one fixed, full-screen three.js scene (`src/world/`). There is no page scroll.
Every visit starts at the closed gate; click to push it open and walk in.

**Moving.** `WASD` or the arrow keys walk, `Shift` runs, the mouse looks around (it's captured
when you go through the gate; **`V`** frees or recaptures it, as the hint bottom-left says). With
the cursor free you can also drag to look and click things directly. On touch screens there's a
thumbstick bottom-left (push it all the way to run), dragging anywhere else looks around, and
tapping something uses it. `E` (or a click, or the on-screen button on phones) uses whatever the
crosshair is on; a card above the prompt says what it is.

**The floor plan** (`layout.ts`) is a grid of 0.5 m cells (`grid.ts`): open ground, hedge, solid
objects, the wall, and out of bounds. Hedges are grown in every solid cell next to open ground, and
the same grid does collision and line of sight. The walk has four junctions; at each, the trail
turns and a straight branch runs on to a dead end, and a signpost points the way. One dead end has
a gap in the hedge. Squeeze through and the screen cuts to black, everything goes silent, and
after three seconds: _you're not supposed to be here._ Then a glitch, and you're back at the gate.

**The places** (each section is something you walk up to and use):

| Place          | What's there                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the gate       | wrought-iron garden gates; your name, tagline and roles (the title screen)                                                                              |
| the signpost   | an arrow per link (use one to open it) and a floating CRT with live Discord                                                                             |
| the fountain   | album jewel cases in the grass, a screen with Last.fm now playing, a walkman to pick up and carry (`F` plays along), and `E` at the water throws a coin |
| the mausoleum  | a monument per project (obelisk, stele, broken column, sarcophagus)                                                                                     |
| the shrine     | the bio and timeline as numbered sticky notes on the fence; use one to read it up close (`A`/`D` for the next)                                          |
| the old graves | a grave per note with its title and date, and the note at its foot to pick up                                                                           |
| the calvary    | the end of the path: a great cross between four angels                                                                                                  |

New notes get new graves automatically (columns of five, growing westwards). Projects, links,
albums and sticky notes all come from `src/content/`.

**Lines.** The first time you see the floating monitor, the now-playing screen or the walkman, or
when you throw a coin, you say something to yourself as a subtitle (`copy.lines` in
`src/content/copy.ts`).

**How it looks.** `src/world/engine.ts` renders the scene at ~260 rows (one scene pixel is 2–4 CSS
pixels), then a post pass (`post.ts`) quantizes it with an ordered dither, adds a vignette and
grain, and the canvas is scaled up with nearest-neighbour. Vertices snap to a coarse screen grid
(`materials.ts`), so geometry wobbles very slightly, PS1-style. Textures are painted pixel by pixel
at load (`textures.ts`), including the lettering on signs, plaques and graves; the live screens
are canvases redrawn when their data changes (`screens.ts`). Statues are the pixel-art sprites in
`sprites.ts`, extruded into voxel sculptures (`voxel.ts`). You carry a lantern; the nearest lamps
and candles share a small pool of real lights. Sky, clouds, moon and rain are shaders in `sky.ts`.
Each place sets its own weather (`zones` in `layout.ts`), blended as you walk.

**Type.** **Jersey 10** for display, **Pixelify Sans** for reading and **VT323** for labels,
prompts and subtitles: all bone on ink, so text stays legible over the dark scene.

**Sound.** Everything is synthesized in `src/lib/sfx.ts`: footsteps in wet grass (heel strike, toe
roll, blades snapping), the gate's hinges, cloth rustling, the coin and its splash, the walkman's
buttons, the out-of-bounds glitch, thunder, and an ambience bed of wind, rain, a low drone,
crickets, an owl and a far bell. The sound toggle is the speaker bottom-right.

Without WebGL, the site falls back to a plain page with the same sections (`src/pages/Plain.tsx`).
In `npm run dev`, `window.engine` is the running engine (set `engine.x`, `engine.z`, `engine.yaw`
to jump around), and clicking the open sky calls down lightning.

### Performance budget

- The scene renders at roughly 430×260 pixels, so fill rate is tiny. Static geometry is merged
  into one mesh per material at load (`mergeStatic` in `build.ts`), so the whole churchyard is
  about 70 draw calls; hedges, grass tufts and railings are instanced; the mist is one mesh of
  billboards. Keep it that way when adding things: put new static meshes in the scene and they
  get merged; mark anything animated with `userData.dynamic`.
- The render loop skips frames while the tab is hidden. three.js is loaded lazily, in its own
  chunk, while the title screen shows.
- Changing the number of lights recompiles every shader: the light pool is a fixed size (`POOL`).
- Anything you can use is an invisible box in `world.hits` (`userData.kind`); aiming is one
  raycast against those per frame, plus a line-of-sight check on the grid.
- Avoid `backdrop-filter` and big `filter: blur()` layers over the canvas; panels are solid.

## Live integrations

Each widget falls back to static content if its data source is missing or fails.

- **Discord presence** uses [Lanyard](https://github.com/Phineas/lanyard). Join the Lanyard
  Discord server, then put your Discord user ID in `profile.discordId`.
- **Now playing** uses Last.fm. If you use Spotify, connect it to Last.fm. Set
  `profile.lastfmUser`, then add `LASTFM_API_KEY`
  ([get one](https://www.last.fm/api/account/create)) to the Vercel project's environment
  variables. The key stays server-side in `api/lastfm.ts`.
- **Listen along** plays a 30-second preview of your current Last.fm track, found on Deezer (or
  iTunes as a fallback) by `api/preview.ts` with no key needed. Audio streams through
  `api/audio.ts`, a same-origin proxy limited to preview CDNs, so the visualizer can read it.
  When your track changes the player follows along, and the miniplayer stays at the bottom of
  the screen across pages until closed.
- **GitHub stats** for projects with a `repo` come from `api/github.ts`, cached for an hour.
  `GITHUB_TOKEN` is optional and only raises the rate limit.

For local development, copy `.env.example` to `.env.local`. `npm run dev` serves the `/api`
functions itself, so you don't need the Vercel CLI.

## Deploying

Import the repo in Vercel. It detects Vite, so no settings are needed. Add the env vars above,
then add `slvrr.dev` under **Settings → Domains**. `vercel.json` rewrites every non-API path
to the SPA so `/notes/...` links work.

## Secrets & details

- The gate opens with a click, which unlocks audio. "Back to the gate" at the calvary plays an
  organ swell and wakes you up just inside the gate.
- ↑ ↑ ↓ ↓ ← → ← → B A raises the blood moon, the only colour on the site.
- The faint `?` in the footer opens "stats for nerds".
- `prefers-reduced-motion` gets no head bob, no mouse-look, no lightning flashes, quick walks
  and no motion animations. Touch devices get no custom cursor.
- `npm run og` re-renders the social preview (`public/og.png`) by screenshotting the gate. Run
  `npm run build && npm run preview` first (it expects the site on port 4173).

## Layout

```
api/            Vercel functions (lastfm, github, preview, audio)
src/world/      the 3D churchyard: engine, layout + grid, build + parts, textures, screens, voxels,
                sky, post, and its React overlays (World, GateTitle, Cards, StickyZoom, Lost)
src/content/    all copy and data, typed, with no JSX
src/sections/   the content of each place (Links, NowPlaying, Projects, About, Notes, Footer)
src/pages/      NotePage (a note you've picked up) and Plain (the no-WebGL fallback)
src/components/ MiniPlayer (fallback page only), PixelCross, Icon…
src/fx/         effects: Cursor, JewelCase, ScrambleText, ScanReveal, Resurface, TiltCard…
src/hooks/      useLanyard, useVisualizer, usePauseOffscreen, useRepoStats, useKonami, useFinePointer
src/lib/        global stores (Last.fm feed, player), lightning bus, sfx, helpers
```
