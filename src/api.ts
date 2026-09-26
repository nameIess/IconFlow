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
  totalPages: number;
  hitsPerPage: number;
  page: number;
  offset: number;
};

const API_BASE = "https://api.macosicons.com/api/v1";
export const SEARCH_PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
const MIN_SEARCH_INTERVAL_MS = 550;
const SEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PERSISTED_CACHE_KEY = "iconflow.searchCache.v2";
const MAX_PERSISTED_CACHE_ENTRIES = 20;

type CacheEntry = { expiresAt: number; data: SearchResponse };
const searchCache = new Map<string, CacheEntry>();
let persistentCacheLoaded = false;
type SearchResult = SearchResponse & { usedBackup: boolean };
const inFlight = new Map<string, Promise<SearchResult>>();
let lastSearchStartedAt = 0;

function cacheKey(query: string, page: number): string {
  return JSON.stringify([query, page, SEARCH_PAGE_SIZE]);
}

function loadPersistentCache(): void {
  if (persistentCacheLoaded) return;
  persistentCacheLoaded = true;

  try {
    const raw = localStorage.getItem(PERSISTED_CACHE_KEY);
    if (!raw) return;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const now = Date.now();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { key?: unknown; expiresAt?: unknown; data?: unknown };
      if (
        typeof entry.key !== "string" ||
        typeof entry.expiresAt !== "number" ||
        !entry.data ||
        entry.expiresAt <= now
      ) continue;

      const data = entry.data as SearchResponse;
      if (!Array.isArray(data.hits)) continue;
      searchCache.set(entry.key, { expiresAt: entry.expiresAt, data });
    }
  } catch {
    try { localStorage.removeItem(PERSISTED_CACHE_KEY); } catch {}
  }
}

function persistSearchCache(): void {
  try {
    const now = Date.now();
    const entries = [...searchCache.entries()]
      .filter(([, entry]) => entry.expiresAt > now)
      .sort((a, b) => b[1].expiresAt - a[1].expiresAt)
      .slice(0, MAX_PERSISTED_CACHE_ENTRIES)
      .map(([key, entry]) => ({ key, expiresAt: entry.expiresAt, data: entry.data }));

    localStorage.setItem(PERSISTED_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Search still works when browser storage is unavailable or full.
  }
}

function getCached(key: string): SearchResponse | null {
  loadPersistentCache();

  const entry = searchCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    searchCache.delete(key);
    persistSearchCache();
    return null;
  }
  return entry.data;
}

async function waitForSearchSlot(): Promise<void> {
  const wait = Math.max(0, MIN_SEARCH_INTERVAL_MS - (Date.now() - lastSearchStartedAt));
  if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
  lastSearchStartedAt = Date.now();
}

export class RateLimitError extends Error {
  constructor() {
    super("Search rate limit reached for this API key.");
    this.name = "RateLimitError";
  }
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (status === 401) return "The API key is invalid.";
  if (status === 429) return "Search rate limit reached for this API key.";
  if (status >= 500) return "The macOSicons search service is temporarily unavailable.";
  return `Search failed (HTTP ${status}).`;
}

async function requestSearch(apiKey: string, query: string, page: number): Promise<SearchResponse> {
  await waitForSearchSlot();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query,
        searchOptions: {
          hitsPerPage: SEARCH_PAGE_SIZE,
          page,
          offset: (page - 1) * SEARCH_PAGE_SIZE,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 429) throw new RateLimitError();
      throw new Error(errorMessage(response.status, body));
    }
    if (!body || typeof body !== "object") throw new Error("The search API returned an invalid response.");

    const result = body as Partial<SearchResponse> & { hits?: unknown };
    if (!Array.isArray(result.hits)) throw new Error("The search API returned no valid icon list.");

    const hitsPerPage = Number(result.hitsPerPage) || SEARCH_PAGE_SIZE;
    const totalHits = Math.max(0, Number(result.totalHits) || result.hits.length);
    const responsePage = Number(result.page);
    const responseOffset = Number(result.offset);

    return {
      hits: result.hits as IconHit[],
      query: typeof result.query === "string" ? result.query : query,
      totalHits,
      totalPages: Math.max(1, Number(result.totalPages) || Math.ceil(totalHits / hitsPerPage)),
      hitsPerPage,
      page: Number.isInteger(responsePage) && responsePage > 0 ? responsePage : page,
      offset: Number.isInteger(responseOffset) && responseOffset >= 0 ? responseOffset : (page - 1) * hitsPerPage,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("The search request timed out. Try again.");
    throw error instanceof Error ? error : new Error("Search failed.");
  } finally {
    window.clearTimeout(timer);
  }
}

export async function searchIcons(primaryApiKey: string, backupApiKey: string, query: string, page = 1): Promise<SearchResult> {
  const primaryKey = primaryApiKey.trim();
  const backupKey = backupApiKey.trim();
  const normalizedQuery = query.trim();
  const normalizedPage = Math.max(1, Math.floor(page));

  if (!primaryKey) throw new Error("Add your primary API key in Settings first.");
  if (!normalizedQuery) throw new Error("Enter an icon name to search.");
  if (normalizedQuery.length > 100) throw new Error("Search queries are limited to 100 characters.");

  const keyForCache = cacheKey(normalizedQuery, normalizedPage);
  const cached = getCached(keyForCache);
  if (cached) return { ...cached, usedBackup: false };

  const pending = inFlight.get(keyForCache);
  if (pending) return pending;

  const request = (async (): Promise<SearchResult> => {
    try {
      return { ...(await requestSearch(primaryKey, normalizedQuery, normalizedPage)), usedBackup: false };
    } catch (error) {
      if (!(error instanceof RateLimitError) || !backupKey || backupKey === primaryKey) throw error;
      return { ...(await requestSearch(backupKey, normalizedQuery, normalizedPage)), usedBackup: true };
    }
  })()
    .then((result) => {
      const { usedBackup, ...data } = result;
      searchCache.set(keyForCache, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, data });
      persistSearchCache();
      return { ...data, usedBackup };
    })
    .finally(() => inFlight.delete(keyForCache));

  inFlight.set(keyForCache, request);
  return request;
}

export function clearSearchCache(): void {
  searchCache.clear();
  inFlight.clear();
  persistentCacheLoaded = true;
  try { localStorage.removeItem(PERSISTED_CACHE_KEY); } catch {}
}

export async function fetchIcns(url: string): Promise<ArrayBuffer> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("The icon source URL is invalid."); }

  const hostname = parsed.hostname.toLowerCase();
  const isMacOSiconsAssetHost =
    hostname === "s3-new.macosicons.com" ||
    hostname.endsWith(".macosicons.com");

  if (parsed.protocol !== "https:" || !isMacOSiconsAssetHost) {
    throw new Error("Blocked untrusted icon source.");
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.href, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Unable to fetch the original icon (HTTP ${response.status}).`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 8) throw new Error("The icon source returned an empty or invalid file.");
    return buffer;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("The icon download timed out. Try again.");
    throw error instanceof Error ? error : new Error("The icon source could not be downloaded.");
  } finally {
    window.clearTimeout(timer);
  }
}