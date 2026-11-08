import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { copy } from '@/content/copy'
import { links } from '@/content/links'
import { media } from '@/content/media'
import { notes } from '@/content/notes'
import { profile } from '@/content/profile'
import { useFinePointer } from '@/hooks/useFinePointer'
import { useLanyard } from '@/hooks/useLanyard'
import { useRepoStats } from '@/hooks/useRepoStats'
import { nowPlayingStore, useNowPlaying } from '@/lib/nowPlaying'
import { listenAlong, playerStore, togglePlay } from '@/lib/player'
import { sfx } from '@/lib/sfx'
import { strike } from '@/lib/storm'
import { soundStore, useStore } from '@/lib/store'
import { Card } from './Cards'
import { presenceStore, projectHref, useWalkmanLabel, verb } from './interact'
import type { Engine } from './engine'
import { GateTitle } from './GateTitle'
import { Lost } from './Lost'
import { patchWorld, say, worldStore, type Aim } from './state'
import { StickyZoom } from './StickyZoom'

/**
 * The churchyard: a full-screen pixelated canvas you walk around in, with a
 * small HUD over it (the cursor key bottom-left, sound bottom-right, a
 * crosshair, a prompt and a card for whatever you're aiming at, subtitles,
 * place names) and, on touch screens, a thumbstick.
 */
export function World() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const [live, setLive] = useState<Engine | null>(null)
  const state = useStore(worldStore)
  const fine = useFinePointer()
  const location = useLocation()
  const navigate = useNavigate()
  const stats = useRepoStats()
  const ready = !['loading', 'failed'].includes(state.mode)
  const inside = ['play', 'paused'].includes(state.mode)

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
        await e.init()
        if (disposed) e.dispose()
        else setLive(e)
      })
      .catch(() => patchWorld({ mode: 'failed' }))
    return () => {
      disposed = true
      e?.dispose()
      engine.current = null
    }
  }, [])

  // ---- the cursor ----
  const lock = useCallback(() => {
    if (!fine) return
    try {
      void canvas.current?.requestPointerLock()?.catch?.(() => {})
    } catch {
      // not allowed right now (no user gesture); the hint says how
    }
  }, [fine])
  const unlock = () => {
    if (document.pointerLockElement) document.exitPointerLock()
  }
  useEffect(() => {
    const onChange = () => {
      const locked = document.pointerLockElement === canvas.current
      patchWorld({ locked })
      if (locked) engine.current?.setPointer(null)
    }
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  // ---- reading things up close pauses the walk ----
  const reading = location.pathname.startsWith('/notes/') || state.sticky !== null
  useEffect(() => {
    const e = engine.current
    if (!e || !ready) return
    e.setPaused(reading)
    e.setZoom(state.sticky !== null)
    if (reading) unlock()
  }, [reading, ready, state.sticky])

  // ---- using things ----
  const activate = useCallback(
    (aim: Aim | null) => {
      const e = engine.current
      if (!e || !aim || worldStore.get().mode !== 'play') return
      const open = (href?: string) => {
        if (!href) return
        sfx.click()
        unlock()
        window.open(href, '_blank', 'noopener')
      }
      switch (aim.kind) {
        case 'link':
          return open(links[aim.index].href)
        case 'discord':
          return open(
            links.find((l) => l.icon === 'discord')?.href ??
              `https://discord.com/users/${profile.discordId}`,
          )
        case 'album':
          return open(media[aim.index].href)
        case 'nowplaying':
          return open(nowPlayingStore.get()?.url)
        case 'project':
          return open(projectHref(aim.index, stats))
        case 'walkman':
          return e.pickUpWalkman()
        case 'fountain':
          return void e.throwCoin().then((thrown) => thrown && say(copy.lines.coin))
        case 'sticky':
          sfx.turn()
          return patchWorld({ sticky: aim.index })
        case 'note':
          sfx.pickup()
          return navigate(`/notes/${notes[aim.index].slug}`)
      }
    },
    [navigate, stats],
  )

  const walkman = useCallback(() => {
    if (!worldStore.get().carrying) return
    sfx.walkman()
    if (playerStore.get().status === 'idle') void listenAlong()
    else togglePlay()
  }, [])

  const enter = useCallback(() => {
    const e = engine.current
    if (!e || worldStore.get().mode !== 'gate') return
    e.enter()
    lock()
  }, [lock])

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (ev: KeyboardEvent, down: boolean) => {
      const e = engine.current
      if (!e) return
      const target = ev.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      const { mode } = worldStore.get()
      if (mode === 'gate' && down && (ev.code === 'Enter' || ev.code === 'Space')) {
        ev.preventDefault()
        return enter()
      }
      if (mode !== 'play') return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code))
        ev.preventDefault()
      e.key(ev.code, down)
      if (!down || ev.repeat) return
      if (ev.code === 'KeyE' || ev.code === 'Enter') activate(e.currentAim())
      else if (ev.code === 'KeyF') walkman()
      else if (ev.code === 'KeyV') {
        if (document.pointerLockElement) unlock()
        else lock()
      }
    }
    const down = (ev: KeyboardEvent) => onKey(ev, true)
    const up = (ev: KeyboardEvent) => onKey(ev, false)
    const blur = () => engine.current?.releaseKeys()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [enter, lock, activate, walkman])

  // ---- mouse and touch on the world ----
  const drag = useRef<{
    id: number
    x: number
    y: number
    moved: number
    at: number
  } | null>(null)
  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (document.pointerLockElement === canvas.current)
        engine.current?.turn(ev.movementX, ev.movementY)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const onPointerDown = (ev: React.PointerEvent) => {
    const { mode } = worldStore.get()
    if (mode === 'gate') return enter()
    if (mode !== 'play' || document.pointerLockElement) return
    drag.current = {
      id: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY,
      moved: 0,
      at: performance.now(),
    }
    try {
      ;(ev.target as Element).setPointerCapture?.(ev.pointerId)
    } catch {
      // no capture: dragging still works while over the canvas
    }
  }
  const onPointerMove = (ev: React.PointerEvent) => {
    const e = engine.current
    if (!e) return
    if (ev.pointerType === 'mouse' && !document.pointerLockElement)
      e.setPointer(
        (ev.clientX / window.innerWidth) * 2 - 1,
        -(ev.clientY / window.innerHeight) * 2 + 1,
      )
    const d = drag.current
    if (d && d.id === ev.pointerId) {
      const dx = ev.clientX - d.x
      const dy = ev.clientY - d.y
      d.moved += Math.abs(dx) + Math.abs(dy)
      d.x = ev.clientX
      d.y = ev.clientY
      if (d.moved > 6) e.turn(dx, dy, ev.pointerType === 'touch' ? 0.0055 : 0.004)
    }
  }
  const onPointerUp = (ev: React.PointerEvent) => {
    const e = engine.current
    const d = drag.current
    drag.current = null
    if (!e || worldStore.get().mode !== 'play') return
    if (document.pointerLockElement) {
      // captured: a click uses whatever the crosshair is on
      return activate(e.currentAim())
    }
    if (!d || d.moved > 8 || performance.now() - d.at > 500) return
    // a tap or click (not a drag): use what's under it, call down the lightning, or grab the mouse
    const aim = e.pickAt(ev.clientX, ev.clientY)
    if (aim) activate(aim)
    else if (e.overSky(ev.clientX, ev.clientY))
      strike(ev.clientX / window.innerWidth, true)
    else if (ev.pointerType === 'mouse') lock()
  }

  const closeNote = () => navigate('/')

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden
        className="fixed inset-0 z-0 h-full w-full touch-none bg-ink [image-rendering:pixelated]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => engine.current?.setPointer(null)}
        data-cursor={state.aim && !state.locked ? 'use' : undefined}
      />
      <ScreenFeeds engine={engine} ready={ready} />

      <AnimatePresence>
        {(state.mode === 'loading' ||
          state.mode === 'gate' ||
          state.mode === 'opening') && <GateTitle key="gate" onEnter={enter} />}
      </AnimatePresence>

      {inside && (
        <>
          {(state.locked || !fine) && state.mode === 'play' && (
            <Crosshair active={!!state.aim} />
          )}
          <PlaceName place={state.place} />
          <Subtitle />
          <Prompt
            aim={state.mode === 'play' ? state.aim : null}
            fine={fine}
            onUse={() => activate(state.aim)}
          />
          {fine ? (
            <Keys locked={state.locked} />
          ) : (
            <Thumbstick onMove={(x, y) => engine.current?.setStick(x, y)} />
          )}
          <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-3">
            {state.carrying && <WalkmanButton onPress={walkman} fine={fine} />}
            <SoundButton />
          </div>
          <Hint fine={fine} />
        </>
      )}

      <AnimatePresence>
        {state.sticky !== null && (
          <StickyZoom
            key="sticky"
            index={state.sticky}
            onChange={(i) => patchWorld({ sticky: i })}
            onClose={() => {
              patchWorld({ sticky: null })
              lock()
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.mode === 'lost' && live && <Lost key="lost" engine={live} />}
      </AnimatePresence>
      {location.pathname.startsWith('/notes/') && <NoteKeys onClose={closeNote} />}
    </>
  )
}

/** Keeps the live screens in the world (and their cards) fed. */
function ScreenFeeds({
  engine,
  ready,
}: {
  engine: React.RefObject<Engine | null>
  ready: boolean
}) {
  const { presence, state } = useLanyard(profile.discordId)
  const np = useNowPlaying()
  const player = useStore(playerStore)
  useEffect(() => {
    presenceStore.set({ p: presence, state })
    if (ready) engine.current?.world.screens.setDiscord(presence, state)
  }, [presence, state, ready, engine])
  useEffect(() => {
    if (ready) engine.current?.world.screens.setMusic(np)
  }, [np, ready, engine])
  useEffect(() => {
    if (ready) engine.current?.world.screens.setPlayer(player)
  }, [player, ready, engine])
  return null
}

function NoteKeys({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyE') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return null
}

function Crosshair({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
    >
      {active ? (
        <span className="block h-4 w-4 border-2 border-fg/90 [box-shadow:1px_1px_0_#000]" />
      ) : (
        <span className="block h-1 w-1 bg-fg/80 [box-shadow:1px_1px_0_#000]" />
      )}
    </div>
  )
}

/** "[E] read" and a card about the thing you're aiming at, bottom centre. */
function Prompt({
  aim,
  fine,
  onUse,
}: {
  aim: Aim | null
  fine: boolean
  onUse: () => void
}) {
  return (
    <AnimatePresence>
      {aim && (
        <motion.div
          key={`${aim.kind}-${aim.index}`}
          className={`pointer-events-none fixed inset-x-3 z-20 flex flex-col items-center gap-2 ${fine ? 'bottom-16' : 'bottom-48'}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18 }}
        >
          <div className="panel max-w-md px-4 py-3">
            <Card aim={aim} />
          </div>
          {fine ? (
            <p className="font-mono text-xl uppercase tracking-wider text-fg [text-shadow:2px_2px_0_#000]">
              [e] {verb(aim)}
            </p>
          ) : (
            <button
              type="button"
              onClick={onUse}
              className="pixel-btn pointer-events-auto px-5 py-2 font-mono text-xl uppercase tracking-wider text-fg"
            >
              {verb(aim)}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** What you say to yourself: subtitles, bottom centre. */
let lastLine = 0
function Subtitle() {
  const { line } = useStore(worldStore)
  const [shown, setShown] = useState<typeof line>(null)
  useEffect(() => {
    // (only new lines: the HUD remounts after a blackout and mustn't replay the last one)
    if (!line || line.id <= lastLine) return
    lastLine = line.id
    setShown(line)
    const id = window.setTimeout(() => setShown(null), 3800)
    return () => window.clearTimeout(id)
  }, [line])
  return (
    <AnimatePresence>
      {shown && (
        <motion.p
          key={shown.id}
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 top-[62%] z-20 text-center font-mono text-2xl text-fg [text-shadow:2px_2px_0_#000,0_0_12px_#000] md:text-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          transition={{ duration: 0.4 }}
        >
          “{shown.text}”
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/** A place's name, faded up the first time you walk into it. */
const seenPlaces = new Set<string>()
function PlaceName({ place }: { place: string }) {
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    if (!place || seenPlaces.has(place)) return
    seenPlaces.add(place)
    setShown(place)
  }, [place])
  // the timer isn't tied to `place`, so walking on can't leave a caption stuck on screen
  useEffect(() => {
    if (!shown) return
    const id = window.setTimeout(() => setShown(null), 3000)
    return () => window.clearTimeout(id)
  }, [shown])
  return (
    <AnimatePresence>
      {shown && (
        <motion.p
          key={shown}
          className="pointer-events-none fixed inset-x-0 top-[18%] z-10 text-center font-display text-5xl lowercase text-fg [text-shadow:3px_3px_0_#000] md:text-7xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.2 } }}
          transition={{ duration: 1 }}
        >
          {shown}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/** Bottom left: how to free (or capture) the cursor. */
function Keys({ locked }: { locked: boolean }) {
  return (
    <p className="pointer-events-none fixed bottom-4 left-4 z-20 font-mono text-lg uppercase tracking-wider text-fg/75 [text-shadow:2px_2px_0_#000]">
      <span className="mr-2 inline-block border border-fg/50 px-1.5 leading-tight text-fg">
        v
      </span>
      {locked ? 'unlock cursor' : 'lock cursor'}
    </p>
  )
}

/** First time inside: how to get around. */
function Hint({ fine }: { fine: boolean }) {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem('slvrr:hinted') !== '2'
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (!show) return
    const id = window.setTimeout(() => {
      setShow(false)
      try {
        localStorage.setItem('slvrr:hinted', '2')
      } catch {
        // fine: it'll show again next time
      }
    }, 9000)
    return () => window.clearTimeout(id)
  }, [show])
  return (
    <AnimatePresence>
      {show && (
        <motion.p
          className="pointer-events-none fixed inset-x-4 top-6 z-20 text-center font-mono text-lg uppercase tracking-wider text-fg/80 [text-shadow:2px_2px_0_#000] md:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          {fine
            ? 'wasd to walk · mouse to look · shift to run · e to use'
            : 'thumbstick to walk · drag to look · tap things to use them'}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

function SoundButton() {
  const sound = useStore(soundStore)
  return (
    <button
      type="button"
      onClick={() => {
        soundStore.set(!sound)
        if (!sound) sfx.click()
      }}
      aria-pressed={sound}
      aria-label={sound ? 'Mute sound' : 'Turn sound on'}
      data-cursor={sound ? 'mute' : 'unmute'}
      className="pixel-btn grid h-11 w-11 place-items-center text-fg"
    >
      <svg
        viewBox="0 0 12 12"
        className="h-6 w-6"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path fill="currentColor" d="M1 4h2v4H1zM3 3h1v6H3zM4 2h1v8H4zM5 1h1v10H5z" />
        {sound ? (
          <path
            fill="currentColor"
            d="M7 5h1v2H7zM8 3h1v1H8zM9 4h1v4H9zM8 8h1v1H8zM10 2h1v1h-1zM11 3h1v6h-1zM10 9h1v1h-1z"
          />
        ) : (
          <path
            fill="currentColor"
            d="M7 4h1v1H7zM8 5h1v1H8zM9 6h1v1H9zM10 7h1v1h-1zM10 4h1v1h-1zM9 5h1v1H9zM8 6h1v1H8zM7 7h1v1H7z"
          />
        )}
      </svg>
    </button>
  )
}

function WalkmanButton({ onPress, fine }: { onPress: () => void; fine: boolean }) {
  const label = useWalkmanLabel()
  return (
    <button
      type="button"
      onClick={onPress}
      className="pixel-btn max-w-[60vw] truncate px-3 py-1.5 font-mono text-lg uppercase tracking-wider text-fg"
      data-cursor="play"
    >
      {fine && <span className="mr-2 border border-fg/50 px-1.5">f</span>}
      walkman: {label}
    </button>
  )
}

/** The thumbstick for touch screens: drag the knob to walk, push it all the way to run. */
function Thumbstick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const base = useRef<HTMLDivElement>(null)
  const active = useRef<number | null>(null)
  const R = 46
  const move = (ev: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    let dx = ev.clientX - (r.left + r.width / 2)
    let dy = ev.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx = (dx / d) * R
      dy = (dy / d) * R
    }
    setKnob({ x: dx, y: dy })
    onMove(dx / R, -dy / R)
  }
  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    onMove(0, 0)
  }
  return (
    <div
      ref={base}
      className="fixed bottom-8 left-8 z-30 grid h-32 w-32 touch-none place-items-center rounded-full border-2 border-fg/30 bg-black/30"
      onPointerDown={(ev) => {
        active.current = ev.pointerId
        try {
          ev.currentTarget.setPointerCapture(ev.pointerId)
        } catch {
          // fine: moves still arrive while the finger stays on the stick
        }
        move(ev)
      }}
      onPointerMove={(ev) => active.current === ev.pointerId && move(ev)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Move"
      role="slider"
      aria-valuetext="thumbstick"
    >
      <span
        aria-hidden
        className="absolute inset-3 rounded-full border border-dashed border-fg/20"
      />
      <span
        aria-hidden
        className="h-14 w-14 rounded-full border-2 border-fg/70 bg-fg/15 [box-shadow:3px_3px_0_rgb(0_0_0/0.6)]"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}
