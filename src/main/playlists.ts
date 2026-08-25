import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

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

const dbPath = join(app.getPath('userData'), 'playlists.json')

function readDb(): Playlist[] {
  if (!existsSync(dbPath)) return []
  try {
    return JSON.parse(readFileSync(dbPath, 'utf-8'))
  } catch {
    return []
  }
}

function writeDb(playlists: Playlist[]): void {
  writeFileSync(dbPath, JSON.stringify(playlists, null, 2), 'utf-8')
}

export function listPlaylists(): Playlist[] {
  return readDb().sort((a, b) => b.createdAt - a.createdAt)
}

export function createPlaylist(name: string): Playlist[] {
  const playlists = readDb()
  playlists.push({ id: randomUUID(), name: name.trim() || 'New Playlist', songs: [], createdAt: Date.now() })
  writeDb(playlists)
  return listPlaylists()
}

export function renamePlaylist(id: string, name: string): Playlist[] {
  const playlists = readDb()
  const playlist = playlists.find((p) => p.id === id)
  if (playlist && name.trim()) playlist.name = name.trim()
  writeDb(playlists)
  return listPlaylists()
}

export function deletePlaylist(id: string): Playlist[] {
  const playlists = readDb().filter((p) => p.id !== id)
  writeDb(playlists)
  return listPlaylists()
}

export function addSongToPlaylist(playlistId: string, song: PlaylistSong): Playlist[] {
  const playlists = readDb()
  const playlist = playlists.find((p) => p.id === playlistId)
  if (playlist && !playlist.songs.some((s) => s.id === song.id)) {
    playlist.songs.push(song)
  }
  writeDb(playlists)
  return listPlaylists()
}

export function removeSongFromPlaylist(playlistId: string, songId: string): Playlist[] {
  const playlists = readDb()
  const playlist = playlists.find((p) => p.id === playlistId)
  if (playlist) playlist.songs = playlist.songs.filter((s) => s.id !== songId)
  writeDb(playlists)
  return listPlaylists()
}
