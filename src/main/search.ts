import YTMusic from 'ytmusic-api'

export interface SearchSong {
  id: string
  title: string
  artist: string
  album: string | null
  duration: number | null
  thumbnail: string | null
}

let clientPromise: Promise<YTMusic> | null = null

// YouTube Music's endpoint occasionally resets the TLS connection mid-
// handshake (ECONNRESET) — transient, not a real failure, but axios surfaces
// it as a giant circular error object that Electron dumps in full to the
// terminal on every occurrence. One retry papers over the transient case;
// on genuine failure, callers get a short plain Error instead of that dump.
async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 1): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return withRetry(fn, label, retries - 1)
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[search] ${label} failed: ${message}`)
    throw new Error(message)
  }
}

async function getClient(): Promise<YTMusic> {
  // getHome() fires several searches in parallel on cold start — caching the
  // in-flight promise (not just the eventual client) means every concurrent
  // caller awaits the same initialize() instead of racing ahead on a client
  // that hasn't finished initializing yet. That race was the reason the home
  // feed sometimes only loaded after switching tabs and back.
  if (!clientPromise) {
    clientPromise = withRetry(async () => {
      const ytm = new YTMusic()
      // Without an explicit region/language, YouTube Music infers one from
      // network signals (which can land on e.g. India for this app's traffic) —
      // pin it to US/English so search and the home feed are consistent.
      await ytm.initialize({ GL: 'US', HL: 'en' })
      return ytm
    }, 'client init').catch((err) => {
      // A failed init must not poison future calls with a permanently
      // rejected cached promise — clear it so the next call tries fresh.
      clientPromise = null
      throw err
    })
  }
  return clientPromise
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

/**
 * YouTube Music's own home feed (`getHomeSections`) is personalized off
 * IP/timezone signals that this library doesn't expose a way to override —
 * GL/HL alone weren't enough to keep it from skewing toward one region.
 * Building the home page from fixed editorial queries instead gives
 * consistent, deliberately international/US-leaning results.
 */
const SHELVES: { title: string; query: string }[] = [
  { title: "Today's Top Hits", query: "today's top hits" },
  { title: 'Pop Hits', query: 'pop hits' },
  { title: 'Rap Hits', query: 'rap hits' },
  { title: 'R&B Hits', query: 'rnb music' },
  { title: 'Classic Rock', query: 'classic rock songs' },
  { title: 'Lofi & Chill', query: 'lofi hip hop chill' }
]

// DJ mixes, workout compilations, and "various artists"/generic mood-channel
// comps (e.g. "Palm Tree Lounge" — confirmed to show up under Electronic,
// House, Techno, and Ambient & Chill alike, live-tested) dominate plain
// genre searches — filter them out so results read as actual songs by
// actual artists, not hour-long compilation videos.
const COMPILATION_PATTERN =
  /various artists|continuous|megamix|non ?stop|workout|fitness|dj mix|\bmix\b|essentials vol|jukebox|compilation|\blounge\b/i

/** Same real-song filter used for the home shelves — applied to genre/country search too, which used to return whatever YT Music's search ranked highest, junk compilations included. */
function filterRealSongs(songs: SearchSong[]): SearchSong[] {
  return songs.filter((s) => s.title.length <= 60 && !COMPILATION_PATTERN.test(s.title) && !COMPILATION_PATTERN.test(s.artist))
}

export async function getHome(): Promise<HomeShelf[]> {
  const shelves = await Promise.all(
    SHELVES.map(async ({ title, query }) => {
      // One shelf's query failing outright (after its own retry inside
      // searchSongs) shouldn't take down the other five — it just drops
      // out below via the empty-items filter.
      try {
        const songs = await searchSongs(query)
        const items: HomeItem[] = filterRealSongs(songs)
          .slice(0, 10)
          .map((s) => ({ id: s.id, title: s.title, subtitle: s.artist, thumbnail: s.thumbnail, duration: s.duration }))
        return { title, items }
      } catch {
        return { title, items: [] }
      }
    })
  )
  return shelves.filter((shelf) => shelf.items.length > 0)
}

export async function searchSongs(query: string): Promise<SearchSong[]> {
  const ytm = await getClient()
  const results = await withRetry(() => ytm.searchSongs(query), `searchSongs("${query}")`)
  return results.map((song) => ({
    id: song.videoId,
    title: song.name,
    artist: song.artist.name,
    album: song.album?.name ?? null,
    duration: song.duration,
    thumbnail: song.thumbnails.at(-1)?.url ?? null
  }))
}

// ytmusic-api's own .d.ts claims getUpNexts() resolves `artists` as an
// { artistId, name } object, `duration` as a number of seconds, and
// `thumbnails` as an array of { url, width, height } — none of that is
// true. Verified directly against the library's implementation and live
// responses (every item, across several different seed songs): `artists`
// is a plain display-name string straight out of the page's
// `shortBylineText`, `duration` is the formatted "M:SS" (or "H:MM:SS")
// text, and there's a single `thumbnail` string, not a `thumbnails` array —
// the library never runs this endpoint's output through its own Zod
// schema, so nothing catches any of these. Coding against the declared
// (wrong) types first silently produced a blank artist and a "--:--"
// duration, then — once those were fixed but `thumbnails` was still
// assumed — a hard crash reading `.at()` off a field that doesn't exist.
interface RawUpNextSong {
  videoId: string
  title: string
  artists: string
  duration: string
  thumbnail: string
}

function parseDurationText(text: string): number | null {
  const parts = text.split(':').map(Number)
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}

/**
 * YouTube Music's own "up next" queue for a song — seeded from the
 * `RDAMVM<videoId>` radio/mix playlist, the same algorithmic continuation
 * (same artist, same mood/genre, adjacent tracks) that plays when autoplay
 * kicks in on music.youtube.com itself. Used both to keep a queue going
 * once it runs out (real continuation, not a canned "similar genre" search)
 * and to seed the "Because you played" home shelf.
 */
export async function getUpNext(videoId: string, limit = 10): Promise<SearchSong[]> {
  const ytm = await getClient()
  const upNext = (await withRetry(() => ytm.getUpNexts(videoId), `getUpNext(${videoId})`)) as unknown as RawUpNextSong[]
  return upNext
    .filter((song) => song.videoId !== videoId)
    .slice(0, limit)
    .map((song) => ({
      id: song.videoId,
      title: song.title,
      artist: song.artists,
      album: null,
      duration: parseDurationText(song.duration),
      // The library falls back to the literal string "Unknown" for any of
      // these fields it can't extract (see parseDurationText's NaN check
      // for the same fallback on duration) — never observed for thumbnail
      // in testing, but the fallback exists in its code, so it's handled.
      thumbnail: song.thumbnail && song.thumbnail !== 'Unknown' ? song.thumbnail : null
    }))
}

export interface Genre {
  id: string
  label: string
}

// ytmusic-api has no genre-browse endpoint of its own — this reuses the
// same "curated query stands in for a real category" approach the home
// shelves already use, just exposed as an explicit, user-picked list
// instead of a fixed home layout.
const GENRES: (Genre & { query: string })[] = [
  { id: 'pop', label: 'Pop', query: 'pop songs' },
  { id: 'hiphop', label: 'Hip-Hop', query: 'hip hop songs' },
  { id: 'rnb', label: 'R&B', query: 'rnb music' },
  { id: 'rock', label: 'Rock', query: 'rock songs' },
  { id: 'electronic', label: 'Electronic', query: 'electronic dance music' },
  { id: 'indie', label: 'Indie', query: 'indie songs' },
  { id: 'jazz', label: 'Jazz', query: 'jazz songs' },
  { id: 'classical', label: 'Classical', query: 'classical music' },
  { id: 'metal', label: 'Metal', query: 'metal songs' },
  { id: 'punk', label: 'Punk', query: 'punk rock songs' },
  { id: 'folk', label: 'Folk', query: 'folk songs' },
  { id: 'reggae', label: 'Reggae', query: 'reggae songs' },
  { id: 'blues', label: 'Blues', query: 'blues songs' },
  { id: 'soulfunk', label: 'Soul & Funk', query: 'soul funk songs' },
  { id: 'gospel', label: 'Gospel', query: 'gospel songs' },
  { id: 'disco', label: 'Disco', query: 'disco songs' },
  { id: 'house', label: 'House', query: 'house music' },
  { id: 'techno', label: 'Techno', query: 'techno music' },
  { id: 'trap', label: 'Trap', query: 'trap music' },
  { id: 'ambient', label: 'Ambient & Chill', query: 'ambient chill music' },
  { id: 'lofi', label: 'Lo-fi', query: 'lofi hip hop chill' },
  { id: 'acoustic', label: 'Acoustic', query: 'acoustic songs' },
  { id: 'instrumental', label: 'Instrumental', query: 'instrumental music' },
  { id: 'musicals', label: 'Musicals', query: 'broadway musical songs' },
  { id: 'countrymusic', label: 'Country', query: 'country songs' }
]

export function listGenres(): Genre[] {
  return GENRES.map(({ id, label }) => ({ id, label }))
}

export async function searchByGenre(genreId: string): Promise<SearchSong[]> {
  const genre = GENRES.find((g) => g.id === genreId)
  if (!genre) return []
  return filterRealSongs(await searchSongs(genre.query))
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

// A handful of the biggest, most musically distinct scenes rather than an
// exhaustive list of nations — each with its own local genres (so "browse
// by country" actually means something, not just "search this country's
// name + generic top hits"). Query phrasing leans on whatever actually
// surfaces that region's scene well (e.g. "bollywood", "kpop", "amapiano")
// rather than literal "<genre> songs from <country>", which tends to
// return generic/English-language results instead. "Top Hits" always
// leads each country's list as the broad, no-genre-picked default.
const COUNTRIES: (Omit<Country, 'genres'> & { genres: (CountryGenre & { query: string })[] })[] = [
  {
    id: 'us',
    label: 'United States',
    genres: [
      { id: 'top', label: 'Top Hits', query: 'USA top hits' },
      { id: 'pop', label: 'Pop', query: 'USA pop hits' },
      { id: 'hiphop', label: 'Hip-Hop', query: 'USA hip hop hits' },
      { id: 'rock', label: 'Rock', query: 'USA rock hits' },
      { id: 'country', label: 'Country', query: 'USA country hits' }
    ]
  },
  {
    id: 'gb',
    label: 'United Kingdom',
    genres: [
      { id: 'top', label: 'Top Hits', query: 'UK top hits' },
      { id: 'pop', label: 'Pop', query: 'UK pop hits' },
      { id: 'drill', label: 'Drill & Grime', query: 'UK drill grime hits' },
      { id: 'indie', label: 'Indie', query: 'UK indie hits' },
      { id: 'rock', label: 'Rock', query: 'UK rock hits' }
    ]
  },
  {
    id: 'fr',
    label: 'France',
    genres: [
      { id: 'top', label: 'Top Hits', query: 'france top hits' },
      { id: 'chanson', label: 'Chanson', query: 'chanson francaise hits' },
      { id: 'rap', label: 'Rap Français', query: 'rap francais hits' },
      { id: 'house', label: 'French House', query: 'french house classics daft punk justice' }
    ]
  },
  {
    id: 'kr',
    label: 'South Korea',
    genres: [
      { id: 'top', label: 'Top Hits', query: 'korea top hits' },
      { id: 'kpop', label: 'K-Pop', query: 'kpop hits' },
      { id: 'hiphop', label: 'K-Hip-Hop', query: 'korean hip hop hits' },
      { id: 'indie', label: 'K-Indie', query: 'korean indie music' },
      { id: 'ballad', label: 'K-Ballad', query: 'korean ballad songs' }
    ]
  },
  {
    id: 'jp',
    label: 'Japan',
    genres: [
      { id: 'top', label: 'Top Hits', query: 'japan top hits' },
      { id: 'jpop', label: 'J-Pop', query: 'jpop hits' },
      { id: 'rock', label: 'J-Rock', query: 'japanese rock hits' },
      { id: 'anime', label: 'Anime', query: 'anime songs hits' },
      { id: 'citypop', label: 'City Pop', query: 'city pop japan' }
    ]
  },
  {
    id: 'br',
    label: 'Brazil',
    genres: [
      { id: 'top', label: 'Top Hits', query: 'brazil top hits' },
      { id: 'funk', label: 'Funk', query: 'funk carioca hits' },
      { id: 'sertanejo', label: 'Sertanejo', query: 'sertanejo hits' },
      { id: 'bossa', label: 'Bossa Nova', query: 'bossa nova classics' },
      { id: 'pop', label: 'Pop', query: 'brazil pop hits' }
    ]
  }
]

export function listCountries(): Country[] {
  return COUNTRIES.map(({ id, label, genres }) => ({ id, label, genres: genres.map(({ id, label }) => ({ id, label })) }))
}

export async function searchByCountryGenre(countryId: string, genreId: string): Promise<SearchSong[]> {
  const country = COUNTRIES.find((c) => c.id === countryId)
  const genre = country?.genres.find((g) => g.id === genreId)
  if (!genre) return []
  return filterRealSongs(await searchSongs(genre.query))
}
