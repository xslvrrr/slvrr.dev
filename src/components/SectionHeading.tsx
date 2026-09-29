import { TextReveal } from '@/fx/TextReveal'

export function SectionHeading({
  index,
  eyebrow,
  title,
}: {
  index: string
  eyebrow: string
  title: string
}) {
  return (
    <div className="mb-12 flex flex-col gap-4 md:mb-20">
      <p className="eyebrow flex items-center gap-3">
        <span className="text-iri font-semibold">{index}</span>
        <span className="h-px w-10 bg-line-strong" />
        {eyebrow}
      </p>
      <TextReveal as="h2" text={title} className="section-title text-chrome" />
    </div>
  )
}
