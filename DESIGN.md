# IconFlow Design and Interaction System

## Color tokens

The application uses semantic CSS custom properties in `src/styles.css`; components should use these tokens instead of hard-coded surface and text colors.

| Token | Dark theme | Light theme | Purpose |
|---|---|---|---|
| `--bg` | `#080a0f` | `#eef1f7` | Page background |
| `--panel` | translucent charcoal | translucent white | Glass panels |
| `--text` | `#f5f7fb` | `#12151d` | Primary text |
| `--muted` | `#9ba2b2` | `#60697a` | Secondary text |
| `--muted-2` | `#737b8d` | `#60697a` | Metadata and tertiary text |
| `--accent` | `#8ab4ff` | `#326fe8` | Focus, links, and highlights |
| `--danger` | `#ff7676` | inherited token | Destructive actions |

The light-theme `--muted-2` value is `#60697a` on `#eef1f7`, giving approximately **4.89:1** contrast using the WCAG relative-luminance formula. The automated test in `tests/design-system.test.mjs` guards the 4.5:1 normal-text threshold.

## Controls and accessibility

- Keyboard focus uses a visible 2px `--accent` outline with a 3px offset.
- Icon-only buttons and the settings control have a minimum 44px control size.
- Custom import, settings, and preview dialogs use `role="dialog"`, `aria-modal="true"`, and labelled headings.
- Dialog opening moves focus into the active dialog. Tab and Shift+Tab stay within it; closing restores focus to the element that opened it when one exists.
- Escape closes the active dialog, except while an import is running. Import close controls remain disabled during active import.
- Respect `prefers-reduced-motion`; do not add motion that overrides the existing reduced-motion rules.
- Keep dialogs scrollable within short viewports and retain visible focus styles for keyboard users.

## Verification

The Vercel project build command enforces all quality gates before a deployment can become READY:

```sh
npm test
npm run typecheck
npm run build
npm audit --audit-level=high
```

The chain currently configured in `vercel.json` is `npm test && npm run typecheck && npm run build && npm audit --audit-level=high`. A deployment for commit `c8c72308d4f7ae257f6bdfcb90dd83d49eb3458b` completed READY with this complete command, and the follow-up cleanup deployment for commit `33874864cb776b6ac31b4a9d3e66f054743dcd0e` is also READY. The converter regression test was corrected after the Vercel gate isolated its mismatched expected error text.

GitHub Actions is configured to run the same test/typecheck/build/audit checks on PRs to `master`, pushes to `master`, `feature/**`, and `fix/**`, and manual dispatches. However, recent GitHub Actions jobs consistently fail before runner assignment (`runner_id: 0`, no steps or logs), even on a new branch and retry. Vercel deployment validation works as an independent gate; GitHub Actions still needs its runner allocation restored before the pull request should be merged. Do not treat the CI runner issue as a passing check.

## Resolver abuse protection note

`api/resolve-icon.ts` validates allowed share and asset hosts, validates redirect destinations, applies an upstream timeout, and caps HTML response size. Vercel Firewall has an active custom rule, **Limit icon resolver requests**, matching `/api/resolve-icon` and applying a per-IP fixed-window limit of 120 requests per 60 seconds with deny mitigation. This is a platform-level control shared across function instances; it avoids relying on in-memory per-instance counters.
