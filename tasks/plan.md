# Implementation Plan: IconFlow Docker Hardening

## Overview
Harden the existing two-container Docker setup and dedicated Docker workflow without changing the application architecture or adding a third workflow. All changes remain on `feature/docker-setup`.

## Decisions
- Keep the static frontend and URL resolver in separate containers.
- Keep the resolver private to the Compose network and publish only the frontend on loopback.
- Keep application quality checks in `.github/workflows/ci.yml` and container validation in `.github/workflows/docker.yml`.
- Do not guess base-image digests or claim runtime validation without evidence.

## Tasks
- [ ] 1. Remove redundant frontend type-check work and conservatively tighten build-context exclusions.
- [ ] 2. Review resolver runtime and Compose hardening; change only verified gaps.
- [ ] 3. Strengthen Docker CI build/startup/smoke-test flow while preserving failure logs and cleanup.
- [ ] 4. Add a pinned image scanner and explicit severity policy after verifying the action revision.
- [ ] 5. Update Docker documentation.
- [ ] 6. Run available tests, typecheck, build, and static checks; record Docker runtime gaps.

## Checkpoints
- After tasks 1-3: Compose topology preserved; only two workflows; Docker checks remain in `docker.yml`.
- Complete: feasible checks pass, unavailable checks are documented, only `feature/docker-setup` changes.

## Risks
- Floating tags are mutable: use pull-enabled builds now; digest pinning requires verified digests and automated updates.
- Ignore-file changes can exclude required inputs: keep exclusions conservative and verify build contexts.
- Scanner feeds can be noisy or unavailable: pin the scanner, define blocking severities, document exceptions.

## Out of scope
Image publishing, registry configuration, and production deployment are deferred until a target is specified.
