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

Run the checks locally with:

```bash
npm test
npm run typecheck
npm run build
```

## Docker 🐳

Docker configuration lives in `docker/`. One GHCR image contains the static frontend and API resolver runtime; Compose starts it twice as isolated web and resolver containers. Only the frontend is published to the host; the resolver is reachable only through the Compose network.

### Prerequisites

- Docker Engine with the Compose plugin, or Docker Desktop with Compose

### Start locally

Run these commands from the repository root:

```bash
docker compose -f docker/compose.yaml up --build --detach --wait
docker compose -f docker/compose.yaml ps
```

Open [http://localhost:8080](http://localhost:8080).

The port is bound to `127.0.0.1` so the app is not exposed to other machines by default. The containers run as non-root users, drop Linux capabilities, enable `no-new-privileges`, use read-only root filesystems with temporary writable mounts, and have resource limits and health checks.

### Health, smoke test, logs, and shutdown

```bash
docker compose -f docker/compose.yaml ps
curl --fail http://127.0.0.1:8080/
curl --fail http://127.0.0.1:8080/healthz
curl --get --data-urlencode 'url=https://example.com/' http://127.0.0.1:8080/api/resolve-icon
docker compose -f docker/compose.yaml logs -f
docker compose -f docker/compose.yaml down --volumes --remove-orphans
```

The resolver smoke test should return HTTP 400 for `https://example.com/`, because only approved macOSicons HTTPS share URLs are accepted. The frontend health endpoint returns HTTP 204. Use `docker compose -f docker/compose.yaml ps` to confirm both services are healthy before debugging requests.

### Production image tags and releases

Compose uses one production GHCR image and defaults to `:latest`:

```yaml
image: ghcr.io/nameiess/iconflow:${IMAGE_TAG:-latest}
```

For local development, `docker compose -f docker/compose.yaml up --build -d` builds the current source and tags it `:latest`. To run a published release, pull and start the chosen tag:

```bash
# Convenient rolling deployment (moves when latest is republished)
docker compose -f docker/compose.yaml pull
docker compose -f docker/compose.yaml up --detach --wait

# Reproducible deployment pinned to the first release
IMAGE_TAG=1.0.0 docker compose -f docker/compose.yaml pull
IMAGE_TAG=1.0.0 docker compose -f docker/compose.yaml up --detach --wait
```

Before each release, update [`.github/release.md`](.github/release.md) on the branch that will be merged into `master`. Set its release-tag marker to the exact Git tag, fill in the summary and change bullets, and remove all placeholders. The release workflow checks this file before building.

The release workflow is driven by a Git tag, not by local Docker history. After the release changes and `.github/release.md` are merged into `master`, push an annotated version tag, for example:

```bash
git tag -a v3.0.3 -m "IconFlow v3.0.3"
git push origin v3.0.3
```

That triggers validation, image builds, vulnerability scans, health checks and smoke tests. The workflow also requires the tag version to match `package.json`. Only after those gates pass does it publish one image to GHCR and create a GitHub Release using `.github/release.md` as its body. The downloadable `compose.yaml` asset pins both services to that exact release image tag; the source `docker/compose.yaml` keeps its `latest` default for general use. Stable tags also move the major, minor, and `latest` image aliases. Prerelease tags create GitHub prereleases and do not move stable Docker aliases. Existing release tags are not overwritten. Registry package visibility must be set appropriately in GitHub Packages; the workflow does not silently change visibility.

For production rollouts, prefer `IMAGE_TAG=1.0.0` (or a digest) to keep deployments reproducible. The default `:latest` is a convenience pointer and can change when a new stable release passes all gates. See [scripts/README.md](scripts/README.md) for local tagging and troubleshooting.

The combined image currently uses the versioned `node:24-alpine` base and installs Alpine's Nginx package; CI/release builds use `--pull`. These inputs are mutable, so rebuilding later can select newer base layers; this is an explicit update policy, not byte-for-byte reproducibility. Digest pinning is deferred until the correct multi-platform digests and a regular digest-update process are verified. The first build needs network access to download the base image, Alpine packages, and npm packages. Docker CI also downloads Trivy vulnerability databases during image scanning. The resolver also needs outbound HTTPS access to the allow-listed macOSicons hosts to resolve shared icon links. Do not publish the resolver port directly or mount the Docker socket into either container.

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

Pasting a macOSicons share URL (or uploading a `.txt` list, up to 100 links) calls `GET /api/resolve-icon?url=…`. The resolver fetches share pages only from allow-listed macOSicons hosts, follows at most three allow-listed redirects, caps the page at 2 MB, and extracts asset URLs from `s3-new.macosicons.com`. Direct asset links are validated before import. Imports do not use a search API key. Imported icons are merged into the grid and de-duplicated against existing results by icon ID and asset URLs.

## Security 🛡️

- Search keys are sent only to the macOSicons search API.
- Keys are never logged.
- Only HTTPS icon sources from the allow-listed macOSicons asset host are accepted.
- Creator links are only opened when they use HTTPS.
- Requests have timeouts and response-size limits.
- Content Security Policy and security headers are configured for both Vercel and the Docker web server.
- Docker's resolver is not published to the host; the local web port binds to loopback.

## Development and GitHub Actions 🧰

The GitHub Actions workflows are split into two responsibilities. Both run on pull requests targeting `master`, pushes to `feature/**`, `feat/**`, and `fix/**`, and manual dispatch. The Docker workflow also runs on `v*` Git tags to validate and publish a production release to GHCR:

- **CI** — `.github/workflows/ci.yml`: runs `npm test`, TypeScript type-checking, `npm audit --audit-level=high`, and `npm run build` to verify the production app.
- **Docker** — `.github/workflows/docker.yml`: validates Compose, builds one image with pull-enabled base tags, scans it for fixable HIGH/CRITICAL vulnerabilities, starts both containers, waits for health checks, and smoke-tests the frontend and resolver. A qualifying Trivy finding fails the workflow; findings without an available fix are currently excluded from this blocking gate.

Node.js 24 is used in CI and builds (`.nvmrc`); Vite 8 itself requires Node.js `^20.19.0 || >=22.12.0`.

## Contributing 🤝

1. Create a focused branch for your change.
2. Run `npm test`, `npm run typecheck`, and `npm run build`.
3. Update the relevant documentation when behavior changes.
4. Open a pull request using the repository template.

For README or documentation updates, include a short summary of the user-facing improvements and note any commands used to validate the changes.

## Attribution 🙏

Icons and creator information are provided by [macOSicons](https://macosicons.com/).
