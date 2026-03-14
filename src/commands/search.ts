import { Command } from "commander";
import chalk from "chalk";
import * as p from "@clack/prompts";
import { loadConfig } from "../config.js";
import { searchIcons } from "../api/macosicons.js";
import type { SearchPayload } from "../api/macosicons.js";
import { getSearchFromCache, setSearchCache } from "../cache/search.js";

function toInt(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search <keyword>")
    .description("Search for icons and optionally download via interactive prompt")
    .option("-l, --limit <n>", "Max results (default: 25)", "25")
    .option("-p, --page <n>", "Page number", "1")
    .option("--json", "Output raw JSON")
    .option("-o, --out <dir>", "Output directory for downloads")
    .action(async (keyword: string, opts: { limit?: string; page?: string; json?: boolean; out?: string }) => {
      const cfg = loadConfig();
      if (!cfg.apiKey) {
        console.error(chalk.red("\n✗ API key missing. Set it in .env or global config."));
        process.exit(1);
      }
      const limit = toInt(opts.limit, cfg.defaultLimit);
      const page = toInt(opts.page, 1);
      const offset = (page - 1) * limit;

      let payload: SearchPayload;
      const cached = await getSearchFromCache({ query: keyword, limit, offset }, cfg);
      if (cached) {
        payload = cached;
      } else {
        const spinner = p.spinner();
        spinner.start("Searching...");
        try {
          payload = await searchIcons({ query: keyword, limit, page, apiKey: cfg.apiKey });
          await setSearchCache({ query: keyword, limit, offset }, payload, cfg);
          spinner.stop("Done");
        } catch (err) {
          spinner.stop(chalk.red("Search failed"));
          console.error(chalk.red(`\n✗ ${err instanceof Error ? err.message : String(err)}`));
          process.exitCode = 1;
          return;
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      const hits = payload.hits ?? [];
      if (!hits.length) {
        console.log(chalk.yellow("No icons found."));
        return;
      }

      console.log(chalk.bold(`Found ${payload.totalHits ?? hits.length} result(s). Showing ${hits.length}:\n`));
      hits.forEach((hit, i) => {
        const app = hit.appName ?? "Unnamed";
        const author = hit.usersName ?? "unknown";
        const downloads = typeof hit.downloads === "number" ? hit.downloads : 0;
        const hasIcns = hit.icnsUrl ? chalk.green("✓") : chalk.red("✗");
        console.log(
          `  ${chalk.cyan(String(i + 1).padStart(2))}. ${chalk.bold(app)}  ${chalk.dim(`by ${author}`)}  ${chalk.green(`↓${downloads}`)}  icns: ${hasIcns}`
        );
      });
      console.log();

      const options: { value: string; label: string }[] = hits
        .filter((h) => h.icnsUrl)
        .map((h, i) => {
          const idx = hits.indexOf(h) + 1;
          return { value: String(idx), label: h.appName ?? "Unnamed" };
        });
      options.push({ value: "__all__", label: chalk.green("Download all") });
      options.push({ value: "__cancel__", label: chalk.dim("Cancel") });

      console.log(chalk.cyan("  ↑/↓ move  ·  Space = select  ·  Enter = confirm"));
      console.log();

      const selected = await p.multiselect({
        message: "Choose icons to download",
        options,
      });

      if (p.isCancel(selected)) return;

      const values = selected as string[];
      if (values.includes("__cancel__") || values.length === 0) return;

      let indices: number[];
      if (values.includes("__all__")) {
        indices = hits.map((_, i) => i + 1).filter((_, i) => hits[i].icnsUrl);
      } else {
        indices = values
          .filter((v) => v !== "__all__" && v !== "__cancel__")
          .map((v) => parseInt(v, 10))
          .filter((n) => n > 0 && n <= hits.length);
      }

      if (!indices.length) {
        console.log(chalk.red("\n✗ No valid selection."));
        return;
      }

      const { handleDownload } = await import("./download.js");
      for (const idx of indices) {
        try {
          await handleDownload(
            {
              keyword,
              index: idx,
              out: opts.out,
              limit: opts.limit,
              page: opts.page,
            },
            cfg
          );
        } catch (err) {
          console.error(chalk.red(`✗ ${err instanceof Error ? err.message : String(err)}`));
        }
      }
    });
}
