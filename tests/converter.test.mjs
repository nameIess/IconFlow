import assert from "node:assert/strict";
import test from "node:test";
import { extractBestPng, filename, zipFiles } from "../src/converter.ts";

function makeIcns({ declaredLength, entryLength = 32, width = 128, height = 128 } = {}) {
  const bytes = new Uint8Array(40);
  bytes.set([105, 99, 110, 115], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, declaredLength ?? bytes.length);
  bytes.set([105, 99, 48, 55], 8); // ic07
  view.setUint32(12, entryLength);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 16);
  view.setUint32(32, width);
  view.setUint32(36, height);
  return bytes.buffer;
}

test("ICNS parser rejects files shorter than the container header", () => {
  assert.throws(() => extractBestPng(new ArrayBuffer(7)), /too small/);
});

test("ICNS parser rejects a mismatched declared file length", () => {
  assert.throws(() => extractBestPng(makeIcns({ declaredLength: 999 })), /declared length/);
});

test("ICNS parser rejects entries extending beyond the file", () => {
  assert.throws(() => extractBestPng(makeIcns({ entryLength: 100 })), /entry length/);
});

test("ICNS parser extracts a supported PNG representation", () => {
  const png = extractBestPng(makeIcns());
  assert.equal(png.length, 24);
  assert.deepEqual(Array.from(png.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("ICNS parser rejects unsupported PNG dimensions", () => {
  assert.throws(() => extractBestPng(makeIcns({ width: 0 })), /dimensions/);
  assert.throws(() => extractBestPng(makeIcns({ width: 2048 })), /representation not supported/);
});

test("download filenames sanitize unsafe characters and reserved device names", () => {
  assert.equal(filename('../My:Icon?.', 'ico'), '.. My Icon.ico');
  assert.equal(filename('CON', 'ico'), '_CON.ico');
  assert.equal(filename('   ', 'exe'), 'icon.png');
});

test("ZIP builder rejects an empty selection", async () => {
  await assert.rejects(zipFiles([]), /No files were selected/);
});

test("ZIP builder writes a valid local-file signature and end-of-central-directory record", async () => {
  const archive = new Uint8Array(await (await zipFiles([
    { name: "hello.txt", blob: new Blob(["hello"]) },
  ])).arrayBuffer());
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(archive.length - 22, true), 0x06054b50);
  assert.equal(new TextDecoder().decode(archive.slice(30, 39)), "hello.txt");
});
