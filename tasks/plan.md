# Implementation Plan: IconFlow Docker Production Readiness

## Goal
Make the existing Docker setup reproducible, testable, secure by default, and ready for versioned releases. Preserve the two-container architecture (Nginx frontend + private Node.js resolver) unless testing demonstrates a concrete reason to change it.

## Decisions
- Keep the frontend and resolver in separate images and containers.
- Use Git tags as the release-version authority; do not infer release versions from local Docker cache state.
- Keep pull-request/branch CI separate from release publishing.
- Do not publish images until the registry, visibility, permissions, and release trigger are explicitly configured and verified.
- Do not guess base-image digests or claim runtime checks that have not run.
- Keep changes focused on Docker, GitHub Actions, release scripts, and documentation.

## Workstreams and tasks

### 1. Establish baseline and build hygiene
- [ ] Inspect current Dockerfiles, Compose topology, ignore files, workflows, and scripts.
- [ ] Verify build contexts exclude secrets, local dependencies, build outputs, and repository metadata without excluding required inputs.
- [ ] Confirm lockfile-based dependency installation and multi-stage frontend build.
- [ ] Check base-image update policy; only pin digests after verifying the correct platform digests and documenting an update path.

### 2. Runtime and Compose hardening
- [ ] Verify both services run non-root and retain read-only filesystems, dropped capabilities, no-new-privileges, resource limits, health checks, and bounded logs.
- [ ] Verify only the frontend port is published to loopback and the resolver remains private to the Compose network.
- [ ] Validate health-check tools and paths exist in the final images.
- [ ] Verify graceful startup, shutdown, and dependency health behavior.

### 3. CI build and integration validation
- [ ] Validate Compose configuration in CI.
- [ ] Build both images with updated base images (--pull) and deterministic lockfile installs.
- [ ] Start the Compose stack and wait for health checks.
- [ ] Smoke-test frontend content, health endpoint, and expected resolver API behavior.
- [ ] Emit service logs on failure and always clean up containers, networks, and test volumes.
- [ ] Keep Docker validation in the existing dedicated Docker workflow; avoid adding redundant workflows.
- [ ] Pin third-party actions to reviewed full commit SHAs and document scan severity/blocking policy.

### 4. Source-driven image versioning
- [ ] Replace local vN discovery as the release authority with an explicit validated SemVer input or Git release tag.
- [ ] Generate commit-SHA tags for traceability and stable version tags for releases.
- [ ] Apply one shared release version to both images while keeping distinct image names and digests.
- [ ] Ensure duplicate/invalid release versions fail clearly; never silently overwrite a published release.
- [ ] Keep :ci for local/CI builds and treat :latest as an optional mutable convenience tag, never the rollback source.
- [ ] Make local tagging safe and predictable without requiring a populated local image history.

### 5. Registry publishing (gated)
- [ ] Confirm target registry, image namespace, package visibility, and publishing permissions before enabling push.
- [ ] Authenticate using least-privilege GitHub Actions permissions; never put credentials in build args or image layers.
- [ ] Publish only from trusted release events, not pull requests or arbitrary feature branches.
- [ ] Build/test once, then publish the tested artifacts; avoid publishing an unverified rebuild.
- [ ] Record immutable image digests and retain a reliable rollback reference.
- [ ] Generate SBOM and provenance/attestations when supported by the selected registry and workflow.

### 6. Documentation
- [ ] Document local build, run, health, smoke-test, cleanup, tagging, and troubleshooting commands.
- [ ] Explain CI tags versus release tags, mutable :latest, SemVer release tags, and digest-based deployment.
- [ ] Document required GitHub settings/secrets only after registry choice is confirmed.
- [ ] Clearly distinguish implemented behavior from checks that require CI or a Docker-enabled host.

### 7. Verification and delivery
- [ ] Run available application tests, typecheck, and production build.
- [ ] Run Compose config validation and Docker builds where a Docker daemon is available.
- [ ] Validate workflow YAML and release-script behavior, including invalid versions and duplicate tags.
- [ ] Review changes for secrets exposure, unnecessary scope, action pinning, and destructive cleanup.
- [ ] Report passed checks, unrun checks, remaining risks, and exact branch/commit.

## Checkpoints
1. Architecture and build contexts are preserved; no publishing enabled yet.
2. Compose hardening and CI smoke tests pass.
3. Version tags are derived from a trusted source and both images stay in sync.
4. Registry publishing remains disabled until registry and access policy are verified.
5. Documentation and verification report match the actual implementation.

## Out of scope
- Combining Nginx and Node.js into one container without a concrete requirement.
- Changing application features or API behavior.
- Production deployment infrastructure beyond image publication.
- Claiming reproducibility, scan success, or runtime validation without evidence.