import { Client, StatusDisplayType } from '@xhayper/discord-rpc'
import { ActivityType } from 'discord-api-types/v10'

// Discord Rich Presence is a *local* connection to the Discord desktop
// client running on this machine (over a named pipe on Windows) — there is
// no OAuth "account linking" step, and no server of ours involved. Whatever
// Discord account is logged into the local client is the one the activity
// shows up on. This is the same mechanism Spotify and games use, and it's
// the only sanctioned way to do this: driving a real user's presence any
// other way (e.g. a bot/self-bot puppeting the account over the gateway)
// is against Discord's terms.
//
// The Client ID identifies the Noeul application itself (registered once in
// the Discord Developer Portal), not the end user.
const DISCORD_CLIENT_ID = '1541455432520958032'
const RETRY_DELAY_MS = 15000

let client: Client | null = null
let connected = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let stopped = false

function scheduleRetry(): void {
  if (stopped || retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    connectDiscord()
  }, RETRY_DELAY_MS)
}

// Always-on: connects as soon as Discord's local client is reachable, and
// keeps quietly retrying in the background if it isn't (or disconnects) —
// there's no settings UI for this to surface status to, so failures just
// resolve themselves whenever Discord happens to be open.
export async function connectDiscord(): Promise<void> {
  if (stopped) return
  const newClient = new Client({ clientId: DISCORD_CLIENT_ID })
  client = newClient

  newClient.on('ready', () => {
    if (client !== newClient) return
    connected = true
  })

  newClient.on('disconnected', () => {
    if (client !== newClient) return
    connected = false
    scheduleRetry()
  })

  newClient.login().catch(() => {
    if (client === newClient && !connected) scheduleRetry()
  })

  // login() hangs indefinitely rather than rejecting when the Discord
  // desktop app isn't running at all (there's no pipe to fail against) —
  // a timeout is the only way this ever moves on to a retry in that case.
  setTimeout(() => {
    if (client === newClient && !connected) scheduleRetry()
  }, 8000)
}

export async function disconnectDiscord(): Promise<void> {
  stopped = true
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  const dying = client
  client = null
  connected = false
  if (dying) {
    try {
      await dying.destroy()
    } catch {
      // Already gone (Discord quit, pipe closed) — nothing to clean up.
    }
  }
}

export interface ActivityInput {
  title: string
  artist: string
  thumbnail: string | null
  progress: number
  duration: number
  isPlaying: boolean
}

export async function updateDiscordActivity(input: ActivityInput): Promise<void> {
  if (!client || !connected) return
  const now = Date.now()
  try {
    await client.user?.setActivity({
      type: ActivityType.Listening,
      details: input.title,
      state: input.isPlaying ? input.artist : `${input.artist} · Paused`,
      // Discord's local RPC only picks up an external image if the URL is
      // passed through the same field normally used for an uploaded asset
      // key — the library's separate largeImageUrl field targets a newer
      // OAuth-gated flow that doesn't apply to a plain desktop IPC session,
      // and silently renders nothing (falling back to largeImageText as a
      // caption in place of the missing art).
      largeImageKey: input.thumbnail ?? undefined,
      largeImageText: input.title,
      // Compact views (friends list, member list) show one line of text next
      // to the music-note icon — the artist reads better there than the app
      // name or the full title.
      statusDisplayType: StatusDisplayType.STATE,
      // A single fixed badge, uploaded once to the Noeul application as a
      // Rich Presence Art Asset named exactly "logo". Using a key (not a
      // URL) here is deliberate: it's the one piece of this that has to be
      // stable regardless of what's playing.
      smallImageKey: 'logo',
      smallImageText: 'Noeul',
      // Only set while actually playing — Discord's client renders a
      // live-moving progress bar off these timestamps, which would keep
      // crawling forward even while paused if left in place.
      ...(input.isPlaying && input.duration > 0
        ? { startTimestamp: now - input.progress * 1000, endTimestamp: now + (input.duration - input.progress) * 1000 }
        : {})
    })
  } catch {
    // Discord quitting mid-session, a transient IPC hiccup, etc. — the
    // next natural update (next track, next play/pause) will just retry.
  }
}

export async function clearDiscordActivity(): Promise<void> {
  if (!client || !connected) return
  try {
    await client.user?.clearActivity()
  } catch {
    // ignore, same reasoning as above
  }
}
