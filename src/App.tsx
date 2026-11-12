import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import {
  clearSearchCache,
  fetchIcns,
  fetchImageAsset,
  importIconUrls,
  isTrustedImageUrl,
  parseIconImportText,
  searchIcons,
  SEARCH_PAGE_SIZE,
  type IconHit,
} from "./api";
import {
  download,
  filename,
  icnsToIco,
  icnsToPng,
  imageToIco,
  imageToPng,
  previewUrl,
  zipFiles,
} from "./converter";
import packageJson from "../package.json";

type Format = "png" | "ico";
const PRIMARY_KEY = "iconflow.primaryApiKey";
const BACKUP_KEY = "iconflow.backupApiKey";
const LEGACY_SEARCH_KEY = "iconflow.searchApiKey";
const LEGACY_DOWNLOAD_KEY = "iconflow.downloadApiKey";
const THEME_KEY = "iconflow.theme";
const DEFAULT_FORMAT_KEY = "iconflow.defaultDownloadFormat";

function stored(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() || "";
  } catch {
    return "";
  }
}

function storedWithLegacy(key: string, legacyKey: string): string {
  const current = stored(key);
  if (current) return current;
  const legacy = stored(legacyKey);
  if (legacy) {
    try {
      localStorage.setItem(key, legacy);
    } catch {}
  }
  return legacy;
}

function IconMark({ className = "" }: { className?: string }) {
  return (
    <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />
  );
}

function GithubMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 .297a12 12 0 0 0-3.793 23.39c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.776.418-1.305.762-1.605-2.665-.304-5.466-1.332-5.466-5.93 0-1.31.469-2.38 1.236-3.22-.124-.303-.536-1.523.117-3.176 0 0 1.008-.323 3.3 1.23a11.48 11.48 0 0 1 6.006 0c2.29-1.553 3.297-1.23 3.297-1.23.655 1.653.243 2.873.12 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.806 5.624-5.479 5.921.43.372.814 1.103.814 2.222v3.293c0 .319.216.694.825.576A12.005 12.005 0 0 0 12 .297" />
    </svg>
  );
}

function hitId(hit: IconHit, index = 0): string {
  return hit.objectID || hit.icnsUrl || `${hit.appName}-${index}`;
}

function mergeUniqueHits(current: IconHit[], next: IconHit[]): IconHit[] {
  const seen = new Set<string>();
  const merged: IconHit[] = [];
  for (const hit of [...current, ...next]) {
    const keys = [
      hit.objectID ? `id:${hit.objectID.toLowerCase()}` : "",
      hit.icnsUrl ? `icns:${hit.icnsUrl.toLowerCase()}` : "",
      hit.lowResPngUrl ? `preview:${hit.lowResPngUrl.toLowerCase()}` : "",
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) continue;
    if (!keys.length)
      keys.push(`name:${hit.appName.toLowerCase()}:${merged.length}`);
    keys.forEach((key) => seen.add(key));
    merged.push(hit);
  }
  return merged;
}

function App() {
  const [primaryApiKey, setPrimaryApiKey] = useState(() =>
    storedWithLegacy(PRIMARY_KEY, LEGACY_SEARCH_KEY),
  );
  const [backupApiKey, setBackupApiKey] = useState(() =>
    storedWithLegacy(BACKUP_KEY, LEGACY_DOWNLOAD_KEY),
  );
  const [draftPrimaryKey, setDraftPrimaryKey] = useState(() =>
    storedWithLegacy(PRIMARY_KEY, LEGACY_SEARCH_KEY),
  );
  const [draftBackupKey, setDraftBackupKey] = useState(() =>
    storedWithLegacy(BACKUP_KEY, LEGACY_DOWNLOAD_KEY),
  );
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<IconHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    () => !storedWithLegacy(PRIMARY_KEY, LEGACY_SEARCH_KEY),
  );
  const [defaultFormat, setDefaultFormat] = useState<Format>(() =>
    stored(DEFAULT_FORMAT_KEY) === "png" ? "png" : "ico",
  );
  const [draftDefaultFormat, setDraftDefaultFormat] = useState<Format>(() =>
    stored(DEFAULT_FORMAT_KEY) === "png" ? "png" : "ico",
  );
  const [preview, setPreview] = useState<{
    hit: IconHit;
    url?: string;
    loading: boolean;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    stored(THEME_KEY) === "light" ? "light" : "dark",
  );
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const importModalFileRef = useRef<HTMLInputElement>(null);
  const requestGeneration = useRef(0);
  const previewGeneration = useRef(0);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const activeDialogKind = preview
    ? "preview"
    : importOpen
      ? "import"
      : settingsOpen
        ? "settings"
        : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activeDialogKind) {
      dialogReturnFocusRef.current?.focus();
      dialogReturnFocusRef.current = null;
      return;
    }

    if (!dialogReturnFocusRef.current) {
      const activeElement = document.activeElement;
      dialogReturnFocusRef.current =
        activeElement instanceof HTMLElement ? activeElement : null;
    }

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const focusable = dialog.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    );
    (focusable || dialog).focus();
  }, [activeDialogKind]);

  useEffect(() => {
    if (!activeDialogKind) return;

    function handleDialogKeyDown(event: KeyboardEvent) {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (!dialog) return;

      if (event.key === "Escape") {
        if (preview) {
          previewGeneration.current += 1;
          setPreview(null);
        } else if (importOpen) {
          if (!importLoading) setImportOpen(false);
        } else if (settingsOpen) {
          setSettingsOpen(false);
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) => element.offsetWidth > 0 || element.offsetHeight > 0,
      );
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => window.removeEventListener("keydown", handleDialogKeyDown);
  }, [activeDialogKind, importLoading, importOpen, preview, settingsOpen]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  function applyResponse(
    data: Awaited<ReturnType<typeof searchIcons>>,
    searchValue: string,
  ) {
    setResults(data.hits);
    setTotal(data.totalHits);
    setPage(data.page);
    setTotalPages(data.totalPages);
    setActiveQuery(searchValue);
    setSelectedIds(new Set());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function search() {
    const value = query.trim();
    if (!value) return setToast("Enter an icon name to search.");
    if (!primaryApiKey) return setSettingsOpen(true);

    const generation = ++requestGeneration.current;
    setLoading(true);

    try {
      const data = await searchIcons(primaryApiKey, backupApiKey, value, 1);
      if (generation !== requestGeneration.current) return;

      applyResponse(data, value);
      if (data.usedBackup)
        setToast(
          "Primary API key is rate-limited. Search continued with the backup key.",
        );
      else if (!data.hits.length)
        setToast("No icons found. Try another search.");
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setToast(error instanceof Error ? error.message : "Search failed.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }

  async function importUrls(urls: string[]) {
    setImportLoading(true);
    try {
      const data = await importIconUrls(urls);
      if (data.hits.length) {
        setResults((current) => {
          const merged = mergeUniqueHits(current, data.hits);
          if (!activeQuery) setTotal(merged.length);
          return merged;
        });
        if (!activeQuery) {
          setActiveQuery("Imported icons");
          setPage(1);
          setTotalPages(1);
        }
        setSelectedIds(new Set());
        setImportOpen(false);
        const failedText = data.failed.length
          ? ` ${data.failed.length} link(s) could not be resolved.`
          : "";
        setToast(`Imported ${data.hits.length} icon(s).${failedText}`);
      } else {
        setToast(
          data.failed.length
            ? `Imported 0 icon(s); ${data.failed.length} link(s) could not be resolved.`
            : "No supported icon links were found.",
        );
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Icon import failed.");
    } finally {
      setImportLoading(false);
    }
  }

  async function importFromText() {
    const parsed = parseIconImportText(importUrl);
    if (!parsed.urls.length) {
      setToast("Paste a macOSicons URL or supported ICNS URL.");
      return;
    }
    await importUrls(parsed.urls);
  }

  async function importFromFile(file: File) {
    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error(
          "The text file is too large to import safely (maximum 2 MB).",
        );
      }
      const text = await file.text();
      const parsed = parseIconImportText(text);
      if (!parsed.urls.length) {
        setToast("The text file contains no supported icon URLs.");
        return;
      }
      await importUrls(parsed.urls);
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Unable to read the text file.",
      );
    } finally {
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  async function loadMore() {
    if (
      loading ||
      pageLoading ||
      importLoading ||
      !activeQuery ||
      page >= totalPages
    )
      return;

    const generation = ++requestGeneration.current;
    const nextPage = page + 1;
    setPageLoading(true);

    try {
      const data = await searchIcons(
        primaryApiKey,
        backupApiKey,
        activeQuery,
        nextPage,
      );
      if (generation !== requestGeneration.current) return;

      const expectedOffset = (nextPage - 1) * SEARCH_PAGE_SIZE;
      if (
        data.page !== nextPage ||
        data.offset !== expectedOffset ||
        data.hitsPerPage !== SEARCH_PAGE_SIZE
      ) {
        setToast(
          `The API returned an unexpected page. Expected page ${nextPage}, offset ${expectedOffset}, and ${SEARCH_PAGE_SIZE} results per page.`,
        );
        return;
      }

      if (!data.hits.length) {
        setToast("No more icons were returned.");
        setPage(data.page);
        setTotal(data.totalHits);
        setTotalPages(data.totalPages);
        return;
      }

      setResults((current) => mergeUniqueHits(current, data.hits));
      setTotal(data.totalHits);
      setPage(data.page);
      setTotalPages(data.totalPages);
      if (data.usedBackup)
        setToast(
          "Primary API key is rate-limited. Search continued with the backup key.",
        );
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setToast(
        error instanceof Error ? error.message : "Unable to load more icons.",
      );
    } finally {
      if (generation === requestGeneration.current) setPageLoading(false);
    }
  }

  function saveSettings() {
    const primaryKey = draftPrimaryKey.trim();
    const backupKey = draftBackupKey.trim();

    try {
      if (primaryKey) localStorage.setItem(PRIMARY_KEY, primaryKey);
      else localStorage.removeItem(PRIMARY_KEY);
      if (backupKey) localStorage.setItem(BACKUP_KEY, backupKey);
      else localStorage.removeItem(BACKUP_KEY);
      localStorage.setItem(DEFAULT_FORMAT_KEY, draftDefaultFormat);
      localStorage.removeItem(LEGACY_SEARCH_KEY);
      localStorage.removeItem(LEGACY_DOWNLOAD_KEY);
      setPrimaryApiKey(primaryKey);
      setBackupApiKey(backupKey);
      setDefaultFormat(draftDefaultFormat);
      clearSearchCache();
      requestGeneration.current += 1;
      setLoading(false);
      setPageLoading(false);
      setSettingsOpen(false);
      setToast("Settings saved locally in this browser.");
    } catch {
      setToast("Unable to save settings in this browser.");
    }
  }

  function removeKeys() {
    try {
      localStorage.removeItem(PRIMARY_KEY);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(LEGACY_SEARCH_KEY);
      localStorage.removeItem(LEGACY_DOWNLOAD_KEY);
    } catch {}
    setPrimaryApiKey("");
    setBackupApiKey("");
    setDraftPrimaryKey("");
    setDraftBackupKey("");
    clearSearchCache();
    requestGeneration.current += 1;
    setLoading(false);
    setPageLoading(false);
    setSettingsOpen(true);
    setToast("Both API keys were removed from this browser.");
  }

  function safeCreditUrl(value?: string): value is string {
    if (!value) return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  async function openPreview(hit: IconHit) {
    // macOSicons publishes a dedicated low-resolution PNG for the page preview.
    // Use that when available so the preview matches the source page exactly.
    const sourceUrl = hit.lowResPngUrl || hit.icnsUrl;
    if (!sourceUrl)
      return setToast("This result has no downloadable icon asset.");

    const previousUrl = preview?.url;
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    const generation = ++previewGeneration.current;
    setPreview({ hit, loading: true });

    try {
      let url: string;
      if (hit.lowResPngUrl) {
        const asset = await fetchImageAsset(hit.lowResPngUrl);
        url = URL.createObjectURL(
          new Blob([asset.buffer], { type: asset.mimeType }),
        );
      } else {
        const buffer = await fetchIcns(hit.icnsUrl!);
        url = await previewUrl(buffer);
      }

      if (generation !== previewGeneration.current) {
        URL.revokeObjectURL(url);
        return;
      }

      setPreview({ hit, url, loading: false });
    } catch (error) {
      if (generation !== previewGeneration.current) return;
      setPreview({ hit, loading: false });
      setToast(
        error instanceof Error ? error.message : "Unable to preview the icon.",
      );
    }
  }

  async function downloadIcon(hit: IconHit, format: Format, index: number) {
    const sourceUrl = hit.icnsUrl || hit.lowResPngUrl;
    if (!sourceUrl)
      return setToast("This result has no downloadable icon asset.");

    const id = hitId(hit, index);
    setBusyId(`${id}::${format}`);
    try {
      const blob = hit.icnsUrl
        ? format === "ico"
          ? await icnsToIco(await fetchIcns(hit.icnsUrl))
          : await icnsToPng(await fetchIcns(hit.icnsUrl))
        : format === "ico"
          ? await (async () => {
              const asset = await fetchImageAsset(hit.lowResPngUrl!);
              return imageToIco(asset.buffer, asset.mimeType);
            })()
          : await (async () => {
              const asset = await fetchImageAsset(hit.lowResPngUrl!);
              return imageToPng(asset.buffer, asset.mimeType);
            })();
      download(blob, filename(hit.appName, format));
      setToast(`${hit.appName} downloaded as ${format.toUpperCase()}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusyId(null);
    }
  }

  function selectedHits(): IconHit[] {
    return results.filter((hit, index) => selectedIds.has(hitId(hit, index)));
  }

  function imageUrlForExport(hit: IconHit): string | undefined {
    return hit.lowResPngUrl || hit.icnsUrl;
  }

  function downloadSelectedUrls() {
    const selected = selectedHits();
    if (!selected.length) return setToast("Select at least one icon first.");

    const urls = selected
      .map(imageUrlForExport)
      .filter((url): url is string => Boolean(url));

    if (urls.length !== selected.length) {
      return setToast("One or more selected icons has no image URL to export.");
    }

    const text = urls.join("\n") + "\n";
    download(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      `icon-urls-${new Date().toISOString().slice(0, 10)}.txt`,
    );
    setToast(`Exported ${urls.length} selected icon URL(s) as TXT.`);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected =
      results.length > 0 &&
      results.every((hit, index) => selectedIds.has(hitId(hit, index)));
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(results.map((hit, index) => hitId(hit, index))));
  }

  function uniqueZipFilename(name: string, used: Set<string>): string {
    const key = (value: string) => value.toLocaleLowerCase("en-US");
    if (!used.has(key(name))) {
      used.add(key(name));
      return name;
    }
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : "";
    let suffix = 2;
    let candidate = `${base} (${suffix})${extension}`;
    while (used.has(key(candidate))) {
      suffix += 1;
      candidate = `${base} (${suffix})${extension}`;
    }
    used.add(key(candidate));
    return candidate;
  }

  async function downloadSelected() {
    const selected = results.filter((hit, index) =>
      selectedIds.has(hitId(hit, index)),
    );
    if (!selected.length) return setToast("Select at least one icon first.");

    setBulkDownloading(true);
    setBulkProgress(0);

    try {
      const files: { name: string; blob: Blob }[] = [];
      const usedNames = new Set<string>();
      const failedNames: string[] = [];

      for (let index = 0; index < selected.length; index += 1) {
        const hit = selected[index];
        const format = defaultFormat;
        try {
          const sourceUrl = hit.icnsUrl || hit.lowResPngUrl;
          if (!sourceUrl) throw new Error("No downloadable asset.");
          const blob = hit.icnsUrl
            ? format === "ico"
              ? await icnsToIco(await fetchIcns(hit.icnsUrl))
              : await icnsToPng(await fetchIcns(hit.icnsUrl))
            : format === "ico"
              ? await (async () => {
                  const asset = await fetchImageAsset(hit.lowResPngUrl!);
                  return imageToIco(asset.buffer, asset.mimeType);
                })()
              : await (async () => {
                  const asset = await fetchImageAsset(hit.lowResPngUrl!);
                  return imageToPng(asset.buffer, asset.mimeType);
                })();
          files.push({
            name: uniqueZipFilename(filename(hit.appName, format), usedNames),
            blob,
          });
        } catch {
          failedNames.push(hit.appName);
        }
        setBulkProgress(index + 1);
      }

      if (!files.length) {
        setToast(
          `No icons could be downloaded. Failed: ${failedNames.join(", ")}`,
        );
        return;
      }

      const archive = await zipFiles(files);
      download(
        archive,
        `iconflow-icons-${new Date().toISOString().slice(0, 10)}.zip`,
      );
      if (!failedNames.length) setSelectedIds(new Set());
      setToast(
        failedNames.length
          ? `Downloaded ${files.length} icon(s). Failed: ${failedNames.join(", ")}. Failed selections were kept for retry.`
          : `Downloaded ${files.length} icon(s) as one ZIP file.`,
      );
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Bulk download failed.",
      );
    } finally {
      setBulkDownloading(false);
      setBulkProgress(0);
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar glass">
        <button
          className="brand"
          disabled={importLoading}
          onClick={() => {
            requestGeneration.current += 1;
            setLoading(false);
            setPageLoading(false);
            setQuery("");
            setActiveQuery("");
            setResults([]);
            setTotal(0);
            setPage(1);
            setTotalPages(1);
          }}
        >
          <span className="brand-mark">
            <IconMark />
          </span>
          <span>IconFlow</span>
        </button>
        <div className="top-actions">
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="settings-button"
            onClick={() => {
              setDraftPrimaryKey(primaryApiKey);
              setDraftBackupKey(backupApiKey);
              setDraftDefaultFormat(defaultFormat);
              setSettingsOpen(true);
            }}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="status-dot" /> Browser-native icon workflow
          </div>
          <h1>
            Find the icon.
            <br />
            <span>Make it yours.</span>
          </h1>
          <p>
            Search macOS icons in fixed 50-result pages, then preview or convert
            the original ICNS locally into PNG or Windows-ready ICO.
          </p>
          <div className="search-stack">
            <form
              className="search-panel glass"
              onSubmit={(event) => {
                event.preventDefault();
                void search();
              }}
            >
              <Search size={20} className="search-leading" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search macOS icons…"
                aria-label="Search macOS icons"
                maxLength={100}
              />
              <button
                className="search-submit"
                type="submit"
                disabled={loading || pageLoading || importLoading}
              >
                {loading ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Search size={18} />
                )}
                <span className="search-label">Search</span>
              </button>
            </form>
            <div className="import-actions">
              <button
                type="button"
                className="import-button glass"
                onClick={() => setImportOpen(true)}
                disabled={loading || pageLoading || importLoading}
              >
                <Download size={15} /> Import icons from URL or TXT
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".txt,text/plain"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void importFromFile(file);
                }}
              />
            </div>
          </div>
          <div className="hero-meta">
            <span>
              <ShieldCheck size={15} /> Primary + backup API keys, stored only
              in this browser
            </span>
            <span>
              <span className="kbd">Enter</span> to search
            </span>
          </div>
        </section>

        <section className="results-section">
          {results.length > 0 && (
            <div className="selection-bar glass">
              <button
                className="secondary-button"
                onClick={toggleSelectAll}
                disabled={bulkDownloading}
              >
                {results.length > 0 &&
                results.every((hit, index) =>
                  selectedIds.has(hitId(hit, index)),
                )
                  ? "Clear all"
                  : `Select all loaded (${results.length})`}
              </button>
              {selectedIds.size > 0 && (
                <>
                  <span>
                    {bulkDownloading
                      ? `Preparing ${bulkProgress}/${selectedIds.size}…`
                      : `${selectedIds.size} selected`}
                  </span>
                  <button
                    className="primary-button"
                    onClick={() => void downloadSelected()}
                    disabled={bulkDownloading || Boolean(busyId)}
                  >
                    {bulkDownloading ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Download size={16} />
                    )}
                    {bulkDownloading ? "Creating ZIP…" : "Download as ZIP"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={downloadSelectedUrls}
                    disabled={bulkDownloading || Boolean(busyId)}
                  >
                    <Link2 size={16} /> Download URLs as TXT
                  </button>
                </>
              )}
            </div>
          )}
          <div className="results-header">
            <div>
              <span className="section-kicker">
                {results.length ? "Search results" : "Explore"}
              </span>
              <h2>{results.length ? activeQuery : "Your icon shelf"}</h2>
            </div>
            {results.length > 0 && (
              <span className="result-count">
                {results.length.toLocaleString()} of {total.toLocaleString()}{" "}
                loaded
              </span>
            )}
          </div>

          {loading && !results.length ? (
            <div className="skeleton-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div className="skeleton-card glass" key={i} />
              ))}
            </div>
          ) : results.length ? (
            <>
              <div className="icon-grid">
                {results.map((hit, index) => {
                  const id = hitId(hit, index);
                  const imageUrl = isTrustedImageUrl(hit.lowResPngUrl)
                    ? hit.lowResPngUrl
                    : undefined;

                  return (
                    <article
                      className={`icon-card glass${selectedIds.has(id) ? " selected" : ""}`}
                      key={id}
                    >
                      <button
                        className="preview-button"
                        onClick={() => void openPreview(hit)}
                        aria-label={`Preview ${hit.appName}`}
                      >
                        <div className="icon-art">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <IconMark className="fallback-icon" />
                          )}
                        </div>
                        <span className="preview-hint">Preview ICNS</span>
                      </button>
                      <div className="card-body">
                        <div className="card-title-row">
                          <label className="select-icon">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(id)}
                              onChange={() => toggleSelected(id)}
                              aria-label={`Select ${hit.appName}`}
                            />
                            <span />
                          </label>
                          <div>
                            <h3 title={hit.appName}>{hit.appName}</h3>
                            <p>{hit.category || "macOS icon"}</p>
                          </div>
                        </div>
                        <div className="card-footer">
                          <span className="credit">
                            {safeCreditUrl(hit.creditUrl) ? (
                              <a
                                href={hit.creditUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {hit.credit || hit.uploadedBy || "Creator"}
                              </a>
                            ) : (
                              hit.credit || hit.uploadedBy || "macOSicons"
                            )}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalPages > page && (
                <div className="pagination glass">
                  <button
                    className="primary-button"
                    disabled={pageLoading || loading || importLoading}
                    onClick={() => void loadMore()}
                  >
                    {pageLoading ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                    {pageLoading
                      ? "Loading…"
                      : `Load more icons (${Math.min(SEARCH_PAGE_SIZE, Math.max(0, total - results.length))})`}
                  </button>
                  <span className="pagination-status">
                    Loaded {results.length.toLocaleString()} of{" "}
                    {total.toLocaleString()}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state glass">
              <div className="empty-icon">
                <IconMark />
              </div>
              <h3>Search 25,000+ macOS icons</h3>
              <p>
                Enter an app name above. The primary key is used for search
                first. If macOSicons rate-limits it, the backup key is used
                automatically. Preview and downloads fetch the original ICNS
                asset directly and do not consume search API requests.
              </p>
              <div className="suggestions">
                {["Safari", "Finder", "Terminal", "Spotify"].map((item) => (
                  <button key={item} onClick={() => setQuery(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>IconFlow</span>
        <span className="footer-version">v{packageJson.version}</span>
        <span>Icons and creator attribution provided by macOSicons.</span>
        <a
          href="https://macosicons.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          macOSicons <ExternalLink size={12} />
        </a>
        <a
          className="footer-github"
          href="https://github.com/nameIess/IconFlow"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="IconFlow on GitHub"
        >
          <GithubMark />
        </a>
      </footer>
      {toast && (
        <div className="toast glass" role="status">
          {toast}
        </div>
      )}

      {importOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !importLoading)
              setImportOpen(false);
          }}
        >
          <section
            className="settings-modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            tabIndex={-1}
          >
            <div className="modal-heading">
              <div>
                <span className="section-kicker">Import icons</span>
                <h2 id="import-title">URL or text file</h2>
              </div>
              <button
                className="icon-button"
                disabled={importLoading}
                onClick={() => setImportOpen(false)}
                aria-label="Close import"
              >
                <X size={18} />
              </button>
            </div>
            <p>
              Paste one macOSicons share URL or upload a .txt file. IconFlow
              reads the shared page, previews the actual icon, and lets you
              choose exactly which icons to download. No search API request is
              used for imports.
            </p>
            <label className="field-label" htmlFor="import-url">
              Icon URL
            </label>
            <div className="key-input">
              <ExternalLink size={17} />
              <input
                id="import-url"
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder="https://macosicons.com/?icon=Ic1LCu7E7f"
                disabled={importLoading}
              />
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                disabled={importLoading}
                onClick={() => importModalFileRef.current?.click()}
              >
                Choose .txt file
              </button>
              <input
                ref={importModalFileRef}
                type="file"
                accept=".txt,text/plain"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void importFromFile(file);
                }}
              />
              <button
                className="primary-button"
                disabled={importLoading || !importUrl.trim()}
                onClick={() => void importFromText()}
              >
                {importLoading ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Download size={15} />
                )}{" "}
                {importLoading ? "Importing…" : "Import URL"}
              </button>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="settings-modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            tabIndex={-1}
          >
            <div className="modal-heading">
              <div>
                <span className="section-kicker">Local configuration</span>
                <h2 id="settings-title">API access</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>
            <div className="key-card">
              <div className="key-icon">
                <KeyRound size={19} />
              </div>
              <div>
                <strong>Two-key security model</strong>
                <p>
                  The primary key handles search. If it is rate-limited, the
                  backup key handles the search request. Icon files are fetched
                  directly from their asset URL.
                </p>
              </div>
            </div>
            <label className="field-label" htmlFor="primary-key">
              Primary API key
            </label>
            <div className="key-input">
              <Search size={17} />
              <input
                id="primary-key"
                type="password"
                value={draftPrimaryKey}
                onChange={(event) => setDraftPrimaryKey(event.target.value)}
                autoComplete="off"
                placeholder="macOSicons primary key"
              />
            </div>
            <label className="field-label" htmlFor="backup-key">
              Backup API key
            </label>
            <div className="key-input">
              <Download size={17} />
              <input
                id="backup-key"
                type="password"
                value={draftBackupKey}
                onChange={(event) => setDraftBackupKey(event.target.value)}
                autoComplete="off"
                placeholder="macOSicons backup key"
              />
            </div>
            <div className="download-preference">
              <span className="field-label">Default download format</span>
              <div
                className="format-options"
                role="group"
                aria-label="Default download format"
              >
                {(["ico", "png"] as Format[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      draftDefaultFormat === option
                        ? "format-option active"
                        : "format-option"
                    }
                    aria-pressed={draftDefaultFormat === option}
                    onClick={() => setDraftDefaultFormat(option)}
                  >
                    <strong>{option.toUpperCase()}</strong>
                    <span>
                      {option === "ico" ? "Windows icon" : "Portable image"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="modal-footnote">
                Used for preview downloads and ZIP downloads. ICO is the default
                unless you change it.
              </p>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={16} /> Keys and download preference are stored
              locally in this browser.
            </div>
            <div className="modal-actions">
              {(primaryApiKey || backupApiKey) && (
                <button className="danger-button" onClick={removeKeys}>
                  <Trash2 size={15} /> Remove keys
                </button>
              )}
              <button
                className="secondary-button"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={saveSettings}>
                Save settings
              </button>
            </div>
            <p className="modal-footnote">
              Never put API keys in source code, public issues, screenshots, or
              chat messages.
            </p>
          </section>
        </div>
      )}

      {preview && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              previewGeneration.current += 1;
              setPreview(null);
            }
          }}
        >
          <section
            className="preview-modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            tabIndex={-1}
          >
            <div className="modal-heading">
              <div>
                <span className="section-kicker">Original ICNS</span>
                <h2 id="preview-title">{preview.hit.appName}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  previewGeneration.current += 1;
                  setPreview(null);
                }}
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="large-preview">
              {preview.loading ? (
                <LoaderCircle className="spin" size={28} />
              ) : preview.url ? (
                <img src={preview.url} alt={preview.hit.appName} />
              ) : (
                <IconMark className="preview-fallback-icon" />
              )}
            </div>
            <div className="creator-line">
              <span>
                {preview.hit.credit || preview.hit.uploadedBy || "macOSicons"}
              </span>
              {safeCreditUrl(preview.hit.creditUrl) && (
                <a
                  href={preview.hit.creditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Creator <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className="preview-actions">
              {(["ico", "png"] as Format[]).map((format) => (
                <button
                  key={format}
                  className={
                    format === defaultFormat
                      ? "primary-button preview-download"
                      : "secondary-button preview-download"
                  }
                  disabled={
                    preview.loading ||
                    Boolean(
                      busyId?.startsWith(
                        `${hitId(preview.hit, Math.max(0, results.indexOf(preview.hit)))}::`,
                      ),
                    )
                  }
                  onClick={() =>
                    void downloadIcon(
                      preview.hit,
                      format,
                      Math.max(0, results.indexOf(preview.hit)),
                    )
                  }
                >
                  {busyId ===
                  `${hitId(preview.hit, Math.max(0, results.indexOf(preview.hit)))}::${format}` ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  Download {format.toUpperCase()}
                  {format === defaultFormat ? " · Default" : ""}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
