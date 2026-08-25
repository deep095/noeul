import { useRef, useState } from 'react'
import { Check, Download, Loader2, MoreVertical, Plus } from 'lucide-react'
import type { Playlist } from './types'
import Popover from './Popover'

interface Props {
  inLibrary: boolean
  isDownloading: boolean
  onDownload: () => void
  playlists: Playlist[]
  onAddToPlaylist: (playlistId: string) => void
  onCreatePlaylist: (name: string) => void
}

export default function CardMenu({
  inLibrary,
  isDownloading,
  onDownload,
  playlists,
  onAddToPlaylist,
  onCreatePlaylist
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const close = (): void => {
    setOpen(false)
    setCreating(false)
    setName('')
  }

  return (
    <div className="card-menu-wrap">
      <button
        ref={triggerRef}
        className="card-menu-trigger"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label="More options"
        title="More options"
      >
        <MoreVertical size={14} />
      </button>

      <Popover open={open} onClose={close} anchorRef={triggerRef} className="card-menu playlist-menu">
        <button
          className="playlist-menu-item"
          disabled={inLibrary || isDownloading}
          onClick={() => {
            onDownload()
            close()
          }}
        >
          {isDownloading ? <Loader2 size={14} className="spin" /> : inLibrary ? <Check size={14} /> : <Download size={14} />}
          {isDownloading ? 'Downloading…' : inLibrary ? 'Downloaded' : 'Download'}
        </button>

        <div className="card-menu-divider" />
        <span className="playlist-menu-label">Add to playlist</span>

        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            className="playlist-menu-item"
            onClick={() => {
              onAddToPlaylist(playlist.id)
              close()
            }}
          >
            {playlist.name}
          </button>
        ))}

        {creating ? (
          <form
            className="playlist-menu-create"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) onCreatePlaylist(name.trim())
              close()
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name" />
          </form>
        ) : (
          <button className="playlist-menu-item new" onClick={() => setCreating(true)}>
            <Plus size={13} /> New playlist
          </button>
        )}
      </Popover>
    </div>
  )
}
