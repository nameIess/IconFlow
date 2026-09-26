const ALLOWED_HOSTS = new Set(["macosicons.com", "www.macosicons.com"]);
const ASSET_HOSTS = new Set(["s3-new.macosicons.com"]);
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function isAllowedShareUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ASSET_HOSTS.has(url.hostname.toLowerCase())) return false;
    return /\.(?:icns|png|jpe?g|webp)(?:$|[?#])/i.test(url.pathname);
  } catch {
    return false;
  }
}

function cleanUrl(value: string, base: string): string | null {
  const decoded = value.replaceAll("&amp;", "&").replaceAll("\\/", "/");
  try {
    const url = new URL(decoded, base);
    return isAssetUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function findAsset(html: string, base: string): string | null {
  const candidates: string[] = [];
  const patterns = [
    /(?:href|src|content|data-src)\s*=\s*["']([^"']+)["']/gi,
    /https?:\\/\\/[^\s"'<>\\]+/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = match[1] ?? match[0];
      const url = cleanUrl(value, base);
      if (url) candidates.push(url);
    }
  }

  const unique = [...new Set(candidates)];
  return unique.find((url) => /\.icns(?:$|[?#])/i.test(url)) ?? unique[0] ?? null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const raw = typeof req.query?.url === "string" ? req.query.url : "";
  if (!isAllowedShareUrl(raw)) {
    res.status(400).json({ error: "Only macOSicons HTTPS share URLs are supported." });
    return;
  }

  try {
    const response = await fetch(raw, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      res.status(502).json({ error: `macOSicons returned HTTP ${response.status}.` });
      return;
    }

    if (contentType.startsWith("image/") && isAssetUrl(response.url)) {
      res.status(200).json({ assetUrl: response.url, assetType: contentType.split("/")[1] });
      return;
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_HTML_BYTES) {
      res.status(502).json({ error: "The macOSicons page is too large to inspect." });
      return;
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const assetUrl = findAsset(html, response.url || raw);
    if (!assetUrl) {
      res.status(404).json({ error: "The macOSicons share page did not expose a downloadable icon asset." });
      return;
    }

    res.status(200).json({
      assetUrl,
      assetType: /\.icns(?:$|[?#])/i.test(assetUrl) ? "icns" : "image",
    });
  } catch {
    res.status(502).json({ error: "Unable to resolve the macOSicons share page." });
  }
}
