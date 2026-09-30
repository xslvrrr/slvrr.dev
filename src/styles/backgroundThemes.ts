/**
 * Looks for the animated page background (src/fx/ShaderBackground.tsx).
 * Each page section sets `data-bg="<theme name>"`; the background morphs
 * between themes as you scroll from one section into the next.
 */
export interface BgTheme {
  /** [base, accent 1, accent 2, highlight]. Keep the base dark so text stays readable. */
  colors: [string, string, string, string]
  /** Zoom of the noise field: higher = smaller, busier shapes. */
  scale: number
  /** How strongly the flow folds in on itself. */
  warp: number
  /** Flow speed. */
  speed: number
  /** 0 = soft blobs, 1 = thin glowing ribbons. */
  ribbons: number
  /** Overall accent strength (0 to 1). */
  intensity: number
}

export const bgThemes = {
  hero: {
    colors: ['#07070a', '#241c3a', '#4b505c', '#c7a4ff'],
    scale: 1.1,
    warp: 1.2,
    speed: 0.5,
    ribbons: 0.15,
    intensity: 0.85,
  },
  links: {
    colors: ['#04080d', '#0b3a48', '#2f2462', '#9ef0ff'],
    scale: 1.5,
    warp: 1.8,
    speed: 0.7,
    ribbons: 0.65,
    intensity: 0.8,
  },
  music: {
    colors: ['#0b0408', '#521238', '#5e330c', '#ffb3e6'],
    scale: 1.3,
    warp: 1.5,
    speed: 1.1,
    ribbons: 0.3,
    intensity: 0.85,
  },
  work: {
    colors: ['#030806', '#153d24', '#0a4040', '#d9ffb3'],
    scale: 2.1,
    warp: 0.9,
    speed: 0.6,
    ribbons: 0.9,
    intensity: 0.7,
  },
  about: {
    colors: ['#0a070a', '#44263a', '#565a66', '#ffd6ee'],
    scale: 0.9,
    warp: 1.05,
    speed: 0.3,
    ribbons: 0.1,
    intensity: 0.75,
  },
  notes: {
    colors: ['#08080a', '#22232a', '#34363e', '#c9ced8'],
    scale: 1.7,
    warp: 1.35,
    speed: 0.3,
    ribbons: 0.45,
    intensity: 0.6,
  },
  footer: {
    colors: ['#07070a', '#33265f', '#0c4249', '#ffb3e6'],
    scale: 1.4,
    warp: 1.65,
    speed: 0.8,
    ribbons: 0.5,
    intensity: 0.9,
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
