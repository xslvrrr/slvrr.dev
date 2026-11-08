import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { basic } from './materials'
import type { Walk } from './path'
import type { SpriteName } from './sprites'
import { GATE_Z, type V2 } from './layout'
import * as tex from './textures'
import { voxelGeometry } from './voxel'

/**
 * Pieces the churchyard is built from: geometry helpers, statues, lamps, the
 * gate, graves, trees, the cathedral, the mist, and the pass that merges
 * static meshes. build.ts places them.
 */
export type Mat = THREE.Material

/** A box whose UVs tile its texture every `tile` metres on every face. */
export function boxGeo(w: number, h: number, d: number, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile)
    }
  return g
}

/** Scales a geometry's UVs so its texture repeats (cylinders, cones). */
export function tile<T extends THREE.BufferGeometry>(geo: T, u: number, v: number): T {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v)
  return geo
}

export function mesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: Mat | Mat[],
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

/** A box sitting on y (its base at y). */
export function block(
  parent: THREE.Object3D,
  mat: Mat | Mat[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
  tile = 1,
) {
  return mesh(parent, boxGeo(w, h, d, tile), mat, x, y + h / 2, z, ry)
}

export function mergeStatic(scene: THREE.Scene) {
  scene.updateMatrixWorld(true)
  const groups = new Map<
    string,
    { mat: THREE.Material; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }
  >()
  const visit = (o: THREE.Object3D) => {
    if (o.userData.dynamic) return
    if (
      o instanceof THREE.Mesh &&
      !(o instanceof THREE.InstancedMesh) &&
      !Array.isArray(o.material) &&
      !o.userData.hit
    ) {
      const mat = o.material as THREE.Material
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
      g.applyMatrix4(o.matrixWorld)
      const names = Object.keys(g.attributes).sort()
      for (const n of names)
        if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n)
      g = g.index ? g.toNonIndexed() : g
      const key = mat.uuid + ':' + Object.keys(g.attributes).sort().join(',')
      let entry = groups.get(key)
      if (!entry) groups.set(key, (entry = { mat, geos: [], meshes: [] }))
      entry.geos.push(g)
      entry.meshes.push(o)
    }
    for (const c of o.children) visit(c)
  }
  visit(scene)
  for (const { mat, geos, meshes } of groups.values()) {
    if (meshes.length < 2) continue
    const merged = mergeGeometries(geos, false)
    if (!merged) continue
    merged.computeBoundingSphere()
    for (const m of meshes) m.removeFromParent()
    scene.add(new THREE.Mesh(merged, mat))
  }
}

/** Low banks of mist along the walk, as billboards in a single draw call. */
export function createMist(walk: Walk, count = 90) {
  const r = tex.rng(29)
  const pos: number[] = []
  const corner: number[] = []
  const size: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i < count; i++) {
    const s = r() * walk.length
    const p = walk.at(s)
    const c = [p[0] + (r() - 0.5) * 7, 0.15 + r() * 0.25, p[1] + (r() - 0.5) * 7]
    const w = 4 + r() * 5
    const seed = r() * 100
    for (const [cx, cy] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ]) {
      pos.push(c[0], c[1], c[2])
      corner.push(cx, cy)
      // low and flat, so it pools on the ground instead of standing up like a wall
      size.push(w, Math.min(1.3, w * 0.22), seed)
      uv.push(cx + 0.5, cy + 0.5)
    }
    const k = i * 4
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2))
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 3))
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  const uniforms = {
    uTime: { value: 0 },
    uDensity: { value: 0.06 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec2 aCorner;
      attribute vec3 aSize;
      uniform float uTime;
      attribute vec2 aUv;
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vUv = aUv;
        vec3 c = position;
        c.x += sin(uTime * 0.05 + aSize.z) * 2.0 + sin(uTime * 0.11 + aSize.z * 3.0) * 0.6;
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        mv.xy += aCorner * aSize.xy;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDensity;
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vec2 q = vUv - 0.5;
        float a = pow(max(0.0, 1.0 - length(q) * 2.0), 1.6) * 0.016;
        // fade into the fog with distance, and away when it's right in your face
        float fog = 1.0 - exp(-pow(uDensity * vDepth, 2.0));
        a *= (1.0 - fog) * smoothstep(1.5, 6.0, vDepth);
        gl_FragColor = vec4(vec3(0.55, 0.59, 0.64), a);
      }`,
  })
  const mesh = new THREE.Mesh(g, mat)
  mesh.frustumCulled = false
  mesh.userData.dynamic = true
  return { mesh, uniforms }
}

export function rightOf(a: V2, b: V2): [number, number] {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l = Math.hypot(dx, dz) || 1
  return [-dz / l, dx / l]
}

export function near2(walk: Walk, x: number, z: number, d: number) {
  const p = walk.at(walk.project([x, z]))
  return Math.hypot(x - p[0], z - p[1]) < d
}

export function mergeGeos(geos: THREE.BufferGeometry[]) {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let off = 0
  for (const g of geos) {
    const ng = g.index ? g : g
    const p = ng.attributes.position
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(0, 1, 0) // grass is lit from above, whichever way the blade faces
      uv.push(ng.attributes.uv.getX(i), ng.attributes.uv.getY(i))
    }
    const index = ng.index!
    for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + off)
    off += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  out.setIndex(idx)
  return out
}

export type Mats = Record<
  | 'grass'
  | 'trail'
  | 'hedge'
  | 'stone'
  | 'darkStone'
  | 'marble'
  | 'wood'
  | 'bark'
  | 'iron'
  | 'statue'
  | 'glow'
  | 'flame'
  | 'lanternGlass'
  | 'void'
  | 'cypress',
  THREE.Material
>

/** A voxel statue standing at (x, z), its base at `y`, on an optional plinth. */
export function statue(
  parent: THREE.Object3D,
  M: Mats,
  name: SpriteName,
  x: number,
  z: number,
  size: number,
  y = 0,
  plinth?: THREE.Material,
  ry = 0,
) {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  g.rotation.y = ry
  const { stone, glow } = voxelGeometry(name, size)
  g.add(new THREE.Mesh(stone, M.statue))
  if (glow) g.add(new THREE.Mesh(glow, M.glow))
  if (plinth) {
    const box = new THREE.Box3().setFromBufferAttribute(
      stone.attributes.position as THREE.BufferAttribute,
    )
    const w = Math.max(0.5, (box.max.x - box.min.x) * 0.75)
    block(g, plinth, w, y, Math.max(0.5, (box.max.z - box.min.z) * 1.4), 0, -y, 0, 0, 1)
  }
  parent.add(g)
  return g
}

export function lamp(
  parent: THREE.Object3D,
  M: Mats,
  x: number,
  z: number,
  lamps: THREE.Vector3[],
  flames: THREE.Object3D[],
) {
  block(parent, M.iron, 0.09, 2.5, 0.09, x, 0, z)
  block(parent, M.iron, 0.24, 0.12, 0.24, x, 0, z)
  const head = new THREE.Group()
  head.position.set(x, 2.5, z)
  parent.add(head)
  block(head, M.iron, 0.34, 0.05, 0.34, 0, 0, 0)
  block(head, M.lanternGlass, 0.22, 0.3, 0.22, 0, 0.05, 0)
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    block(head, M.iron, 0.03, 0.32, 0.03, dx * 0.12, 0.05, dz * 0.12)
  const cap = mesh(
    head,
    new THREE.ConeGeometry(0.25, 0.22, 4),
    M.iron,
    0,
    0.47,
    0,
    Math.PI / 4,
  )
  cap.rotation.y = Math.PI / 4
  const f = mesh(head, new THREE.BoxGeometry(0.06, 0.12, 0.06), M.flame, 0, 0.17, 0)
  flames.push(f)
  lamps.push(new THREE.Vector3(x, 2.6, z))
}

export function buildGate(
  scene: THREE.Scene,
  M: Mats,
  lamps: THREE.Vector3[],
  flames: THREE.Object3D[],
) {
  const Z = GATE_Z
  const HALF = 1.65
  // stone pillars with urns on top and lanterns on brackets
  for (const s of [-1, 1]) {
    const x = s * (HALF + 0.45)
    block(scene, M.stone, 0.9, 3.0, 0.9, x, 0, Z, 0, 1.5)
    block(scene, M.darkStone, 1.1, 0.18, 1.1, x, 3.0, Z, 0, 1)
    block(scene, M.darkStone, 0.7, 0.14, 0.7, x, 3.18, Z, 0, 1)
    statue(scene, M, 'urn', x, Z, 0.07, 3.32)
    // lantern on an iron bracket, facing the road
    block(scene, M.iron, 0.06, 0.06, 0.45, x, 2.35, Z + 0.65)
    const lx = x
    const lz = Z + 0.85
    block(scene, M.iron, 0.26, 0.04, 0.26, lx, 2.05, lz)
    block(scene, M.lanternGlass, 0.18, 0.26, 0.18, lx, 2.09, lz)
    block(scene, M.iron, 0.3, 0.05, 0.3, lx, 2.35, lz)
    const f = mesh(scene, new THREE.BoxGeometry(0.05, 0.1, 0.05), M.flame, lx, 2.22, lz)
    flames.push(f)
    lamps.push(new THREE.Vector3(lx, 2.2, lz + 0.2))
  }

  // the two leaves of the gate, hinged at the pillars, opening inwards
  const leaf = (s: number) => {
    const g = new THREE.Group()
    g.position.set(s * HALF, 0, Z)
    const L = HALF
    const dir = -s // towards the centre
    const top = (x: number) => 2.15 + 0.55 * Math.pow(x / L, 1.6)
    // frame
    block(g, M.iron, 0.07, top(0.05) + 0.05, 0.07, dir * 0.04, 0.05, 0)
    block(g, M.iron, 0.07, top(L) - 0.1, 0.07, dir * (L - 0.04), 0.05, 0)
    for (const y of [0.18, 1.05, 1.95])
      block(g, M.iron, L, 0.06, 0.06, (dir * L) / 2, y, 0)
    // bars with spear tips
    for (let x = 0.14; x < L - 0.05; x += 0.13) {
      const h = top(x)
      block(g, M.iron, 0.035, h - 0.1, 0.035, dir * x, 0.1, 0)
      mesh(
        g,
        new THREE.ConeGeometry(0.05, 0.16, 4),
        M.iron,
        dir * x,
        h + 0.05,
        0,
        Math.PI / 4,
      )
    }
    // scrollwork between the upper rails
    for (let x = 0.35; x < L - 0.2; x += 0.42) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 4, 10), M.iron)
      t.position.set(dir * x, 1.5, 0)
      g.add(t)
      const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 4, 8), M.iron)
      t2.position.set(dir * (x + 0.2), 1.27, 0)
      g.add(t2)
    }
    // dog bars and the lock plate where the leaves meet
    for (let x = 0.08; x < L; x += 0.07)
      block(g, M.iron, 0.02, 0.32, 0.02, dir * x, 0.0, 0)
    block(g, M.iron, 0.12, 0.3, 0.08, dir * (L - 0.07), 0.95, 0)
    scene.add(g)
    return g
  }
  // the arch over the gate with a cross at its peak
  const arch = new THREE.Group()
  arch.position.set(0, 0, Z)
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const x = -HALF - 0.2 + t * (HALF + 0.2) * 2
    const y = 3.35 + Math.sin(t * Math.PI) * 0.75
    block(arch, M.iron, 0.16, 0.05, 0.05, x, y, 0)
    block(arch, M.iron, 0.16, 0.05, 0.05, x, y - 0.32, 0)
    if (i % 3 === 0 && i > 0 && i < 24)
      block(arch, M.iron, 0.03, 0.3, 0.03, x, y - 0.3, 0)
  }
  block(arch, M.iron, 0.07, 0.6, 0.07, 0, 4.1, 0)
  block(arch, M.iron, 0.32, 0.07, 0.07, 0, 4.45, 0)
  scene.add(arch)

  return { left: leaf(-1), right: leaf(1) }
}

export function grave(
  scene: THREE.Scene,
  M: Mats,
  x: number,
  z: number,
  r: () => number,
  epitaph: THREE.Material,
) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.4
  g.rotation.z = (r() - 0.5) * 0.14
  g.rotation.x = (r() - 0.5) * 0.12
  const kind = r()
  const mat = r() < 0.5 ? M.stone : M.marble
  if (kind < 0.45) {
    // rounded headstone
    const w = 0.55 + r() * 0.25
    const h = 0.7 + r() * 0.5
    const s = new THREE.Shape()
    s.moveTo(-w / 2, 0)
    s.lineTo(w / 2, 0)
    s.lineTo(w / 2, h - w / 2)
    s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false)
    s.closePath()
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.14,
      bevelEnabled: false,
      curveSegments: 4,
    })
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.2, uv.getY(i) * 1.2)
    geo.translate(0, 0, -0.07)
    g.add(new THREE.Mesh(geo, mat))
    if (r() < 0.5) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.4), epitaph)
      p.position.set(0, h * 0.55, 0.075)
      g.add(p)
    }
  } else if (kind < 0.75) {
    // a cross
    const h = 1.0 + r() * 0.6
    block(g, mat, 0.12, h, 0.12, 0, 0, 0, 0, 1)
    block(g, mat, 0.55, 0.12, 0.12, 0, h * 0.68, 0, 0, 1)
    block(g, M.stone, 0.4, 0.2, 0.3, 0, 0, 0, 0, 1)
  } else if (kind < 0.88) {
    // an obelisk
    const h = 1.6 + r() * 1.2
    block(g, M.stone, 0.6, 0.35, 0.6, 0, 0, 0, 0, 1)
    block(g, mat, 0.32, h, 0.32, 0, 0.35, 0, 0, 1)
    mesh(
      g,
      new THREE.ConeGeometry(0.24, 0.35, 4),
      mat,
      0,
      0.35 + h + 0.17,
      0,
      Math.PI / 4,
    )
  } else {
    // a sunken slab with a small headstone
    block(g, M.darkStone, 0.9, 0.12, 1.8, 0, 0, 0.9, 0, 1)
    block(g, mat, 0.6, 0.6, 0.12, 0, 0, 0, 0, 1)
  }
  scene.add(g)
}

export function cypress(scene: THREE.Scene, M: Mats, x: number, z: number, h: number) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  block(g, M.bark, 0.25, 1, 0.25, 0, 0, 0)
  const body = new THREE.Mesh(new THREE.ConeGeometry(h * 0.16, h, 6, 3), M.cypress)
  body.position.y = 0.8 + h / 2
  g.add(body)
  const r2 = new THREE.Mesh(new THREE.ConeGeometry(h * 0.19, h * 0.55, 6, 2), M.cypress)
  r2.position.y = 0.8 + h * 0.3
  r2.rotation.y = 0.5
  g.add(r2)
  scene.add(g)
}

export function deadTree(
  scene: THREE.Scene,
  M: Mats,
  x: number,
  z: number,
  r: () => number,
) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const branch = (parent: THREE.Object3D, len: number, rad: number, depth: number) => {
    const geo = new THREE.CylinderGeometry(rad * 0.65, rad, len, 4)
    geo.translate(0, len / 2, 0)
    const m = new THREE.Mesh(geo, M.bark)
    parent.add(m)
    if (depth <= 0) return m
    const n = 2 + Math.floor(r() * 2)
    for (let i = 0; i < n; i++) {
      const c = branch(m, len * (0.55 + r() * 0.2), rad * 0.6, depth - 1)
      c.position.y = len * (0.6 + r() * 0.4)
      c.rotation.z = (r() - 0.5) * 1.6
      c.rotation.y = r() * Math.PI * 2
    }
    return m
  }
  branch(g, 2.6 + r() * 1.5, 0.22, 3)
  g.rotation.y = r() * 6
  scene.add(g)
}

/** The cathedral, far off: a black mass against the storm with lit windows. */
export function cathedral(
  scene: THREE.Scene,
  glassMat: (fog?: boolean) => THREE.MeshBasicMaterial,
) {
  const g = new THREE.Group()
  g.position.set(-4, -2, -118)
  scene.add(g)
  const body = basic({ color: 0x0c0d11, fog: false })
  const dark = basic({ color: 0x08090c, fog: false })
  const window = glassMat(false)
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m = body,
  ) => mesh(g, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z)
  // nave and its roof
  box(18, 26, 50, 0, 0, -25)
  const roof = new THREE.Shape()
  roof.moveTo(-9.5, 0)
  roof.lineTo(9.5, 0)
  roof.lineTo(0, 11)
  roof.closePath()
  const rg = new THREE.ExtrudeGeometry(roof, { depth: 50, bevelEnabled: false })
  rg.translate(0, 26, -50)
  mesh(g, rg, dark)
  // aisles and buttresses
  box(30, 14, 46, 0, 0, -27, dark)
  for (let i = 0; i < 6; i++)
    for (const s of [-1, 1]) {
      box(1.6, 20, 3, s * 15.5, 0, -8 - i * 7.5)
      mesh(
        g,
        new THREE.ConeGeometry(1.2, 6, 4),
        dark,
        s * 15.5,
        23,
        -8 - i * 7.5,
        Math.PI / 4,
      )
    }
  // twin towers with spires
  for (const s of [-1, 1]) {
    box(9, 46, 9, s * 11, 0, 0)
    mesh(g, new THREE.ConeGeometry(6.6, 30, 4), dark, s * 11, 46 + 15, 0, Math.PI / 4)
    for (const c of [-1, 1])
      mesh(
        g,
        new THREE.ConeGeometry(0.9, 6, 4),
        dark,
        s * 11 + c * 4.2,
        49,
        4.2,
        Math.PI / 4,
      )
    // tall lancet windows in the towers
    for (const y of [12, 28])
      mesh(g, new THREE.PlaneGeometry(2.2, 9), window, s * 11, y + 4.5, 4.55)
  }
  // rose window and the great door
  const rose = new THREE.Mesh(new THREE.CircleGeometry(4.2, 16), window)
  rose.position.set(0, 30, 0.05)
  g.add(rose)
  mesh(g, new THREE.PlaneGeometry(4, 9), window, 0, 6.5, 0.05)
  // side windows down the nave
  for (let i = 0; i < 6; i++)
    for (const s of [-1, 1])
      mesh(
        g,
        new THREE.PlaneGeometry(2, 6),
        window,
        s * 9.05,
        18,
        -10 - i * 7.5,
        (s * Math.PI) / 2,
      )
}
