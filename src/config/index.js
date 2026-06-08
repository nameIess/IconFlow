const fs = require("fs");
const path = require("path");
const os = require("os");

function expandEnvVars(str) {
  return str
    .replace(/%([^%]+)%/g, (_, k) => process.env[k] || `%${k}%`)
    .replace(/\$\{([^}]+)\}/g, (_, k) => process.env[k] || `\${${k}}`)
    .replace(/\$([A-Za-z_]\w*)/g, (_, k) => process.env[k] || `$${k}`);
}

function readDotEnv(fp) {
  if (!fs.existsSync(fp)) return {};
  const env = {};
  for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

// Default API key — lets the app search out-of-the-box. Override anytime in Settings or .env.
const DEFAULT_API_KEY = "09690dca4bdee55f3868c24b7696989c95545f7e9eb39873a29bdf0b1144f4b3";

function loadConfig() {
  const envPath = path.resolve(__dirname, "..", "..", ".env");
  const localEnv = readDotEnv(envPath);

  const apiKey =
    process.env.MACOSICONS_API_KEY || localEnv.MACOSICONS_API_KEY || DEFAULT_API_KEY;
  const host = process.env.HOST || localEnv.HOST || "127.0.0.1";
  const port = parseInt(process.env.PORT || localEnv.PORT || "3456", 10) || 3456;

  const dlRaw = process.env.DOWNLOAD_DIR || localEnv.DOWNLOAD_DIR || "";
  const downloadDir = dlRaw.trim()
    ? path.resolve(expandEnvVars(dlRaw.trim()))
    : path.join(os.homedir(), "Downloads", "icons", "icns");

  const dlIcoRaw = process.env.DOWNLOAD_DIR_ICO || localEnv.DOWNLOAD_DIR_ICO || "";
  const downloadDirIco = dlIcoRaw.trim()
    ? path.resolve(expandEnvVars(dlIcoRaw.trim()))
    : path.join(os.homedir(), "Downloads", "icons", "ico");

  const defaultLimit = parseInt(localEnv.DEFAULT_LIMIT || "25", 10) || 25;

  const deleteIcns = ["1", "true", "yes"].includes(
    (localEnv.DELETE_ICNS_AFTER_CONVERT || "").toLowerCase()
  );

  return { apiKey, host, port, downloadDir, downloadDirIco, defaultLimit, deleteIcnsAfterConvert: deleteIcns };
}

function saveConfig(updates) {
  const envPath = path.resolve(__dirname, "..", "..", ".env");
  const existing = readDotEnv(envPath);
  const merged = { ...existing, ...updates };

  const lines = ["# IconFlow configuration"];
  if (merged.MACOSICONS_API_KEY) lines.push(`MACOSICONS_API_KEY=${merged.MACOSICONS_API_KEY}`);
  if (merged.HOST) lines.push(`HOST=${merged.HOST}`);
  if (merged.PORT) lines.push(`PORT=${merged.PORT}`);
  if (merged.DOWNLOAD_DIR) lines.push(`DOWNLOAD_DIR=${merged.DOWNLOAD_DIR}`);
  if (merged.DOWNLOAD_DIR_ICO) lines.push(`DOWNLOAD_DIR_ICO=${merged.DOWNLOAD_DIR_ICO}`);
  if (merged.DEFAULT_LIMIT) lines.push(`DEFAULT_LIMIT=${merged.DEFAULT_LIMIT}`);
  lines.push(`DELETE_ICNS_AFTER_CONVERT=${merged.DELETE_ICNS_AFTER_CONVERT || "false"}`);

  fs.writeFileSync(envPath, lines.join("\n") + "\n");
}

module.exports = { loadConfig, saveConfig };
