/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SEARCH_PAGE_SIZE?: string;
  readonly VITE_MIN_SEARCH_INTERVAL_MS?: string;
  readonly VITE_SEARCH_CACHE_TTL_MS?: string;
  readonly VITE_RATE_LIMIT_COOLDOWN_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css";
