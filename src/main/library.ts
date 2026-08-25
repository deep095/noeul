import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface LibrarySong {
  id: string
  title: string
  artist: string
  album?: string
  thumbnail?: string
  duration: number
  filePath: string
  addedAt: number
}

const libraryDir = join(app.getPath('userData'), 'library')
const dbPath = join(app.getPath('userData'), 'library.json')

function ensureLibraryDir(): void {
  if (!existsSync(libraryDir)) mkdirSync(libraryDir, { recursive: true })
}

function readDb(): LibrarySong[] {
  if (!existsSync(dbPath)) return []
  try {
    return JSON.parse(readFileSync(dbPath, 'utf-8'))
  } catch {
    return []
  }
}

function writeDb(songs: LibrarySong[]): void {
  writeFileSync(dbPath, JSON.stringify(songs, null, 2), 'utf-8')
}

export function getLibraryDir(): string {
  ensureLibraryDir()
  return libraryDir
}

export function listSongs(): LibrarySong[] {
  return readDb().sort((a, b) => b.addedAt - a.addedAt)
}

export function addSong(song: LibrarySong): void {
  const songs = readDb()
  if (songs.some((s) => s.id === song.id)) return
  songs.push(song)
  writeDb(songs)
}

export function removeSong(id: string): LibrarySong | undefined {
  const songs = readDb()
  const idx = songs.findIndex((s) => s.id === id)
  if (idx === -1) return undefined
  const [removed] = songs.splice(idx, 1)
  writeDb(songs)
  return removed
}

export function hasSong(id: string): boolean {
  return readDb().some((s) => s.id === id)
}
