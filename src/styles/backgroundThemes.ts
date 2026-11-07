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

// Blue-black night with violet storm clouds. Sections differ in weather more
// than in colour, so scrolling feels like the storm moving through.
export const bgThemes = {
  hero: {
    sky: ['#07070f', '#12111f', '#1f1c33', '#5b5878'],
    rain: 0.55,
    storm: 2,
    clouds: 0.55,
    fog: 0.25,
    glow: 0.9,
    wind: 0.18,
    speed: 0.5,
  },
  links: {
    sky: ['#06070e', '#10121f', '#1c2036', '#56607e'],
    rain: 0.75,
    storm: 3,
    clouds: 0.7,
    fog: 0.3,
    glow: 0.8,
    wind: 0.28,
    speed: 0.7,
  },
  music: {
    sky: ['#08060f', '#151022', '#231a34', '#5e4f78'],
    rain: 0.6,
    storm: 4,
    clouds: 0.75,
    fog: 0.35,
    glow: 1,
    wind: 0.22,
    speed: 0.8,
  },
  work: {
    sky: ['#05060b', '#0e111c', '#1a1f30', '#4c5671'],
    rain: 0.95,
    storm: 6,
    clouds: 0.9,
    fog: 0.4,
    glow: 0.75,
    wind: 0.35,
    speed: 1,
  },
  about: {
    sky: ['#07070d', '#13121c', '#22202f', '#7a7590'],
    rain: 0.3,
    storm: 0.5,
    clouds: 0.35,
    fog: 0.55,
    glow: 1,
    wind: 0.1,
    speed: 0.3,
  },
  notes: {
    sky: ['#06060b', '#111019', '#1d1b29', '#57536a'],
    rain: 0.45,
    storm: 1,
    clouds: 0.6,
    fog: 0.8,
    glow: 0.9,
    wind: 0.15,
    speed: 0.35,
  },
  footer: {
    sky: ['#040409', '#0f0d1c', '#1d1932', '#6b6a96'],
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
