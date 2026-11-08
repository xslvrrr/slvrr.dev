import { soundStore } from './store'

/**
 * Every sound on the site is synthesized with WebAudio; there are no audio
 * files. Browsers only allow audio after a user gesture, which is why the
 * gate asks for a click first.
 *
 * - one-shots: footsteps in wet grass, the gate's hinges, a church bell,
 *   thunder, cloth rustling as you turn, UI ticks
 * - an ambience bed that starts once you're through the gate: wind in the
 *   hedges, rain, a low drone, crickets, now and then an owl or a far bell
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let brown: AudioBuffer | null = null
let steps: AudioBuffer[] = []
let creak: AudioBuffer | null = null

function ensure() {
  if (ctx) return ctx
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = soundStore.get() ? 1 : 0
  // a gentle limiter so stacked sounds never clip
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -10
  comp.ratio.value = 6
  master.connect(comp).connect(ctx.destination)
  noise = makeNoise(ctx, 3, 'white')
  brown = makeNoise(ctx, 6, 'brown')
  steps = Array.from({ length: 8 }, (_, i) => makeStep(ctx!, i))
  creak = makeCreak(ctx)
  return ctx
}

/** The context, if sound is on. Creating it needs a prior user gesture. */
function audio() {
  if (!soundStore.get()) return null
  const a = ensure()
  if (a.state === 'suspended') void a.resume()
  return a
}

soundStore.subscribe(() => {
  if (!ctx || !master) return
  const on = soundStore.get()
  master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.08)
  if (on) void ctx.resume()
})

function makeNoise(a: AudioContext, seconds: number, kind: 'white' | 'brown') {
  const buf = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w
    else {
      last = (last + 0.04 * w) / 1.04
      d[i] = last * 3.5
    }
  }
  return buf
}

/**
 * One footstep in long wet grass: a heel strike, the roll onto the toe, blades
 * snapping (sparse clicks) and the brush of grass against the shoe.
 */
function makeStep(a: AudioContext, seed: number) {
  const sr = a.sampleRate
  const len = Math.floor(sr * 0.38)
  const buf = a.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  let s = seed * 9301 + 49297
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280
  const toeAt = 0.06 + rand() * 0.05
  let crackle = 0
  let hp = 0
  let prev = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const heel = t < 0.005 ? t / 0.005 : Math.exp(-(t - 0.005) / 0.03)
    const toe =
      t < toeAt
        ? 0
        : Math.min(1, (t - toeAt) / 0.008) * Math.exp(-(t - toeAt) / 0.045) * 0.7
    const env = heel + toe
    const brush = Math.exp(-t / 0.13) * 0.18
    if (rand() < env * 0.09) crackle += (rand() * 2 - 1) * 1.4
    crackle *= 0.55
    const x = (rand() * 2 - 1) * (env * 0.55 + brush) + crackle * env
    // one-pole high-pass to keep it light, like grass rather than gravel
    hp = 0.92 * (hp + x - prev)
    prev = x
    d[i] = hp
  }
  return buf
}

/** Stick-slip squeal of old iron hinges, with the irregular judder of a heavy gate. */
function makeCreak(a: AudioContext) {
  const sr = a.sampleRate
  const len = Math.floor(sr * 2.4)
  const buf = a.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  let phase = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    // the rate of slips wanders, rising and falling as the gate swings
    const rate =
      26 +
      34 * Math.sin(t * 1.9) ** 2 +
      14 * Math.sin(t * 7.3) +
      (Math.random() - 0.5) * 18
    phase += rate / sr
    let v = 0
    if (phase >= 1) {
      phase -= 1
      v = 1
    }
    const env = Math.min(1, t / 0.15) * (t < 1.9 ? 1 : Math.max(0, 1 - (t - 1.9) / 0.5))
    d[i] = v * env * (0.6 + Math.random() * 0.4)
  }
  return buf
}

function play(
  buf: AudioBuffer,
  {
    at = 0,
    gain = 1,
    rate = 1,
    pan = 0,
    filters = [] as BiquadFilterNode[],
  }: {
    at?: number
    gain?: number
    rate?: number
    pan?: number
    filters?: BiquadFilterNode[]
  } = {},
) {
  const a = audio()
  if (!a || !master) return null
  const src = a.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate
  const g = a.createGain()
  g.gain.value = gain
  let node: AudioNode = src
  for (const f of filters) node = node.connect(f)
  const p = a.createStereoPanner()
  p.pan.value = pan
  node.connect(g).connect(p).connect(master)
  src.start(a.currentTime + at)
  return { src, gain: g }
}

function filter(type: BiquadFilterType, freq: number, Q = 0.7) {
  const f = ctx!.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = Q
  return f
}

function tone(
  freq: number,
  start: number,
  dur: number,
  gain: number,
  type: OscillatorType,
  attack = 0.01,
  pan = 0,
) {
  const a = audio()
  if (!a || !master) return
  const t = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  const p = a.createStereoPanner()
  p.pan.value = pan
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(p).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** A bell: inharmonic partials (hum, prime, minor third, fifth, nominal...) that decay at different rates. */
function bell(fundamental: number, start: number, gain: number, pan = 0) {
  const partials: [number, number, number][] = [
    [0.5, 1, 4.5],
    [1, 0.8, 3.5],
    [1.2, 0.55, 2.8],
    [1.5, 0.35, 2.2],
    [2, 0.5, 2],
    [2.74, 0.2, 1.4],
    [3.4, 0.12, 1],
  ]
  for (const [ratio, level, dur] of partials) {
    tone(fundamental * ratio, start, dur, gain * level, 'sine', 0.004, pan)
  }
}

/** A short metallic clank (the gate leaves knocking against their stops). */
function clank(at: number, gain: number, pan = 0) {
  for (const [f, l, d] of [
    [523, 1, 0.5],
    [1231, 0.6, 0.35],
    [2207, 0.4, 0.25],
    [3170, 0.25, 0.18],
  ] as const)
    tone(f * (0.97 + Math.random() * 0.06), at, d, gain * l, 'triangle', 0.002, pan)
  if (noise)
    play(noise, { at, gain: gain * 2, filters: [filter('bandpass', 2600, 2)] })?.src.stop(
      ctx!.currentTime + at + 0.05,
    )
}

// ---------------------------------------------------------------- ambience

interface Bed {
  wind: GainNode
  windFilter: BiquadFilterNode
  rain: GainNode
  drone: GainNode
}
let bed: Bed | null = null
let weather = { rain: 0.5, wind: 0.5 }
const timers: number[] = []

function startBed(a: AudioContext) {
  if (bed || !master || !brown || !noise) return
  const loop = (buf: AudioBuffer) => {
    const s = a.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.start()
    return s
  }
  // wind: brown noise through a wandering band-pass, in gusts
  const windFilter = filter('bandpass', 420, 0.6)
  const wind = a.createGain()
  wind.gain.value = 0
  loop(brown).connect(windFilter).connect(wind).connect(master)
  // rain: hiss, high and soft
  const rain = a.createGain()
  rain.gain.value = 0
  loop(noise)
    .connect(filter('highpass', 1400))
    .connect(filter('lowpass', 7000))
    .connect(rain)
    .connect(master)
  // a low drone, two sines beating slowly against each other
  const drone = a.createGain()
  drone.gain.value = 0
  const lp = filter('lowpass', 260)
  lp.connect(drone).connect(master)
  for (const [f, type, lvl] of [
    [48.9, 'sine', 1],
    [49.25, 'sine', 1],
    [73.4, 'triangle', 0.35],
  ] as const) {
    const o = a.createOscillator()
    o.type = type
    o.frequency.value = f
    const g = a.createGain()
    g.gain.value = lvl
    o.connect(g).connect(lp)
    o.start()
  }
  drone.gain.setTargetAtTime(0.03, a.currentTime, 3)
  bed = { wind, windFilter, rain, drone }
  applyWeather()

  // gusts
  timers.push(
    window.setInterval(() => {
      if (!bed || !ctx) return
      const t = ctx.currentTime
      const g = (0.05 + weather.wind * 0.12) * (0.5 + Math.random())
      bed.wind.gain.setTargetAtTime(g, t, 1.2)
      bed.windFilter.frequency.setTargetAtTime(
        250 + Math.random() * 600 * (0.5 + weather.wind),
        t,
        1.5,
      )
    }, 2600),
  )
  // crickets, here and there in the grass
  const chirp = () => {
    if (audio()) {
      const pan = Math.random() * 1.6 - 0.8
      const f = 4100 + Math.random() * 500
      const n = 2 + Math.floor(Math.random() * 3)
      for (let r = 0; r < 1 + Math.floor(Math.random() * 3); r++)
        for (let i = 0; i < n; i++)
          tone(f, r * 0.42 + i * 0.055, 0.035, 0.004, 'sine', 0.005, pan)
    }
    timers.push(window.setTimeout(chirp, 1800 + Math.random() * 5200))
  }
  timers.push(window.setTimeout(chirp, 3000))
  // an owl, far off
  const owl = () => {
    if (audio() && ctx && master) {
      const pan = Math.random() * 1.4 - 0.7
      ;[0, 0.55, 0.85].forEach((at, i) => {
        const t = ctx!.currentTime + at
        const o = ctx!.createOscillator()
        const g = ctx!.createGain()
        const p = ctx!.createStereoPanner()
        p.pan.value = pan
        o.frequency.setValueAtTime(i === 0 ? 370 : 350, t)
        o.frequency.exponentialRampToValueAtTime(i === 0 ? 330 : 300, t + 0.35)
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.012, t + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 0 ? 0.45 : 0.6))
        o.connect(g).connect(p).connect(master!)
        o.start(t)
        o.stop(t + 0.7)
      })
    }
    timers.push(window.setTimeout(owl, 35000 + Math.random() * 50000))
  }
  timers.push(window.setTimeout(owl, 20000 + Math.random() * 20000))
  // the cathedral bell, very far away
  const far = () => {
    if (audio()) bell(110, 0, 0.012, -0.2)
    timers.push(window.setTimeout(far, 90000 + Math.random() * 90000))
  }
  timers.push(window.setTimeout(far, 60000))
}

function applyWeather() {
  if (!bed || !ctx) return
  const t = ctx.currentTime
  bed.rain.gain.setTargetAtTime(0.012 + weather.rain * 0.05, t, 1.5)
  bed.wind.gain.setTargetAtTime(0.05 + weather.wind * 0.1, t, 1.5)
}

export const sfx = {
  /** A church bell tolls (the gate, and the end of "ascend"). */
  enter() {
    bell(196, 0, 0.05)
  },
  /** The gate: latch, hinges groaning as the leaves swing in, a clank as they stop. */
  gate() {
    const a = audio()
    if (!a || !creak) return
    clank(0, 0.02)
    for (const [pan, rate, delay] of [
      [-0.45, 1, 0.1],
      [0.45, 0.93, 0.22],
    ] as const) {
      play(creak, {
        at: delay,
        gain: 0.5,
        rate,
        pan,
        filters: [filter('bandpass', 640 * rate, 9), filter('peaking', 1300, 6)],
      })
      play(creak, {
        at: delay,
        gain: 0.22,
        rate: rate * 1.02,
        pan,
        filters: [filter('bandpass', 1450 * rate, 14)],
      })
    }
    clank(2.45, 0.03, -0.4)
    clank(2.6, 0.025, 0.4)
  },
  /** One footstep in the grass. `pan` alternates feet; `weight` is louder when hurrying. */
  step(pan = 0, weight = 1) {
    const a = audio()
    if (!a || !steps.length) return
    const buf = steps[Math.floor(Math.random() * steps.length)]
    play(buf, {
      gain: 0.32 * weight * (0.8 + Math.random() * 0.4),
      rate: 0.85 + Math.random() * 0.3,
      pan,
      filters: [
        filter('bandpass', 1900 + Math.random() * 1400, 0.6),
        filter('lowpass', 7500),
      ],
    })
    // a soft thud of weight landing
    if (brown)
      play(brown, { gain: 0.35 * weight, filters: [filter('lowpass', 160)] })?.src.stop(
        a.currentTime + 0.07,
      )
  },
  /** Coat and grass rustling as you turn to look at something. */
  turn() {
    const a = audio()
    if (!a || !noise) return
    const bp = filter('bandpass', 700, 0.9)
    bp.frequency.setValueAtTime(600, a.currentTime)
    bp.frequency.exponentialRampToValueAtTime(1800, a.currentTime + 0.35)
    const s = play(noise, { gain: 0, filters: [bp] })
    if (!s) return
    s.gain.gain.setValueAtTime(0, a.currentTime)
    s.gain.gain.linearRampToValueAtTime(0.06, a.currentTime + 0.12)
    s.gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.45)
    s.src.stop(a.currentTime + 0.5)
  },
  /** Starts the ambience (call from a user gesture). */
  ambience() {
    const a = audio()
    if (a) startBed(a)
  },
  /** Blend the ambience towards a station's weather. */
  weather(rain: number, wind: number) {
    weather = { rain, wind }
    applyWeather()
  },
  /** Soft candle-tick for hovers. */
  tick() {
    tone(1500 + Math.random() * 300, 0, 0.06, 0.012, 'triangle')
  },
  /** A small chime for presses. */
  click() {
    tone(660, 0, 0.18, 0.03, 'triangle')
    tone(1320, 0.015, 0.14, 0.012, 'sine')
  },
  /** An organ swell for the footer's "return to the gate". */
  resurface() {
    const a = audio()
    if (!a) return
    // D minor rising to D major: a small Picardy third on the way up.
    ;[146.83, 220, 293.66, 349.23].forEach((f) => tone(f, 0, 1.3, 0.016, 'square', 0.35))
    ;[293.66, 369.99, 440, 587.33].forEach((f) =>
      tone(f, 0.9, 1.1, 0.018, 'triangle', 0.08),
    )
  },
  /** Blood moon: a descending minor arpeggio and a low bell. */
  unlock() {
    ;[880, 698.46, 587.33, 440, 349.23].forEach((f, i) =>
      tone(f, i * 0.09, 0.6, 0.04, 'triangle'),
    )
    bell(98, 0.45, 0.05)
  },
  /** Thunder: a crack, then filtered noise rolling away. */
  thunder(delay = 0.3, loud = 1) {
    const a = audio()
    if (!a || !brown || !master) return
    const t = a.currentTime + delay
    const src = a.createBufferSource()
    src.buffer = brown
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(120, t + 2.5)
    const g = a.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22 * loud, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.08 * loud, t + 0.5)
    g.gain.linearRampToValueAtTime(0.11 * loud, t + 1.1)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
    src.connect(lp).connect(g).connect(master)
    src.start(t)
    src.stop(t + 3.8)
  },
}
