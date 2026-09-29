/**
 * The look of the 3D hero. In `npm run dev` every value here gets a slider
 * (top-right "tune the chrome" panel, see DevTuner.tsx). When you find a look
 * you like, hit "copy values" in the panel and paste the result over this object.
 */
export const heroDefaults = {
  // shape
  amp: 0.2,
  freq: 1.4,
  speed: 0.25,
  pull: 0.35,
  scale: 1.0,
  detail: 96,
  // surface
  color: '#ffffff',
  roughness: 0.08,
  iridescence: 1,
  iridescenceIOR: 1.6,
  envIntensity: 1.1,
  // motion
  spin: 0.12,
  follow: 0.35,
  // post-processing
  bloom: 0.3,
  bloomThreshold: 0.9,
  aberration: 0.0012,
  grain: 0.06,
  vignette: 0.55,
}

export type HeroParams = typeof heroDefaults
