import type { ComponentType } from 'react'

export interface NoteMeta {
  title: string
  date: string
  summary: string
}

export interface Note extends NoteMeta {
  slug: string
  Component: ComponentType
}

type NoteModule = { default: ComponentType; meta: NoteMeta }

const modules = import.meta.glob<NoteModule>('./notes/*.mdx', { eager: true })

export const notes: Note[] = Object.entries(modules)
  .map(([path, mod]) => ({
    ...mod.meta,
    slug: path
      .split('/')
      .pop()!
      .replace(/\.mdx$/, ''),
    Component: mod.default,
  }))
  .sort((a, b) => b.date.localeCompare(a.date))

export const getNote = (slug: string) => notes.find((n) => n.slug === slug)
