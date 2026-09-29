import { soundStore } from './store'

/**
 * Tiny synthesized UI sounds (no audio files). Browsers only allow audio after a
 * user gesture, which is why the splash screen asks for a click first.
 */
let ctx: AudioContext | null = null

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
) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

export const sfx = {
  /** Shimmering chord for the splash "enter". */
  enter() {
    ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone(f, i * 0.06, 1.6, 0.05, 'sine'),
    )
  },
  /** Soft glassy tick for hovers. */
  tick() {
    tone(2200 + Math.random() * 400, 0, 0.08, 0.015, 'triangle')
  },
  /** Chunkier click for presses. */
  click() {
    tone(880, 0, 0.12, 0.04, 'square')
    tone(1760, 0.02, 0.1, 0.02, 'sine')
  },
  /** Rising arpeggio for the Konami unlock. */
  unlock() {
    ;[392, 523.25, 659.25, 783.99, 1046.5, 1567.98].forEach((f, i) =>
      tone(f, i * 0.08, 0.5, 0.05, 'triangle'),
    )
  },
}
