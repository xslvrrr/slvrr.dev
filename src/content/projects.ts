import type { Project } from './types'

// Placeholder projects: replace with real ones. Set `repo` to pull live GitHub stats.
export const projects: Project[] = [
  {
    name: 'slvrr.dev',
    repo: 'xslvrrr/slvrr.dev',
    blurb: 'This site. Liquid chrome, shaders and far too many hover effects.',
    tags: ['React', 'Three.js', 'GLSL'],
    year: '2026',
  },
  {
    name: 'Project Two',
    blurb: 'A short, punchy description of something you built and why it is cool.',
    tags: ['TypeScript', 'Node'],
    year: '2025',
  },
  {
    name: 'Project Three',
    blurb: 'Another thing. Maybe a bot, a CLI, a game jam entry or a design experiment.',
    tags: ['Rust', 'CLI'],
    year: '2025',
  },
  {
    name: 'Project Four',
    blurb: 'Something small and delightful that you shipped in a weekend.',
    tags: ['Svelte', 'Canvas'],
    year: '2024',
  },
]
