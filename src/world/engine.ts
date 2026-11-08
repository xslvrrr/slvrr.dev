import * as THREE from 'three'
import { copy } from '@/content/copy'
import { playerStore } from '@/lib/player'
import { sfx } from '@/lib/sfx'
import { onStrike, strike } from '@/lib/storm'
import { modeStore } from '@/lib/store'
import { buildWorld, type World } from './build'
import { Cell } from './grid'
import { FOUNTAIN, GATE_VIEW, SPAWN, zoneAt, type Weather } from './layout'
import { shared } from './materials'
import { createPost } from './post'
import { createRain, createSky, FOG_COLOR, MOON_DIR } from './sky'
import { patchWorld, sameAim, say, worldStore, type Aim, type Mode } from './state'

const EYE = 1.62
const RADIUS = 0.3
const POOL = 4
const WALK = 2.6
const RUN = 4.4

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt)
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** One scene pixel per `n` CSS pixels: ~260 rows tall, chunky but legible. */
function pixelSize() {
  return Math.min(4, Math.max(2, Math.round(window.innerHeight / 260)))
}

const FORWARD = new Set(['KeyW', 'ArrowUp'])
const BACK = new Set(['KeyS', 'ArrowDown'])
const LEFT = new Set(['KeyA', 'ArrowLeft'])
const RIGHT = new Set(['KeyD', 'ArrowRight'])

/**
 * Runs the churchyard: renders it small and pixelated, moves you around it
 * (keys or the thumbstick to walk, mouse or drag to look, the floor plan to
 * bump into), works out what you're aiming at, and drives the storm, the
 * lights, the coin you throw and the walkman you carry. React talks to it
 * through the public methods and listens through `worldStore`.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(66, 1, 0.1, 400)
  world!: World
  private sky = createSky()
  private rain = createRain()
  private post = createPost()
  private hemi = new THREE.HemisphereLight(0x46546b, 0x0c0f0a, 1.1)
  private moon = new THREE.DirectionalLight(0x9aaccc, 0.55)
  private lantern = new THREE.PointLight(0xffb36b, 3.2, 9, 1.4)
  private pool = Array.from(
    { length: POOL },
    () => new THREE.PointLight(0xffbf80, 3, 10, 1.6),
  )
  private raycaster = new THREE.Raycaster()
  private canvas: HTMLCanvasElement

  // you
  private x = GATE_VIEW[0]
  private z = GATE_VIEW[1]
  private yaw = 0
  private pitch = 0.04
  private vx = 0
  private vz = 0
  private keys = new Set<string>()
  private stick = { x: 0, y: 0 }
  private look = { x: 0, y: 0 }
  private parallax = { x: 0, y: 0, tx: 0, ty: 0 }
  private pointer: THREE.Vector2 | null = null
  private intro: { t: number } | null = null
  private mode: Mode = 'loading'
  private aim: Aim | null = null
  private seen = new Set<string>()

  // the body
  private travelled = 0
  private lastStep = 0
  private foot = 1
  private bob = 0
  private fov = 66
  private zoom = 1

  // the walkman, once picked up, rides in its own little scene over the view
  private held = false
  private viewScene = new THREE.Scene()
  private holdOffset = new THREE.Matrix4()

  // the coin
  private coin: {
    mesh: THREE.Mesh
    t: number
    T: number
    from: THREE.Vector3
    vel: THREE.Vector3
    done: () => void
  } | null = null
  private splash: {
    points: THREE.Points
    vel: Float32Array
    ring: THREE.Mesh
    t: number
  } | null = null

  // the world
  private weather: Weather = { ...zoneAt(GATE_VIEW[0], GATE_VIEW[1]).weather }
  private gateT = 0
  private gateTween: { t: number } | null = null
  private flash = 0
  private flashAt = -10
  private nextStrike = 8
  private blood = 0
  private fade = 0
  private fadeTarget = 1
  private time = 0
  private last = 0
  private raf = 0
  private slow = 0
  private disposers: (() => void)[] = []
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.autoClear = false
    this.camera.rotation.order = 'YXZ'
  }

  async init() {
    patchWorld({ progress: 0.15 })
    // the signs are painted in the pixel fonts, so they have to be loaded first
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "Jersey 10"'),
        document.fonts.load('16px "VT323"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ])
    patchWorld({ progress: 0.4 })
    await new Promise((r) => setTimeout(r, 0))
    this.world = buildWorld()
    patchWorld({ progress: 0.85 })
    const { scene } = this.world
    scene.fog = new THREE.FogExp2(FOG_COLOR, this.weather.fog)
    scene.background = FOG_COLOR
    scene.add(
      this.sky.mesh,
      this.rain.mesh,
      this.hemi,
      this.moon,
      this.lantern,
      ...this.pool,
    )
    this.moon.position.copy(MOON_DIR).multiplyScalar(50)
    this.viewScene.add(new THREE.HemisphereLight(0x8090a8, 0x201810, 1.6))
    const key = new THREE.DirectionalLight(0xffc890, 1.2)
    key.position.set(1, 1, 1)
    this.viewScene.add(key)
    this.holdOffset.compose(
      new THREE.Vector3(0.2, -0.165, -0.5),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.38, 0.1, 'YXZ')),
      new THREE.Vector3(0.55, 0.55, 0.55),
    )

    this.resize()
    const onResize = () => this.resize()
    window.addEventListener('resize', onResize)
    this.disposers.push(() => window.removeEventListener('resize', onResize))
    this.disposers.push(onStrike((_x, loud) => this.lightning(loud ? 1 : 0.6, loud)))
    const onVis = () => {
      if (!document.hidden) this.last = performance.now()
    }
    document.addEventListener('visibilitychange', onVis)
    this.disposers.push(() => document.removeEventListener('visibilitychange', onVis))

    // Every visit starts at the closed gate.
    this.x = GATE_VIEW[0]
    this.z = GATE_VIEW[1]
    this.setMode('gate')
    this.renderer.compile(scene, this.camera)
    patchWorld({ progress: 1 })
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.disposers.forEach((d) => d())
    this.renderer.dispose()
  }

  // ------------------------------------------------------------ controls

  /** Open the gate and walk in. Call from a click (it starts the audio). */
  enter() {
    if (this.mode !== 'gate') return
    sfx.ambience()
    sfx.gate()
    sfx.enter()
    this.setMode('opening')
    this.gateTween = { t: 0 }
    this.intro = { t: -1.3 }
  }

  key(code: string, down: boolean) {
    if (down) this.keys.add(code)
    else this.keys.delete(code)
  }

  releaseKeys() {
    this.keys.clear()
    this.stick = { x: 0, y: 0 }
  }

  /** Turn by a mouse or finger movement, in pixels. */
  turn(dx: number, dy: number, sensitivity = 0.0024) {
    if (this.mode !== 'play') return
    this.look.x += dx * sensitivity
    this.look.y += dy * sensitivity
  }

  /** The on-screen thumbstick, -1..1 on each axis (y up is forward). */
  setStick(x: number, y: number) {
    this.stick = { x, y }
  }

  /** Where the free cursor is (-1..1), or null while it's captured. */
  setPointer(nx: number | null, ny = 0) {
    this.pointer = nx === null ? null : new THREE.Vector2(nx, ny)
    if (nx !== null && this.mode === 'gate') {
      this.parallax.tx = -nx * 0.12
      this.parallax.ty = -ny * 0.06
    }
  }

  /** What's at a point on screen, if it's in reach (for taps). */
  pickAt(clientX: number, clientY: number): Aim | null {
    const r = this.canvas.getBoundingClientRect()
    return this.pick(
      new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      ),
    )
  }

  /** What the crosshair (or free cursor) is on. */
  currentAim() {
    return this.aim
  }

  /** Whether the free cursor is over the open sky (click to call the lightning). */
  overSky(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect()
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    )
    return this.raycaster.ray.direction.y > 0.25
  }

  setPaused(paused: boolean) {
    if (paused && this.mode === 'play') {
      this.releaseKeys()
      this.setMode('paused')
    } else if (!paused && this.mode === 'paused') this.setMode('play')
  }

  /** Narrow the view, for reading something up close. */
  setZoom(on: boolean) {
    this.zoom = on ? 0.55 : 1
  }

  pickUpWalkman() {
    if (this.held) return
    this.held = true
    const w = this.world.walkman
    w.removeFromParent()
    w.matrixAutoUpdate = false
    this.viewScene.add(w)
    sfx.pickup()
    patchWorld({ carrying: true })
  }

  /** Flick a coin into the fountain. Resolves as it hits the water. */
  throwCoin() {
    if (this.coin) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const cam = this.camera.position
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
      const from = cam
        .clone()
        .add(fwd.clone().multiplyScalar(0.4))
        .add(new THREE.Vector3(0, -0.25, 0))
      // land somewhere in the pool, roughly where you're looking
      const toFountain = new THREE.Vector3(FOUNTAIN[0] - cam.x, 0, FOUNTAIN[1] - cam.z)
      const d = toFountain.length()
      const reach = Math.max(1.4, Math.min(2.2, d - 1.2))
      const target = new THREE.Vector3(FOUNTAIN[0], 0.47, FOUNTAIN[1]).sub(
        toFountain.normalize().multiplyScalar(reach * (0.4 + Math.random() * 0.5)),
      )
      target.x += (Math.random() - 0.5) * 0.6
      target.z += (Math.random() - 0.5) * 0.6
      const T = 0.75 + d * 0.04
      const g = -9.8
      const vel = new THREE.Vector3(
        (target.x - from.x) / T,
        (target.y - from.y - 0.5 * g * T * T) / T,
        (target.z - from.z) / T,
      )
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.008, 8),
        new THREE.MeshLambertMaterial({ color: 0xd8b25a, emissive: 0x2a1c05 }),
      )
      mesh.position.copy(from)
      this.world.scene.add(mesh)
      sfx.coin()
      this.coin = {
        mesh,
        t: 0,
        T,
        from,
        vel,
        done: () => {
          this.makeSplash(target)
          sfx.splash()
          resolve(true)
        },
      }
    })
  }

  /** Back to the start, just inside the gate (after wandering out of bounds). */
  respawn() {
    this.x = SPAWN[0]
    this.z = SPAWN[1]
    this.vx = this.vz = 0
    this.yaw = 0
    this.pitch = 0
    this.look = { x: 0, y: 0 }
    this.releaseKeys()
    this.weather = { ...zoneAt(this.x, this.z).weather }
    this.setMode('play')
  }

  /** Cut to black (instantly) or bring the picture back. */
  blackout(on: boolean) {
    this.fadeTarget = on ? 0 : 1
    if (on) this.fade = 0
  }

  // ------------------------------------------------------------ internals

  private setMode(mode: Mode) {
    this.mode = mode
    patchWorld({ mode })
  }

  private pick(ndc: THREE.Vector2): Aim | null {
    if (!this.world) return null
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.world.hits, false)
    const cam = this.camera.position
    // the fountain is big, so anything else along the same line wins over it
    let fallback: Aim | null = null
    for (const h of hits) {
      const { kind, index, range } = h.object.userData
      if (h.distance > range) continue
      if (kind === 'walkman' && this.held) continue
      if (!this.world.grid.sees(cam.x, cam.z, h.point.x, h.point.z, 0.3)) break
      if (kind === 'fountain') {
        fallback ??= { kind, index }
        continue
      }
      return { kind, index }
    }
    return fallback
  }

  private makeSplash(at: THREE.Vector3) {
    const n = 26
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3)
      const a = Math.random() * Math.PI * 2
      const s = 0.4 + Math.random() * 0.9
      vel.set([Math.cos(a) * s, 1.6 + Math.random() * 1.6, Math.sin(a) * s], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xc8d4e0,
        size: 0.05,
        transparent: true,
        opacity: 0.9,
      }),
    )
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.13, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x8b98a6,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    )
    ring.position.set(at.x, at.y + 0.01, at.z)
    this.world.scene.add(points, ring)
    if (this.splash) this.endSplash()
    this.splash = { points, vel, ring, t: 0 }
  }

  private endSplash() {
    if (!this.splash) return
    this.splash.points.removeFromParent()
    this.splash.ring.removeFromParent()
    this.splash.points.geometry.dispose()
    this.splash.ring.geometry.dispose()
    this.splash = null
  }

  private lightning(power: number, loud: boolean) {
    this.flashAt = this.time
    this.flash = power
    sfx.thunder(
      loud ? 0.25 : 0.6 + Math.random() * 2.2,
      loud ? 1 : 0.6 + Math.random() * 0.3,
    )
  }

  private resize() {
    const px = pixelSize()
    const w = Math.ceil(window.innerWidth / px)
    const h = Math.ceil(window.innerHeight / px)
    this.renderer.setSize(w, h, false)
    this.post.setSize(w, h)
    this.camera.aspect = w / h
    // keep at least ~56° across on tall phone screens
    const minH = THREE.MathUtils.degToRad(56)
    const v = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(minH / 2) / this.camera.aspect),
    )
    this.fov = Math.min(90, Math.max(66, v))
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
    shared.uSnap.value.set(w / 3, h / 3)
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    if (document.hidden) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.time += dt
    this.update(dt)
    this.render()
  }

  private update(dt: number) {
    const { grid } = this.world
    const t = this.time
    shared.uTime.value = t
    const cam = this.camera

    // ---- moving ----
    let moved = 0
    let running = false
    if (this.mode === 'play') {
      const f =
        (anyOf(this.keys, FORWARD) ? 1 : 0) -
        (anyOf(this.keys, BACK) ? 1 : 0) +
        this.stick.y
      const s =
        (anyOf(this.keys, RIGHT) ? 1 : 0) -
        (anyOf(this.keys, LEFT) ? 1 : 0) +
        this.stick.x
      const len = Math.hypot(f, s)
      running =
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight') ||
        Math.hypot(this.stick.x, this.stick.y) > 0.95
      const speed = (running ? RUN : WALK) * Math.min(1, len)
      const fx = -Math.sin(this.yaw)
      const fz = -Math.cos(this.yaw)
      const tx = len > 0.01 ? ((fx * f + Math.cos(this.yaw) * s) / len) * speed : 0
      const tz = len > 0.01 ? ((fz * f - Math.sin(this.yaw) * s) / len) * speed : 0
      this.vx += (tx - this.vx) * damp(9, dt)
      this.vz += (tz - this.vz) * damp(9, dt)
      const [nx, nz] = grid.move(this.x, this.z, this.vx * dt, this.vz * dt, RADIUS)
      moved = Math.hypot(nx - this.x, nz - this.z)
      this.x = nx
      this.z = nz
      // turning
      this.yaw -= this.look.x
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - this.look.y))
      this.look.x = this.look.y = 0
      // wandered somewhere you shouldn't be?
      if (grid.at(this.x, this.z) === Cell.OutOfBounds) {
        this.releaseKeys()
        this.vx = this.vz = 0
        this.setMode('lost')
      }
    } else {
      this.vx = this.vz = 0
    }

    // ---- the walk in through the gate ----
    if (this.intro) {
      this.intro.t += dt
      const T = 3.4
      const k = Math.max(0, Math.min(1, this.intro.t / T))
      const e = easeInOut(k)
      const nz = GATE_VIEW[1] + (SPAWN[1] - GATE_VIEW[1]) * e
      moved = Math.abs(nz - this.z)
      this.z = nz
      this.pitch += (0 - this.pitch) * damp(2, dt)
      if (k >= 1) {
        this.intro = null
        this.setMode('play')
      }
    }

    // ---- the body: footsteps and head bob ----
    const stride = running ? 1.6 : 1.2
    this.travelled += moved
    const phase = (this.travelled / stride) * Math.PI
    const stepIndex = Math.floor(phase / Math.PI + 0.5)
    if (stepIndex !== this.lastStep) {
      this.lastStep = stepIndex
      this.foot = -this.foot
      sfx.step(this.foot * 0.22, running ? 1.35 : 1)
    }
    const walking = moved > 0.0005
    this.bob +=
      ((walking && !this.reduced ? 1 : 0) - this.bob) * damp(walking ? 6 : 3, dt)
    const amp = running ? 0.07 : 0.05
    const bobY = (-Math.abs(Math.sin(phase)) * amp + amp * 0.4) * this.bob
    const sway = Math.sin(phase) * 0.025 * this.bob
    const roll = Math.sin(phase) * 0.008 * this.bob
    const breathe = this.reduced ? 0 : Math.sin(t * 1.35) * 0.006

    // the title screen leans a little towards the cursor
    this.parallax.x += (this.parallax.tx - this.parallax.x) * damp(3, dt)
    this.parallax.y += (this.parallax.ty - this.parallax.y) * damp(3, dt)
    const lean = this.mode === 'gate' || this.mode === 'opening' ? 1 : 0
    const yaw = this.yaw + this.parallax.x * lean
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    cam.position.set(this.x + rx * sway, EYE + bobY + breathe, this.z + rz * sway)
    cam.rotation.set(this.pitch + this.parallax.y * lean + bobY * 0.15, yaw, roll)
    const fov = this.fov * this.zoom
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * damp(6, dt)
      cam.updateProjectionMatrix()
    }
    cam.updateMatrixWorld()

    // ---- what you're aiming at ----
    if (this.mode === 'play') {
      const aim = this.pick(this.pointer ?? new THREE.Vector2(0, 0))
      if (!sameAim(aim, this.aim)) {
        this.aim = aim
        patchWorld({ aim })
        if (aim) sfx.tick()
      }
    } else if (this.aim && this.mode !== 'paused') {
      this.aim = null
      patchWorld({ aim: null })
    }

    // ---- things worth a remark, the first time you see them ----
    this.slow -= dt
    if (this.slow <= 0) {
      this.slow = 0.2
      if (this.mode === 'play') {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
        for (const s of this.world.sights) {
          if (this.seen.has(s.line) || (s.line === 'walkman' && this.held)) continue
          const to = s.at.clone().sub(cam.position)
          const d = to.length()
          // close enough to really notice it, and looking more or less at it
          if (d > 4.5 || to.normalize().dot(fwd) < 0.88) continue
          if (!grid.sees(cam.position.x, cam.position.z, s.at.x, s.at.z, 0.4)) continue
          this.seen.add(s.line)
          say(copy.lines[s.line])
        }
        const zone = zoneAt(this.x, this.z)
        patchWorld({ place: zone.name })
        sfx.weather(this.weather.rain, this.weather.wind)
      }
      if (this.held) this.world.screens.tick()
    }

    // ---- the gate ----
    if (this.gateTween) {
      this.gateTween.t += dt / 2.6
      const k = Math.min(1, this.gateTween.t)
      this.gateT =
        k < 0.15
          ? (k / 0.15) ** 2 * 0.04
          : 0.04 + 0.96 * (1 - Math.pow(1 - (k - 0.15) / 0.85, 3))
      if (k >= 1) this.gateTween = null
    }
    this.world.gate.left.rotation.y = this.gateT * 1.62
    this.world.gate.right.rotation.y = -this.gateT * 1.58

    // ---- weather ----
    const target = zoneAt(this.x, this.z).weather
    const k = damp(0.6, dt)
    this.weather.rain += (target.rain - this.weather.rain) * k
    this.weather.fog += (target.fog - this.weather.fog) * k
    this.weather.storm += (target.storm - this.weather.storm) * k
    this.weather.wind += (target.wind - this.weather.wind) * k
    ;(this.world.scene.fog as THREE.FogExp2).density = this.weather.fog
    this.rain.uniforms.uDensity.value = this.weather.rain
    this.rain.uniforms.uWind.value = 0.08 + this.weather.wind * 0.22
    this.rain.uniforms.uTime.value = t % 1000
    this.rain.uniforms.uCam.value.copy(cam.position)
    shared.uWind.value = this.weather.wind
    this.sky.uniforms.uTime.value = t
    this.sky.uniforms.uClouds.value = 0.45 + this.weather.rain * 0.4
    this.sky.mesh.position.copy(cam.position)

    // ---- lightning ----
    if (t > this.nextStrike) {
      const perMinute = Math.max(0.2, this.weather.storm)
      this.nextStrike = t + 6 + (-Math.log(1 - Math.random()) * 60) / perMinute
      if (this.mode !== 'loading' && this.mode !== 'lost') strike()
    }
    const since = t - this.flashAt
    const env =
      since < 0.05
        ? 1
        : since < 0.1
          ? 0.2
          : since < 0.18
            ? 0.85
            : Math.max(0, Math.exp(-(since - 0.18) * 7) - 0.01)
    const fl = this.reduced ? 0 : env * this.flash
    this.sky.uniforms.uFlash.value = fl
    this.rain.uniforms.uFlash.value = fl
    this.post.uniforms.uFlash.value = fl
    this.hemi.intensity = 1.1 + fl * 5
    this.moon.intensity = 0.55 + fl * 2.5

    // ---- blood moon ----
    this.blood += ((modeStore.get() === 'bloodmoon' ? 1 : 0) - this.blood) * damp(1.5, dt)
    this.sky.uniforms.uBlood.value = this.blood
    this.post.uniforms.uBlood.value = this.blood
    for (const m of this.world.glassMats)
      m.color.setRGB(
        0.71 + this.blood * 0.3,
        0.6 - this.blood * 0.4,
        0.47 - this.blood * 0.3,
      )

    // ---- lights: your lantern, and the nearest lamps ----
    const flick = (seed: number) =>
      0.82 +
      (0.18 *
        Math.floor(
          (0.5 + 0.5 * Math.sin(t * 7.1 + seed) * Math.sin(t * 2.3 + seed * 3)) * 4,
        )) /
        4
    this.lantern.position.set(
      cam.position.x + rx * 0.35 - Math.sin(yaw) * 0.3,
      cam.position.y - 0.45,
      cam.position.z + rz * 0.35 - Math.cos(yaw) * 0.3,
    )
    this.lantern.intensity = 3.2 * flick(1.7)
    const lamps = this.world.lamps
      .map((l) => ({ l, d: l.distanceToSquared(cam.position) }))
      .sort((a, b) => a.d - b.d)
    this.pool.forEach((light, i) => {
      const l = lamps[i]
      if (!l) return void (light.intensity = 0)
      light.position.copy(l.l)
      light.intensity = 3 * flick(i * 3.1 + l.l.x)
    })
    for (const [i, f] of this.world.flames.entries())
      f.scale.set(1, 0.7 + flick(i * 1.3) * 0.5, 1)

    // ---- moving things ----
    for (const w of this.world.flowing) {
      if (w.userData.falling) w.offset.y = (t * 0.9) % 1
      else w.offset.set(Math.sin(t * 0.3) * 0.05, (t * 0.03) % 1)
    }
    this.world.mist.uniforms.uTime.value = t
    this.world.mist.uniforms.uDensity.value = this.weather.fog
    for (const [i, f] of this.world.floaters.entries()) {
      f.obj.position.y = f.y + Math.sin(t * 1.1 + i) * 0.07
      f.obj.rotation.y = f.yaw + Math.sin(t * 0.37 + i) * 0.22
      f.obj.rotation.z = Math.sin(t * 0.6 + i) * 0.04
    }
    this.updateCoin(dt)
    // the walkman's reels turn while it's playing
    if (playerStore.get().status === 'playing')
      this.world.walkman.traverse((o) => {
        if (o.name === 'reel') o.rotation.z -= dt * 5
      })
    if (this.held) {
      const w = this.world.walkman
      const bobM = new THREE.Matrix4().makeTranslation(sway * 0.4, bobY * 0.5, 0)
      w.matrix.copy(cam.matrixWorld).multiply(bobM).multiply(this.holdOffset)
      w.matrixWorldNeedsUpdate = true
    }

    // ---- post ----
    this.fade +=
      (this.fadeTarget - this.fade) * damp(this.fadeTarget > this.fade ? 1.6 : 30, dt)
    this.post.uniforms.uFade.value = this.fade
    this.post.uniforms.uTime.value = t
    this.post.uniforms.uFocus.value +=
      ((this.mode === 'paused' ? 1 : 0) - this.post.uniforms.uFocus.value) * damp(3, dt)

    if (worldStore.get().mode !== this.mode) patchWorld({ mode: this.mode })
  }

  private updateCoin(dt: number) {
    const c = this.coin
    if (c) {
      c.t += dt
      const t = Math.min(c.t, c.T)
      c.mesh.position.set(
        c.from.x + c.vel.x * t,
        c.from.y + c.vel.y * t - 4.9 * t * t,
        c.from.z + c.vel.z * t,
      )
      c.mesh.rotation.x += dt * 22
      c.mesh.rotation.z += dt * 9
      if (c.t >= c.T) {
        c.mesh.removeFromParent()
        c.mesh.geometry.dispose()
        this.coin = null
        c.done()
      }
    }
    const s = this.splash
    if (s) {
      s.t += dt
      const pos = s.points.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        s.vel[i * 3 + 1] -= 9.8 * dt
        pos.setXYZ(
          i,
          pos.getX(i) + s.vel[i * 3] * dt,
          Math.max(0.46, pos.getY(i) + s.vel[i * 3 + 1] * dt),
          pos.getZ(i) + s.vel[i * 3 + 2] * dt,
        )
      }
      pos.needsUpdate = true
      ;(s.points.material as THREE.PointsMaterial).opacity = Math.max(0, 0.9 - s.t * 1.4)
      s.ring.scale.setScalar(1 + s.t * 3.5)
      ;(s.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.35 - s.t * 0.35,
      )
      if (s.t > 1.1) this.endSplash()
    }
  }

  private render() {
    const r = this.renderer
    r.setRenderTarget(this.post.target)
    r.clear()
    r.render(this.world.scene, this.camera)
    if (this.held) {
      r.clearDepth()
      r.render(this.viewScene, this.camera)
    }
    r.setRenderTarget(null)
    r.clear()
    this.post.render(r)
  }
}

function anyOf(keys: Set<string>, codes: Set<string>) {
  for (const c of codes) if (keys.has(c)) return true
  return false
}
