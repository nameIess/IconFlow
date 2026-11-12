import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeImportedHits, retrySelection } from "./result-state.ts";

test("the first import replaces search results with an imported view", () => {
  const searchHit = { appName: "Search result", objectID: "search" };
  const importedHit = { appName: "Imported icon", objectID: "imported" };

  assert.deepEqual(
    mergeImportedHits([searchHit], [importedHit], false),
    [importedHit],
  );
});

test("later imports append unique icons to the imported view", () => {
  const existing = { appName: "Existing", objectID: "existing" };
  const duplicate = { appName: "Duplicate", objectID: "existing" };
  const added = { appName: "Added", objectID: "added" };

  assert.deepEqual(
    mergeImportedHits([existing], [duplicate, added], true),
    [existing, added],
  );
});

test("retry selection keeps only failed downloads", () => {
  const selected = [{ id: "success" }, { id: "failed" }];

  assert.deepEqual(
    [...retrySelection(selected, new Set(["failed"]))],
    ["failed"],
  );
});
