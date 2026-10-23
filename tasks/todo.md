# Docker Production Readiness Tasks

## Baseline and build hygiene
- [ ] Review Dockerfiles, Compose, ignore files, workflows, and release script on this branch.
- [ ] Verify conservative build-context exclusions and absence of secrets from build contexts.
- [ ] Verify lockfile-based installs and multi-stage frontend build.
- [ ] Decide digest-pinning/update policy from verified upstream image digests.

## Runtime and Compose
- [ ] Verify non-root runtime, read-only filesystem, dropped capabilities, no-new-privileges, limits, health checks, and bounded logs.
- [ ] Verify resolver is not host-published and frontend binds to loopback for local Compose.
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
- [ ] Use validated Git release tags or explicit SemVer as the release source of truth.
- [ ] Add commit-SHA tags for traceability.
- [ ] Apply a shared release version to web and resolver images.
- [ ] Reject invalid or duplicate release versions.
- [ ] Keep :ci for builds; treat :latest as mutable convenience only.
- [ ] Test local tagging independent of existing local version history.

## Registry publishing (gated)
- [ ] Confirm registry, namespace, visibility, and permissions.
- [ ] Add least-privilege authentication without embedding secrets.
- [ ] Restrict publishing to trusted release events.
- [ ] Publish only artifacts that passed validation.
- [ ] Record image digests and rollback references.
- [ ] Add SBOM and provenance where supported.

## Documentation
- [ ] Document local build/run/health/test/cleanup commands.
- [ ] Explain release versions, commit tags, :latest, and digest pinning.
- [ ] Document registry setup only after target selection.
- [ ] Mark checks requiring CI or Docker-enabled host.

## Final verification
- [ ] Run app tests, typecheck, and production build.
- [ ] Run Compose validation and Docker build if Docker is available.
- [ ] Validate workflow YAML and release-script edge cases.
- [ ] Review scope, action pinning, and cleanup safety.
- [ ] Record passed/unrun checks and remaining risks.