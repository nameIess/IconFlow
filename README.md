# IconFlow

One-click macOS icon downloader with a clean, modern web GUI. Search any macOS app icon from [macosicons.com](https://macosicons.com), preview it, and download instantly — in `.icns` or `.ico` format.

## Features

- **One-Click Downloads** — Search and download instantly
- **Batch Downloads** — Download all search results at once
- **Format Control** — Choose between Auto, ICNS, or ICO
- **Auto Conversion** — Converts `.icns` → `.ico` automatically on Windows
- **Apply to System** — Install icons to Windows folders or shortcuts
- **Configurable** — API key, download dirs, host/port — all from the Settings panel
- **Premium UI** — Geist-inspired dark theme, responsive, production-ready

## Requirements

- [Node.js](https://nodejs.org) v18+

## Quick Start

```
start.bat
```

Or manually:

```bash
npm install
npm start
```

The app opens automatically in your browser at `http://127.0.0.1:3456`.

## Configuration

Click **Settings** in the top-right corner of the app, or edit `.env` directly:

```env
MACOSICONS_API_KEY=your_key_here

# Server bind address (change to 0.0.0.0 for LAN access)
HOST=127.0.0.1
PORT=3456

DOWNLOAD_DIR=%USERPROFILE%\Downloads\icons\icns
DOWNLOAD_DIR_ICO=%USERPROFILE%\Downloads\icons\ico
DEFAULT_LIMIT=25
DELETE_ICNS_AFTER_CONVERT=true
```

## Project Structure

```
├── backend/
│   └── src/
│       ├── server.js          # HTTP server entry point
│       ├── config/             # .env loader & config
│       ├── controllers/        # Request handlers
│       ├── routes/             # API route definitions
│       ├── services/           # Business logic
│       │   ├── search.js       #   macosicons.com API
│       │   ├── download.js     #   Download & convert
│       │   └── install.js      #   OS icon install
│       └── utils/              # HTTP helpers
├── frontend/
│   └── public/
│       ├── index.html          # Single-page UI
│       ├── style.css           # Geist-inspired design system
│       └── app.js              # Frontend logic
├── .env                        # Configuration
├── package.json
├── start.bat                   # Windows launcher
└── README.md
```

## Tech Stack

- **Backend**: Node.js (native `http` module — zero framework dependencies)
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Conversion**: `sharp` + `sharp-ico` + `@fiahfy/icns`
