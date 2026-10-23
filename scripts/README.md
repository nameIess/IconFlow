# Local Docker image releases

Run the PowerShell release script from the repository root with an explicit version:

    .\scripts\docker-release.ps1 -Version 3.1.0

The script accepts Docker-compatible SemVer versions (MAJOR.MINOR.PATCH with an optional prerelease such as 3.1.0-rc.1). An optional leading "v" is accepted. SemVer build metadata (+build) is not supported because Docker tags do not allow the plus sign.

For each service it creates two local tags:
- ghcr.io/nameiess/iconflow-web:3.1.0 and ghcr.io/nameiess/iconflow-resolver:3.1.0
- iconflow-web:sha-<12-character-commit> and iconflow-resolver:sha-<12-character-commit>

The same version and source commit are used for both images, while each image remains independently built and has its own image ID/digest. The GitHub Docker release workflow publishes the tested images to GHCR on a validated `v*` Git tag, and advances `latest` only for stable releases after build, scan, health, and smoke-test gates pass. The script validates Compose, builds both images with --pull, and only tags them after both build outputs exist. It does not inspect local history to guess the next version, delete older images, create Git tags/commits, or push to a registry.

The version tag is never overwritten if it already exists locally. This local guard is not a global registry duplicate check; registry publishing remains intentionally disabled until a registry and its access policy are selected.

:ci is the stable local Compose build tag. :latest is mutable and not created/changed by default. To also update it deliberately:

    .\scripts\docker-release.ps1 -Version 3.1.0 -UpdateLatest

Use the immutable version tag or a digest for deployment/rollback, not :latest. For registry releases, create and protect a Git release tag such as v3.1.0 and use a future trusted release workflow to validate uniqueness at the registry before publishing.

## Local runtime checks

    docker compose -f docker/compose.yaml config --quiet
    docker compose -f docker/compose.yaml up --build --detach --wait --wait-timeout 90
    curl.exe --fail http://127.0.0.1:8080/
    curl.exe --fail http://127.0.0.1:8080/healthz
    docker compose -f docker/compose.yaml logs --no-color
    docker compose -f docker/compose.yaml down --volumes --remove-orphans

The resolver API should reject an untrusted URL with HTTP 400:

    curl.exe -i --get --data-urlencode "url=https://example.com/" http://127.0.0.1:8080/api/resolve-icon

Troubleshooting:
- If Docker commands cannot connect, start Docker Desktop / Docker Engine.
- If the port is occupied, stop the process using port 8080 before starting Compose.
- If health checks fail, inspect Compose logs; the resolver must become healthy before the frontend starts.
- A first build requires access to the base-image registry and npm registry.
