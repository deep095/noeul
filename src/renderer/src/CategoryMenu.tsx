import { useRef, useState } from 'react'
import { ChevronDown, Globe2, ListFilter, ListMusic, Music2 } from 'lucide-react'
import type { CategorySelection, Country, CountryGenre, Genre } from './types'
import Popover from './Popover'

interface Props {
  genres: Genre[]
  countries: Country[]
  activeSelection: CategorySelection | null
  onSelect: (selection: CategorySelection) => void
}

// A generic sine-like wavy line (SVG's "T" continues the previous Q's curve
// smoothly with just an endpoint, so a long repeating wave doesn't need a
// control point spelled out for every hump) — a small nod to the app's
// subject that reads as a soundwave/staff-line divider instead of a plain
// straight rule.
const WAVE_PATH =
  'M0 3 Q5 0 10 3 T20 3 T30 3 T40 3 T50 3 T60 3 T70 3 T80 3 T90 3 T100 3 T110 3 T120 3 T130 3 T140 3 T150 3 T160 3 T170 3 T180 3 T190 3 T200 3 T210 3 T220 3 T230 3 T240 3 T250 3 T260 3'

export default function CategoryMenu({ genres, countries, activeSelection, onSelect }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'genre' | 'country'>(activeSelection?.type === 'country' ? 'country' : 'genre')
  // Which country's flyout is open — click-driven, not hover. A hover
  // version (open on mouseenter, close a beat after mouseleave) is the
  // classic nested-menu approach, but it's also a well-documented UX
  // pitfall: crossing the gap between the row and the flyout is exactly
  // the kind of "hover the wrong pixel and it closes" interaction that
  // makes flyouts hard to actually reach. Click removes the timing
  // entirely — it opens and just stays open until you act on it.
  const [expandedCountry, setExpandedCountry] = useState<Country | null>(null)
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const close = (): void => {
    setOpen(false)
    setExpandedCountry(null)
  }

  const toggleCountry = (e: { currentTarget: HTMLElement }, country: Country): void => {
    if (expandedCountry?.id === country.id) {
      setExpandedCountry(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    // Opens to the left of the row, not below it — a flyout beside the
    // trigger rather than an accordion pushing the list around. Clamped
    // to a sane minimum so a row near the bottom of the (already
    // scrolled) list doesn't send the flyout off the bottom of the screen.
    setFlyoutPos({ top: Math.min(rect.top, window.innerHeight - 220), right: window.innerWidth - rect.left + 6 })
    setExpandedCountry(country)
  }

  const selectGenre = (genre: Genre): void => {
    onSelect({ type: 'genre', id: genre.id, label: genre.label })
    close()
  }

  const selectCountryGenre = (country: Country, genre: CountryGenre): void => {
    onSelect({ type: 'country', countryId: country.id, genreId: genre.id, label: `${country.label} · ${genre.label}` })
    close()
  }

  return (
    <div className="genre-menu-wrap">
      <button ref={triggerRef} className={`genre-menu-trigger ${activeSelection ? 'active' : ''}`} onClick={() => setOpen((o) => !o)}>
        <ListFilter size={14} />
        {activeSelection?.label ?? 'Browse'}
        <ChevronDown size={13} className="genre-menu-chevron" />
      </button>

      <Popover open={open} onClose={close} anchorRef={triggerRef} align="start" className="playlist-menu genre-menu">
        <div className="category-tabs">
          <button className={tab === 'genre' ? 'active' : ''} onClick={() => setTab('genre')}>
            <ListMusic size={13} />
            Genre
          </button>
          <button className={tab === 'country' ? 'active' : ''} onClick={() => setTab('country')}>
            <Globe2 size={13} />
            Country
          </button>
        </div>
        <svg className="genre-menu-wave" viewBox="0 0 260 6" preserveAspectRatio="none" aria-hidden>
          <path d={WAVE_PATH} fill="none" />
        </svg>

        {tab === 'genre' && (
          <div className="genre-menu-grid">
            {genres.map((genre) => (
              <button
                key={genre.id}
                className={`genre-menu-item ${activeSelection?.type === 'genre' && activeSelection.id === genre.id ? 'active' : ''}`}
                onClick={() => selectGenre(genre)}
              >
                <Music2 size={12} />
                {genre.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'country' && (
          <div className="genre-menu-list">
            {countries.map((country) => (
              <button
                key={country.id}
                className={`playlist-menu-item genre-menu-country ${
                  activeSelection?.type === 'country' && activeSelection.countryId === country.id ? 'active' : ''
                } ${expandedCountry?.id === country.id ? 'expanded' : ''}`}
                onClick={(e) => toggleCountry(e, country)}
              >
                {country.label}
                <ChevronDown size={13} className={`genre-menu-country-chevron ${expandedCountry?.id === country.id ? 'expanded' : ''}`} />
              </button>
            ))}
          </div>
        )}

        {tab === 'country' && expandedCountry && flyoutPos && (
          <div className="genre-menu-flyout" style={{ position: 'fixed', top: flyoutPos.top, right: flyoutPos.right }}>
            <div className="genre-menu-list">
              {expandedCountry.genres.map((genre) => (
                <button
                  key={genre.id}
                  className={`genre-menu-item ${
                    activeSelection?.type === 'country' && activeSelection.countryId === expandedCountry.id && activeSelection.genreId === genre.id
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => selectCountryGenre(expandedCountry, genre)}
                >
                  <Music2 size={12} />
                  {genre.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
    </div>
  )
}
