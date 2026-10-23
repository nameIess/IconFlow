import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolveMacosiconsShareUrl } from "../../api/resolve-icon.ts";

const MAX_REQUEST_TARGET_LENGTH = 4 * 1024;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

export function createResolverServer() {
  const server = createServer(async (req, res) => {
    try {
      const target = req.url || "/";
      if (target.length > MAX_REQUEST_TARGET_LENGTH) {
        sendJson(res, 414, { error: "Request URL is too long." });
        return;
      }

      const requestUrl = new URL(target, "http://127.0.0.1");

      if (requestUrl.pathname === "/healthz") {
        if (req.method !== "GET") {
          sendJson(res, 405, { error: "Method not allowed." });
          return;
        }
        res.statusCode = 204;
        res.setHeader("Cache-Control", "no-store");
        res.end();
        return;
      }

      if (requestUrl.pathname !== "/api/resolve-icon") {
        sendJson(res, 404, { error: "Not found." });
        return;
      }

      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed." });
        return;
      }

      const result = await resolveMacosiconsShareUrl(requestUrl.searchParams.get("url") || "");
      sendJson(res, result.status, result.body);
    } catch {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error." });
      } else {
        res.destroy();
      }
    }
  });

  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createResolverServer();
  server.listen(3000, "0.0.0.0", () => {
    process.stdout.write("IconFlow resolver listening on port 3000\n");
  });
}
