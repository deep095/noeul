import type { MouseEvent } from 'react'

/**
 * Fluent Design's signature micro-interaction: a soft highlight that tracks
 * the cursor across a surface, rather than a flat hover-color swap. Sets CSS
 * custom properties the `.reveal` class reads to position a radial-gradient
 * pseudo-element — see the `.reveal` rule in styles.css.
 */
export function onReveal(e: MouseEvent<HTMLElement>): void {
  const rect = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
