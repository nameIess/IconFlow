# Docker Production Readiness Tasks

## Baseline and build hygiene
- [x] Review Dockerfiles, Compose, ignore files, workflows, and release script on this branch.
- [x] Add/verify conservative Dockerfile-specific build-context exclusions for both images.
- [x] Confirm lockfile install and multi-stage frontend build.
- [ ] Decide digest-pinning/update policy from verified upstream image digests.

## Runtime and Compose
- [x] Compose configuration includes non-root image defaults, read-only rootfs, dropped capabilities, no-new-privileges, limits, health checks, and bounded logs.
- [x] Resolver is not host-published; frontend binds to loopback.
- [ ] Validate health-check commands exist in final images.
- [ ] Verify startup, shutdown, and service dependency behavior.

## CI
- [ ] Validate Compose configuration.
- [ ] Build both images with pull-enabled base images.
- [ ] Start services and wait for healthy state.
- [ ] Smoke-test frontend, health endpoint, and resolver API behavior.
- [ ] Print logs on failure and always clean up.
- [ ] Review/pin third-party Actions to verified full SHAs.
- [ ] Document and test vulnerability scan severity policy.

## Image versioning
- [x] Require explicit validated SemVer; local image history is no longer used to determine releases.
- [x] Add shared commit-SHA tags for both images.
- [x] Apply a shared version tag to both images.
- [x] Reject invalid versions and locally existing version tags; global duplicate detection requires a configured registry.
- [x] Keep :ci for builds; make :latest an explicit opt-in.
- [ ] Test local tagging independent of existing local version history.

## Registry publishing (gated)
- [ ] Confirm registry, namespace, visibility, and permissions.
- [ ] Add least-privilege authentication without embedding secrets.
- [ ] Restrict publishing to trusted release events.
- [ ] Publish only artifacts that passed validation.
- [ ] Record image digests and rollback references.
- [ ] Add SBOM and provenance where supported.

## Documentation
- [x] Document build, health, smoke-test, logs, cleanup, and troubleshooting commands.
- [x] Explain version tags, commit tags, mutable :latest, and digest-based rollback.
- [x] Leave registry setup/publishing disabled until target and permissions are confirmed.
- [ ] Mark checks requiring CI or Docker-enabled host.

## Final verification
- [ ] Run app tests, typecheck, and production build.
- [ ] Run Compose validation and Docker build if Docker is available.
- [ ] Validate workflow YAML and release-script edge cases.
- [ ] Review scope, action pinning, and cleanup safety.
- [ ] Record passed/unrun checks and remaining risks.