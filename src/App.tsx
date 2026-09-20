import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { fetchIcns, searchIcons, SEARCH_PAGE_SIZE, testApiKey, type IconHit } from "./api";
import { download, filename, icnsToIco, icnsToPng, previewUrl } from "./converter";

type Format = "png" | "ico";

const KEY = "iconflow.apiKey";
const THEME = "iconflow.theme";

function getStoredKey(): string {
  try {
    return localStorage.getItem(KEY)?.trim() || "";
  } catch {
    return "";
  }
}

function IconMark({ className = "" }: { className?: string }) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />;
}

function App() {
  const [apiKey, setApiKeyState] = useState(getStoredKey);
  const [draftKey, setDraftKey] = useState(getStoredKey);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<IconHit[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null);
  const searchRequestId = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(!getStoredKey());
  const [testing, setTesting] = useState(false);
  const [format, setFormat] = useState<Format>("ico");
  const [menu, setMenu] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState<{ hit: IconHit; url?: string; loading: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return localStorage.getItem(THEME) === "light" ? "light" : "dark"; } catch { return "dark"; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME, theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function search() {
    const value = query.trim();
    if (!value) return;
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }

    const requestId = ++searchRequestId.current;
    setLoading(true);
    setLoadingMore(false);
    setActiveQuery(value);
    setResults([]);
    setCurrentPage(0);
    setTotalPages(1);

    try {
      const data = await searchIcons(apiKey, value, SEARCH_PAGE_SIZE, 1);
      if (requestId !== searchRequestId.current) return;
      setResults(data.hits || []);
      setTotal(data.totalHits || data.hits?.length || 0);
      setCurrentPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      if (!data.hits?.length) setToast("No icons found. Try another search.");
    } catch (error) {
      if (requestId === searchRequestId.current) {
        setToast(error instanceof Error ? error.message : "Search failed.");
      }
    } finally {
      if (requestId === searchRequestId.current) {
        setLoading(false);
      }
    }
  }

  async function loadMore() {
    const value = activeQuery.trim();
    if (
      loading ||
      loadingMore ||
      !apiKey ||
      !value ||
      currentPage < 1 ||
      currentPage >= totalPages
    ) {
      return;
    }

    const nextPage = currentPage + 1;
    const requestId = searchRequestId.current;
    setLoadingMore(true);

    try {
      const data = await searchIcons(apiKey, value, SEARCH_PAGE_SIZE, nextPage);
      if (requestId !== searchRequestId.current) return;
      setResults((previous) => {
        const seen = new Set(
          previous.map((hit) => hit.objectID || hit.icnsUrl || hit.appName),
        );
        const additions = data.hits.filter((hit) => {
          const id = hit.objectID || hit.icnsUrl || hit.appName;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        return [...previous, ...additions];
      });
      setCurrentPage(data.page || nextPage);
      setTotalPages(data.totalPages || totalPages);
      setTotal(data.totalHits || total);
    } catch (error) {
      if (requestId === searchRequestId.current) {
        setToast(error instanceof Error ? error.message : "Unable to load more icons.");
      }
    } finally {
      if (requestId === searchRequestId.current) {
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    const sentinel = loadMoreSentinel.current;
    if (!sentinel || !results.length || currentPage >= totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "600px 0px", threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentPage, totalPages, results.length, loading, loadingMore, activeQuery, apiKey]);

  async function saveKey() {
    const value = draftKey.trim();
    if (!value) {
      localStorage.removeItem(KEY);
      setApiKeyState("");
      setSettingsOpen(false);
      return;
    }

    setTesting(true);
    try {
      await testApiKey(value);
      localStorage.setItem(KEY, value);
      setApiKeyState(value);
      setSettingsOpen(false);
      setToast("API key verified and saved locally.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "API key verification failed.");
    } finally {
      setTesting(false);
    }
  }

  function removeKey() {
    localStorage.removeItem(KEY);
    setApiKeyState("");
    setDraftKey("");
    setSettingsOpen(true);
    setToast("API key removed from this browser.");
  }

  async function openPreview(hit: IconHit) {
    if (!hit.icnsUrl) {
      setToast("This result does not provide an ICNS asset.");
      return;
    }

    setPreview({ hit, loading: true });
    try {
      const buffer = await fetchIcns(hit.icnsUrl);
      const url = await previewUrl(buffer);
      setPreview({ hit, url, loading: false });
    } catch (error) {
      setPreview({ hit, loading: false });
      setToast(error instanceof Error ? error.message : "Unable to preview ICNS.");
    }
  }

  async function downloadIcon(hit: IconHit, requestedFormat: Format) {
    if (!hit.icnsUrl) {
      setToast("This result does not provide an ICNS asset.");
      return;
    }

    const id = hit.objectID || hit.icnsUrl || hit.appName;
    setBusyId(id);
    setMenu(null);

    try {
      const buffer = await fetchIcns(hit.icnsUrl);
      const blob = requestedFormat === "ico" ? await icnsToIco(buffer) : await icnsToPng(buffer);
      download(blob, filename(hit.appName, requestedFormat));
      setToast(hit.appName + " downloaded as " + requestedFormat.toUpperCase() + ".");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusyId(null);
    }
  }

  function openSettings() {
    setDraftKey(apiKey);
    setSettingsOpen(true);
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar glass">
        <button className="brand" onClick={() => { setQuery(""); setActiveQuery(""); setResults([]); setTotal(0); setCurrentPage(0); setTotalPages(1); }}>
          <span className="brand-mark">
            <IconMark />
          </span>
          <span>IconFlow</span>
        </button>

        <div className="top-actions">
          <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="settings-button" onClick={openSettings}>
            <Settings size={16} />
            Settings
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow"><span className="status-dot" /> Browser-native icon workflow</div>
          <h1>Find the icon.<br /><span>Make it yours.</span></h1>
          <p>Search high-resolution macOS icons and convert the original ICNS locally into PNG or Windows-ready ICO files.</p>

          <form className="search-panel glass" onSubmit={(event) => { event.preventDefault(); search(); }}>
            <Search size={20} className="search-leading" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search macOS icons…"
              aria-label="Search macOS icons"
            />
            <button className="search-submit" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
              <span className="search-label">Search</span>
            </button>
          </form>

          <div className="hero-meta">
            <span><ShieldCheck size={15} /> Your API key stays in this browser</span>
            <span><span className="kbd">Enter</span> to search</span>
          </div>
        </section>

        <section className="results-section">
          <div className="results-header">
            <div>
              <span className="section-kicker">{results.length ? "Search results" : "Explore"}</span>
              <h2>{results.length ? activeQuery : "Your icon shelf"}</h2>
            </div>
            {results.length > 0 && <span className="result-count">{results.length.toLocaleString()} of {total.toLocaleString()} results</span>}
          </div>

          {loading ? (
            <div className="skeleton-grid">
              {Array.from({ length: 8 }).map((_, index) => <div className="skeleton-card glass" key={index} />)}
            </div>
          ) : results.length ? (
            <div className="icon-grid">
              {results.map((hit, index) => {
                const id = hit.objectID || hit.icnsUrl || hit.appName;
                const busy = busyId === id;
                return (
                  <article className="icon-card glass" key={id + index}>
                    <button className="preview-button" onClick={() => openPreview(hit)} aria-label={"Preview " + hit.appName}>
                      <div className="icon-art">
                        {hit.lowResPngUrl ? <img src={hit.lowResPngUrl} alt="" loading="lazy" /> : <IconMark className="fallback-icon" />}
                      </div>
                      <span className="preview-hint">Preview ICNS</span>
                    </button>

                    <div className="card-body">
                      <div className="card-title-row">
                        <div>
                          <h3 title={hit.appName}>{hit.appName}</h3>
                          <p>{hit.category || "macOS icon"}</p>
                        </div>
                        <div className="format-menu">
                          <button className="small-button" onClick={() => setMenu(menu === id ? null : id)}>
                            {format.toUpperCase()} <ChevronDown size={13} />
                          </button>
                          {menu === id && (
                            <div className="dropdown glass">
                              <button onClick={() => { setFormat("png"); setMenu(null); }}>PNG</button>
                              <button onClick={() => { setFormat("ico"); setMenu(null); }}>ICO</button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="card-footer">
                        <span className="credit">
                          {hit.creditUrl ? <a href={hit.creditUrl} target="_blank" rel="noreferrer">{hit.credit || hit.uploadedBy || "Creator"}</a> : (hit.credit || hit.uploadedBy || "macOSicons")}
                        </span>
                        <button className="download-button" disabled={busy} onClick={() => downloadIcon(hit, format)}>
                          {busy ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
                          {busy ? "Working" : format.toUpperCase()}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state glass">
              <div className="empty-icon"><IconMark /></div>
              <h3>Search 30,000+ macOS icons</h3>
              <p>Enter an app name above. IconFlow fetches the original ICNS only when you need a high-resolution preview or download.</p>
              <div className="suggestions">
                {["Safari", "Finder", "Terminal", "Spotify"].map((item) => (
                  <button key={item} onClick={() => { setQuery(item); }}>{item}</button>
                ))}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="infinite-results-status" aria-live="polite">
              {loadingMore ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  Loading more icons…
                </>
              ) : currentPage >= totalPages ? (
                <>You’ve reached the end of the results.</>
              ) : null}
            </div>
          )}
          <div ref={loadMoreSentinel} className="load-more-sentinel" aria-hidden="true" />
        </section>
      </main>

      <footer>
        <span>IconFlow</span>
        <span>Icons and creator attribution provided by macOSicons.</span>
        <a href="https://macosicons.com" target="_blank" rel="noreferrer">macOSicons <ExternalLink size={12} /></a>
      </footer>

      {toast && <div className="toast glass">{toast}</div>}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="settings-modal glass" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-heading">
              <div>
                <span className="section-kicker">Local configuration</span>
                <h2 id="settings-title">API access</h2>
              </div>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button>
            </div>

            <div className="key-card">
              <div className="key-icon"><KeyRound size={19} /></div>
              <div>
                <strong>macOSicons API key</strong>
                <p>Stored only in this browser. IconFlow never sends it to Vercel or its own server.</p>
              </div>
            </div>

            <label className="field-label" htmlFor="api-key">API key</label>
            <div className="key-input">
              <KeyRound size={17} />
              <input id="api-key" type="password" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="Paste your macOSicons API key" autoFocus />
            </div>

            <div className="privacy-note"><ShieldCheck size={16} /> Requests go directly from your browser to macOSicons.</div>

            <div className="modal-actions">
              {apiKey && <button className="danger-button" onClick={removeKey}><Trash2 size={15} /> Remove key</button>}
              <button className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="primary-button" onClick={saveKey} disabled={testing || !draftKey.trim()}>
                {testing ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
                {testing ? "Verifying…" : "Verify & Save"}
              </button>
            </div>

            <p className="modal-footnote">IconFlow uses localStorage for persistence. localStorage is not an encrypted secret vault.</p>
          </section>
        </div>
      )}

      {preview && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
          <section className="preview-modal glass">
            <div className="modal-heading">
              <div>
                <span className="section-kicker">High-resolution source</span>
                <h2>{preview.hit.appName}</h2>
              </div>
              <button className="icon-button" onClick={() => setPreview(null)} aria-label="Close preview"><X size={18} /></button>
            </div>
            <div className="large-preview">
              {preview.loading ? <LoaderCircle className="spin" size={30} /> : preview.url ? <img src={preview.url} alt={preview.hit.appName} /> : <IconMark className="preview-fallback-icon" />}
            </div>
            <div className="preview-actions">
              <button className="secondary-button" disabled={preview.loading} onClick={() => downloadIcon(preview.hit, "png")}><Download size={16} /> PNG</button>
              <button className="primary-button" disabled={preview.loading} onClick={() => downloadIcon(preview.hit, "ico")}><Download size={16} /> ICO</button>
            </div>
            <div className="creator-line">
              <span>Credit: {preview.hit.credit || preview.hit.uploadedBy || "macOSicons"}</span>
              {preview.hit.creditUrl && <a href={preview.hit.creditUrl} target="_blank" rel="noreferrer">View creator <ExternalLink size={12} /></a>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
