/**
 * Looks for the animated page background (src/fx/ShaderBackground.tsx).
 * Each page section sets `data-bg="<theme name>"`; the background morphs
 * between themes as you scroll from one section into the next.
 */
export interface BgTheme {
  /**
   * The four posterized bands, darkest to brightest: [base, shadow, mid, highlight].
   * The highlight only shows in the brightest spots, so keep the first two dark.
   */
  colors: [string, string, string, string]
  /** Zoom of the noise field: higher = smaller, busier shapes. */
  scale: number
  /** How strongly the flow folds in on itself. */
  warp: number
  /** Flow speed. */
  speed: number
  /** 0 = soft blobs, 1 = thin glowing ribbons. */
  ribbons: number
  /** Overall brightness (0 to 1). Lower = fewer bright bands. */
  intensity: number
  /** Balatro-style spiral twist (0 = none). */
  swirl: number
}

// "Mono + ice": near-black and graphite with cold highlights. Sections differ by a
// slight hue shift and by the shape of the flow.
export const bgThemes = {
  hero: {
    // Kept dim: the hero wordmark is difference-blended over it.
    colors: ['#040507', '#0d1219', '#18222d', '#6f9db3'],
    scale: 1.1,
    warp: 1.2,
    speed: 0.5,
    ribbons: 0.15,
    intensity: 0.8,
    swirl: 0.6,
  },
  links: {
    colors: ['#030608', '#0e202c', '#184151', '#bdf2ff'],
    scale: 1.5,
    warp: 1.8,
    speed: 0.7,
    ribbons: 0.65,
    intensity: 0.85,
    swirl: 0.3,
  },
  music: {
    colors: ['#050507', '#1a1d2c', '#2e3656', '#c3cfff'],
    scale: 1.3,
    warp: 1.5,
    speed: 0.9,
    ribbons: 0.3,
    intensity: 0.9,
    swirl: 0.9,
  },
  work: {
    colors: ['#030506', '#0f1b1f', '#1c353a', '#a6efe4'],
    scale: 2.1,
    warp: 0.9,
    speed: 0.6,
    ribbons: 0.9,
    intensity: 0.85,
    swirl: 0.15,
  },
  about: {
    colors: ['#060607', '#1d2025', '#323942', '#e6edf5'],
    scale: 0.9,
    warp: 1.05,
    speed: 0.3,
    ribbons: 0.1,
    intensity: 0.85,
    swirl: 0.5,
  },
  notes: {
    colors: ['#040405', '#14161b', '#242831', '#aebccb'],
    scale: 1.7,
    warp: 1.35,
    speed: 0.3,
    ribbons: 0.45,
    intensity: 0.8,
    swirl: 0.2,
  },
  footer: {
    colors: ['#020304', '#0f1f33', '#1c3e60', '#dff6ff'],
    scale: 1.4,
    warp: 1.65,
    speed: 0.8,
    ribbons: 0.5,
    intensity: 0.95,
    swirl: 1,
  },
} satisfies Record<string, BgTheme>

export type BgThemeName = keyof typeof bgThemes

/** Konami "mercury" mode swaps every theme's colors for liquid gold. */
export const mercuryColors: BgTheme['colors'] = [
  '#0a0703',
  '#4f330c',
  '#7a4f18',
  '#ffd27d',
]
