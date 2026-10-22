import fs from "fs";
import path from "path";
import os from "os";
import envPaths from "env-paths";

export interface MacIcnsConfig {
  apiKey: string;
  downloadDir: string;
  downloadDirIco?: string;
  deleteIcnsAfterConvert?: boolean;
  defaultLimit: number;
  cachePath?: string;
  cacheTtlHours?: number;
}

const CONFIG_DIR = envPaths("mac-icns", { suffix: "" });
export const GLOBAL_CONFIG_PATH = path.join(CONFIG_DIR.config, "config.json");

function expandEnvVars(str: string): string {
  return str
    .replace(/%([^%]+)%/g, (_, key) => process.env[key] ?? `%${key}%`)
    .replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] ?? `\${${key}}`)
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => process.env[key] ?? `$${key}`);
}

function readDotEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const lineRaw of content.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    env[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function getProjectEnvPath(): string {
  return path.resolve(process.cwd(), ".env");
}

function loadGlobalConfig(): Partial<MacIcnsConfig> | null {
  if (!fs.existsSync(GLOBAL_CONFIG_PATH)) return null;
  try {
    const raw = fs.readFileSync(GLOBAL_CONFIG_PATH, "utf8");
    return JSON.parse(raw) as Partial<MacIcnsConfig>;
  } catch {
    return null;
  }
}

export function loadConfig(): MacIcnsConfig {
  const localEnv = readDotEnvFile(getProjectEnvPath());
  const globalCfg = loadGlobalConfig();

  const apiKey =
    process.env.MACOSICONS_API_KEY ??
    process.env.macosicons ??
    globalCfg?.apiKey ??
    localEnv.MACOSICONS_API_KEY ??
    localEnv.macosicons ??
    "";

  const downloadDirRaw =
    process.env.DOWNLOAD_DIR ??
    globalCfg?.downloadDir ??
    localEnv.DOWNLOAD_DIR ??
    "";
  const downloadDir = downloadDirRaw.trim()
    ? path.resolve(expandEnvVars(downloadDirRaw.trim()))
    : path.join(os.homedir(), "Downloads", "icons", "icns");

  const downloadDirIcoRaw =
    process.env.DOWNLOAD_DIR_ICO ??
    globalCfg?.downloadDirIco ??
    localEnv.DOWNLOAD_DIR_ICO ??
    "";
  const downloadDirIco = downloadDirIcoRaw.trim()
    ? path.resolve(expandEnvVars(downloadDirIcoRaw.trim()))
    : path.join(os.homedir(), "Downloads", "icons", "ico");

  const deleteIcnsRaw =
    process.env.DELETE_ICNS_AFTER_CONVERT ??
    (typeof globalCfg?.deleteIcnsAfterConvert === "boolean"
      ? String(globalCfg.deleteIcnsAfterConvert)
      : undefined) ??
    localEnv.DELETE_ICNS_AFTER_CONVERT;
  const deleteIcnsAfterConvert =
    typeof deleteIcnsRaw === "string" && ["1", "true", "yes", "on"].includes(deleteIcnsRaw.toLowerCase());

  const defaultLimitNum = Number(
    process.env.DEFAULT_LIMIT ??
      globalCfg?.defaultLimit ??
      localEnv.DEFAULT_LIMIT ??
      ""
  );
  const defaultLimit =
    Number.isInteger(defaultLimitNum) && defaultLimitNum > 0 ? defaultLimitNum : 25;

  const cachePathOverride =
    globalCfg?.cachePath ?? localEnv.CACHE_PATH;
  const cachePath = cachePathOverride
    ? path.resolve(expandEnvVars(cachePathOverride))
    : path.join(CONFIG_DIR.cache, "cache.sqlite");

  const cacheTtlRaw =
    globalCfg?.cacheTtlHours ??
    (localEnv.CACHE_TTL_HOURS ? Number(localEnv.CACHE_TTL_HOURS) : undefined);
  const cacheTtlHours =
    typeof cacheTtlRaw === "number" && Number.isFinite(cacheTtlRaw) && cacheTtlRaw > 0
      ? cacheTtlRaw
      : 24;

  return {
    apiKey: apiKey.trim(),
    downloadDir,
    downloadDirIco,
    deleteIcnsAfterConvert,
    defaultLimit,
    cachePath,
    cacheTtlHours,
  };
}

export function getConfigDir(): string {
  return CONFIG_DIR.config;
}

export function ensureConfigDir(): void {
  fs.mkdirSync(CONFIG_DIR.config, { recursive: true });
}
