# Implementation Plan: IconFlow Audit Remediation

## Overview
Close the confirmed issues from the static UI/security/release audit without broad redesign: improve light-theme text contrast and modal keyboard behavior, add focused regression coverage, tighten CI event coverage and dependency-audit behavior, review resolver abuse controls and touch target sizing, then verify the result with repeatable checks.

## Scope and Evidence
- Working branch: `feature/ui-ux-ci-polish`
- CI workflow: `.github/workflows/ci.yml`
- UI: `src/App.tsx`, `src/styles.css`
- Resolver: `api/resolve-icon.ts`
- Existing npm scripts: `typecheck`, `build`; no test script was present when inspected.
- No existing `tasks/plan.md` or `tasks/todo.md` was found on this branch, so this plan does not overwrite an incomplete plan.

## Architecture Decisions
- Preserve the current React/Vite architecture and existing design tokens; fix token values and component behavior rather than introducing a new design system.
- Add tests with the smallest test runner that fits the existing TypeScript/Vite project; keep test commands explicit in CI.
- Keep CI least-privilege and pin GitHub Actions to immutable commit SHAs, matching the repository's current convention.
- Treat resolver rate limiting as an abuse-control decision: first establish the deployment/runtime constraints and request identity available in this serverless endpoint; do not add an in-memory limiter that falsely implies cross-instance protection.
- Avoid claiming runtime, browser, accessibility, or security validation until those checks actually run.

## Task List

### Phase 1: Confirmed UI accessibility issues
- [x] Task 1: Correct light-theme secondary text contrast (4.89:1 on the light page background).
- [x] Task 2: Add modal focus entry, focus containment, and focus restoration in source; browser behavior still requires verification.
- [x] Task 3: Increase icon-only and settings controls to at least 44px, including the mobile settings-button override.

### Checkpoint: UI
- [x] Calculate contrast ratio for the adjusted token against the light-theme page surface.
- [ ] Verify keyboard opening/closing and focus return for import, settings, and preview dialogs.
- [ ] Verify short-screen dialog scrolling and reduced-motion behavior remain intact.

### Phase 2: Regression tests and CI
- [x] Task 4: Expand automated tests to cover ICNS validation, filename sanitization, ZIP archive boundaries, import URL allow-listing/deduplication/caps, and resolver rejection of unsafe URLs/redirects, MIME types, and oversized responses. Tests are authored but execution remains unverified.
- [x] Task 5: Update `.github/workflows/ci.yml` for pull requests to `master` and pushes to `master`/`feature/**`; retain manual dispatch, locked installs, typecheck/build, and enforced high-severity dependency audit.
- [ ] Task 6: Run regression tests and the dependency audit, capture results, and fix any failures. Vercel preview deployment is `READY` for current fix commit `396891ca5ef66e802847fd118f7418f54a6dad28`, confirming install and production build complete successfully in Vercel. GitHub Actions jobs still fail before receiving a runner (runner ID 0, no steps/logs), including the fresh `fix/vercel-ci-runner` branch after a direct Node 24 setup and retrying the PR job; `npm test` and `npm audit` remain unverified. The Vercel GitHub app posted a `Ready` preview for PR #2 at `https://icon-flow-git-fix-vercel-ci-runner-nameiess.vercel.app`.

### Checkpoint: Quality gates
- [ ] Successful CI runs for the feature branch and PR #2 targeting `master` (both fail before runner assignment; rerunning PR job attempt 2 still yielded zero steps).
- [x] Vercel install and production build pass for the fix branch commit (`396891ca5ef66e802847fd118f7418f54a6dad28`).
- [ ] Regression tests pass with captured results; GitHub Actions did not start any steps, so test execution remains unverified.
- [ ] Dependency audit outcome is explicitly reported and enforced; the audit step has not executed because GitHub Actions jobs never reached a runner.

### Phase 3: Resolver hardening and documentation
- [x] Task 7: Configure and verify the active Vercel Firewall rule for `/api/resolve-icon` (120 requests per IP per 60-second fixed window, deny mitigation).
- [x] Task 8: Document design tokens, modal interaction contract, test commands, and verification steps in `DESIGN.md`.

### Checkpoint: Release readiness
- [ ] Finish runtime/browser verification. Source-level review is complete. Vercel preview builds are `READY` for commits `35d5693349efe23b956e4fccb836d9fa1f3a7688` and `396891ca5ef66e802847fd118f7418f54a6dad28`; the PR integration confirms its preview is Ready too. however, the connected Vercel account denied preview access and sandbox creation (403), and the local runtime cannot resolve `github.com`, so browser smoke tests and local npm commands remain blocked. A CI adjustment to use explicit Node 24 and trigger on `fix/**` was committed as `396891ca5ef66e802847fd118f7418f54a6dad28`; it did not resolve the runner startup failure.
- [x] Recheck security headers, secret handling, trusted URL checks, and ICNS/image input limits at source level; no runtime security test has been performed.
- [ ] Run a browser-level smoke test for search, import, preview, and download; Vercel access-bypass was denied (403) and the Vercel sandbox-creation API also denied permission (403), so browser-level checks could not be run here.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Focus trapping breaks nested controls or active import behavior | High | Test each dialog and keep close behavior consistent with current state guards |
| A local in-memory rate limiter is ineffective on serverless multi-instance deployments | High | A platform-level Vercel Firewall per-IP rule is active; keep its path/threshold documented and verify it after deployment changes. |
| Adding a test runner changes lockfile/dependency graph | Medium | Add only required dev dependencies and commit the matching lockfile |
| Dependency audit fails because of a real advisory or registry issue | Medium | Preserve the failure output; fix or document a specific exception rather than silently skipping the gate |
| Browser preview remains inaccessible | Medium | Use CI/build evidence and report browser validation as unverified instead of claiming success |

## Open Questions
- [x] Which shared store or platform-level rate limiting facility is available to the deployed resolver? Vercel Firewall custom rules are available for this project and the resolver limit is active.
- Can a browser automation environment and the macOSicons API credentials be used for end-to-end checks?
