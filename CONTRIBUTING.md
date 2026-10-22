# Contributing to IconFlow 🤝

Thank you for helping improve IconFlow! Contributions are welcome, including bug fixes, documentation improvements, accessibility enhancements, and new features.

## Getting started 🚀

### Prerequisites

- Node.js 24, matching the version used in CI
- npm

### Set up the project

```bash
git clone https://github.com/nameIess/IconFlow.git
cd IconFlow
npm ci
npm run dev
```

Create a local `.env` file from `.env.example` when environment configuration is required. Never commit API keys, tokens, or other sensitive values.

## Development workflow 🧑‍💻

1. Create a focused branch from `master`.
2. Make the smallest clear change that solves the problem.
3. Follow the existing React, TypeScript, and CSS patterns.
4. Update documentation when behavior, setup, or configuration changes.
5. Keep user-facing text and error states clear and actionable.

## Validation ✅

Run the checks relevant to your change before opening a pull request:

```bash
npm run typecheck
npm run build
```

The CI workflow also runs the dependency audit. Review any audit findings before merging dependency changes.

## Pull requests 📬

When opening a pull request:

- Explain what changed and why.
- Keep the pull request focused on one concern.
- Include screenshots or a short recording for visual changes.
- Mention any setup steps or configuration changes.
- Confirm that no secrets or private URLs were added.
- Complete the repository pull-request template.

For README or documentation updates, describe the user-facing improvement and note how you checked the rendered Markdown.

## Verified commits ✅

GitHub marks a commit as **Verified** when it is signed with a key that has been added to the committing GitHub account.

This repository can use SSH commit signing:

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

Add the matching public key from `~/.ssh/id_ed25519.pub` to GitHub under **Settings → SSH and GPG keys → New SSH key**, selecting **Signing Key** as the key type. Make sure the commit email matches an email associated with the same GitHub account.

Commits that were created without a signature do not become verified automatically. For an unpublished latest commit, sign it by amending and then verify it locally:

```bash
git commit --amend --no-edit -S
git log -1 --show-signature
```

Only force-push an amended commit when you understand the impact on other contributors. Do not rewrite shared history without coordinating with the repository maintainers.

## Security 🔐

Please do not report security vulnerabilities in a public issue. Share sensitive security details privately with the project maintainer instead.

Do not include real API keys in issues, pull requests, screenshots, logs, or example files.

## Code of conduct 🌱

Be respectful, constructive, and inclusive. Assume good intent, focus feedback on the work, and help keep the project welcoming for everyone.
