interface Props {
  className?: string
  style?: React.CSSProperties
}

// The "l" in the wordmark, redrawn as the same note shape used for the app
// icon — a stem, a tilted notehead, and a curling flag — so the letter
// itself reads as a musical note rather than just being decorated to imply
// one. Sized entirely in em so it scales with whatever font-size it's
// dropped into (the splash hero and the sidebar wordmark both use it).
export default function NoteGlyph({ className, style }: Props): React.JSX.Element {
  return (
    <svg className={className} style={style} viewBox="24 18 52 64" aria-hidden focusable="false">
      <ellipse cx="40" cy="68" rx="12" ry="9" transform="rotate(-16 40 68)" />
      <rect x="47" y="24" width="7" height="46" rx="3.5" />
      <path d="M54,24 C70,29 72,46 56,54 C65,44 63,30 54,24 Z" />
    </svg>
  )
}
