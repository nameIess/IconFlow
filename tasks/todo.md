# IconFlow Audit Remediation Checklist

## Phase 1 — UI accessibility
- [ ] Correct light-theme secondary text contrast and record the calculated ratio.
- [ ] Implement accessible modal focus entry, Tab/Shift+Tab containment, and focus restoration for import/settings/preview.
- [ ] Check and adjust small icon/settings touch targets where practical.
- [ ] Checkpoint: keyboard, short-screen scrolling, and reduced-motion behavior remain usable.

## Phase 2 — Tests and CI
- [ ] Choose and add a minimal test runner; add regression tests for converter validation and import/resolver edge cases.
- [ ] Update `.github/workflows/ci.yml` for PRs to `master`, pushes to `master` and relevant feature branches, plus manual dispatch.
- [ ] Keep least-privilege permissions, immutable action SHAs, lockfile-based install, typecheck/build, and enforced high-severity audit.
- [ ] Run tests, typecheck, build, and dependency audit; capture actual outcomes.
- [ ] Checkpoint: confirm the branch trigger and pull-request trigger behavior from the workflow configuration and CI run results.

## Phase 3 — Resolver and docs
- [ ] Establish deployment/runtime support for rate limiting before selecting the implementation.
- [ ] Add a reliable abuse limit or document the platform-level control; retain existing URL/redirect/timeout/size protections.
- [ ] Document design tokens, modal behavior, and verification commands.
- [ ] Run browser smoke tests for search, import, preview, and downloads where access is available.
- [ ] Final diff and release-readiness review.
