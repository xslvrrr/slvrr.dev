import * as THREE from 'three'
import type { LanyardPresence, LanyardState } from '@/hooks/useLanyard'
import { avatarUrl } from '@/hooks/useLanyard'
import type { PlayerState } from '@/lib/player'
import type { NowPlaying } from '@/lib/types'
import { profile } from '@/content/profile'

/**
 * The things in the churchyard that show live data, drawn into small canvases
 * the scene uses as textures: the floating Discord monitor, the now-playing
 * screen by the fountain, and the walkman's LCD. React feeds them (see
 * ScreenFeeds in World.tsx); they redraw only when the data changes.
 */
class Screen {
  readonly canvas = document.createElement('canvas')
  readonly ctx: CanvasRenderingContext2D
  readonly texture: THREE.CanvasTexture

  constructor(w: number, h: number) {
    this.canvas.width = w
    this.canvas.height = h
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.magFilter = THREE.NearestFilter
    this.texture.minFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false
    this.texture.colorSpace = THREE.SRGBColorSpace
  }

  /** A CRT's glass: dark, with scanlines and a faint glow in the middle. */
  crt(tint: string) {
    const { ctx, canvas } = this
    ctx.fillStyle = '#05080a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const g = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      4,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.7,
    )
    g.addColorStop(0, tint)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  scanlines() {
    const { ctx, canvas } = this
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    for (let y = 0; y < canvas.height; y += 2) ctx.fillRect(0, y, canvas.width, 1)
    this.texture.needsUpdate = true
  }

  text(
    t: string,
    x: number,
    y: number,
    size: number,
    color: string,
    font = 'VT323',
    max?: number,
  ) {
    const { ctx } = this
    ctx.font = `${size}px "${font}"`
    ctx.fillStyle = color
    ctx.textBaseline = 'top'
    let s = t
    if (max)
      while (s.length > 1 && ctx.measureText(s).width > max) s = s.slice(0, -2) + '…'
    ctx.fillText(s, x, y)
  }
}

const images = new Map<string, Promise<HTMLImageElement | null>>()
/** Loads a remote image for drawing into a texture (null if it can't be, e.g. no CORS). */
function image(url: string) {
  let p = images.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    images.set(url, p)
  }
  return p
}

const STATUS: Record<string, [string, string]> = {
  online: ['#43d17a', 'online'],
  idle: ['#f0b232', 'idle'],
  dnd: ['#f23f43', 'do not disturb'],
  offline: ['#80848e', 'offline'],
}

export function createScreens() {
  const discord = new Screen(160, 120)
  const music = new Screen(160, 120)
  const lcd = new Screen(64, 20)
  let discordToken = 0
  let musicToken = 0

  const drawDiscord = async (p: LanyardPresence | null, state: LanyardState) => {
    const token = ++discordToken
    const s = discord
    const avatar = p ? await image(avatarUrl(p)) : null
    if (token !== discordToken) return
    s.crt('rgba(70,110,160,0.35)')
    const { ctx } = s
    ctx.fillStyle = '#5865f2'
    ctx.fillRect(0, 0, 160, 14)
    s.text('DISCORD', 6, 1, 14, '#e8ecff')
    if (avatar) ctx.drawImage(avatar, 8, 22, 40, 40)
    else {
      ctx.fillStyle = '#2b2d31'
      ctx.fillRect(8, 22, 40, 40)
    }
    const name = p?.discord_user.global_name ?? p?.discord_user.username ?? profile.name
    s.text(name, 54, 20, 20, '#f2f0ea', 'Jersey 10', 100)
    const [color, label] = STATUS[p?.discord_status ?? 'offline']
    ctx.fillStyle = color
    ctx.fillRect(55, 45, 6, 6)
    s.text(
      state === 'live' ? label : state === 'connecting' ? '...' : 'offline',
      65,
      41,
      14,
      '#c8cbd4',
    )
    const custom = p?.activities.find((a) => a.type === 4)?.state
    const act = p?.activities.find((a) => a.type !== 4 && a.type !== 2)
    const lines: string[] = []
    if (p?.listening_to_spotify && p.spotify) lines.push('listening to', p.spotify.song)
    else if (act) lines.push(act.type === 3 ? 'watching' : 'playing', act.name)
    else lines.push(custom ?? 'nothing going on')
    lines.forEach((l, i) =>
      s.text(
        l,
        8,
        72 + i * 16,
        i === 1 ? 16 : 14,
        i === 1 ? '#f2f0ea' : '#8f95a3',
        'VT323',
        146,
      ),
    )
    s.scanlines()
  }

  const drawMusic = async (np: NowPlaying | null) => {
    const token = ++musicToken
    const s = music
    const art = np?.art ? await image(np.art) : null
    if (token !== musicToken) return
    s.crt('rgba(150,120,70,0.3)')
    const { ctx } = s
    s.text(
      np?.playing ? '▶ NOW PLAYING' : np ? 'LAST PLAYED' : 'NOW PLAYING',
      6,
      3,
      14,
      np?.playing ? '#9fe8a0' : '#b9b3a6',
    )
    if (art) ctx.drawImage(art, 6, 22, 52, 52)
    else {
      ctx.fillStyle = '#1c1a17'
      ctx.fillRect(6, 22, 52, 52)
      s.text('?', 26, 34, 24, '#55504a')
    }
    s.text(np?.track ?? 'silence', 64, 22, 18, '#f2f0ea', 'Jersey 10', 92)
    s.text(np?.artist ?? 'for now', 64, 42, 14, '#c9c2b4', 'VT323', 92)
    if (np?.album) s.text(np.album, 64, 56, 14, '#8a8478', 'VT323', 92)
    // an equalizer that only moves when it's live (redrawn by tick())
    s.scanlines()
  }

  let lcdText = ''
  let lastNp: NowPlaying | null = null
  let lastPlayer: PlayerState | null = null
  /**
   * The walkman's LCD always shows what slvrr is listening to right now (from
   * Last.fm), and what it's playing once you press play.
   */
  const lcdLine = () => {
    const st = lastPlayer
    const t = st?.track
    if (st?.status === 'loading') return 'TUNING IN...'
    if (st?.status === 'error') return t ? `NO PREVIEW - ${t.title}` : 'NO SIGNAL'
    if (st && t && (st.status === 'playing' || st.status === 'paused'))
      return `${st.status === 'playing' ? '▶' : '❚❚'} ${t.title} - ${t.artist}`
    if (lastNp)
      return `${lastNp.playing ? 'LIVE' : 'LAST'}: ${lastNp.track} - ${lastNp.artist}   F TO PLAY`
    return 'F TO PLAY'
  }
  let lcdOffset = 0
  const drawLcd = () => {
    const s = lcd
    const { ctx } = s
    ctx.fillStyle = '#7d8a5a'
    ctx.fillRect(0, 0, 64, 20)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let x = 0; x < 64; x += 2) ctx.fillRect(x, 0, 1, 20)
    ctx.font = '12px "VT323"'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#1d2412'
    const w = ctx.measureText(lcdText).width
    const x = w > 60 ? 2 - (lcdOffset % (w + 20)) : 2
    ctx.fillText(lcdText, x, 4)
    if (w > 60) ctx.fillText(lcdText, x + w + 20, 4)
    s.texture.needsUpdate = true
  }

  void drawDiscord(null, 'connecting')
  void drawMusic(null)
  drawLcd()

  return {
    discord: discord.texture,
    music: music.texture,
    lcd: lcd.texture,
    setDiscord: (p: LanyardPresence | null, state: LanyardState) =>
      void drawDiscord(p, state),
    setMusic(np: NowPlaying | null) {
      lastNp = np
      void drawMusic(np)
      lcdText = lcdLine()
      drawLcd()
    },
    setPlayer(state: PlayerState) {
      lastPlayer = state
      lcdText = lcdLine()
      drawLcd()
    },
    /** Scrolls long titles across the LCD (called a few times a second). */
    tick() {
      lcdOffset += 2
      drawLcd()
    },
  }
}

export type Screens = ReturnType<typeof createScreens>
