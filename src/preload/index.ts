import { contextBridge, ipcRenderer } from 'electron'

export interface SearchSong {
  id: string
  title: string
  artist: string
  album?: string | null
  duration?: number | null
  thumbnail?: string | null
}

export interface LibrarySong {
  id: string
  title: string
  artist: string
  album?: string
  thumbnail?: string
  duration: number
  filePath: string
  fileUrl: string
  addedAt: number
}

export interface HomeItem {
  id: string
  title: string
  subtitle: string
  thumbnail: string | null
  duration: number | null
}

export interface HomeShelf {
  title: string
  items: HomeItem[]
}

export interface Genre {
  id: string
  label: string
}

export interface CountryGenre {
  id: string
  label: string
}

export interface Country {
  id: string
  label: string
  genres: CountryGenre[]
}

export interface PlaylistSong {
  id: string
  title: string
  artist: string
  thumbnail?: string | null
  duration?: number | null
}

export interface Playlist {
  id: string
  name: string
  songs: PlaylistSong[]
  createdAt: number
}

export interface DiscordActivityInput {
  title: string
  artist: string
  thumbnail: string | null
  progress: number
  duration: number
  isPlaying: boolean
}

const api = {
  searchSongs: (query: string): Promise<SearchSong[]> => ipcRenderer.invoke('search:songs', query),
  getHomeSections: (): Promise<HomeShelf[]> => ipcRenderer.invoke('home:sections'),
  resolvePlayableUrl: (videoId: string): Promise<string> => ipcRenderer.invoke('player:resolve', videoId),
  getUpNext: (videoId: string): Promise<SearchSong[]> => ipcRenderer.invoke('player:upnext', videoId),
  listGenres: (): Promise<Genre[]> => ipcRenderer.invoke('genres:list'),
  searchByGenre: (genreId: string): Promise<SearchSong[]> => ipcRenderer.invoke('genres:songs', genreId),
  listCountries: (): Promise<Country[]> => ipcRenderer.invoke('countries:list'),
  searchByCountryGenre: (countryId: string, genreId: string): Promise<SearchSong[]> =>
    ipcRenderer.invoke('countries:songs', countryId, genreId),
  listLibrary: (): Promise<LibrarySong[]> => ipcRenderer.invoke('library:list'),
  isInLibrary: (id: string): Promise<boolean> => ipcRenderer.invoke('library:has', id),
  addToLibrary: (song: SearchSong): Promise<LibrarySong[]> => ipcRenderer.invoke('library:add', song),
  removeFromLibrary: (id: string): Promise<LibrarySong[]> => ipcRenderer.invoke('library:remove', id),
  listPlaylists: (): Promise<Playlist[]> => ipcRenderer.invoke('playlists:list'),
  createPlaylist: (name: string): Promise<Playlist[]> => ipcRenderer.invoke('playlists:create', name),
  renamePlaylist: (id: string, name: string): Promise<Playlist[]> => ipcRenderer.invoke('playlists:rename', id, name),
  deletePlaylist: (id: string): Promise<Playlist[]> => ipcRenderer.invoke('playlists:delete', id),
  addSongToPlaylist: (playlistId: string, song: PlaylistSong): Promise<Playlist[]> =>
    ipcRenderer.invoke('playlists:addSong', playlistId, song),
  removeSongFromPlaylist: (playlistId: string, songId: string): Promise<Playlist[]> =>
    ipcRenderer.invoke('playlists:removeSong', playlistId, songId),
  updateDiscordActivity: (input: DiscordActivityInput): Promise<void> => ipcRenderer.invoke('discord:updateActivity', input),
  clearDiscordActivity: (): Promise<void> => ipcRenderer.invoke('discord:clearActivity')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
