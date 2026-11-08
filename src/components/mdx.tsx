import type { MDXComponents } from 'mdx/types'

/** Styling for elements inside notes (src/content/notes/*.mdx). */
export const mdxComponents: MDXComponents = {
  h2: (p) => (
    <h2
      className="mt-14 mb-4 font-display text-4xl leading-none text-fg md:text-5xl"
      {...p}
    />
  ),
  h3: (p) => <h3 className="mt-10 mb-3 font-display text-3xl leading-none" {...p} />,
  p: (p) => <p className="my-5 text-lg leading-relaxed text-fg-muted" {...p} />,
  a: (p) => (
    <a
      className="text-fg underline decoration-glass-2 decoration-2 underline-offset-4 hover:decoration-glass-1"
      target={p.href?.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      {...p}
    />
  ),
  strong: (p) => <strong className="font-semibold text-fg" {...p} />,
  ul: (p) => (
    <ul
      className="my-5 list-disc space-y-2 pl-6 text-lg text-fg-muted marker:text-glass-2"
      {...p}
    />
  ),
  ol: (p) => (
    <ol className="my-5 list-decimal space-y-2 pl-6 text-lg text-fg-muted" {...p} />
  ),
  blockquote: (p) => (
    <blockquote className="my-8 border-l-4 border-glass-2 pl-6 text-fg" {...p} />
  ),
  pre: (p) => (
    <pre
      className="panel my-8 overflow-x-auto p-5 font-mono text-base leading-relaxed"
      {...p}
    />
  ),
  code: (p) => (
    <code className="bg-white/5 px-1.5 py-0.5 font-mono text-[0.8em]" {...p} />
  ),
  hr: () => <hr className="my-12 border-t-2 border-dashed border-line" />,
}
