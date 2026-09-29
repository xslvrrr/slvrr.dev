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

export default function Home() {
  return (
    <>
      <Splash />
      <main id="top">
        <Hero />
        <Marquee items={[profile.name, ...profile.roles]} />
        <Links />
        <NowPlaying />
        <Marquee items={['music', 'code', 'games', 'chrome', 'noise']} speed={2} />
        <Projects />
        <About />
        <Notes />
      </main>
      <Footer />
    </>
  )
}
