# slvrr.dev

A personal landing page in the style of carrd / guns.lol, with a lot more going on: a liquid-chrome
3D hero, a magnifying link dock, live Discord presence, Last.fm "now playing", project cards with
holographic tilt, MDX notes and a few secrets.

Built with **Vite + React + TypeScript**, **Tailwind CSS v4**, **Motion**, **react-three-fiber**,
**Lenis** and **MDX**. Deployed on **Vercel**.

```bash
npm install
npm run dev        # http://localhost:5173 (with the "tune the chrome" slider panel)
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
| The 3D chrome look                 | `src/three/heroDefaults.ts` (see below)          |
| Animated background per section    | `src/styles/backgroundThemes.ts`                 |
| Section order                      | `src/pages/Home.tsx`                             |

All copy lives in `src/content/`. The bio and section headings are drafts, so rewrite them freely.

### Covers

`npm run covers` downloads artwork for every item in `src/content/media.ts` into
`public/covers/`. Spotify album links and YouTube links are resolved automatically; for anything
else, add an `art` URL to the item. Existing files are kept, so delete one to re-fetch it. Set
`swatch: '#hex'` instead to use a flat colour as the cover (like solace's pink). Items without a
cover show a generated tile. Covers sit in 3D jewel cases (`src/fx/JewelCase.tsx`).

### Finding the look

Run `npm run dev` and open the **tune the chrome** panel (top right). Every shape, surface,
motion and post-processing value is a live slider. When you like what you see, press
**copy values** and paste the JSON over the object in `src/three/heroDefaults.ts`. The panel is
dev-only and is stripped from production builds.

For a full reskin, change the tokens in `src/styles/tokens.css`. The 3D reflections read the
`--color-iri-*` tokens too.

The page background is a small WebGL shader in a Balatro-style "crunchy" look: a swirling
noise field posterized into four colour bands with ordered dithering, drawn as big crisp pixels
under faint CRT scanlines. It morphs between themes as you scroll. Each section has a
`data-bg="<theme>"` attribute, and each theme in `src/styles/backgroundThemes.ts` sets its four
colours, scale, warp, speed, swirl and ribbons vs blobs. To add a theme, add an entry there and
point a section at it. The pixel size is `PIXEL` in `src/fx/ShaderBackground.tsx`.

### Performance budget

- The hero renders at most 60 fps and a 1.5× pixel ratio. It pauses behind the splash screen
  and once scrolled out of view, and lowers its resolution or effects if frames drop.
- The background renders one shader pixel per 5×5 CSS pixels, at 30 fps.
- Avoid `backdrop-filter`, big `filter: blur()` layers and infinite `background-position`
  animations on large elements. Over an animated background they force full-screen repaints
  every frame. The small shimmering `.text-iri` glyphs are fine.
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

- The splash screen's click unlocks audio. UI sounds are synthesized with WebAudio, and the
  **sound** toggle is in the nav.
- ↑ ↑ ↓ ↓ ← → ← → B A switches to mercury mode.
- The faint `?` in the footer opens "stats for nerds".
- `prefers-reduced-motion` gets a still 3D frame and no motion animations. Touch devices get a
  lighter scene and no custom cursor.
- `npm run og` re-renders the social preview (`public/og.png`) from `scripts/og.html`.

## Layout

```
api/            Vercel functions (lastfm, github, preview, audio)
src/content/    all copy and data, typed, with no JSX
src/sections/   page sections (Splash, Hero, Links, NowPlaying, Projects, About, Notes, Footer)
src/components/ Nav, GlitchHandle, MiniPlayer, SectionHeading, Icon, ErrorBoundary
src/three/      the chrome blob: shader material, studio lighting, scene, dev tuner
src/fx/         effects: Cursor, JewelCase, ScrambleText, ScanReveal, Resurface, TiltCard, Marquee, ShaderBackground…
src/hooks/      useLanyard, useVisualizer, usePauseOffscreen, useRepoStats, useKonami, useFinePointer
src/lib/        global stores (Last.fm feed, player), synthesized sfx, helpers
```
