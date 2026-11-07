import { ErrorBoundary as Safe } from '@/components/ErrorBoundary'
import { ExploreTrack } from '@/components/ExploreTrack'
import { Marquee } from '@/fx/Marquee'
import { About } from '@/sections/About'
import { Footer } from '@/sections/Footer'
import { Hero } from '@/sections/Hero'
import { Links } from '@/sections/Links'
import { Notes } from '@/sections/Notes'
import { NowPlaying } from '@/sections/NowPlaying'
import { Projects } from '@/sections/Projects'
import { Splash } from '@/sections/Splash'
import { profile } from '@/content/profile'

// A walk through the garden: each section is a stop at a landmark
// (its `data-landmark`). On wide screens the walk goes sideways.
//
// Each section is isolated: if one throws (e.g. a live API sends something
// unexpected), only that section disappears instead of the whole page.
export default function Home() {
  return (
    <>
      <Splash />
      <main id="top">
        <ExploreTrack>
          <Safe>
            <Hero />
          </Safe>
          <div className="explore:hidden">
            <Marquee items={[profile.name, ...profile.roles]} />
          </div>
          <Safe>
            <Links />
          </Safe>
          <Safe>
            <NowPlaying />
          </Safe>
          <div className="explore:hidden">
            <Marquee items={['music', 'code', 'games', 'vespers', 'noise']} speed={2} />
          </div>
          <Safe>
            <Projects />
          </Safe>
          <Safe>
            <About />
          </Safe>
          <Safe>
            <Notes />
          </Safe>
          <Safe>
            <Footer />
          </Safe>
        </ExploreTrack>
      </main>
    </>
  )
}
