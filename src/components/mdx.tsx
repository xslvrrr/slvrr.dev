import type { MDXComponents } from 'mdx/types'

/** Styling for elements inside notes (src/content/notes/*.mdx). */
export const mdxComponents: MDXComponents = {
  h2: (p) => (
    <h2 className="mt-14 mb-4 font-display text-2xl font-bold md:text-3xl" {...p} />
  ),
  h3: (p) => <h3 className="mt-10 mb-3 font-display text-xl font-semibold" {...p} />,
  p: (p) => <p className="my-5 text-lg leading-relaxed text-fg-muted" {...p} />,
  a: (p) => (
    <a
      className="text-fg underline decoration-iri-2 decoration-2 underline-offset-4 hover:decoration-iri-1"
      target={p.href?.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      {...p}
    />
  ),
  strong: (p) => <strong className="font-semibold text-fg" {...p} />,
  ul: (p) => (
    <ul
      className="my-5 list-disc space-y-2 pl-6 text-lg text-fg-muted marker:text-iri-2"
      {...p}
    />
  ),
  ol: (p) => (
    <ol className="my-5 list-decimal space-y-2 pl-6 text-lg text-fg-muted" {...p} />
  ),
  blockquote: (p) => (
    <blockquote className="my-8 border-l-2 border-iri-2 pl-6 italic text-fg" {...p} />
  ),
  pre: (p) => (
    <pre
      className="panel my-8 overflow-x-auto p-5 font-mono text-sm leading-relaxed"
      {...p}
    />
  ),
  code: (p) => (
    <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.9em]" {...p} />
  ),
  hr: () => <hr className="my-12 border-line" />,
}
