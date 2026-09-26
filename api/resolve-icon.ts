const ALLOWED_HOSTS = new Set(["macosicons.com", "www.macosicons.com"]);
const ASSET_HOSTS = new Set(["s3-new.macosicons.com"]);
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function isAllowedShareUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ALLOWED_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function isAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !ASSET_HOSTS.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return false;
    }
    return /\.(?:icns|png|jpe?g|webp)(?:$|[?#])/i.test(url.pathname);
  } catch {
    return false;
  }
}

function cleanUrl(value: string, base: string): string | null {
  const decoded = value
    .replaceAll("&amp;", "&")
    .replaceAll("\\/", "/")
    .replaceAll("\\u002F", "/")
    .trim();

  try {
    const url = new URL(decoded, base);
    return isAssetUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function findAsset(html: string, base: string): string | null {
  // Nuxt serializes the icon record as JSON inside __NUXT_DATA__ and escapes
  // slashes as "\/". Normalize those escapes before looking for asset URLs.
  const normalized = html
    .replaceAll("\\/", "/")
    .replaceAll("\\u002F", "/")
    .replaceAll("&amp;", "&");

  const candidates: string[] = [];
  const patterns = [
    /"icnsUrl"\s*:\s*"([^"]+)"/gi,
    /(?:href|src|content|data-src)\s*=\s*["']([^"']+)["']/gi,
    /https?:\/\/[^\s"'<>\\]+/gi,
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const value = match[1] ?? match[0];
      const url = cleanUrl(value, base);
      if (url) candidates.push(url);
    }
  }

  const unique = [...new Set(candidates)];
  return unique.find((url) => /\.icns(?:$|[?#])/i.test(url)) ?? unique[0] ?? null;
}

type ResolveResult = {
  status: number;
  body: { assetUrl?: string; assetType?: string; error?: string };
};

export async function resolveMacosiconsShareUrl(raw: string): Promise<ResolveResult> {
  if (!isAllowedShareUrl(raw)) {
    return {
      status: 400,
      body: { error: "Only macOSicons HTTPS share URLs are supported." },
    };
  }

  try {
    const response = await fetch(raw, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "IconFlow/3 macOSicons importer",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      return {
        status: 502,
        body: { error: `macOSicons returned HTTP ${response.status}.` },
      };
    }

    if (contentType.startsWith("image/") && isAssetUrl(response.url)) {
      return {
        status: 200,
        body: {
          assetUrl: response.url,
          assetType: contentType.split("/")[1],
        },
      };
    }

    // Never accept an HTML response after a redirect to an unrelated host.
    if (!isAllowedShareUrl(response.url || raw)) {
      return {
        status: 502,
        body: { error: "macOSicons redirected to an untrusted host." },
      };
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_HTML_BYTES) {
      return {
        status: 502,
        body: { error: "The macOSicons page is too large to inspect." },
      };
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const assetUrl = findAsset(html, response.url || raw);
    if (!assetUrl) {
      return {
        status: 404,
        body: {
          error: "The macOSicons share page did not expose a downloadable icon asset.",
        },
      };
    }

    return {
      status: 200,
      body: {
        assetUrl,
        assetType: /\.icns(?:$|[?#])/i.test(assetUrl) ? "icns" : "image",
      },
    };
  } catch {
    return {
      status: 502,
      body: { error: "Unable to resolve the macOSicons share page." },
    };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const raw = typeof req.query?.url === "string" ? req.query.url : "";
  const result = await resolveMacosiconsShareUrl(raw);
  res.status(result.status).json(result.body);
}
