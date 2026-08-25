import { useRef, useState } from 'react'
import { ListMusic, Plus } from 'lucide-react'
import type { Playlist } from './types'
import Popover from './Popover'

interface Props {
  playlists: Playlist[]
  onAddToPlaylist: (playlistId: string) => void
  onCreatePlaylist: (name: string) => void
  /** 'top' for anchors near the bottom of the window (the player bar),
   *  where a downward menu would render off-screen. Defaults to 'bottom'. */
  placement?: 'bottom' | 'top'
  disabled?: boolean
}

export default function AddToPlaylistMenu({ playlists, onAddToPlaylist, onCreatePlaylist, placement, disabled }: Props): React.JSX.Element {
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
    <div className="playlist-menu-wrap">
      <button
        ref={triggerRef}
        className="song-row-action"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="Add to playlist"
        title="Add to playlist"
      >
        <ListMusic size={14} />
      </button>

      <Popover open={open} onClose={close} anchorRef={triggerRef} placement={placement} className="playlist-menu">
        {playlists.length === 0 && !creating && <div className="playlist-menu-empty">No playlists yet</div>}
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
