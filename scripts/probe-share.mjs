const url = "https://macosicons.com/?icon=Ic1LCu7E7f";
const response = await fetch(url, {
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  },
  redirect: "follow",
});
const body = await response.text();
const interestingLines = body
  .split(/\r?\n/u)
  .filter((line) => /s3-new\.macosicons\.com|\.icns(?:[?#"'\s]|$)/iu.test(line))
  .slice(0, 20);

console.log(JSON.stringify({
  status: response.status,
  finalUrl: response.url,
  contentType: response.headers.get("content-type"),
  length: body.length,
  hasIcns: /\.icns(?:[?#"'\s]|$)/iu.test(body),
  hasMacosiconsAsset: body.includes("s3-new.macosicons.com"),
  title: body.match(/<title[^>]*>([^<]+)<\/title>/iu)?.[1] || null,
  interestingLines,
}, null, 2));

if (!response.ok) process.exit(1);
