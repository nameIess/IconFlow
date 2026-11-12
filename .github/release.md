<!-- release-tag: v3.0.3 -->

## Summary

IconFlow now publishes GitHub Releases alongside successful versioned Docker releases, with release notes prepared in the repository and linked from the app.

## Changes

- Publish the versioned Docker image to GHCR and attach the Compose deployment file as a downloadable `compose.yaml` asset after the existing build, scan, and smoke-test workflow passes.
- Validate that the release notes match the version tag and contain completed summary and change sections before building.
- Mark prerelease tags as GitHub prereleases.
- Add a Releases link to the app footer and document the release preparation and tagging steps.

## Deploy with Docker Compose

Download `compose.yaml` from the release assets. It pins both containers to the `3.0.3` Docker image for this release. Pull and start them with:

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
