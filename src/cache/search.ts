import type { SearchPayload } from "../api/macosicons.js";
import type { MacIcnsConfig } from "../config.js";
import { getDb, saveDb } from "./db.js";

export async function getSearchFromCache(
  key: { query: string; limit: number; offset: number },
  config: MacIcnsConfig
): Promise<SearchPayload | null> {
  try {
    const database = await getDb(config);
    const ttlMs = (config.cacheTtlHours ?? 24) * 60 * 60 * 1000;
    const cutoff = Date.now() - ttlMs;
    const stmt = database.prepare(
      `SELECT response_json, created_at FROM search_cache
       WHERE query = ? AND limit_val = ? AND offset_val = ?
       AND created_at > ?`
    );
    stmt.bind([key.query, key.limit, key.offset, cutoff]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return JSON.parse(row.response_json as string) as SearchPayload;
  } catch (error) {
    console.warn("[cache] Search read error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function setSearchCache(
  key: { query: string; limit: number; offset: number },
  payload: SearchPayload,
  config: MacIcnsConfig
): Promise<void> {
  try {
    const database = await getDb(config);
    database.run(
      `DELETE FROM search_cache WHERE query = ? AND limit_val = ? AND offset_val = ?`,
      [key.query, key.limit, key.offset]
    );
    database.run(
      `INSERT INTO search_cache (query, limit_val, offset_val, response_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [key.query, key.limit, key.offset, JSON.stringify(payload), Date.now()]
    );
    saveDb(config);
  } catch (error) {
    console.warn("[cache] Search write error:", error instanceof Error ? error.message : error);
  }
}
