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
- [ ] Task 6: Run and fix dependency installation, tests, typecheck, production build, and dependency audit; distinguish dependency findings from registry/transient failures. GitHub Actions jobs currently fail before receiving a runner (runner ID 0, no steps/logs). Vercel also reports `npm run build` exited with code 1, but its build-log endpoint is returning 404 through the connected integration; the exact compiler error remains unknown.

### Checkpoint: Quality gates
- [ ] Successful CI runs for the feature branch and pull requests targeting `master` (latest feature-branch run failed before any steps were reported).
- [ ] Tests, typecheck, and build pass locally or in CI with captured results. Latest Actions run failed before steps were reported (steps are null; no logs are available), so these checks remain unverified.
- [ ] Dependency audit outcome is explicitly reported and enforced; the audit step has not executed in the observed failed Actions runs.

### Phase 3: Resolver hardening and documentation
- [ ] Task 7: Configure a reliable shared or platform-level resolver rate limit once the deployment-supported mechanism is confirmed; `DESIGN.md` documents the remaining gap and current safeguards.
- [x] Task 8: Document design tokens, modal interaction contract, test commands, and verification steps in `DESIGN.md`.

### Checkpoint: Release readiness
- [ ] Finish runtime/browser verification. Source-level review of the touched workflow, resolver, converter, import parser, dialog focus code, styles, and test files was completed. A local clone was attempted but the environment could not resolve `github.com`, preventing local commands. Preview access was denied by Vercel; repository clone/install is also blocked here because the runtime cannot resolve github.com.
- [x] Recheck security headers, secret handling, trusted URL checks, and ICNS/image input limits at source level; no runtime security test has been performed.
- [ ] Run a browser-level smoke test for search, import, preview, and download; Vercel access-bypass was explicitly denied (403) for this deployment, and no browser automation is available in this execution environment.

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
