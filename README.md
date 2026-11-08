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

| I want to change…                   | Edit                                             |
| ----------------------------------- | ------------------------------------------------ |
| Name, tagline, bio, rotating words  | `src/content/profile.ts`                         |
| Social links (and dock order)       | `src/content/links.ts`                           |
| Projects                            | `src/content/projects.ts`                        |
| Timeline                            | `src/content/timeline.ts`                        |
| Favourite albums / games / shows    | `src/content/media.ts`, then `npm run covers`    |
| Section headings, footer lines      | `src/content/copy.ts`                            |
| Write a note                        | add `src/content/notes/<slug>.mdx` with a `meta` |
| Colors, fonts, radii, easing        | `src/styles/tokens.css`                          |
| The path, places, weather per place | `src/world/stations.ts`                          |
| The churchyard itself               | `src/world/build.ts`                             |
| Statues                             | `src/world/sprites.ts`                           |
| Sounds                              | `src/lib/sfx.ts`                                 |

All copy lives in `src/content/`. The bio and section headings are drafts, so rewrite them freely.

### Covers

`npm run covers` downloads artwork for every item in `src/content/media.ts` into
`public/covers/`. Spotify album links and YouTube links are resolved automatically; for anything
else, add an `art` URL to the item. Existing files are kept, so delete one to re-fetch it. Set
`swatch: '#hex'` instead to use a flat colour as the cover (like solace's pink). Items without a
cover show a generated tile. Covers sit in 3D jewel cases (`src/fx/JewelCase.tsx`).

### The churchyard

The whole site is one fixed, full-screen three.js scene (`src/world/`). There is no page scroll.

**Walking.** The path (`PATH` in `src/world/stations.ts`) runs from outside the gate to the foot
of the calvary, with stations along it. Click either **wedge** at the edges of the screen (they
point in towards the vanishing point, like the hedges) to walk on to the next station; the low one
at the bottom turns you back. Scrolling, `W`/`S` and the arrow keys work too. The camera glides
round the corners, bobs with each stride, and every stride plays a footstep.

**Looking.** Most stations have a point of interest beside the path. Hover it for its label, click
it (or press `E`) and you turn to face it while its section opens in a panel beside it (below it
on phones). `Esc`, "step back" or clicking the world turns you back to the path. The URL hash
follows what you're looking at, so `/#work` walks you to the mausoleum and back/forward work.

| Station   | Point of interest                           | Section                     |
| --------- | ------------------------------------------- | --------------------------- |
| gate      | the iron garden gates (title screen)        | name, tagline, roles        |
| entry     | the hedge walk                              | (none)                      |
| sign      | a signpost on the left, before the 1st turn | Links + Discord             |
| fountain  | a fountain with a cherub, in a clearing     | Music                       |
| mausoleum | where the relics are kept                   | Work                        |
| shrine    | a Madonna in a niche, candles, a monk       | About                       |
| graves    | a weeping angel on a tomb                   | Notes                       |
| calvary   | a tall cross between two angels             | Footer ("back to the gate") |

Each station also sets the **weather** around it (rain, fog density, lightning per minute, wind),
blended as you walk. Notes (`/notes/:slug`) open as a reading panel with the world behind, at the
graves.

**How it looks.** `src/world/engine.ts` renders the scene at ~260 rows (one scene pixel is 2–4 CSS
pixels), then a post pass (`post.ts`) quantizes it with an ordered dither, adds a vignette and
grain, and the canvas is scaled up with nearest-neighbour. Vertices snap to a coarse screen grid
(`materials.ts`), so geometry wobbles very slightly, PS1-style. Textures are painted pixel by pixel
at load (`textures.ts`), including the lettering on the signs. Statues are the pixel-art sprites in
`sprites.ts`, extruded into voxel sculptures that swell towards the middle (`voxel.ts`). You carry a
lantern (a flickering light at your hip); the nearest lamps and candles share a small pool of real
lights. Sky, clouds, moon and rain are shaders in `sky.ts`.

**Type.** **Jersey 10** (a chunky pixel face) for display, **Pixelify Sans** for reading and
**VT323** for labels and prompts, like a game's subtitles: all bone on ink, so text stays legible
over the dark scene.

**Sound.** Everything is synthesized in `src/lib/sfx.ts`: footsteps in wet grass (heel strike, toe
roll, blades snapping), the gate's groaning hinges and clank, cloth rustling as you turn, thunder,
and an ambience bed of wind gusts, rain, a low drone, crickets, and now and then an owl or the far
cathedral bell. It starts when you push the gate open (that click is what lets the browser play
audio). The **sound** toggle is in the HUD.

Without WebGL, the site falls back to a plain page with the same sections (`src/pages/Plain.tsx`).
In `npm run dev`, `window.engine` is the running engine, and `strike()` from `src/lib/storm.ts`
calls down lightning (so does clicking the open sky).

### Performance budget

- The scene renders at roughly 430×260 pixels, so fill rate is tiny. Static geometry is merged
  into one mesh per material at load (`mergeStatic` in `build.ts`), so the whole churchyard is
  about 70 draw calls; hedges, grass tufts and railings are instanced; the mist is one mesh of
  billboards. Keep it that way when adding things: put new static meshes in the scene and they
  get merged; mark anything animated with `userData.dynamic`.
- The render loop skips frames while the tab is hidden. three.js is loaded lazily, in its own
  chunk, while the title screen shows.
- Changing the number of lights recompiles every shader: the light pool is a fixed size (`POOL`).
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
src/world/      the 3D churchyard: engine, layout (stations), build, textures, voxels, sky, post,
                and its React overlays (World, GateTitle, Reader)
src/content/    all copy and data, typed, with no JSX
src/sections/   the content of each place (Links, NowPlaying, Projects, About, Notes, Footer)
src/pages/      NotePage (a note over the world) and Plain (the no-WebGL fallback)
src/components/ Nav (the HUD), GlitchHandle, MiniPlayer, PixelCross, Icon…
src/fx/         effects: Cursor, JewelCase, ScrambleText, ScanReveal, Resurface, TiltCard…
src/hooks/      useLanyard, useVisualizer, usePauseOffscreen, useRepoStats, useKonami, useFinePointer
src/lib/        global stores (Last.fm feed, player), lightning bus, sfx, helpers
```
