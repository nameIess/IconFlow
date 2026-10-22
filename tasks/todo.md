# IconFlow Audit Remediation Checklist

## Phase 1 — UI accessibility
- [x] Correct light-theme secondary text contrast; measured `#60697a` on `#eef1f7` at 4.89:1.
- [x] Implement dialog focus entry, Tab/Shift+Tab containment, and focus restoration for import/settings/preview in source.
- [x] Increase icon-only and settings control targets to at least 44px, including the mobile settings-button override.
- [ ] Browser-test keyboard opening/closing, focus return, short-screen scrolling, and reduced-motion behavior.

## Phase 2 — Tests and CI
- [x] Add a zero-dependency Node test command and initial regression checks for light-theme contrast, dialog focus contract, and CI event coverage.
- [x] Add converter validation, filename sanitization, ZIP boundary, import URL allow-listing/deduplication/cap tests, and resolver URL/redirect/MIME/size safeguard tests. Execution is still pending.
- [x] Update `.github/workflows/ci.yml` for PRs to `master`, pushes to `master` and `feature/**`, and manual dispatch.
- [x] Retain least-privilege permissions, immutable action SHAs, lockfile install, typecheck/build, and enforced high-severity dependency audit.
- [ ] Run tests, typecheck, and dependency audit with captured results. GitHub Actions still fails before assigning a runner (`runner_id: 0`, no steps/logs) even on fresh branch `fix/vercel-ci-runner` after setting Node 24 directly and rerunning. Vercel reports `READY` for commit `396891ca5ef66e802847fd118f7418f54a6dad28`, and the Vercel GitHub app posted a Ready preview on PR #2 (`https://icon-flow-git-fix-vercel-ci-runner-nameiess.vercel.app`), confirming Vercel deployment succeeds. `npm test` and `npm audit` remain unverified because GitHub never ran a step and this runtime cannot resolve `github.com` for a local install.
- [ ] Checkpoint: confirm successful branch and pull-request CI runs.

## Phase 3 — Resolver and docs
- [x] Configure and verify the active Vercel Firewall rule: `/api/resolve-icon`, 120 requests per IP per 60-second window, deny mitigation.
- [x] Document current resolver safeguards and the active platform-level rate limit.
- [x] Document design tokens, modal behavior, and verification commands in `DESIGN.md`.
- [ ] Run browser smoke tests for search, import, preview, and downloads where access is available. Vercel explicitly denied deployment access and sandbox creation (403); this environment also cannot clone the private repository through the standard network path or run browser automation. The preview URL currently returns 403 through the connected Vercel account.
- [ ] Final release-readiness verification. Source-level review of the touched files and key security safeguards is complete; runtime checks are blocked by GitHub Actions failing before steps, DNS resolution failure for `github.com`, and Vercel access denial.
