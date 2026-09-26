const url = "https://macosicons.com/?icon=Ic1LCu7E7f";
const response = await fetch(url, {
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  },
  redirect: "follow",
});
const text = await response.text();
console.log(JSON.stringify({
  status: response.status,
  finalUrl: response.url,
  contentType: response.headers.get("content-type"),
  length: text.length,
  hasIcns: /\\.icns(?:[?#"']|$)/i.test(text),
  assetUrls: [...new Set(text.match(/https?:\\/\\/[^\\s"'<>]+/g) || [])]
    .filter((value) => /(?:s3-new\\.macosicons\\.com|\\.icns(?:[?#]|$))/i.test(value))
    .slice(0, 20),
  title: text.match(/<title[^>]*>([^<]+)<\\/title>/i)?.[1] || null,
}, null, 2));
if (!response.ok) process.exit(1);
