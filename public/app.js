// IconFlow — Frontend Logic
const API = "";
let currentResults = [];
let isSearching = false;

// ── SVG Icons (inline, no external deps) ──
const ICONS = {
  search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  loader: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  layers: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12-8.58 3.91a2 2 0 0 1-1.66 0L2 12"/><path d="m22 17-8.58 3.91a2 2 0 0 1-1.66 0L2 17"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  alert: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  box: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
};

// ── Toast Notifications ──
function toast(msg, type = "info") {
  const c = document.getElementById("toasts");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  const iconKey = type === "success" ? "check" : type === "error" ? "alert" : "info";
  t.innerHTML = `<span class="toast-icon ${type}">${ICONS[iconKey]}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">${ICONS.x}</button>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(32px)";
    t.style.transition = "all 0.2s";
    setTimeout(() => t.remove(), 200);
  }, 4000);
}

// ── API ──
async function api(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path) {
  return (await fetch(API + path)).json();
}

// ── Search ──
async function doSearch() {
  const q = document.getElementById("searchInput").value.trim();
  if (!q || isSearching) return;
  isSearching = true;

  const grid = document.getElementById("iconGrid");
  const limit = parseInt(document.getElementById("limitSelect").value) || 25;

  grid.innerHTML = `<div class="state-container"><div class="spinner"></div><p class="state-desc">Searching for icons...</p></div>`;
  document.getElementById("resultInfo").textContent = "";

  try {
    const data = await api("/api/search", { query: q, limit, page: 1 });
    if (data.error) throw new Error(data.error);

    currentResults = data.hits || [];
    const total = data.totalHits || currentResults.length;
    document.getElementById("resultInfo").textContent = `${total.toLocaleString()} result${total !== 1 ? "s" : ""} found${currentResults.length !== total ? ` · showing ${currentResults.length}` : ""}`;

    if (!currentResults.length) {
      grid.innerHTML = `<div class="state-container"><div class="state-icon muted-bg">${ICONS.search}</div><h3 class="state-title">No icons found</h3><p class="state-desc">Try a different search term</p></div>`;
      return;
    }

    renderGrid(currentResults);
  } catch (e) {
    grid.innerHTML = "";
    toast(e.message, "error");
  } finally {
    isSearching = false;
  }
}

// Build an ordered list of browser-displayable PNG preview URLs for a hit.
// Order: low-res PNG, then the iOS PNG. The .icns URL is intentionally excluded
// (browsers cannot render .icns in an <img>).
function previewCandidates(hit) {
  const urls = [];
  for (const u of [hit.lowResPngUrl, hit.iOSUrl]) {
    if (u && !urls.includes(u)) urls.push(u);
  }
  return urls;
}

// onerror handler: advance to the next candidate, or show a placeholder.
function nextPreview(img) {
  let cands = [];
  try { cands = JSON.parse(decodeURIComponent(img.dataset.cands || "[]")); } catch {}
  const idx = parseInt(img.dataset.idx || "0", 10) + 1;
  if (idx < cands.length) {
    img.dataset.idx = String(idx);
    img.src = cands[idx];
    return;
  }
  const wrap = img.parentElement;
  img.remove();
  if (wrap && !wrap.querySelector(".icon-placeholder")) {
    const ph = document.createElement("div");
    ph.className = "icon-placeholder";
    ph.innerHTML = ICONS.box;
    wrap.insertBefore(ph, wrap.firstChild);
  }
}

function renderGrid(hits) {
  const grid = document.getElementById("iconGrid");
  grid.innerHTML = "";
  hits.forEach((hit, i) => {
    const card = document.createElement("div");
    card.className = "icon-card";
    card.style.animationDelay = `${i * 30}ms`;
    const name = hit.appName || "Unnamed";
    const author = hit.usersName || hit.credit || "Unknown";
    const dl = typeof hit.downloads === "number" ? hit.downloads.toLocaleString() : "0";
    const hasUrl = !!hit.icnsUrl;
    // Only PNG sources are browser-displayable (.icns cannot render in <img>).
    // Try each candidate in order before falling back to a placeholder.
    const candidates = previewCandidates(hit);
    const candAttr = encodeURIComponent(JSON.stringify(candidates));

    card.innerHTML = `
      <div class="icon-preview">
        ${candidates.length
          ? `<img src="${candidates[0]}" alt="${name}" loading="lazy" data-cands="${candAttr}" data-idx="0" onerror="nextPreview(this)">`
          : `<div class="icon-placeholder">${ICONS.box}</div>`}
        ${hasUrl ? `<div class="download-overlay"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();downloadOne(${i})">${ICONS.download} Download</button></div>` : ""}
      </div>
      <div class="icon-info">
        <div class="icon-name" title="${name}">${name}</div>
        <div class="icon-meta">
          <span class="icon-author" title="${author}">by ${author}</span>
          <span class="icon-downloads">${ICONS.download} ${dl}</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ── Download ──
async function downloadOne(index) {
  const hit = currentResults[index];
  if (!hit?.icnsUrl) { toast("No download URL", "error"); return; }
  const format = document.getElementById("formatSelect").value;
  toast(`Downloading ${hit.appName || "icon"}...`, "info");
  try {
    const data = await api("/api/download", { icnsUrl: hit.icnsUrl, appName: hit.appName, objectID: hit.objectID, format });
    if (data.error) throw new Error(data.error);
    toast(`${hit.appName || "Icon"} saved (${data.size} KB) → .${data.format}`, "success");
  } catch (e) {
    toast(`Download failed: ${e.message}`, "error");
  }
}

async function downloadAll() {
  const icons = currentResults.filter((h) => h.icnsUrl);
  if (!icons.length) { toast("No downloadable icons", "error"); return; }
  const format = document.getElementById("formatSelect").value;
  toast(`Downloading ${icons.length} icons...`, "info");
  try {
    const data = await api("/api/download-batch", { icons: icons.map((h) => ({ icnsUrl: h.icnsUrl, appName: h.appName, objectID: h.objectID })), format });
    if (data.error) throw new Error(data.error);
    const ok = data.results.filter((r) => r.success).length;
    const fail = data.results.filter((r) => !r.success).length;
    toast(`Batch complete: ${ok} downloaded${fail ? `, ${fail} failed` : ""}`, ok ? "success" : "error");
  } catch (e) {
    toast(`Batch failed: ${e.message}`, "error");
  }
}

async function openFolder() {
  try { await api("/api/open-folder", {}); } catch {}
}

// ── Settings ──
async function loadSettings() {
  try {
    const cfg = await apiGet("/api/config");
    document.getElementById("cfgApiKey").value = cfg.apiKey?.startsWith("***") ? "" : cfg.apiKey || "";
    document.getElementById("cfgApiKey").placeholder = cfg.apiKey || "Enter API key";
    document.getElementById("cfgHost").value = cfg.host || "127.0.0.1";
    document.getElementById("cfgPort").value = cfg.port || 3456;
    document.getElementById("cfgDownloadDir").value = cfg.downloadDir || "";
    document.getElementById("cfgDownloadDirIco").value = cfg.downloadDirIco || "";
    document.getElementById("cfgLimit").value = cfg.defaultLimit || 25;
    document.getElementById("cfgDeleteIcns").checked = cfg.deleteIcnsAfterConvert || false;
  } catch {}
}

async function saveSettings() {
  const body = {
    host: document.getElementById("cfgHost").value,
    port: parseInt(document.getElementById("cfgPort").value) || 3456,
    downloadDir: document.getElementById("cfgDownloadDir").value,
    downloadDirIco: document.getElementById("cfgDownloadDirIco").value,
    defaultLimit: parseInt(document.getElementById("cfgLimit").value) || 25,
    deleteIcnsAfterConvert: document.getElementById("cfgDeleteIcns").checked,
  };
  const key = document.getElementById("cfgApiKey").value.trim();
  if (key) body.apiKey = key;
  try {
    const data = await api("/api/config", body);
    if (data.error) throw new Error(data.error);
    toast("Settings saved! Restart server for host/port changes.", "success");
    closeSettings();
  } catch (e) {
    toast("Save failed: " + e.message, "error");
  }
}

function openSettings() {
  loadSettings();
  document.getElementById("settingsModal").classList.add("active");
}

function closeSettings() {
  document.getElementById("settingsModal").classList.remove("active");
}

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
  document.getElementById("settingsModal").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) closeSettings();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
  });
});
