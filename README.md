# Noeul

[![Latest release](https://img.shields.io/github/v/release/deep095/noeul)](https://github.com/deep095/noeul/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/deep095/noeul/actions/workflows/ci.yml/badge.svg)](https://github.com/deep095/noeul/actions/workflows/ci.yml)

A free desktop music player: browse a home feed, search YouTube Music's catalog, play tracks (cached locally on first play), or download them (MP3, tagged) into a local library — no ads.

## Download

**[Latest release →](https://github.com/deep095/noeul/releases/latest)** (Windows installer)

The installer isn't code-signed, so Windows SmartScreen will warn on first run ("Windows protected your PC") — click **More info → Run anyway**. Normal for an unsigned indie app; nothing's wrong.

## Features

- Home feed, search, genre and country browsing, playlists, and a local downloaded-song library
- Spotify-style autoplay — once your queue runs out, it keeps going using YT Music's own "up next" mix
- Discord Rich Presence — shows what you're listening to on your Discord profile, cover art included, automatically whenever Discord is running (nothing to configure)
- A handful of built-in accent themes, plus a custom color picker
- No ads, no account, no tracking

## Run from source

```
npm install
npm run dev
```

This opens the app in a live-reloading dev window. First run will silently download `yt-dlp` and use the bundled `ffmpeg` — search should work immediately; playing or downloading a song for the first time may take a few seconds while `yt-dlp` is fetched and the track downloads. Replaying a track you've already played is instant (served from the local cache).

## Build a Windows installer

```
npm run dist
```

Produces an NSIS installer in `dist/` — this is what gets attached to a [release](https://github.com/deep095/noeul/releases).

## How it works

- `src/main/search.ts` — queries YouTube Music's catalog via `ytmusic-api` (no API key needed), including the curated home feed (`getHome`).
- `src/main/downloader.ts` — uses `yt-dlp` to either cache a track locally for playback (`resolvePlayableFile`) or download + convert it to a tagged MP3 for the library (`downloadSong`, via `ffmpeg`).
- `src/main/index.ts` — serves local audio to the renderer through a registered `noeulfile://` protocol (backed by `net.fetch` on the file) rather than a raw `file://` URL, since Chromium blocks `file://` media from the `http://localhost` origin the renderer runs on in dev mode.
- `src/main/library.ts` — a simple local JSON index of downloaded songs, stored in the app's user-data folder.
- `src/main/discordPresence.ts` — Discord Rich Presence over a local RPC connection to the Discord desktop client (no login/account-linking involved).
- `src/renderer` — the React UI (home, search, library, player bar).

## Note on legality

This downloads audio from YouTube for personal use, which is outside YouTube's Terms of Service and may not be legal everywhere. Use at your own discretion.

## License

[MIT](LICENSE)
