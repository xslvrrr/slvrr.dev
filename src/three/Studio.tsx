import { Environment, Lightformer } from '@react-three/drei'

/**
 * A procedural "photo studio" the chrome reflects. No HDR download needed;
 * colors come from the design tokens so the reflections match the page.
 */
export function Studio({ colors }: { colors: [string, string, string, string] }) {
  const [a, b, c, d] = colors
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#050507']} />
      {/* big soft key light */}
      <Lightformer form="rect" intensity={2.5} position={[0, 5, -2]} scale={[12, 2, 1]} />
      {/* thin strips give chrome its sharp highlights */}
      <Lightformer
        form="rect"
        intensity={3}
        position={[-5, 1, 1]}
        rotation-y={Math.PI / 2}
        scale={[8, 0.35, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3}
        position={[5, -1, 1]}
        rotation-y={-Math.PI / 2}
        scale={[8, 0.35, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2}
        position={[0, -4, 2]}
        rotation-x={-Math.PI / 2}
        scale={[10, 0.3, 1]}
      />
      {/* iridescent color panels */}
      <Lightformer
        form="ring"
        color={a}
        intensity={3}
        position={[-3, 2, 4]}
        scale={2.5}
      />
      <Lightformer form="ring" color={b} intensity={3} position={[3, -2, 4]} scale={2} />
      <Lightformer
        form="rect"
        color={c}
        intensity={4}
        position={[4, 3, -3]}
        scale={[3, 3, 1]}
      />
      <Lightformer
        form="rect"
        color={d}
        intensity={3}
        position={[-4, -3, -3]}
        scale={[3, 3, 1]}
      />
    </Environment>
  )
}
