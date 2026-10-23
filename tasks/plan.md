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
- [x] Inspect current Dockerfiles, Compose topology, ignore files, workflows, and scripts.
- [x] Add/verify Dockerfile-specific context exclusions for the frontend and resolver; secrets and local dependency/build-output paths are excluded.
- [x] Confirm the frontend uses npm ci with package-lock.json in a multi-stage build; resolver runtime uses the Node base image without installing npm dependencies.
- [x] Document the current mutable-tag + --pull update policy; digest pinning remains deferred until correct multi-platform digests and an update path are verified.

### 2. Runtime and Compose hardening
- [x] Compose config retains the non-root images, read-only filesystems, dropped capabilities, no-new-privileges, limits, health checks, and bounded logs.
- [x] Compose publishes only the frontend on 127.0.0.1:8080; resolver is internal to the Compose network.
- [ ] Validate health-check tools and paths exist in the final images.
- [ ] Verify graceful startup, shutdown, and dependency health behavior.

### 3. CI build and integration validation
- [x] Docker workflow validates Compose configuration before building.
- [x] Docker workflow builds both images with --pull; frontend uses npm ci with the committed lockfile.
- [x] Docker workflow starts the stack with --wait and a bounded timeout.
- [x] Docker workflow smoke-tests frontend content, healthz, and an invalid resolver URL response.
- [x] Docker workflow emits logs on failure and always runs Compose down with volume/orphan cleanup.
- [x] Kept container validation in the existing dedicated Docker workflow.
- [x] Third-party Actions use full commit SHAs; the HIGH/CRITICAL blocking policy and ignored-unfixed behavior are documented.

### 4. Source-driven image versioning
- [x] Release script requires an explicit Docker-compatible SemVer version and no longer infers it from local Docker history.
- [x] Release script creates commit-SHA tags and stable version tags for both images.
- [x] Release script applies one explicit version to both image names while preserving separate images.
- [x] Release script validates version syntax and refuses to overwrite existing local version tags; global duplicate checks are reserved for future registry publishing.
- [x] Compose keeps :ci; :latest is opt-in via -UpdateLatest and documented as mutable.
- [x] Explicit versions remove dependence on local image history; old tags are never automatically deleted.

### 5. Registry publishing (gated)
- [ ] Confirm target registry, image namespace, package visibility, and publishing permissions before enabling push.
- [ ] Authenticate using least-privilege GitHub Actions permissions; never put credentials in build args or image layers.
- [ ] Publish only from trusted release events, not pull requests or arbitrary feature branches.
- [ ] Build/test once, then publish the tested artifacts; avoid publishing an unverified rebuild.
- [ ] Record immutable image digests and retain a reliable rollback reference.
- [ ] Generate SBOM and provenance/attestations when supported by the selected registry and workflow.

### 6. Documentation
- [x] Documented local build, health, smoke-test, logs, cleanup, tagging, and troubleshooting commands.
- [x] Documented SemVer/commit tags, mutable :latest, and digest-based deployment/rollback.
- [x] No registry secrets or publishing settings added while registry choice remains unconfirmed.
- [x] Documentation distinguishes implemented local behavior from registry publishing, which remains disabled.

### 7. Verification and delivery
- [ ] Run available application tests, typecheck, and production build.
- [ ] Run Compose config validation and Docker builds where a Docker daemon is available.
- [ ] Release-version test script is wired into CI; final verification remains pending because GitHub jobs fail before any step starts.
- [ ] Final security/scope review pending; GitHub Actions jobs have not reached a runner.
- [x] Record passed/unrun checks, known risks, and current branch/commit in the verification status above.

## Verification status (2026-10-23)

- Repository files and workflow definitions were reviewed through the GitHub repository connection.
- The release-version regex cases were checked independently: valid versions `3.1.0`, `v3.1.0`, `3.1.0-rc.1`, and `0.0.0` match; invalid/unsupported inputs including empty, `01.2.3`, `1.2.3+build`, `1.2.3-01`, and malformed prerelease strings do not. The PowerShell test script is committed and wired into CI, but it has not executed.
- GitHub Actions runs for the branch fail before any workflow step starts; the reported jobs have no steps and no runner assigned. Latest inspected run links: [CI](https://github.com/nameIess/IconFlow/actions/runs/39928394513) and [Docker](https://github.com/nameIess/IconFlow/actions/runs/39928394495).
- This workspace has no checkout of the application repository, Docker CLI/daemon, or PowerShell runtime. Therefore application tests, typecheck, production build, Compose validation, image builds, vulnerability scans, and runtime smoke tests remain unverified.
- Registry publishing remains disabled because the target registry, namespace, package visibility, and publishing permissions have not been confirmed.
- Base-image digests remain unpinned intentionally. The current versioned tags are refreshed with `--pull`; digest pinning awaits verified multi-platform digests and a documented update process.

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