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
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MIN_SEARCH_INTERVAL_MS = 550;
const DEFAULT_SEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;
const SEARCH_WINDOW_MS = 60_000;
const MAX_SEARCHES_PER_WINDOW = 20;

function envNumber(name: keyof ImportMetaEnv, fallback: number): number {
  const value = Number(import.meta.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const SEARCH_PAGE_SIZE = Math.floor(envNumber("VITE_SEARCH_PAGE_SIZE", DEFAULT_PAGE_SIZE));
const MIN_SEARCH_INTERVAL_MS = envNumber("VITE_MIN_SEARCH_INTERVAL_MS", DEFAULT_MIN_SEARCH_INTERVAL_MS);
const SEARCH_CACHE_TTL_MS = envNumber("VITE_SEARCH_CACHE_TTL_MS", DEFAULT_SEARCH_CACHE_TTL_MS);
const RATE_LIMIT_COOLDOWN_MS = envNumber("VITE_RATE_LIMIT_COOLDOWN_MS", DEFAULT_RATE_LIMIT_COOLDOWN_MS);
const PERSISTED_CACHE_KEY = "iconflow.searchCache.v3";
const MAX_PERSISTED_CACHE_ENTRIES = 20;

type CacheEntry = { expiresAt: number; data: SearchResponse };
const searchCache = new Map<string, CacheEntry>();
let persistentCacheLoaded = false;
type SearchResult = SearchResponse & { usedBackup: boolean };
const inFlight = new Map<string, Promise<SearchResult>>();
const activeControllers = new Set<AbortController>();
const rateLimitedUntil = new Map<string, number>();
let cacheGeneration = 0;
const searchStarts: number[] = [];
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
        !Number.isFinite(entry.expiresAt) ||
        !entry.data ||
        entry.expiresAt <= now
      ) continue;

      const data = entry.data as SearchResponse;
      if (
        !Array.isArray(data.hits) ||
        !Number.isInteger(data.page) ||
        data.page < 1 ||
        !Number.isInteger(data.offset) ||
        data.offset < 0 ||
        !Number.isInteger(data.hitsPerPage) ||
        data.hitsPerPage < 1
      ) continue;

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

function pruneSearchStarts(now: number): void {
  while (searchStarts.length && now - searchStarts[0] >= SEARCH_WINDOW_MS) {
    searchStarts.shift();
  }
}

async function waitForSearchSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    pruneSearchStarts(now);

    const intervalWait = Math.max(0, MIN_SEARCH_INTERVAL_MS - (now - lastSearchStartedAt));
    const windowWait = searchStarts.length >= MAX_SEARCHES_PER_WINDOW
      ? Math.max(0, SEARCH_WINDOW_MS - (now - searchStarts[0]))
      : 0;
    const wait = Math.max(intervalWait, windowWait);

    if (wait <= 0) {
      const startedAt = Date.now();
      pruneSearchStarts(startedAt);
      searchStarts.push(startedAt);
      lastSearchStartedAt = startedAt;
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, wait));
  }
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
  if (status === 403) return "The API key is not allowed to perform this search.";
  if (status === 429) return "Search rate limit reached for this API key.";
  if (status >= 500) return "The macOSicons search service is temporarily unavailable.";
  return `Search failed (HTTP ${status}).`;
}

function positiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

async function requestSearch(
  apiKey: string,
  query: string,
  page: number,
  filters: string[] = [],
): Promise<SearchResponse> {
  await waitForSearchSlot();

  const controller = new AbortController();
  activeControllers.add(controller);
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        searchOptions: {
          hitsPerPage: SEARCH_PAGE_SIZE,
          page,
          offset: (page - 1) * SEARCH_PAGE_SIZE,
          ...(filters.length ? { filters } : {}),
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

    if (!body || typeof body !== "object") {
      throw new Error("The search API returned an invalid response.");
    }

    const result = body as Record<string, unknown>;
    if (!Array.isArray(result.hits)) {
      throw new Error("The search API returned no valid icon list.");
    }

    const responsePage = positiveInteger(result.page) ?? page;
    const responseOffset = nonNegativeInteger(result.offset) ?? (page - 1) * SEARCH_PAGE_SIZE;
    const responseHitsPerPage = positiveInteger(result.hitsPerPage) ?? positiveInteger(result.limit) ?? SEARCH_PAGE_SIZE;

    if (
      responsePage !== page ||
      responseOffset !== (page - 1) * SEARCH_PAGE_SIZE ||
      responseHitsPerPage !== SEARCH_PAGE_SIZE
    ) {
      throw new Error(
        `Unexpected search page: expected page ${page} with offset ${(page - 1) * SEARCH_PAGE_SIZE} and ${SEARCH_PAGE_SIZE} results per page, but the API returned page ${responsePage}, offset ${responseOffset}, and ${responseHitsPerPage} results per page.`,
      );
    }

    const rawTotalHits = Number(result.totalHits);
    const totalHits = Number.isFinite(rawTotalHits) && rawTotalHits >= 0
      ? Math.floor(rawTotalHits)
      : result.hits.length;
    const rawTotalPages = Number(result.totalPages);
    const totalPages = Number.isFinite(rawTotalPages) && rawTotalPages >= 1
      ? Math.floor(rawTotalPages)
      : Math.max(1, Math.ceil(totalHits / SEARCH_PAGE_SIZE));

    return {
      hits: result.hits as IconHit[],
      query: typeof result.query === "string" ? result.query : query,
      totalHits,
      totalPages,
      hitsPerPage: responseHitsPerPage,
      page: responsePage,
      offset: responseOffset,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The search request timed out. Try again.");
    }
    throw error instanceof Error ? error : new Error("Search failed.");
  } finally {
    window.clearTimeout(timer);
    activeControllers.delete(controller);
  }
}

async function requestWithKey(apiKey: string, query: string, page: number): Promise<SearchResponse> {
  const limitedUntil = rateLimitedUntil.get(apiKey) ?? 0;
  if (Date.now() < limitedUntil) throw new RateLimitError();

  try {
    return await requestSearch(apiKey, query, page);
  } catch (error) {
    if (error instanceof RateLimitError) {
      rateLimitedUntil.set(apiKey, Date.now() + RATE_LIMIT_COOLDOWN_MS);
    }
    throw error;
  }
}

export async function searchIcons(
  primaryApiKey: string,
  backupApiKey: string,
  query: string,
  page = 1,
): Promise<SearchResult> {
  const primaryKey = primaryApiKey.trim();
  const backupKey = backupApiKey.trim();
  const normalizedQuery = query.trim();
  const normalizedPage = Math.max(1, Math.floor(page));

  if (!primaryKey) throw new Error("Add your primary API key in Settings first.");
  if (!normalizedQuery) throw new Error("Enter an icon name to search.");
  if (normalizedQuery.length > 100) throw new Error("Search queries are limited to 100 characters.");

  const keyForCache = cacheKey(normalizedQuery, normalizedPage);
  const inFlightKey = JSON.stringify([primaryKey, backupKey, normalizedQuery, normalizedPage]);
  const cached = getCached(keyForCache);
  if (cached) return { ...cached, usedBackup: false };

  const pending = inFlight.get(inFlightKey);
  if (pending) return pending;

  const requestGeneration = cacheGeneration;
  const request = (async (): Promise<SearchResult> => {
    const primaryLimited = Date.now() < (rateLimitedUntil.get(primaryKey) ?? 0);

    if (!primaryLimited) {
      try {
        return { ...(await requestWithKey(primaryKey, normalizedQuery, normalizedPage)), usedBackup: false };
      } catch (error) {
        if (!(error instanceof RateLimitError)) throw error;
      }
    }

    if (!backupKey || backupKey === primaryKey) {
      throw new RateLimitError();
    }

    return {
      ...(await requestWithKey(backupKey, normalizedQuery, normalizedPage)),
      usedBackup: true,
    };
  })()
    .then((result) => {
      const { usedBackup, ...data } = result;
      if (requestGeneration === cacheGeneration) {
        searchCache.set(keyForCache, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          data,
        });
        persistSearchCache();
      }
      return { ...data, usedBackup };
    })
    .finally(() => inFlight.delete(inFlightKey));

  inFlight.set(inFlightKey, request);
  return request;
}

export type ImportedIconResult = {
  hits: IconHit[];
  failed: string[];
  usedBackup: boolean;
};

const MACOSICONS_HOSTS = new Set(["macosicons.com", "www.macosicons.com"]);

function parseImportUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function shareIdFromUrl(value: string): string | null {
  const url = parseImportUrl(value);
  if (!url || !MACOSICONS_HOSTS.has(url.hostname.toLowerCase())) return null;

  const queryId = url.searchParams.get("icon")?.trim();
  if (queryId) return queryId;

  const hash = url.hash.replace(/^#/, "");
  if (hash) {
    try {
      const hashUrl = new URL(hash.startsWith("/") ? hash : "/" + hash, url.origin);
      const hashId = hashUrl.searchParams.get("icon")?.trim();
      if (hashId) return hashId;
    } catch {}
  }

  const lastSegment = url.pathname.split("/").filter(Boolean).at(-1) || "";
  const match = lastSegment.match(/-([A-Za-z0-9]{8,})$/);
  return match?.[1] || null;
}

function importHitMatchesId(hit: IconHit, id: string): boolean {
  const target = id.trim().toLowerCase();
  if (!target) return false;

  const candidateValues = Object.values(hit)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return candidateValues.some((value) => value.includes(target));
}

async function requestAuthenticatedImport(
  primaryApiKey: string,
  backupApiKey: string,
  id: string,
): Promise<{ hit: IconHit | null; usedBackup: boolean }> {
  const primaryKey = primaryApiKey.trim();
  const backupKey = backupApiKey.trim();
  const keys = [primaryKey, backupKey].filter((key, index, all) => Boolean(key) && all.indexOf(key) === index);

  if (!keys.length) throw new Error("Add your primary API key in Settings first.");

  const exactFilter = [`objectID = ${JSON.stringify(id)}`];

  for (const key of keys) {
    try {
      const exact = await requestSearch(key, id, 1, exactFilter);

      // The API docs do not expose objectID in each returned hit. The filter
      // itself is the proof that this hit belongs to the imported share ID.
      let hit = exact.hits[0] ?? null;

      if (!hit) {
        const broad = await requestSearch(key, id, 1);
        hit = broad.hits.find((item) => importHitMatchesId(item, id)) ?? null;
      }

      if (hit) {
        return { hit, usedBackup: key === backupKey && key !== primaryKey };
      }
    } catch (error) {
      if (error instanceof RateLimitError) continue;
      if (key === primaryKey && backupKey && backupKey !== primaryKey) continue;
      throw error;
    }
  }

  return { hit: null, usedBackup: false };
}

function directImportedHit(url: URL): IconHit {
  const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "Imported icon")
    .replace(/\.icns$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return {
    appName: name || "Imported icon",
    icnsUrl: url.toString(),
    objectID: url.toString(),
  };
}

export function parseIconImportText(text: string): { urls: string[]; invalidCount: number } {
  const seen = new Set<string>();
  const urls: string[] = [];
  let invalidCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;

    const candidates = value.match(/https:\/\/[^\s<>"']+/gi) || [value];
    let added = false;

    for (const raw of candidates) {
      const cleaned = raw.replace(/[),.;]+$/, "");
      const url = parseImportUrl(cleaned);
      if (!url) continue;

      const host = url.hostname.toLowerCase();
      const supported = MACOSICONS_HOSTS.has(host) ||
        (host === "s3-new.macosicons.com" && /\.icns(?:$|[?#])/i.test(url.pathname));

      if (!supported) continue;

      const normalized = url.toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        urls.push(normalized);
      }
      added = true;
    }

    if (!added) invalidCount += 1;
    if (urls.length >= 100) break;
  }

  return { urls: urls.slice(0, 100), invalidCount };
}

export async function importIconUrls(
  primaryApiKey: string,
  backupApiKey: string,
  urls: string[],
): Promise<ImportedIconResult> {
  const hits: IconHit[] = [];
  const failed: string[] = [];
  let usedBackup = false;

  for (const raw of urls.slice(0, 100)) {
    const url = parseImportUrl(raw);
    if (!url) {
      failed.push(raw);
      continue;
    }

    if (url.hostname.toLowerCase() === "s3-new.macosicons.com" && /\.icns(?:$|[?#])/i.test(url.pathname)) {
      hits.push(directImportedHit(url));
      continue;
    }

    const id = shareIdFromUrl(url.toString());
    if (!id) {
      failed.push(raw);
      continue;
    }

    const result = await requestAuthenticatedImport(primaryApiKey, backupApiKey, id);
    if (result.hit) {
      hits.push(result.hit);
      usedBackup = usedBackup || result.usedBackup;
    } else {
      failed.push(raw);
    }
  }

  return { hits, failed, usedBackup };
}

export function clearSearchCache(): void {
  cacheGeneration += 1;
  searchCache.clear();
  inFlight.clear();
  for (const controller of activeControllers) controller.abort();
  activeControllers.clear();
  persistentCacheLoaded = true;
  rateLimitedUntil.clear();
  searchStarts.length = 0;
  lastSearchStartedAt = 0;
  try { localStorage.removeItem(PERSISTED_CACHE_KEY); } catch {}
}

function isTrustedAssetUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && hostname === "s3-new.macosicons.com";
  } catch {
    return false;
  }
}

export async function fetchIcns(url: string): Promise<ArrayBuffer> {
  if (!isTrustedAssetUrl(url)) {
    throw new Error("Blocked untrusted icon source.");
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!isTrustedAssetUrl(response.url)) {
      throw new Error("The icon source redirected to an untrusted host.");
    }
    if (!response.ok) {
      throw new Error(`Unable to fetch the original icon (HTTP ${response.status}).`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 8) {
      throw new Error("The icon source returned an empty or invalid file.");
    }
    return buffer;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The icon download timed out. Try again.");
    }
    throw error instanceof Error ? error : new Error("The icon source could not be downloaded.");
  } finally {
    window.clearTimeout(timer);
  }
}

export function isTrustedImageUrl(value?: string): value is string {
  return typeof value === "string" && isTrustedAssetUrl(value);
}
