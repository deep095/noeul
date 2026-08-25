export type ThemeMode = 'dark' | 'light'

export interface AccentTheme {
  id: string
  name: string
  mode: ThemeMode
  /** Primary accent — used for text, borders, and progress-bar fills where a gradient can't apply. */
  accent: string
  /** Second gradient stop — used together with `accent` for buttons, badges, and the swatch preview itself. */
  accent2: string
  hover: string
  soft: string
  ink: string
  // Derived below, once, from the fields above — not hand-authored per
  // theme. Picking a theme used to only recolor a handful of spots that
  // read --accent directly (icons, the active-nav bar, the progress fill);
  // everything else — page background, card surfaces, borders, hover washes,
  // even body text — stayed one fixed dark-mode neutral regardless of theme,
  // which is also why "light" themes weren't possible before this: text and
  // overlay colors need to flip, not just the backgrounds.
  bg: string
  bgElevated: string
  bgHover: string
  bgPressed: string
  bgInset: string
  border: string
  borderSoft: string
  text: string
  textDim: string
  textFaint: string
  /** Generic translucent overlay (white-based in dark mode, black-based in light) for hover glows, shimmer, and outlines that aren't specifically "border" or "hover surface". */
  overlayWeak: string
  overlayMedium: string
  overlayStrong: string
  /** Ambient background glow blobs — separate from `soft` (used for focus rings/badges) because they need a lower alpha in light mode, where a saturated color patch on a near-white page reads as gaudy rather than atmospheric. */
  glow1: string
  glow2: string
}

interface ThemeSeed {
  id: string
  name: string
  mode: ThemeMode
  accent: string
  accent2: string
}

// Deep jewel and warm-metal tones — a curated dark set (crimson & antique
// gold, sapphire & amethyst, an emerald racing-green, aubergine plum,
// bronze-to-gold amber, a petrol teal) and a lighter-but-still-saturated
// counterpart set, rather than the high-chroma neon/candy pairings this
// had before. Grounded in actual references, not guessed: material colors
// associated with premium goods — onyx, gold, sapphire/navy, emerald,
// burgundy — read as "premium" specifically *because* they're deep and
// desaturated relative to a pure hue, and crimson+gold / sapphire+amethyst
// are established pairings for exactly that reason, not arbitrary picks.
// 'crimson' leads the dark set on purpose: it's DEFAULT_THEME_ID below.
const SEEDS: ThemeSeed[] = [
  { id: 'crimson', name: 'Crimson', mode: 'dark', accent: '#b8324a', accent2: '#d1a24a' },
  { id: 'sapphire', name: 'Sapphire', mode: 'dark', accent: '#3a5fa8', accent2: '#7c5cbf' },
  { id: 'emerald', name: 'Emerald', mode: 'dark', accent: '#21815f', accent2: '#5cae8a' },
  { id: 'plum', name: 'Plum', mode: 'dark', accent: '#7d3a6a', accent2: '#b25a8a' },
  { id: 'amber', name: 'Amber', mode: 'dark', accent: '#a8701f', accent2: '#d9a83f' },
  { id: 'teal', name: 'Teal', mode: 'dark', accent: '#1f7373', accent2: '#4a9fa0' },
  { id: 'coral', name: 'Coral', mode: 'light', accent: '#c1543f', accent2: '#d98a4a' },
  { id: 'azure', name: 'Azure', mode: 'light', accent: '#3568b3', accent2: '#6a7fd1' },
  { id: 'sage', name: 'Sage', mode: 'light', accent: '#4a8a5a', accent2: '#7cae6f' },
  { id: 'berry', name: 'Berry', mode: 'light', accent: '#a8395f', accent2: '#c76a8f' },
  { id: 'honey', name: 'Honey', mode: 'light', accent: '#b8862f', accent2: '#d9b04a' },
  { id: 'lagoon', name: 'Lagoon', mode: 'light', accent: '#2a8a8a', accent2: '#5cb0ad' }
]

/** Shown by default until the user picks something. */
export const DEFAULT_THEME_ID = 'crimson'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Blends two hex colors; t=0 is all `from`, t=1 is all `to`. */
function mix(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  const toHex = (v: number): string => Math.round(v).toString(16).padStart(2, '0')
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`
}

/** Blends two colors, then applies an alpha — for tinting a translucent overlay's hue without changing how strong it looks. */
function tintedRgba(from: string, to: string, t: number, alpha: number): string {
  return toRgba(mix(from, to, t), alpha)
}

/** Perceived brightness, 0 (black) to 1 (white) — good enough to pick a readable ink color, not for color science. */
function brightness(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 / 255
}

/** hover/soft/ink follow the same rule for every theme — preset or custom — rather than being hand-tuned per entry: `ink` in particular flips between a dark and light tint depending on how bright the accent pair averages out, so a deep jewel tone and a bright metal both get readable text/icons on their gradient buttons. */
function deriveAccentDetails(accent: string, accent2: string): { hover: string; soft: string; ink: string } {
  const avgBrightness = (brightness(accent) + brightness(accent2)) / 2
  return {
    hover: mix(accent, '#ffffff', 0.15),
    soft: toRgba(accent, 0.16),
    ink: avgBrightness > 0.55 ? mix('#000000', accent, 0.1) : mix('#ffffff', accent, 0.1)
  }
}

function deriveTheme(seed: ThemeSeed): AccentTheme {
  const isLight = seed.mode === 'light'
  // A cooler, slightly deeper neutral than the app's original flat gray —
  // closer to how apps like Discord build their dark surfaces. The accent
  // tint on top is deliberately faint: Vercel's own Geist color guidance is
  // explicit that surfaces should default to a neutral background and use
  // color "on top" of it sparingly, not wash the background itself — and
  // this app's own premise (README: "the one deliberately colorful moment
  // in an otherwise dim, quiet interface") says the same thing. A stronger
  // tint here was fighting both: pick a theme and it should read as "the
  // app, shifted a shade," not "the app, dyed."
  const neutralBg = isLight ? '#f1f1f4' : '#1c1d20'
  const neutralElevated = isLight ? '#ffffff' : '#26272b'
  const overlayBase = isLight ? '#000000' : '#ffffff'
  const textBase = isLight ? '#18181b' : '#ffffff'
  const bgTint = isLight ? 0.018 : 0.025
  const bg = mix(neutralBg, seed.accent, bgTint)
  const bgElevated = mix(neutralElevated, seed.accent, bgTint)
  const { hover, soft, ink } = deriveAccentDetails(seed.accent, seed.accent2)

  return {
    ...seed,
    hover,
    soft,
    ink,
    bg,
    bgElevated,
    bgInset: toRgba(bg, 0.85),
    bgHover: tintedRgba(overlayBase, seed.accent, 0.3, isLight ? 0.05 : 0.06),
    bgPressed: tintedRgba(overlayBase, seed.accent, 0.3, isLight ? 0.035 : 0.04),
    border: tintedRgba(overlayBase, seed.accent, 0.35, isLight ? 0.1 : 0.09),
    borderSoft: tintedRgba(overlayBase, seed.accent, 0.3, isLight ? 0.07 : 0.06),
    text: textBase,
    textDim: toRgba(textBase, 0.68),
    textFaint: toRgba(textBase, isLight ? 0.55 : 0.45),
    overlayWeak: tintedRgba(overlayBase, seed.accent, 0.2, 0.07),
    overlayMedium: tintedRgba(overlayBase, seed.accent, 0.2, 0.13),
    overlayStrong: tintedRgba(overlayBase, seed.accent, 0.2, 0.22),
    // Ambient background glow — a hint, not a wash. See the note above the
    // bg tint: this used to be strong enough to read as a colored gradient
    // background in its own right, which is exactly what a "one deliberate
    // colorful moment" app shouldn't have sitting permanently behind
    // everything.
    glow1: toRgba(seed.accent, isLight ? 0.05 : 0.09),
    glow2: toRgba(seed.accent2, isLight ? 0.04 : 0.07)
  }
}

export const ACCENT_THEMES: AccentTheme[] = SEEDS.map(deriveTheme)
export const DARK_THEMES: AccentTheme[] = ACCENT_THEMES.filter((t) => t.mode === 'dark')
export const LIGHT_THEMES: AccentTheme[] = ACCENT_THEMES.filter((t) => t.mode === 'light')

export const CUSTOM_THEME_ID = 'custom'

/** Builds a theme the same way a preset one is built, just from two user-picked colors and a chosen mode instead of a curated seed. */
export function createCustomTheme(accent: string, accent2: string, mode: ThemeMode): AccentTheme {
  return deriveTheme({ id: CUSTOM_THEME_ID, name: 'Custom', mode, accent, accent2 })
}

const STORAGE_KEY = 'noeul-accent-theme'
const CUSTOM_KEY = 'noeul-custom-theme'

interface CustomSelection {
  accent: string
  accent2: string
  mode: ThemeMode
}

export function loadSavedCustomSelection(): CustomSelection {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.accent === 'string' && typeof parsed?.accent2 === 'string') {
        return { accent: parsed.accent, accent2: parsed.accent2, mode: parsed.mode === 'light' ? 'light' : 'dark' }
      }
    }
  } catch {
    // fall through to the default pair below
  }
  return { accent: SEEDS[0].accent, accent2: SEEDS[0].accent2, mode: 'dark' }
}

function saveCustomSelection(selection: CustomSelection): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(selection))
  } catch {
    // localStorage can throw in some contexts (private mode etc.) — losing
    // the saved preference isn't worth failing over.
  }
}

export function gradientFor(theme: AccentTheme): string {
  return `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`
}

export function applyAccentTheme(theme: AccentTheme): void {
  const root = document.documentElement.style
  root.setProperty('--accent', theme.accent)
  root.setProperty('--accent-2', theme.accent2)
  root.setProperty('--accent-gradient', gradientFor(theme))
  root.setProperty('--accent-hover', theme.hover)
  root.setProperty('--accent-soft', theme.soft)
  root.setProperty('--accent-ink', theme.ink)
  root.setProperty('--glow-1', theme.glow1)
  root.setProperty('--glow-2', theme.glow2)
  root.setProperty('--bg', theme.bg)
  root.setProperty('--bg-elevated', theme.bgElevated)
  root.setProperty('--bg-hover', theme.bgHover)
  root.setProperty('--bg-pressed', theme.bgPressed)
  root.setProperty('--bg-inset', theme.bgInset)
  root.setProperty('--border', theme.border)
  root.setProperty('--border-soft', theme.borderSoft)
  root.setProperty('--text', theme.text)
  root.setProperty('--text-dim', theme.textDim)
  root.setProperty('--text-faint', theme.textFaint)
  root.setProperty('--overlay-weak', theme.overlayWeak)
  root.setProperty('--overlay-medium', theme.overlayMedium)
  root.setProperty('--overlay-strong', theme.overlayStrong)
}

export function loadSavedAccentTheme(): AccentTheme {
  try {
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (savedId === CUSTOM_THEME_ID) {
      const { accent, accent2, mode } = loadSavedCustomSelection()
      return createCustomTheme(accent, accent2, mode)
    }
    return ACCENT_THEMES.find((t) => t.id === savedId) ?? ACCENT_THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? ACCENT_THEMES[0]
  } catch {
    return ACCENT_THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? ACCENT_THEMES[0]
  }
}

export function saveAccentTheme(theme: AccentTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme.id)
    if (theme.id === CUSTOM_THEME_ID) saveCustomSelection({ accent: theme.accent, accent2: theme.accent2, mode: theme.mode })
  } catch {
    // localStorage can throw in some contexts (private mode etc.) — losing
    // the saved preference isn't worth failing over.
  }
}
