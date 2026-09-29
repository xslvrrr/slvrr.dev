/**
 * Fixed page backdrop: slow drifting iridescent glows under an SVG film grain.
 * Pure CSS/SVG so it costs almost nothing.
 */
export function GrainBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-ink" />
      <div className="glow left-[-20vmax] top-[-10vmax] bg-iri-2 [animation-duration:26s]" />
      <div className="glow right-[-25vmax] top-[30vh] bg-iri-1 [animation-delay:-8s] [animation-duration:32s]" />
      <div className="glow bottom-[-30vmax] left-[20vw] bg-iri-3 [animation-delay:-16s] [animation-duration:38s]" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07] mix-blend-overlay">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  )
}
