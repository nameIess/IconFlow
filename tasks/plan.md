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
- [ ] Task 1: Correct light-theme secondary text contrast.
- [ ] Task 2: Add modal focus entry, focus containment, and focus restoration; preserve Escape/backdrop behavior and import-in-progress restrictions.
- [ ] Task 3: Review icon/settings controls for practical touch target sizing and adjust only where needed.

### Checkpoint: UI
- [ ] Calculate contrast ratios for the adjusted token against the actual light-theme surface.
- [ ] Verify keyboard opening/closing and focus return for import, settings, and preview dialogs.
- [ ] Verify short-screen dialog scrolling and reduced-motion behavior remain intact.

### Phase 2: Regression tests and CI
- [ ] Task 4: Add focused automated tests for core converter/input validation and import/resolver edge cases using the chosen test runner.
- [ ] Task 5: Update `.github/workflows/ci.yml` so pull requests and relevant branch pushes receive checks, including this feature branch; retain manual dispatch, locked installs, typecheck/build, and high-severity dependency audit enforcement.
- [ ] Task 6: Run and fix dependency installation, tests, typecheck, production build, and dependency audit; distinguish dependency findings from registry/transient failures.

### Checkpoint: Quality gates
- [ ] CI runs for the feature branch and pull requests targeting `master`.
- [ ] Tests, typecheck, and build pass locally or in CI with captured results.
- [ ] Dependency audit outcome is explicitly reported and enforced.

### Phase 3: Resolver hardening and documentation
- [ ] Task 7: Review resolver request abuse limits and add a deployment-compatible rate limit or document/implement a reliable upstream limit; preserve host allowlists, redirect checks, timeout, and response-size caps.
- [ ] Task 8: Document the existing design tokens, modal interaction contract, test commands, and release verification steps.

### Checkpoint: Release readiness
- [ ] Review the final diff for unintended changes.
- [ ] Recheck security headers, secret handling, trusted URL checks, and ICNS/image input limits.
- [ ] Run a browser-level smoke test for search, import, preview, and download; record any checks blocked by unavailable credentials or preview access.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Focus trapping breaks nested controls or active import behavior | High | Test each dialog and keep close behavior consistent with current state guards |
| A local in-memory rate limiter is ineffective on serverless multi-instance deployments | High | Use a shared store or platform-level limit when available; state any limitation explicitly |
| Adding a test runner changes lockfile/dependency graph | Medium | Add only required dev dependencies and commit the matching lockfile |
| Dependency audit fails because of a real advisory or registry issue | Medium | Preserve the failure output; fix or document a specific exception rather than silently skipping the gate |
| Browser preview remains inaccessible | Medium | Use CI/build evidence and report browser validation as unverified instead of claiming success |

## Open Questions
- Which shared store or platform-level rate limiting facility is available to the deployed resolver? Do not assume one exists.
- Can a browser automation environment and the macOSicons API credentials be used for end-to-end checks?
