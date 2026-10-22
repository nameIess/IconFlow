# IconFlow ✨

IconFlow is a fast, browser-first macOS icon finder built with React, TypeScript, Vite, and npm. Search macOSicons, browse results with pagination, and import shared icon links without sending your API keys to a server. 🎨

## Highlights 🚀

- 🔎 Search macOSicons with paginated results.
- ⚡ Reuse cached pages and collapse duplicate requests.
- 📥 Import icons from macOSicons share URLs or `.txt` lists.
- 🔐 Keep search keys in your browser and validate remote sources.
- 🛡️ Use security headers, request timeouts, and response-size limits.

## Quick start 🧑‍💻

### Prerequisites

- Node.js 24 (the version used in CI)
- npm

### Install and run

```bash
npm ci
npm run dev
```

Run the checks used for production builds with:

```bash
npm run typecheck
npm run build
```

## API keys 🔑

IconFlow uses two separate personal macOSicons API keys:

- **Primary Search API key** — used first for `POST /api/v1/search`.
- **Backup Search API key** — used for search requests when the primary key is rate-limited.

Both are stored locally in the user's browser. No API key is embedded in source code, Vercel environment variables, a server, or a database. These browser-stored keys are accessible to JavaScript running on the same origin, so users should not reuse a sensitive account-wide secret. The app does not need a separate download API key; icon assets are fetched from allow-listed macOSicons asset URLs.

## Search pagination 📚

The search request follows the documented Meilisearch-style contract:

```json
{
  "query": "safari",
  "searchOptions": {
    "hitsPerPage": 50,
    "page": 2,
    "offset": 50
  }
}
```

Pages are fixed at 50 icons by default:

- Page 1: 1–50
- Page 2: 51–100
- Page 3: 101–150
- Final page: remaining results

`VITE_SEARCH_PAGE_SIZE` can override the page size up to 200. The response's `page`, `offset`, and `hitsPerPage` are validated before results are appended. Search pages are cached in memory and browser storage, and duplicate in-flight requests are collapsed. The cache is keyed by query, page, and page size—not by API key—so cached search data can be reused when the configured key changes. Results served from cache never show the backup-key notice, since no request is made.

## Importing icons 📥

Pasting a macOSicons share URL (or uploading a `.txt` list, up to 100 links) calls `GET /api/resolve-icon?url=…`. The serverless resolver fetches share pages only from allow-listed macOSicons hosts, follows at most three allow-listed redirects, caps the page at 2 MB, and extracts asset URLs from `s3-new.macosicons.com`. Direct asset links are validated before import. Imports do not use a search API key. Imported icons are merged into the grid and de-duplicated against existing results by icon ID and asset URLs.

## Security 🛡️

- Search keys are sent only to the macOSicons search API.
- Keys are never logged.
- Only HTTPS icon sources from the allow-listed macOSicons asset host are accepted.
- Creator links are only opened when they use HTTPS.
- Requests have timeouts and response-size limits.
- Content Security Policy and Vercel security headers are enabled.

## Development 🧰

Node.js 24 is used in CI (`.nvmrc`); Vite 8 itself requires Node.js `^20.19.0 || >=22.12.0`.

CI runs `npm ci --ignore-scripts --no-fund`, checks dependencies with `npm audit --audit-level=high`, and runs the typecheck/build even when the audit reports a vulnerability. A final enforcement step keeps the audit a required gate without hiding unrelated build failures. The workflow runs on pull requests targeting `master` and manual dispatch; it does not run on every push.

## Contributing 🤝

1. Create a focused branch for your change.
2. Run `npm run typecheck` and `npm run build`.
3. Update the relevant documentation when behavior changes.
4. Open a pull request using the repository template.

For README or documentation updates, include a short summary of the user-facing improvements and note any commands used to validate the changes.

## Attribution 🙏

Icons and creator information are provided by [macOSicons](https://macosicons.com/).