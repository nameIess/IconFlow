# IconFlow Audit Remediation Checklist

## Phase 1 — UI accessibility
- [x] Correct light-theme secondary text contrast; measured `#60697a` on `#eef1f7` at 4.89:1.
- [x] Implement dialog focus entry, Tab/Shift+Tab containment, and focus restoration for import/settings/preview in source.
- [x] Increase icon-only and settings control targets to at least 44px, including the mobile settings-button override.
- [ ] Browser-test keyboard opening/closing, focus return, short-screen scrolling, and reduced-motion behavior. Vercel's connected session is blocked from opening the protected preview (403).

## Phase 2 — Tests and CI
- [x] Add a zero-dependency Node test command and regression checks for theme contrast, dialog focus contract, and CI event coverage.
- [x] Add converter validation, filename sanitization, ZIP boundary, import URL allow-listing/deduplication/cap tests, and resolver URL/redirect/MIME/size safeguard tests.
- [x] Fix the converter regression test to expect the actual generic unsupported-representation error when malformed PNG dimensions are intentionally skipped.
- [x] Vercel quality gate verified READY for commit `c8c72308d4f7ae257f6bdfcb90dd83d49eb3458b`; Vercel ran `npm test && npm run typecheck && npm run build && npm audit --audit-level=high` successfully.
- [x] Add the short permanent quality-gate command to `vercel.json` and preserve all existing security headers.
- [x] Remove the temporary diagnostic test runner; the latest cleanup commit `33874864cb776b6ac31b4a9d3e66f054743dcd0e` is also READY under the same gate.
- [x] Update GitHub Actions to pin Node 24 directly, run tests/typecheck/build/audit, and trigger on PRs to `master`, pushes to `master`, `feature/**`, and `fix/**`.
- [ ] Recover GitHub Actions execution: repeated runs on the feature branch and PR #2 fail before runner allocation (`runner_id: 0`, empty steps/no logs) even after a retry. This is not an application test failure and no source-level step runs.
- [ ] Confirm successful GitHub Actions run and branch/PR check status before merging PR #2.

## Phase 3 — Resolver and docs
- [x] Configure and verify the active Vercel Firewall rule: `/api/resolve-icon`, 120 requests per IP per 60-second window, deny mitigation.
- [x] Document current resolver safeguards and the active platform-level rate limit.
- [x] Document design tokens, modal behavior, and verification commands in `DESIGN.md`.

## Phase 4 — Remaining release verification
- [ ] Run browser smoke tests for search, import, preview, keyboard focus, and downloads using an authorized browser session. The connector cannot bypass preview protection or create a Vercel sandbox (403).
- [ ] Resolve GitHub Actions runner allocation at repository/account level; the current job has no assigned runner and no execution logs.
- [ ] Merge PR #2 only after the GitHub Actions check is green; Vercel's deployment gate passes, but do not bypass the GitHub check.
