import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { onResurface } from '@/lib/resurface'
import { strike } from '@/lib/storm'
import { enteredStore, useStore } from '@/lib/store'
import { sfx } from '@/lib/sfx'
import type { Engine } from './engine'
import { GateTitle } from './GateTitle'
import { Reader } from './Reader'
import { patchWorld, worldStore } from './state'
import { stationForSection, stations } from './stations'

const LAST = stations.length - 1

/** The station a URL points at: `/#music` → the fountain, a note → the graves. */
function targetOf(pathname: string, hash: string) {
  if (pathname.startsWith('/notes/')) return stationForSection('notes')
  const i = hash ? stationForSection(hash.slice(1)) : -1
  return i > 0 ? i : null
}

/**
 * The first-person churchyard: a full-screen pixelated canvas with the
 * controls laid over it (the walking wedges at the screen edges, the label of
 * whatever you're pointing at, place names as you arrive) and the reading
 * panel for the section you're looking at. The URL hash follows what you're
 * looking at, so `/#work` walks you to the mausoleum and the back button
 * steps you back.
 */
export function World() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const state = useStore(worldStore)
  const entered = useStore(enteredStore)
  const location = useLocation()
  const navigate = useNavigate()
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const pending = useRef<number | null>(targetOf(location.pathname, location.hash))
  const ready = state.mode !== 'loading' && state.mode !== 'failed'

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    let disposed = false
    let e: Engine | null = null
    void import('./engine')
      .then(async ({ Engine }) => {
        if (disposed) return
        try {
          e = new Engine(el)
        } catch {
          patchWorld({ mode: 'failed' })
          return
        }
        engine.current = e
        if (import.meta.env.DEV) Object.assign(window, { engine: e })
        const start = enteredStore.get() ? (pending.current ?? 1) : 0
        if (start > 0) pending.current = null
        // (once it's ready, the URL effect below walks to any station in the hash)
        await e.init(start)
        if (disposed) e.dispose()
      })
      .catch(() => patchWorld({ mode: 'failed' }))
    return () => {
      disposed = true
      e?.dispose()
      engine.current = null
    }
  }, [])

  // Follow the URL: a hash or a note walks you to its station and turns you to look.
  useEffect(() => {
    const e = engine.current
    const target = targetOf(location.pathname, location.hash)
    if (!e || !ready) {
      pending.current = target
      return
    }
    if (state.mode === 'gate' || state.mode === 'opening') {
      pending.current = target
      return
    }
    if (target !== null) void e.travel(target, true)
    else void e.unlook()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash, ready])

  const enter = useCallback(() => {
    const e = engine.current
    if (!e || worldStore.get().mode !== 'gate') return
    enteredStore.set(true)
    e.enter(pending.current ?? undefined)
    pending.current = null
  }, [])

  const lookAt = useCallback(
    (i: number) => {
      const section = stations[i].section
      if (section) navigate(`/#${section}`)
    },
    [navigate],
  )
  const stepBack = useCallback(() => navigate('/'), [navigate])

  // "back to the gate" (at the end of the path): fade out, wake up just inside it
  useEffect(
    () =>
      onResurface(() => {
        navigate('/')
        void engine.current?.teleport(1)
      }),
    [navigate],
  )

  // keyboard and wheel
  useEffect(() => {
    let wheel = 0
    let wheelTimer = 0
    const onKey = (ev: KeyboardEvent) => {
      const e = engine.current
      const target = ev.target as HTMLElement | null
      if (!e || target?.closest('input, textarea, [contenteditable]')) return
      const { mode, station } = worldStore.get()
      if (mode === 'gate' && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault()
        enter()
      } else if (mode === 'idle') {
        if (['w', 'W', 'ArrowUp'].includes(ev.key)) e.forward()
        else if (['s', 'S', 'ArrowDown'].includes(ev.key)) e.back()
        else if (
          ['e', 'E', 'Enter', 'ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(
            ev.key,
          )
        ) {
          if (stations[station].poi) lookAt(station)
        }
      } else if (mode === 'reading' && (ev.key === 'Escape' || ev.key === 'Backspace')) {
        if (target?.closest('[data-reader]') && ev.key === 'Backspace') return
        stepBack()
      }
    }
    const onWheel = (ev: WheelEvent) => {
      const e = engine.current
      if (!e || worldStore.get().mode !== 'idle') return
      if ((ev.target as HTMLElement | null)?.closest('[data-reader], [data-scrolls]'))
        return
      wheel += ev.deltaY
      window.clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(() => (wheel = 0), 250)
      if (wheel > 80) {
        wheel = 0
        e.forward()
      } else if (wheel < -80) {
        wheel = 0
        e.back()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
    }
  }, [enter, lookAt, stepBack])

  const onPointerMove = (ev: React.PointerEvent) => {
    const e = engine.current
    if (!e) return
    if (ev.pointerType === 'mouse')
      e.pointer(
        (ev.clientX / window.innerWidth) * 2 - 1,
        (ev.clientY / window.innerHeight) * 2 - 1,
      )
    const mode = worldStore.get().mode
    if (mode !== 'idle') {
      if (worldStore.get().hover) patchWorld({ hover: null })
      // clicking the world while reading steps you back
      if (canvas.current) {
        if (mode === 'reading') canvas.current.dataset.cursor = 'back'
        else delete canvas.current.dataset.cursor
      }
      return
    }
    const hit = e.pick(ev.clientX, ev.clientY)
    const label = typeof hit === 'number' ? (stations[hit].poi?.label ?? null) : null
    if (label !== worldStore.get().hover) {
      patchWorld({ hover: label })
      if (label) sfx.tick()
    }
    setPointer({ x: ev.clientX, y: ev.clientY })
    if (canvas.current) {
      if (label) canvas.current.dataset.cursor = 'look'
      else delete canvas.current.dataset.cursor
    }
  }

  const onClick = (ev: React.MouseEvent) => {
    const e = engine.current
    if (!e) return
    const { mode } = worldStore.get()
    if (mode === 'gate') return enter()
    if (mode === 'reading') return stepBack()
    if (mode !== 'idle') return
    const hit = e.pick(ev.clientX, ev.clientY)
    if (typeof hit === 'number') {
      patchWorld({ hover: null })
      lookAt(hit)
    } else if (hit === 'sky') strike(ev.clientX / window.innerWidth, true)
  }

  const section = stations[state.station]?.section
  const reading =
    state.mode === 'reading' && location.pathname === '/' && section && section !== 'hero'

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden
        className="fixed inset-0 z-0 h-full w-full bg-ink [image-rendering:pixelated]"
        onPointerMove={onPointerMove}
        onPointerLeave={() => patchWorld({ hover: null })}
        onClick={onClick}
      />

      <AnimatePresence>
        {(state.mode === 'loading' ||
          state.mode === 'gate' ||
          state.mode === 'opening') && <GateTitle key="gate" onEnter={enter} />}
      </AnimatePresence>

      {entered && ready && state.mode !== 'gate' && state.mode !== 'opening' && (
        <>
          <Wedges
            show={state.mode === 'idle'}
            forward={state.station < LAST}
            back={state.station > 1}
            onForward={() => engine.current?.forward()}
            onBack={() => engine.current?.back()}
          />
          <PlaceName station={state.station} arrived={state.mode === 'idle'} />
          <Hint show={state.mode === 'idle' && state.station === 1} />
          <LookPrompt
            label={
              state.mode === 'idle' ? (stations[state.station].poi?.label ?? null) : null
            }
            onLook={() => lookAt(state.station)}
          />
        </>
      )}

      <AnimatePresence>
        {state.hover && state.mode === 'idle' && (
          <motion.div
            key="hover"
            aria-hidden
            className="pointer-events-none fixed z-20 font-mono text-lg uppercase tracking-wider text-fg [text-shadow:2px_2px_0_#000]"
            style={{ left: pointer.x + 22, top: pointer.y + 14 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            [ {state.hover} ]
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reading && <Reader key={section} section={section} onClose={stepBack} />}
      </AnimatePresence>
    </>
  )
}

/**
 * The way forward: a wedge at each edge of the screen, pointing in towards
 * the vanishing point like the hedges do. Either one walks you on; the low
 * one at the bottom turns you back.
 */
function Wedges({
  show,
  forward,
  back,
  onForward,
  onBack,
}: {
  show: boolean
  forward: boolean
  back: boolean
  onForward: () => void
  onBack: () => void
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="wedges"
          className="pointer-events-none fixed inset-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {forward &&
            (['left', 'right'] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={onForward}
                onMouseEnter={sfx.tick}
                aria-label="Walk on"
                data-cursor="walk"
                className={`wedge group pointer-events-auto absolute top-[14%] h-[72%] w-[min(18vw,11rem)] [clip-path:polygon(0_0,100%_50%,0_100%)] ${side === 'left' ? 'left-0' : 'right-0 -scale-x-100'}`}
              >
                <svg
                  viewBox="0 0 100 400"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  aria-hidden
                >
                  <defs>
                    <pattern
                      id={`dither-${side}`}
                      width="4"
                      height="4"
                      patternUnits="userSpaceOnUse"
                      className="text-fg"
                    >
                      <rect width="2" height="2" fill="currentColor" />
                      <rect x="2" y="2" width="2" height="2" fill="currentColor" />
                    </pattern>
                  </defs>
                  <polygon
                    points="0,0 100,200 0,400"
                    fill={`url(#dither-${side})`}
                    className="text-fg opacity-[0.07] transition-opacity duration-200 group-hover:opacity-20 group-focus-visible:opacity-20"
                  />
                  <polyline
                    points="0,0 100,200 0,400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="4 6"
                    className="text-fg/25 transition-colors group-hover:text-fg/70"
                  />
                </svg>
                <span
                  className={`absolute left-[14%] top-1/2 flex -translate-y-1/2 flex-col items-start gap-1 font-mono text-lg uppercase leading-none tracking-wider text-fg/60 transition-colors group-hover:text-fg [text-shadow:2px_2px_0_#000] ${side === 'right' ? '-scale-x-100' : ''}`}
                >
                  <Chevron />
                  <span className="opacity-0 transition-opacity group-hover:opacity-100">
                    walk on
                  </span>
                </span>
              </button>
            ))}
          {back && (
            <button
              type="button"
              onClick={onBack}
              onMouseEnter={sfx.tick}
              aria-label="Turn back"
              data-cursor="back"
              className="group pointer-events-auto absolute bottom-0 left-1/2 flex h-14 w-48 -translate-x-1/2 items-end justify-center pb-2 font-mono text-base uppercase tracking-wider text-fg/45 transition-colors hover:text-fg [text-shadow:2px_2px_0_#000]"
            >
              <svg
                viewBox="0 0 200 56"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                <polygon
                  points="30,56 100,6 170,56"
                  className="fill-fg/[0.04] transition-colors group-hover:fill-fg/[0.12]"
                />
              </svg>
              <span className="relative">▾ turn back</span>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 7 11" className="h-8 w-5" shapeRendering="crispEdges" aria-hidden>
      <path
        fill="currentColor"
        d="M0 0h2v1H0zM1 1h2v1H1zM2 2h2v1H2zM3 3h2v1H3zM4 4h2v1H4zM5 5h2v1H5zM4 6h2v1H4zM3 7h2v1H3zM2 8h2v1H2zM1 9h2v1H1zM0 10h2v1H0z"
      />
    </svg>
  )
}

/** The name of a place, faded up as you arrive, the way games title an area. */
function PlaceName({ station, arrived }: { station: number; arrived: boolean }) {
  const [shown, setShown] = useState<number | null>(null)
  const seen = useRef(new Set<number>())
  useEffect(() => {
    if (!arrived || seen.current.has(station)) return
    seen.current.add(station)
    setShown(station)
    const id = window.setTimeout(() => setShown(null), 3200)
    return () => window.clearTimeout(id)
  }, [station, arrived])

  return (
    <AnimatePresence>
      {shown !== null && arrived && (
        <motion.div
          key={shown}
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[22%] z-10 flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.2 } }}
          transition={{ duration: 1 }}
        >
          <span className="h-px w-40 bg-fg/40" />
          <span className="font-display text-5xl lowercase text-fg [text-shadow:3px_3px_0_#000] md:text-7xl">
            {stations[shown].place}
          </span>
          <span className="h-px w-40 bg-fg/40" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** How to move, shown the first time you stand inside the gate. */
function Hint({ show }: { show: boolean }) {
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem('slvrr:hinted') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (!show || done) return
    const id = window.setTimeout(() => {
      setDone(true)
      try {
        localStorage.setItem('slvrr:hinted', '1')
      } catch {
        // fine: it'll show again next time
      }
    }, 9000)
    return () => window.clearTimeout(id)
  }, [show, done])

  return (
    <AnimatePresence>
      {show && !done && (
        <motion.p
          key="hint"
          className="pointer-events-none fixed inset-x-4 bottom-16 z-10 text-center font-mono text-lg uppercase tracking-wider text-fg/80 [text-shadow:2px_2px_0_#000] md:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
        >
          click the wedges to walk · click what catches your eye
          <span className="hidden md:inline"> · or scroll, w/s, e to look</span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/** "[ read the signpost ]": a prompt at the bottom when there's something to look at. */
function LookPrompt({ label, onLook }: { label: string | null; onLook: () => void }) {
  return (
    <AnimatePresence>
      {label && (
        <motion.button
          key={label}
          type="button"
          onClick={onLook}
          onMouseEnter={sfx.tick}
          data-cursor="look"
          className="fixed bottom-16 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap font-mono text-xl uppercase tracking-wider text-fg/80 transition-colors hover:text-fg [text-shadow:2px_2px_0_#000]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <motion.span
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: (t) => Math.round(t * 6) / 6,
            }}
          >
            [ e ] {label}
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
