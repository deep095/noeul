import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { searchSongs, getHome, getUpNext, listGenres, searchByGenre, listCountries, searchByCountryGenre } from './search'
import { resolvePlayableFile, downloadSong } from './downloader'
import { listSongs, addSong, removeSong, hasSong, getLibraryDir, type LibrarySong } from './library'
import {
  listPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  type PlaylistSong
} from './playlists'
import { connectDiscord, disconnectDiscord, updateDiscordActivity, clearDiscordActivity, type ActivityInput } from './discordPresence'

// Works around a persistent Chromium/Windows GPU-compositor bug where the
// player bar's album art would visually "stack" old, genuinely different
// artwork on top of the current track — not a real DOM duplication (the
// player only ever renders one <img>, verified directly), but the
// compositor failing to repaint that region after the blurred, animated
// glow layer there got torn down and rebuilt on every song change. Must be
// called before the app is ready.
app.disableHardwareAcceleration()

// Chromium blocks a page from a non-file:// origin (which the renderer is,
// in dev mode — served from Vite's http://localhost:5173) from loading
// file:// media directly; audio.src pointed at one just silently fails as
// "not supported", regardless of whether the file is actually valid. Local
// audio is served through this privileged custom scheme instead, which
// sidesteps that origin restriction in both dev and production. net.fetch
// on a file:// URL handles Range/Content-Length correctly on its own, so
// this is just a thin, correctly-scoped passthrough — not another hand-
// rolled streaming implementation like the earlier attempts that broke.
const PLAYABLE_SCHEME = 'noeulfile'

function toPlayableUrl(filePath: string): string {
  return `${PLAYABLE_SCHEME}://local/${encodeURIComponent(filePath)}`
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: PLAYABLE_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, bypassCSP: true }
  }
])

function withFileUrl(song: LibrarySong): LibrarySong & { fileUrl: string } {
  return { ...song, fileUrl: toPlayableUrl(song.filePath) }
}

// Packaged as an extraResource (see package.json's build.extraResources) so
// it lives next to the asar rather than inside it — in dev, out/main mirrors
// the project root closely enough that the same relative walk reaches the
// source assets/ folder directly.
const iconPath = is.dev ? join(__dirname, '../../assets/icon.png') : join(process.resourcesPath, 'icon.png')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 780,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#202020',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.noeul.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('search:songs', async (_event, query: string) => {
    return searchSongs(query)
  })

  ipcMain.handle('home:sections', async () => {
    return getHome()
  })

  ipcMain.handle('player:upnext', async (_event, videoId: string) => {
    return getUpNext(videoId)
  })

  ipcMain.handle('genres:list', async () => {
    return listGenres()
  })

  ipcMain.handle('genres:songs', async (_event, genreId: string) => {
    return searchByGenre(genreId)
  })

  ipcMain.handle('countries:list', async () => {
    return listCountries()
  })

  ipcMain.handle('countries:songs', async (_event, countryId: string, genreId: string) => {
    return searchByCountryGenre(countryId, genreId)
  })

  protocol.handle(PLAYABLE_SCHEME, async (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''))
    return net.fetch(pathToFileURL(filePath).href, { headers: request.headers })
  })

  ipcMain.handle('player:resolve', async (_event, videoId: string) => {
    const filePath = await resolvePlayableFile(videoId)
    return toPlayableUrl(filePath)
  })

  ipcMain.handle('library:list', async () => {
    return listSongs().map(withFileUrl)
  })

  ipcMain.handle('library:has', async (_event, id: string) => {
    return hasSong(id)
  })

  ipcMain.handle(
    'library:add',
    async (
      _event,
      song: { id: string; title: string; artist: string; album?: string | null; thumbnail?: string | null; duration: number | null }
    ) => {
      const filePath = await downloadSong(
        { id: song.id, title: song.title, artist: song.artist, album: song.album, thumbnail: song.thumbnail },
        getLibraryDir()
      )
      addSong({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album ?? undefined,
        thumbnail: song.thumbnail ?? undefined,
        duration: song.duration ?? 0,
        filePath,
        addedAt: Date.now()
      })
      return listSongs().map(withFileUrl)
    }
  )

  ipcMain.handle('library:remove', async (_event, id: string) => {
    removeSong(id)
    return listSongs().map(withFileUrl)
  })

  ipcMain.handle('playlists:list', async () => {
    return listPlaylists()
  })

  ipcMain.handle('playlists:create', async (_event, name: string) => {
    return createPlaylist(name)
  })

  ipcMain.handle('playlists:rename', async (_event, id: string, name: string) => {
    return renamePlaylist(id, name)
  })

  ipcMain.handle('playlists:delete', async (_event, id: string) => {
    return deletePlaylist(id)
  })

  ipcMain.handle('playlists:addSong', async (_event, playlistId: string, song: PlaylistSong) => {
    return addSongToPlaylist(playlistId, song)
  })

  ipcMain.handle('playlists:removeSong', async (_event, playlistId: string, songId: string) => {
    return removeSongFromPlaylist(playlistId, songId)
  })

  ipcMain.handle('discord:updateActivity', async (_event, input: ActivityInput) => {
    await updateDiscordActivity(input)
  })

  ipcMain.handle('discord:clearActivity', async () => {
    await clearDiscordActivity()
  })

  // Always connects on launch — doesn't block window creation, the
  // connection just comes up whenever the local Discord IPC pipe answers
  // (and keeps retrying quietly in the background if it isn't running yet).
  connectDiscord().catch(() => {})

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  disconnectDiscord().catch(() => {})
})
