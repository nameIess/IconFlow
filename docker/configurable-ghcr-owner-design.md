# Configurable GHCR Owner Design

## Goal

Allow the Docker Compose setup to publish and consume images under a configurable
GitHub Container Registry owner instead of the hard-coded `nameiess` owner.
The default for this repository is `nameIess`.

## Design

`docker/compose.yaml` will use the Docker Compose interpolation expression
`${GHCR_OWNER:-nameIess}` for both service image names. Local users can
override the owner with the `GHCR_OWNER` environment variable, while existing
local commands continue to work without additional configuration.

The GitHub Actions Docker workflow will derive a lowercase owner from
`github.repository_owner`, expose it as `GHCR_OWNER`, and use the same resolved
image names for vulnerability scans, release tagging, and publishing. This
ensures the images built by Compose are the images subsequently tagged and
published.

The local release helper will use the same configurable owner, defaulting to
`nameIess`, so locally-created version and commit tags match the Compose
image names.

## Release flow

Documentation will show the following flow:

1. Validate the Compose configuration.
2. Build both images with `docker compose -f docker/compose.yaml build --pull`.
3. Create an annotated semantic-version Git tag such as `v1.0.0`.
4. Push the tag to GitHub.
5. Let the Docker workflow validate, scan, smoke-test, and publish the images
   to GHCR.
6. Pull a published version using `IMAGE_TAG`, avoiding `latest` for
   reproducible deployments.

## Validation

The changes will be validated by checking Compose interpolation and configuration
syntax, running the repository's Docker build or the narrowest available Docker
validation, and inspecting the resulting image names. Existing frontend and
resolver behavior will remain unchanged.
