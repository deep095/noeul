import { AlertCircle, Check, Download, Loader2, Music2, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { Playlist, Track } from './types'
import { formatDuration } from './format'
import AddToPlaylistMenu from './AddToPlaylistMenu'
import StringsLoader from './StringsLoader'
import SafeImage from './SafeImage'

interface Props {
  current: Track | null
  playSeq: number
  isPlaying: boolean
  isLoading: boolean
  progress: number
  duration: number
  volume: number
  error: string | null
  inLibrary: boolean
  isDownloading: boolean
  playlists: Playlist[]
  onToggle: () => void
  onSeek: (seconds: number) => void
  onVolume: (v: number) => void
  onNext: () => void
  onPrev: () => void
  onDownload: () => void
  onAddToPlaylist: (playlistId: string) => void
  onCreatePlaylist: (name: string) => void
}

function VolumeIcon({ volume }: { volume: number }): React.JSX.Element {
  if (volume === 0) return <VolumeX size={16} />
  if (volume < 0.5) return <Volume1 size={16} />
  return <Volume2 size={16} />
}

export default function PlayerBar({
  current,
  playSeq,
  isPlaying,
  isLoading,
  progress,
  duration,
  volume,
  error,
  inLibrary,
  isDownloading,
  playlists,
  onToggle,
  onSeek,
  onVolume,
  onNext,
  onPrev,
  onDownload,
  onAddToPlaylist,
  onCreatePlaylist
}: Props): React.JSX.Element {
  const seekFill = duration > 0 ? `${(Math.min(progress, duration) / duration) * 100}%` : '0%'

  return (
    <div className="player-bar">
      {error && (
        <div className="player-bar-error">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <div className="player-bar-track">
        {current ? (
          <>
            <div className={`player-bar-art-wrap ${isPlaying ? 'playing' : ''}`} key={playSeq}>
              <SafeImage
                src={current.thumbnail}
                fallback={
                  <div className="song-row-art placeholder" style={{ width: 48, height: 48 }}>
                    <Music2 size={18} />
                  </div>
                }
              />
            </div>
            <div className="player-bar-meta" key={playSeq}>
              <div className="player-bar-title">{current.title}</div>
              <div className="player-bar-artist">{current.artist}</div>
            </div>
          </>
        ) : (
          <div className="player-bar-empty">
            <Music2 size={16} /> Nothing playing
          </div>
        )}
      </div>

      <div className="player-bar-controls">
        <div className="player-bar-buttons">
          <button onClick={onPrev} disabled={!current} aria-label="Previous">
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button className="play-pause" onClick={onToggle} disabled={!current || isLoading} aria-label="Play/Pause">
            {isLoading ? (
              <StringsLoader size={16} />
            ) : isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>
          <button onClick={onNext} disabled={!current} aria-label="Next">
            <SkipForward size={17} fill="currentColor" />
          </button>
        </div>
        <div className="player-bar-seek">
          <span>{formatDuration(progress)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={Math.min(progress, duration || 0)}
            style={{ '--fill': seekFill } as React.CSSProperties}
            onChange={(e) => onSeek(Number(e.target.value))}
            disabled={!current}
          />
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="player-bar-actions">
        <button
          className={`song-row-action ${isDownloading ? 'busy' : ''}`}
          onClick={onDownload}
          disabled={!current || inLibrary || isDownloading}
          aria-label={isDownloading ? 'Downloading' : inLibrary ? 'Downloaded' : 'Download'}
          title={isDownloading ? 'Downloading…' : inLibrary ? 'Downloaded' : 'Download'}
        >
          {isDownloading ? <Loader2 size={14} className="spin" /> : inLibrary ? <Check size={14} /> : <Download size={14} />}
        </button>
        <AddToPlaylistMenu
          playlists={playlists}
          onAddToPlaylist={onAddToPlaylist}
          onCreatePlaylist={onCreatePlaylist}
          placement="top"
          disabled={!current}
        />
      </div>

      <div className="player-bar-volume">
        <VolumeIcon volume={volume} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          style={{ '--fill': `${volume * 100}%` } as React.CSSProperties}
          onChange={(e) => onVolume(Number(e.target.value))}
        />
      </div>
    </div>
  )
}
