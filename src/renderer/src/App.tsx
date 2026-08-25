import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Disc3, Download, Guitar, Home as HomeIcon, ListMusic, Music2, Plus, Search, SearchX } from 'lucide-react'
import type { CategorySelection, Country, Genre, HomeItem, Playlist, Track } from './types'
import { usePlayer } from './usePlayer'
import SongRow from './SongRow'
import PlayerBar from './PlayerBar'
import HomeView from './HomeView'
import PlaylistView from './PlaylistView'
import SettingsMenu from './SettingsMenu'
import CategoryMenu from './CategoryMenu'
import SplashScreen from './SplashScreen'
import SafeImage from './SafeImage'
import NoteGlyph from './NoteGlyph'
import { applyAccentTheme, loadSavedAccentTheme, saveAccentTheme, type AccentTheme } from './accentThemes'
import { onReveal } from './reveal'

type View = 'home' | 'library' | 'playlist'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('home')
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [results, setResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [library, setLibrary] = useState<Track[]>([])
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [creatingPlaylist, setCreatingPlaylist] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const [suggestions, setSuggestions] = useState<Track[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRequestId = useRef(0)

  const [genres, setGenres] = useState<Genre[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [activeSelection, setActiveSelection] = useState<CategorySelection | null>(null)

  // A short history, not just the single last track — seeding the home
  // recommendation shelf from one song made it too easy for one odd/one-off
  // play to skew the whole shelf. Newest first, deduped by id, capped small
  // since this only exists to seed a handful of "up next" fetches.
  const [recentTracks, setRecentTracks] = useState<{ id: string; title: string; artist: string }[]>(() => {
    try {
      const raw = localStorage.getItem('noeul-recent-plays')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  // Bumped only when the recommendation shelf should actually re-fetch —
  // clicking Home to return to it, or its own refresh button — not on
  // every track change. recentTracks updates on every play (needed so the
  // *next* refresh has fresh seeds), but using it directly as a fetch
  // trigger meant the shelf re-shuffled mid-listen on every single song,
  // which felt like the recommendations couldn't hold still long enough
  // to actually look at.
  const [recommendRefreshKey, setRecommendRefreshKey] = useState(0)

  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => loadSavedAccentTheme())

  // A fixed-duration branded splash rather than one tied to actual load
  // time — the app's own initial fetches (library, playlists, categories)
  // are local/fast enough that gating on them would make the splash flash
  // for a barely-visible instant instead of reading as a loading screen.
  const [splashPhase, setSplashPhase] = useState<'visible' | 'fading' | 'done'>('visible')
  useEffect(() => {
    const timer = setTimeout(() => setSplashPhase('fading'), 2600)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (splashPhase !== 'fading') return
    const timer = setTimeout(() => setSplashPhase('done'), 500)
    return () => clearTimeout(timer)
  }, [splashPhase])

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string): void => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const player = usePlayer()

  useEffect(() => {
    applyAccentTheme(accentTheme)
  }, [accentTheme])

  const handleSelectAccent = useCallback((theme: AccentTheme): void => {
    setAccentTheme(theme)
    saveAccentTheme(theme)
  }, [])

  const refreshLibrary = useCallback(async () => {
    const songs = await window.api.listLibrary()
    setLibrary(songs)
  }, [])

  const refreshPlaylists = useCallback(async () => {
    const lists = await window.api.listPlaylists()
    setPlaylists(lists)
  }, [])

  useEffect(() => {
    refreshLibrary()
    refreshPlaylists()
    window.api.listGenres().then(setGenres)
    window.api.listCountries().then(setCountries)
  }, [refreshLibrary, refreshPlaylists])

  // Remembered locally (not tied to the library) so the home page's
  // recommendation shelf has something real to seed itself from — whatever
  // was actually played recently, not a fixed editorial query.
  useEffect(() => {
    if (!player.current) return
    const { id, title, artist } = player.current
    setRecentTracks((prev) => {
      const next = [{ id, title, artist }, ...prev.filter((t) => t.id !== id)].slice(0, 5)
      try {
        localStorage.setItem('noeul-recent-plays', JSON.stringify(next))
      } catch {
        // localStorage can throw in some contexts (private mode etc.) — losing
        // the saved preference isn't worth failing over.
      }
      return next
    })
  }, [player.current])

  // Discord Rich Presence — pushed on track change and play/pause, not on
  // every progress tick (Discord renders its own moving progress bar off the
  // timestamps we send, so per-second updates would just spam the IPC pipe).
  useEffect(() => {
    if (!player.current) {
      window.api.clearDiscordActivity()
      return
    }
    window.api.updateDiscordActivity({
      title: player.current.title,
      artist: player.current.artist,
      thumbnail: player.current.thumbnail ?? null,
      progress: player.progress,
      duration: player.duration,
      isPlaying: player.isPlaying
    })
  }, [player.current, player.isPlaying])

  useEffect(() => {
    return () => {
      window.api.clearDiscordActivity()
    }
  }, [])

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) ?? null

  // If the playlist being viewed gets deleted (e.g. from another row's
  // menu), fall back to Home instead of showing a blank/broken view.
  useEffect(() => {
    if (view === 'playlist' && !selectedPlaylist) setView('home')
  }, [view, selectedPlaylist])

  const runSearch = useCallback(async (q: string): Promise<void> => {
    if (!q.trim()) return
    setActiveSelection(null)
    setView('home')
    setHasSearched(true)
    setShowSuggestions(false)
    setSearching(true)
    setSearchError(null)
    try {
      const songs = await window.api.searchSongs(q)
      setResults(songs)
      // Quietly start resolving the top few results in the background —
      // downloading a fresh track is the slow part of hitting play, so by
      // the time someone actually clicks one of the first couple results,
      // it's often already cached. Errors here are fine to ignore: the
      // real attempt happens (and surfaces its own error) on click.
      for (const song of songs.slice(0, 3)) {
        window.api.resolvePlayableUrl(song.id).catch(() => {})
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }, [])

  const runCategory = useCallback(async (selection: CategorySelection): Promise<void> => {
    setActiveSelection(selection)
    setQuery('')
    setView('home')
    setHasSearched(true)
    setShowSuggestions(false)
    setSearching(true)
    setSearchError(null)
    try {
      const songs =
        selection.type === 'genre' ? await window.api.searchByGenre(selection.id) : await window.api.searchByCountryGenre(selection.countryId, selection.genreId)
      setResults(songs)
      for (const song of songs.slice(0, 3)) {
        window.api.resolvePlayableUrl(song.id).catch(() => {})
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }, [])

  const handleQueryChange = useCallback((value: string): void => {
    setQuery(value)
    setActiveSelection(null)
    if (!value.trim()) setHasSearched(false)
  }, [])

  // The sidebar's Home button used to just setView('home') — a no-op
  // while already viewing search/genre results on the home page, since
  // `view` was 'home' the whole time and nothing else reset. Clearing the
  // search/category state is what actually returns to the editorial home
  // feed; bumping the refresh key is the one place recommendations are
  // meant to update (see recommendRefreshKey above).
  const goHome = useCallback((): void => {
    setView('home')
    setQuery('')
    setHasSearched(false)
    setActiveSelection(null)
    setRecommendRefreshKey((v) => v + 1)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const requestId = ++suggestionsRequestId.current
    const handle = setTimeout(async () => {
      try {
        const songs = await window.api.searchSongs(q)
        if (suggestionsRequestId.current === requestId) setSuggestions(songs.slice(0, 6))
      } catch {
        if (suggestionsRequestId.current === requestId) setSuggestions([])
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  const handleAdd = useCallback(
    async (track: Track): Promise<void> => {
      setDownloadingIds((prev) => new Set(prev).add(track.id))
      try {
        const songs = await window.api.addToLibrary(track)
        setLibrary(songs)
      } catch (err) {
        showToast(`Couldn't download "${track.title}" — ${err instanceof Error ? err.message : 'download failed'}`)
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev)
          next.delete(track.id)
          return next
        })
      }
    },
    [showToast]
  )

  const handleRemoveFromLibrary = useCallback(async (id: string): Promise<void> => {
    const songs = await window.api.removeFromLibrary(id)
    setLibrary(songs)
  }, [])

  // Clicking play on the row that's already loading the very same track
  // (e.g. an impatient second click before it's resolved) would otherwise
  // route to toggle(), which can end up acting on a stale/empty audio.src —
  // so it's a no-op while that row's own load is still in flight.
  const handleRowPlay = useCallback(
    (track: Track, queue: Track[]): void => {
      if (player.current?.id === track.id) {
        if (!player.isLoading) player.toggle()
        return
      }
      player.play(track, queue)
    },
    [player]
  )

  const playSuggestion = useCallback(
    (track: Track): void => {
      setShowSuggestions(false)
      setQuery(track.title)
      player.play(track, suggestions)
    },
    [player, suggestions]
  )

  const homeItemToTrack = useCallback(
    (item: HomeItem): Track => ({
      id: item.id,
      title: item.title,
      artist: item.subtitle,
      thumbnail: item.thumbnail,
      duration: item.duration
    }),
    []
  )

  const playHomeItem = useCallback(
    (item: HomeItem, queue: HomeItem[]): void => {
      // Previously this called play() with no queue at all, so Next/Prev had
      // nothing to navigate — silently did nothing for anything played from
      // Home. The shelf a card came from is a reasonable queue: matches how
      // "play from this list" works elsewhere in the app.
      player.play(homeItemToTrack(item), queue.map(homeItemToTrack))
    },
    [player, homeItemToTrack]
  )

  const handleDownloadHomeItem = useCallback(
    (item: HomeItem): void => {
      handleAdd(homeItemToTrack(item))
    },
    [handleAdd, homeItemToTrack]
  )

  const handleAddToPlaylist = useCallback(async (playlistId: string, track: Track): Promise<void> => {
    const updated = await window.api.addSongToPlaylist(playlistId, track)
    setPlaylists(updated)
  }, [])

  const handleCreatePlaylistWithSong = useCallback(async (name: string, track: Track): Promise<void> => {
    const created = await window.api.createPlaylist(name)
    // listPlaylists sorts newest-first, so the playlist just created is [0].
    const newPlaylist = created[0]
    const updated = await window.api.addSongToPlaylist(newPlaylist.id, track)
    setPlaylists(updated)
  }, [])

  const handleCreateEmptyPlaylist = useCallback(async (name: string): Promise<void> => {
    const updated = await window.api.createPlaylist(name)
    setPlaylists(updated)
  }, [])

  const handleRemoveSongFromPlaylist = useCallback(async (playlistId: string, songId: string): Promise<void> => {
    const updated = await window.api.removeSongFromPlaylist(playlistId, songId)
    setPlaylists(updated)
  }, [])

  const handleRenamePlaylist = useCallback(async (playlistId: string, name: string): Promise<void> => {
    const updated = await window.api.renamePlaylist(playlistId, name)
    setPlaylists(updated)
  }, [])

  const handleDeletePlaylist = useCallback(async (playlistId: string): Promise<void> => {
    const updated = await window.api.deletePlaylist(playlistId)
    setPlaylists(updated)
    setView('home')
  }, [])

  const libraryIds = new Set(library.map((s) => s.id))

  return (
    <>
      {splashPhase !== 'done' && <SplashScreen fading={splashPhase === 'fading'} />}
      <div className="app">
        {toast && (
        <div className="toast">
          <AlertCircle size={14} />
          {toast}
        </div>
      )}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-word" aria-label="Noeul">
            <span className="brand-word-text">Noeu</span>
            <NoteGlyph className="note-glyph" />
          </span>
        </div>
        <nav>
          <button className={`nav-item reveal ${view === 'home' ? 'active' : ''}`} onMouseMove={onReveal} onClick={goHome}>
            <HomeIcon size={16} />
            Home
          </button>
          <button className={`nav-item reveal ${view === 'library' ? 'active' : ''}`} onMouseMove={onReveal} onClick={() => setView('library')}>
            <Download size={16} />
            Downloads
            {library.length > 0 && (
              <span className="nav-count" key={library.length}>
                {library.length}
              </span>
            )}
          </button>
        </nav>

        <div className="sidebar-section">
          <span className="sidebar-heading">Playlists</span>
          <nav>
            {playlists.map((playlist, index) => (
              <button
                key={playlist.id}
                className={`nav-item reveal playlist-nav-in ${view === 'playlist' && selectedPlaylistId === playlist.id ? 'active' : ''}`}
                style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
                onMouseMove={onReveal}
                onClick={() => {
                  setSelectedPlaylistId(playlist.id)
                  setView('playlist')
                }}
              >
                <ListMusic size={16} />
                <span className="nav-item-label">{playlist.name}</span>
              </button>
            ))}

            {creatingPlaylist ? (
              <form
                className="sidebar-new-playlist"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newPlaylistName.trim()) handleCreateEmptyPlaylist(newPlaylistName.trim())
                  setNewPlaylistName('')
                  setCreatingPlaylist(false)
                }}
              >
                <input
                  autoFocus
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onBlur={() => {
                    if (newPlaylistName.trim()) handleCreateEmptyPlaylist(newPlaylistName.trim())
                    setNewPlaylistName('')
                    setCreatingPlaylist(false)
                  }}
                  placeholder="Playlist name"
                />
              </form>
            ) : (
              <button className="nav-item reveal" onMouseMove={onReveal} onClick={() => setCreatingPlaylist(true)}>
                <Plus size={16} />
                New playlist
              </button>
            )}
          </nav>
        </div>

        <div className="sidebar-decor" aria-hidden>
          <Disc3 size={104} strokeWidth={1} />
        </div>

        <SettingsMenu current={accentTheme} onSelect={handleSelectAccent} />
      </aside>

      <main className="content">
        {view === 'home' && (
          <div className="home-page">
            <div className="search-bar-wrap">
              <Guitar className="search-decor search-decor-guitar" size={200} strokeWidth={1} aria-hidden />
              <Music2 className="search-decor search-decor-note" size={64} strokeWidth={1} aria-hidden />
              <div className="search-row">
                <form
                  className="search-bar"
                  onSubmit={(e) => {
                    e.preventDefault()
                    runSearch(query)
                  }}
                >
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setShowSuggestions(false)}
                    placeholder="Search for songs, artists…"
                    autoFocus
                  />
                  <button type="submit" disabled={searching} aria-label="Search">
                    <ArrowRight size={16} />
                  </button>
                </form>

                <CategoryMenu genres={genres} countries={countries} activeSelection={activeSelection} onSelect={runCategory} />
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions">
                  {suggestions.map((track) => (
                    <li key={track.id} onMouseDown={(e) => e.preventDefault()} onClick={() => playSuggestion(track)}>
                      <SafeImage src={track.thumbnail} className="suggestion-art" fallback={<div className="suggestion-art placeholder" />} />
                      <div className="suggestion-meta">
                        <div className="suggestion-title">{track.title}</div>
                        <div className="suggestion-artist">{track.artist}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {searchError && <div className="error">{searchError}</div>}

            {hasSearched ? (
              <div className="song-list">
                {activeSelection && <h2 className="genre-results-heading">{activeSelection.label}</h2>}
                {results.map((track, index) => (
                  <SongRow
                    key={track.id}
                    track={track}
                    index={index}
                    isActive={player.current?.id === track.id}
                    isPlaying={player.isPlaying}
                    isLoading={player.isLoading}
                    inLibrary={libraryIds.has(track.id)}
                    isDownloading={downloadingIds.has(track.id)}
                    onPlay={() => handleRowPlay(track, results)}
                    onAdd={() => handleAdd(track)}
                    playlists={playlists}
                    onAddToPlaylist={(playlistId) => handleAddToPlaylist(playlistId, track)}
                    onCreatePlaylist={(name) => handleCreatePlaylistWithSong(name, track)}
                  />
                ))}
                {!searching && results.length === 0 && (query || activeSelection) && (
                  <div className="empty">
                    <SearchX size={22} />
                    {activeSelection ? `No results for ${activeSelection.label}` : `No results for "${query}"`}
                  </div>
                )}
              </div>
            ) : (
              <HomeView
                onPlaySong={playHomeItem}
                activeId={player.current?.id ?? null}
                isPlaying={player.isPlaying}
                libraryIds={libraryIds}
                downloadingIds={downloadingIds}
                playlists={playlists}
                onDownload={handleDownloadHomeItem}
                onAddToPlaylist={(playlistId, item) => handleAddToPlaylist(playlistId, homeItemToTrack(item))}
                onCreatePlaylist={(name, item) => handleCreatePlaylistWithSong(name, homeItemToTrack(item))}
                recentTracks={recentTracks}
                refreshKey={recommendRefreshKey}
              />
            )}
          </div>
        )}

        {view === 'library' && (
          <div className="library-view">
            <h2>Downloads</h2>
            <p className="view-subtitle">Songs saved here play instantly, even offline.</p>
            <div className="song-list">
              {library.map((track, index) => (
                <SongRow
                  key={track.id}
                  track={track}
                  index={index}
                  isActive={player.current?.id === track.id}
                  isPlaying={player.isPlaying}
                  isLoading={player.isLoading}
                  inLibrary
                  isDownloading={false}
                  onPlay={() => handleRowPlay(track, library)}
                  onRemove={() => handleRemoveFromLibrary(track.id)}
                  playlists={playlists}
                  onAddToPlaylist={(playlistId) => handleAddToPlaylist(playlistId, track)}
                  onCreatePlaylist={(name) => handleCreatePlaylistWithSong(name, track)}
                />
              ))}
              {library.length === 0 && (
                <div className="empty">
                  <ListMusic size={22} />
                  Nothing downloaded yet — search and add songs to build your library.
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'playlist' && selectedPlaylist && (
          <PlaylistView
            playlist={selectedPlaylist}
            playlists={playlists}
            activeId={player.current?.id ?? null}
            isPlaying={player.isPlaying}
            isLoading={player.isLoading}
            libraryIds={libraryIds}
            downloadingIds={downloadingIds}
            onPlay={handleRowPlay}
            onAdd={handleAdd}
            onRemoveSong={(songId) => handleRemoveSongFromPlaylist(selectedPlaylist.id, songId)}
            onRename={(name) => handleRenamePlaylist(selectedPlaylist.id, name)}
            onDelete={() => handleDeletePlaylist(selectedPlaylist.id)}
            onAddToPlaylist={handleAddToPlaylist}
            onCreatePlaylist={handleCreatePlaylistWithSong}
          />
        )}
      </main>

      <PlayerBar
        current={player.current}
        playSeq={player.playSeq}
        isPlaying={player.isPlaying}
        isLoading={player.isLoading}
        progress={player.progress}
        duration={player.duration}
        volume={player.volume}
        error={player.error}
        inLibrary={player.current ? libraryIds.has(player.current.id) : false}
        isDownloading={player.current ? downloadingIds.has(player.current.id) : false}
        playlists={playlists}
        onToggle={player.toggle}
        onSeek={player.seek}
        onVolume={player.setVolume}
        onNext={player.next}
        onPrev={player.prev}
        onDownload={() => player.current && handleAdd(player.current)}
        onAddToPlaylist={(playlistId) => player.current && handleAddToPlaylist(playlistId, player.current)}
        onCreatePlaylist={(name) => player.current && handleCreatePlaylistWithSong(name, player.current)}
      />
      </div>
    </>
  )
}
