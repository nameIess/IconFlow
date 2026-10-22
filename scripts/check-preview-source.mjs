const page = await fetch("https://macosicons.com/?icon=Ic1LCu7E7f", {
  headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "IconFlow/3 macOSicons importer" },
});
const html = await page.text();
const normalized = html.replaceAll("\\/", "/").replaceAll("\\u002F", "/").replaceAll("&amp;", "&");
const urls = [...new Set([...normalized.matchAll(/https?:\/\/[^\s"'<>\\]+/giu)].map((m)=>m[0]))]
  .filter((u)=>u.includes("s3-new.macosicons.com"))
  .filter((u)=>/\.(?:icns|png|jpe?g|webp)(?:$|[?#])/iu.test(u));
console.log(JSON.stringify(urls.slice(0,50),null,2));
if (!urls.length) process.exit(1);
