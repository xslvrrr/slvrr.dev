import { Color, MeshPhysicalMaterial, Vector3 } from 'three'

/**
 * A MeshPhysicalMaterial whose vertices are pushed around by layered simplex
 * noise, plus a "pull" that bulges the surface toward the cursor.
 * Expects a unit sphere (radius 1). Normals are recomputed in the shader so
 * reflections follow the deformed surface.
 */
export interface ChromeUniforms {
  uTime: { value: number }
  uAmp: { value: number }
  uFreq: { value: number }
  uSpeed: { value: number }
  uPull: { value: number }
  uPointer: { value: Vector3 }
}

// Ashima Arts / Stefan Gustavson 3D simplex noise (MIT).
const noise = /* glsl */ `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`

const header = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uSpeed;
uniform float uPull;
uniform vec3 uPointer;
${noise}
vec3 chromeDisplace(vec3 p) {
  vec3 n = normalize(p);
  float t = uTime * uSpeed;
  float d = snoise(n * uFreq + vec3(t, t * 0.7, -t * 0.4)) * uAmp;
  d += snoise(n * uFreq * 2.3 - vec3(t * 1.3)) * uAmp * 0.35;
  float facing = max(dot(n, uPointer), 0.0);
  d += pow(facing, 6.0) * uPull;
  return n * (1.0 + d);
}
`

const normalChunk = /* glsl */ `
vec3 cN = normalize(position);
vec3 cT = normalize(abs(cN.y) > 0.99 ? cross(cN, vec3(1.0, 0.0, 0.0)) : cross(cN, vec3(0.0, 1.0, 0.0)));
vec3 cB = normalize(cross(cN, cT));
float cE = 0.004;
vec3 cP0 = chromeDisplace(position);
vec3 cP1 = chromeDisplace(position + cT * cE);
vec3 cP2 = chromeDisplace(position + cB * cE);
vec3 objectNormal = normalize(cross(cP1 - cP0, cP2 - cP0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`

export function createChromeMaterial() {
  const uniforms: ChromeUniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.18 },
    uFreq: { value: 1.4 },
    uSpeed: { value: 0.25 },
    uPull: { value: 0.35 },
    uPointer: { value: new Vector3(0, 0, 1) },
  }

  const material = new MeshPhysicalMaterial({
    color: new Color('#ffffff'),
    metalness: 1,
    roughness: 0.08,
    iridescence: 1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 820],
    envMapIntensity: 1.4,
  })

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${header}`)
      .replace('#include <beginnormal_vertex>', normalChunk)
      .replace('#include <begin_vertex>', 'vec3 transformed = cP0;')
  }
  // Keep a distinct program cache key so three never reuses a plain physical shader.
  material.customProgramCacheKey = () => 'slvrr-chrome'

  return { material, uniforms }
}
