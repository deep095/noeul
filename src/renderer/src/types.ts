export interface Track {
  id: string
  title: string
  artist: string
  album?: string | null
  thumbnail?: string | null
  duration?: number | null
  /** Present once the song is downloaded into the local library */
  fileUrl?: string
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

export interface Playlist {
  id: string
  name: string
  songs: Track[]
  createdAt: number
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

/** What the browse menu actually selected — a plain genre, or a genre within a specific country's local scene. */
export type CategorySelection =
  | { type: 'genre'; id: string; label: string }
  | { type: 'country'; countryId: string; genreId: string; label: string }

