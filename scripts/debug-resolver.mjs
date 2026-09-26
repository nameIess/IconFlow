const ALLOWED_HOSTS = new Set(["macosicons.com","www.macosicons.com"]);
const ASSET_HOSTS = new Set(["s3-new.macosicons.com"]);
function isAssetUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ASSET_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return false;
    return /\.(?:icns|png|jpe?g|webp)(?:$|[?#])/i.test(url.pathname);
  } catch { return false; }
}
function cleanUrl(value, base) {
  const decoded=value.replaceAll("&amp;","&").replaceAll("\\/","/").replaceAll("\\u002F","/").trim();
  try { const url=new URL(decoded,base); return isAssetUrl(url.toString()) ? url.toString() : null; } catch { return null; }
}
const page=await fetch("https://macosicons.com/?icon=Ic1LCu7E7f",{headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"IconFlow/3 macOSicons importer"}});
const html=await page.text();
const normalized=html.replaceAll("\\/","/").replaceAll("\\u002F","/").replaceAll("&amp;","&");
const patterns=[
 {target:"icns",regex:/"icnsUrl"\s*:\s*"([^"]+)"/gi},
 {target:"preview",regex:/"lowResPngUrl"\s*:\s*"([^"]+)"/gi},
 {target:"preview",regex:/"pngUrl"\s*:\s*"([^"]+)"/gi},
 {target:"generic",regex:/(?:href|src|content|data-src)\s*=\s*["']([^"']+)["']/gi},
 {target:"generic",regex:/https?:\/\/[^\s"'<>\\]+/gi},
];
for(const pattern of patterns){let n=0; for(const match of normalized.matchAll(pattern)){const value=match[1]??match[0]; const u=cleanUrl(value,page.url); if(u){console.log(pattern.target,u);n++; if(n>5) break;}}}
