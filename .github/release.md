<!-- release-tag: v3.0.4 -->

## Summary

IconFlow 3.0.4 publishes a Compose asset pinned to its Docker image version and improves import and retry behavior.

## Changes

- Pin both services in the downloadable Compose asset to the exact release version, and require the Git tag to match `package.json`.
- Show imported icons separately from search results, with accurate counts and no search pagination.
- Keep only failed icons selected after a partial ZIP download so retrying does not download successful icons again.

## Deploy with Docker Compose

Download `compose.yaml` from the release assets. It pins both containers to the `3.0.4` Docker image for this release. Pull and start them with:

PowerShell:

```powershell
docker compose -f .\compose.yaml pull
docker compose -f .\compose.yaml up --detach --wait
```

Linux or macOS:

```sh
docker compose -f compose.yaml pull
docker compose -f compose.yaml up --detach --wait
```
