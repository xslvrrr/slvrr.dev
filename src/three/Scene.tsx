import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { lazy, Suspense, useEffect, useMemo, useState, type RefObject } from 'react'
import { Vector2 } from 'three'
import { cssVar } from '@/lib/cssVar'
import type { Mode } from '@/lib/store'
import { ChromeBlob } from './ChromeBlob'
import { heroDefaults, type HeroParams } from './heroDefaults'
import { Studio } from './Studio'

// Only exists in `npm run dev`; the import is stripped from production builds.
const DevTuner = import.meta.env.DEV ? lazy(() => import('./DevTuner')) : null

/** Highest pixel ratio the hero ever renders at, even on 2× / 3× screens. */
const MAX_DPR = 1.5
const FPS = 60

export interface SceneProps {
  eventSource: RefObject<HTMLElement | null>
  /** Render continuously (hero on screen and the splash dismissed). */
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
  // PerformanceMonitor lowers this (and then switches to lite effects) if frames drop.
  const [dpr, setDpr] = useState(lite ? 1 : MAX_DPR)
  const [degraded, setDegraded] = useState(false)
  const cheap = lite || degraded

  const params = useMemo(() => {
    let p = raw
    if (cheap) p = { ...p, detail: Math.min(p.detail, 40), aberration: 0 }
    // On touch screens the last tap would otherwise drag the blob off-center.
    if (lite) p = { ...p, follow: 0 }
    return p
  }, [raw, cheap, lite])

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
        // Frames are requested by <FrameLimiter>, never faster than FPS.
        frameloop="demand"
        // [min, max] form: clamps to the screen's real pixel ratio, never above it.
        dpr={[1, dpr]}
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      >
        <FrameLimiter running={active && !still} />
        <PerformanceMonitor
          bounds={() => [45, 58]}
          flipflops={4}
          onChange={({ factor }) => {
            const max = lite ? 1 : MAX_DPR
            setDpr(Math.round((1 + (max - 1) * factor) * 4) / 4)
          }}
          onDecline={({ factor }) => factor < 0.2 && setDegraded(true)}
          onFallback={() => setDegraded(true)}
        />
        <Studio key={mode} colors={colors} />
        <ChromeBlob params={params} tint={tint} scroll={scroll} />
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            levels={cheap ? 4 : 5}
            resolutionScale={0.5}
            intensity={params.bloom}
            luminanceThreshold={params.bloomThreshold}
            luminanceSmoothing={0.2}
          />
          <ChromaticAberration
            offset={aberration}
            radialModulation
            modulationOffset={0.2}
            blendFunction={cheap ? BlendFunction.SKIP : BlendFunction.NORMAL}
          />
          <Noise opacity={params.grain} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      </Canvas>
    </>
  )
}

/**
 * Drives the "demand" frameloop at a capped rate, so 120 Hz displays
 * don't render the chrome twice as often as they need to.
 */
function FrameLimiter({ running }: { running: boolean }) {
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    if (!running) return
    const interval = 1000 / FPS
    let last = 0
    let raf = requestAnimationFrame(function loop(t) {
      raf = requestAnimationFrame(loop)
      // 1 ms of slack so a 60 Hz display never skips alternate frames.
      if (t - last >= interval - 1) {
        last = t
        invalidate()
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [running, invalidate])

  return null
}
