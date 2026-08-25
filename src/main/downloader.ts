import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, openSync, readSync, closeSync } from 'fs'
import { join } from 'path'
import type YTDlpWrapType from 'yt-dlp-wrap-plus'
import ffmpegPath from 'ffmpeg-static'
import NodeID3 from 'node-id3'

// electron-vite externalizes this dep for the main process, so esbuild
// leaves `import YTDlpWrap from ...` as a plain `require()` with no
// default-export interop — it ends up bound to the whole `{ default: Class }`
// module object, not the class. `import * as X` doesn't fix it either: this
// module already has its own `.default` key without an `__esModule` marker,
// which esbuild's namespace-interop helper mistakes for a case where it
// should synthesize ANOTHER `.default` wrapping the whole module, so
// `X.default` ends up back at `{ default: Class }` again. A literal
// `require()` call is the one thing esbuild leaves untouched.
const YTDlpWrap: typeof YTDlpWrapType = require('yt-dlp-wrap-plus').default

const binDir = join(app.getPath('userData'), 'bin')
const ytDlpPath = join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')

let wrapPromise: Promise<InstanceType<typeof YTDlpWrap>> | null = null

async function getWrap(): Promise<InstanceType<typeof YTDlpWrap>> {
  if (!wrapPromise) {
    wrapPromise = (async () => {
      if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true })
      if (!existsSync(ytDlpPath)) {
        await YTDlpWrap.downloadFromGithub(ytDlpPath)
      }
      return new YTDlpWrap(ytDlpPath)
    })()
  }
  return wrapPromise
}

const videoUrl = (id: string): string => `https://music.youtube.com/watch?v=${id}`

// yt-dlp's usual audio-only DASH formats (webm/opus, m4a) are only exposed
// by clients that also require passing YouTube's bot-check. The 'android'
// client sidesteps that check entirely but only exposes one legacy muxed
// format, so the selector has to fall back to "best available" rather than
// insisting on an audio-only stream.
const AUDIO_FORMAT = 'bestaudio/best'

const streamCacheDir = join(app.getPath('userData'), 'stream-cache')

// Checks the actual file header rather than trusting size/extension — the
// two containers this app ever produces (webm and mp4/m4a) each have a
// distinctive magic-byte signature. Confirmed directly against real
// downloads of both: webm starts with the EBML header 1A 45 DF A3; mp4/m4a
// has the ASCII bytes "ftyp" at offset 4. Anything else means the file is
// corrupt or truncated, whatever produced it.
function isValidMediaFile(filePath: string): boolean {
  let fd: number
  try {
    fd = openSync(filePath, 'r')
  } catch {
    // e.g. a transient lock from antivirus scanning a just-written file —
    // treat as not-yet-usable rather than crashing the whole lookup.
    return false
  }
  try {
    const buf = Buffer.alloc(8)
    const bytesRead = readSync(fd, buf, 0, 8, 0)
    if (bytesRead < 8) return false
    if (buf.readUInt32BE(0) === 0x1a45dfa3) return true
    if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return true
    return false
  } finally {
    closeSync(fd)
  }
}

// yt-dlp writes to a `<name>.<ext>.part` file during download and only
// renames it to the final name on success — a filename like
// `<videoId>.part` still starts with `<videoId>.`, so a plain prefix match
// can pick up a leftover partial download from an attempt that failed or
// got interrupted (app closed mid-download, an exhausted bot-check retry,
// a corrupted file from an earlier, buggier version of this code, etc.)
// and hand a broken file straight to the audio element, which correctly
// refuses to play it. Skip in-progress files and verify the match is
// actually valid media; clean up anything that isn't so the next attempt
// re-downloads instead of tripping over it again.
function findCached(videoId: string): string | null {
  if (!existsSync(streamCacheDir)) return null
  const entries = readdirSync(streamCacheDir).filter((f) => f.startsWith(`${videoId}.`) && !f.endsWith('.part') && !f.endsWith('.ytdl'))

  for (const entry of entries) {
    const filePath = join(streamCacheDir, entry)
    if (statSync(filePath).size > 0 && isValidMediaFile(filePath)) return filePath
    unlinkSync(filePath)
  }
  return null
}

const BOT_CHECK_PATTERN = /sign in to confirm|not a bot/i
const BROWSER_CANDIDATES = ['edge', 'chrome', 'firefox', 'brave'] as const
type Browser = (typeof BROWSER_CANDIDATES)[number]
type ClientMode = 'default' | 'android'

// Once something works, keep using it — skip the trial-and-error on every
// subsequent call within this run.
let workingClient: ClientMode = 'default'
let workingBrowser: Browser | null = null

const withClient = (args: string[], client: ClientMode): string[] =>
  client === 'android' ? [...args, '--extractor-args', 'youtube:player_client=android'] : args

const withCookies = (args: string[], browser: Browser | null): string[] =>
  browser ? [...args, '--cookies-from-browser', browser] : args

/**
 * YouTube increasingly responds to plain (unauthenticated, default-client)
 * yt-dlp requests with a "Sign in to confirm you're not a bot" check. Two
 * independent, verified workarounds, tried in order of how little they ask
 * of the user:
 *  1. Re-request as the 'android' client — it isn't subject to the same
 *     bot-check and needs no login, though it only exposes one lower-quality
 *     muxed format (confirmed reliable across multiple videos in testing).
 *  2. Borrow cookies from a browser the user is already logged into YouTube
 *     with, recovering full quality — a last resort since it depends on the
 *     user having done that.
 * Only engages either fallback on the specific bot-check error — a genuine
 * network/format error shouldn't burn time on workarounds that can't fix it.
 */
async function execYtDlp(wrap: InstanceType<typeof YTDlpWrap>, args: string[]): Promise<string> {
  try {
    return await wrap.execPromise(withCookies(withClient(args, workingClient), workingBrowser))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!BOT_CHECK_PATTERN.test(message)) throw err

    const fallbackClient: ClientMode = workingClient === 'android' ? 'default' : 'android'
    try {
      const result = await wrap.execPromise(withClient(args, fallbackClient))
      workingClient = fallbackClient
      return result
    } catch {
      // fall through to cookies
    }

    for (const browser of BROWSER_CANDIDATES) {
      if (browser === workingBrowser) continue
      try {
        const result = await wrap.execPromise(withClient(withCookies(args, browser), workingClient))
        workingBrowser = browser
        return result
      } catch {
        // try the next browser
      }
    }
    throw err
  }
}

/**
 * Downloads a track to a local cache file and returns its path, instead of
 * live-piping audio bytes to the renderer through a custom protocol. Several
 * rounds of trying to make that live-streaming path work reliably (an
 * aborted-stream/Readable.toWeb bug, then HTTP Range corruption once
 * Content-Length was added) kept surfacing new failure modes that were hard
 * to verify without a real Electron window. Playing a genuine local file via
 * a plain file:// URL is the same well-tested mechanism the library already
 * uses, so this trades instant-start streaming for reliability: a brand-new
 * track takes as long as the download, but is instant on replay.
 */
export async function resolvePlayableFile(videoId: string): Promise<string> {
  const cached = findCached(videoId)
  if (cached) return cached

  const wrap = await getWrap()
  if (!existsSync(streamCacheDir)) mkdirSync(streamCacheDir, { recursive: true })

  // yt-dlp resumes from a matching .part file by default — a leftover one
  // from an earlier failed/interrupted attempt (possibly even a different
  // format, if the client fallback picked something else that time) could
  // poison a fresh download too, so clear it first.
  for (const stale of readdirSync(streamCacheDir).filter((f) => f.startsWith(`${videoId}.`))) {
    unlinkSync(join(streamCacheDir, stale))
  }

  await execYtDlp(wrap, [
    videoUrl(videoId),
    '-f',
    AUDIO_FORMAT,
    '--no-playlist',
    '--quiet',
    '--no-warnings',
    '-o',
    join(streamCacheDir, `${videoId}.%(ext)s`)
  ])

  const filePath = findCached(videoId)
  if (!filePath) throw new Error('yt-dlp did not produce an output file')
  return filePath
}

export interface DownloadMeta {
  id: string
  title: string
  artist: string
  album?: string | null
  thumbnail?: string | null
}

export async function downloadSong(meta: DownloadMeta, destDir: string): Promise<string> {
  const wrap = await getWrap()
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })

  const safeName = `${meta.artist} - ${meta.title}`.replace(/[\\/:*?"<>|]/g, '_')
  const outputTemplate = join(destDir, `${safeName}.%(ext)s`)

  await execYtDlp(wrap, [
    videoUrl(meta.id),
    '-f',
    AUDIO_FORMAT,
    '--no-playlist',
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--ffmpeg-location',
    ffmpegPath as string,
    '-o',
    outputTemplate
  ])

  const filePath = join(destDir, `${safeName}.mp3`)

  const tags: NodeID3.Tags = {
    title: meta.title,
    artist: meta.artist,
    album: meta.album ?? undefined
  }
  NodeID3.update(tags, filePath)

  return filePath
}
