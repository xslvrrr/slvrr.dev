import * as THREE from 'three'
import { sfx } from '@/lib/sfx'
import { onStrike, strike } from '@/lib/storm'
import { modeStore } from '@/lib/store'
import { buildWorld, type World } from './build'
import { shared } from './materials'
import { yawTo } from './path'
import { createPost } from './post'
import { createRain, createSky, FOG_COLOR, MOON_DIR } from './sky'
import { patchWorld, worldStore, type Mode } from './state'
import { stations, type V2, type Weather } from './stations'

const EYE = 1.62
const LAST = stations.length - 1
const POOL = 4

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt)
const angleDiff = (a: number, b: number) => {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** One scene pixel per `n` CSS pixels: ~260 rows tall, chunky but legible. */
function pixelSize() {
  return Math.min(4, Math.max(2, Math.round(window.innerHeight / 260)))
}

interface WalkTween {
  kind: 'walk'
  s0: number
  s1: number
  t: number
  T: number
  ta: number
  td: number
  v: number
  done: () => void
}
interface MoveTween {
  kind: 'move'
  from: V2
  to: V2
  t: number
  T: number
  done: () => void
}

/**
 * Runs the first-person walk: renders the churchyard small and pixelated,
 * moves the camera along the path between stations (with head bob and a
 * footstep per stride), turns it towards points of interest, and drives the
 * storm. React talks to it through the methods below and listens through
 * `worldStore`.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.05, 900)
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
  private sStations: number[] = []
  private raycaster = new THREE.Raycaster()

  // where you are
  private s = 0
  private p: V2 = [0, 0]
  private yaw = 0
  private pitch = 0
  private yawTarget = 0
  private pitchTarget = 0
  private look = { x: 0, y: 0, tx: 0, ty: 0 }
  private tween: WalkTween | MoveTween | null = null
  private seq = 0
  private backwards = false
  private mode: Mode = 'loading'
  private station = 0

  // the body
  private travelled = 0
  private stride = 1.2
  private lastStep = 0
  private foot = 1
  private bob = 0
  private weight = 1

  // the world
  private weather: Weather = { ...stations[0].weather }
  private gateT = 0
  private gateTween: { t: number } | null = null
  private flash = 0
  private flashAt = -10
  private nextStrike = 8
  private blood = 0
  private shift = { x: 0, y: 0 }
  private fade = 0
  private fadeTarget = 1
  private time = 0
  private last = 0
  private raf = 0
  private soundTimer = 0
  private disposers: (() => void)[] = []
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.camera.rotation.order = 'YXZ'
  }

  async init(start: number) {
    patchWorld({ progress: 0.15 })
    // the signs are painted in the pixel font, so it has to be loaded first
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
    const { scene, walk } = this.world
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
    this.sStations = stations.map((st) => walk.project(st.at))

    this.resize()
    const onResize = () => this.resize()
    window.addEventListener('resize', onResize)
    this.disposers.push(() => window.removeEventListener('resize', onResize))
    this.disposers.push(onStrike((x, loud) => this.lightning(loud ? 1 : 0.6, loud, x)))
    const onVis = () => {
      if (!document.hidden) this.last = performance.now()
    }
    document.addEventListener('visibilitychange', onVis)
    this.disposers.push(() => document.removeEventListener('visibilitychange', onVis))

    if (start > 0) {
      this.gateT = 1
      this.placeAt(start)
      this.setMode('idle')
    } else {
      this.placeAt(0)
      this.setMode('gate')
    }
    // warm the shaders up before the first visible frame
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

  /** Open the gate and walk in. Must be called from a click (it starts the audio). */
  enter(then?: number) {
    if (this.mode !== 'gate') return
    sfx.ambience()
    sfx.gate()
    sfx.enter()
    this.setMode('opening')
    this.gateTween = { t: 0 }
    const id = ++this.seq
    window.setTimeout(async () => {
      if (id !== this.seq) return
      await this.walkTo(1)
      if (then !== undefined && then > 1 && id === this.seq) await this.travel(then, true)
    }, 1300)
  }

  forward() {
    if (this.mode === 'idle' && this.station < LAST)
      void this.travel(this.station + 1, false)
  }

  back() {
    if (this.mode === 'idle' && this.station > 1)
      void this.travel(this.station - 1, false)
  }

  /** Walk to station `i` (through the ones in between), then look at its point of interest. */
  async travel(i: number, lookAfter = true) {
    if (this.mode === 'gate' || this.mode === 'opening' || this.mode === 'loading') return
    i = Math.max(1, Math.min(LAST, i))
    const id = ++this.seq
    if (this.mode === 'reading' || this.mode === 'turning') {
      if (this.station === i && lookAfter && stations[i].poi) {
        if (this.mode === 'reading') return
      }
      await this.unlook()
      if (id !== this.seq) return
    }
    if (this.station !== i || Math.abs(this.s - this.sStations[i]) > 0.05) {
      await this.walkTo(i)
      if (id !== this.seq) return
    }
    if (lookAfter && stations[i].poi) await this.lookAt()
  }

  /** Turn to the current station's point of interest. */
  async lookAt() {
    const st = stations[this.station]
    if (!st.poi || this.mode === 'reading') return
    const id = ++this.seq
    this.setMode('turning')
    sfx.turn()
    const from = st.poi.from ?? st.at
    this.yawTarget = yawTo(from[0], from[1], st.poi.look[0], st.poi.look[2])
    const dist = Math.hypot(st.poi.look[0] - from[0], st.poi.look[2] - from[1])
    this.pitchTarget = Math.atan2(st.poi.look[1] - EYE, dist) * 0.85
    await this.moveTo(from, this.reduced ? 0.3 : 1.0)
    if (id === this.seq) this.setMode('reading')
  }

  /** Step back from a point of interest onto the path. */
  async unlook() {
    if (this.mode !== 'reading' && this.mode !== 'turning') return
    const id = ++this.seq
    this.setMode('turning')
    sfx.turn()
    this.yawTarget = this.world.walk.heading(this.s)
    this.pitchTarget = 0
    await this.moveTo(this.world.walk.at(this.s), this.reduced ? 0.25 : 0.8)
    if (id === this.seq) this.setMode('idle')
  }

  /** Fade out, appear at station `i`, fade in (for "return to the gate"). */
  async teleport(i: number) {
    ++this.seq
    this.fadeTarget = 0
    await new Promise((r) => setTimeout(r, 700))
    this.tween?.done()
    this.tween = null
    this.placeAt(i)
    this.setMode('idle')
    this.fadeTarget = 1
  }

  /** Where the pointer is, as -1..1 from the centre, for looking around. */
  pointer(nx: number, ny: number) {
    if (this.reduced) return
    this.look.tx = -nx * 0.2
    this.look.ty = -ny * 0.1
  }

  /**
   * What's under the pointer: a station whose point of interest you can see
   * from here, 'sky' (click to call the lightning), or null.
   */
  pick(clientX: number, clientY: number): number | 'sky' | null {
    if (!this.world) return null
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const candidates = this.world.hits.filter((h) => {
      const i = h.userData.station as number
      return i === this.station || (i === this.station + 1 && this.mode === 'idle')
    })
    const hit = this.raycaster.intersectObjects(candidates, false)[0]
    if (hit) {
      const i = hit.object.userData.station as number
      if (i === this.station) return i
      const block = this.raycaster.intersectObjects(this.world.occluders, false)[0]
      if (!block || block.distance > hit.distance) return hit.distance < 16 ? i : null
      return null
    }
    if (this.raycaster.ray.direction.y > 0.12) {
      const block = this.raycaster.intersectObjects(this.world.occluders, false)[0]
      if (!block) return 'sky'
    }
    return null
  }

  // ------------------------------------------------------------ internals

  private setMode(mode: Mode) {
    this.mode = mode
    patchWorld({ mode, station: this.station })
  }

  private placeAt(i: number) {
    this.station = i
    this.s = this.sStations[i]
    this.p = this.world.walk.at(this.s)
    if (i === 0) {
      this.yaw = this.yawTarget = 0
      this.pitch = this.pitchTarget = 0.06
    } else {
      this.yaw = this.yawTarget = this.world.walk.heading(this.s)
      this.pitch = this.pitchTarget = 0
    }
    this.weather = { ...stations[i].weather }
    sfx.weather(this.weather.rain, this.weather.wind)
    patchWorld({ station: i })
  }

  private walkTo(i: number) {
    return new Promise<void>((resolve) => {
      this.tween?.done()
      const s0 = this.s
      const s1 = this.sStations[i]
      const d = Math.abs(s1 - s0)
      if (d < 0.01) {
        this.station = i
        resolve()
        return
      }
      // brisk but unhurried; long stretches go faster so no walk drags on
      const v = this.reduced ? 9 : Math.min(7, Math.max(2.9, d / 4.2))
      const ta = Math.min(0.6, d / v / 3)
      const td = Math.min(0.8, d / v / 3)
      this.backwards = s1 < s0
      this.stride = 0.75 + v * 0.17
      this.weight = Math.min(1.5, 0.7 + v * 0.12)
      this.tween = {
        kind: 'walk',
        s0,
        s1,
        t: 0,
        T: d / v + (ta + td) / 2,
        ta,
        td,
        v,
        done: () => {
          this.station = i
          resolve()
        },
      }
      this.setMode('walking')
      this.station = i
      patchWorld({ station: i, hover: null })
    }).then(() => {
      // (unless another walk has already taken over)
      if (this.mode === 'walking' && !this.tween) {
        this.backwards = false
        this.setMode('idle')
      }
    })
  }

  private moveTo(to: V2, T: number) {
    return new Promise<void>((resolve) => {
      this.tween?.done()
      this.tween = {
        kind: 'move',
        from: [this.p[0], this.p[1]],
        to,
        t: 0,
        T,
        done: resolve,
      }
      this.stride = 0.7
      this.weight = 0.6
    })
  }

  /** Distance along a trapezoidal velocity profile: speed up, cruise, slow down. */
  private profile(w: WalkTween) {
    const { t, T, ta, td, v } = w
    const d = Math.abs(w.s1 - w.s0)
    // scale so the profile covers exactly d
    const vmax = d / (T - (ta + td) / 2)
    void v
    let x: number
    if (t < ta) x = (0.5 * vmax * t * t) / ta
    else if (t < T - td) x = 0.5 * vmax * ta + vmax * (t - ta)
    else {
      const u = Math.min(td, t - (T - td))
      x = 0.5 * vmax * ta + vmax * (T - td - ta) + vmax * u - (0.5 * vmax * u * u) / td
    }
    return Math.min(d, x)
  }

  private lightning(power: number, loud: boolean, x = Math.random()) {
    this.flashAt = this.time
    this.flash = power
    void x
    const delay = loud ? 0.25 : 0.6 + Math.random() * 2.2
    sfx.thunder(delay, loud ? 1 : 0.6 + Math.random() * 0.3)
  }

  private resize() {
    const px = pixelSize()
    const w = Math.ceil(window.innerWidth / px)
    const h = Math.ceil(window.innerHeight / px)
    this.renderer.setSize(w, h, false)
    this.post.setSize(w, h)
    this.camera.aspect = w / h
    // keep at least ~52° across on tall phone screens, so the hedges still
    // frame the path instead of filling the view
    const minH = THREE.MathUtils.degToRad(52)
    const v = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(minH / 2) / this.camera.aspect),
    )
    this.camera.fov = Math.min(88, Math.max(62, v))
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
    const { walk } = this.world
    const t = this.time
    shared.uTime.value = t

    // ---- movement ----
    let moved = 0
    const tw = this.tween
    if (tw?.kind === 'walk') {
      tw.t += dt
      const x = this.profile(tw)
      const s = tw.s0 + Math.sign(tw.s1 - tw.s0) * x
      moved = Math.abs(s - this.s)
      this.s = s
      this.p = walk.at(s)
      this.yawTarget = walk.heading(s) + (this.backwards ? Math.PI : 0)
      this.pitchTarget = 0
      if (tw.t >= tw.T) {
        this.tween = null
        if (this.backwards) this.yawTarget = walk.heading(this.s)
        tw.done()
      }
    } else if (tw?.kind === 'move') {
      tw.t += dt
      const k = easeInOut(Math.min(1, tw.t / tw.T))
      const nx = tw.from[0] + (tw.to[0] - tw.from[0]) * k
      const nz = tw.from[1] + (tw.to[1] - tw.from[1]) * k
      moved = Math.hypot(nx - this.p[0], nz - this.p[1])
      this.p = [nx, nz]
      if (tw.t >= tw.T) {
        this.tween = null
        tw.done()
      }
    }
    if (this.mode === 'idle')
      this.yawTarget = this.station === 0 ? 0 : walk.heading(this.s)

    // ---- the body: footsteps and head bob ----
    this.travelled += moved
    const phase = (this.travelled / this.stride) * Math.PI
    const stepIndex = Math.floor(phase / Math.PI + 0.5)
    if (stepIndex !== this.lastStep) {
      this.lastStep = stepIndex
      this.foot = -this.foot
      sfx.step(this.foot * 0.22, this.weight)
    }
    const walking = moved > 0.0005
    const bobTarget = walking && !this.reduced ? 1 : 0
    this.bob += (bobTarget - this.bob) * damp(walking ? 6 : 3, dt)
    const bobY = -Math.abs(Math.sin(phase)) * 0.055 * this.bob + 0.02 * this.bob
    const sway = Math.sin(phase) * 0.025 * this.bob
    const roll = Math.sin(phase) * 0.008 * this.bob
    const breathe = this.reduced ? 0 : Math.sin(t * 1.35) * 0.006

    // ---- where you look ----
    const reading = this.mode === 'reading' || this.mode === 'turning'
    this.yaw +=
      angleDiff(this.yawTarget, this.yaw) * damp(this.mode === 'walking' ? 4.5 : 4, dt)
    this.pitch += (this.pitchTarget - this.pitch) * damp(4, dt)
    const lookScale = reading ? 0.3 : 1
    this.look.x += (this.look.tx * lookScale - this.look.x) * damp(3, dt)
    this.look.y += (this.look.ty * lookScale - this.look.y) * damp(3, dt)

    const yaw = this.yaw + this.look.x
    const cam = this.camera
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    cam.position.set(this.p[0] + rx * sway, EYE + bobY + breathe, this.p[1] + rz * sway)
    cam.rotation.set(this.pitch + this.look.y + bobY * 0.15, yaw, roll)

    // shift the picture aside while reading, so the thing you're looking at
    // sits beside the panel instead of under it
    const wide = window.innerWidth >= 900
    const sx = this.mode === 'reading' && wide ? 0.24 : 0
    const sy = this.mode === 'reading' && !wide ? 0.25 : 0
    this.shift.x += (sx - this.shift.x) * damp(3.5, dt)
    this.shift.y += (sy - this.shift.y) * damp(3.5, dt)
    const W = this.post.uniforms.uRes.value.x
    const H = this.post.uniforms.uRes.value.y
    if (Math.abs(this.shift.x) + Math.abs(this.shift.y) > 0.001)
      cam.setViewOffset(W, H, this.shift.x * W, this.shift.y * H, W, H)
    else if (cam.view) cam.clearViewOffset()

    // ---- the gate ----
    if (this.gateTween) {
      this.gateTween.t += dt / 2.6
      const k = Math.min(1, this.gateTween.t)
      // heavy: slow to start, swings, settles
      this.gateT =
        k < 0.15
          ? (k / 0.15) ** 2 * 0.04
          : 0.04 + 0.96 * (1 - Math.pow(1 - (k - 0.15) / 0.85, 3))
      if (k >= 1) this.gateTween = null
    }
    this.world.gate.left.rotation.y = this.gateT * 1.75
    this.world.gate.right.rotation.y = -this.gateT * 1.65

    // ---- weather ----
    const near = this.sStations.reduce(
      (best, s, i) =>
        Math.abs(s - this.s) < Math.abs(this.sStations[best] - this.s) ? i : best,
      0,
    )
    const target = stations[near].weather
    const k = damp(0.6, dt)
    this.weather.rain += (target.rain - this.weather.rain) * k
    this.weather.fog += (target.fog - this.weather.fog) * k
    this.weather.storm += (target.storm - this.weather.storm) * k
    this.weather.wind += (target.wind - this.weather.wind) * k
    ;(this.world.scene.fog as THREE.FogExp2).density = this.weather.fog
    this.rain.uniforms.uDensity.value = this.weather.rain
    this.rain.uniforms.uWind.value = 0.08 + this.weather.wind * 0.22
    this.rain.uniforms.uTime.value = t
    this.rain.uniforms.uCam.value.copy(cam.position)
    shared.uWind.value = this.weather.wind
    this.sky.uniforms.uTime.value = t
    this.sky.uniforms.uClouds.value = 0.45 + this.weather.rain * 0.4
    this.sky.mesh.position.copy(cam.position)
    this.soundTimer -= dt
    if (this.soundTimer <= 0) {
      this.soundTimer = 1
      sfx.weather(this.weather.rain, this.weather.wind)
    }

    // ---- lightning ----
    if (t > this.nextStrike) {
      const perMinute = Math.max(0.2, this.weather.storm)
      this.nextStrike = t + 6 + (-Math.log(1 - Math.random()) * 60) / perMinute
      if (this.mode !== 'loading') strike()
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
    const f = this.reduced ? 0 : env * this.flash
    this.sky.uniforms.uFlash.value = f
    this.rain.uniforms.uFlash.value = f
    this.post.uniforms.uFlash.value = f
    this.hemi.intensity = 1.1 + f * 5
    this.moon.intensity = 0.55 + f * 2.5

    // ---- blood moon ----
    this.blood += ((modeStore.get() === 'bloodmoon' ? 1 : 0) - this.blood) * damp(1.5, dt)
    this.sky.uniforms.uBlood.value = this.blood
    this.post.uniforms.uBlood.value = this.blood

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
      if (!l) {
        light.intensity = 0
        return
      }
      light.position.copy(l.l)
      light.intensity = 3 * flick(i * 3.1 + l.l.x)
    })
    for (const [i, fl] of this.world.flames.entries()) {
      const v = flick(i * 1.3)
      fl.scale.set(1, 0.7 + v * 0.5, 1)
    }

    // ---- water and mist ----
    for (const w of this.world.flowing) {
      if (w.userData.falling) w.offset.y = (t * 0.9) % 1
      else w.offset.set(Math.sin(t * 0.3) * 0.05, (t * 0.03) % 1)
    }
    this.world.mist.uniforms.uTime.value = t
    this.world.mist.uniforms.uDensity.value = this.weather.fog

    // ---- post ----
    this.fade +=
      (this.fadeTarget - this.fade) * damp(this.fadeTarget > this.fade ? 1.6 : 5, dt)
    this.post.uniforms.uFade.value = this.fade
    this.post.uniforms.uTime.value = t
    this.post.uniforms.uFocus.value +=
      ((reading ? 1 : 0) - this.post.uniforms.uFocus.value) * damp(3, dt)
    for (const m of this.world.glassMats)
      m.color.setRGB(
        0.71 + this.blood * 0.3,
        0.6 - this.blood * 0.4,
        0.47 - this.blood * 0.3,
      )

    if (worldStore.get().mode !== this.mode) patchWorld({ mode: this.mode })
  }

  private render() {
    this.renderer.setRenderTarget(this.post.target)
    this.renderer.render(this.world.scene, this.camera)
    this.post.render(this.renderer)
  }
}
