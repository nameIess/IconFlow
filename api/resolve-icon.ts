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

function findAssets(html: string, base: string): { icnsUrl: string | null; previewUrl: string | null } {
  const normalized = html
    .replaceAll("\\/","/")
    .replaceAll("\\u002F","/")
    .replaceAll("&amp;","&");

  const icnsCandidates: string[] = [];
  const previewCandidates: string[] = [];

  // The share page embeds the downloadable assets in its Nuxt payload.
  // Extract only the trusted macOSicons CDN host so unrelated page images
  // can never become an imported asset.
  const assetPattern = /https:\/\/s3-new\.macosicons\.com\/[^\s"'<>\\]+/gi;
  for (const match of normalized.matchAll(assetPattern)) {
    const url = cleanUrl(match[0], base);
    if (!url) continue;

    if (/\.icns(?:$|[?#])/i.test(url)) {
      icnsCandidates.push(url);
    } else if (/\.(?:png|jpe?g|webp)(?:$|[?#])/i.test(url)) {
      previewCandidates.push(url);
    }
  }

  // Prefer the dedicated low-res PNG that macOSicons uses for its page
  // preview. Fall back to any trusted image only if it is present.
  const uniqueIcns = [...new Set(icnsCandidates)];
  const uniquePreview = [...new Set(previewCandidates)];
  const lowResPreview = uniquePreview.find((url) => /\/low_res_[^/]+\.(?:png|jpe?g|webp)(?:$|[?#])/i.test(url));

  return {
    icnsUrl: uniqueIcns.find((url) => /\.icns(?:$|[?#])/i.test(url)) ?? null,
    previewUrl: lowResPreview ?? uniquePreview[0] ?? null,
  };
}

type ResolveResult = {
  status: number;
  body: { assetUrl?: string; assetType?: string; previewUrl?: string; error?: string };
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
    const assets = findAssets(html, response.url || raw);
    if (!assets.icnsUrl && !assets.previewUrl) {
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
        assetUrl: assets.icnsUrl ?? assets.previewUrl ?? undefined,
        assetType: assets.icnsUrl ? "icns" : "image",
        previewUrl: assets.previewUrl ?? undefined,
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
