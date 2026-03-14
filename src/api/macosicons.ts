import fs from "fs";
import os from "os";
import { chromium } from "playwright-core";

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

function getBrowserExecutablePath(): string | null {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (configured && fs.existsSync(configured)) return configured;

  const candidatesByPlatform: Record<string, string[]> = {
    win32: [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA ?? ""}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    darwin: [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: [
      "/usr/bin/microsoft-edge",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ],
  };

  const candidates = candidatesByPlatform[os.platform()] ?? [];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function deriveAppNameFromIcnsUrl(icnsUrl: string, iconId: string): string {
  const fileName = decodeURIComponent(icnsUrl.split("/").pop() ?? "").replace(/\.icns$/i, "");
  const suffix = fileName.replace(/^icnsFile_[^_]+_/, "");
  if (!suffix || suffix === iconId) return `icon-${iconId}`;
  return suffix.replace(/_/g, " ").trim();
}

async function resolveIconByIdViaBrowser(iconId: string): Promise<SearchHit | null> {
  const executablePath = getBrowserExecutablePath();
  if (!executablePath) {
    throw new Error(
      "Could not find a Chromium-based browser. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH if needed."
    );
  }

  const browser = await chromium.launch({
    executablePath,
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`https://macosicons.com/?icon=${encodeURIComponent(iconId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const downloadLink = page.locator('a[href$=".icns"]');
    await downloadLink.first().waitFor({ timeout: 30000 });

    const icnsUrl = await downloadLink.first().getAttribute("href");
    if (!icnsUrl) return null;

    const heading = page.locator("h1, h2").filter({ hasText: /.+/ }).first();
    const headingText = (await heading.textContent())?.trim();
    const appName =
      headingText && headingText !== "macOS App Icons"
        ? headingText
        : deriveAppNameFromIcnsUrl(icnsUrl, iconId);

    return {
      objectID: iconId,
      appName,
      icnsUrl,
    };
  } finally {
    await browser.close();
  }
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

  return resolveIconByIdViaBrowser(iconId);
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
