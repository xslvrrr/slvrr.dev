import type { Project } from './types'

// Set `repo` to pull live GitHub stats. Blurbs are drafts in a darker voice.
export const projects: Project[] = [
  {
    name: 'slvrr.dev',
    repo: 'xslvrrr/slvrr.dev',
    blurb:
      'This place. Liquid chrome, crunchy shaders and more effects than anyone asked for.',
    tags: ['React', 'Three.js', 'GLSL'],
    year: '2026',
  },
  {
    name: 'Millennium',
    repo: 'xslvrrr/xslvrrr.github.io',
    blurb:
      "The student portal they should have built. Everything you need, and a few things you didn't know you did.",
    tags: ['React', 'TanStack Start', 'Supabase'],
    year: '2024-26',
  },
  {
    name: 'Trance',
    repo: 'xslvrrr/Trance',
    blurb:
      'A Zen fork for people who modded Zen until it broke. Every mod, built in, none of the mess.',
    tags: ['Gecko', 'Zen fork', 'JavaScript', 'TypeScript', 'Rust', 'macOS'],
    year: '2026',
  },
  {
    name: 'Barik',
    blurb:
      'A menubar for macOS that stays out of the way. Forked, fixed, and stripped of its energy drain.',
    repo: 'xslvrrr/Barik',
    tags: ['Swift', 'SwiftUI', 'macOS', 'AeroSpace', 'yabai'],
    year: '2026',
  },
]
