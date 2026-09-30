import { MDXProvider } from '@mdx-js/react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { mdxComponents } from '@/components/mdx'
import { getNote } from '@/content/notes'
import { profile } from '@/content/profile'
import { TextReveal } from '@/fx/TextReveal'
import { enteredStore } from '@/lib/store'

export default function NotePage() {
  const { slug = '' } = useParams()
  const note = getNote(slug)

  useEffect(() => {
    // Visitors who land straight on a note skip the splash when they go home.
    enteredStore.set(true)
    document.title = note
      ? `${note.title} — ${profile.name}`
      : `not found — ${profile.name}`
    return () => {
      document.title = profile.name
    }
  }, [note])

  return (
    <main data-bg="notes" className="mx-auto max-w-3xl px-4 pb-32 pt-32 md:px-8 md:pt-44">
      <Link to="/#notes" className="eyebrow hover:text-fg" data-cursor="back">
        ← all notes
      </Link>
      {note ? (
        <article>
          <header className="mb-12 mt-10 border-b border-line pb-10">
            <time className="font-mono text-xs text-fg-faint">{note.date}</time>
            <TextReveal
              as="h1"
              text={note.title}
              className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-chrome md:text-6xl"
            />
            <p className="mt-4 text-lg text-fg-muted">{note.summary}</p>
          </header>
          <MDXProvider components={mdxComponents}>
            <note.Component />
          </MDXProvider>
        </article>
      ) : (
        <div className="mt-16">
          <h1 className="section-title text-chrome">404</h1>
          <p className="mt-4 text-fg-muted">That note doesn't exist (yet).</p>
        </div>
      )}
    </main>
  )
}
