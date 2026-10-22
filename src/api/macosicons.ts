const SEARCH_ENDPOINT = "https://api.macosicons.com/api/v1/search";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 15000;

export interface SearchHit {
  appName?: string;
  usersName?: string;
  downloads?: number;
  icnsUrl?: string;
  objectID?: string;
  [key: string]: unknown;
}

export interface SearchPayload {
  hits: SearchHit[];
  totalHits?: number;
  query?: string;
  limit?: number;
  offset?: number;
  page?: number;
  totalPages?: number;
}

export async function searchIcons(params: {
  query: string;
  limit: number;
  page?: number;
  apiKey: string;
}): Promise<SearchPayload> {
  const { query, limit, page = 1, apiKey } = params;
  const offset = (Math.max(1, Math.floor(Number(page) || 1)) - 1) * limit;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(SEARCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query, limit, offset }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Search failed (${response.status}): ${await response.text()}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Unexpected API response type: ${contentType}`);
  }
  const data = (await response.json()) as SearchPayload;
  if (!Array.isArray(data.hits)) {
    throw new Error("Invalid API response: missing hits array");
  }
  if (data.hits.length > limit) {
    data.hits = data.hits.slice(0, limit);
  }
  return data;
}

export async function resolveIconById(params: {
  iconId: string;
  apiKey: string;
}): Promise<SearchHit | null> {
  const { iconId, apiKey } = params;
  try {
    const payload = await searchIcons({
      query: iconId,
      limit: 50,
      page: 1,
      apiKey,
    });

    const hits = payload.hits ?? [];
    const exact = hits.find((hit) => hit.objectID === iconId);
    if (exact) return exact;

    const urlMatch = hits.find(
      (hit) => typeof hit.icnsUrl === "string" && hit.icnsUrl.includes(iconId)
    );
    if (urlMatch) return urlMatch;

    if (hits.length > 0) {
      const first = hits[0];
      if (first.icnsUrl) return first;
    }
  } catch {
    // Fallback to HTML parsing below.
  }

  const pageUrl = `https://macosicons.com/?icon=${encodeURIComponent(iconId)}`;
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "macicon-fetcher/2.0.0",
    },
  });
  if (!response.ok) return null;

  const html = await response.text();
  const icnsUrlMatch = html.match(/https?:\/\/[^"'\s<>]+\.icns/gi);
  const icnsUrl = icnsUrlMatch?.[0];
  if (!icnsUrl) return null;

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const titleText = titleMatch?.[1]?.trim() ?? "";
  const appName = titleText.split("|")[0]?.trim() || `icon-${iconId}`;

  return {
    objectID: iconId,
    appName,
    icnsUrl,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function downloadWithRetry(params: {
  url: string;
  outPath: string;
  retries?: number;
  verbose?: boolean;
}): Promise<void> {
  const { url, outPath, retries = MAX_RETRIES, verbose = false } = params;
  const fs = await import("fs");
  const path = await import("path");
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const dlController = new AbortController();
      const dlTimer = setTimeout(() => dlController.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, { signal: dlController.signal });
      } finally {
        clearTimeout(dlTimer);
      }
      if (response.status === 403)
        throw new Error(`Download blocked (403 Forbidden): ${url}`);
      if (!response.ok)
        throw new Error(`Download failed (${response.status}): ${url}`);

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0)
        throw new Error(`Downloaded file is empty (0 bytes): ${url}`);

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (String(lastError.message).includes("403")) throw lastError;
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        if (verbose)
          console.log(`  ⟳ Attempt ${attempt}/${retries} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
