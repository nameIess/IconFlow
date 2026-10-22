# IconFlow

IconFlow is a browser-first macOS icon finder rebuilt from scratch for Vercel.

## What changed

The web version does not use the original Node server or its filesystem/Windows integration. The application is a new React + TypeScript implementation.

### Client-only API key

Each user supplies their own macOSicons API key. The key is stored in that user's browser under localStorage and is attached directly to macOSicons API requests.

IconFlow does not:
- put a shared API key in source code
- store user keys in Vercel environment variables
- send user keys to an IconFlow backend
- store user keys in a database

macOSicons' current API terms explicitly recommend that distributed apps have each user obtain their own API key rather than embedding a shared key.

## Icon pipeline

Search results can use the API preview URL for a lightweight grid. When a user previews or downloads an icon, IconFlow fetches the original high-resolution ICNS asset in the browser.

The browser then:
- extracts the largest PNG-backed ICNS representation it can decode
- generates a 1024px PNG locally
- generates a multi-size ICO containing 16, 24, 32, 48, 64, 128 and 256px PNG entries
- downloads the result directly to the user's device

No conversion request is sent to an IconFlow server.

## Development

    npm install
    npm run dev

Production verification:

    npm run typecheck
    npm run build

## Vercel

Import the repository into Vercel and use:

- Framework preset: Vite
- Build command: npm run build
- Output directory: dist

No application environment variables are required for the API key.

## Attribution

IconFlow preserves the creator information returned by macOSicons and links back to macOSicons where appropriate.

macOSicons:
https://macosicons.com

API documentation:
https://macosicons.com/developers

API terms:
https://macosicons.com/developers/terms
