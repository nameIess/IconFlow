const { searchIcons } = require("../services/search");
const { downloadIcon, downloadBatch } = require("../services/download");
const { installToFolder, installToShortcut } = require("../services/install");
const { loadConfig, saveConfig } = require("../config");
const os = require("os");
const fs = require("fs");
const { exec } = require("child_process");

let CONFIG = loadConfig();

function reloadConfig() {
  CONFIG = loadConfig();
}

function sendJSON(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// POST /api/search
async function handleSearch(body, res) {
  const { query, limit = CONFIG.defaultLimit, page = 1 } = body;
  if (!query) return sendJSON(res, 400, { error: "Missing query" });
  if (!CONFIG.apiKey) return sendJSON(res, 400, { error: "API key not configured. Set it in Settings." });
  const data = await searchIcons(query, limit, page, CONFIG.apiKey);
  sendJSON(res, 200, data);
}

// POST /api/download
async function handleDownload(body, res) {
  const { icnsUrl, appName, objectID, format } = body;
  if (!icnsUrl) return sendJSON(res, 400, { error: "Missing icnsUrl" });
  const result = await downloadIcon({ icnsUrl, appName, objectID, format, config: CONFIG });
  sendJSON(res, 200, { success: true, ...result });
}

// POST /api/download-batch
async function handleDownloadBatch(body, res) {
  const { icons, format } = body;
  if (!Array.isArray(icons)) return sendJSON(res, 400, { error: "Missing icons array" });
  const results = await downloadBatch({ icons, format, config: CONFIG });
  sendJSON(res, 200, { results });
}

// POST /api/install
async function handleInstall(body, res) {
  const { iconPath, targetPath, isShortcut } = body;
  if (!iconPath || !targetPath) return sendJSON(res, 400, { error: "Missing iconPath or targetPath" });
  if (isShortcut) await installToShortcut(iconPath, targetPath);
  else await installToFolder(iconPath, targetPath);
  sendJSON(res, 200, { success: true });
}

// GET /api/config
function handleGetConfig(res) {
  sendJSON(res, 200, {
    apiKey: CONFIG.apiKey ? "***" + CONFIG.apiKey.slice(-4) : "",
    host: CONFIG.host,
    port: CONFIG.port,
    downloadDir: CONFIG.downloadDir,
    downloadDirIco: CONFIG.downloadDirIco,
    defaultLimit: CONFIG.defaultLimit,
    deleteIcnsAfterConvert: CONFIG.deleteIcnsAfterConvert,
    platform: os.platform(),
  });
}

// POST /api/config
function handleSaveConfig(body, res) {
  const updates = {};
  if (body.apiKey) updates.MACOSICONS_API_KEY = body.apiKey;
  if (body.host) updates.HOST = body.host;
  if (body.port) updates.PORT = String(body.port);
  if (body.downloadDir) updates.DOWNLOAD_DIR = body.downloadDir;
  if (body.downloadDirIco) updates.DOWNLOAD_DIR_ICO = body.downloadDirIco;
  if (body.defaultLimit) updates.DEFAULT_LIMIT = String(body.defaultLimit);
  updates.DELETE_ICNS_AFTER_CONVERT = body.deleteIcnsAfterConvert ? "true" : "false";

  saveConfig(updates);
  reloadConfig();
  sendJSON(res, 200, { success: true });
}

// POST /api/open-folder
function handleOpenFolder(body, res) {
  const dir = body.path || CONFIG.downloadDir;
  if (fs.existsSync(dir)) {
    if (os.platform() === "win32") exec(`explorer "${dir}"`);
    else if (os.platform() === "darwin") exec(`open "${dir}"`);
    else exec(`xdg-open "${dir}"`);
  }
  sendJSON(res, 200, { success: true });
}

module.exports = {
  handleSearch,
  handleDownload,
  handleDownloadBatch,
  handleInstall,
  handleGetConfig,
  handleSaveConfig,
  handleOpenFolder,
};
