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
    kind: 'game',
    title: 'Geometry Dash',
    by: 'RobTop Games',
    href: 'https://store.steampowered.com/app/322170/Geometry_Dash/',
    art: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/5a/d5/97/5ad5971d-b8ea-d82f-415f-f69be6bde65c/AppIcon-1x_U007emarketing-0-11-0-85-220-0.png/600x600bb.jpg',
  },
  {
    kind: 'album',
    title: 'Pain to Power',
    by: 'Maruja',
    href: 'https://open.spotify.com/album/6wymdowW8HbQ4H3nVs93Hj',
  },
  {
    // Never released to streaming; the 2015 YouTube upload is the only home it has.
    kind: 'album',
    title: 'solace',
    by: 'Earl Sweatshirt',
    href: 'https://www.youtube.com/watch?v=iC0cl_vCA1k',
    art: 'https://i.ytimg.com/vi/3Gr32wDm2xQ/maxresdefault.jpg',
  },
  {
    kind: 'game',
    title: 'Roblox',
    by: 'Roblox',
    href: 'https://www.roblox.com/',
    art: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/a2/5d/b7/a25db7ef-5fd9-160f-3158-5753572d2fdb/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/600x600bb.jpg',
  },
]
