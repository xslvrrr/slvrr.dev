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
| Favourite albums / games / shows   | `src/content/media.ts`                           |
| Write a note                       | add `src/content/notes/<slug>.mdx` with a `meta` |
| Colors, fonts, radii, easing       | `src/styles/tokens.css`                          |
| The 3D chrome look                 | `src/three/heroDefaults.ts` (see below)          |
| Animated background per section    | `src/styles/backgroundThemes.ts`                 |
| Section order                      | `src/pages/Home.tsx`                             |

All copy in `src/content/` is placeholder text, so replace it with your own.

### Finding the look

Run `npm run dev` and open the **tune the chrome** panel (top right). Every shape, surface,
motion and post-processing value is a live slider. When you like what you see, press
**copy values** and paste the JSON over the object in `src/three/heroDefaults.ts`. The panel is
dev-only and is stripped from production builds.

For a full reskin, change the tokens in `src/styles/tokens.css`. The 3D reflections read the
`--color-iri-*` tokens too.

The page background is a small WebGL shader that morphs between themes as you scroll. Each
section has a `data-bg="<theme>"` attribute, and each theme in `src/styles/backgroundThemes.ts`
sets its colors, scale, warp, speed and ribbons vs blobs. To add a theme, add an entry there
and point a section at it.

### Performance budget

- The hero renders at most 60 fps and a 1.5× pixel ratio. It pauses behind the splash screen
  and once scrolled out of view, and lowers its resolution or effects if frames drop.
- The background renders at 1/6 resolution and 30 fps.
- Avoid `backdrop-filter`, big `filter: blur()` layers and infinite `background-position`
  animations. Over an animated background they force full-screen repaints every frame.

## Live integrations

Each widget falls back to static content if its data source is missing or fails.

- **Discord presence** uses [Lanyard](https://github.com/Phineas/lanyard). Join the Lanyard
  Discord server, then put your Discord user ID in `profile.discordId`.
- **Now playing** uses Last.fm. If you use Spotify, connect it to Last.fm. Set
  `profile.lastfmUser`, then add `LASTFM_API_KEY`
  ([get one](https://www.last.fm/api/account/create)) to the Vercel project's environment
  variables. The key stays server-side in `api/lastfm.ts`.
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
api/            Vercel functions (lastfm, github)
src/content/    all copy and data, typed, with no JSX
src/sections/   page sections (Splash, Hero, Links, NowPlaying, Projects, About, Notes, Footer)
src/three/      the chrome blob: shader material, studio lighting, scene, dev tuner
src/fx/         reusable effects: Cursor, Magnetic, TiltCard, TextReveal, Marquee, ShaderBackground
src/hooks/      useLanyard, useNowPlaying, useRepoStats, useKonami, useFinePointer
src/lib/        tiny global store, synthesized sfx, helpers
```
