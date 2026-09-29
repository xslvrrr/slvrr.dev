import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, MathUtils, Quaternion, Vector3, type Mesh } from 'three'
import { createChromeMaterial } from './chromeMaterial'
import type { HeroParams } from './heroDefaults'

interface Props {
  params: HeroParams
  tint: string
  /** 0 → 1 as the hero scrolls out of view. */
  scroll: { get(): number }
}

const tmpDir = new Vector3()
const tmpQuat = new Quaternion()

export function ChromeBlob({ params, tint, scroll }: Props) {
  const mesh = useRef<Mesh>(null)
  const { material, uniforms } = useMemo(() => createChromeMaterial(), [])
  const pointer = useRef(new Vector3(0, 0, 1))
  const pulse = useRef(0)

  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    material.color = new Color(params.color).multiply(new Color(tint))
    material.roughness = params.roughness
    material.iridescence = params.iridescence
    material.iridescenceIOR = params.iridescenceIOR
    material.envMapIntensity = params.envIntensity
  }, [material, params, tint])

  useFrame((state, delta) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const p = scroll.get()

    // Aim the bulge at the cursor, expressed in the blob's own (rotating) space.
    tmpDir.set(state.pointer.x * 1.6, state.pointer.y * 1.2, 1).normalize()
    tmpQuat.copy(m.quaternion).invert()
    tmpDir.applyQuaternion(tmpQuat)
    pointer.current.lerp(tmpDir, 1 - Math.exp(-delta * 6)).normalize()

    pulse.current = MathUtils.damp(pulse.current, 0, 3, delta)

    uniforms.uTime.value = t
    uniforms.uAmp.value = params.amp + pulse.current * 0.25 + p * 0.15
    uniforms.uFreq.value = params.freq
    uniforms.uSpeed.value = params.speed + pulse.current * 0.8
    uniforms.uPull.value = params.pull
    uniforms.uPointer.value.copy(pointer.current)

    m.rotation.y += delta * params.spin
    m.rotation.x = MathUtils.damp(m.rotation.x, -state.pointer.y * 0.4, 2, delta)
    m.position.x = MathUtils.damp(m.position.x, state.pointer.x * params.follow, 3, delta)
    m.position.y = MathUtils.damp(
      m.position.y,
      state.pointer.y * params.follow * 0.6 + p * 1.2 + Math.sin(t * 0.8) * 0.05,
      3,
      delta,
    )
    // Shrink on narrow (portrait) screens so the blob never overflows sideways.
    const fit = Math.min(1, state.viewport.width / 3.2)
    const s = params.scale * fit * (1 - p * 0.35)
    m.scale.setScalar(MathUtils.damp(m.scale.x, s, 4, delta))
  })

  return (
    <mesh
      ref={mesh}
      material={material}
      onPointerDown={() => {
        pulse.current = 1
      }}
    >
      <icosahedronGeometry args={[1, Math.round(params.detail)]} />
    </mesh>
  )
}
