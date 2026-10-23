import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createResolverServer } from "./server.mjs";

let server;
let origin;

before(async () => {
  server = createResolverServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("health endpoint responds successfully without a body", async () => {
  const response = await fetch(`${origin}/healthz`);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("unknown routes return 404", async () => {
  const response = await fetch(`${origin}/unknown`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found." });
});

test("resolver rejects non-GET methods", async () => {
  const response = await fetch(`${origin}/api/resolve-icon?url=https%3A%2F%2Fmacosicons.com%2Fshare%2Fexample`, { method: "POST" });
  assert.equal(response.status, 405);
});

test("resolver rejects URLs outside the allow-list without fetching them", async () => {
  const response = await fetch(`${origin}/api/resolve-icon?url=${encodeURIComponent("https://example.com/")}`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Only macOSicons HTTPS share URLs are supported." });
});

test("oversized request targets are rejected", async () => {
  const response = await fetch(`${origin}/api/resolve-icon?url=${"a".repeat(9000)}`);
  assert.equal(response.status, 414);
});
