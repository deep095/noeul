import { useCallback, useEffect, useRef, useState } from 'react'
import type { Track } from './types'

export function usePlayer(): {
  current: Track | null
  /** Bumped on every play() call, including replaying the same track — a more reliable React `key` for "the currently displayed track's art/meta" than current.id, which a retry or a duplicate queue entry could repeat. */
  playSeq: number
  isPlaying: boolean
  isLoading: boolean
  progress: number
  duration: number
  volume: number
  error: string | null
  play: (track: Track, queue?: Track[]) => Promise<void>
  toggle: () => void
  seek: (seconds: number) => void
  setVolume: (v: number) => void
  next: () => void
  prev: () => boolean
} {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<Track[]>([])
  const currentRef = useRef<Track | null>(null)
  // Used by the 'ended' listener below, which is registered once on mount
  // and would otherwise only ever see the closure's original (stale)
  // version of the continuation logic.
  const continueRef = useRef<() => Promise<boolean>>(async () => false)
  const playTokenRef = useRef(0)
  const [current, setCurrent] = useState<Track | null>(null)
  const [playSeq, setPlaySeq] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const audio = new Audio()
    audio.volume = volume
    audioRef.current = audio

    const onTime = (): void => setProgress(audio.currentTime)
    const onDuration = (): void => setDuration(audio.duration || 0)
    // continueRef tries, in order: the next track already in the queue,
    // then a real autoplay continuation (see continueOrAutoplay below). Only
    // if both come up empty — end of queue AND no up-next available — does
    // this fall back to parking at the start of the current track, so
    // pressing Play again actually does something instead of instantly
    // re-firing 'ended'.
    const onEnded = (): void => {
      continueRef.current().then((advanced) => {
        if (!advanced) {
          audio.currentTime = 0
          setProgress(0)
        }
      })
    }
    const onPlay = (): void => setIsPlaying(true)
    const onPause = (): void => setIsPlaying(false)
    const onError = (): void => {
      // A load that got superseded by a newer track can still dispatch a
      // stale 'error' event after the new one is already playing fine.
      // If audio is genuinely progressing right now, this is that noise —
      // not a real failure of what's currently loaded.
      if (!audio.paused && audio.currentTime > 0) return

      const code = audio.error?.code
      const reason =
        code === MediaError.MEDIA_ERR_NETWORK
          ? 'Network error while streaming'
          : code === MediaError.MEDIA_ERR_DECODE
            ? 'Could not decode audio'
            : code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
              ? 'This song is not available to stream'
              : 'Playback failed'
      setError(reason)
      setIsLoading(false)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const play = useCallback(async (track: Track, queue?: Track[]): Promise<void> => {
    const audio = audioRef.current
    if (!audio) return
    if (queue) queueRef.current = queue

    // Switching tracks quickly interrupts the previous audio.play() promise
    // (browser rejects it with "interrupted by a new load request"). Without
    // this token guard, that stale rejection lands after the new track has
    // already started playing and incorrectly overwrites its state.
    const token = ++playTokenRef.current

    // Without this, the UI switches to showing the new track (title, art,
    // loading spinner) immediately, but the *old* track's audio keeps
    // playing audibly until the new one finishes resolving — a jarring
    // mismatch between what's displayed and what's heard, especially since
    // resolving a brand-new track can take a few seconds. Cutting audio and
    // the displayed progress immediately keeps them in sync: silence +
    // spinner, then the new track, never the wrong song still sounding.
    audio.pause()
    setProgress(0)
    setDuration(0)

    currentRef.current = track
    setCurrent(track)
    setPlaySeq(token)
    setError(null)
    setIsLoading(true)
    try {
      const src = track.fileUrl ?? (await window.api.resolvePlayableUrl(track.id))
      // Resolving a fresh track can take a few seconds — if a newer play()
      // call came in while this one was awaiting, assigning audio.src now
      // would yank playback back to this stale track even after the newer
      // one already started successfully. Abandon quietly instead.
      if (playTokenRef.current !== token) return
      audio.src = src
      await audio.play()
    } catch (err) {
      // Same reasoning as the 'error' listener below: a superseded attempt
      // can still reject (audio.play() rejects with this exact browser
      // message — "Failed to load because no supported source was found" —
      // whenever whatever it was loading got interrupted) after a newer
      // track has already started playing. Only surface it if this is both
      // still the latest attempt AND nothing is actually playing right now.
      if (playTokenRef.current === token && audio.paused) {
        setError(err instanceof Error ? err.message : 'Failed to play song')
        // Leaving the old src in place would let a later, unrelated
        // audio.play() call (e.g. the Play/Pause button) silently resume
        // whatever track was loaded before this failed attempt, instead of
        // doing nothing or retrying the one the user actually asked for.
        audio.removeAttribute('src')
        audio.load()
      }
    } finally {
      if (playTokenRef.current === token) {
        setIsLoading(false)
      }
    }
  }, [])

  const toggle = useCallback((): void => {
    const audio = audioRef.current
    if (!audio || !current) return
    // A failed load leaves nothing playable queued up in the audio element
    // (see the error handling in play()) — plain audio.play() would just
    // fail again silently. Retrying the same track from scratch is what
    // pressing Play on a failed row should actually do.
    if (error || !audio.src) {
      play(current)
      return
    }
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [current, error, play])

  const seek = useCallback((seconds: number): void => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setProgress(seconds)
  }, [])

  const setVolume = useCallback((v: number): void => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = v
    setVolumeState(v)
  }, [])

  const stepQueue = useCallback(
    (direction: 1 | -1): boolean => {
      const queue = queueRef.current
      if (!current || queue.length === 0) return false
      const idx = queue.findIndex((t) => t.id === current.id)
      if (idx === -1) return false
      const nextIdx = idx + direction
      if (nextIdx < 0 || nextIdx >= queue.length) return false
      play(queue[nextIdx])
      return true
    },
    [current, play]
  )

  // Spotify/YT Music-style autoplay: once the explicit queue runs out,
  // don't just stop — pull YouTube Music's own "up next" mix for the track
  // that just finished (same algorithm that drives autoplay on
  // music.youtube.com) and keep going. The fetched songs are appended to
  // the queue so a further Next/Prev, or running out again, continues to
  // work the same way.
  const continueOrAutoplay = useCallback(async (): Promise<boolean> => {
    if (stepQueue(1)) return true

    const track = currentRef.current
    if (!track) return false

    setIsLoading(true)
    let upNext: Track[] = []
    try {
      upNext = await window.api.getUpNext(track.id)
    } catch {
      upNext = []
    }
    // Bail if a newer play() (the user picking something else while this
    // was fetching) has already taken over — starting an autoplay track
    // now would yank playback back to the old context.
    if (currentRef.current !== track) return true
    if (upNext.length === 0) {
      setIsLoading(false)
      return false
    }
    queueRef.current = [...queueRef.current, ...upNext]
    await play(upNext[0])
    return true
  }, [stepQueue, play])

  const next = useCallback((): void => {
    continueOrAutoplay()
  }, [continueOrAutoplay])
  const prev = useCallback((): boolean => stepQueue(-1), [stepQueue])
  continueRef.current = continueOrAutoplay

  return { current, playSeq, isPlaying, isLoading, progress, duration, volume, error, play, toggle, seek, setVolume, next, prev }
}
