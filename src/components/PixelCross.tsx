/** A small pixel-art cross (5×7 pixels), drawn in the current text colour. */
export function PixelCross({ className = 'h-[1em] w-[0.72em]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 5 7"
      className={className}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden
    >
      <path d="M2 0h1v7H2zM0 2h5v1H0z" />
    </svg>
  )
}
