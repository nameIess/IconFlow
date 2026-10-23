# IconFlow Docker manual

IconFlow is distributed as one GHCR package and runs as two isolated Compose
containers:

```text
ghcr.io/nameiess/iconflow:<tag>
  ├─ iconflow-web-1      Nginx, published on 127.0.0.1:8080
  └─ iconflow-resolver-1 Node resolver, internal-only on port 3000
```

## Compose

To run a published release, choose an immutable version tag:

```powershell
$env:IMAGE_TAG = "1.0.0"
docker compose -f docker/compose.yaml pull
docker compose -f docker/compose.yaml up --detach --wait
docker compose -f docker/compose.yaml ps
```

For local development, omit `IMAGE_TAG` and build from the checkout:

```powershell
docker compose -f docker/compose.yaml up --build --detach --wait
```

The web service is the only host-published port. Both services use read-only
root filesystems, temporary writable mounts, dropped capabilities,
`no-new-privileges`, resource limits, non-root users, and health checks.

```powershell
curl.exe --fail http://127.0.0.1:8080/
curl.exe --fail http://127.0.0.1:8080/healthz
curl.exe --get --data-urlencode "url=https://example.com/" `
  http://127.0.0.1:8080/api/resolve-icon
docker compose -f docker/compose.yaml logs --no-color
docker compose -f docker/compose.yaml down --volumes --remove-orphans
```

The resolver request above returns HTTP 400 because arbitrary URLs are not
accepted.

## Manual `docker run`

Create a private network, then start both processes from the same image:

```powershell
docker network create iconflow

docker run --detach --name iconflow-resolver `
  --network iconflow --network-alias resolver `
  --user node --read-only --tmpfs /tmp:rw,noexec,nosuid,size=8m `
  --cap-drop ALL --security-opt no-new-privileges `
  ghcr.io/nameiess/iconflow:1.0.0 `
  node docker/resolver/server.mjs

docker run --detach --name iconflow-web `
  --network iconflow --publish 127.0.0.1:8080:8080 `
  --user nginx --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m `
  --cap-drop ALL --security-opt no-new-privileges `
  ghcr.io/nameiess/iconflow:1.0.0 `
  nginx -g "daemon off;"
```

Check the processes and clean up:

```powershell
docker exec iconflow-resolver wget -q -O - http://127.0.0.1:3000/healthz
curl.exe --fail http://127.0.0.1:8080/healthz
docker logs iconflow-web
docker logs iconflow-resolver
docker rm --force iconflow-web iconflow-resolver
docker network rm iconflow
```

## Publishing

Authenticate once and push tags for the one image:

```powershell
$env:GITHUB_TOKEN | docker login ghcr.io -u nameIess --password-stdin
docker push ghcr.io/nameiess/iconflow:1.0.0
docker push ghcr.io/nameiess/iconflow:sha-<commit>
docker push ghcr.io/nameiess/iconflow:latest
```

The Git tag is `v1.0.0`; the Docker image tag is `1.0.0`. The release workflow
also publishes `1.0`, `1`, and `latest` for stable releases. Prereleases get
only their version and commit tags. Prefer a version tag or digest for
production rollback; `latest` is mutable.
