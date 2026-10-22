# IconFlow

IconFlow is a browser-first macOS icon finder built with React, TypeScript, Vite and npm.

## API keys

IconFlow uses two separate personal macOSicons API keys:

- **Search API key** — only for `POST /api/v1/search`.
- **Download API key** — only for fetching original ICNS files for preview/download.

Both are stored locally in the user's browser. No API key is embedded in source code, Vercel environment variables, a server, or a database.

## Search pagination

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

Pages are fixed at 50 icons:

- Page 1: 1–50
- Page 2: 51–100
- Page 3: 101–150
- Final page: remaining results

The response's `page`, `offset`, and `hitsPerPage` are validated before the grid is replaced. Previous pages are cached in memory and duplicate in-flight requests are collapsed, so repeated clicks do not create repeated API requests.

## Security

- Search and download keys are never mixed.
- Keys are never logged.
- Only HTTPS icon sources are accepted.
- Creator links are only opened when they use HTTPS.
- Requests have timeouts and explicit error handling.
- Content Security Policy and Vercel security headers are enabled.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Attribution

Icons and creator information are provided by macOSicons.
