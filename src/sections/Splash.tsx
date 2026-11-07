import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLenis } from 'lenis/react'
import { PixelCross } from '@/components/PixelCross'
import { profile } from '@/content/profile'
import { sfx } from '@/lib/sfx'
import { enteredStore, useStore } from '@/lib/store'

const stepped = (n: number) => (t: number) => {
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  return Math.round(e * n) / n
}

/**
 * "Click to enter" gate in the guns.lol tradition, as a pair of cathedral
 * doors that swing open on a bell toll. The click is the user gesture that
 * lets the browser play sound. Skipped on reloads within a session.
 */
export function Splash() {
  const entered = useStore(enteredStore)
  const [progress, setProgress] = useState(0)
  const lenis = useLenis()

  useEffect(() => {
    if (entered) lenis?.start()
    else lenis?.stop()
  }, [entered, lenis])

  // A short fake loader while fonts and the scene settle behind it.
  useEffect(() => {
    if (entered) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1400)
      setProgress(1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [entered])

  const enter = () => {
    sfx.enter()
    enteredStore.set(true)
  }

  return (
    <AnimatePresence>
      {!entered && (
        <motion.button
          key="splash"
          type="button"
          onClick={enter}
          data-cursor="enter"
          className="fixed inset-0 z-[90] overflow-hidden text-center [perspective:1600px]"
          initial="closed"
          animate="closed"
          exit="open"
          variants={{ closed: {}, open: { transition: { when: 'afterChildren' } } }}
          aria-label="Enter site"
        >
          <Door side="left" />
          <Door side="right" />

          <motion.span
            className="absolute inset-0 flex flex-col items-center justify-center gap-8"
            variants={{
              closed: { opacity: 1 },
              open: { opacity: 0, transition: { duration: 0.25 } },
            }}
          >
            <motion.span
              className="pixel-shadow font-display text-[26vw] leading-none md:text-[15vw]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: stepped(10) }}
            >
              <span className="shimmer">{profile.name}</span>
            </motion.span>
            <span className="flex w-72 flex-col items-center gap-4">
              <span className="h-2 w-full border-2 border-stone-4 bg-ink p-px">
                <span
                  className="block h-full origin-left bg-glass-1"
                  style={{ transform: `scaleX(${Math.round(progress * 20) / 20})` }}
                />
              </span>
              <motion.span
                className="eyebrow pixel-shadow flex items-center gap-2 whitespace-nowrap !text-fg/80"
                animate={{ opacity: progress === 1 ? [0.35, 1, 0.35] : 0.5 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: stepped(6) }}
              >
                {progress === 1 ? (
                  <>
                    <PixelCross className="h-2.5 w-2 text-glass-1" />
                    the doors are unbarred · enter
                    <PixelCross className="h-2.5 w-2 text-glass-1" />
                  </>
                ) : (
                  `${Math.round(progress * 100)}%`
                )}
              </motion.span>
            </span>
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/**
 * One leaf of a heavy wooden door: dark planks, iron straps with rivets and a
 * ring pull at the seam. Swings outward around its outer edge.
 */
function Door({ side }: { side: 'left' | 'right' }) {
  const left = side === 'left'
  return (
    <motion.span
      aria-hidden
      className={`absolute inset-y-0 w-1/2 ${left ? 'left-0 origin-left' : 'right-0 origin-right'}`}
      style={{
        background: [
          // iron straps
          'linear-gradient(to bottom, transparent 0 17%, #1c1c1f 17% calc(17% + 12px), transparent calc(17% + 12px) 78%, #1c1c1f 78% calc(78% + 12px), transparent calc(78% + 12px))',
          // rivets along the straps
          'radial-gradient(circle at 50% 50%, #3c3c40 0 2px, transparent 2.5px) 0 calc(17% + 2px) / 28px 8px repeat-x',
          // planks
          'repeating-linear-gradient(90deg, #0a0a0b 0 4px, #1d1d1f 4px 8px, #18181a 8px 52px, #0a0a0b 52px 56px, #1d1d1f 56px 60px, #141415 60px 96px)',
        ].join(','),
        boxShadow: left
          ? 'inset -6px 0 0 #060607, inset -10px 0 0 #28282b'
          : 'inset 6px 0 0 #060607, inset 10px 0 0 #28282b',
      }}
      variants={{
        closed: { rotateY: 0 },
        open: {
          rotateY: left ? 100 : -100,
          transition: { duration: 1.3, ease: stepped(16) },
        },
      }}
    >
      {/* ring pull */}
      <span
        className={`absolute top-[64%] h-10 w-10 border-4 border-[#3c3c40] ${left ? 'right-6' : 'left-6'}`}
        style={{ borderRadius: '50%' }}
      />
      {/* candlelight through the crack */}
      <span
        className={`absolute inset-y-0 w-[2px] bg-glass-1/60 ${left ? 'right-0' : 'left-0'}`}
      />
    </motion.span>
  )
}
