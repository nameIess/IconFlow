import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, ExternalLink, FileText, KeyRound, Link2, LoaderCircle, Moon, Search, Settings, ShieldCheck, Sun, Trash2, Upload, X } from "lucide-react";
import { clearSearchCache, fetchIcns, importIconUrls, isTrustedImageUrl, MAX_IMPORT_URLS, parseIconImportUrls, searchIcons, SEARCH_PAGE_SIZE, type IconHit } from "./api";
import { download, filename, icnsToIco, icnsToPng, previewUrl } from "./converter";

type Format = "png" | "ico";
const PRIMARY_KEY = "iconflow.primaryApiKey";
const BACKUP_KEY = "iconflow.backupApiKey";
const LEGACY_SEARCH_KEY = "iconflow.searchApiKey";
const LEGACY_DOWNLOAD_KEY = "iconflow.downloadApiKey";
const THEME_KEY = "iconflow.theme";

function stored(key: string): string {
  try { return localStorage.getItem(key)?.trim() || ""; } catch { return ""; }
}

function storedWithLegacy(key: string, legacyKey: string): string {
  const current = stored(key);
  if (current) return current;
  const legacy = stored(legacyKey);
  if (legacy) {
    try { localStorage.setItem(key, legacy); } catch {}
  }
  return legacy;
}

function IconMark({ className = "" }: { className?: string }) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />;
}

function hitId(hit: IconHit, index = 0): string {
  return hit.objectID || hit.icnsUrl || `${hit.appName}-${index}`;
}

function mergeUniqueHits(current: IconHit[], next: IconHit[]): IconHit[] {
  const seen = new Set<string>();
  const merged: IconHit[] = [];

  for (const hit of [...current, ...next]) {
    const id = hit.objectID || hit.icnsUrl || `${hit.appName}-${merged.length}`;
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(hit);
  }

  return merged;
}

function App() {
  const [primaryApiKey, setPrimaryApiKey] = useState(() => storedWithLegacy(PRIMARY_KEY, LEGACY_SEARCH_KEY));
  const [backupApiKey, setBackupApiKey] = useState(() => storedWithLegacy(BACKUP_KEY, LEGACY_DOWNLOAD_KEY));
  const [draftPrimaryKey, setDraftPrimaryKey] = useState(() => storedWithLegacy(PRIMARY_KEY, LEGACY_SEARCH_KEY));
  const [draftBackupKey, setDraftBackupKey] = useState(() => storedWithLegacy(BACKUP_KEY, LEGACY_DOWNLOAD_KEY));
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<IconHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => !storedWithLegacy(PRIMARY_KEY, LEGACY_SEARCH_KEY));
  const [formatById, setFormatById] = useState<Record<string, Format>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ hit: IconHit; url?: string; loading: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => stored(THEME_KEY) === "light" ? "light" : "dark");
  const requestGeneration = useRef(0);
  const previewGeneration = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (menuId === null) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".format-menu")) setMenuId(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuId(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuId]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  function applyResponse(data: Awaited<ReturnType<typeof searchIcons>>, searchValue: string) {
    setResults(data.hits);
    setTotal(data.totalHits);
    setPage(data.page);
    setTotalPages(data.totalPages);
    setActiveQuery(searchValue);
    setFormatById({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  async function applyImportedUrls(urls: string[], sourceLabel: string) {
    if (!urls.length) return setToast("No supported macOSicons or ICNS URLs found.");
    if (!primaryApiKey) return setSettingsOpen(true);

    const generation = ++requestGeneration.current;
    setImportLoading(true);
    setMenuId(null);

    try {
      const data = await importIconUrls(primaryApiKey, backupApiKey, urls);
      if (generation !== requestGeneration.current) return;

      const imported = mergeUniqueHits([], data.hits);
      setResults(imported);
      setTotal(imported.length);
      setPage(1);
      setTotalPages(1);
      setActiveQuery(`Imported from ${sourceLabel}`);
      setFormatById({});
      setImportOpen(false);
      setImportUrl("");
      if (data.usedBackup) setToast(`Imported ${imported.length} icon(s). Primary API key was rate-limited; backup was used.`);
      else if (data.failed.length) setToast(`Imported ${imported.length} icon(s); ${data.failed.length} link(s) could not be resolved.`);
      else setToast(`Imported ${imported.length} icon(s).`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setToast(error instanceof Error ? error.message : "Icon import failed.");
    } finally {
      if (generation === requestGeneration.current) setImportLoading(false);
    }
  }

  async function importFromUrl() {
    const { urls } = parseIconImportUrls(importUrl);
    if (!urls.length) return setToast("Paste a macOSicons icon URL or a direct .icns URL.");
    await applyImportedUrls(urls, "URL");
  }

  async function importFromFile(file: File) {
    if (file.size > 2 * 1024 * 1024) return setToast("Text files are limited to 2 MB.");
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") return setToast("Choose a .txt file containing icon URLs.");

    try {
      const text = await file.text();
      const { urls } = parseIconImportUrls(text);
      await applyImportedUrls(urls, file.name);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to read the text file.");
    }
  }

  async function search() {
    const value = query.trim();
    if (!value) return setToast("Enter an icon name to search.");
    if (!primaryApiKey) return setSettingsOpen(true);

    const generation = ++requestGeneration.current;
    setLoading(true);
    setMenuId(null);

    try {
      const data = await searchIcons(primaryApiKey, backupApiKey, value, 1);
      if (generation !== requestGeneration.current) return;

      applyResponse(data, value);
      if (data.usedBackup) setToast("Primary API key is rate-limited. Search continued with the backup key.");
      else if (!data.hits.length) setToast("No icons found. Try another search.");
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setToast(error instanceof Error ? error.message : "Search failed.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }

  async function loadMore() {
    if (loading || pageLoading || !activeQuery || page >= totalPages) return;

    const generation = ++requestGeneration.current;
    const nextPage = page + 1;
    setPageLoading(true);
    setMenuId(null);

    try {
      const data = await searchIcons(primaryApiKey, backupApiKey, activeQuery, nextPage);
      if (generation !== requestGeneration.current) return;

      const expectedOffset = (nextPage - 1) * SEARCH_PAGE_SIZE;
      if (data.page !== nextPage || data.offset !== expectedOffset || data.hitsPerPage !== SEARCH_PAGE_SIZE) {
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
      if (data.usedBackup) setToast("Primary API key is rate-limited. Search continued with the backup key.");
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setToast(error instanceof Error ? error.message : "Unable to load more icons.");
    } finally {
      if (generation === requestGeneration.current) setPageLoading(false);
    }
  }

  function saveSettings() {
    const primaryKey = draftPrimaryKey.trim();
    const backupKey = draftBackupKey.trim();

    try {
      if (primaryKey) localStorage.setItem(PRIMARY_KEY, primaryKey); else localStorage.removeItem(PRIMARY_KEY);
      if (backupKey) localStorage.setItem(BACKUP_KEY, backupKey); else localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(LEGACY_SEARCH_KEY);
      localStorage.removeItem(LEGACY_DOWNLOAD_KEY);
      setPrimaryApiKey(primaryKey);
      setBackupApiKey(backupKey);
      clearSearchCache();
      requestGeneration.current += 1;
      setLoading(false);
      setPageLoading(false);
      setSettingsOpen(false);
      setToast("API keys saved locally in this browser.");
    } catch {
      setToast("Unable to save API keys in this browser.");
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
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }

  async function openPreview(hit: IconHit) {
    if (!hit.icnsUrl) return setToast("This result has no original ICNS asset.");

    const previousUrl = preview?.url;
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    const generation = ++previewGeneration.current;
    setPreview({ hit, loading: true });

    try {
      const buffer = await fetchIcns(hit.icnsUrl);
      if (generation !== previewGeneration.current) return;

      const url = await previewUrl(buffer);
      if (generation !== previewGeneration.current) {
        URL.revokeObjectURL(url);
        return;
      }

      setPreview({ hit, url, loading: false });
    } catch (error) {
      if (generation !== previewGeneration.current) return;
      setPreview({ hit, loading: false });
      setToast(error instanceof Error ? error.message : "Unable to preview the icon.");
    }
  }

  async function downloadIcon(hit: IconHit, format: Format) {
    if (!hit.icnsUrl) return setToast("This result has no original ICNS asset.");

    const id = hit.objectID || hit.icnsUrl || hit.appName;
    setBusyId(id);
    setMenuId(null);
    try {
      const buffer = await fetchIcns(hit.icnsUrl);
      const blob = format === "ico" ? await icnsToIco(buffer) : await icnsToPng(buffer);
      download(blob, filename(hit.appName, format));
      setToast(`${hit.appName} downloaded as ${format.toUpperCase()}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />

      <header className="topbar glass">
        <button className="brand" onClick={() => { requestGeneration.current += 1; setLoading(false); setPageLoading(false); setQuery(""); setActiveQuery(""); setResults([]); setTotal(0); setPage(1); setTotalPages(1); }}>
          <span className="brand-mark"><IconMark /></span><span>IconFlow</span>
        </button>
        <div className="top-actions">
          <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="settings-button" onClick={() => { setDraftPrimaryKey(primaryApiKey); setDraftBackupKey(backupApiKey); setSettingsOpen(true); }}><Settings size={16} /><span>Settings</span></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow"><span className="status-dot" /> Browser-native icon workflow</div>
          <h1>Find the icon.<br /><span>Make it yours.</span></h1>
          <p>Search macOS icons in fixed 50-result pages, then preview or convert the original ICNS locally into PNG or Windows-ready ICO.</p>
          <div className="search-stack">
            <form className="search-panel glass" onSubmit={(event) => { event.preventDefault(); void search(); }}>
              <Search size={20} className="search-leading" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search macOS icons…" aria-label="Search macOS icons" maxLength={100} />
              <button className="search-submit" type="submit" disabled={loading || pageLoading || importLoading}>{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}<span className="search-label">Search</span></button>
            </form>
            <div className="import-actions">
              <button type="button" className="import-button glass" onClick={() => setImportOpen(true)} disabled={loading || pageLoading || importLoading}><Link2 size={15} /> Import icon URL</button>
              <button type="button" className="import-button glass" onClick={() => fileInputRef.current?.click()} disabled={loading || pageLoading || importLoading}><Upload size={15} /> Import .txt file</button>
              <input ref={fileInputRef} type="file" accept=".txt,text/plain" hidden onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void importFromFile(file); }} />
            </div>
          </div>
          <div className="hero-meta"><span><ShieldCheck size={15} /> Primary + backup API keys, stored only in this browser</span><span><span className="kbd">Enter</span> to search</span></div>
        </section>

        <section className="results-section">
          <div className="results-header">
            <div><span className="section-kicker">{results.length ? "Search results" : "Explore"}</span><h2>{results.length ? activeQuery : "Your icon shelf"}</h2></div>
            {results.length > 0 && <span className="result-count">{results.length.toLocaleString()} of {total.toLocaleString()} loaded</span>}
          </div>

          {loading && !results.length ? (
            <div className="skeleton-grid">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card glass" key={i} />)}</div>
          ) : results.length ? (
            <>
              <div className="icon-grid">
                {results.map((hit, index) => {
                  const id = hitId(hit, index);
                  const format = formatById[id] || "ico";
                  const busy = busyId === id;
                  const imageUrl = isTrustedImageUrl(hit.lowResPngUrl) ? hit.lowResPngUrl : undefined;

                  return (
                    <article className="icon-card glass" key={id}>
                      <button className="preview-button" onClick={() => void openPreview(hit)} aria-label={`Preview ${hit.appName}`}>
                        <div className="icon-art">{imageUrl ? <img src={imageUrl} alt="" loading="lazy" decoding="async" /> : <IconMark className="fallback-icon" />}</div>
                        <span className="preview-hint">Preview ICNS</span>
                      </button>
                      <div className="card-body">
                        <div className="card-title-row">
                          <div><h3 title={hit.appName}>{hit.appName}</h3><p>{hit.category || "macOS icon"}</p></div>
                          <div className="format-menu">
                            <button className="small-button" onClick={() => setMenuId(menuId === id ? null : id)}>{format.toUpperCase()} <ChevronDown size={13} /></button>
                            {menuId === id && <div className="dropdown glass">{(["png", "ico"] as Format[]).map((option) => <button key={option} onClick={() => { setFormatById((current) => ({ ...current, [id]: option })); setMenuId(null); }}>{option.toUpperCase()}</button>)}</div>}
                          </div>
                        </div>
                        <div className="card-footer">
                          <span className="credit">{safeCreditUrl(hit.creditUrl) ? <a href={hit.creditUrl} target="_blank" rel="noopener noreferrer">{hit.credit || hit.uploadedBy || "Creator"}</a> : (hit.credit || hit.uploadedBy || "macOSicons")}</span>
                          <button className="download-button" disabled={busy} onClick={() => void downloadIcon(hit, format)}>{busy ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}{busy ? "Working" : format.toUpperCase()}</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalPages > page && <div className="pagination glass">
                <button className="primary-button" disabled={pageLoading || loading} onClick={() => void loadMore()}>
                  {pageLoading ? <LoaderCircle className="spin" size={16} /> : <ChevronDown size={16} />}
                  {pageLoading ? "Loading…" : `Load more icons (${Math.min(SEARCH_PAGE_SIZE, Math.max(0, total - results.length))})`}
                </button>
                <span className="pagination-status">Loaded {results.length.toLocaleString()} of {total.toLocaleString()}</span>
              </div>}
            </>
          ) : (
            <div className="empty-state glass">
              <div className="empty-icon"><IconMark /></div><h3>Search 25,000+ macOS icons</h3>
              <p>Enter an app name above. The primary key is used for search first. If macOSicons rate-limits it, the backup key is used automatically. Preview and downloads fetch the original ICNS asset directly and do not consume search API requests.</p>
              <div className="suggestions">{["Safari", "Finder", "Terminal", "Spotify"].map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
            </div>
          )}
        </section>
      </main>

      <footer><span>IconFlow</span><span>Icons and creator attribution provided by macOSicons.</span><a href="https://macosicons.com" target="_blank" rel="noopener noreferrer">macOSicons <ExternalLink size={12} /></a></footer>
      {toast && <div className="toast glass" role="status">{toast}</div>}

      {importOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !importLoading) setImportOpen(false); }}>
        <section className="settings-modal glass" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <div className="modal-heading"><div><span className="section-kicker">Bulk import</span><h2 id="import-title">Import icon links</h2></div><button className="icon-button" onClick={() => setImportOpen(false)} disabled={importLoading} aria-label="Close import dialog"><X size={18} /></button></div>
          <div className="key-card"><div className="key-icon"><FileText size={19} /></div><div><strong>Paste a macOSicons URL</strong><p>Use a link like https://macosicons.com/?icon=MbqE4ORLrx, or paste a direct trusted .icns asset URL.</p></div></div>
          <label className="field-label" htmlFor="import-url">Icon URL</label>
          <div className="key-input"><Link2 size={17} /><input id="import-url" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} autoComplete="off" placeholder="https://macosicons.com/?icon=..." /></div>
          <div className="import-or">or upload a .txt file with one or more icon links</div>
          <div className="import-file-row"><button className="secondary-button" onClick={() => fileInputRef.current?.click()} disabled={importLoading}><Upload size={15} /> Choose .txt file</button><span>Up to {MAX_IMPORT_URLS} links</span></div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setImportOpen(false)} disabled={importLoading}>Cancel</button><button className="primary-button" onClick={() => void importFromUrl()} disabled={importLoading}>{importLoading ? <LoaderCircle className="spin" size={15} /> : <Link2 size={15} />} {importLoading ? "Importing…" : "Import links"}</button></div>
        </section>
      </div>}

      {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
        <section className="settings-modal glass" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="modal-heading"><div><span className="section-kicker">Local configuration</span><h2 id="settings-title">API access</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div>
          <div className="key-card"><div className="key-icon"><KeyRound size={19} /></div><div><strong>Two-key security model</strong><p>The primary key handles search. If it is rate-limited, the backup key handles the search request. Icon files are fetched directly from their asset URL.</p></div></div>
          <label className="field-label" htmlFor="primary-key">Primary API key</label>
          <div className="key-input"><Search size={17} /><input id="primary-key" type="password" value={draftPrimaryKey} onChange={(event) => setDraftPrimaryKey(event.target.value)} autoComplete="off" placeholder="macOSicons primary key" /></div>
          <label className="field-label" htmlFor="backup-key">Backup API key</label>
          <div className="key-input"><Download size={17} /><input id="backup-key" type="password" value={draftBackupKey} onChange={(event) => setDraftBackupKey(event.target.value)} autoComplete="off" placeholder="macOSicons backup key" /></div>
          <div className="privacy-note"><ShieldCheck size={16} /> Keys are stored locally in this browser and sent directly to macOSicons only when a search request is made.</div>
          <div className="modal-actions">{(primaryApiKey || backupApiKey) && <button className="danger-button" onClick={removeKeys}><Trash2 size={15} /> Remove keys</button>}<button className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={saveSettings}>Save keys</button></div>
          <p className="modal-footnote">Never put API keys in source code, public issues, screenshots, or chat messages.</p>
        </section>
      </div>}

      {preview && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { previewGeneration.current += 1; setPreview(null); } }}>
        <section className="preview-modal glass" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="modal-heading"><div><span className="section-kicker">Original ICNS</span><h2 id="preview-title">{preview.hit.appName}</h2></div><button className="icon-button" onClick={() => { previewGeneration.current += 1; setPreview(null); }} aria-label="Close preview"><X size={18} /></button></div>
          <div className="large-preview">{preview.loading ? <LoaderCircle className="spin" size={28} /> : preview.url ? <img src={preview.url} alt={preview.hit.appName} /> : <IconMark className="preview-fallback-icon" />}</div>
          <div className="creator-line"><span>{preview.hit.credit || preview.hit.uploadedBy || "macOSicons"}</span>{safeCreditUrl(preview.hit.creditUrl) && <a href={preview.hit.creditUrl} target="_blank" rel="noopener noreferrer">Creator <ExternalLink size={12} /></a>}</div>
        </section>
      </div>}
    </div>
  );
}

export default App;
