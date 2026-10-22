import assert from "node:assert/strict";
import test from "node:test";
import { resolveMacosiconsShareUrl } from "../api/resolve-icon.ts";

const SHARE_URL = "https://macosicons.com/icon/example";
const ASSET_URL = "https://s3-new.macosicons.com/assets/example.icns";

function response(body, {
  status = 200,
  contentType = "text/html; charset=utf-8",
  contentLength,
  headers = {},
} = {}) {
  const responseHeaders = new Headers({ "content-type": contentType, ...headers });
  if (contentLength !== undefined) responseHeaders.set("content-length", String(contentLength));
  return new Response(body, { status, headers: responseHeaders });
}

test("resolver rejects non-HTTPS, credentialed, custom-port, and untrusted share URLs without fetching", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("fetch should not be called");
  };

  try {
    for (const url of [
      "http://macosicons.com/icon/example",
      "https://user:pass@macosicons.com/icon/example",
      "https://macosicons.com:8443/icon/example",
      "https://evil.example/icon/example",
    ]) {
      const result = await resolveMacosiconsShareUrl(url);
      assert.equal(result.status, 400, url);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolver extracts only allow-listed asset URLs from an HTML share page", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response(
    `<html><meta property="og:image" content="${ASSET_URL}"></html>`,
  );

  try {
    const result = await resolveMacosiconsShareUrl(SHARE_URL);
    assert.equal(result.status, 200);
    assert.equal(result.body.assetUrl, ASSET_URL);
    assert.equal(result.body.assetType, "icns");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolver rejects redirects to untrusted hosts without following them", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "https://evil.example/redirect" },
    });
  };

  try {
    const result = await resolveMacosiconsShareUrl(SHARE_URL);
    assert.equal(result.status, 502);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolver rejects oversized HTML responses before reading their body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response("<html></html>", {
    contentLength: 2 * 1024 * 1024 + 1,
  });

  try {
    const result = await resolveMacosiconsShareUrl(SHARE_URL);
    assert.equal(result.status, 502);
    assert.match(result.body.error, /too large/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolver rejects non-HTML responses from share URLs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response("not html", { contentType: "application/json" });

  try {
    const result = await resolveMacosiconsShareUrl(SHARE_URL);
    assert.equal(result.status, 502);
    assert.match(result.body.error, /response type/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolver reports a missing icon asset when trusted HTML contains no supported asset", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response("<html><body>no asset here</body></html>");

  try {
    const result = await resolveMacosiconsShareUrl(SHARE_URL);
    assert.equal(result.status, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
