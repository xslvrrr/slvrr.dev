import { useEffect, useState } from 'react'

export type DiscordStatus = 'online' | 'idle' | 'dnd' | 'offline'

export interface LanyardActivity {
  type: number
  name: string
  state?: string
  details?: string
  application_id?: string
  assets?: { large_image?: string; large_text?: string }
  timestamps?: { start?: number; end?: number }
}

export interface LanyardPresence {
  discord_status: DiscordStatus
  discord_user: {
    id: string
    username: string
    global_name: string | null
    avatar: string | null
  }
  activities: LanyardActivity[]
  listening_to_spotify: boolean
  spotify: {
    song: string
    artist: string
    album: string
    album_art_url: string
    track_id: string
  } | null
}

const SOCKET = 'wss://api.lanyard.rest/socket'

/**
 * Live Discord presence via Lanyard (https://github.com/Phineas/lanyard).
 * The Discord account must be in the Lanyard Discord server.
 */
export function useLanyard(userId: string) {
  const [presence, setPresence] = useState<LanyardPresence | null>(null)

  useEffect(() => {
    if (!userId) return
    let ws: WebSocket | null = null
    let heartbeat: number | undefined
    let retry: number | undefined
    let closed = false

    const connect = () => {
      ws = new WebSocket(SOCKET)
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string)
        if (msg.op === 1) {
          ws?.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }))
          heartbeat = window.setInterval(
            () => ws?.send(JSON.stringify({ op: 3 })),
            msg.d.heartbeat_interval,
          )
        } else if (
          msg.op === 0 &&
          (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE')
        ) {
          setPresence(msg.d as LanyardPresence)
        }
      }
      ws.onclose = () => {
        window.clearInterval(heartbeat)
        if (!closed) retry = window.setTimeout(connect, 5_000)
      }
    }
    connect()

    return () => {
      closed = true
      window.clearInterval(heartbeat)
      window.clearTimeout(retry)
      ws?.close()
    }
  }, [userId])

  return presence
}

export function avatarUrl(p: LanyardPresence) {
  const { id, avatar } = p.discord_user
  if (!avatar) return `https://cdn.discordapp.com/embed/avatars/0.png`
  const ext = avatar.startsWith('a_') ? 'gif' : 'webp'
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`
}

export function activityImage(a: LanyardActivity) {
  const img = a.assets?.large_image
  if (!img) return null
  if (img.startsWith('mp:external/')) {
    return `https://media.discordapp.net/external/${img.slice('mp:external/'.length)}`
  }
  if (a.application_id) {
    return `https://cdn.discordapp.com/app-assets/${a.application_id}/${img}.webp`
  }
  return null
}
