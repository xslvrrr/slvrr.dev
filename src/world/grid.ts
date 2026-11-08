/**
 * The churchyard's floor plan as a grid of 0.5 m cells. It decides where
 * hedges grow (any solid cell next to open ground), what you bump into, what
 * blocks your line of sight, and where "out of bounds" is.
 */
export const CELL = 0.5

export const Cell = {
  /** Solid ground behind the hedges (the default). */
  Hedge: 0,
  /** Open ground you can walk on. */
  Floor: 1,
  /** Walkable, but you're not supposed to be here. */
  OutOfBounds: 2,
  /** Something solid standing on open ground (a statue, a bench...). */
  Block: 3,
  /** The churchyard wall: solid, no hedge. */
  Wall: 4,
} as const
export type Cell = (typeof Cell)[keyof typeof Cell]

export class Grid {
  readonly x0: number
  readonly z0: number
  readonly w: number
  readonly h: number
  readonly cells: Uint8Array

  constructor(x0: number, z0: number, x1: number, z1: number) {
    this.x0 = x0
    this.z0 = z0
    this.w = Math.ceil((x1 - x0) / CELL)
    this.h = Math.ceil((z1 - z0) / CELL)
    this.cells = new Uint8Array(this.w * this.h) // all Hedge
  }

  /** Cell index of a world position (or -1 off the map). */
  index(x: number, z: number) {
    const i = Math.floor((x - this.x0) / CELL)
    const j = Math.floor((z - this.z0) / CELL)
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1
    return j * this.w + i
  }

  at(x: number, z: number): Cell {
    const k = this.index(x, z)
    return k < 0 ? Cell.Hedge : (this.cells[k] as Cell)
  }

  center(i: number, j: number): [number, number] {
    return [this.x0 + (i + 0.5) * CELL, this.z0 + (j + 0.5) * CELL]
  }

  /** Sets every cell whose centre is inside the rectangle (only overwriting `onlyOver`, if given). */
  rect(xa: number, za: number, xb: number, zb: number, type: Cell, onlyOver?: Cell[]) {
    const [x0, x1] = [Math.min(xa, xb), Math.max(xa, xb)]
    const [z0, z1] = [Math.min(za, zb), Math.max(za, zb)]
    for (let j = 0; j < this.h; j++) {
      const z = this.z0 + (j + 0.5) * CELL
      if (z < z0 || z > z1) continue
      for (let i = 0; i < this.w; i++) {
        const x = this.x0 + (i + 0.5) * CELL
        if (x < x0 || x > x1) continue
        const k = j * this.w + i
        if (onlyOver && !onlyOver.includes(this.cells[k] as Cell)) continue
        this.cells[k] = type
      }
    }
  }

  circle(cx: number, cz: number, r: number, type: Cell, onlyOver?: Cell[]) {
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++) {
        const [x, z] = this.center(i, j)
        if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue
        const k = j * this.w + i
        if (onlyOver && !onlyOver.includes(this.cells[k] as Cell)) continue
        this.cells[k] = type
      }
  }

  /** Marks a footprint as solid, but only where it's open ground. */
  block(cx: number, cz: number, hw: number, hd: number, rotY = 0) {
    const c = Math.cos(rotY)
    const s = Math.sin(rotY)
    const R = Math.hypot(hw, hd) + CELL
    for (let z = cz - R; z <= cz + R; z += CELL / 2)
      for (let x = cx - R; x <= cx + R; x += CELL / 2) {
        // into the footprint's own frame (three.js rotation about y)
        const dx = x - cx
        const dz = z - cz
        const lx = dx * c - dz * s
        const lz = dx * s + dz * c
        if (Math.abs(lx) > hw || Math.abs(lz) > hd) continue
        const k = this.index(x, z)
        if (k >= 0 && this.walkable(this.cells[k] as Cell)) this.cells[k] = Cell.Block
      }
  }

  solid(x: number, z: number) {
    const t = this.at(x, z)
    return t === Cell.Hedge || t === Cell.Block || t === Cell.Wall
  }

  walkable(t: Cell) {
    return t === Cell.Floor || t === Cell.OutOfBounds
  }

  /** Whether a circle of radius r at (x, z) overlaps anything solid. */
  hits(x: number, z: number, r: number) {
    const i0 = Math.floor((x - r - this.x0) / CELL)
    const i1 = Math.floor((x + r - this.x0) / CELL)
    const j0 = Math.floor((z - r - this.z0) / CELL)
    const j1 = Math.floor((z + r - this.z0) / CELL)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const t =
          i < 0 || j < 0 || i >= this.w || j >= this.h
            ? Cell.Hedge
            : this.cells[j * this.w + i]
        if (t === Cell.Floor || t === Cell.OutOfBounds) continue
        // closest point of the cell to the circle's centre
        const cx0 = this.x0 + i * CELL
        const cz0 = this.z0 + j * CELL
        const px = Math.max(cx0, Math.min(x, cx0 + CELL))
        const pz = Math.max(cz0, Math.min(z, cz0 + CELL))
        if ((px - x) ** 2 + (pz - z) ** 2 < r * r) return true
      }
    return false
  }

  /**
   * Moves a circle by (dx, dz), sliding along whatever it runs into. Small
   * sub-steps, each axis on its own, so corners don't snag.
   */
  move(x: number, z: number, dx: number, dz: number, r: number): [number, number] {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05))
    const sx = dx / n
    const sz = dz / n
    for (let k = 0; k < n; k++) {
      if (!this.hits(x + sx, z, r)) x += sx
      if (!this.hits(x, z + sz, r)) z += sz
    }
    return [x, z]
  }

  /** Whether you can see from a to b at eye height (hedges and walls block; objects don't). */
  sees(ax: number, az: number, bx: number, bz: number, skipEnd = 0.6) {
    const d = Math.hypot(bx - ax, bz - az)
    const n = Math.ceil(d / 0.2)
    for (let k = 1; k < n; k++) {
      const t = k / n
      if (d * (1 - t) < skipEnd) break
      const c = this.at(ax + (bx - ax) * t, az + (bz - az) * t)
      if (c === Cell.Hedge || c === Cell.Wall) return false
    }
    return true
  }

  /** Distance (in cells, up to `max`) from a cell to the nearest walkable cell. */
  distanceToOpen(i: number, j: number, max: number) {
    for (let d = 1; d <= max; d++)
      for (let b = -d; b <= d; b++)
        for (let a = -d; a <= d; a++) {
          if (Math.max(Math.abs(a), Math.abs(b)) !== d) continue
          const ii = i + a
          const jj = j + b
          if (ii < 0 || jj < 0 || ii >= this.w || jj >= this.h) continue
          if (this.walkable(this.cells[jj * this.w + ii] as Cell)) return d
        }
    return Infinity
  }
}
