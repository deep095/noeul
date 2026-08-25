import { useState } from 'react'
import { Check, Moon, Palette, Sun } from 'lucide-react'
import {
  CUSTOM_THEME_ID,
  DARK_THEMES,
  LIGHT_THEMES,
  createCustomTheme,
  gradientFor,
  loadSavedCustomSelection,
  type AccentTheme,
  type ThemeMode
} from './accentThemes'

interface Props {
  current: AccentTheme
  onSelect: (theme: AccentTheme) => void
}

export default function SettingsMenu({ current, onSelect }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // Seeds the custom picker from whatever custom gradient was last used (or
  // the current theme, if it's already the custom one) — so reopening the
  // menu doesn't reset it to some arbitrary default.
  const [customSelection, setCustomSelection] = useState(() =>
    current.id === CUSTOM_THEME_ID ? { accent: current.accent, accent2: current.accent2, mode: current.mode } : loadSavedCustomSelection()
  )

  const applyCustom = (next: { accent: string; accent2: string; mode: ThemeMode }): void => {
    setCustomSelection(next)
    onSelect(createCustomTheme(next.accent, next.accent2, next.mode))
  }

  return (
    <div
      className="settings-menu-wrap"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button className="nav-item reveal settings-trigger" onClick={() => setOpen((o) => !o)} title="Appearance">
        <Palette size={16} />
        Appearance
      </button>

      {open && (
        <div className="settings-menu">
          <div className="settings-menu-section">
            <span className="settings-menu-label">Dark</span>
            <div className="theme-swatch-row">
              {DARK_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-swatch ${current.id === theme.id ? 'selected' : ''}`}
                  style={{ background: gradientFor(theme) }}
                  onClick={() => onSelect(theme)}
                  aria-label={theme.name}
                >
                  {current.id === theme.id && <Check size={13} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-menu-section">
            <span className="settings-menu-label">Light</span>
            <div className="theme-swatch-row">
              {LIGHT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-swatch ${current.id === theme.id ? 'selected' : ''}`}
                  style={{ background: gradientFor(theme) }}
                  onClick={() => onSelect(theme)}
                  aria-label={theme.name}
                >
                  {current.id === theme.id && <Check size={13} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-menu-section">
            <span className="settings-menu-label">Custom</span>
            <div className="custom-gradient-row">
              <button
                className={`theme-swatch custom-gradient-preview ${current.id === CUSTOM_THEME_ID ? 'selected' : ''}`}
                style={{ background: `linear-gradient(135deg, ${customSelection.accent} 0%, ${customSelection.accent2} 100%)` }}
                onClick={() => applyCustom(customSelection)}
                aria-label="Use custom gradient"
              >
                {current.id === CUSTOM_THEME_ID && <Check size={13} strokeWidth={3} />}
              </button>
              <input
                type="color"
                className="custom-color-input"
                value={customSelection.accent}
                onChange={(e) => applyCustom({ ...customSelection, accent: e.target.value })}
                aria-label="First gradient color"
              />
              <input
                type="color"
                className="custom-color-input"
                value={customSelection.accent2}
                onChange={(e) => applyCustom({ ...customSelection, accent2: e.target.value })}
                aria-label="Second gradient color"
              />
            </div>
            <div className="custom-mode-toggle">
              <button
                className={customSelection.mode === 'dark' ? 'active' : ''}
                onClick={() => applyCustom({ ...customSelection, mode: 'dark' })}
              >
                <Moon size={11} /> Dark
              </button>
              <button
                className={customSelection.mode === 'light' ? 'active' : ''}
                onClick={() => applyCustom({ ...customSelection, mode: 'light' })}
              >
                <Sun size={11} /> Light
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
