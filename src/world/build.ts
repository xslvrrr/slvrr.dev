import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { links } from '@/content/links'
import { basic, lambert } from './materials'
import { buildWalk, yawTo, type Walk } from './path'
import type { SpriteName } from './sprites'
import { GATE_Z, PATH, stations, type V2 } from './stations'
import * as tex from './textures'
import { voxelGeometry } from './voxel'

/**
 * Builds the churchyard: ground and the worn trail, clipped hedges lining the
 * walk (the walls you see converging ahead of you), the iron garden gate,
 * and one landmark per station: signpost, fountain, mausoleum, shrine,
 * graves, calvary, with the cathedral looming over everything.
 */
export interface World {
  scene: THREE.Scene
  walk: Walk
  /** Invisible boxes that catch clicks on each station's point of interest. */
  hits: THREE.Mesh[]
  gate: { left: THREE.Object3D; right: THREE.Object3D }
  /** Textures whose offset scrolls (falling water). */
  flowing: THREE.Texture[]
  /** Flames to flicker. */
  flames: THREE.Object3D[]
  /** Where lamps and candles are, for the pool of real point lights. */
  lamps: THREE.Vector3[]
  /** Drifting ground mist. */
  mist: ReturnType<typeof createMist>
  /** Materials that follow the blood moon. */
  glassMats: THREE.MeshBasicMaterial[]
  /** What blocks your line of sight to a point of interest (the hedges). */
  occluders: THREE.Object3D[]
}

type Mat = THREE.Material

/** A box whose UVs tile its texture every `tile` metres on every face. */
function boxGeo(w: number, h: number, d: number, tile = 1) {
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
function tile<T extends THREE.BufferGeometry>(geo: T, u: number, v: number): T {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v)
  return geo
}

function mesh(
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
function block(
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

export function buildWorld(): World {
  const scene = new THREE.Scene()
  const walk = buildWalk()
  const flowing: THREE.Texture[] = []
  const flames: THREE.Object3D[] = []
  const lamps: THREE.Vector3[] = []
  const glassMats: THREE.MeshBasicMaterial[] = []
  const occluders: THREE.Object3D[] = []
  const rand = tex.rng(7)

  // ---- materials ----
  const grassTex = tex.grass()
  const M = {
    grass: lambert({ map: grassTex }),
    trail: lambert({ map: tex.trail() }),
    hedge: lambert({ map: tex.hedge() }),
    stone: lambert({ map: tex.stone() }),
    darkStone: lambert({ map: tex.stone(53, '#2f2f2c') }),
    marble: lambert({ map: tex.marble() }),
    wood: lambert({ map: tex.wood() }),
    bark: lambert({ map: tex.bark() }),
    iron: lambert({ color: 0x101013 }),
    statue: lambert({ vertexColors: true }),
    glow: basic({ vertexColors: true }),
    flame: basic({ color: 0xffd9a0 }),
    lanternGlass: basic({ color: 0xe0a860 }),
    void: basic({ color: 0x020203 }),
    cypress: lambert({ map: tex.hedge(), color: 0x9aa59a }),
  }
  const glassTex = tex.glass()
  const glassMat = (fog = true) => {
    const m = basic({ map: glassTex, color: 0xb59a78, fog })
    glassMats.push(m)
    return m
  }

  // ---- ground ----
  const groundGeo = new THREE.PlaneGeometry(260, 260)
  groundGeo.rotateX(-Math.PI / 2)
  const guv = groundGeo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 65, guv.getY(i) * 65)
  mesh(scene, groundGeo, M.grass, 8, 0, -30)

  // ---- the trail ----
  {
    const pts: [number, number][] = [[0, 22], [0, 16], ...walk.points]
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    let s = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(pts.length - 1, i + 1)]
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const l = Math.hypot(dx, dz) || 1
      const rx = -dz / l
      const rz = dx / l
      if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
      const half = 1.0
      pos.push(pts[i][0] - rx * half, 0.012, pts[i][1] - rz * half)
      pos.push(pts[i][0] + rx * half, 0.012, pts[i][1] + rz * half)
      uv.push(s / 4, 0, s / 4, 1)
      if (i > 0) {
        const k = i * 2
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    mesh(scene, g, M.trail)
  }

  // ---- hedges ----
  const hedgeBlocks: { x: number; z: number; ry: number; h: number; len: number }[] = []
  const gaps: { x: number; z: number; r: number }[] = [
    { x: 11, z: -20.4, r: 3.3 }, // fountain clearing
    { x: 22.4, z: -30, r: 3.1 }, // mausoleum
    { x: 9, z: -42.4, r: 2.3 }, // shrine
    { x: -6.4, z: -52, r: 4.4 }, // graves
  ]
  const inGap = (x: number, z: number) =>
    gaps.some((g) => Math.hypot(x - g.x, z - g.z) < g.r)
  const run = (ax: number, az: number, bx: number, bz: number, gapsOn = true) => {
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(len / 0.95))
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      if (gapsOn && inGap(x, z)) continue
      hedgeBlocks.push({
        x,
        z,
        ry: Math.atan2(bx - ax, bz - az) + Math.PI / 2,
        h: 2.2 + rand() * 0.35,
        len: (len / n) * 1.12,
      })
    }
  }
  // Hedges either side of the walk, from just inside the wall to before the calvary.
  {
    const line: V2[] = [[0, GATE_Z - 0.6], ...PATH.slice(1, -1), [-4, -59]]
    for (const side of [-1, 1]) {
      const off: V2[] = line.map((p, i) => {
        const a = line[Math.max(0, i - 1)]
        const b = line[Math.min(line.length - 1, i + 1)]
        // miter: average of the neighbouring segments' right-hand normals
        const n1 = i > 0 ? rightOf(a, p) : rightOf(p, b)
        const n2 = i < line.length - 1 ? rightOf(p, b) : rightOf(a, p)
        let nx = n1[0] + n2[0]
        let nz = n1[1] + n2[1]
        const nl = Math.hypot(nx, nz)
        nx /= nl
        nz /= nl
        const cos = nx * n1[0] + nz * n1[1]
        const d = (2.4 * side) / cos
        return [p[0] + nx * d, p[1] + nz * d]
      })
      for (let i = 1; i < off.length; i++)
        run(off[i - 1][0], off[i - 1][1], off[i][0], off[i][1])
    }
  }
  // Fountain clearing: a ring of hedge open towards the walk.
  ring(11, -24.5, 5.3, (a) => Math.sin(a) > 0.74)
  // Mausoleum yard, shrine alcove, graveyard: hedged on three sides.
  run(22.4, -36, 34, -36, false)
  run(34, -36, 34, -24, false)
  run(34, -24, 22.4, -24, false)
  run(6.4, -42.4, 6.4, -48.5, false)
  run(6.4, -48.5, 11.6, -48.5, false)
  run(11.6, -48.5, 11.6, -42.4, false)
  run(-6.4, -44, -21, -44, false)
  run(-21, -44, -21, -60, false)
  run(-21, -60, -6.4, -60, false)

  function ring(cx: number, cz: number, r: number, open: (a: number) => boolean) {
    const n = Math.round((Math.PI * 2 * r) / 0.95)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      if (open(a)) continue
      hedgeBlocks.push({
        x: cx + Math.cos(a) * r,
        z: cz + Math.sin(a) * r,
        ry: -a - Math.PI / 2,
        h: 2.2 + rand() * 0.35,
        len: ((Math.PI * 2 * r) / n) * 1.15,
      })
    }
  }
  {
    // UVs laid out for a typical 1 × 2.3 × 0.95 m block, then scaled to a unit
    // cube, so the leaves aren't stretched once each instance is sized.
    const geo = boxGeo(1, 2.3, 0.95, 1)
    geo.scale(1, 1 / 2.3, 1 / 0.95)
    geo.translate(0, 0.5, 0)
    const inst = new THREE.InstancedMesh(geo, M.hedge, hedgeBlocks.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    hedgeBlocks.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry)
      m.compose(
        new THREE.Vector3(b.x, 0, b.z),
        q,
        new THREE.Vector3(b.len, b.h, 0.95 + rand() * 0.12),
      )
      inst.setMatrixAt(i, m)
    })
    inst.computeBoundingSphere()
    scene.add(inst)
    occluders.push(inst)
  }

  // ---- the wall and the iron gate ----
  const gate = buildGate(scene, M, lamps, flames)
  {
    // low stone wall with railings, either side of the gate
    for (const side of [-1, 1]) {
      block(scene, M.stone, 42, 0.7, 0.55, side * (2.6 + 21), 0, GATE_Z, 0, 2)
      block(scene, M.stone, 42, 0.12, 0.7, side * (2.6 + 21), 0.7, GATE_Z, 0, 2)
    }
    const bars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.035, 1.5, 0.035),
      M.iron,
      600,
    )
    const tips = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.045, 0.16, 4),
      M.iron,
      600,
    )
    const m = new THREE.Matrix4()
    let k = 0
    for (const side of [-1, 1])
      for (let x = 2.75; x < 44 && k < 600; x += 0.16, k++) {
        m.makeTranslation(side * x, 0.82 + 0.75, GATE_Z)
        bars.setMatrixAt(k, m)
        m.makeTranslation(side * x, 0.82 + 1.5 + 0.06, GATE_Z)
        tips.setMatrixAt(k, m)
      }
    bars.count = tips.count = k
    scene.add(bars, tips)
    for (const side of [-1, 1])
      for (const y of [0.95, 2.15])
        block(scene, M.iron, 41.5, 0.05, 0.05, side * (2.6 + 20.8), y, GATE_Z)
  }

  // ---- lamps along the walk ----
  for (const [x, z] of [
    [1.35, -3],
    [-1.4, -14.5],
    [6, -16.65],
    [18.65, -22],
    [21.35, -36.5],
    [14, -38.65],
    [-2.65, -44],
    [-2.65, -58],
  ] as V2[])
    lamp(scene, M, x, z, lamps, flames)

  // ---- the signpost: where to find me ----
  buildSignpost(scene, M, lamps, flames)
  // a herald angel at the first bend
  statue(scene, M, 'herald', -0.9, -21.0, 0.06, 0.4, M.marble)

  // ---- the fountain ----
  {
    const g = new THREE.Group()
    g.position.set(11, 0, -24.5)
    scene.add(g)
    // flagstones around it
    const flag = new THREE.CircleGeometry(5.3, 18)
    flag.rotateX(-Math.PI / 2)
    const fuv = flag.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 5, fuv.getY(i) * 5)
    mesh(g, flag, M.darkStone, 0, 0.014, 0)
    mesh(
      g,
      tile(new THREE.CylinderGeometry(2.7, 2.9, 0.65, 12), 8.5, 0.35),
      M.stone,
      0,
      0.325,
      0,
    )
    // the rim's inner wall, so the pool reads as sunk into the basin
    const inner = tile(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 12, 1, true), 8, 0.2)
    mesh(g, inner, M.darkStone, 0, 0.5, 0).material = lambert({
      map: (M.darkStone as THREE.MeshLambertMaterial).map,
      side: THREE.BackSide,
    })
    const pool = water(2.5)
    mesh(g, new THREE.CircleGeometry(2.5, 12).rotateX(-Math.PI / 2), pool, 0, 0.45, 0)
    mesh(
      g,
      tile(new THREE.CylinderGeometry(0.32, 0.45, 1.3, 8), 1.2, 0.65),
      M.stone,
      0,
      0.65 + 0.4,
      0,
    )
    mesh(
      g,
      tile(new THREE.CylinderGeometry(1.0, 0.45, 0.3, 10), 3, 0.2),
      M.stone,
      0,
      1.6,
      0,
    )
    mesh(
      g,
      new THREE.CircleGeometry(0.92, 10).rotateX(-Math.PI / 2),
      water(1),
      0,
      1.74,
      0,
    )
    mesh(g, new THREE.CylinderGeometry(0.14, 0.2, 0.5, 6), M.stone, 0, 1.95, 0)
    // falling curtain of water from the bowl into the pool
    const fall = water(1, true)
    const curtain = new THREE.CylinderGeometry(0.98, 1.3, 1.1, 14, 1, true)
    mesh(g, curtain, fall, 0, 1.15, 0)
    statue(g, M, 'cherub', 0, 0, 0.055, 2.18, undefined, Math.PI * 0.08)
    // stone benches facing it
    for (const a of [Math.PI * 0.85, Math.PI * 0.15 + Math.PI]) {
      const bx = Math.cos(a) * 4.3
      const bz = Math.sin(a) * 4.3
      block(g, M.stone, 1.8, 0.45, 0.5, bx, 0, bz, -a + Math.PI / 2, 1)
      block(g, M.stone, 1.9, 0.08, 0.6, bx, 0.45, bz, -a + Math.PI / 2, 1)
    }
  }

  // ---- the mausoleum: where the relics are kept ----
  buildMausoleum(scene, M, lamps, flames, glassMat)

  // ---- the wayside shrine ----
  {
    const g = new THREE.Group()
    g.position.set(9, 0, -45.6)
    scene.add(g)
    block(g, M.stone, 2.0, 0.85, 1.1, 0, 0, 0, 0, 1)
    block(g, M.stone, 2.0, 2.1, 0.35, 0, 0.85, -0.45, 0, 1)
    block(g, M.stone, 0.35, 2.1, 1.0, -0.85, 0.85, -0.05, 0, 1)
    block(g, M.stone, 0.35, 2.1, 1.0, 0.85, 0.85, -0.05, 0, 1)
    // a little pitched roof
    for (const s of [-1, 1]) {
      const r = block(g, M.darkStone, 1.35, 0.14, 1.35, s * 0.55, 3.15, -0.05, 0, 1)
      r.rotation.z = -s * 0.62
    }
    mesh(g, new THREE.BoxGeometry(0.08, 0.5, 0.08), M.iron, 0, 3.75, -0.05)
    mesh(g, new THREE.BoxGeometry(0.32, 0.08, 0.08), M.iron, 0, 3.82, -0.05)
    statue(g, M, 'madonna', 0, -0.2, 0.05, 0.85)
    // candles
    for (let i = 0; i < 7; i++) {
      const x = -0.75 + i * 0.25 + (rand() - 0.5) * 0.08
      const h = 0.1 + rand() * 0.18
      block(g, M.marble, 0.06, h, 0.06, x, 0.85, 0.35 + (rand() - 0.5) * 0.15)
      const f = mesh(
        g,
        new THREE.BoxGeometry(0.035, 0.07, 0.035),
        M.flame,
        x,
        0.85 + h + 0.04,
        0.35,
      )
      flames.push(f)
    }
    lamps.push(new THREE.Vector3(9, 1.2, -44.9))
    statue(scene, M, 'monk', 10.55, -44.4, 0.055, 0.3, M.stone, -0.35)
    plaque(g, 'AVE', 0, 0.45, 0.56, 0.9, 0.3)
  }

  // ---- the old graves ----
  {
    const r = tex.rng(99)
    const epitaph = lambert({
      map: tex.lettering('R.I.P', {
        w: 32,
        h: 16,
        bg: '#6f6d66',
        fg: '#d6d3c9',
        carved: true,
        size: 12,
      }),
    })
    for (let i = 0; i < 46; i++) {
      const x = -19.5 + r() * 12
      const z = -58.5 + r() * 13
      if (Math.hypot(x + 9.5, z + 52) < 2.4) continue
      grave(scene, M, x, z, r, epitaph)
    }
    // a tomb with a weeping angel
    block(scene, M.marble, 2.2, 0.8, 1.1, -9.8, 0, -52, Math.PI / 2, 1)
    block(scene, M.marble, 2.4, 0.1, 1.3, -9.8, 0.8, -52, Math.PI / 2, 1)
    statue(scene, M, 'weeper', -9.8, -52, 0.055, 0.9, undefined, Math.PI / 2)
  }

  // ---- the calvary, and the cathedral beyond ----
  {
    const g = new THREE.Group()
    g.position.set(-4, 0, -70)
    scene.add(g)
    block(g, M.stone, 4.2, 0.35, 3.0, 0, 0, 0, 0, 1)
    block(g, M.stone, 3.0, 0.35, 2.2, 0, 0.35, 0, 0, 1)
    block(g, M.stone, 1.8, 0.35, 1.4, 0, 0.7, 0, 0, 1)
    block(g, M.darkStone, 0.38, 6.4, 0.38, 0, 1.05, 0, 0, 1)
    block(g, M.darkStone, 2.8, 0.38, 0.38, 0, 5.1, 0, 0, 1)
    plaque(g, 'INRI', 0, 5.95, 0.2, 0.6, 0.22)
    statue(g, M, 'angel', -2.6, 0.3, 0.06, 0.35, M.marble)
    statue(g, M, 'angel', 2.6, 0.3, 0.06, 0.35, M.marble)
    lamps.push(new THREE.Vector3(-4, 1.4, -68))
    // the churchyard's far wall
    block(scene, M.stone, 60, 1.6, 0.6, -4, 0, -78, 0, 2)
    cathedral(scene, glassMat)
  }

  // ---- trees: cypresses above the hedges, dead trees, a far tree line ----
  {
    const r = tex.rng(5)
    const near = (x: number, z: number, d: number) =>
      Math.hypot(
        x - walk.at(walk.project([x, z]))[0],
        z - walk.at(walk.project([x, z]))[1],
      ) < d
    const clear = (x: number, z: number) =>
      [
        [11, -24.5, 7],
        [28, -30, 6.5],
        [9, -45.5, 3.5],
        [-13, -52, 8.5],
        [-4, -70, 7],
      ].some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr) || z > GATE_Z - 1
    let placed = 0
    for (let tries = 0; tries < 900 && placed < 70; tries++) {
      const x = -26 + r() * 64
      const z = 2 - r() * 74
      if (clear(x, z) || near(x, z, 3.6)) continue
      if (r() < 0.8) cypress(scene, M, x, z, 5 + r() * 6)
      else deadTree(scene, M, x, z, r)
      placed++
    }
    // outside the wall, by the road
    for (const [x, z] of [
      [-6, 9],
      [7, 13],
      [-9, 15],
      [10, 7],
    ] as V2[])
      cypress(scene, M, x, z, 7 + rand() * 3)
    // the far tree line: flat black silhouettes against the sky
    const sil = basic({ color: 0x050607, fog: false })
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2
      const d = 95 + rand() * 25
      const h = 10 + rand() * 16
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.5 + rand() * 3, h, 5), sil)
      c.position.set(8 + Math.cos(a) * d, h / 2 - 1, -30 + Math.sin(a) * d)
      scene.add(c)
    }
  }

  // ---- grass tufts ----
  {
    const geo = new THREE.PlaneGeometry(0.6, 0.45)
    geo.translate(0, 0.225, 0)
    const cross = geo.clone().rotateY(Math.PI / 2)
    const merged = mergeGeos([geo, cross])
    const mat = lambert(
      { map: tex.tuft(), alphaTest: 0.5, side: THREE.DoubleSide },
      { sway: true },
    )
    const N = 2600
    const inst = new THREE.InstancedMesh(merged, mat, N)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const r = tex.rng(17)
    let k = 0
    while (k < N) {
      let x: number
      let z: number
      if (k < 1800) {
        // the grass verge between trail and hedge
        const s = r() * walk.length
        const p = walk.at(s)
        const h = walk.heading(s)
        const side = r() < 0.5 ? -1 : 1
        const off = 1.05 + r() * 0.85
        x = p[0] + Math.cos(h) * off * side
        z = p[1] - Math.sin(h) * off * side
      } else {
        x = -16 + r() * 52
        z = 18 - r() * 84
        if (near2(walk, x, z, 1.1)) continue
      }
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI)
      const s = 0.55 + r() * 0.9
      m.compose(
        new THREE.Vector3(x, 0, z),
        q,
        new THREE.Vector3(s, s * (0.7 + r() * 0.8), s),
      )
      inst.setMatrixAt(k++, m)
    }
    scene.add(inst)
  }

  // ---- mist: one mesh of camera-facing puffs, drifting in the shader ----
  const mist = createMist(walk)
  scene.add(mist.mesh)

  // ---- what you can click ----
  const hits: THREE.Mesh[] = []
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })
  stations.forEach((st, i) => {
    if (!st.poi) return
    const [hx, hy, hz] = st.poi.hit
    const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), hitMat)
    m.position.set(...st.poi.look)
    m.userData.station = i
    scene.add(m)
    hits.push(m)
  })

  for (const f of flames) f.userData.dynamic = true
  gate.left.userData.dynamic = gate.right.userData.dynamic = true
  mergeStatic(scene)

  return { scene, walk, hits, gate, flowing, flames, lamps, mist, glassMats, occluders }

  function water(repeat: number, falling = false) {
    const t = tex.water()
    t.repeat.set(repeat * (falling ? 3 : 1), repeat * (falling ? 0.8 : 1))
    flowing.push(t)
    t.userData.falling = falling
    return lambert({
      map: t,
      transparent: true,
      opacity: falling ? 0.55 : 0.85,
      emissive: 0x141b24,
      side: falling ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: !falling,
    })
  }

  function plaque(
    g: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ) {
    const t = tex.lettering(text, {
      w: 48,
      h: 16,
      bg: '#5b5a55',
      fg: '#cfccc2',
      carved: true,
      size: 13,
      grain: text.length,
    })
    const m = mesh(g, new THREE.PlaneGeometry(w, h), lambert({ map: t }), x, y, z)
    return m
  }
}

/**
 * Bakes every static mesh into one geometry per material, so the whole
 * churchyard draws in a few dozen calls instead of hundreds. Animated things
 * (`userData.dynamic`), instanced meshes and multi-material meshes stay as
 * they are.
 */
function mergeStatic(scene: THREE.Scene) {
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
      o.userData.station === undefined
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
function createMist(walk: Walk, count = 90) {
  const r = tex.rng(29)
  const pos: number[] = []
  const corner: number[] = []
  const size: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i < count; i++) {
    const s = r() * walk.length
    const p = walk.at(s)
    const c = [p[0] + (r() - 0.5) * 7, 0.35 + r() * 0.6, p[1] + (r() - 0.5) * 7]
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
      size.push(w, w * 0.45, seed)
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

function rightOf(a: V2, b: V2): [number, number] {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l = Math.hypot(dx, dz) || 1
  return [-dz / l, dx / l]
}

function near2(walk: Walk, x: number, z: number, d: number) {
  const p = walk.at(walk.project([x, z]))
  return Math.hypot(x - p[0], z - p[1]) < d
}

function mergeGeos(geos: THREE.BufferGeometry[]) {
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

type Mats = Record<
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
function statue(
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

function lamp(
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

function buildGate(
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

function buildSignpost(
  scene: THREE.Scene,
  M: Mats,
  lamps: THREE.Vector3[],
  flames: THREE.Object3D[],
) {
  const g = new THREE.Group()
  g.position.set(-1.25, 0, -11.2)
  // face the walker coming up the path
  g.rotation.y = yawTo(-1.25, -11.2, 0.75, -8.6) + Math.PI
  scene.add(g)
  block(g, M.wood, 0.14, 2.75, 0.14, 0, 0, 0, 0, 1)
  mesh(g, new THREE.ConeGeometry(0.13, 0.18, 4), M.wood, 0, 2.84, 0, Math.PI / 4)

  const head = tex.lettering('FIND ME', {
    w: 64,
    h: 16,
    bg: '#2a221a',
    fg: '#e3dac4',
    size: 15,
  })
  const headMat = lambert({ map: head })
  const headBoard = mesh(
    g,
    new THREE.BoxGeometry(1.1, 0.3, 0.05),
    [M.wood, M.wood, M.wood, M.wood, headMat, headMat],
    0,
    2.45,
    0.09,
  )
  headBoard.rotation.z = 0.02

  // one arrow per link, pointing every which way
  const r = tex.rng(3)
  links.forEach((l, i) => {
    const right = i % 2 === 0
    const t = tex.lettering(l.label.toLowerCase(), {
      w: 64,
      h: 16,
      bg: i % 3 ? '#3b2f22' : '#33291f',
      fg: '#d9d0ba',
      size: 13,
      grain: i + 5,
    })
    const face = lambert({ map: t })
    const shape = new THREE.Shape()
    const L = 0.82
    const H = 0.16
    shape.moveTo(0, -H / 2)
    shape.lineTo(L - 0.12, -H / 2)
    shape.lineTo(L, 0)
    shape.lineTo(L - 0.12, H / 2)
    shape.lineTo(0, H / 2)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
    // map the face's UVs to the lettering texture
    const uv = geo.attributes.uv as THREE.BufferAttribute
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++)
      uv.setXY(k, pos.getX(k) / L, (pos.getY(k) + H / 2) / H)
    const arrow = new THREE.Mesh(geo, [face, M.wood])
    const y = 2.12 - i * 0.24
    arrow.position.set(right ? 0.02 : -0.02, y, 0.075)
    arrow.scale.x = right ? 1 : -1
    if (!right) {
      // mirrored, so flip the text back the right way round
      const flipped = t.clone()
      flipped.repeat.x = -1
      flipped.offset.x = 1
      flipped.wrapS = THREE.RepeatWrapping
      flipped.needsUpdate = true
      arrow.material = [lambert({ map: flipped }), M.wood]
    }
    arrow.rotation.z = (r() - 0.5) * 0.08
    arrow.rotation.y = (r() - 0.5) * 0.25
    g.add(arrow)
  })

  // a lantern hung from the post so you can read it
  block(g, M.iron, 0.4, 0.04, 0.04, 0.2, 2.62, 0)
  block(g, M.iron, 0.2, 0.03, 0.2, 0.4, 2.3, 0)
  block(g, M.lanternGlass, 0.14, 0.2, 0.14, 0.4, 2.33, 0)
  const f = mesh(g, new THREE.BoxGeometry(0.04, 0.08, 0.04), M.flame, 0.4, 2.42, 0)
  flames.push(f)
  g.updateMatrixWorld()
  lamps.push(new THREE.Vector3(0.4, 2.3, 0.4).applyMatrix4(g.matrixWorld))
}

function buildMausoleum(
  scene: THREE.Scene,
  M: Mats,
  lamps: THREE.Vector3[],
  flames: THREE.Object3D[],
  glassMat: () => THREE.MeshBasicMaterial,
) {
  const g = new THREE.Group()
  g.position.set(28, 0, -30)
  // its front faces the walk (-x)
  g.rotation.y = -Math.PI / 2
  scene.add(g)
  // local: front towards +z, width along x
  block(g, M.stone, 5.2, 0.5, 6.8, 0, 0, -0.4, 0, 2)
  block(g, M.stone, 4.6, 3.9, 5.2, 0, 0.5, -1.2, 0, 2)
  // portico columns and steps
  for (const x of [-1.95, -0.95, 0.95, 1.95]) {
    mesh(
      g,
      tile(new THREE.CylinderGeometry(0.2, 0.24, 3.5, 8), 1.4, 3.5),
      M.marble,
      x,
      0.5 + 1.75,
      2.3,
    )
    block(g, M.stone, 0.55, 0.2, 0.55, x, 0.5, 2.3, 0, 1)
    block(g, M.stone, 0.55, 0.2, 0.55, x, 3.8, 2.3, 0, 1)
  }
  for (let i = 0; i < 3; i++)
    block(g, M.stone, 4.8, 0.17, 0.45, 0, 0.5 - (i + 1) * 0.17, 2.85 + i * 0.4, 0, 1)
  block(g, M.darkStone, 5.0, 0.35, 6.3, 0, 4.0, -0.35, 0, 2)
  // pediment: a triangular prism over the front
  const tri = new THREE.Shape()
  tri.moveTo(-2.6, 0)
  tri.lineTo(2.6, 0)
  tri.lineTo(0, 1.25)
  tri.closePath()
  const ped = new THREE.ExtrudeGeometry(tri, { depth: 6.3, bevelEnabled: false })
  ped.translate(0, 0, -3.5)
  mesh(g, ped, M.darkStone, 0, 4.35, 0)
  statue(g, M, 'angel', 0, 2.6, 0.04, 5.6)
  // the doorway: darkness, iron bars, a candle somewhere inside
  block(g, M.void, 1.5, 2.6, 0.1, 0, 0.5, 1.42)
  for (let x = -0.68; x <= 0.7; x += 0.17) block(g, M.iron, 0.04, 2.55, 0.04, x, 0.5, 1.5)
  for (const y of [1.0, 2.0, 2.9]) block(g, M.iron, 1.5, 0.05, 0.05, 0, y, 1.5)
  block(g, M.flame, 0.05, 0.08, 0.05, 0.3, 1.1, 0.9)
  // stained glass up in the side walls
  for (const s of [-1, 1]) {
    const w = mesh(
      g,
      new THREE.PlaneGeometry(0.5, 1.2),
      glassMat(),
      s * 2.31,
      2.6,
      -1.2,
      (s * Math.PI) / 2,
    )
    w.rotation.y = (s * Math.PI) / 2
  }
  const t = tex.lettering('RELIQVIAE', {
    w: 64,
    h: 12,
    bg: '#55544f',
    fg: '#cfccc2',
    carved: true,
    size: 11,
  })
  mesh(g, new THREE.PlaneGeometry(2.6, 0.48), lambert({ map: t }), 0, 3.55, 1.42)
  // praying angels either side of the steps, and a lantern by the door
  statue(g, M, 'angel', -2.9, 3.7, 0.045, 0.7, M.stone)
  statue(g, M, 'angel', 2.9, 3.7, 0.045, 0.7, M.stone)
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), M.flame)
  f.position.set(1.15, 2.2, 1.65)
  g.add(f)
  block(g, M.lanternGlass, 0.16, 0.24, 0.16, 1.15, 2.08, 1.65)
  block(g, M.iron, 0.24, 0.05, 0.24, 1.15, 2.34, 1.65)
  flames.push(f)
  g.updateMatrixWorld()
  lamps.push(new THREE.Vector3(1.15, 2.2, 2.2).applyMatrix4(g.matrixWorld))
}

function grave(
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

function cypress(scene: THREE.Scene, M: Mats, x: number, z: number, h: number) {
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

function deadTree(scene: THREE.Scene, M: Mats, x: number, z: number, r: () => number) {
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
function cathedral(
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
