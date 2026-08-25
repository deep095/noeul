import { useState } from 'react'
import { CloudDownload, ListMusic, Pencil, Play, Trash2, WifiOff } from 'lucide-react'
import type { Playlist, Track } from './types'
import SongRow from './SongRow'

interface Props {
  playlist: Playlist
  playlists: Playlist[]
  activeId: string | null
  isPlaying: boolean
  isLoading: boolean
  libraryIds: Set<string>
  downloadingIds: Set<string>
  onPlay: (track: Track, queue: Track[]) => void
  onAdd: (track: Track) => void
  onRemoveSong: (songId: string) => void
  onRename: (name: string) => void
  onDelete: () => void
  onAddToPlaylist: (playlistId: string, track: Track) => void
  onCreatePlaylist: (name: string, track: Track) => void
}

export default function PlaylistView({
  playlist,
  playlists,
  activeId,
  isPlaying,
  isLoading,
  libraryIds,
  downloadingIds,
  onPlay,
  onAdd,
  onRemoveSong,
  onRename,
  onDelete,
  onAddToPlaylist,
  onCreatePlaylist
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(playlist.name)

  const missing = playlist.songs.filter((s) => !libraryIds.has(s.id))
  const allOffline = playlist.songs.length > 0 && missing.length === 0

  return (
    <div className="playlist-view">
      <div className="playlist-header">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) onRename(name.trim())
              setEditing(false)
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim()) onRename(name.trim())
                setEditing(false)
              }}
            />
          </form>
        ) : (
          <h2 onClick={() => setEditing(true)} title="Click to rename">
            {playlist.name}
            <Pencil size={14} />
          </h2>
        )}

        <div className="playlist-header-actions">
          <button
            className="song-row-action"
            disabled={playlist.songs.length === 0}
            onClick={() => playlist.songs.length > 0 && onPlay(playlist.songs[0], playlist.songs)}
            aria-label="Play playlist"
            title="Play playlist"
          >
            <Play size={14} fill="currentColor" />
          </button>
          <button className="song-row-action remove" onClick={onDelete} aria-label="Delete playlist" title="Delete playlist">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {playlist.songs.length > 0 && (
        <div className={`offline-banner ${allOffline ? 'ready' : ''}`}>
          {allOffline ? (
            <>
              <WifiOff size={15} />
              <span>Every song here is downloaded — this playlist works fully offline.</span>
            </>
          ) : (
            <>
              <CloudDownload size={15} />
              <span>
                {missing.length} of {playlist.songs.length} songs aren't downloaded. Adding a song to a playlist doesn't save it for
                offline — download it separately, or download the whole playlist at once.
              </span>
              <button className="offline-banner-action" onClick={() => missing.forEach((song) => onAdd(song))}>
                Download all
              </button>
            </>
          )}
        </div>
      )}

      <div className="song-list">
        {playlist.songs.map((track, index) => (
          <SongRow
            key={track.id}
            track={track}
            index={index}
            isActive={activeId === track.id}
            isPlaying={isPlaying}
            isLoading={isLoading}
            inLibrary={libraryIds.has(track.id)}
            isDownloading={downloadingIds.has(track.id)}
            onPlay={() => onPlay(track, playlist.songs)}
            onAdd={() => onAdd(track)}
            onRemove={() => onRemoveSong(track.id)}
            removeLabel="Remove from playlist"
            playlists={playlists}
            onAddToPlaylist={(playlistId) => onAddToPlaylist(playlistId, track)}
            onCreatePlaylist={(newName) => onCreatePlaylist(newName, track)}
          />
        ))}
        {playlist.songs.length === 0 && (
          <div className="empty">
            <ListMusic size={22} />
            Nothing here yet — add songs to this playlist from Search or your Downloads.
          </div>
        )}
      </div>
    </div>
  )
}
