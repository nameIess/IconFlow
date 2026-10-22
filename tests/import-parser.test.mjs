import assert from "node:assert/strict";
import test from "node:test";
import { parseIconImportText, parseImportUrl } from "../src/import-parser.ts";

test("import parser accepts supported macOSicons share URLs and trusted asset formats", () => {
  const result = parseIconImportText([
    "https://macosicons.com/icon/example",
    "https://s3-new.macosicons.com/assets/icon.icns",
    "https://s3-new.macosicons.com/assets/preview.webp",
  ].join("\n"));

  assert.equal(result.urls.length, 3);
  assert.equal(result.invalidCount, 0);
  assert.ok(result.urls.some((url) => url.includes("macosicons.com/icon/example")));
  assert.ok(result.urls.some((url) => url.endsWith("/assets/icon.icns")));
});

test("import parser rejects HTTP, credentialed, custom-port, and untrusted URLs", () => {
  assert.equal(parseImportUrl("http://macosicons.com/icon/example"), null);
  assert.equal(parseImportUrl("https://user:pass@macosicons.com/icon/example"), null);
  assert.equal(parseImportUrl("https://macosicons.com:8443/icon/example"), null);

  const result = parseIconImportText([
    "http://macosicons.com/icon/example",
    "https://evil.example/icon.icns",
    "https://s3-new.macosicons.com/assets/readme.txt",
  ].join("\n"));
  assert.deepEqual(result.urls, []);
  assert.equal(result.invalidCount, 3);
});

test("import parser removes trailing punctuation and deduplicates normalized URLs", () => {
  const result = parseIconImportText([
    "https://macosicons.com/icon/example,",
    "https://macosicons.com/icon/example",
  ].join("\n"));

  assert.equal(result.urls.length, 1);
  assert.equal(result.invalidCount, 0);
});

test("import parser caps accepted URLs at 100", () => {
  const input = Array.from({ length: 120 }, (_, index) =>
    "https://macosicons.com/icon/" + index
  ).join("\n");

  assert.equal(parseIconImportText(input).urls.length, 100);
});
