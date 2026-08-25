interface Props {
  size?: number
}

/** A trio of animated "strings" (same motif and animation as the launch splash, see GuitarSplash) — a purely visual stand-in for the generic spinner while a track is resolving, no audio involved. */
export default function StringsLoader({ size = 16 }: Props): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className="strings-loader" aria-hidden>
      <path className="pluck-loader-1" d="M5 2 Q7 10 5 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path className="pluck-loader-2" d="M10 2 Q12 10 10 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path className="pluck-loader-3" d="M15 2 Q17 10 15 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
