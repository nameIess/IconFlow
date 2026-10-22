import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import type { MacIcnsConfig } from "../config.js";

type SqlDb = import("sql.js").SqlJsDatabase;

let db: SqlDb | null = null;
let initPromise: Promise<SqlDb> | null = null;

async function initDb(config: MacIcnsConfig): Promise<SqlDb> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    const dbPath = config.cachePath!;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    if (fs.existsSync(dbPath)) {
      const buf = fs.readFileSync(dbPath);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        limit_val INTEGER NOT NULL,
        offset_val INTEGER NOT NULL,
        response_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_search_cache_key ON search_cache(query, limit_val, offset_val);
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS download_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        object_id TEXT NOT NULL,
        url_type TEXT NOT NULL,
        local_path TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_download_cache_key ON download_cache(object_id, url_type);
    `);
    return db;
  })();

  return initPromise;
}

export async function getDb(config: MacIcnsConfig) {
  return initDb(config);
}

export function saveDb(config: MacIcnsConfig): void {
  if (!db) return;
  try {
    const data = db.export();
    fs.mkdirSync(path.dirname(config.cachePath!), { recursive: true });
    fs.writeFileSync(config.cachePath!, Buffer.from(data));
  } catch (error) {
    console.warn("[cache] Failed to persist database:", error instanceof Error ? error.message : error);
  }
}
