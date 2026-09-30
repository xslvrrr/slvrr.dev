import { button, folder, Leva, useControls } from 'leva'
import { useEffect } from 'react'
import { heroDefaults as d, type HeroParams } from './heroDefaults'

let latest: HeroParams = d

/**
 * Dev-only slider panel for the hero (never shipped in production builds).
 * Tweak until it looks right, press "copy values", paste into heroDefaults.ts.
 */
export default function DevTuner({ onChange }: { onChange: (p: HeroParams) => void }) {
  const values = useControls('chrome hero', {
    shape: folder({
      amp: { value: d.amp, min: 0, max: 0.6, step: 0.01 },
      freq: { value: d.freq, min: 0.2, max: 5, step: 0.05 },
      speed: { value: d.speed, min: 0, max: 1.5, step: 0.01 },
      pull: { value: d.pull, min: 0, max: 1.2, step: 0.01 },
      scale: { value: d.scale, min: 0.5, max: 2.5, step: 0.01 },
      detail: { value: d.detail, min: 16, max: 160, step: 8 },
    }),
    surface: folder({
      color: d.color,
      roughness: { value: d.roughness, min: 0, max: 1, step: 0.01 },
      iridescence: { value: d.iridescence, min: 0, max: 1, step: 0.01 },
      iridescenceIOR: { value: d.iridescenceIOR, min: 1, max: 2.5, step: 0.01 },
      envIntensity: { value: d.envIntensity, min: 0, max: 4, step: 0.05 },
    }),
    motion: folder({
      spin: { value: d.spin, min: 0, max: 1, step: 0.01 },
      follow: { value: d.follow, min: 0, max: 1, step: 0.01 },
    }),
    post: folder({
      bloom: { value: d.bloom, min: 0, max: 3, step: 0.05 },
      bloomThreshold: { value: d.bloomThreshold, min: 0, max: 1, step: 0.01 },
      aberration: { value: d.aberration, min: 0, max: 0.01, step: 0.0001 },
      grain: { value: d.grain, min: 0, max: 0.4, step: 0.01 },
    }),
    'copy values': button(() => {
      void navigator.clipboard.writeText(JSON.stringify(latest, null, 2))
    }),
  }) as HeroParams

  // Leva can hand back a fresh object on every render; only push real changes,
  // otherwise Scene re-renders (and redraws the canvas) in a loop.
  const serialized = JSON.stringify(values)
  useEffect(() => {
    latest = JSON.parse(serialized) as HeroParams
    onChange(latest)
  }, [serialized, onChange])

  return (
    <Leva collapsed titleBar={{ title: 'tune the chrome', position: { x: 0, y: 44 } }} />
  )
}
