# Noeul

[![Latest release](https://img.shields.io/github/v/release/deep095/noeul)](https://github.com/deep095/noeul/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/deep095/noeul/actions/workflows/ci.yml/badge.svg)](https://github.com/deep095/noeul/actions/workflows/ci.yml)

A free desktop music player: browse a home feed, search YouTube Music's catalog, play tracks (cached locally on first play), or download them (MP3, tagged) into a local library — no ads.

## Download

**[Latest release →](https://github.com/deep095/noeul/releases/latest)** (Windows installer)

Unsigned, so Windows SmartScreen will warn on first run — click **More info → Run anyway**. Normal for an indie app, nothing's wrong.

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

Opens a live-reloading dev window. `yt-dlp` downloads itself on first use, so the first play/download is a little slower — after that, replays are instant (served from the local cache).

## Build a Windows installer

```
npm run dist
```

Produces an NSIS installer in `dist/` — this is what gets attached to a [release](https://github.com/deep095/noeul/releases).

## How it works

- `src/main/search.ts` — YouTube Music search and home feed, via `ytmusic-api`
- `src/main/downloader.ts` — streams and downloads audio with `yt-dlp` + `ffmpeg`
- `src/main/library.ts` — local JSON index of downloaded songs
- `src/main/discordPresence.ts` — Discord Rich Presence over a local RPC connection
- `src/renderer` — the React UI (home, search, library, player bar)

## Note on legality

This downloads audio from YouTube for personal use, which is outside YouTube's Terms of Service and may not be legal everywhere. Use at your own discretion.

## License

[MIT](LICENSE)
