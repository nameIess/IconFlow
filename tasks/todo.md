# Docker Hardening Tasks

- [x] Task 1: Remove duplicate type-check work if the production build already runs TypeScript compilation; conservatively exclude irrelevant files from the frontend build context.
- [x] Task 2: Confirm both services remain non-root, read-only, capability-dropped, resource-limited, health-checked, and that the resolver is not host-published.
- [x] Task 3: Strengthen Docker CI with explicit build/startup steps, pull-enabled builds, smoke tests, failure logs, and cleanup.
- [x] Task 4: Add a pinned scanner only after verifying the action revision; define blocking severity policy.
- [x] Task 5: Document Docker CI and local verification commands.
- [ ] Task 6: Run app tests, typecheck, build, and static checks; use CI for runtime validation if local Docker is unavailable.

## Checkpoint after Tasks 1-3
- [ ] Existing Compose topology preserved.
- [ ] No third workflow introduced.
- [ ] Docker checks remain in `.github/workflows/docker.yml`.

## Final checkpoint
- [ ] Feasible checks pass and unavailable checks are explicitly listed.
- [ ] All changes remain on `feature/docker-setup`.
