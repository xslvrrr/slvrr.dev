# slvrr.dev

A personal landing page in the style of carrd / guns.lol, with a lot more going on. **V2
("vespers")** is pixel-art gothic: night in the garden outside a cathedral, in a storm. A
hand-drawn (well, code-drawn) pixel scene with rain, fog, lightning you can call down,
candlelit stained glass, a magnifying link dock, live Discord presence, Last.fm "now playing",
project cards with a stained-glass tilt, MDX notes and a few secrets.

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
| The cathedral and garden           | `src/scene/buildScene.ts` (see below)            |
| Weather / sky per section          | `src/styles/backgroundThemes.ts`                 |
| Section order                      | `src/pages/Home.tsx`                             |

All copy lives in `src/content/`. The bio and section headings are drafts, so rewrite them freely.

### Covers

`npm run covers` downloads artwork for every item in `src/content/media.ts` into
`public/covers/`. Spotify album links and YouTube links are resolved automatically; for anything
else, add an `art` URL to the item. Existing files are kept, so delete one to re-fetch it. Set
`swatch: '#hex'` instead to use a flat colour as the cover (like solace's pink). Items without a
cover show a generated tile. Covers sit in 3D jewel cases (`src/fx/JewelCase.tsx`).

### The night scene

The whole page sits over one small WebGL scene (`src/fx/NightScene.tsx`), drawn as big crisp
pixels (one scene pixel is 2–5 CSS pixels, so the screen is ~250 scene pixels tall):

- **Sky**: storm clouds posterized into four colour bands with ordered (Bayer) dithering, stars in
  the gaps, and a moon whose light catches the cloud edges.
- **Cathedral and garden**: drawn procedurally into two data textures by
  `src/scene/buildScene.ts` (twin spires, rose window, a door left ajar; iron fence, lanterns,
  gravestones, cypresses, an angel, dead trees). Pixels store _materials_, not colours (see
  `src/scene/layers.ts`), so the shader can light them: moonlight on edges facing the moon,
  flickering candlelit glass, lightning outlining everything.
- **Weather**: two layers of pixel rain, ground fog, and lightning. Click the hero to call a
  strike down (with thunder, if sound is on); the storm also strikes on its own.
- **Scroll**: the layers slide at different speeds, so you slowly descend from the spires into
  the churchyard. Each section has a `data-bg="<theme>"` attribute, and each theme in
  `src/styles/backgroundThemes.ts` sets its sky colours, rain, storm (strikes per minute), cloud
  cover, fog, candlelight and wind; the weather blends between them as you scroll.

To change the architecture, edit the drawing functions in `buildScene.ts`: everything is in
"design units" (`D`) relative to the facade, so it scales to any screen. In `npm run dev`, call
`strike()` in the console to test the lightning.

Fonts: **Jacquard 24** (pixel blackletter) for display, **Pixelify Sans** for reading,
**Silkscreen** for labels. Panels use a pixel-art nine-slice frame (`.panel` in
`src/styles/index.css`).

### Performance budget

- The night scene renders one shader pixel per 2–5 CSS pixels (about 250 rows), at 30 fps, and
  stops while the tab is hidden. The cathedral and garden are drawn once, on load and resize.
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
- ↑ ↑ ↓ ↓ ← → ← → B A raises the blood moon.
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
src/components/ Nav, GlitchHandle, MiniPlayer, SectionHeading, PixelCross, Icon, ErrorBoundary
src/scene/      the procedural pixel-art cathedral and garden
src/fx/         effects: NightScene, Cursor, JewelCase, ScrambleText, ScanReveal, Resurface, TiltCard, Marquee…
src/hooks/      useLanyard, useVisualizer, usePauseOffscreen, useRepoStats, useKonami, useFinePointer
src/lib/        global stores (Last.fm feed, player), lightning bus, synthesized sfx, helpers
```
