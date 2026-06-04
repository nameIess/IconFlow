const { parseBody, setCorsHeaders } = require("../utils/http");
const ctrl = require("../controllers/api");

const routes = {
  "POST /api/search": ctrl.handleSearch,
  "POST /api/download": ctrl.handleDownload,
  "POST /api/download-batch": ctrl.handleDownloadBatch,
  "POST /api/install": ctrl.handleInstall,
  "POST /api/config": ctrl.handleSaveConfig,
  "POST /api/open-folder": ctrl.handleOpenFolder,
};

async function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  // GET /api/config
  if (pathname === "/api/config" && req.method === "GET") {
    try {
      ctrl.handleGetConfig(res);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // POST routes
  const key = `${req.method} ${pathname}`;
  const handler = routes[key];
  if (handler) {
    try {
      const body = await parseBody(req);
      await handler(body, res);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  return false; // Not an API route
}

module.exports = { routeRequest };
