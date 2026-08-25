import { useEffect, useState } from 'react'
import { AlertCircle, Music2, Play, RefreshCw } from 'lucide-react'
import type { HomeItem, HomeShelf, Playlist } from './types'
import NowPlayingBars from './NowPlayingBars'
import CardMenu from './CardMenu'
import SafeImage from './SafeImage'
import { onReveal } from './reveal'

interface Props {
  onPlaySong: (item: HomeItem, queue: HomeItem[]) => void
  activeId: string | null
  isPlaying: boolean
  libraryIds: Set<string>
  downloadingIds: Set<string>
  playlists: Playlist[]
  onDownload: (item: HomeItem) => void
  onAddToPlaylist: (playlistId: string, item: HomeItem) => void
  onCreatePlaylist: (name: string, item: HomeItem) => void
  /** A short history of recently played tracks, newest first — blended together to seed the recommendation shelf, so one odd play doesn't define the whole thing. */
  recentTracks: { id: string; title: string; artist: string }[]
  /** Bumped by the parent only when the shelf should actually re-fetch (returning to Home via the sidebar) — see the refresh-trigger note on the effect below for why this is separate from recentTracks itself. */
  refreshKey: number
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const SKELETON_SHELVES = [5, 6, 5]

interface ShelfProps {
  shelf: HomeShelf
  animationDelay: number
  activeId: string | null
  isPlaying: boolean
  libraryIds: Set<string>
  downloadingIds: Set<string>
  playlists: Playlist[]
  onPlaySong: (item: HomeItem, queue: HomeItem[]) => void
  onDownload: (item: HomeItem) => void
  onAddToPlaylist: (playlistId: string, item: HomeItem) => void
  onCreatePlaylist: (name: string, item: HomeItem) => void
  headingAction?: React.ReactNode
}

function Shelf({
  shelf,
  animationDelay,
  activeId,
  isPlaying,
  libraryIds,
  downloadingIds,
  playlists,
  onPlaySong,
  onDownload,
  onAddToPlaylist,
  onCreatePlaylist,
  headingAction
}: ShelfProps): React.JSX.Element {
  return (
    <section className="shelf" style={{ animationDelay: `${animationDelay}ms` }}>
      <div className="shelf-heading-row">
        <h2>{shelf.title}</h2>
        {headingAction}
      </div>
      <div className="shelf-row">
        {shelf.items.map((item, j) => {
          const isActive = activeId === item.id
          return (
            <div key={item.id} className="home-card card-in" style={{ animationDelay: `${j * 40}ms` }}>
              <div className="home-card-art-wrap reveal" onMouseMove={onReveal}>
                <button className="home-card-art" onClick={() => onPlaySong(item, shelf.items)} aria-label={`Play ${item.title}`}>
                  <SafeImage
                    src={item.thumbnail}
                    loading="lazy"
                    decoding="async"
                    fallback={
                      <div className="home-card-art-placeholder">
                        <Music2 size={22} />
                      </div>
                    }
                  />
                </button>
                {isActive && isPlaying ? (
                  <span className="art-now-playing home-card-now-playing">
                    <NowPlayingBars />
                  </span>
                ) : (
                  <span className="home-card-play" aria-hidden>
                    <Play size={16} fill="currentColor" />
                  </span>
                )}
                <CardMenu
                  inLibrary={libraryIds.has(item.id)}
                  isDownloading={downloadingIds.has(item.id)}
                  onDownload={() => onDownload(item)}
                  playlists={playlists}
                  onAddToPlaylist={(playlistId) => onAddToPlaylist(playlistId, item)}
                  onCreatePlaylist={(name) => onCreatePlaylist(name, item)}
                />
              </div>
              <div className="home-card-title">{item.title}</div>
              <div className="home-card-subtitle">{item.subtitle}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function HomeView({
  onPlaySong,
  activeId,
  isPlaying,
  libraryIds,
  downloadingIds,
  playlists,
  onDownload,
  onAddToPlaylist,
  onCreatePlaylist,
  recentTracks,
  refreshKey
}: Props): React.JSX.Element {
  const [shelves, setShelves] = useState<HomeShelf[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [recommended, setRecommended] = useState<HomeShelf | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  // The shelf's own refresh button — a second, independent trigger
  // alongside the parent's refreshKey (bumped by the sidebar's Home
  // button), so either "go home" or "hit refresh" re-fetches.
  const [manualRefresh, setManualRefresh] = useState(0)

  // Re-fetches on refreshKey/manualRefresh too, not just on mount — the
  // refresh button used to only touch the "Recommended for you" row below,
  // leaving every editorial shelf (Today's Top Hits, Pop Hits, etc.) frozen
  // at whatever loaded first, which read as the button just reshuffling one
  // random row instead of actually refreshing the page.
  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    window.api
      .getHomeSections()
      .then((s) => {
        if (!cancelled) setShelves(s)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, manualRefresh])

  // YouTube Music's own "up next" mix — the same real recommendation used
  // for autoplay continuation in usePlayer — but blended across the last
  // few *distinct* plays instead of just the single most recent one.
  // Seeding from one song made the shelf too dependent on whatever that
  // one track happened to be (skip to something out of character once and
  // the whole shelf reflects that, not your actual taste). Fetching a few
  // seeds and interleaving them round-robin (rather than concatenating one
  // seed's full list before moving to the next) keeps any single seed from
  // dominating the result.
  //
  // Deliberately keyed on refreshKey/manualRefresh, not on recentTracks —
  // recentTracks updates on every track played, and re-fetching every
  // time meant the shelf reshuffled mid-listen after every single song.
  // recentTracks is still read below (just not listed as a dependency),
  // so a refresh always uses whatever's most recently been played; it
  // just doesn't trigger one by itself anymore.
  useEffect(() => {
    const seeds = recentTracks.slice(0, 3)
    if (seeds.length === 0) {
      setRecommended(null)
      return
    }
    let cancelled = false
    setRecLoading(true)
    Promise.all(seeds.map((seed) => window.api.getUpNext(seed.id).catch(() => [])))
      .then((lists) => {
        if (cancelled) return
        const recentIds = new Set(recentTracks.map((t) => t.id))
        const seenIds = new Set<string>()
        const merged: HomeItem[] = []
        const longestList = Math.max(0, ...lists.map((l) => l.length))
        for (let i = 0; i < longestList; i++) {
          for (const list of lists) {
            const song = list[i]
            // Skip anything already picked from an earlier seed this round,
            // and anything that's itself one of the recent plays — hearing
            // a song you just finished suggested back to you isn't a
            // recommendation.
            if (!song || seenIds.has(song.id) || recentIds.has(song.id)) continue
            seenIds.add(song.id)
            merged.push({ id: song.id, title: song.title, subtitle: song.artist, thumbnail: song.thumbnail ?? null, duration: song.duration ?? null })
          }
        }
        if (merged.length === 0) {
          setRecommended(null)
          return
        }
        // Capped the same as the editorial shelves (10) rather than 15 —
        // more DOM nodes and external thumbnail images in one horizontally
        // scrolling row than the others directly costs scroll smoothness.
        setRecommended({ title: 'Recommended for you', items: merged.slice(0, 10) })
      })
      .catch(() => {
        if (!cancelled) setRecommended(null)
      })
      .finally(() => {
        if (!cancelled) setRecLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, manualRefresh])

  const shelfProps = { activeId, isPlaying, libraryIds, downloadingIds, playlists, onPlaySong, onDownload, onAddToPlaylist, onCreatePlaylist }

  return (
    <div className="home-view">
      <div className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">{greeting()}</span>
          <h1>What are we listening to today?</h1>
        </div>
      </div>

      {loading &&
        SKELETON_SHELVES.map((count, i) => (
          <section key={i} className="shelf">
            <div className="skeleton skeleton-title" />
            <div className="shelf-row">
              {Array.from({ length: count }).map((_, j) => (
                <div key={j} className="skeleton home-card-skeleton" />
              ))}
            </div>
          </section>
        ))}

      {!loading && loadError && (
        <div className="empty">
          <AlertCircle size={22} />
          Couldn't load the home feed — check your connection and try again.
        </div>
      )}

      {!loading && !loadError && shelves.length === 0 && !recommended && (
        <div className="empty">
          <Music2 size={22} />
          Nothing to show yet — try searching for an artist to get started.
        </div>
      )}

      {!loading && !loadError && recommended && (
        <Shelf
          shelf={recommended}
          animationDelay={0}
          {...shelfProps}
          headingAction={
            <button
              className="shelf-refresh"
              onClick={() => setManualRefresh((v) => v + 1)}
              disabled={recLoading}
              aria-label="Refresh recommendations"
              title="Refresh recommendations"
            >
              <RefreshCw size={13} className={recLoading ? 'spin' : ''} />
            </button>
          }
        />
      )}

      {!loading &&
        !loadError &&
        shelves.map((shelf, i) => (
          <Shelf key={shelf.title} shelf={shelf} animationDelay={(recommended ? i + 1 : i) * 70} {...shelfProps} />
        ))}
    </div>
  )
}
