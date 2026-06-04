const fs = require("fs");
const path = require("path");
const os = require("os");

let sharpModule, icoModule, icnsModule;
try { sharpModule = require("sharp"); } catch { sharpModule = null; }
try { icoModule = require("sharp-ico"); } catch { icoModule = null; }
try { icnsModule = require("@fiahfy/icns"); } catch { icnsModule = null; }

const PARSEFILES_BASE = "https://parsefiles.back4app.com/JPaQcFfEEQ1ePBxbf6wvzkPMEqKYHhPYv8boI1Rc";

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim();
}

/**
 * Convert an S3 macosicons URL to a parsefiles.back4app.com fallback URL.
 * S3 pattern:  s3.macosicons.com/macosicons/icons/{id}/icnsFile_{hash}_{id}.icns
 * Parsefiles:  parsefiles.back4app.com/{appId}/{hash}_{id}.icns
 */
function buildFallbackUrl(originalUrl) {
  try {
    const url = new URL(originalUrl);
    if (!url.hostname.includes("s3.macosicons.com")) return null;

    const filename = url.pathname.split("/").pop();
    // Strip known prefixes: icnsFile_, lowResPngFile_, iOSFile_
    const stripped = filename.replace(/^(icnsFile_|lowResPngFile_|iOSFile_)/, "");
    return `${PARSEFILES_BASE}/${stripped}`;
  } catch {
    return null;
  }
}

async function convertIcnsToIco(icnsPath, icoPath) {
  if (!sharpModule || !icoModule || !icnsModule) {
    throw new Error("Missing conversion deps (sharp, sharp-ico, @fiahfy/icns)");
  }
  const buf = fs.readFileSync(icnsPath);
  const icns = icnsModule.Icns.from(buf);
  if (!icns.images || !icns.images.length) throw new Error("No images in ICNS");

  let best = null;
  let bestSize = 0;
  for (const img of icns.images) {
    const data = img.image;
    if (!Buffer.isBuffer(data)) continue;
    if (data.length > bestSize) { bestSize = data.length; best = data; }
  }
  if (!best) throw new Error("Could not extract image from ICNS");

  fs.mkdirSync(path.dirname(icoPath), { recursive: true });
  const inst = sharpModule(best);
  await icoModule.sharpsToIco([inst], icoPath, {
    sizes: [256, 128, 64, 48, 32, 24, 16],
    resizeOptions: {},
  });
}

async function downloadFile(url, outPath) {
  let res = await fetch(url);

  // If the original URL fails and it's an S3 URL, try the parsefiles fallback
  if (!res.ok) {
    const fallbackUrl = buildFallbackUrl(url);
    if (fallbackUrl) {
      console.log(`[download] S3 returned ${res.status}, trying parsefiles fallback...`);
      res = await fetch(fallbackUrl);
      if (!res.ok) {
        throw new Error(`Download failed (${res.status}) — both S3 and parsefiles fallback failed`);
      }
      console.log(`[download] Parsefiles fallback succeeded.`);
    } else {
      throw new Error(`Download failed (${res.status})`);
    }
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength === 0) throw new Error("Empty file");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(ab));
}

async function downloadIcon({ icnsUrl, appName, objectID, format, config }) {
  if (!icnsUrl) throw new Error("Missing icnsUrl");

  const wantIco = format === "ico" || (format === "auto" && os.platform() === "win32");
  const ext = wantIco ? "ico" : "icns";
  const baseName = sanitize(appName || "icon") + (objectID ? `_${objectID}` : "");
  const outDir = wantIco ? config.downloadDirIco : config.downloadDir;
  const icnsPath = path.join(config.downloadDir, `${baseName}.icns`);

  await downloadFile(icnsUrl, icnsPath);
  let finalPath = icnsPath;

  if (wantIco) {
    const icoPath = path.join(outDir, `${baseName}.ico`);
    await convertIcnsToIco(icnsPath, icoPath);
    finalPath = icoPath;
    if (config.deleteIcnsAfterConvert && fs.existsSync(icnsPath)) {
      fs.unlinkSync(icnsPath);
    }
  }

  const sizeKB = (fs.statSync(finalPath).size / 1024).toFixed(1);
  return { path: finalPath, size: sizeKB, format: ext };
}

async function downloadBatch({ icons, format, config }) {
  const results = [];
  for (const icon of icons) {
    try {
      const result = await downloadIcon({
        icnsUrl: icon.icnsUrl,
        appName: icon.appName,
        objectID: icon.objectID,
        format,
        config,
      });
      results.push({ appName: icon.appName, success: true, ...result });
    } catch (e) {
      results.push({ appName: icon.appName, success: false, error: e.message });
    }
  }
  return results;
}

module.exports = { downloadIcon, downloadBatch, convertIcnsToIco, buildFallbackUrl };
