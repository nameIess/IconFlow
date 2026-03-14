# mac-icns CLI

A powerful CLI to search, download, and install macOS icons from the macosicons.com API. Supports an interactive TUI, global configuration, Windows folder/shortcut icons, and smart caching.

Version: v2.0.0

## Features

- **Interactive TUI** — Arrow-key selection with Clack prompts; no typing indices
- **Search** — Find icons by keyword with download counts and authors
- **Download** — Direct downloads with batch support (`--all`)
- **Links file mode** — Download from a text file of links/ids (`--links-file`)
- **Windows support** — Downloads `.icns`, converts to `.ico`, applies to folders or shortcuts
- **macOS install** — Apply `.icns` directly to application bundles
- **Global config** — Works as `npm i -g macicon-fetcher` with config in `~/.config/mac-icns/`
- **Smart caching** — SQLite cache for searches and downloads (rate-limit friendly)
- **Retry logic** — Exponential backoff for failed downloads

## Installation

```bash
npm install -g macicon-fetcher
# or
npm install
npm run build
npm link
```

`npm link` makes the global `mac-icns` command available for local development.

## API Key Setup

Config resolution order: **Environment variables** → **Global config file** → **Project .env** → defaults.

### Option 1: Project `.env`

```env
# Get yours at: https://macosicons.com
MACOSICONS_API_KEY=your_key
DOWNLOAD_DIR=%USERPROFILE%\Downloads\icons\icns
DOWNLOAD_DIR_ICO=%USERPROFILE%\Downloads\icons\ico
DELETE_ICNS_AFTER_CONVERT=false
DEFAULT_LIMIT=25
```

### Option 2: Global Config (for `npm i -g`)

```bash
mac-icns config -p   # Show config path
```

Create `~/.config/mac-icns/config.json` (or `%APPDATA%\mac-icns\Config\config.json` on Windows):

```json
{
  "apiKey": "your_key",
  "downloadDir": "path or %VAR% expansion (icns)",
  "downloadDirIco": "path or %VAR% expansion (ico)",
  "deleteIcnsAfterConvert": false,
  "defaultLimit": 25,
  "cacheTtlHours": 24
}
```

## Commands

### Search (interactive TUI)

```bash
mac-icns search safari
# or
npm run search -- safari --limit 5
```

Shows results in a table, then an arrow-key multiselect to choose icons to download.

**Options:** `--limit <n>`, `--page <n>`, `--json`, `--out <dir>`

### Download

```bash
mac-icns download safari --index 1
mac-icns download safari --all --limit 5
mac-icns download safari --dry-run
mac-icns download --links-file ./icons.txt
```

On Windows, icons are downloaded as `.icns` then converted to `.ico` automatically.
By default, `.icns` and `.ico` are stored in separate folders.

**Options:** `--index <n>`, `--limit <n>`, `--page <n>`, `--out <dir>`, `--all`, `--links-file <file>`, `--dry-run`, `--delete-icns`, `--verbose`, `--format icns|ico`, `--install-target <target>`, `--install-shortcut`, `--install-app-path <path>`, `--install-backup`

#### Download From Links File

Create a file with one URL or icon id per line:

```txt
https://macosicons.com/?icon=7EEtrw0xZB
https://macosicons.com/?icon=abc123xyz
7EEtrw0xZB
# comments are allowed
```

Then run:

```bash
mac-icns download --links-file ./icons.txt
```

Links-file mode is non-interactive by default and processes all valid entries.
If a `?icon=` page is protected by the site, the CLI may briefly open a local Chromium-based browser to resolve the direct `.icns` download URL.

#### Download And Install In One Step

Windows folder target:

```bash
mac-icns download --links-file ./icons.txt --install-target C:\path\to\folder
```

Windows shortcut target:

```bash
mac-icns download --links-file ./icons.txt --install-target C:\path\to\shortcut.lnk --install-shortcut
```

macOS app target by name:

```bash
mac-icns download --links-file ./icons.txt --install-target Safari
```

macOS app target by full path:

```bash
mac-icns download --links-file ./icons.txt --install-target Safari --install-app-path /Applications/Safari.app --install-backup
```

If multiple icons are processed with one install target, each successful install replaces the previous icon.

### Install

**macOS** — Install to an app bundle:

```bash
mac-icns install Safari.icns Safari
mac-icns install icon.icns MyApp --app-path /path/to/MyApp.app --backup
```

**Windows** — Apply to folder or shortcut:

```bash
mac-icns install icon.icns C:\path\to\folder
mac-icns install icon.icns C:\path\to\shortcut.lnk --shortcut
```

### Config

```bash
mac-icns config -p    # Show global config path
mac-icns config -s    # Show resolved config
```

## Requirements

- Node.js 18+

## Direct usage

```bash
node dist/index.js search safari
node dist/index.js download safari --index 2
node dist/index.js download --links-file ./icons.txt
node dist/index.js install ./icon.icns Safari
```

## Troubleshooting

### PowerShell: `mac-icns` is not recognized

If PowerShell shows `CommandNotFoundException`, run:

```bash
npm install
npm run build
npm link
mac-icns --help
```

For global usage from npm registry:

```bash
npm install -g macicon-fetcher
mac-icns --help
```

If command still does not resolve, restart your terminal so PATH updates are applied.
