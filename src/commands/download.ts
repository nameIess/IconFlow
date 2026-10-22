import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import os from "os";
import fs from "fs";
import { loadConfig } from "../config.js";
import { searchIcons, downloadWithRetry, resolveIconById } from "../api/macosicons.js";
import type { SearchHit } from "../api/macosicons.js";
import { getSearchFromCache, setSearchCache } from "../cache/search.js";
import { getDownloadFromCache, setDownloadCache } from "../cache/download.js";
import type { MacIcnsConfig } from "../config.js";
import { convertIcnsToIco } from "../convert.js";
import { toPositiveInt } from "../utils/number.js";
import { installToApp } from "../platform/macos.js";
import { installToFolderAsync, installToShortcut } from "../platform/windows.js";

type DownloadFormat = "icns" | "ico";

type DownloadRunOptions = {
  out?: string;
  verbose?: boolean;
  dryRun?: boolean;
  format?: DownloadFormat;
  deleteIcns?: boolean;
};

type DownloadCommandOptions = {
  index?: string;
  limit?: string;
  page?: string;
  out?: string;
  all?: boolean;
  "dry-run"?: boolean;
  "delete-icns"?: boolean;
  "links-file"?: string;
  "install-target"?: string;
  "install-shortcut"?: boolean;
  "install-app-path"?: string;
  "install-backup"?: boolean;
  dryRun?: boolean;
  deleteIcns?: boolean;
  linksFile?: string;
  installTarget?: string;
  installShortcut?: boolean;
  installAppPath?: string;
  installBackup?: boolean;
  verbose?: boolean;
  format?: string;
};

type NormalizedDownloadCommandOptions = {
  index?: string;
  limit?: string;
  page?: string;
  out?: string;
  all?: boolean;
  dryRun?: boolean;
  deleteIcns?: boolean;
  linksFile?: string;
  installTarget?: string;
  installShortcut?: boolean;
  installAppPath?: string;
  installBackup?: boolean;
  verbose?: boolean;
  format?: DownloadFormat;
};

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

function normalizeDownloadCommandOptions(opts: DownloadCommandOptions): NormalizedDownloadCommandOptions {
  const normalizedFormat = opts.format?.toLowerCase();
  if (normalizedFormat && normalizedFormat !== "icns" && normalizedFormat !== "ico") {
    throw new Error(`Invalid --format value "${opts.format}". Use "icns" or "ico".`);
  }

  return {
    index: opts.index,
    limit: opts.limit,
    page: opts.page,
    out: opts.out,
    all: opts.all,
    dryRun: opts.dryRun ?? opts["dry-run"],
    deleteIcns: opts.deleteIcns ?? opts["delete-icns"],
    linksFile: opts.linksFile ?? opts["links-file"],
    installTarget: opts.installTarget ?? opts["install-target"],
    installShortcut: opts.installShortcut ?? opts["install-shortcut"],
    installAppPath: opts.installAppPath ?? opts["install-app-path"],
    installBackup: opts.installBackup ?? opts["install-backup"],
    verbose: opts.verbose,
    format: normalizedFormat as DownloadFormat | undefined,
  };
}

function extractIconIdFromLine(line: string): string | null {
  const cleaned = line.trim().replace(/[`,;"']+$/g, "");
  if (!cleaned || cleaned.startsWith("#")) return null;

  let candidate = cleaned;
  if (cleaned.includes("http://") || cleaned.includes("https://")) {
    const urlMatch = cleaned.match(/https?:\/\/\S+/i);
    if (!urlMatch) return null;
    candidate = urlMatch[0].replace(/[`,;"']+$/g, "");
  }

  try {
    const url = new URL(candidate);
    const icon = url.searchParams.get("icon")?.trim();
    if (icon) return icon;
  } catch {
    // Fall through and treat candidate as a raw object id.
  }

  if (/^[A-Za-z0-9_-]{4,}$/.test(candidate)) return candidate;
  return null;
}

function readIconIdsFromFile(filePath: string): string[] {
  const resolvedFile = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedFile)) {
    throw new Error(`Links file not found: ${resolvedFile}`);
  }

  const content = fs.readFileSync(resolvedFile, "utf8");
  const unique = new Set<string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const iconId = extractIconIdFromLine(rawLine);
    if (iconId) unique.add(iconId);
  }
  return Array.from(unique);
}

async function installDownloadedIcon(params: {
  iconPath: string;
  installTarget: string;
  installShortcut?: boolean;
  installAppPath?: string;
  installBackup?: boolean;
}): Promise<void> {
  const platform = os.platform();

  if (platform === "darwin") {
    if (params.installShortcut) {
      throw new Error("--install-shortcut is only supported on Windows.");
    }

    const maybeAppPath = params.installTarget.toLowerCase().endsWith(".app")
      ? path.resolve(process.cwd(), params.installTarget)
      : undefined;

    const appPath = params.installAppPath
      ? path.resolve(process.cwd(), params.installAppPath)
      : maybeAppPath;

    const appName = appPath
      ? path.basename(appPath, ".app")
      : params.installTarget;

    installToApp({
      icnsPath: params.iconPath,
      appName,
      appPath,
      backup: params.installBackup,
    });
    return;
  }

  if (platform === "win32") {
    const resolvedTarget = path.resolve(process.cwd(), params.installTarget);
    if (params.installShortcut) {
      await installToShortcut({ iconPath: params.iconPath, shortcutPath: resolvedTarget });
    } else {
      await installToFolderAsync({ iconPath: params.iconPath, folderPath: resolvedTarget });
    }
    return;
  }

  throw new Error("Install is only supported on macOS and Windows.");
}

async function downloadHit(
  hit: SearchHit,
  keyword: string,
  opts: DownloadRunOptions,
  config: MacIcnsConfig
): Promise<string | null> {
  const url = hit.icnsUrl;
  if (!url) {
    throw new Error(`Icon \"${hit.appName ?? hit.objectID ?? "Unnamed"}\" has no icns URL.`);
  }

  const platform = os.platform();
  const wantIco = platform === "win32" || opts.format === "ico";
  const outDir = getDownloadDir(config, opts.out, wantIco);
  const ext = wantIco ? "ico" : "icns";
  const outPath = path.join(outDir, buildFileName(hit, keyword, ext));

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

  const cachedIcns = objectId ? await getDownloadFromCache(objectId, "icns", config) : null;
  if (cachedIcns) {
    icnsPath = cachedIcns;
  } else {
    const icnsDir = getDownloadDir(config, opts.out, false);
    const targetIcnsPath = path.join(icnsDir, buildFileName(hit, keyword, "icns"));
    await downloadWithRetry({
      url,
      outPath: targetIcnsPath,
      verbose: opts.verbose,
    });
    icnsPath = targetIcnsPath;
    downloadedIcnsPath = targetIcnsPath;
    if (objectId && !opts.deleteIcns) await setDownloadCache(objectId, "icns", icnsPath, config);
  }

  if (wantIco) {
    const cachedIco = objectId ? await getDownloadFromCache(objectId, "ico", config) : null;
    if (cachedIco) {
      fs.copyFileSync(cachedIco, outPath);
    } else {
      await convertIcnsToIco(icnsPath, outPath);
      if (objectId) await setDownloadCache(objectId, "ico", outPath, config);
    }

    const shouldDeleteIcns = opts.deleteIcns ?? config.deleteIcnsAfterConvert ?? false;
    if (shouldDeleteIcns && downloadedIcnsPath && fs.existsSync(downloadedIcnsPath)) {
      fs.unlinkSync(downloadedIcnsPath);
    }
  } else if (icnsPath !== outPath) {
    fs.copyFileSync(icnsPath, outPath);
  }

  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(chalk.green("✓ Downloaded ") + chalk.bold(hit.appName ?? "Unnamed") + chalk.dim(` → ${outPath} (${sizeKB} KB)`));
  return outPath;
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
  const limit = toPositiveInt(opts.limit, config.defaultLimit);
  const page = toPositiveInt(opts.page, 1);
  const offset = (page - 1) * limit;

  let payload = await getSearchFromCache({ query: opts.keyword, limit, offset }, config);
  if (!payload) {
    payload = await searchIcons({
      query: opts.keyword,
      limit,
      page,
      apiKey: config.apiKey,
    });
    await setSearchCache({ query: opts.keyword, limit, offset }, payload, config);
  }

  const hits = payload.hits ?? [];
  if (!hits.length) throw new Error(`No icons found for "${opts.keyword}".`);

  const idx = opts.index;
  if (idx < 1 || idx > hits.length) {
    throw new Error(`--index must be between 1 and ${hits.length} (got ${opts.index})`);
  }

  const hit = hits[idx - 1];
  return downloadHit(
    hit,
    opts.keyword,
    {
      out: opts.out,
      verbose: opts.verbose,
      dryRun: opts.dryRun,
      format: opts.format,
      deleteIcns: opts.deleteIcns,
    },
    config
  );
}

export function registerDownloadCommand(program: Command): void {
  program
    .command("download [keyword]")
    .description("Download icons by search keyword or from a links file")
    .option("-i, --index <n>", "Result index to download (default: 1)", "1")
    .option("-l, --limit <n>", "Max search results", "25")
    .option("-p, --page <n>", "Page number", "1")
    .option("-o, --out <dir>", "Output directory")
    .option("--all", "Download all results up to limit")
    .option("--links-file <file>", "Download from a file of icon links or ids")
    .option("--dry-run", "Show what would be downloaded")
    .option("--delete-icns", "Delete source .icns after successful .ico conversion")
    .option("--install-target <target>", "Install each downloaded icon to one target path/name")
    .option("--install-shortcut", "When installing on Windows, treat target as a .lnk shortcut")
    .option("--install-app-path <path>", "When installing on macOS, explicit .app path")
    .option("--install-backup", "When installing on macOS, back up original icon")
    .option("-v, --verbose", "Verbose output")
    .option("--format <fmt>", "Output format: icns or ico (auto ico on Windows)", "icns")
    .action(async (keyword: string | undefined, opts: DownloadCommandOptions) => {
      const cfg = loadConfig();
      if (!cfg.apiKey) {
        console.error(chalk.red("\n✗ API key missing. Set it in .env or global config."));
        process.exit(1);
      }

      const normalized = normalizeDownloadCommandOptions(opts);
      const hasKeyword = typeof keyword === "string" && keyword.trim().length > 0;
      const hasLinksFile = Boolean(normalized.linksFile);
      if (hasKeyword === hasLinksFile) {
        throw new Error("Use exactly one mode: either <keyword> or --links-file <file>.");
      }

      if (!normalized.installTarget) {
        if (normalized.installShortcut || normalized.installAppPath || normalized.installBackup) {
          throw new Error("Install flags require --install-target <target>.");
        }
      }

      const runOpts: DownloadRunOptions = {
        out: normalized.out,
        verbose: normalized.verbose,
        dryRun: normalized.dryRun,
        format: normalized.format,
        deleteIcns: normalized.deleteIcns,
      };

      if (hasLinksFile) {
        const iconIds = readIconIdsFromFile(normalized.linksFile as string);
        if (!iconIds.length) {
          throw new Error("No valid icon ids found in links file.");
        }

        console.log(chalk.bold(`\nProcessing ${iconIds.length} icon id(s) from links file...`));

        const resolvedHits: SearchHit[] = [];
        const unresolvedIds: string[] = [];

        for (const iconId of iconIds) {
          try {
            const hit = await resolveIconById({ iconId, apiKey: cfg.apiKey });
            if (!hit) {
              unresolvedIds.push(iconId);
              continue;
            }
            resolvedHits.push(hit);
          } catch {
            unresolvedIds.push(iconId);
          }
        }

        if (!resolvedHits.length) {
          throw new Error("Could not resolve any links from file to downloadable icons.");
        }

        if (unresolvedIds.length) {
          console.log(chalk.yellow(`Skipped ${unresolvedIds.length} unresolved id(s).`));
        }

        if (normalized.installTarget && resolvedHits.length > 1) {
          console.log(
            chalk.yellow(
              "Multiple icons will be installed to the same target; each successful install replaces the previous icon."
            )
          );
        }

        let succeeded = 0;
        let failed = 0;
        for (let i = 0; i < resolvedHits.length; i++) {
          const hit = resolvedHits[i];
          const label = hit.appName ?? hit.objectID ?? "Unnamed";
          const keywordHint = hit.appName ?? hit.objectID ?? "icon";

          if (!hit.icnsUrl) {
            console.log(chalk.yellow(`  [${i + 1}/${resolvedHits.length}] ${label} — no icns URL, skipped`));
            failed++;
            continue;
          }

          try {
            const downloadedPath = await downloadHit(hit, keywordHint, runOpts, cfg);
            if (normalized.installTarget) {
              if (runOpts.dryRun || !downloadedPath) {
                console.log(
                  chalk.dim(`  [${i + 1}/${resolvedHits.length}] would install → ${normalized.installTarget}`)
                );
              } else {
                await installDownloadedIcon({
                  iconPath: downloadedPath,
                  installTarget: normalized.installTarget,
                  installShortcut: normalized.installShortcut,
                  installAppPath: normalized.installAppPath,
                  installBackup: normalized.installBackup,
                });
                console.log(chalk.green(`  [${i + 1}/${resolvedHits.length}] installed → ${normalized.installTarget}`));
              }
            }
            succeeded++;
          } catch (err) {
            console.log(chalk.red(`  [${i + 1}/${resolvedHits.length}] ${label} — ${(err as Error).message}`));
            failed++;
          }
        }

        if (!runOpts.dryRun) {
          console.log();
          console.log(chalk.bold("Done! ") + chalk.green(`${succeeded} processed`) + (failed ? chalk.red(`, ${failed} failed`) : ""));
        }
        return;
      }

      const keywordValue = (keyword as string).trim();
      const limit = toPositiveInt(normalized.limit, cfg.defaultLimit);
      const page = toPositiveInt(normalized.page, 1);
      const offset = (page - 1) * limit;

      let payload = await getSearchFromCache({ query: keywordValue, limit, offset }, cfg);
      if (!payload) {
        payload = await searchIcons({
          query: keywordValue,
          limit,
          page,
          apiKey: cfg.apiKey,
        });
        await setSearchCache({ query: keywordValue, limit, offset }, payload, cfg);
      }

      const hits = payload.hits ?? [];
      if (!hits.length) {
        console.log(chalk.yellow(`No icons found for "${keywordValue}".`));
        return;
      }

      const platform = os.platform();
      const wantIco = platform === "win32" || normalized.format === "ico";
      const ext = wantIco ? "ico" : "icns";
      const outDir = getDownloadDir(cfg, normalized.out, wantIco);

      if (normalized.installTarget && hits.length > 1 && normalized.all) {
        console.log(
          chalk.yellow(
            "Multiple icons will be installed to the same target; each successful install replaces the previous icon."
          )
        );
      }

      if (normalized.all) {
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

          if (normalized.dryRun) {
            console.log(chalk.dim(`  [${i + 1}/${hits.length}] `) + chalk.bold(hit.appName ?? "Unnamed") + chalk.dim(` → ${path.join(outDir, buildFileName(hit, keywordValue, ext))}`));
            if (normalized.installTarget) {
              console.log(chalk.dim(`      would install → ${normalized.installTarget}`));
            }
            continue;
          }

          try {
            const downloadedPath = await downloadHit(hit, keywordValue, runOpts, cfg);
            if (normalized.installTarget && downloadedPath) {
              await installDownloadedIcon({
                iconPath: downloadedPath,
                installTarget: normalized.installTarget,
                installShortcut: normalized.installShortcut,
                installAppPath: normalized.installAppPath,
                installBackup: normalized.installBackup,
              });
              console.log(chalk.green(`      installed → ${normalized.installTarget}`));
            }
            succeeded++;
          } catch (err) {
            console.log(chalk.red(`  [${i + 1}/${hits.length}] ${hit.appName ?? "Unnamed"} — ${(err as Error).message}`));
            failed++;
          }
        }

        if (!normalized.dryRun) {
          console.log();
          console.log(chalk.bold("Done! ") + chalk.green(`${succeeded} downloaded`) + (failed ? chalk.red(`, ${failed} failed`) : ""));
          console.log(chalk.dim(`Output: ${outDir}`));
        }
        return;
      }

      const index = toPositiveInt(normalized.index, 1);
      const hit = hits[index - 1];
      if (!hit) {
        throw new Error(`--index must be between 1 and ${hits.length} (got ${index})`);
      }

      const downloadedPath = await downloadHit(hit, keywordValue, runOpts, cfg);
      if (normalized.installTarget && downloadedPath && !normalized.dryRun) {
        await installDownloadedIcon({
          iconPath: downloadedPath,
          installTarget: normalized.installTarget,
          installShortcut: normalized.installShortcut,
          installAppPath: normalized.installAppPath,
          installBackup: normalized.installBackup,
        });
        console.log(chalk.green(`Installed icon → ${normalized.installTarget}`));
      }
    });
}
