const ALLOWED_HOST = "s3-new.macosicons.com";
const shareUrl = "https://macosicons.com/?icon=Ic1LCu7E7f";

function cleanUrl(value, base) {
  const decoded = value
    .replaceAll("&amp;", "&")
    .replaceAll("\\/", "/")
    .replaceAll("\\u002F", "/")
    .trim();
  try {
    const url = new URL(decoded, base);
    if (
      url.protocol !== "https:" ||
      url.hostname !== ALLOWED_HOST ||
      url.port ||
      url.username ||
      url.password ||
      !/\.(?:icns|png|jpe?g|webp)(?:$|[?#])/iu.test(url.pathname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function findAsset(html, base) {
  const normalized = html
    .replaceAll("\\/", "/")
    .replaceAll("\\u002F", "/")
    .replaceAll("&amp;", "&");
  const candidates = [];
  const patterns = [
    /"icnsUrl"\s*:\s*"([^"]+)"/giu,
    /(?:href|src|content|data-src)\s*=\s*["']([^"']+)["']/giu,
    /https?:\/\/[^\s"'<>\\]+/giu,
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const url = cleanUrl(match[1] ?? match[0], base);
      if (url) candidates.push(url);
    }
  }
  const unique = [...new Set(candidates)];
  return unique.find((url) => /\.icns(?:$|[?#])/iu.test(url)) ?? unique[0] ?? null;
}

const page = await fetch(shareUrl, {
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "IconFlow/3 macOSicons importer",
  },
});
const html = await page.text();
const assetUrl = findAsset(html, page.url || shareUrl);
if (!page.ok || !assetUrl) {
  console.error(JSON.stringify({ pageStatus: page.status, finalUrl: page.url, assetUrl }, null, 2));
  process.exit(1);
}

const asset = await fetch(assetUrl, { redirect: "error" });
const bytes = new Uint8Array(await asset.arrayBuffer());
const declaredLength = bytes.length >= 8
  ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4)
  : 0;
const magic = new TextDecoder().decode(bytes.slice(0, 4));

console.log(JSON.stringify({
  pageStatus: page.status,
  finalUrl: page.url,
  assetUrl,
  assetStatus: asset.status,
  assetBytes: bytes.length,
  magic,
  declaredLength,
  validIcns: asset.ok && magic === "icns" && declaredLength === bytes.length,
}, null, 2));

if (!asset.ok || magic !== "icns" || declaredLength !== bytes.length) process.exit(1);
