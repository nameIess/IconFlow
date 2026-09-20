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
export const SEARCH_PAGE_SIZE = Math.max(1, Number(import.meta.env.VITE_SEARCH_PAGE_SIZE || 100));
const MIN_SEARCH_INTERVAL_MS = Math.max(0, Number(import.meta.env.VITE_MIN_SEARCH_INTERVAL_MS || 1500));
const SEARCH_CACHE_TTL_MS = Math.max(0, Number(import.meta.env.VITE_SEARCH_CACHE_TTL_MS || 120000));
const RATE_LIMIT_COOLDOWN_MS = Math.max(5000, Number(import.meta.env.VITE_RATE_LIMIT_COOLDOWN_MS || 60000));
const SEARCH_WINDOW_MS = Math.max(1000, Number(import.meta.env.VITE_SEARCH_WINDOW_MS || 60000));
const MAX_SEARCHES_PER_WINDOW = Math.max(1, Number(import.meta.env.VITE_MAX_SEARCHES_PER_WINDOW || 20));

const searchCache = new Map<string, { expiresAt: number; data: SearchResponse }>();
const requestTimes: number[] = [];
let lastSearchStartedAt = 0;
let rateLimitBlockedUntil = 0;

export function clearSearchCache(): void {
  searchCache.clear();
}

function pruneRequestTimes(now: number): void {
  while (requestTimes.length && now - requestTimes[0] >= SEARCH_WINDOW_MS) requestTimes.shift();
}

async function waitForSearchSlot(): Promise<void> {
  const now = Date.now();
  pruneRequestTimes(now);
  if (now < rateLimitBlockedUntil) {
    const seconds = Math.ceil((rateLimitBlockedUntil - now) / 1000);
    throw new Error(`Search temporarily paused after a rate-limit response. Try again in ${seconds}s.`);
  }
  const spacingWait = Math.max(0, MIN_SEARCH_INTERVAL_MS - (now - lastSearchStartedAt));
  if (spacingWait > 0) await new Promise((resolve) => window.setTimeout(resolve, spacingWait));
  const afterSpacing = Date.now();
  pruneRequestTimes(afterSpacing);
  if (requestTimes.length >= MAX_SEARCHES_PER_WINDOW) {
    const waitMs = Math.max(1, SEARCH_WINDOW_MS - (afterSpacing - requestTimes[0]));
    throw new Error(`Search limit reached in this browser. Try again in ${Math.ceil(waitMs / 1000)}s.`);
  }
  lastSearchStartedAt = afterSpacing;
  requestTimes.push(afterSpacing);
}

function getCacheKey(key: string, query: string, limit: number, page: number): string {
  return `${key.length}:${query.toLowerCase()}:${limit}:${page}`;
}

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
  const cacheKey = getCacheKey(normalizedKey, normalizedQuery, normalizedLimit, normalizedPage);
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (cached) searchCache.delete(cacheKey);

  await waitForSearchSlot();

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
      rateLimitBlockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw new Error(`macOSicons rate limit reached. Search paused for ${Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000)}s to avoid repeated requests.`);
    }
    throw new Error(data?.error || data?.message || "macOSicons request failed (" + response.status + ").");
  }

  if (!data || !Array.isArray(data.hits)) {
    throw new Error("macOSicons returned an unexpected response.");
  }

  const result = data as SearchResponse;
  searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, data: result });
  return result;
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
