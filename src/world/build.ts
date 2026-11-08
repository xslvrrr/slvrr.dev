import * as THREE from 'three'
import { links } from '@/content/links'
import { media } from '@/content/media'
import { notes } from '@/content/notes'
import { profile } from '@/content/profile'
import { projects } from '@/content/projects'
import { timeline } from '@/content/timeline'
import { coverPath } from '@/lib/covers'
import { Cell, CELL, type Grid } from './grid'
import {
  buildGrid,
  CALVARY,
  FOUNTAIN,
  GATE_Z,
  MAUSOLEUM,
  MONITOR,
  PATH,
  SHRINE,
  SIGN,
  signposts,
  type V2,
} from './layout'
import { basic, lambert } from './materials'
import {
  block,
  boxGeo,
  buildGate,
  cathedral,
  createMist,
  cypress,
  deadTree,
  grave,
  lamp,
  mergeGeos,
  mergeStatic,
  mesh,
  statue,
  tile,
  type Mats,
} from './parts'
import { buildWalk, yawTo, type Walk } from './path'
import { createScreens, type Screens } from './screens'
import * as tex from './textures'

/**
 * Builds the churchyard on the floor plan from layout.ts: hedges grown along
 * every open edge, the trail, the gate, signposts at the junctions, and each
 * section as things you can walk up to and use.
 */

/** What you can aim at and use (each has an invisible hit box). */
export type Kind =
  | 'link'
  | 'discord'
  | 'album'
  | 'nowplaying'
  | 'walkman'
  | 'fountain'
  | 'project'
  | 'sticky'
  | 'note'

export interface World {
  scene: THREE.Scene
  walk: Walk
  grid: Grid
  hits: THREE.Mesh[]
  gate: { left: THREE.Object3D; right: THREE.Object3D }
  flowing: THREE.Texture[]
  flames: THREE.Object3D[]
  lamps: THREE.Vector3[]
  mist: ReturnType<typeof createMist>
  glassMats: THREE.MeshBasicMaterial[]
  screens: Screens
  /** Things that hover and sway (the monitor that shouldn't be there). */
  floaters: { obj: THREE.Object3D; y: number; yaw: number }[]
  /** The walkman, until you pick it up. */
  walkman: THREE.Group
  /** Things that make you say something the first time you see them. */
  sights: { line: 'discord' | 'nowPlaying' | 'walkman'; at: THREE.Vector3 }[]
}

export function buildWorld(): World {
  const scene = new THREE.Scene()
  const grid = buildGrid()
  const walk = buildWalk(PATH)
  const flowing: THREE.Texture[] = []
  const flames: THREE.Object3D[] = []
  const lamps: THREE.Vector3[] = []
  const glassMats: THREE.MeshBasicMaterial[] = []
  const hits: THREE.Mesh[] = []
  const floaters: World['floaters'] = []
  const sights: World['sights'] = []
  const screens = createScreens()
  const rand = tex.rng(7)

  // ---- materials ----
  const M: Mats = {
    grass: lambert({ map: tex.grass() }),
    trail: lambert({ map: tex.trail() }),
    hedge: hedgeMaterial(),
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
  const plasticMat = lambert({ color: 0x24252a })
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })

  /** An invisible box that can be aimed at and used. */
  const hit = (
    kind: Kind,
    index: number,
    at: THREE.Vector3Like,
    half: [number, number, number],
    range = 3.2,
    rotY = 0,
  ) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
      hitMat,
    )
    m.position.set(at.x, at.y, at.z)
    m.rotation.y = rotY
    m.userData = { hit: true, kind, index, range }
    scene.add(m)
    hits.push(m)
    return m
  }

  // ---- ground and the trail ----
  {
    const g = new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2)
    tile(g, 75, 75)
    mesh(scene, g, M.grass, 8, 0, -30)
  }
  trailRibbon(scene, walk, M.trail)
  // paving in the yard and before the calvary
  pave(scene, M.darkStone, 23, -37, 39, -23)
  pave(scene, M.darkStone, -15, -77, 7, -60.5)

  // ---- the wall, the railings and the iron gate ----
  const gate = buildGate(scene, M, lamps, flames)
  for (const side of [-1, 1]) {
    block(scene, M.stone, 42, 0.7, 0.55, side * (2.6 + 21), 0, GATE_Z, 0, 2)
    block(scene, M.stone, 42, 0.12, 0.7, side * (2.6 + 21), 0.7, GATE_Z, 0, 2)
  }
  {
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
        m.makeTranslation(side * x, 1.57, GATE_Z)
        bars.setMatrixAt(k, m)
        m.makeTranslation(side * x, 2.38, GATE_Z)
        tips.setMatrixAt(k, m)
      }
    bars.count = tips.count = k
    scene.add(bars, tips)
    for (const side of [-1, 1])
      for (const y of [0.95, 2.15])
        block(scene, M.iron, 41.5, 0.05, 0.05, side * (2.6 + 20.8), y, GATE_Z)
  }
  // the open gate leaves stand against the hedges just inside
  grid.block(-1.75, GATE_Z - 0.85, 0.15, 0.85)
  grid.block(1.75, GATE_Z - 0.85, 0.15, 0.85)

  // ---- lamps ----
  for (const [x, z] of [
    [1.45, -3],
    [-1.45, -22.5],
    [6, -16.55],
    [15.5, -19.45],
    [21.45, -22],
    [18.55, -33],
    [14, -38.55],
    [3, -41.45],
    [-5.45, -45],
    [-2.55, -57],
    [27.5, -16.55],
  ] as V2[]) {
    lamp(scene, M, x, z, lamps, flames)
    grid.block(x, z, 0.15, 0.15)
  }

  // ---- signposts at the junctions ----
  for (const s of signposts) {
    directionSign(scene, M, s.at, s.arrows)
    grid.block(s.at[0], s.at[1], 0.12, 0.12)
  }

  // ---- I. find me: the signpost of links, and a monitor that shouldn't be here ----
  linkSign(scene, M, hit, lamps, flames)
  grid.block(SIGN[0], SIGN[1], 0.15, 0.15)
  {
    const crt = monitor(screens.discord, plasticMat)
    crt.position.set(...MONITOR)
    // (screens face +z, so turn them round to face the point)
    crt.rotation.y = yawTo(MONITOR[0], MONITOR[2], 0.6, -10.5) + Math.PI
    crt.userData.dynamic = true
    scene.add(crt)
    floaters.push({ obj: crt, y: MONITOR[1], yaw: crt.rotation.y })
    hit(
      'discord',
      0,
      { x: MONITOR[0], y: MONITOR[1], z: MONITOR[2] },
      [0.35, 0.32, 0.35],
      4.5,
    )
    sights.push({ line: 'discord', at: new THREE.Vector3(...MONITOR) })
    grid.block(MONITOR[0], MONITOR[2], 0.3, 0.3)
  }

  // ---- II. on rotation: the fountain, cases in the grass, a screen, a walkman ----
  const walkman = buildFountain()

  // ---- III. things I've built: a monument for each, before the mausoleum ----
  buildMausoleum(scene, M, lamps, flames, glassMat)
  grid.block(MAUSOLEUM[0] + 0.1, MAUSOLEUM[1], 3.75, 2.65)
  grid.block(MAUSOLEUM[0] - 3.7, MAUSOLEUM[1] - 2.9, 0.35, 0.35)
  grid.block(MAUSOLEUM[0] - 3.7, MAUSOLEUM[1] + 2.9, 0.35, 0.35)
  {
    const spots: [number, number, number][] = [
      [24.9, -34.3, 0],
      [28.0, -34.7, 0],
      [24.9, -25.7, Math.PI],
      [28.0, -25.3, Math.PI],
    ]
    projects.forEach((p, i) => {
      const [x, z, ry] = spots[i % spots.length]
      const { half } = monument(scene, M, i, `${p.name}\n${p.year}`, x, z, ry)
      grid.block(x, z, half[0], half[1], ry)
      hit('project', i, { x, y: 1.3, z }, [half[0] + 0.1, 1.4, half[1] + 0.1], 5.5, ry)
    })
  }

  // ---- IV. slvrr / sxvrce: sticky notes on the fence behind the shrine ----
  buildShrine()

  // ---- V. notes: a grave for each, with the note left at its foot ----
  {
    const epitaphBg = '#77756d'
    notes.forEach((n, i) => {
      // Two columns of five by the path; add columns westwards as notes pile up.
      const col = Math.floor(i / 5)
      const row = i % 5
      const x = -9.2 - col * 3
      const z = -47.4 - row * 2.5
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = Math.PI / 2 // faces the path (+x)
      scene.add(g)
      const w = 1.0
      const h = 1.25
      const s = new THREE.Shape()
      s.moveTo(-w / 2, 0)
      s.lineTo(w / 2, 0)
      s.lineTo(w / 2, h - w / 2)
      s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false)
      s.closePath()
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: 0.16,
        bevelEnabled: false,
        curveSegments: 5,
      })
      geo.translate(0, 0, -0.08)
      tile(geo, 1.2, 1.2)
      g.add(new THREE.Mesh(geo, M.marble))
      block(g, M.stone, 1.2, 0.18, 0.4, 0, 0, 0, 0, 1)
      const words = wrap(n.title, 14).slice(0, 3).join('\n')
      const face = tex.lettering(`${words}\n${n.date}`, {
        w: 64,
        h: 56,
        bg: epitaphBg,
        fg: '#e2ded2',
        carved: true,
        size: 13,
        grain: i + 40,
      })
      mesh(g, new THREE.PlaneGeometry(0.82, 0.72), lambert({ map: face }), 0, 0.62, 0.085)
      // the note itself, folded, on the ground at its foot
      const paper = mesh(
        scene,
        new THREE.PlaneGeometry(0.28, 0.35).rotateX(-Math.PI / 2),
        lambert({ map: tex.paper(i) }),
        x + 0.75,
        0.02,
        z + 0.05,
      )
      paper.rotation.y = (rand() - 0.5) * 0.8
      paper.userData.dynamic = true
      grid.block(x, z, 0.25, 0.6)
      hit('note', i, { x: x + 0.45, y: 0.55, z }, [0.65, 0.7, 0.65], 3)
    })
    // older graves behind them
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
    for (let i = 0; i < 40; i++) {
      const x = -20.3 + r() * 5.3
      const z = -58.8 + r() * 13.6
      if (Math.hypot(x + 17.5, z + 52) < 2.2) continue
      grave(scene, M, x, z, r, epitaph)
      grid.block(x, z, 0.35, 0.35)
    }
    block(scene, M.marble, 2.2, 0.8, 1.1, -17.5, 0, -52, Math.PI / 2, 1)
    block(scene, M.marble, 2.4, 0.1, 1.3, -17.5, 0.8, -52, Math.PI / 2, 1)
    statue(scene, M, 'weeper', -17.5, -52, 0.055, 0.9, undefined, Math.PI / 2)
    grid.block(-17.5, -52, 0.65, 1.2)
  }

  // ---- VI. the end of the path: the calvary ----
  {
    const g = new THREE.Group()
    g.position.set(CALVARY[0], 0, CALVARY[1])
    scene.add(g)
    for (let i = 0; i < 4; i++)
      block(g, M.stone, 7.2 - i * 1.5, 0.4, 7.2 - i * 1.5, 0, i * 0.4, 0, 0, 1)
    block(g, M.darkStone, 0.6, 10, 0.6, 0, 1.6, 0, 0, 1)
    block(g, M.darkStone, 4.4, 0.6, 0.6, 0, 8.6, 0, 0, 1)
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as V2[]) {
      statue(
        g,
        M,
        'angel',
        dx * 4.4,
        dz * 4.4,
        0.065,
        0.6,
        M.marble,
        dz > 0 ? 0 : Math.PI,
      )
      grid.block(CALVARY[0] + dx * 4.4, CALVARY[1] + dz * 4.4, 0.55, 0.55)
    }
    for (const [dx, dz] of [
      [0, 5],
      [5, 0],
      [-5, 0],
    ] as V2[]) {
      lamp(scene, M, CALVARY[0] + dx, CALVARY[1] + dz, lamps, flames)
      grid.block(CALVARY[0] + dx, CALVARY[1] + dz, 0.15, 0.15)
    }
    grid.block(CALVARY[0], CALVARY[1], 3.7, 3.7)
    cathedral(scene, glassMat)
  }

  // ---- dead ends: a little something at the end of each ----
  bench(0, -27.9, 0)
  statue(scene, M, 'urn', 1.3, -28.2, 0.07, 0.5, M.stone)
  grid.block(1.3, -28.2, 0.35, 0.35)
  statue(scene, M, 'bust', 30.3, -18, 0.08, 1.0, M.marble, -Math.PI / 2)
  grid.block(30.3, -18, 0.4, 0.4)
  deadTree(scene, M, 21.2, -50.9, tex.rng(4))
  grid.block(21.2, -50.9, 0.3, 0.3)
  statue(scene, M, 'angel', -15.3, -40, 0.055, 0.5, M.stone, Math.PI / 2)
  grid.block(-15.3, -40, 0.5, 0.5)

  // ---- hedges, grown along every open edge ----
  buildHedges(scene, grid, M.hedge)

  // ---- trees above the hedges ----
  {
    const r = tex.rng(5)
    let placed = 0
    for (let tries = 0; tries < 3000 && placed < 80; tries++) {
      const x = -28 + r() * 72
      const z = 14 - r() * 96
      const i = Math.floor((x - grid.x0) / CELL)
      const j = Math.floor((z - grid.z0) / CELL)
      if (grid.at(x, z) !== Cell.Hedge) continue
      if (grid.distanceToOpen(i, j, 6) < 5) continue
      if (Math.abs(z - GATE_Z) < 2) continue
      if (r() < 0.82) cypress(scene, M, x, z, 5 + r() * 6)
      else deadTree(scene, M, x, z, r)
      placed++
    }
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

  // ---- grass tufts along the hedges ----
  {
    const geo = new THREE.PlaneGeometry(0.6, 0.45)
    geo.translate(0, 0.225, 0)
    const merged = mergeGeos([geo, geo.clone().rotateY(Math.PI / 2)])
    const mat = lambert(
      { map: tex.tuft(), alphaTest: 0.5, side: THREE.DoubleSide },
      { sway: true },
    )
    const N = 2800
    const inst = new THREE.InstancedMesh(merged, mat, N)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const r = tex.rng(17)
    const paved = (x: number, z: number) =>
      (x > 23 && x < 39 && z > -37 && z < -23) ||
      (x > -15 && x < 7 && z > -77 && z < -60.5) ||
      Math.hypot(x - FOUNTAIN[0], z - FOUNTAIN[1]) < 5.3
    let k = 0
    for (let tries = 0; tries < 60000 && k < N; tries++) {
      const x = grid.x0 + r() * grid.w * CELL
      const z = grid.z0 + r() * grid.h * CELL
      if (grid.at(x, z) !== Cell.Floor || paved(x, z)) continue
      // near a hedge, off the trail
      const nearHedge = [
        [0.7, 0],
        [-0.7, 0],
        [0, 0.7],
        [0, -0.7],
      ].some(([dx, dz]) => grid.at(x + dx, z + dz) === Cell.Hedge)
      if (!nearHedge && r() > 0.12) continue
      const p = walk.at(walk.project([x, z]))
      if (Math.hypot(x - p[0], z - p[1]) < 1.05) continue
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI)
      const s = 0.55 + r() * 0.9
      m.compose(
        new THREE.Vector3(x, 0, z),
        q,
        new THREE.Vector3(s, s * (0.7 + r() * 0.8), s),
      )
      inst.setMatrixAt(k++, m)
    }
    inst.count = k
    scene.add(inst)
  }

  // ---- mist ----
  const mist = createMist(walk)
  scene.add(mist.mesh)

  for (const f of flames) f.userData.dynamic = true
  gate.left.userData.dynamic = gate.right.userData.dynamic = true
  mergeStatic(scene)

  return {
    scene,
    walk,
    grid,
    hits,
    gate,
    flowing,
    flames,
    lamps,
    mist,
    glassMats,
    screens,
    floaters,
    walkman,
    sights,
  }

  // ------------------------------------------------------------------

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

  function bench(x: number, z: number, ry: number) {
    block(scene, M.stone, 1.8, 0.45, 0.5, x, 0, z, ry, 1)
    block(scene, M.stone, 1.9, 0.08, 0.6, x, 0.45, z, ry, 1)
    grid.block(x, z, 0.95, 0.3, ry)
  }

  function buildFountain() {
    const [cx, cz] = FOUNTAIN
    const g = new THREE.Group()
    g.position.set(cx, 0, cz)
    scene.add(g)
    const flag = new THREE.CircleGeometry(5.3, 18).rotateX(-Math.PI / 2)
    tile(flag, 5, 5)
    mesh(g, flag, M.darkStone, 0, 0.014, 0)
    mesh(
      g,
      tile(new THREE.CylinderGeometry(2.7, 2.9, 0.65, 12), 8.5, 0.35),
      M.stone,
      0,
      0.325,
      0,
    )
    const inner = tile(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 12, 1, true), 8, 0.2)
    mesh(
      g,
      inner,
      lambert({
        map: (M.darkStone as THREE.MeshLambertMaterial).map,
        side: THREE.BackSide,
      }),
      0,
      0.5,
      0,
    )
    mesh(
      g,
      new THREE.CircleGeometry(2.5, 12).rotateX(-Math.PI / 2),
      water(2.5),
      0,
      0.45,
      0,
    )
    mesh(
      g,
      tile(new THREE.CylinderGeometry(0.32, 0.45, 1.3, 8), 1.2, 0.65),
      M.stone,
      0,
      1.05,
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
    mesh(
      g,
      new THREE.CylinderGeometry(0.98, 1.3, 1.1, 14, 1, true),
      water(1, true),
      0,
      1.15,
      0,
    )
    statue(g, M, 'cherub', 0, 0, 0.055, 2.18, undefined, Math.PI * 0.08)
    grid.circle(cx, cz, 3.0, Cell.Block, [Cell.Floor])
    hit('fountain', 0, { x: cx, y: 0.45, z: cz }, [2.85, 0.45, 2.85], 6.5)

    // two benches on the far side: a screen on one, a walkman on the other
    const benchAt = (a: number) => {
      const x = cx + Math.cos(a) * 4.3
      const z = cz + Math.sin(a) * 4.3
      const ry = -a + Math.PI / 2
      bench(x, z, ry)
      return { x, z, ry }
    }
    const b1 = benchAt(Math.PI * 0.82)
    const b2 = benchAt(Math.PI * 1.18)

    const crt = monitor(screens.music, plasticMat)
    crt.position.set(b1.x, 0.53 + 0.23, b1.z)
    crt.rotation.y = yawTo(b1.x, b1.z, cx + 1, cz + 6) + Math.PI
    scene.add(crt)
    hit('nowplaying', 0, crt.position, [0.35, 0.3, 0.35], 4.5)
    sights.push({ line: 'nowPlaying', at: crt.position.clone() })

    const wm = walkmanModel(screens.lcd)
    wm.position.set(b2.x, 0.53 + 0.02, b2.z)
    wm.rotation.order = 'YXZ'
    wm.rotation.set(-1.2, yawTo(b2.x, b2.z, cx + 2, cz + 6) + Math.PI, 0)
    wm.userData.dynamic = true
    scene.add(wm)
    hit('walkman', 0, { x: b2.x, y: 0.62, z: b2.z }, [0.3, 0.22, 0.3], 3.5)
    sights.push({ line: 'walkman', at: wm.position.clone() })

    // the albums, dropped in the grass and against the basin
    const r = tex.rng(77)
    const caseGeo = new THREE.BoxGeometry(0.5, 0.5, 0.05)
    const edge = lambert({ color: 0x3c3f47, transparent: true, opacity: 0.85 })
    media.forEach((m, i) => {
      // strewn round the east side, away from the benches
      const a =
        Math.PI * (-0.42 + (i / Math.max(1, media.length - 1)) * 0.86) +
        (r() - 0.5) * 0.15
      const d = 3.35 + r() * 1.3
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      // the covers glow faintly, so they catch your eye in the dark
      const art = tex.cover(m.swatch ? null : coverPath(m), m.swatch)
      const front = lambert({
        map: art,
        emissive: 0xffffff,
        emissiveMap: art,
        emissiveIntensity: 0.3,
      })
      const back = lambert({ color: 0x15161a })
      const c = new THREE.Mesh(caseGeo, [edge, edge, edge, edge, front, back])
      const propped = i % 3 === 1
      c.rotation.order = 'YXZ'
      c.rotation.y = yawTo(x, z, cx, cz + 6) + (r() - 0.5) * 0.9
      c.rotation.x = propped ? -0.45 : -Math.PI / 2 + (r() - 0.5) * 0.15
      c.rotation.z = (r() - 0.5) * 0.4
      c.position.set(x, propped ? 0.2 : 0.035, z)
      c.userData.dynamic = true
      scene.add(c)
      hit('album', i, { x, y: 0.25, z }, [0.34, 0.28, 0.34], 4.5)
    })
    return wm
  }

  function buildShrine() {
    const [sx, sz] = SHRINE
    const g = new THREE.Group()
    g.position.set(sx, 0, sz)
    scene.add(g)
    block(g, M.stone, 2.0, 0.85, 1.1, 0, 0, 0, 0, 1)
    block(g, M.stone, 2.0, 2.1, 0.35, 0, 0.85, -0.45, 0, 1)
    block(g, M.stone, 0.35, 2.1, 1.0, -0.85, 0.85, -0.05, 0, 1)
    block(g, M.stone, 0.35, 2.1, 1.0, 0.85, 0.85, -0.05, 0, 1)
    for (const s of [-1, 1]) {
      const roof = block(g, M.darkStone, 1.35, 0.14, 1.35, s * 0.55, 3.15, -0.05, 0, 1)
      roof.rotation.z = -s * 0.62
    }
    block(g, M.iron, 0.08, 0.5, 0.08, 0, 3.5, -0.05)
    block(g, M.iron, 0.32, 0.08, 0.08, 0, 3.78, -0.05)
    statue(g, M, 'madonna', 0, -0.2, 0.05, 0.85)
    for (let i = 0; i < 7; i++) {
      const x = -0.75 + i * 0.25 + (rand() - 0.5) * 0.08
      const h = 0.1 + rand() * 0.18
      block(g, M.marble, 0.06, h, 0.06, x, 0.85, 0.35)
      flames.push(
        mesh(
          g,
          new THREE.BoxGeometry(0.035, 0.07, 0.035),
          M.flame,
          x,
          0.85 + h + 0.04,
          0.35,
        ),
      )
    }
    lamps.push(new THREE.Vector3(sx, 1.2, sz + 0.7))
    grid.block(sx, sz - 0.1, 1.05, 0.7)
    statue(scene, M, 'monk', 12.1, -45.6, 0.055, 0.3, M.stone, -0.6)
    grid.block(12.1, -45.6, 0.45, 0.45)

    // a weathered fence behind, with the notes stuck along it
    const fz = -49.25
    for (let x = 5.3; x <= 12.8; x += 1.25)
      block(scene, M.wood, 0.12, 2.0, 0.12, x, 0, fz - 0.05, 0, 1)
    for (const y of [0.45, 1.15, 1.7])
      block(scene, M.wood, 7.6, 0.32, 0.06, 9.05, y, fz, 0, 1)
    grid.block(9.05, fz, 3.85, 0.15)
    const items = [...profile.bio, ...timeline]
    const slots: number[] = []
    const n = items.length
    for (let i = 0; i < n; i++) {
      // fill the fence left of the shrine, then right of it
      const leftCount = Math.ceil(n / 2.4)
      slots.push(
        i < leftCount
          ? 5.75 + (i * 2.05) / Math.max(1, leftCount - 1)
          : 10.45 + ((i - leftCount) * 2.0) / Math.max(1, n - leftCount - 1),
      )
    }
    items.forEach((_, i) => {
      const x = slots[i]
      const y = 1.25 + ((i * 37) % 5) * 0.08
      const note = mesh(
        scene,
        new THREE.PlaneGeometry(0.26, 0.26),
        lambert({ map: tex.sticky(i + 1) }),
        x,
        y,
        fz + 0.04,
      )
      note.rotation.z = (rand() - 0.5) * 0.3
      hit('sticky', i, { x, y, z: fz + 0.1 }, [0.2, 0.2, 0.12], 3)
    })
    const ave = tex.lettering('AVE', {
      w: 48,
      h: 16,
      bg: '#5b5a55',
      fg: '#cfccc2',
      carved: true,
      size: 13,
    })
    mesh(g, new THREE.PlaneGeometry(0.9, 0.3), lambert({ map: ave }), 0, 0.45, 0.56)
  }
}

// --------------------------------------------------------------------------

/** Hedge leaves, mapped by world position so neighbouring blocks line up. */
function hedgeMaterial() {
  const m = lambert({ map: tex.hedge() })
  const inner = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer)
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      /* glsl */ `#include <uv_vertex>
      {
        vec4 wq = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vMapUv = abs(normal.x) > 0.5 ? wq.zy : abs(normal.y) > 0.5 ? wq.xz : wq.xy;
      }`,
    )
  }
  m.customProgramCacheKey = () => 'psx-hedge'
  return m
}

/** A block of hedge in every solid cell within a metre of open ground. */
function buildHedges(scene: THREE.Scene, grid: Grid, mat: THREE.Material) {
  const cells: [number, number, number][] = []
  for (let j = 0; j < grid.h; j++)
    for (let i = 0; i < grid.w; i++) {
      if (grid.cells[j * grid.w + i] !== Cell.Hedge) continue
      const [x, z] = grid.center(i, j)
      if (Math.abs(z - GATE_Z) < 0.8) continue // the wall's line
      if (grid.distanceToOpen(i, j, 2) > 2) continue
      // a gently uneven top
      const h =
        2.3 +
        0.18 * Math.sin(x * 0.7 + z * 0.3) * Math.sin(z * 0.9 - x * 0.2) +
        0.06 * Math.sin(x * 3.1 + z * 2.3)
      cells.push([x, z, h])
    }
  const geo = new THREE.BoxGeometry(CELL, 1, CELL).translate(0, 0.5, 0)
  const inst = new THREE.InstancedMesh(geo, mat, cells.length)
  const m = new THREE.Matrix4()
  cells.forEach(([x, z, h], k) => {
    m.makeScale(1, h, 1).setPosition(x, 0, z)
    inst.setMatrixAt(k, m)
  })
  inst.computeBoundingSphere()
  scene.add(inst)
}

function trailRibbon(scene: THREE.Scene, walk: Walk, mat: THREE.Material) {
  const pts = walk.points
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
    pos.push(pts[i][0] - rx, 0.012, pts[i][1] - rz, pts[i][0] + rx, 0.012, pts[i][1] + rz)
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
  mesh(scene, g, mat)
}

function pave(
  scene: THREE.Scene,
  mat: THREE.Material,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
  tile(g, (x1 - x0) / 2, (z1 - z0) / 2)
  mesh(scene, g, mat, (x0 + x1) / 2, 0.013, (z0 + z1) / 2)
}

function wrap(text: string, max: number) {
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max && line) {
      out.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) out.push(line)
  return out
}

/**
 * A board with a word on both faces and a point at one end; points along
 * local +x.
 */
function arrowBoard(label: string, M: Mats, seed: number, len = 0.95) {
  const t = tex.lettering(label, {
    w: label.length > 10 ? 96 : 64,
    h: 16,
    bg: seed % 3 ? '#3b2f22' : '#33291f',
    fg: '#e0d7c0',
    size: label.length > 10 ? 12 : 13,
    grain: seed + 5,
  })
  const face = lambert({ map: t })
  const g = new THREE.Group()
  const board = new THREE.Mesh(new THREE.BoxGeometry(len, 0.17, 0.04), [
    M.wood,
    M.wood,
    M.wood,
    M.wood,
    face,
    face,
  ])
  board.position.x = len / 2
  g.add(board)
  const tip = new THREE.Mesh(boxGeo(0.12, 0.12, 0.04), M.wood)
  tip.position.x = len
  tip.rotation.z = Math.PI / 4
  g.add(tip)
  return g
}

/** A signpost at a junction, its arrows pointing the way along each branch. */
function directionSign(scene: THREE.Scene, M: Mats, at: V2, arrows: [string, V2][]) {
  block(scene, M.wood, 0.13, 2.6, 0.13, at[0], 0, at[1], 0, 1)
  mesh(
    scene,
    new THREE.ConeGeometry(0.12, 0.16, 4),
    M.wood,
    at[0],
    2.68,
    at[1],
    Math.PI / 4,
  )
  arrows.forEach(([label, [dx, dz]], i) => {
    const a = arrowBoard(label, M, i + Math.round(at[0] * 3))
    a.position.set(at[0], 2.3 - i * 0.24, at[1])
    a.rotation.y = Math.atan2(-dz, dx)
    // a slight droop, as old signs have
    a.rotation.z = (((i * 7 + 3) % 5) - 2) * 0.015
    scene.add(a)
  })
}

/** The signpost of links: an arrow per profile, each one clickable. */
function linkSign(
  scene: THREE.Scene,
  M: Mats,
  hit: (
    kind: Kind,
    index: number,
    at: THREE.Vector3Like,
    half: [number, number, number],
    range?: number,
    rotY?: number,
  ) => THREE.Mesh,
  lamps: THREE.Vector3[],
  flames: THREE.Object3D[],
) {
  const g = new THREE.Group()
  g.position.set(SIGN[0], 0, SIGN[1])
  g.rotation.y = yawTo(SIGN[0], SIGN[1], 0.75, -8.6) + Math.PI
  scene.add(g)
  block(g, M.wood, 0.14, 2.75, 0.14, 0, 0, 0, 0, 1)
  mesh(g, new THREE.ConeGeometry(0.13, 0.18, 4), M.wood, 0, 2.84, 0, Math.PI / 4)
  const head = lambert({
    map: tex.lettering('FIND ME', {
      w: 64,
      h: 16,
      bg: '#2a221a',
      fg: '#e3dac4',
      size: 15,
    }),
  })
  mesh(
    g,
    new THREE.BoxGeometry(1.1, 0.3, 0.05),
    [M.wood, M.wood, M.wood, M.wood, head, head],
    0,
    2.45,
    0.09,
  )
  g.updateMatrixWorld()
  links.forEach((l, i) => {
    const right = i % 2 === 0
    const a = arrowBoard(l.label.toLowerCase(), M, i, 0.82)
    const y = 2.12 - i * 0.24
    a.position.set(0, y, 0.075)
    a.rotation.y = right ? 0 : Math.PI
    a.rotation.z = (((i * 5 + 1) % 5) - 2) * 0.02
    g.add(a)
    const local = new THREE.Vector3(right ? 0.45 : -0.45, y, 0.075)
    const world = local.applyMatrix4(g.matrixWorld)
    hit('link', i, world, [0.45, 0.11, 0.12], 3.2, g.rotation.y)
  })
  block(g, M.iron, 0.4, 0.04, 0.04, 0.2, 2.62, 0)
  block(g, M.iron, 0.2, 0.03, 0.2, 0.4, 2.3, 0)
  block(g, M.lanternGlass, 0.14, 0.2, 0.14, 0.4, 2.33, 0)
  flames.push(mesh(g, new THREE.BoxGeometry(0.04, 0.08, 0.04), M.flame, 0.4, 2.42, 0))
  g.updateMatrixWorld()
  lamps.push(new THREE.Vector3(0.4, 2.3, 0.4).applyMatrix4(g.matrixWorld))
}

/** A chunky old CRT monitor, its screen showing a live texture. */
function monitor(screen: THREE.Texture, plastic: THREE.Material) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.34), plastic)
  g.add(body)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.22), plastic)
  back.position.z = -0.27
  g.add(back)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.345),
    basic({ map: screen }),
  )
  glass.position.z = 0.172
  g.add(glass)
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.02, 0.01),
    basic({ color: 0x5ce07a }),
  )
  led.position.set(0.22, -0.2, 0.172)
  g.add(led)
  return g
}

/** A cassette walkman with its headphones wrapped round it. */
function walkmanModel(lcd: THREE.Texture) {
  const g = new THREE.Group()
  const shell = lambert({ color: 0x2e3a4a })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.06), shell)
  g.add(body)
  const window_ = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.09),
    basic({ color: 0x0b0d10 }),
  )
  window_.position.set(0, 0.03, 0.031)
  g.add(window_)
  for (const x of [-0.035, 0.035]) {
    const reel = new THREE.Mesh(
      new THREE.CircleGeometry(0.018, 8),
      basic({ color: 0x8c8678 }),
    )
    reel.position.set(x, 0.03, 0.032)
    g.add(reel)
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.047), basic({ map: lcd }))
  screen.position.set(0, -0.075, 0.031)
  g.add(screen)
  const buttons = lambert({ color: 0x9a9fa8 })
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), buttons)
    b.position.set(-0.06 + i * 0.04, 0.15, 0)
    g.add(b)
  }
  const phones = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.012, 4, 14, Math.PI * 1.3),
    lambert({ color: 0x1a1a1c }),
  )
  phones.position.set(0, 0.06, -0.04)
  phones.rotation.z = -0.4
  g.add(phones)
  for (const x of [-0.12, 0.1]) {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.025, 8),
      lambert({ color: 0xb04a2a }),
    )
    cup.rotation.x = Math.PI / 2
    cup.position.set(x, x < 0 ? -0.02 : 0.15, -0.045)
    g.add(cup)
  }
  return g
}

/** A monument for one project: obelisk, stele, broken column or sarcophagus. */
function monument(
  scene: THREE.Scene,
  M: Mats,
  i: number,
  text: string,
  x: number,
  z: number,
  ry: number,
) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = ry
  scene.add(g)
  const plaque = (w: number, h: number, y: number, zf: number) => {
    const t = tex.lettering(text, {
      w: 96,
      h: 40,
      bg: '#5f5d57',
      fg: '#e0dccf',
      carved: true,
      size: 19,
      grain: i + 9,
    })
    mesh(g, new THREE.PlaneGeometry(w, h), lambert({ map: t }), 0, y, zf)
  }
  let half: [number, number] = [0.7, 0.7]
  switch (i % 4) {
    case 0: {
      // an obelisk
      block(g, M.stone, 1.4, 0.3, 1.4, 0, 0, 0, 0, 1)
      block(g, M.marble, 1.1, 0.7, 1.1, 0, 0.3, 0, 0, 1)
      const shaft = tile(new THREE.CylinderGeometry(0.24, 0.36, 3.6, 4), 1, 3)
      mesh(g, shaft, M.marble, 0, 1.0 + 1.8, 0, Math.PI / 4)
      mesh(g, new THREE.ConeGeometry(0.26, 0.45, 4), M.marble, 0, 4.82, 0, Math.PI / 4)
      plaque(0.95, 0.4, 0.65, 0.555)
      half = [0.7, 0.7]
      break
    }
    case 1: {
      // a tall stele with a rounded top
      block(g, M.stone, 2.0, 0.3, 0.8, 0, 0, 0, 0, 1)
      const s = new THREE.Shape()
      s.moveTo(-0.85, 0)
      s.lineTo(0.85, 0)
      s.lineTo(0.85, 1.75)
      s.absarc(0, 1.75, 0.85, 0, Math.PI, false)
      s.closePath()
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: 0.36,
        bevelEnabled: false,
        curveSegments: 6,
      })
      geo.translate(0, 0, -0.18)
      tile(geo, 0.8, 0.8)
      mesh(g, geo, M.stone, 0, 0.3, 0)
      plaque(1.4, 0.58, 1.55, 0.185)
      half = [1.0, 0.45]
      break
    }
    case 2: {
      // a broken column
      block(g, M.stone, 1.3, 1.0, 1.3, 0, 0, 0, 0, 1)
      mesh(
        g,
        tile(new THREE.CylinderGeometry(0.34, 0.36, 2.1, 8), 2, 2),
        M.marble,
        0,
        1.0 + 1.05,
        0,
      )
      const top = new THREE.Mesh(
        tile(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 8), 2, 0.5),
        M.marble,
      )
      top.position.set(0.05, 3.22, 0)
      top.rotation.z = 0.35
      g.add(top)
      const fallen = new THREE.Mesh(
        tile(new THREE.CylinderGeometry(0.33, 0.33, 1.2, 8), 2, 1),
        M.marble,
      )
      fallen.position.set(1.05, 0.33, -0.3)
      fallen.rotation.set(Math.PI / 2, 0.6, 0)
      g.add(fallen)
      plaque(1.05, 0.44, 0.55, 0.655)
      half = [1.2, 0.75]
      break
    }
    default: {
      // a sarcophagus
      block(g, M.stone, 2.2, 0.85, 1.05, 0, 0, 0, 0, 1)
      block(g, M.marble, 2.4, 0.16, 1.2, 0, 0.85, 0, 0, 1)
      const tri = new THREE.Shape()
      tri.moveTo(-0.6, 0)
      tri.lineTo(0.6, 0)
      tri.lineTo(0, 0.28)
      tri.closePath()
      const ridge = new THREE.ExtrudeGeometry(tri, { depth: 2.3, bevelEnabled: false })
      ridge.translate(0, 0, -1.15)
      ridge.rotateY(Math.PI / 2)
      mesh(g, ridge, M.marble, 0, 1.01, 0)
      plaque(1.6, 0.6, 0.45, 0.53)
      half = [1.25, 0.65]
    }
  }
  return { half }
}

/** The mausoleum, at the back of the yard, its front to the monuments. */
function buildMausoleum(
  scene: THREE.Scene,
  M: Mats,
  lamps: THREE.Vector3[],
  flames: THREE.Object3D[],
  glassMat: () => THREE.MeshBasicMaterial,
) {
  const g = new THREE.Group()
  g.position.set(MAUSOLEUM[0], 0, MAUSOLEUM[1])
  g.rotation.y = -Math.PI / 2
  scene.add(g)
  block(g, M.stone, 5.2, 0.5, 6.8, 0, 0, -0.4, 0, 2)
  block(g, M.stone, 4.6, 3.9, 5.2, 0, 0.5, -1.2, 0, 2)
  for (const x of [-1.95, -0.95, 0.95, 1.95]) {
    mesh(
      g,
      tile(new THREE.CylinderGeometry(0.2, 0.24, 3.5, 8), 1.4, 3.5),
      M.marble,
      x,
      2.25,
      2.3,
    )
    block(g, M.stone, 0.55, 0.2, 0.55, x, 0.5, 2.3, 0, 1)
    block(g, M.stone, 0.55, 0.2, 0.55, x, 3.8, 2.3, 0, 1)
  }
  for (let i = 0; i < 3; i++)
    block(g, M.stone, 4.8, 0.17, 0.45, 0, 0.5 - (i + 1) * 0.17, 2.85 + i * 0.4, 0, 1)
  block(g, M.darkStone, 5.0, 0.35, 6.3, 0, 4.0, -0.35, 0, 2)
  const tri = new THREE.Shape()
  tri.moveTo(-2.6, 0)
  tri.lineTo(2.6, 0)
  tri.lineTo(0, 1.25)
  tri.closePath()
  const ped = new THREE.ExtrudeGeometry(tri, { depth: 6.3, bevelEnabled: false })
  ped.translate(0, 0, -3.5)
  mesh(g, ped, M.darkStone, 0, 4.35, 0)
  statue(g, M, 'angel', 0, 2.6, 0.04, 5.6)
  block(g, M.void, 1.5, 2.6, 0.1, 0, 0.5, 1.42)
  for (let x = -0.68; x <= 0.7; x += 0.17) block(g, M.iron, 0.04, 2.55, 0.04, x, 0.5, 1.5)
  for (const y of [1.0, 2.0, 2.9]) block(g, M.iron, 1.5, 0.05, 0.05, 0, y, 1.5)
  block(g, M.flame, 0.05, 0.08, 0.05, 0.3, 1.1, 0.9)
  for (const s of [-1, 1])
    mesh(
      g,
      new THREE.PlaneGeometry(0.5, 1.2),
      glassMat(),
      s * 2.31,
      2.6,
      -1.2,
      (s * Math.PI) / 2,
    )
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
