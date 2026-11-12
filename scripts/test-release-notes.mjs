import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateReleaseNotes } from "./validate-release-notes.mjs";

const releaseTemplate = readFileSync(
  new URL("../.github/release.md", import.meta.url),
  "utf8",
);

function notesFor(tag) {
  return `<!-- release-tag: ${tag} -->

## Summary
Improves the release workflow and makes updates easier to follow.

## Changes
- Adds a GitHub Release for each validated version tag.
`;
}

test("release notes accept a matching stable tag and completed sections", () => {
  assert.deepEqual(validateReleaseNotes("v3.0.3", notesFor("v3.0.3")), []);
});

test("release notes accept a matching prerelease tag", () => {
  assert.deepEqual(
    validateReleaseNotes("v3.1.0-rc.1", notesFor("v3.1.0-rc.1")),
    [],
  );
});

test("release notes reject a marker that does not match the tag", () => {
  const errors = validateReleaseNotes("v3.0.3", notesFor("v3.0.2"));
  assert.ok(errors.some((error) => error.includes("first line")));
});

test("release notes reject unresolved placeholders", () => {
  const errors = validateReleaseNotes(
    "v3.0.3",
    notesFor("v3.0.3").replace("Improves", "TODO: improves"),
  );
  assert.ok(errors.some((error) => error.includes("placeholders")));
});

test("release notes require summary text and at least one change bullet", () => {
  const emptySections = `<!-- release-tag: v3.0.3 -->

## Summary

## Changes
`;
  const errors = validateReleaseNotes("v3.0.3", emptySections);
  assert.ok(errors.some((error) => error.includes("summary")));
  assert.ok(errors.some((error) => error.includes("user-visible change")));
});

test("release notes reject invalid version tags", () => {
  assert.ok(validateReleaseNotes("v03.0.3", notesFor("v03.0.3")).length > 0);
});

test("the checked-in template cannot be published without developer updates", () => {
  const errors = validateReleaseNotes("v3.0.3", releaseTemplate);
  assert.ok(errors.some((error) => error.includes("first line")));
  assert.ok(errors.some((error) => error.includes("placeholders")));
});
