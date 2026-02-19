<p align="center">
  <img src="public/mascot.svg" alt="Boxy" width="120" height="120">
</p>

<h1 align="center">Boxy</h1>

<p align="center">
  <strong>Your clips, organized. ( you know who you are )</strong>
</p>

<p align="center">
  <a href="https://github.com/visualstudioblyat/boxy/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/visualstudioblyat/boxy?style=flat-square&color=6366f1"></a>
  <a href="https://github.com/visualstudioblyat/boxy/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/visualstudioblyat/boxy?style=flat-square&color=6366f1"></a>
  <a href="https://github.com/visualstudioblyat/boxy/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/visualstudioblyat/boxy?style=flat-square&color=6366f1"></a>
</p>

<p align="center">
  Local desktop video clip manager. Scan folders, thumbnail, tag, trim, GIF export, compress, and organize your clips. Everything offline, nothing leaves your machine.
</p>

<p align="center">
  <a href="https://github.com/visualstudioblyat/boxy/issues">Report Bug</a> •
  <a href="https://github.com/visualstudioblyat/boxy/discussions">Feature Request</a>
</p>

---

## Features

- **Auto-scan & Thumbnails** - Point it at your folders, it finds all your clips, generates thumbnails, and watches for new files in real-time.
- **Tags, Stars, Collections** - Tag clips, star favorites, organize into collections. Smart folders auto-filter based on rules you set (duration, size, source, etc).
- **Trim, GIF, Compress** - Quick trim with stream copy (instant) or precise re-encode. Two-pass GIF export. Compress with quality presets. All via ffmpeg.
- **Filmstrip Hover Preview** - Hover over a thumbnail and scrub through the video without clicking.
- **Playback Speed** - 0.25x to 4x with keyboard shortcuts (`[` and `]`).
- **Waveform Display** - Audio waveform visualization in the detail panel, cached in SQLite.
- **Semantic Search** - Search by description with bag-of-words cosine similarity.
- **Bulk Operations** - Ctrl+Click to multi-select, then bulk tag, star, or delete. Ctrl+A selects all.
- **Source Color Coding** - Each watch folder gets a color-coded stripe so you can tell where clips came from at a glance.
- **Frame Capture** - Grab any frame as a PNG.
- **Custom Titlebar** - Frameless window with a custom mascot.

## Tech Stack

| Layer | Tech |
|-------|------|
| Shell | [Tauri v2](https://v2.tauri.app/) (Rust) |
| Frontend | React 18 + TypeScript + Zustand |
| Database | SQLite (rusqlite, bundled) |
| Virtual Scroll | @tanstack/react-virtual |
| Video | ffmpeg / ffprobe (system install) |
| File Watching | notify crate with 2s debounce |
| Allocator | mimalloc |
| Video Streaming | Custom `localfile://` protocol with HTTP 206 range requests |

## Prerequisites

- [Node.js](https://nodejs.org/) (18+)
- [Rust](https://rustup.rs/)
- [ffmpeg](https://ffmpeg.org/) - needs to be in PATH or installed via winget/chocolatey. Boxy will auto-detect common install locations on Windows.

## Building from Source

```bash
npm install
npx tauri dev
```

For a production build:

```bash
npm run tauri build
```

The installer lands in `src-tauri/target/release/bundle/`.

## Release Build Optimizations

The release profile is tuned for size and speed:

- `lto = "thin"` - link-time optimization
- `codegen-units = 1` - single codegen unit for better optimization
- `strip = true` - strip debug symbols
- `opt-level = 3` - max optimization
- `mimalloc` global allocator - faster than system malloc on Windows
- Vendor chunk splitting (React, Zustand, Tauri API separated)

## Project Structure

```
src/                    # React frontend
  components/           # UI components (GridView, Sidebar, TrimEditor, etc)
  store/                # Zustand stores (clips, ui, tags, collections, search)
  styles/               # Global CSS (glass morphism theme)
src-tauri/              # Rust backend
  src/
    db.rs               # SQLite schema, migrations, all queries
    scan.rs             # File scanner + orphan detection
    thumbs.rs           # Thumbnail generation via ffmpeg
    editing.rs          # Trim, merge, GIF, compress, waveform
    ffmpeg.rs           # Shared ffmpeg command helper
    watcher.rs          # File system watcher (notify crate)
    search.rs           # Semantic search with embeddings
    lib.rs              # Tauri commands + app setup
```

## Contributing

Open an issue or submit a PR. Keep it simple - no over-engineering.

## License

[MIT](LICENSE)
