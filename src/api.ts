export type IconHit = {
  appName: string;
  lowResPngUrl?: string;
  icnsUrl?: string;
  iOSUrl?: string;
  category?: string;
  credit?: string;
  uploadedBy?: string;
  creditUrl?: string;
  downloads?: number;
  objectID?: string;
};

export type SearchResponse = {
  hits: IconHit[];
  query: string;
  totalHits: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
};

const API = "https://api.macosicons.com/api/v1";
const REQUEST_TIMEOUT_MS = 15_000;
export const SEARCH_PAGE_SIZE = 100;

async function readResponse(response: Response): Promise<unknown> {
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(API + path, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The macOSicons request timed out. Check your connection and try again.");
    }
    throw new Error("Unable to reach macOSicons. Check your connection and try again.");
  } finally {
    window.clearTimeout(timer);
  }
}

export async function searchIcons(
  key: string,
  query: string,
  limit = SEARCH_PAGE_SIZE,
  page = 1,
): Promise<SearchResponse> {
  const normalizedKey = key.trim();
  const normalizedQuery = query.trim();

  if (!normalizedKey) throw new Error("Add your macOSicons API key in Settings first.");
  if (!normalizedQuery) throw new Error("Enter an app name to search.");
  if (normalizedQuery.length > 100) throw new Error("Search must be 100 characters or fewer.");

  const normalizedLimit = Math.min(Math.max(limit, 1), SEARCH_PAGE_SIZE);
  const normalizedPage = Math.max(1, Math.floor(page));

  const response = await request("/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": normalizedKey },
    body: JSON.stringify({
      query: normalizedQuery,
      limit: normalizedLimit,
      page: normalizedPage,
    }),
  });

  const data = await readResponse(response) as Partial<SearchResponse> & { error?: string; message?: string } | null;

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("The API key was rejected. Check your macOSicons key in Settings.");
    }
    if (response.status === 429) {
      throw new Error("macOSicons rate limit reached. Wait a moment and try again.");
    }
    throw new Error(data?.error || data?.message || "macOSicons request failed (" + response.status + ").");
  }

  if (!data || !Array.isArray(data.hits)) {
    throw new Error("macOSicons returned an unexpected response.");
  }

  return data as SearchResponse;
}

export async function fetchIcns(url: string): Promise<ArrayBuffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The icon source URL is invalid.");
  }

  if (parsed.protocol !== "https:" || !parsed.hostname) {
    throw new Error("IconFlow only downloads secure HTTPS icon sources.");
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.href, { signal: controller.signal });
    if (!response.ok) throw new Error("Unable to fetch the icon source (" + response.status + ").");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 8) throw new Error("The icon source returned an empty or invalid file.");
    return buffer;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unable to fetch")) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The icon download timed out. Try again.");
    }
    throw new Error("The icon source could not be downloaded in this browser.");
  } finally {
    window.clearTimeout(timer);
  }
}

export async function testApiKey(key: string): Promise<void> {
  await searchIcons(key, "Safari", 1, 1);
}
