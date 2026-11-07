import { GLASS, SHADE, type Layer } from './layers'

/**
 * Hand-drawn pixel-art statues, one character per pixel:
 *
 *   .  empty        #  marble         +  marble in shadow (folds, feathers)
 *   =  highlight    *  brightest      :  darkness (a hood, a doorway)
 *   o  candlelight  @  flame
 *
 * Sprites marked `mirror` are drawn as their left half, up to and including
 * the centre column, and reflected. The shader adds moonlight to the edges
 * that face the moon, so the art only needs the shapes and the folds.
 */
export interface Sprite {
  rows: string[]
  mirror?: boolean
}

export const sprites = {
  /** Praying angel, wings raised. */
  angel: {
    mirror: true,
    rows: [
      '...#..........',
      '..##..........',
      '..###.........',
      '.####.........',
      '.##+#.........',
      '###+##.....###',
      '##+###....####',
      '##+###....####',
      '#+####....####',
      '#+###+.....###',
      '.+##+#......##',
      '.##+##....####',
      '..#+###..#####',
      '..##+##.######',
      '...#+#..######',
      '...##+..#####=',
      '....#+..#####=',
      '....##...####=',
      '.....#..######',
      '........######',
      '........###+##',
      '.......####+##',
      '.......###+###',
      '.......###+###',
      '......####+###',
      '......###+####',
      '......###+####',
      '.....####+####',
      '.....###+#####',
      '.....###+#####',
      '....####+#####',
      '....##########',
      '...###########',
    ],
  },
  /** A herald angel sounding a long trumpet. */
  herald: {
    rows: [
      '...........................##.',
      '..........................###.',
      '..##.....................####.',
      '..###...................=###..',
      '..####.................=##....',
      '.#####................=#......',
      '.##+##...............=#.......',
      '.##+###.....###.....=#........',
      '##+####....####....=#.........',
      '##+###+...######..=#..........',
      '#+###+#...######.=#...........',
      '#+##+##...#######.............',
      '#+#+###....####...............',
      '.+#+##.....###................',
      '.##+##...#######=.............',
      '..##+#..#########=............',
      '..#+##..##########............',
      '...#+#..#########.............',
      '...##...########..............',
      '....#...########..............',
      '........#######+..............',
      '........######+#..............',
      '.......#######+#..............',
      '.......######+##..............',
      '.......######+##..............',
      '......#######+###.............',
      '......######+####.............',
      '......######+####.............',
      '.....#######+#####............',
      '.....##################.......',
      '....###################.......',
    ],
  },
  /** An angel kneeling with her face in her hands, wings folded. */
  weeper: {
    rows: [
      '...............##.....',
      '..............####....',
      '.............#####....',
      '............######+...',
      '...........#######+...',
      '..###.....#######+#...',
      '.#####...#######+##...',
      '.######.#######+##....',
      '.#####=.######+##.....',
      '..####=.#####+##......',
      '...#####.###+##.......',
      '....######.##.........',
      '....#########.........',
      '...###########........',
      '...######+#####.......',
      '...#####+#######......',
      '..#####+#########.....',
      '..####+###########....',
      '.####+#############...',
      '######################',
    ],
  },
  /** A hooded monk holding up a lantern. */
  monk: {
    rows: [
      '......###......',
      '.....#####.....',
      '....#######....',
      '....##:::##....',
      '....#:::::#....',
      '....#:::::#....',
      '....##:::##....',
      '...#########...',
      '..###########..',
      '..###########..',
      '..####+######=.',
      '..####+#####=#=',
      '..###+#####..=.',
      '..###+#####.###',
      '..###+#####.#o#',
      '..###+#####.#@#',
      '..###+#####.#o#',
      '..###+#####.###',
      '..##+######....',
      '..##+######....',
      '..##+######....',
      '.###+#######...',
      '.##+########...',
      '.##+########...',
      '.##+########...',
      '###+#########..',
      '##+##########..',
      '#############..',
    ],
  },
  /** A veiled Madonna with a halo, hands crossed. */
  madonna: {
    mirror: true,
    rows: [
      '...======',
      '..=......',
      '.=....###',
      '.=...####',
      '=...###==',
      '=...##===',
      '=...##===',
      '.=..###==',
      '.=.######',
      '..#######',
      '.########',
      '.#####=##',
      '.####=#=#',
      '.#####=##',
      '.########',
      '.######+#',
      '..#####+#',
      '..####+##',
      '..####+##',
      '..####+##',
      '.#####+##',
      '.####+###',
      '.####+###',
      '#####+###',
      '#########',
    ],
  },
  /** A small winged cherub. */
  cherub: {
    mirror: true,
    rows: [
      '.....##',
      '....###',
      '.#..###',
      '##..###',
      '###..##',
      '.##+###',
      '..#####',
      '..#####',
      '...####',
      '...####',
      '...##.#',
      '..###..',
    ],
  },
  /** A portrait bust. */
  bust: {
    mirror: true,
    rows: [
      '..###',
      '.####',
      '.####',
      '.####',
      '..###',
      '...##',
      '.####',
      '#####',
      '#####',
      '..===',
      '.####',
    ],
  },
  /** A funerary urn. */
  urn: {
    mirror: true,
    rows: [
      '..====',
      '...###',
      '..####',
      '.#####',
      '######',
      '######',
      '+#####',
      '.#####',
      '..####',
      '...###',
      '....##',
      '..####',
      '.=====',
    ],
  },
} satisfies Record<string, Sprite>

export type SpriteName = keyof typeof sprites

function expand(sprite: Sprite): string[] {
  if (!sprite.mirror) return sprite.rows
  return sprite.rows.map((r) => r + [...r.slice(0, -1)].reverse().join(''))
}

const cache = new Map<Sprite, string[]>()

export function spriteSize(name: SpriteName) {
  const rows = expand(sprites[name])
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length }
}

/**
 * Draws a sprite with its bottom-centre at (x, base). `flip` mirrors it
 * horizontally (a statue facing the other way).
 */
export function stamp(
  L: Layer,
  name: SpriteName,
  x: number,
  base: number,
  { flip = false, seed = 0 }: { flip?: boolean; seed?: number } = {},
) {
  const sprite: Sprite = sprites[name]
  let rows = cache.get(sprite)
  if (!rows) {
    rows = expand(sprite)
    cache.set(sprite, rows)
  }
  const w = Math.max(...rows.map((r) => r.length))
  const left = Math.round(x - (w - 1) / 2)
  const top = Math.round(base) - rows.length + 1
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i]
      if (c === '.' || c === ' ') continue
      const px = flip ? left + (w - 1 - i) : left + i
      const py = top + j
      // statues are pale marble, a step lighter than the stone around them
      if (c === '#') L.set(px, py, SHADE.trim)
      else if (c === '+') L.set(px, py, SHADE.masonry)
      else if (c === '=') L.set(px, py, SHADE.bright)
      else if (c === '*') L.set(px, py, SHADE.bright)
      else if (c === ':') L.set(px, py, SHADE.body, GLASS.lead)
      else if (c === 'o') L.set(px, py, SHADE.body, GLASS.candle, seed)
      else if (c === '@') L.set(px, py, SHADE.body, GLASS.flame, seed)
    }
  })
  return { w, h: rows.length }
}
