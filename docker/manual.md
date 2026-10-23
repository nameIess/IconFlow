# IconFlow Docker Manual

This document explains how to build, run, tag, and publish the IconFlow Docker
images manually from Windows PowerShell.

## What should be committed?

Commit Docker instructions and build configuration to Git:

- `docker/manual.md`
- `docker/Dockerfile`
- `docker/resolver/Dockerfile`
- `docker/compose.yaml`
- `docker/nginx/`
- `.github/workflows/docker.yml`
- `scripts/docker-release.ps1`

Do not add this manual or the Dockerfiles to `.gitignore`. They are source
files required to reproduce the build.

Ignore only local and generated files, such as:

- Docker environment files containing local secrets
- Docker build output
- Local credentials and tokens
- `node_modules/`
- `dist/`

The repository's existing `.gitignore` already covers local environment files,
build output, and dependencies. Never commit a GitHub token, password, private
key, or a `.env` file containing secrets.

## Image names and tags

The image name has four parts:

```text
registry/owner/image:tag
```

For GitHub Container Registry (GHCR), IconFlow uses the `nameIess` account:

```text
ghcr.io/<github-owner>/iconflow-web:<tag>
ghcr.io/<github-owner>/iconflow-resolver:<tag>
```

The Docker registry path is lowercase because GHCR requires lowercase image
names:

```text
ghcr.io/nameiess/iconflow-web:1.0.0
ghcr.io/nameiess/iconflow-resolver:1.0.0
```

The tag is not stored inside a Dockerfile. It is assigned by `docker build -t`,
`docker tag`, Docker Compose, or the release workflow.

Recommended tags:

| Tag                | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `1.0.0`            | Immutable release version                          |
| `1.0`              | Minor-version convenience alias                    |
| `1`                | Major-version convenience alias                    |
| `sha-abc123def456` | Exact source commit                                |
| `latest`           | Mutable convenience alias; do not use for rollback |
| `ci`               | Temporary CI build tag                             |

Use a Git tag with a leading `v`, but remove the `v` from the Docker tag:

```text
Git tag:     v1.0.0
Docker tag:  1.0.0
```

## Prerequisites

Install and start Docker Desktop. Confirm that Docker and Git are available:

```powershell
docker --version
docker compose version
git --version
```

Run all commands from the repository root:

```powershell
cd D:\NeoSparkVibe\IconFlow
```

The first build needs network access to Docker Hub and the npm registry.

## Option 1: Build and run with Docker Compose

Compose is the recommended local method because it creates the network,
connects the frontend to the resolver, waits for the resolver health check, and
applies the project's runtime security settings.

The Compose project name is fixed to `iconflow` in
`docker/compose.yaml`. Containers are therefore named:

```text
iconflow-web-1
iconflow-resolver-1
```

Validate the configuration:

```powershell
docker compose -f docker/compose.yaml config --quiet
```

Build both images:

```powershell
docker compose -f docker/compose.yaml build --pull
```

Start the services and wait for health checks:

```powershell
docker compose -f docker/compose.yaml up --detach --wait --wait-timeout 90
```

Open the application:

```text
http://localhost:8080
```

Check the services and endpoints:

```powershell
docker compose -f docker/compose.yaml ps
curl.exe --fail http://127.0.0.1:8080/
curl.exe --fail http://127.0.0.1:8080/healthz
```

View logs:

```powershell
docker compose -f docker/compose.yaml logs --no-color
```

Stop and remove the local services and network:

```powershell
docker compose -f docker/compose.yaml down --volumes --remove-orphans
```

## Option 2: Build images manually

Manual `docker run` requires a Docker network because the frontend Nginx
configuration proxies `/api/resolve-icon` to the hostname `resolver`.

### 1. Choose an image owner and version

Use the `nameIess` account and choose an image version:

```powershell
$env:IMAGE_TAG = "1.0.0"
$resolverImage = "ghcr.io/nameiess/iconflow-resolver:$($env:IMAGE_TAG)"
$webImage = "ghcr.io/nameiess/iconflow-web:$($env:IMAGE_TAG)"
```

GHCR displays the `nameIess` account as the lowercase registry namespace
`nameiess` in Docker image paths.

### 2. Create the Docker network

```powershell
docker network create iconflow
```

If the network already exists, Docker reports an error that can be ignored.

### 3. Build the resolver image

```powershell
docker build --pull `
  --file docker/resolver/Dockerfile `
  --tag $resolverImage `
  .
```

### 4. Build the frontend image

```powershell
docker build --pull `
  --file docker/Dockerfile `
  --tag $webImage `
  .
```

### 5. Start the resolver

The `resolver` network alias is required by Nginx:

```powershell
docker run --detach `
  --name iconflow-resolver `
  --network iconflow `
  --network-alias resolver `
  --restart unless-stopped `
  $resolverImage
```

### 6. Start the frontend

```powershell
docker run --detach `
  --name iconflow-web `
  --network iconflow `
  --publish 127.0.0.1:8080:8080 `
  --restart unless-stopped `
  $webImage
```

Check the containers:

```powershell
docker ps
docker logs iconflow-resolver
docker logs iconflow-web
```

Test the application:

```powershell
curl.exe --fail http://127.0.0.1:8080/
curl.exe --fail http://127.0.0.1:8080/healthz
```

Remove the manually started containers and network:

```powershell
docker rm --force iconflow-web iconflow-resolver
docker network rm iconflow
```

## Create release tags locally

The repository provides `scripts/docker-release.ps1` as a local release
helper. It validates Compose, builds both images, and creates version and
commit tags locally. It does not push images to GHCR.

From the repository root:

```powershell
.\scripts\docker-release.ps1 -Version 1.0.0
```

This creates local tags similar to:

```text
ghcr.io/nameiess/iconflow-web:1.0.0
ghcr.io/nameiess/iconflow-web:sha-<commit>
ghcr.io/nameiess/iconflow-resolver:1.0.0
ghcr.io/nameiess/iconflow-resolver:sha-<commit>
```

To also create or update the local `latest` tag:

```powershell
.\scripts\docker-release.ps1 -Version 1.0.0 -UpdateLatest
```

Inspect local images:

```powershell
docker image ls ghcr.io/nameiess/iconflow-web
docker image ls ghcr.io/nameiess/iconflow-resolver
```

## Push images to GitHub Container Registry

### 1. Create a GitHub token

For a private package, use a GitHub Personal Access Token (classic) with:

- `write:packages` to push images
- `read:packages` to pull private images
- `delete:packages` only if package deletion is explicitly needed

Store the token only in an environment variable or a password manager. Do not
place it in this manual, a Dockerfile, source code, or Git.

### 2. Log in to GHCR

```powershell
$env:GITHUB_TOKEN = "<your-token>"
docker login ghcr.io -u nameIess --password-stdin
```

```powershell
$env:GITHUB_TOKEN | docker login ghcr.io -u nameIess --password-stdin
```

Clear the token after use:

```powershell
Remove-Item Env:GITHUB_TOKEN
```

### 3. Push version tags

```powershell
docker push ghcr.io/nameiess/iconflow-web:1.0.0
docker push ghcr.io/nameiess/iconflow-resolver:1.0.0
```

If you created aliases, push them explicitly:

```powershell
docker push ghcr.io/nameiess/iconflow-web:latest
docker push ghcr.io/nameiess/iconflow-resolver:latest
```

Prefer pushing immutable version and commit tags. Treat `latest` as an optional
convenience alias.

## Publish through GitHub Actions

The repository's Docker workflow is the preferred production publishing path.
It builds, scans, health-checks, smoke-tests, and publishes both images.

First push the manual and any intended Docker configuration changes:

```powershell
git checkout master
git pull origin master
git add docker/manual.md
git commit -m "docs: add Docker build and publishing manual"
git push origin master
```

Create and push an annotated release tag:

```powershell
git tag -a v1.0.0 -m "IconFlow Docker release 1.0.0"
git push origin v1.0.0
```

The workflow converts `v1.0.0` to Docker tag `1.0.0` and publishes:

```text
ghcr.io/nameiess/iconflow-web:1.0.0
ghcr.io/nameiess/iconflow-resolver:1.0.0
```

For stable releases, it also publishes `1.0`, `1`, and `latest`. A prerelease
such as `v1.1.0-rc.1` receives only its version and commit tags.

The workflow uses GitHub's automatic `GITHUB_TOKEN` and the job's
`packages: write` permission. A local GHCR token is not required by the
workflow.

## Pull and run a published version

For public packages:

```powershell
$env:IMAGE_TAG = "1.0.0"
docker compose -f docker/compose.yaml pull
docker compose -f docker/compose.yaml up --detach --wait
```

For private packages, log in to GHCR first with a token having
`read:packages`.

## Troubleshooting

Check image tags:

```powershell
docker image ls
```

Check Compose's resolved configuration:

```powershell
docker compose -f docker/compose.yaml config
```

If the frontend cannot reach the resolver during manual execution, confirm that
both containers use the `iconflow` network and that the resolver has the
network alias `resolver`:

```powershell
docker inspect iconflow-resolver
docker network inspect iconflow
```

If port `8080` is occupied, stop the process using it or change the host side
of the port mapping, for example `127.0.0.1:8081:8080`.

If Docker cannot pull base images or npm dependencies, verify Docker Desktop is
running and that the machine has network access to Docker Hub and npm.
