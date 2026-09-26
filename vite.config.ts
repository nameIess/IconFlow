import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveMacosiconsShareUrl } from "./api/resolve-icon";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "iconflow-macosicons-resolver",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/resolve-icon")) {
            next();
            return;
          }

          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method not allowed." }));
            return;
          }

          const requestUrl = new URL(req.url, "http://localhost");
          const raw = requestUrl.searchParams.get("url") || "";
          const result = await resolveMacosiconsShareUrl(raw);

          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(result.body));
        });
      },
    },
  ],
});
