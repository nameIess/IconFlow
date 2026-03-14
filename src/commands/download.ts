import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import os from "os";
import fs from "fs";
import { loadConfig } from "../config.js";
import { searchIcons, downloadWithRetry } from "../api/macosicons.js";
import type { SearchHit } from "../api/macosicons.js";
import { getSearchFromCache, setSearchCache } from "../cache/search.js";
import { getDownloadFromCache, setDownloadCache } from "../cache/download.js";
import type { MacIcnsConfig } from "../config.js";
import { convertIcnsToIco } from "../convert.js";

function toInt(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFileName(hit: SearchHit, keyword: string, ext: "icns" | "ico" = "icns"): string {
  const baseName = sanitizeFileName(hit.appName ?? keyword ?? "icon");
  const id = hit.objectID ?? "";
  const base = id ? `${baseName}_${id}` : baseName;
  return `${base}.${ext}`;
}

function getDownloadDir(config: MacIcnsConfig, outOverride?: string, forIco?: boolean): string {
  if (outOverride) return path.resolve(process.cwd(), outOverride);
  if (forIco && config.downloadDirIco) return config.downloadDirIco;
  return config.downloadDir;
}

export async function handleDownload(
  opts: {
    keyword: string;
    index: number;
    out?: string;
    limit?: string;
    page?: string;
    verbose?: boolean;
    dryRun?: boolean;
    format?: "icns" | "ico";
    deleteIcns?: boolean;
  },
  config: MacIcnsConfig
): Promise<string | null> {
  const cfg = config;
  const limit = toInt(opts.limit, cfg.defaultLimit);
  const page = toInt(opts.page, 1);
  const offset = (page - 1) * limit;

  let payload = await getSearchFromCache({ query: opts.keyword, limit, offset }, cfg);
  if (!payload) {
    payload = await searchIcons({
      query: opts.keyword,
      limit,
      page,
      apiKey: cfg.apiKey,
    });
    await setSearchCache({ query: opts.keyword, limit, offset }, payload, cfg);
  }

  const hits = payload.hits ?? [];
  if (!hits.length) throw new Error(`No icons found for "${opts.keyword}".`);

  const idx = opts.index;
  if (idx < 1 || idx > hits.length) {
    throw new Error(`--index must be between 1 and ${hits.length} (got ${opts.index})`);
  }

  const hit = hits[idx - 1];
  const url = hit.icnsUrl;
  if (!url) {
    throw new Error(
      `Result #${idx} ("${hit.appName ?? "Unnamed"}") has no icns URL. Try a different --index.`
    );
  }

  const platform = os.platform();
  const wantIco = platform === "win32" || opts.format === "ico";
  const outDir = getDownloadDir(cfg, opts.out, wantIco);
  const ext = wantIco ? "ico" : "icns";
  const outPath = path.join(outDir, buildFileName(hit, opts.keyword, ext));

  if (opts.dryRun) {
    console.log(chalk.yellow("\n[DRY RUN] Would download:"));
    console.log(`  App:  ${hit.appName ?? "Unnamed"}`);
    console.log(`  URL:  ${url}`);
    console.log(`  To:   ${outPath}`);
    return null;
  }

  const objectId = hit.objectID ?? hit.appName ?? "";
  let icnsPath: string;
  let downloadedIcnsPath: string | null = null;

  const cachedIcns = objectId ? await getDownloadFromCache(objectId, "icns", cfg) : null;
  if (cachedIcns) {
    icnsPath = cachedIcns;
  } else {
    const icnsDir = getDownloadDir(cfg, opts.out, false);
    const targetIcnsPath = path.join(icnsDir, buildFileName(hit, opts.keyword, "icns"));
    await downloadWithRetry({
      url,
      outPath: targetIcnsPath,
      verbose: opts.verbose,
    });
    icnsPath = targetIcnsPath;
    downloadedIcnsPath = targetIcnsPath;
    if (objectId && !opts.deleteIcns) await setDownloadCache(objectId, "icns", icnsPath, cfg);
  }

  if (wantIco) {
    const cachedIco = objectId ? await getDownloadFromCache(objectId, "ico", cfg) : null;
    if (cachedIco) {
      fs.copyFileSync(cachedIco, outPath);
    } else {
      await convertIcnsToIco(icnsPath, outPath);
      if (objectId) await setDownloadCache(objectId, "ico", outPath, cfg);
    }

    const shouldDeleteIcns = opts.deleteIcns ?? cfg.deleteIcnsAfterConvert ?? false;
    if (shouldDeleteIcns && downloadedIcnsPath && fs.existsSync(downloadedIcnsPath)) {
      fs.unlinkSync(downloadedIcnsPath);
    }
  } else {
    if (icnsPath !== outPath) fs.copyFileSync(icnsPath, outPath);
  }

  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(chalk.green("✓ Downloaded ") + chalk.bold(hit.appName ?? "Unnamed") + chalk.dim(` → ${outPath} (${sizeKB} KB)`));
  return outPath;
}

export function registerDownloadCommand(program: Command): void {
  program
    .command("download <keyword>")
    .description("Download icons (optionally without interactive prompt)")
    .option("-i, --index <n>", "Result index to download (default: 1)", "1")
    .option("-l, --limit <n>", "Max search results", "25")
    .option("-p, --page <n>", "Page number", "1")
    .option("-o, --out <dir>", "Output directory")
    .option("--all", "Download all results up to limit")
    .option("--dry-run", "Show what would be downloaded")
    .option("--delete-icns", "Delete source .icns after successful .ico conversion")
    .option("-v, --verbose", "Verbose output")
    .option("--format <fmt>", "Output format: icns or ico (auto ico on Windows)", "icns")
    .action(async (keyword: string, opts: {
      index?: string;
      limit?: string;
      page?: string;
      out?: string;
      all?: boolean;
      "dry-run"?: boolean;
      "delete-icns"?: boolean;
      dryRun?: boolean;
      deleteIcns?: boolean;
      verbose?: boolean;
      format?: string;
    }) => {
      const cfg = loadConfig();
      if (!cfg.apiKey) {
        console.error(chalk.red("\n✗ API key missing. Set it in .env or global config."));
        process.exit(1);
      }

      if (opts.format && opts.format !== "icns" && opts.format !== "ico") {
        console.warn(chalk.yellow(`⚠ Unknown format "${opts.format}", defaulting to "icns".`));
      }

      const limit = toInt(opts.limit, cfg.defaultLimit);
      const page = toInt(opts.page, 1);
      const offset = (page - 1) * limit;

      let payload = await getSearchFromCache({ query: keyword, limit, offset }, cfg);
      if (!payload) {
        payload = await searchIcons({
          query: keyword,
          limit,
          page,
          apiKey: cfg.apiKey,
        });
        await setSearchCache({ query: keyword, limit, offset }, payload, cfg);
      }

      const hits = payload.hits ?? [];
      if (!hits.length) {
        console.log(chalk.yellow(`No icons found for "${keyword}".`));
        return;
      }

      const platform = os.platform();
      const wantIco = platform === "win32" || opts.format === "ico";
      const ext = wantIco ? "ico" : "icns";
      const outDir = getDownloadDir(cfg, opts.out, wantIco);

      if (opts.all) {
        console.log(chalk.bold(`\nDownloading ${hits.length} icon(s)...\n`));
        let succeeded = 0;
        let failed = 0;

        for (let i = 0; i < hits.length; i++) {
          const hit = hits[i];
          if (!hit.icnsUrl) {
            console.log(chalk.yellow(`  [${i + 1}/${hits.length}] ${hit.appName ?? "Unnamed"} — no icns URL, skipped`));
            failed++;
            continue;
          }

          if (opts.dryRun ?? opts["dry-run"]) {
            console.log(chalk.dim(`  [${i + 1}/${hits.length}] `) + chalk.bold(hit.appName ?? "Unnamed") + chalk.dim(` → ${path.join(outDir, buildFileName(hit, keyword, ext))}`));
            continue;
          }

          try {
            await handleDownload(
              {
                keyword,
                index: i + 1,
                out: opts.out,
                limit: opts.limit,
                page: opts.page,
                verbose: opts.verbose,
                format: wantIco ? "ico" : "icns",
                deleteIcns: opts.deleteIcns ?? opts["delete-icns"],
              },
              cfg
            );
            succeeded++;
          } catch (err) {
            console.log(chalk.red(`  [${i + 1}/${hits.length}] ${hit.appName ?? "Unnamed"} — ${(err as Error).message}`));
            failed++;
          }
        }

        if (!(opts.dryRun ?? opts["dry-run"])) {
          console.log();
          console.log(chalk.bold("Done! ") + chalk.green(`${succeeded} downloaded`) + (failed ? chalk.red(`, ${failed} failed`) : ""));
          console.log(chalk.dim(`Output: ${outDir}`));
        }
        return;
      }

      const index = toInt(opts.index, 1);
      await handleDownload(
        {
          keyword,
          index,
          out: opts.out,
          limit: opts.limit,
          page: opts.page,
          verbose: opts.verbose,
          dryRun: opts.dryRun ?? opts["dry-run"],
          deleteIcns: opts.deleteIcns ?? opts["delete-icns"],
          format: (opts.format === "ico" ? "ico" : "icns") as "icns" | "ico",
        },
        cfg
      );
    });
}
