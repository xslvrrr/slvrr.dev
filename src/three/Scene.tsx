import { Canvas } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { lazy, Suspense, useMemo, useState, type RefObject } from 'react'
import { Vector2 } from 'three'
import { cssVar } from '@/lib/cssVar'
import type { Mode } from '@/lib/store'
import { ChromeBlob } from './ChromeBlob'
import { heroDefaults, type HeroParams } from './heroDefaults'
import { Studio } from './Studio'

// Only exists in `npm run dev`; the import is stripped from production builds.
const DevTuner = import.meta.env.DEV ? lazy(() => import('./DevTuner')) : null

export interface SceneProps {
  eventSource: RefObject<HTMLElement | null>
  /** Pause rendering when the hero is off screen. */
  active: boolean
  /** Render a single still frame (prefers-reduced-motion). */
  still: boolean
  /** Lower-cost settings for small/touch screens. */
  lite: boolean
  mode: Mode
  scroll: { get(): number }
}

export default function Scene({
  eventSource,
  active,
  still,
  lite,
  mode,
  scroll,
}: SceneProps) {
  const [raw, setRaw] = useState<HeroParams>(heroDefaults)
  const params = useMemo(
    () => (lite ? { ...raw, detail: Math.min(raw.detail, 48), aberration: 0 } : raw),
    [raw, lite],
  )

  // Read from the design tokens, so the Konami mode swap recolors the reflections too.
  const colors: [string, string, string, string] = [
    cssVar('--color-iri-1'),
    cssVar('--color-iri-2'),
    cssVar('--color-iri-3'),
    cssVar('--color-iri-4'),
  ]
  const tint = mode === 'mercury' ? '#f3c979' : '#ffffff'
  const aberration = useMemo(
    () => new Vector2(params.aberration, params.aberration),
    [params.aberration],
  )

  return (
    <>
      {DevTuner && (
        <Suspense>
          <DevTuner onChange={setRaw} />
        </Suspense>
      )}
      <Canvas
        eventSource={eventSource as RefObject<HTMLElement>}
        eventPrefix="client"
        frameloop={still ? 'demand' : active ? 'always' : 'never'}
        dpr={lite ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#07070a']} />
        <Studio key={mode} colors={colors} />
        <ChromeBlob params={params} tint={tint} scroll={scroll} />
        <EffectComposer multisampling={lite ? 0 : 4}>
          <Bloom
            mipmapBlur
            intensity={params.bloom}
            luminanceThreshold={params.bloomThreshold}
            luminanceSmoothing={0.2}
          />
          <ChromaticAberration
            offset={aberration}
            radialModulation
            modulationOffset={0.2}
            blendFunction={BlendFunction.NORMAL}
          />
          <Noise opacity={params.grain} blendFunction={BlendFunction.OVERLAY} />
          <Vignette eskil={false} offset={0.2} darkness={params.vignette} />
        </EffectComposer>
      </Canvas>
    </>
  )
}
