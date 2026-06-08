const { buildFallbackUrl } = require("./download");

const SEARCH_ENDPOINT = "https://api.macosicons.com/api/v1/search";
const SITE_SEARCH_ENDPOINT = "https://macosicons.com/api/search";
const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fix broken S3 URLs in a hit object by replacing them with
 * parsefiles.back4app.com fallback URLs.
 */
function fixHitUrls(hit) {
  if (!hit) return hit;
  for (const key of ["icnsUrl", "lowResPngUrl", "iOSUrl"]) {
    if (hit[key] && hit[key].includes("s3.macosicons.com")) {
      const fallback = buildFallbackUrl(hit[key]);
      if (fallback) hit[key] = fallback;
    }
  }
  return hit;
}

async function searchIcons(query, limit, page, apiKey) {
  const res = await fetchWithTimeout(SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query,
      searchOptions: {
        hitsPerPage: limit,
        page: Math.max(1, page),
        sort: ["downloads:desc"],
      },
    }),
  });
  const data = await res.json();

  // Fix any broken S3 URLs in the results
  if (Array.isArray(data.hits)) {
    data.hits = data.hits.map(fixHitUrls);
  }

  return data;
}

async function resolveIconById(iconId, apiKey) {
  // Try site search first
  try {
    const res = await fetchWithTimeout(SITE_SEARCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "",
        searchOptions: {
          filters: [`objectID = ${iconId}`],
          hitsPerPage: 1,
          page: 1,
          sort: ["timeStamp:desc"],
        },
      }),
    });
    const data = await res.json();
    if (data.hits?.[0]?.icnsUrl) return fixHitUrls(data.hits[0]);
  } catch {
    // Fall through to API search
  }

  // Fallback: search by ID as keyword
  try {
    const payload = await searchIcons(iconId, 50, 1, apiKey);
    const hits = payload.hits || [];
    const exact = hits.find((h) => h.objectID === iconId);
    if (exact) return exact; // Already fixed by searchIcons
    if (hits[0]?.icnsUrl) return hits[0];
  } catch {
    // Let it return null
  }

  return null;
}

module.exports = { searchIcons, resolveIconById };
