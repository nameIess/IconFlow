# IconFlow Audit Remediation Checklist

## Phase 1 — UI accessibility
- [x] Correct light-theme secondary text contrast; measured `#60697a` on `#eef1f7` at 4.89:1.
- [x] Implement dialog focus entry, Tab/Shift+Tab containment, and focus restoration for import/settings/preview in source.
- [x] Increase icon-only and settings control targets to at least 44px.
- [ ] Browser-test keyboard opening/closing, focus return, short-screen scrolling, and reduced-motion behavior.

## Phase 2 — Tests and CI
- [x] Add a zero-dependency Node test command and initial regression checks for light-theme contrast, dialog focus contract, and CI event coverage.
- [ ] Add deeper converter validation and import/resolver edge-case tests; current tests do not cover those workflows yet.
- [x] Update `.github/workflows/ci.yml` for PRs to `master`, pushes to `master` and `feature/**`, and manual dispatch.
- [x] Retain least-privilege permissions, immutable action SHAs, lockfile install, typecheck/build, and enforced high-severity dependency audit.
- [ ] Run tests, typecheck, build, and dependency audit and capture successful results. The first observed Actions runs failed before any job steps were reported; no step logs were available, so the build/test outcome is not yet verified.
- [ ] Checkpoint: confirm successful branch and pull-request CI runs.

## Phase 3 — Resolver and docs
- [ ] Establish deployment/runtime support for a shared rate limiter before choosing an implementation. No reliable shared-store/platform configuration has been confirmed; do not mistake an in-memory limiter for production protection.
- [x] Document current resolver safeguards and the remaining rate-limit gap.
- [x] Document design tokens, modal behavior, and verification commands in `DESIGN.md`.
- [ ] Run browser smoke tests for search, import, preview, and downloads where access is available.
- [ ] Final diff and release-readiness review.
