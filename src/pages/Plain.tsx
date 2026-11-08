import { ErrorBoundary as Safe } from '@/components/ErrorBoundary'
import { copy } from '@/content/copy'
import { profile } from '@/content/profile'
import { About } from '@/sections/About'
import { Footer } from '@/sections/Footer'
import { Links } from '@/sections/Links'
import { Notes } from '@/sections/Notes'
import { NowPlaying } from '@/sections/NowPlaying'
import { Projects } from '@/sections/Projects'

const order = [
  ['links', Links],
  ['music', NowPlaying],
  ['work', Projects],
  ['about', About],
  ['notes', Notes],
  ['footer', Footer],
] as const

/** Without WebGL there's no churchyard to walk through: the same sections, as a page. */
export default function Plain() {
  return (
    <main id="top" className="mx-auto flex max-w-3xl flex-col gap-24 px-4 pb-24 pt-28">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{profile.tagline}</p>
        <h1 className="font-display text-8xl leading-none">{profile.name}</h1>
      </header>
      {order.map(([id, View]) => (
        <section key={id} id={id} className="panel p-6">
          <p className="eyebrow">{copy.sections[id].eyebrow}</p>
          <h2 className="section-title mb-6">{copy.sections[id].title}</h2>
          <Safe>
            <View />
          </Safe>
        </section>
      ))}
    </main>
  )
}
