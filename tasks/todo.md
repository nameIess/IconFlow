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
- [x] Use :latest as the Compose default; CI explicitly sets IMAGE_TAG=ci and deployments can pin IMAGE_TAG=1.0.0.
- [x] Release script requires explicit SemVer; Node.js CI tests cover accepted/rejected versions cross-platform. PowerShell tests remain available for local Windows use.

## Registry publishing (gated)
- [x] Set GHCR image namespace and workflow permissions; package visibility must be set in GitHub Packages.
- [x] Use job-scoped packages:write and GITHUB_TOKEN login without build args or embedded credentials.
- [x] Publish only on validated v* tag pushes after all Docker checks pass.
- [x] Push the same image IDs built, scanned, health-checked, and smoke-tested.
- [x] Write pushed version tags and repository digests to the GitHub Actions step summary.
- [ ] SBOM and provenance/attestations remain follow-up production hardening.

## Documentation
- [x] Document build, health, smoke-test, logs, cleanup, and troubleshooting commands.
- [x] Explain version tags, commit tags, mutable :latest, and digest-based rollback.
- [x] Configure GHCR release publishing on validated v* tags; package visibility must be configured in GitHub Packages.
- [x] Documentation and task notes identify checks requiring GitHub Actions or a Docker-enabled host.

## Final verification
- [ ] GitHub-hosted CI runs have failed before assigning a runner (runner_id=0, steps=[]); updated workflow runs are queued and must be inspected after GitHub assigns runners.
- [x] User-provided Windows act log confirms Compose config and both image builds succeeded; smoke tests and vulnerability scans did not complete because Trivy setup lacked token. The hosted runner remains unverified.
- [x] Cross-platform Node.js edge-case tests are wired into CI and passed locally in this workspace; hosted CI has not reached runner steps.
- [ ] Final review remains pending until runner validation is available.
- [x] Record passed/unrun checks and remaining risks in tasks/plan.md; runtime checks remain blocked by runner availability.