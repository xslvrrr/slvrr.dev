import * as THREE from 'three'

/**
 * The last pass: the scene is rendered small, then quantized with an ordered
 * dither (fewer colours, visible pattern in the gradients), darkened at the
 * edges, given a little film grain, and faded to black for transitions. The
 * canvas is then scaled up with nearest-neighbour by CSS, so every texel is a
 * crisp block.
 */
export function createPost() {
  const target = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  })
  const uniforms = {
    tScene: { value: target.texture },
    uRes: { value: new THREE.Vector2(2, 2) },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uFlash: { value: 0 },
    uBlood: { value: 0 },
    uFocus: { value: 0 },
    uLevels: { value: 22 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene;
      uniform vec2 uRes;
      uniform float uTime, uFade, uFlash, uBlood, uFocus, uLevels;
      varying vec2 vUv;
      float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      void main() {
        // the scene target is linear; encode to sRGB (and lift the shadows a
        // touch, cooled, like a cheap CRT at night)
        vec3 c = texture2D(tScene, vUv).rgb;
        c = pow(max(c, 0.0), vec3(1.0 / 2.35)) * vec3(0.96, 1.0, 1.06);
        c = mix(c, c * vec3(1.35, 0.55, 0.5), uBlood * 0.55);
        c += uFlash * 0.12;
        // vignette, heavier while reading
        vec2 q = vUv - 0.5;
        float vig = 1.0 - dot(q, q) * (1.25 + uFocus * 0.6);
        c *= clamp(vig, 0.0, 1.0);
        // grain
        float g = fract(sin(dot(gl_FragCoord.xy + floor(uTime * 24.0) * 7.13, vec2(12.9898, 78.233))) * 43758.5453);
        c += (g - 0.5) * 0.025;
        c *= uFade;
        // ordered dither down to a few levels per channel
        float d = bayer4(gl_FragCoord.xy) - 0.5;
        c = floor(c * uLevels + d + 0.5) / uLevels;
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  return {
    target,
    uniforms,
    setSize(w: number, h: number) {
      target.setSize(w, h)
      uniforms.uRes.value.set(w, h)
    },
    render(renderer: THREE.WebGLRenderer) {
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
    },
  }
}
