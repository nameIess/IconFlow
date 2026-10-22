import assert from "node:assert/strict";
import test from "node:test";
import { resolveMacosiconsShareUrl } from "../api/resolve-icon.ts";

test("resolver rejects untrusted URLs before making an upstream request", async (t) => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("fetch should not be called for invalid URLs");
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const url of [
    "http://macosicons.com/icon/example",
    "https://evil.example/icon/example",
    "https://user:pass@macosicons.com/icon/example",
    "https://macosicons.com:8443/icon/example",
  ]) {
    const result = await resolveMacosiconsShareUrl(url);
    assert.equal(result.status, 400);
  }
  assert.equal(called, false);
});

test("resolver refuses redirects to hosts outside the allow-list", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "https://evil.example/payload" },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await resolveMacosiconsShareUrl("https://macosicons.com/icon/example");
  assert.equal(result.status, 502);
  assert.equal(calls, 1);
});

test("resolver extracts only allow-listed icon and preview assets from share HTML", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    '<meta content="https://s3-new.macosicons.com/icons/app.icns"><img src="https://s3-new.macosicons.com/icons/low_res_app.png"><img src="https://evil.example/steal.png">',
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await resolveMacosiconsShareUrl("https://macosicons.com/icon/example");
  assert.equal(result.status, 200);
  assert.equal(result.body.assetUrl, "https://s3-new.macosicons.com/icons/app.icns");
  assert.equal(result.body.assetType, "icns");
  assert.equal(result.body.previewUrl, "https://s3-new.macosicons.com/icons/low_res_app.png");
});

test("resolver rejects unexpected upstream content types", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not html", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await resolveMacosiconsShareUrl("https://macosicons.com/icon/example");
  assert.equal(result.status, 502);
  assert.match(result.body.error, /unexpected response type/);
});

test("resolver rejects pages exceeding the configured response size limit", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("too large", {
    status: 200,
    headers: {
      "content-type": "text/html",
      "content-length": String(2 * 1024 * 1024 + 1),
    },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await resolveMacosiconsShareUrl("https://macosicons.com/icon/example");
  assert.equal(result.status, 502);
  assert.match(result.body.error, /too large/);
});
