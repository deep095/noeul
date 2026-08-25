import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyAccentTheme, loadSavedAccentTheme } from './accentThemes'
import './styles.css'

// Applied here, synchronously, before the first paint — App.tsx re-applies
// it in a useEffect too (for when the user switches themes later), but that
// runs after the initial render commits. Without this, anything themed that
// renders in that first frame — the splash screen most of all, since it's
// the very first thing shown — reads CSS variables that don't exist yet.
applyAccentTheme(loadSavedAccentTheme())

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
