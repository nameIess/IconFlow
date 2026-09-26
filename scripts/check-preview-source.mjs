const page = await fetch("https://macosicons.com/?icon=Ic1LCu7E7f", {
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "IconFlow/3 macOSicons importer",
  },
});
const html = await page.text();
const normalized = html.replaceAll("\\/", "/").replaceAll("\\u002F", "/");
const keys = [...normalized.matchAll(/"(icnsUrl|lowResPngUrl|pngUrl)"\s*:\s*"([^"]+)"/giu)]
  .map((m) => ({key:m[1],value:m[2]}))
  .filter((x) => x.value.includes("s3-new.macosicons.com"));
console.log(JSON.stringify(keys.slice(0,20),null,2));
if (!keys.some(x => x.key === "lowResPngUrl" || x.key === "pngUrl")) process.exit(1);
