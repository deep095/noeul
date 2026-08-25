import { AudioLines, Disc3, Guitar, Music2, Piano } from 'lucide-react'
import NoteGlyph from './NoteGlyph'

interface Props {
  fading: boolean
}

// Real icons from the same set already used everywhere else in the app,
// not freehand illustration — scattered and oversized. A thinner stroke
// than their default at this size reads as an etched, elegant mark rather
// than a thick, clunky glyph blown up past its intended scale. Each fades
// in, holds visibly (not just barely-there), then fades back out and
// dissolves into the page — instruments joining, then disappearing into
// the background, rather than one bold centered loading icon.
const INSTRUMENTS: { Icon: typeof Guitar; top: string; left: string; size: number; delay: string }[] = [
  { Icon: Guitar, top: '14%', left: '12%', size: 140, delay: '0s' },
  { Icon: Piano, top: '62%', left: '76%', size: 130, delay: '0.5s' },
  { Icon: Disc3, top: '68%', left: '10%', size: 110, delay: '1s' },
  { Icon: Music2, top: '16%', left: '78%', size: 100, delay: '1.5s' },
  { Icon: AudioLines, top: '42%', left: '45%', size: 160, delay: '2s' }
]

const WORDMARK = 'Noeul'

export default function SplashScreen({ fading }: Props): React.JSX.Element {
  return (
    <div className={`splash-screen ${fading ? 'fading' : ''}`}>
      <div className="splash-instruments" aria-hidden>
        {INSTRUMENTS.map(({ Icon, top, left, size, delay }, i) => (
          <Icon key={i} className="splash-instrument" size={size} strokeWidth={1.25} style={{ top, left, animationDelay: delay }} />
        ))}
      </div>

      {/* One word, fading in, holding, fading out — the "l" is drawn as the
          actual note glyph from the app icon, so the word resolves into the
          mark rather than sitting next to it. The gradient text-clip lives
          on the inner span only: mixing it with the glyph's plain SVG in
          the same clipped box made the gradient fail to paint at all. */}
      <span className="splash-word" aria-label={WORDMARK}>
        <span className="splash-word-text">Noeu</span>
        <NoteGlyph className="note-glyph" />
      </span>
    </div>
  )
}
