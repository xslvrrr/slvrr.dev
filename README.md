# slvrr.dev

A personal landing page in the style of carrd / guns.lol, with a lot more going on. **V2
("vespers")** is monochrome pixel-art gothic: a walk through a night garden around a cathedral,
in a storm. On wide screens you scroll sideways past statues and landmarks, one per section,
with rain, fog, lightning you can call down, candlelit windows, a magnifying link dock, live Discord presence, Last.fm "now playing",
project cards with a glassy tilt, MDX notes and a few secrets.

Built with **Vite + React + TypeScript**, **Tailwind CSS v4**, **Motion**, **WebGL**, **Lenis** and
**MDX**. Deployed on **Vercel**. (V1, the liquid-chrome version, is in the git history before the V2 redesign.)

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
| The garden, landmarks, cathedral   | `src/scene/` (see below)                         |
| Statues                            | `src/scene/sprites.ts`                           |
| Weather / sky per section          | `src/styles/backgroundThemes.ts`                 |
| Section order                      | `src/pages/Home.tsx`                             |

All copy lives in `src/content/`. The bio and section headings are drafts, so rewrite them freely.

### Covers

`npm run covers` downloads artwork for every item in `src/content/media.ts` into
`public/covers/`. Spotify album links and YouTube links are resolved automatically; for anything
else, add an `art` URL to the item. Existing files are kept, so delete one to re-fetch it. Set
`swatch: '#hex'` instead to use a flat colour as the cover (like solace's pink). Items without a
cover show a generated tile. Covers sit in 3D jewel cases (`src/fx/JewelCase.tsx`).

### The garden walk

The home page is a walk through a night garden around a cathedral. Each section is a stop at a
**landmark** (its `data-landmark` attribute):

| Section | Landmark                                    |
| ------- | ------------------------------------------- |
| Hero    | `gate`: the churchyard gate, lanterns lit   |
| Links   | `herald`: an angel sounding a trumpet       |
| Music   | `fountain`: a fountain with a cherub        |
| Work    | `mausoleum`: where the relics are kept      |
| About   | `shrine`: a Madonna, candles, a hooded monk |
| Notes   | `graves`: a weeping angel on a tomb         |
| Footer  | `calvary`: a tall cross between two angels  |

On wide screens (≥1024×600, see `EXPLORE_QUERY` in `src/lib/explore.ts` and the `explore:`
Tailwind variant) the page is a **side-scroller**: `src/components/ExploreTrack.tsx` lays the
sections side by side and scrolling (or swiping sideways) walks you along them. Each section
leaves a gap (`<Landmark />`) where its landmark stands in the garden, and the garden moves
exactly with the content. On phones the page stays vertical and the background walks from
landmark to landmark between sections instead.

The scene (`src/fx/NightScene.tsx`) is drawn as big crisp pixels (one scene pixel is 2–5 CSS
pixels, so the screen is ~250 scene pixels tall), in greys:

- **Sky**: storm clouds posterized into four bands with ordered (Bayer) dithering, stars in the
  gaps, a moon that lights the cloud edges.
- **Three parallax layers**, drawn procedurally by `src/scene/buildScene.ts`: the far cathedral
  (`cathedral.ts`) over a distant tree line; the garden, as wide as the walk, with each landmark
  (at double size) and statues, lamps, graves and cypresses in between; and dark foreground
  silhouettes that sweep past faster. Pixels store _materials_, not colours (see
  `src/scene/layers.ts`), so the shader can light them: moonlight on edges facing the moon,
  flickering candlelit glass, falling water, lightning outlining everything.
- **Statues** are hand-drawn pixel sprites in `src/scene/sprites.ts` (praying angel, herald,
  weeper, monk, Madonna, cherub, bust, urn). Add one there and place it in `buildScene.ts`.
- **Weather**: two layers of pixel rain, ground fog, lightning. Click the hero to call a strike
  down (with thunder, if sound is on); the storm also strikes on its own. Each section's
  `data-bg` theme in `src/styles/backgroundThemes.ts` sets its sky, rain, storm (strikes per
  minute), cloud cover, fog, candlelight and wind, blended as you walk.

In `npm run dev`, call `strike()` in the console to test the lightning.

The site is monochrome: photos (album covers, avatars) stay grey until hovered. Fonts are
**Jacquard 24** (pixel blackletter) for display, **Pixelify Sans** for reading and
**Silkscreen** for labels. Panels use a pixel-art nine-slice frame (`.panel` in
`src/styles/index.css`).

### Performance budget

- The night scene renders one shader pixel per 2–5 CSS pixels (about 250 rows), at 30 fps, and
  stops while the tab is hidden. The garden is drawn once, and again only when the layout
  moves a landmark (resize, fonts loading, a live widget changing size).
- Inside the sideways track, `position: fixed` doesn't work (the track is transformed), so
  overlays there are portalled to `document.body` (see the footer's stats panel).
- Avoid `backdrop-filter`, big `filter: blur()` layers and infinite `background-position`
  animations on large elements. Over an animated background they force full-screen repaints
  every frame. The small shimmering `.text-glass` glyphs are fine.
- Animate `transform` and `opacity` only, and only run a `requestAnimationFrame` loop while
  something is actually moving (see `ScrambleText`, `useVisualizer`). Wrap infinite CSS
  animations in an element using `usePauseOffscreen` so they stop while scrolled away.

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

- The splash screen's doors open with a click, which unlocks audio (a church bell). UI sounds,
  thunder and the organ swell on "ascend" are synthesized with WebAudio, and the **sound**
  toggle is in the nav.
- ↑ ↑ ↓ ↓ ← → ← → B A raises the blood moon, the only colour on the site.
- The faint `?` in the footer opens "stats for nerds".
- `prefers-reduced-motion` gets a still scene (no rain motion, no lightning flashes) and no
  motion animations. Touch devices get no custom cursor.
- `npm run og` re-renders the social preview (`public/og.png`) by screenshotting the hero. Run
  `npm run build && npm run preview` first (it expects the site on port 4173).

## Layout

```
api/            Vercel functions (lastfm, github, preview, audio)
src/content/    all copy and data, typed, with no JSX
src/sections/   page sections (Splash, Hero, Links, NowPlaying, Projects, About, Notes, Footer)
src/components/ ExploreTrack, Nav, GlitchHandle, MiniPlayer, SectionHeading, PixelCross, Icon…
src/scene/      the procedural pixel-art garden, cathedral and statue sprites
src/fx/         effects: NightScene, Cursor, JewelCase, ScrambleText, ScanReveal, Resurface, TiltCard, Marquee…
src/hooks/      useLanyard, useVisualizer, usePauseOffscreen, useRepoStats, useKonami, useFinePointer
src/lib/        global stores (Last.fm feed, player), explore state, lightning bus, sfx, helpers
```
