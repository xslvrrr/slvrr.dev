import { PATH, type V2 } from './stations'

/**
 * The walkable path as a dense polyline with rounded corners, measured by
 * distance along it, so the camera can glide around turns instead of
 * snapping. `at(s)` gives a point `s` metres along; `heading(s)` the yaw.
 */
export interface Walk {
  points: [number, number][]
  /** Cumulative distance at each point. */
  dist: number[]
  length: number
  at(s: number): [number, number]
  /** Yaw (three.js rotation.y) facing along the path at `s`, looking a little ahead. */
  heading(s: number): number
  /** Distance along the path of the point closest to `p`. */
  project(p: V2): number
}

/** Yaw that looks from a to b (three.js: 0 looks down -z). */
export const yawTo = (ax: number, az: number, bx: number, bz: number) =>
  Math.atan2(-(bx - ax), -(bz - az))

export function buildWalk(radius = 3.5, step = 0.25): Walk {
  const pts: [number, number][] = []
  const push = (x: number, z: number) => {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(x - last[0], z - last[1]) > 1e-4) pts.push([x, z])
  }
  const lineTo = (x0: number, z0: number, x1: number, z1: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step))
    for (let i = 0; i <= n; i++) push(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)
  }

  let cur: V2 = PATH[0]
  for (let i = 1; i < PATH.length; i++) {
    const b = PATH[i]
    const c = PATH[i + 1]
    if (!c) {
      lineTo(cur[0], cur[1], b[0], b[1])
      break
    }
    // Round the corner at b with a quadratic curve between two points `r` either side.
    const inLen = Math.hypot(b[0] - cur[0], b[1] - cur[1])
    const outLen = Math.hypot(c[0] - b[0], c[1] - b[1])
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const p0: V2 = [
      b[0] - ((b[0] - cur[0]) / inLen) * r,
      b[1] - ((b[1] - cur[1]) / inLen) * r,
    ]
    const p2: V2 = [
      b[0] + ((c[0] - b[0]) / outLen) * r,
      b[1] + ((c[1] - b[1]) / outLen) * r,
    ]
    lineTo(cur[0], cur[1], p0[0], p0[1])
    const n = Math.ceil((r * 1.6) / step)
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      push(
        u * u * p0[0] + 2 * u * t * b[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * b[1] + t * t * p2[1],
      )
    }
    cur = p2
  }

  const dist = [0]
  for (let i = 1; i < pts.length; i++) {
    dist.push(
      dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    )
  }
  const length = dist[dist.length - 1]

  const at = (s: number): [number, number] => {
    s = Math.min(length, Math.max(0, s))
    let lo = 0
    let hi = dist.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (dist[mid] <= s) lo = mid
      else hi = mid
    }
    const span = dist[hi] - dist[lo] || 1
    const t = (s - dist[lo]) / span
    return [
      pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t,
      pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t,
    ]
  }

  return {
    points: pts,
    dist,
    length,
    at,
    heading(s) {
      // Look slightly ahead so turns start before the corner, like a person would.
      const a = at(Math.min(s, length - 1.2) - 0.3)
      const b = at(Math.min(s, length - 1.2) + 1.6)
      return yawTo(a[0], a[1], b[0], b[1])
    },
    project(p) {
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < pts.length; i++) {
        const d = (pts[i][0] - p[0]) ** 2 + (pts[i][1] - p[1]) ** 2
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return dist[best]
    },
  }
}
