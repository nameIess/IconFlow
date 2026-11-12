<!-- release-tag: v3.0.3 -->

## Summary

IconFlow now publishes GitHub Releases alongside successful versioned Docker releases, with release notes prepared in the repository and linked from the app.

## Changes

- Create a GitHub Release from this file after the tagged Docker image passes the existing build, scan, and smoke-test workflow.
- Validate that the release notes match the version tag and contain completed summary and change sections before building.
- Mark prerelease tags as GitHub prereleases.
- Add a Releases link to the app footer and document the release preparation and tagging steps.
