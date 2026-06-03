const http = require("http");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { loadConfig } = require("./config");
const { routeRequest } = require("./routes/api");
const { serveStatic } = require("./utils/http");

const CONFIG = loadConfig();
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const server = http.createServer(async (req, res) => {
  // Try API routes first
  const handled = await routeRequest(req, res);
  if (handled) return;

  // Serve static frontend files
  if (serveStatic(req, res, PUBLIC_DIR)) return;

  // 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error();
    console.error(`  [ERROR] Port ${CONFIG.port} is already in use.`);
    console.error(`  Another instance of IconFlow may already be running at:`);
    console.error(`  → http://${CONFIG.host}:${CONFIG.port}`);
    console.error(`  Close the other instance, or change PORT in .env`);
    console.error();
    process.exit(1);
  }
  throw err;
});

server.listen(CONFIG.port, CONFIG.host, () => {
  const addr = `http://${CONFIG.host}:${CONFIG.port}`;
  console.log();
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║         IconFlow is running          ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log();
  console.log(`  → URL:           ${addr}`);
  console.log(`  → ICNS Dir:      ${CONFIG.downloadDir}`);
  console.log(`  → ICO Dir:       ${CONFIG.downloadDirIco}`);
  console.log(`  → API Key:       ${CONFIG.apiKey ? "configured ✓" : "NOT SET — configure in Settings"}`);
  console.log();

  // Auto-open browser
  if (os.platform() === "win32") exec(`start ${addr}`);
  else if (os.platform() === "darwin") exec(`open ${addr}`);
});
