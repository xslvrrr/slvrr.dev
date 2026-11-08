import { MDXProvider } from '@mdx-js/react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { mdxComponents } from '@/components/mdx'
import { getNote } from '@/content/notes'
import { profile } from '@/content/profile'
import { enteredStore } from '@/lib/store'

/**
 * A note, read by the graves: a parchment-dark panel over the world (which
 * walks you to the graves behind it). Esc goes back to the list.
 */
export default function NotePage() {
  const { slug = '' } = useParams()
  const note = getNote(slug)
  const navigate = useNavigate()

  useEffect(() => {
    // Visitors who land straight on a note skip the gate.
    enteredStore.set(true)
    document.title = note
      ? `${note.title} — ${profile.name}`
      : `not found — ${profile.name}`
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/#notes')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.title = profile.name
      window.removeEventListener('keydown', onKey)
    }
  }, [note, navigate])

  return (
    <motion.main
      data-reader
      className="panel fixed inset-x-2 bottom-2 top-16 z-40 overflow-y-auto overscroll-contain px-5 pb-16 pt-6 md:inset-x-auto md:left-1/2 md:top-20 md:w-[min(46rem,92vw)] md:-translate-x-1/2 md:px-10"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: (t) => Math.round((1 - (1 - t) ** 3) * 10) / 10,
      }}
    >
      <Link
        to="/#notes"
        className="pixel-btn inline-block px-3 py-1 font-mono text-lg uppercase tracking-wider text-fg-muted hover:text-fg"
        data-cursor="back"
      >
        ← all notes
      </Link>
      {note ? (
        <article>
          <header className="mb-10 mt-8 border-b-2 border-line pb-8">
            <time className="font-mono text-lg text-fg-muted">{note.date}</time>
            <h1 className="mt-2 font-display text-6xl leading-none text-fg md:text-7xl">
              {note.title}
            </h1>
            <p className="mt-4 text-lg text-fg-muted">{note.summary}</p>
          </header>
          <MDXProvider components={mdxComponents}>
            <note.Component />
          </MDXProvider>
        </article>
      ) : (
        <div className="mt-12">
          <h1 className="section-title">404</h1>
          <p className="mt-4 text-fg-muted">That note doesn't exist (yet).</p>
        </div>
      )}
    </motion.main>
  )
}
