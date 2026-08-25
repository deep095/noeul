import { useState } from 'react'

interface Props {
  src: string | null | undefined
  alt?: string
  className?: string
  fallback: React.ReactNode
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
}

/**
 * A thumbnail URL being present doesn't mean it actually loads — YouTube
 * Music's catalog serves plenty of dead/expired thumbnail links, and
 * every call site already had a fallback for a *missing* thumbnail
 * (`track.thumbnail` being null) but nothing for one that's present and
 * simply fails to load, which just showed the browser's native "broken
 * image" icon indefinitely instead. Remembers the specific src that
 * failed (not just a boolean) so a later render with a genuinely
 * different, valid src still gets tried fresh.
 */
export default function SafeImage({ src, alt = '', className, fallback, loading, decoding }: Props): React.JSX.Element {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || src === failedSrc) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} draggable={false} loading={loading} decoding={decoding} onError={() => setFailedSrc(src)} />
}
