import fs from "fs";
import type { MacIcnsConfig } from "../config.js";
import { getDb, saveDb } from "./db.js";

export type UrlType = "icns" | "ico";

export async function getDownloadFromCache(
  objectId: string,
  urlType: UrlType,
  config: MacIcnsConfig
): Promise<string | null> {
  try {
    const database = await getDb(config);
    const stmt = database.prepare(
      `SELECT local_path FROM download_cache WHERE object_id = ? AND url_type = ?`
    );
    stmt.bind([objectId, urlType]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    const localPath = row.local_path as string;
    if (!fs.existsSync(localPath)) return null;
    return localPath;
  } catch (error) {
    console.warn("[cache] Download read error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function setDownloadCache(
  objectId: string,
  urlType: UrlType,
  localPath: string,
  config: MacIcnsConfig
): Promise<void> {
  try {
    const database = await getDb(config);
    database.run(
      `DELETE FROM download_cache WHERE object_id = ? AND url_type = ?`,
      [objectId, urlType]
    );
    database.run(
      `INSERT INTO download_cache (object_id, url_type, local_path, created_at)
       VALUES (?, ?, ?, ?)`,
      [objectId, urlType, localPath, Date.now()]
    );
    saveDb(config);
  } catch (error) {
    console.warn("[cache] Download write error:", error instanceof Error ? error.message : error);
  }
}
