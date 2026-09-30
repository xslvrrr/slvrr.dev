import { ErrorBoundary as Safe } from '@/components/ErrorBoundary'
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

// Each section is isolated: if one throws (e.g. a live API sends something
// unexpected), only that section disappears instead of the whole page.
export default function Home() {
  return (
    <>
      <Splash />
      <main id="top">
        <Safe>
          <Hero />
        </Safe>
        <Marquee items={[profile.name, ...profile.roles]} />
        <Safe>
          <Links />
        </Safe>
        <Safe>
          <NowPlaying />
        </Safe>
        <Marquee items={['music', 'code', 'games', 'chrome', 'noise']} speed={2} />
        <Safe>
          <Projects />
        </Safe>
        <Safe>
          <About />
        </Safe>
        <Safe>
          <Notes />
        </Safe>
      </main>
      <Safe>
        <Footer />
      </Safe>
    </>
  )
}
