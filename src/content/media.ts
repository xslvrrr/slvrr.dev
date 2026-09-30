import type { MediaItem } from './types'

// Favourites on rotation. Covers are saved to public/covers/ by `npm run covers`
// (run it after adding an item); without one, a generated tile is shown.
export const media: MediaItem[] = [
  {
    kind: 'album',
    title: "I Didn't Mean to Haunt You",
    by: 'Quadeca',
    href: 'https://open.spotify.com/album/3c0NHNo2Gn0X7uARad3hGv',
  },
  {
    kind: 'album',
    title: 'OFFLINE!',
    by: 'JPEGMAFIA',
    href: 'https://open.spotify.com/album/7KfzrD1StrNWhhx4GGlwF4',
  },
  {
    kind: 'album',
    title: 'Atrocity Exhibition',
    by: 'Danny Brown',
    href: 'https://open.spotify.com/album/3A1vnUJDPz0xYMful9pO4I',
  },
  {
    kind: 'album',
    title: 'Pain to Power',
    by: 'Maruja',
    href: 'https://open.spotify.com/album/6wymdowW8HbQ4H3nVs93Hj',
  },
  {
    // Never released to streaming; it lives on YouTube. The cover is the plain pink it's known for.
    kind: 'ep',
    title: 'solace',
    by: 'Earl Sweatshirt',
    href: 'https://www.youtube.com/watch?v=d3q_0UP6sck',
    swatch: '#f88bb4',
  },
  {
    kind: 'album',
    title: 'Lift Your Skinny Fists Like Antennas to Heaven',
    by: 'Godspeed You! Black Emperor',
    href: 'https://open.spotify.com/album/2rT82YYlV9UoxBYLIezkRq',
  },
]
