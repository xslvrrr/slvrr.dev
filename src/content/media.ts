import type { MediaItem } from './types'

// Placeholder favourites: albums, games, shows or books on rotation.
export const media: MediaItem[] = [
  { kind: 'album', title: 'Album Title', by: 'Artist' },
  { kind: 'album', title: 'Another Album', by: 'Another Artist' },
  { kind: 'game', title: 'Favourite Game', by: 'Studio' },
  { kind: 'album', title: 'Deep Cut', by: 'Some Band' },
  { kind: 'show', title: 'Comfort Show', by: 'Network' },
  { kind: 'game', title: 'Endless Grind', by: 'Indie Dev' },
]
