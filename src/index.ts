#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { registerSearchCommand } from "./commands/search.js";
import { registerDownloadCommand } from "./commands/download.js";
import { registerInstallCommand } from "./commands/install.js";
import { registerConfigCommand } from "./commands/config.js";

const program = new Command();

program
  .name("mac-icns")
  .description("Search and download macOS icons from macosicons.com")
  .version("1.0.0");

registerSearchCommand(program);
registerDownloadCommand(program);
registerInstallCommand(program);
registerConfigCommand(program);

program.parseAsync().catch((err) => {
  console.error(chalk.red(`\n✗ ${err instanceof Error ? err.message : String(err)}`));
  process.exitCode = 1;
});
