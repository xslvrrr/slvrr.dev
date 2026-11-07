import { soundStore } from './store'

/**
 * Tiny synthesized sounds (no audio files): a church bell, thunder, an organ
 * swell. Browsers only allow audio after a user gesture, which is why the
 * splash screen asks for a click first.
 */
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio() {
  if (!soundStore.get()) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  freq: number,
  start: number,
  dur: number,
  gain: number,
  type: OscillatorType,
  attack = 0.01,
) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** A bell: inharmonic partials (hum, prime, minor third, fifth, nominal...) that decay at different rates. */
function bell(fundamental: number, start: number, gain: number) {
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
    tone(fundamental * ratio, start, dur, gain * level, 'sine', 0.004)
  }
}

export const sfx = {
  /** A church bell tolls as the doors open. */
  enter() {
    bell(196, 0, 0.05)
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
  /** An organ swell for the footer's "ascend" transition. */
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
  thunder(delay = 0.3) {
    const a = audio()
    if (!a) return
    if (!noise) {
      noise = a.createBuffer(1, a.sampleRate * 4, a.sampleRate)
      const d = noise.getChannelData(0)
      let last = 0
      // Brown-ish noise: deep and rumbly rather than hissy.
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04
        d[i] = last * 3.5
      }
    }
    const t = a.currentTime + delay
    const src = a.createBufferSource()
    src.buffer = noise
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(120, t + 2.5)
    const g = a.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.5)
    g.gain.linearRampToValueAtTime(0.11, t + 1.1)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
    src.connect(lp).connect(g).connect(a.destination)
    src.start(t)
    src.stop(t + 3.8)
  },
}
