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

export async function searchIcons(key: string, query: string, limit = 24): Promise<SearchResponse> {
  const response = await fetch(API + "/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ query, limit, page: 1 }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "API request failed (" + response.status + ")");
  }
  return data as SearchResponse;
}

export async function fetchIcns(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to fetch ICNS (" + response.status + ")");
  return response.arrayBuffer();
}

export async function testApiKey(key: string): Promise<void> {
  await searchIcons(key, "Safari", 1);
}
