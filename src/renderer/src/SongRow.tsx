import { Pause, Play, Download, Check, Trash2, Loader2, Music2 } from 'lucide-react'
import type { Playlist, Track } from './types'
import { formatDuration } from './format'
import NowPlayingBars from './NowPlayingBars'
import AddToPlaylistMenu from './AddToPlaylistMenu'
import SafeImage from './SafeImage'
import { onReveal } from './reveal'

interface Props {
  track: Track
  index?: number
  isActive: boolean
  isPlaying: boolean
  isLoading?: boolean
  inLibrary: boolean
  isDownloading: boolean
  onPlay: () => void
  onAdd?: () => void
  onRemove?: () => void
  /** Defaults to "Remove from library" — pass e.g. "Remove from playlist" when reused elsewhere. */
  removeLabel?: string
  playlists?: Playlist[]
  onAddToPlaylist?: (playlistId: string) => void
  onCreatePlaylist?: (name: string) => void
}

export default function SongRow({
  track,
  index,
  isActive,
  isPlaying,
  isLoading,
  inLibrary,
  isDownloading,
  onPlay,
  onAdd,
  onRemove,
  removeLabel = 'Remove from library',
  playlists,
  onAddToPlaylist,
  onCreatePlaylist
}: Props): React.JSX.Element {
  const style = index !== undefined ? ({ animationDelay: `${Math.min(index * 25, 300)}ms` } as React.CSSProperties) : undefined
  const showSpinner = isActive && isLoading

  return (
    <div className={`song-row reveal ${isActive ? 'active' : ''}`} style={style} onMouseMove={onReveal}>
      <button className="song-row-play" onClick={onPlay} aria-label="Play" disabled={showSpinner}>
        {showSpinner ? (
          <Loader2 size={14} className="spin" />
        ) : isActive && isPlaying ? (
          <Pause size={14} fill="currentColor" />
        ) : (
          <Play size={14} fill="currentColor" />
        )}
      </button>
      <div className="song-row-art-wrap">
        <SafeImage
          src={track.thumbnail}
          className="song-row-art"
          fallback={
            <div className="song-row-art placeholder">
              <Music2 size={16} />
            </div>
          }
        />
        {isActive && isPlaying && (
          <span className="art-now-playing">
            <NowPlayingBars />
          </span>
        )}
      </div>
      <div className="song-row-meta">
        <div className="song-row-title">{track.title}</div>
        <div className="song-row-artist">{track.artist}</div>
      </div>
      <div className="song-row-duration">{formatDuration(track.duration)}</div>

      {playlists && onAddToPlaylist && onCreatePlaylist && (
        <AddToPlaylistMenu playlists={playlists} onAddToPlaylist={onAddToPlaylist} onCreatePlaylist={onCreatePlaylist} />
      )}

      {onAdd && !inLibrary && (
        <button
          className={`song-row-action ${isDownloading ? 'busy' : ''}`}
          onClick={onAdd}
          disabled={isDownloading}
          aria-label={isDownloading ? 'Downloading' : 'Download'}
          title={isDownloading ? 'Downloading…' : 'Download'}
        >
          {isDownloading ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
        </button>
      )}
      {inLibrary && (
        <span className="song-row-badge badge-in" title="Downloaded">
          <Check size={13} />
        </span>
      )}
      {onRemove && (
        <button className="song-row-action remove" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
