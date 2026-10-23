# Docker Production Readiness Tasks

## Baseline and build hygiene
- [x] Review Dockerfiles, Compose, ignore files, workflows, and release script on this branch.
- [x] Add/verify conservative Dockerfile-specific build-context exclusions for both images.
- [x] Confirm lockfile install and multi-stage frontend build.
- [x] Document floating version tags with --pull; defer digest pinning until correct multi-platform digests and an update path are verified.

## Runtime and Compose
- [x] Compose configuration includes non-root image defaults, read-only rootfs, dropped capabilities, no-new-privileges, limits, health checks, and bounded logs.
- [x] Resolver is not host-published; frontend binds to loopback.
- [ ] Health-check commands are configured; runtime confirmation awaits a Docker-enabled runner.
- [ ] Startup/shutdown behavior is configured; runtime confirmation awaits a Docker-enabled runner.

## CI
- [x] Compose validation is configured in Docker CI.
- [x] Both images are built with --pull in Docker CI.
- [x] Docker CI starts services and waits for health.
- [x] Docker CI includes frontend, health, and resolver API smoke tests.
- [x] Docker CI prints logs on failure and always cleans up Compose resources.
- [x] Third-party Actions are pinned to full commit SHAs.
- [x] Documented HIGH/CRITICAL blocking and ignore-unfixed scan policy; actual scan run awaits a working runner.

## Image versioning
- [x] Require explicit validated SemVer; local image history is no longer used to determine releases.
- [x] Add shared commit-SHA tags for both images.
- [x] Apply a shared version tag to both images.
- [x] Reject invalid versions and locally existing version tags; global duplicate detection requires a configured registry.
- [x] Keep :ci for builds; make :latest an explicit opt-in.
- [x] Release script now requires explicit SemVer, and PowerShell tests cover accepted/rejected version formats; execution is pending runner availability.

## Registry publishing (gated)
- [x] Set GHCR image namespace and workflow permissions; package visibility must be set in GitHub Packages.
- [x] Use job-scoped packages:write and GITHUB_TOKEN login without build args or embedded credentials.
- [x] Publish only on validated v* tag pushes after all Docker checks pass.
- [x] Push the same image IDs built, scanned, health-checked, and smoke-tested.
- [ ] Capture published image digests in workflow output/release notes.
- [ ] Add SBOM/provenance after release publishing is verified.

## Documentation
- [x] Document build, health, smoke-test, logs, cleanup, and troubleshooting commands.
- [x] Explain version tags, commit tags, mutable :latest, and digest-based rollback.
- [x] Leave registry setup/publishing disabled until target and permissions are confirmed.
- [x] Documentation and task notes identify checks requiring GitHub Actions or a Docker-enabled host.

## Final verification
- [ ] Not yet run: GitHub CI jobs failed before assigning a runner; local Node dependencies are not present in this workspace.
- [ ] Not yet run: Docker CLI/daemon is unavailable in this workspace; GitHub Docker job also failed before its first step.
- [ ] PowerShell edge-case tests are committed and wired into CI, but execution is blocked because GitHub jobs fail before steps start.
- [ ] Final review remains pending until runner validation is available.
- [x] Record passed/unrun checks and remaining risks in tasks/plan.md; runtime checks remain blocked by runner availability.