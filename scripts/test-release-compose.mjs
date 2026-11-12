import assert from "node:assert/strict";
import { test } from "node:test";
import { createReleaseCompose } from "./create-release-compose.mjs";

const template = [
  "services:",
  "  web:",
  '    image: ghcr.io/nameiess/iconflow:${IMAGE_TAG:-latest}',
  "  resolver:",
  '    image: ghcr.io/nameiess/iconflow:${IMAGE_TAG:-latest}',
].join("\n");
const firstImageRef =
  "image: ghcr.io/nameiess/iconflow:" + "$" + "{IMAGE_TAG:-latest}";

test("release Compose pins both services to the release version", () => {
  const compose = createReleaseCompose("v3.0.3", template, "3.0.3");

  assert.equal(compose.split("ghcr.io/nameiess/iconflow:3.0.3").length - 1, 2);
  assert.equal(compose.includes("${IMAGE_TAG:-"), false);
  assert.equal(compose.includes("${IMAGE_TAG:-latest}"), false);
});

test("release Compose rejects a tag that differs from package.json", () => {
  assert.throws(
    () => createReleaseCompose("v3.0.4", template, "3.0.3"),
    /does not match package.json version/,
  );
});

test("release Compose rejects malformed tags and changed image defaults", () => {
  assert.throws(
    () => createReleaseCompose("v03.0.3", template, "03.0.3"),
    /Invalid release tag/,
  );
  assert.throws(
    () =>
      createReleaseCompose(
        "v3.0.3",
        template.replace(firstImageRef, "image: ghcr.io/nameiess/iconflow:latest"),
        "3.0.3",
      ),
    /Expected exactly two/,
  );
});
