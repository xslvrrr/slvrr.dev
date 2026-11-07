/**
 * Moods for the night scene behind the page (src/fx/NightScene.tsx).
 * Each page section sets `data-bg="<theme name>"`; the weather and sky blend
 * from one mood to the next as you scroll between sections.
 */
export interface BgTheme {
  /**
   * The sky's four posterized cloud bands, darkest to brightest:
   * [clear sky, cloud shadow, cloud body, moonlit cloud edge].
   */
  sky: [string, string, string, string]
  /** Rain density, 0 (dry) to 1 (downpour). */
  rain: number
  /** Lightning strikes per minute (on average). */
  storm: number
  /** Cloud cover, 0 (clear, starry) to 1 (overcast). */
  clouds: number
  /** Ground fog, 0 to 1. */
  fog: number
  /** Candlelight in the windows and lanterns, 0 to 1. */
  glow: number
  /** How much the rain slants (pixels sideways per pixel down). */
  wind: number
  /** How fast the clouds drift. */
  speed: number
}

// Monochrome night: near-black sky, charcoal storm clouds, moonlit grey edges.
// Sections differ in weather, so walking feels like the storm moving through.
export const bgThemes = {
  hero: {
    sky: ['#08080a', '#121214', '#1d1d21', '#58585e'],
    rain: 0.55,
    storm: 2,
    clouds: 0.55,
    fog: 0.25,
    glow: 0.9,
    wind: 0.18,
    speed: 0.5,
  },
  links: {
    sky: ['#07070a', '#111114', '#1c1c20', '#55555c'],
    rain: 0.75,
    storm: 3,
    clouds: 0.7,
    fog: 0.3,
    glow: 0.8,
    wind: 0.28,
    speed: 0.7,
  },
  music: {
    sky: ['#08080a', '#121214', '#1c1c20', '#505056'],
    rain: 0.6,
    storm: 4,
    clouds: 0.75,
    fog: 0.35,
    glow: 1,
    wind: 0.22,
    speed: 0.8,
  },
  work: {
    sky: ['#060608', '#0d0d10', '#161619', '#3e3e44'],
    rain: 0.95,
    storm: 6,
    clouds: 0.9,
    fog: 0.4,
    glow: 0.75,
    wind: 0.35,
    speed: 1,
  },
  about: {
    sky: ['#08080a', '#131315', '#222226', '#76767c'],
    rain: 0.3,
    storm: 0.5,
    clouds: 0.35,
    fog: 0.55,
    glow: 1,
    wind: 0.1,
    speed: 0.3,
  },
  notes: {
    sky: ['#070709', '#111113', '#1d1d20', '#56565b'],
    rain: 0.45,
    storm: 1,
    clouds: 0.6,
    fog: 0.8,
    glow: 0.9,
    wind: 0.15,
    speed: 0.35,
  },
  footer: {
    sky: ['#050506', '#0d0d0f', '#18181b', '#4e4e55'],
    rain: 1,
    storm: 9,
    clouds: 0.95,
    fog: 0.6,
    glow: 0.7,
    wind: 0.42,
    speed: 1.2,
  },
} satisfies Record<string, BgTheme>

export type BgThemeName = keyof typeof bgThemes

/** Konami "blood moon" mode swaps every theme's sky for a red one. */
export const bloodMoonSky: BgTheme['sky'] = ['#0a0306', '#1f070d', '#3a0d16', '#a3313b']
