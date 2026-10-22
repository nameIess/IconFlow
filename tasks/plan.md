# Implementation Plan: IconFlow Audit Remediation

## Overview
Close the confirmed issues from the static UI/security/release audit without broad redesign: improve light-theme text contrast and modal keyboard behavior, add focused regression coverage, tighten CI event coverage and dependency-audit behavior, review resolver abuse controls and touch target sizing, then verify the result with repeatable checks.

## Scope and Evidence
- Main implementation branch: `feature/ui-ux-ci-polish`
- Validation/CI fix branch: `fix/vercel-ci-runner`
- Project: Vercel `prj_Id5OYASDCyXhpAtAydEWDN3dtaqt`
- CI workflow: `.github/workflows/ci.yml`
- UI: `src/App.tsx`, `src/styles.css`
- Resolver: `api/resolve-icon.ts`

## Architecture Decisions
- Preserve the current React/Vite architecture and existing design tokens; fix token values and component behavior rather than introducing a new design system.
- Use the built-in Node test runner to avoid adding a new test dependency.
- Keep CI least-privilege and pin GitHub Actions to immutable commit SHAs.
- Use Vercel's build command to enforce tests, typecheck, production build, and high-severity dependency audit because GitHub Actions currently fails before runner allocation.
- Keep the resolver's Vercel Firewall limit platform-level instead of using an ineffective in-memory per-instance counter.
- Avoid claiming browser interaction checks until an authorized browser session is available.

## Task List

### Phase 1: Confirmed UI accessibility issues
- [x] Task 1: Correct light-theme secondary text contrast (4.89:1 on the light page background).
- [x] Task 2: Add modal focus entry, focus containment, and focus restoration in source.
- [x] Task 3: Increase icon-only and settings controls to at least 44px, including the mobile settings-button override.

### Checkpoint: UI
- [x] Verify the contrast ratio for the adjusted token against the light-theme page surface.
- [ ] Verify keyboard opening/closing and focus return for import, settings, and preview dialogs in a browser.
- [ ] Verify short-screen dialog scrolling and reduced-motion behavior in a browser.

### Phase 2: Regression tests and CI
- [x] Task 4: Add tests for theme contrast, dialog contract, ICNS validation, filename safety, ZIP archive structure/boundaries, import URL allow-listing/deduplication/caps, and resolver URL/redirect/MIME/size safeguards.
- [x] Task 5: Update `.github/workflows/ci.yml` for PRs to `master`, pushes to `master`/feature/fix branches, and manual dispatch, with locked install, test, typecheck, build, and enforced high-severity dependency audit.
- [x] Task 6: Verify the complete quality gate using Vercel. The READY deployment for commit `c8c72308d4f7ae257f6bdfcb90dd83d49eb3458b` completed the custom build command `npm test && npm run typecheck && npm run build && npm audit --audit-level=high`. A subsequent cleanup commit `33874864cb776b6ac31b4a9d3e66f054743dcd0e` is also READY with the same gate still active. The failing converter assertion was corrected in `tests/converter.test.mjs`.

### Checkpoint: Quality gates
- [x] Vercel quality gate (tests, typecheck, production build, high-severity dependency audit) passed for the fix branch. The gate is enforced by `vercel.json` for future Vercel deployments.
- [ ] Successful GitHub Actions run. Actions jobs still fail before runner allocation (runner ID 0, no steps or logs) even after explicitly pinning Node 24, using a fresh fix branch/PR, and retrying. This has not been traced to a source-level workflow step because no step executes.
- [x] A clean Vercel preview deployment is READY after removing the temporary diagnostics script; `verify-ci-debug.mjs` is not present on the branch.
- [x] The full dependency audit ran successfully as part of the Vercel quality gate at `npm audit --audit-level=high`.

### Phase 3: Resolver hardening and documentation
- [x] Task 7: Configure and verify the active Vercel Firewall rule for `/api/resolve-icon` (120 requests per IP per 60-second fixed window, deny mitigation).
- [x] Task 8: Document design tokens, modal interaction contract, test commands, and resolver protections in `DESIGN.md`.

### Checkpoint: Release readiness
- [x] Recheck security headers, secret handling, trusted URL checks, and ICNS/image input limits at source level.
- [ ] Run browser-level smoke tests for search, import, preview, keyboard focus, and download. The connected Vercel account denied authenticated preview bypass and sandbox creation (403), so these interactive checks remain unverified.
- [ ] Resolve GitHub Actions runner allocation at the repository/account level. The job starts and immediately fails with runner ID 0 and an empty step list; reruns show the same signature.
- [ ] Merge PR #2 only after GitHub Actions becomes operational and its required check is green. Do not bypass the outstanding check solely because the Vercel gate passes.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Focus trapping breaks nested controls or active import behavior | High | Source-level guards are in place; browser-test each dialog when preview access can be authorized. |
| In-memory rate limiting is ineffective across serverless instances | High | Vercel Firewall's shared platform-level per-IP rule is active and documented. |
| A regression test misses runtime behavior | Medium | Tests cover parsing, safety boundaries, and UI source contracts; browser checks remain explicitly open. |
| GitHub Actions runner allocation remains unavailable | High | Vercel deployment gate now independently runs tests, typecheck, production build, and dependency audit; restore GitHub Actions runner execution before merge. |
| Protected preview cannot be opened by the connected agent session | Medium | Keep browser assertions unverified; use the deployment URL in an authorized browser session for manual QA. |

## Open Questions
- [x] Which shared store or platform-level rate limiting facility is available? Vercel Firewall custom rules are available and the resolver limit is active.
- [ ] Can an authorized browser session access the preview to verify keyboard/touch/reduced-motion behavior?
- [ ] Why is GitHub Actions failing before runner assignment? Needs repository/account Actions runner/billing status review; no job steps or logs are available.
