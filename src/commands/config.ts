import { Command } from "commander";
import chalk from "chalk";
import { GLOBAL_CONFIG_PATH, loadConfig, getConfigDir, ensureConfigDir } from "../config.js";
import fs from "fs";

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("Show or manage global configuration")
    .option("-p, --path", "Show global config file path")
    .option("-s, --show", "Show current resolved config")
    .action((opts: { path?: boolean; show?: boolean }) => {
      if (opts.show) {
        const cfg = loadConfig();
        console.log(chalk.bold.cyan("mac-icns configuration\n"));
        console.log("  API key:    ", cfg.apiKey ? "***" + cfg.apiKey.slice(-4) : "(not set)");
        console.log("  Download:   ", cfg.downloadDir);
        console.log("  Download ICO:", cfg.downloadDirIco ?? "(same as download)");
        console.log("  Limit:      ", cfg.defaultLimit);
        console.log("  Cache:      ", cfg.cachePath);
        console.log("  Cache TTL:  ", cfg.cacheTtlHours, "hours");
        return;
      }
      ensureConfigDir();
      console.log(chalk.bold.cyan("mac-icns global config path:"));
      console.log(chalk.cyan(GLOBAL_CONFIG_PATH));
      if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
        console.log(chalk.dim("\nFile exists. Use a text editor to modify it."));
      } else {
        console.log(chalk.dim("\nFile does not exist yet. Create it with:"));
        console.log(chalk.dim(`  mkdir -p "${getConfigDir()}"`));
        console.log(chalk.dim(`  echo '{"apiKey":"YOUR_KEY","downloadDir":"..."}' > "${GLOBAL_CONFIG_PATH}"`));
      }
    });
}
