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
        <span className="text-glass-1">{index}</span>
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-0.5 w-1.5 bg-line-strong" />
          ))}
        </span>
        {eyebrow}
      </p>
      <TextReveal
        as="h2"
        text={title}
        className="section-title text-stone [filter:drop-shadow(4px_4px_0_rgb(0_0_0/0.85))]"
      />
    </div>
  )
}
