import * as THREE from 'three'

/**
 * Shared uniforms every material reads: time (for swaying grass), the
 * vertex-snapping grid (the PS1-style wobble), wind strength.
 */
export const shared = {
  uTime: { value: 0 },
  uSnap: { value: new THREE.Vector2(160, 120) },
  uWind: { value: 0.5 },
}

/**
 * Snaps every vertex to a coarse screen grid after projection, the way old
 * consoles without sub-pixel precision did, so geometry jitters very
 * slightly as you move. Part of the "found footage of a 1998 game" feel.
 */
export function psx<T extends THREE.Material>(m: T, opts: { sway?: boolean } = {}): T {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = shared.uSnap
    shader.uniforms.uTime = shared.uTime
    shader.uniforms.uWind = shared.uWind
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'uniform vec2 uSnap;\nuniform float uTime;\nuniform float uWind;\nvoid main() {',
      )
      .replace(
        '#include <project_vertex>',
        opts.sway
          ? /* glsl */ `
            vec4 mvPosition = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              mvPosition = instanceMatrix * mvPosition;
            #endif
            vec4 wp = modelMatrix * mvPosition;
            float k = max(0.0, position.y) * (0.5 + uWind);
            wp.x += sin(uTime * 1.7 + wp.x * 0.6 + wp.z * 0.4) * 0.07 * k;
            wp.z += cos(uTime * 1.3 + wp.x * 0.5) * 0.05 * k;
            mvPosition = viewMatrix * wp;
            gl_Position = projectionMatrix * mvPosition;`
          : '#include <project_vertex>',
      )
      .replace(
        '#include <fog_vertex>',
        /* glsl */ `#include <fog_vertex>
        gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;`,
      )
  }
  m.customProgramCacheKey = () => (opts.sway ? 'psx-sway' : 'psx')
  return m
}

/** Lambert (per-vertex-ish, flat and cheap) with the PSX wobble. */
export function lambert(
  params: THREE.MeshLambertMaterialParameters,
  opts?: { sway?: boolean },
) {
  return psx(new THREE.MeshLambertMaterial(params), opts)
}

/** Unlit (glowing windows, flames). */
export function basic(params: THREE.MeshBasicMaterialParameters) {
  return psx(new THREE.MeshBasicMaterial(params))
}
