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
 * The Discord account must be in the Lanyard Discord server
 * (https://discord.gg/lanyard), otherwise Lanyard replies with an empty object
 * and `state` becomes "unmonitored".
 */
export type LanyardState = 'off' | 'connecting' | 'live' | 'unmonitored'

/** Lanyard sends `{}` for accounts it isn't tracking, so check the shape. */
function isPresence(d: unknown): d is LanyardPresence {
  const p = d as Partial<LanyardPresence> | null
  return (
    !!p &&
    typeof p === 'object' &&
    !!p.discord_user &&
    typeof p.discord_status === 'string'
  )
}

export function useLanyard(userId: string) {
  const [presence, setPresence] = useState<LanyardPresence | null>(null)
  const [unmonitored, setUnmonitored] = useState(false)

  useEffect(() => {
    if (!userId) return
    let ws: WebSocket | null = null
    let heartbeat: number | undefined
    let retry: number | undefined
    let closed = false
    // Reconnect with exponential backoff (5s → 60s) instead of hammering the socket.
    let backoff = 5_000

    const connect = () => {
      ws = new WebSocket(SOCKET)
      ws.onmessage = (e) => {
        let msg
        try {
          msg = JSON.parse(e.data as string)
        } catch {
          return
        }
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
          backoff = 5_000
          if (isPresence(msg.d)) {
            setPresence({ ...msg.d, activities: msg.d.activities ?? [] })
            setUnmonitored(false)
          } else {
            setPresence(null)
            setUnmonitored(true)
            console.info(
              '[slvrr] Lanyard is not monitoring this Discord account. Join https://discord.gg/lanyard to show live presence.',
            )
          }
        }
      }
      ws.onclose = () => {
        window.clearInterval(heartbeat)
        if (closed) return
        retry = window.setTimeout(connect, backoff)
        backoff = Math.min(backoff * 2, 60_000)
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

  const state: LanyardState = !userId
    ? 'off'
    : presence
      ? 'live'
      : unmonitored
        ? 'unmonitored'
        : 'connecting'
  return { presence, state }
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
