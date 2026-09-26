import { useEffect, useState } from "react";
import { ChevronDown, Download, ExternalLink, KeyRound, LoaderCircle, Moon, Search, Settings, ShieldCheck, Sun, Trash2, X } from "lucide-react";
import { clearSearchCache, fetchIcns, searchIcons, SEARCH_PAGE_SIZE, type IconHit } from "./api";
import { download, filename, icnsToIco, icnsToPng, previewUrl } from "./converter";

type Format = "png" | "ico";
const SEARCH_KEY = "iconflow.searchApiKey";
const DOWNLOAD_KEY = "iconflow.downloadApiKey";
const THEME_KEY = "iconflow.theme";

function stored(key: string): string {
  try { return localStorage.getItem(key)?.trim() || ""; } catch { return ""; }
}

function IconMark({ className = "" }: { className?: string }) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />;
}

function App() {
  const [searchApiKey, setSearchApiKey] = useState(() => stored(SEARCH_KEY));
  const [downloadApiKey, setDownloadApiKey] = useState(() => stored(DOWNLOAD_KEY));
  const [draftSearchKey, setDraftSearchKey] = useState(() => stored(SEARCH_KEY));
  const [draftDownloadKey, setDraftDownloadKey] = useState(() => stored(DOWNLOAD_KEY));
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<IconHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => !stored(SEARCH_KEY) || !stored(DOWNLOAD_KEY));
  const [formatById, setFormatById] = useState<Record<string, Format>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ hit: IconHit; url?: string; loading: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() => stored(THEME_KEY) === "light" ? "light" : "dark");

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

  function applyResponse(data: Awaited<ReturnType<typeof searchIcons>>) {
    setResults(data.hits);
    setTotal(data.totalHits);
    setPage(data.page);
    setTotalPages(data.totalPages);
    setFormatById({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function search() {
    const value = query.trim();
    if (!value) return setToast("Enter an icon name to search.");
    if (!searchApiKey) return setSettingsOpen(true);

    setLoading(true);
    setActiveQuery(value);
    setResults([]);
    setPage(1);
    setTotal(0);
    setTotalPages(1);
    setMenuId(null);

    try {
      const data = await searchIcons(searchApiKey, value, 1);
      if (data.page !== 1 || data.offset !== 0 || data.hitsPerPage !== SEARCH_PAGE_SIZE) {
        throw new Error("The search API did not return the required 50-result first page.");
      }
      applyResponse(data);
      if (!data.hits.length) setToast("No icons found. Try another search.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function goToPage(nextPage: number) {
    if (loading || pageLoading || !activeQuery || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPageLoading(true);
    setMenuId(null);

    try {
      const data = await searchIcons(searchApiKey, activeQuery, nextPage);
      const expectedOffset = (nextPage - 1) * SEARCH_PAGE_SIZE;

      if (data.page !== nextPage || data.offset !== expectedOffset || data.hitsPerPage !== SEARCH_PAGE_SIZE) {
        setToast("The API returned an unexpected page. Current icons were kept and no retry was made.");
        return;
      }

      applyResponse(data);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to load that page.");
    } finally {
      setPageLoading(false);
    }
  }

  function saveSettings() {
    const searchKey = draftSearchKey.trim();
    const downloadKey = draftDownloadKey.trim();

    try {
      if (searchKey) localStorage.setItem(SEARCH_KEY, searchKey); else localStorage.removeItem(SEARCH_KEY);
      if (downloadKey) localStorage.setItem(DOWNLOAD_KEY, downloadKey); else localStorage.removeItem(DOWNLOAD_KEY);
      setSearchApiKey(searchKey);
      setDownloadApiKey(downloadKey);
      setSettingsOpen(false);
      setToast("API keys saved locally in this browser.");
    } catch {
      setToast("Unable to save API keys in this browser.");
    }
  }

  function removeKeys() {
    try { localStorage.removeItem(SEARCH_KEY); localStorage.removeItem(DOWNLOAD_KEY); } catch {}
    setSearchApiKey("");
    setDownloadApiKey("");
    setDraftSearchKey("");
    setDraftDownloadKey("");
    clearSearchCache();
    setSettingsOpen(true);
    setToast("Both API keys were removed from this browser.");
  }

  function safeCreditUrl(value?: string): value is string {
    if (!value) return false;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }

  async function openPreview(hit: IconHit) {
    if (!hit.icnsUrl) return setToast("This result has no original ICNS asset.");
    if (!downloadApiKey) return setSettingsOpen(true);
    setPreview({ hit, loading: true });
    try {
      const buffer = await fetchIcns(hit.icnsUrl, downloadApiKey);
      setPreview({ hit, url: await previewUrl(buffer), loading: false });
    } catch (error) {
      setPreview({ hit, loading: false });
      setToast(error instanceof Error ? error.message : "Unable to preview the icon.");
    }
  }

  async function downloadIcon(hit: IconHit, format: Format) {
    if (!hit.icnsUrl) return setToast("This result has no original ICNS asset.");
    if (!downloadApiKey) return setSettingsOpen(true);

    const id = hit.objectID || hit.icnsUrl || hit.appName;
    setBusyId(id);
    setMenuId(null);
    try {
      const buffer = await fetchIcns(hit.icnsUrl, downloadApiKey);
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
        <button className="brand" onClick={() => { setQuery(""); setActiveQuery(""); setResults([]); setTotal(0); setPage(1); setTotalPages(1); }}>
          <span className="brand-mark"><IconMark /></span><span>IconFlow</span>
        </button>
        <div className="top-actions">
          <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="settings-button" onClick={() => { setDraftSearchKey(searchApiKey); setDraftDownloadKey(downloadApiKey); setSettingsOpen(true); }}><Settings size={16} /><span>Settings</span></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow"><span className="status-dot" /> Browser-native icon workflow</div>
          <h1>Find the icon.<br /><span>Make it yours.</span></h1>
          <p>Search macOS icons in fixed 50-result pages, then preview or convert the original ICNS locally into PNG or Windows-ready ICO.</p>
          <form className="search-panel glass" onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <Search size={20} className="search-leading" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search macOS icons…" aria-label="Search macOS icons" maxLength={100} />
            <button className="search-submit" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}<span className="search-label">Search</span></button>
          </form>
          <div className="hero-meta"><span><ShieldCheck size={15} /> Two separate API keys, stored only in this browser</span><span><span className="kbd">Enter</span> to search</span></div>
        </section>

        <section className="results-section">
          <div className="results-header">
            <div><span className="section-kicker">{results.length ? "Search results" : "Explore"}</span><h2>{results.length ? activeQuery : "Your icon shelf"}</h2></div>
            {results.length > 0 && <span className="result-count">{((page - 1) * SEARCH_PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * SEARCH_PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}</span>}
          </div>

          {loading ? (
            <div className="skeleton-grid">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card glass" key={i} />)}</div>
          ) : results.length ? (
            <>
              <div className="icon-grid">
                {results.map((hit, index) => {
                  const id = hit.objectID || hit.icnsUrl || `${hit.appName}-${index}`;
                  const format = formatById[id] || "ico";
                  const busy = busyId === id;
                  return (
                    <article className="icon-card glass" key={id}>
                      <button className="preview-button" onClick={() => void openPreview(hit)} aria-label={`Preview ${hit.appName}`}>
                        <div className="icon-art">{hit.lowResPngUrl ? <img src={hit.lowResPngUrl} alt="" loading="lazy" /> : <IconMark className="fallback-icon" />}</div>
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

              {totalPages > 1 && <nav className="pagination glass" aria-label="Search result pages">
                <button className="secondary-button" disabled={pageLoading || page <= 1} onClick={() => void goToPage(page - 1)}>Previous</button>
                <span className="pagination-status">{pageLoading && <LoaderCircle className="spin" size={16} />} Page {page} of {totalPages}</span>
                <button className="secondary-button" disabled={pageLoading || page >= totalPages} onClick={() => void goToPage(page + 1)}>Next</button>
              </nav>}
            </>
          ) : (
            <div className="empty-state glass">
              <div className="empty-icon"><IconMark /></div><h3>Search 25,000+ macOS icons</h3>
              <p>Enter an app name above. The search key is used only for search; the download key is used only for original ICNS preview and downloads.</p>
              <div className="suggestions">{["Safari", "Finder", "Terminal", "Spotify"].map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
            </div>
          )}
        </section>
      </main>

      <footer><span>IconFlow</span><span>Icons and creator attribution provided by macOSicons.</span><a href="https://macosicons.com" target="_blank" rel="noopener noreferrer">macOSicons <ExternalLink size={12} /></a></footer>
      {toast && <div className="toast glass" role="status">{toast}</div>}

      {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
        <section className="settings-modal glass" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="modal-heading"><div><span className="section-kicker">Local configuration</span><h2 id="settings-title">API access</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div>
          <div className="key-card"><div className="key-icon"><KeyRound size={19} /></div><div><strong>Two-key security model</strong><p>Search and original-file requests use different keys. Neither key is sent to an IconFlow server.</p></div></div>
          <label className="field-label" htmlFor="search-key">Search API key</label>
          <div className="key-input"><Search size={17} /><input id="search-key" type="password" value={draftSearchKey} onChange={(event) => setDraftSearchKey(event.target.value)} autoComplete="off" placeholder="macOSicons search key" /></div>
          <label className="field-label" htmlFor="download-key">Download API key</label>
          <div className="key-input"><Download size={17} /><input id="download-key" type="password" value={draftDownloadKey} onChange={(event) => setDraftDownloadKey(event.target.value)} autoComplete="off" placeholder="macOSicons download key" /></div>
          <div className="privacy-note"><ShieldCheck size={16} /> Keys are stored locally and sent directly to macOSicons.</div>
          <div className="modal-actions">{(searchApiKey || downloadApiKey) && <button className="danger-button" onClick={removeKeys}><Trash2 size={15} /> Remove keys</button>}<button className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={saveSettings}>Save keys</button></div>
          <p className="modal-footnote">Never put API keys in source code, public issues, screenshots, or chat messages.</p>
        </section>
      </div>}

      {preview && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
        <section className="preview-modal glass" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="modal-heading"><div><span className="section-kicker">Original ICNS</span><h2 id="preview-title">{preview.hit.appName}</h2></div><button className="icon-button" onClick={() => setPreview(null)} aria-label="Close preview"><X size={18} /></button></div>
          <div className="large-preview">{preview.loading ? <LoaderCircle className="spin" size={28} /> : preview.url ? <img src={preview.url} alt={preview.hit.appName} /> : <IconMark className="preview-fallback-icon" />}</div>
          <div className="creator-line"><span>{preview.hit.credit || preview.hit.uploadedBy || "macOSicons"}</span>{safeCreditUrl(preview.hit.creditUrl) && <a href={preview.hit.creditUrl} target="_blank" rel="noopener noreferrer">Creator <ExternalLink size={12} /></a>}</div>
        </section>
      </div>}
    </div>
  );
}

export default App;
