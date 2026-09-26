const url = "https://macosicons.com/?icon=Ic1LCu7E7f";
const response = await fetch(url, {
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  },
  redirect: "follow",
});
const body = await response.text();
const normalized = body.replaceAll("\\/", "/");
const icnsMatch = normalized.match(/"icnsUrl"\s*:\s*"([^"]+\.icns(?:[?#][^"]*)?)"/iu);
if (!response.ok || !icnsMatch) {
  console.error(JSON.stringify({
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get("content-type"),
    length: body.length,
    title: body.match(/<title[^>]*>([^<]+)<\/title>/iu)?.[1] || null,
    hasIcnsUrl: Boolean(icnsMatch),
  }, null, 2));
  process.exit(1);
}

const icnsUrl = icnsMatch[1];
const asset = await fetch(icnsUrl, {
  headers: { "User-Agent": "IconFlow/3 macOSicons importer" },
  redirect: "error",
});
const bytes = new Uint8Array(await asset.arrayBuffer());
const declaredLength = bytes.length >= 8
  ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4)
  : 0;
const magic = new TextDecoder().decode(bytes.slice(0, 4));

console.log(JSON.stringify({
  pageStatus: response.status,
  pageTitle: body.match(/<title[^>]*>([^<]+)<\/title>/iu)?.[1] || null,
  icnsUrl,
  assetStatus: asset.status,
  assetType: asset.headers.get("content-type"),
  assetBytes: bytes.length,
  magic,
  declaredLength,
  validIcns: magic === "icns" && declaredLength === bytes.length,
}, null, 2));

if (!asset.ok || magic !== "icns" || declaredLength !== bytes.length) process.exit(1);
