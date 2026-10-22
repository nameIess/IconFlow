import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import os from "os";
import fs from "fs";
import { installToApp } from "../platform/macos.js";
import { installToFolderAsync, installToShortcut } from "../platform/windows.js";

export function registerInstallCommand(program: Command): void {
  program
    .command("install <icon-file> <target>")
    .description("Install icon to app (macOS), folder, or shortcut (Windows)")
    .option("--app-path <path>", "Full path to .app bundle (macOS)")
    .option("--backup", "Back up original icon before replacing")
    .option("-s, --shortcut", "Target is a .lnk shortcut path (Windows)")
    .action(async (iconFile: string, target: string, opts: { "app-path"?: string; backup?: boolean; shortcut?: boolean }) => {
      const platform = os.platform();
      const resolvedIcon = path.resolve(process.cwd(), iconFile);

      if (!fs.existsSync(resolvedIcon)) {
        console.error(chalk.red(`\n✗ Icon file not found: ${resolvedIcon}`));
        process.exit(1);
      }

      if (platform === "darwin") {
        if (opts.shortcut) {
          console.log(chalk.yellow("\n--shortcut is for Windows only."));
          process.exit(1);
        }
        try {
          installToApp({
            icnsPath: resolvedIcon,
            appName: target,
            appPath: opts["app-path"],
            backup: opts.backup,
          });
          console.log(chalk.green("\n✓ Icon installed successfully!"));
          console.log(chalk.cyan(`  App:  ${opts["app-path"] ?? `/Applications/${target}.app`}`));
          console.log(chalk.dim("\n  Note: You may need to run: killall Dock"));
        } catch (err) {
          console.error(chalk.red(`\n✗ ${(err as Error).message}`));
          process.exit(1);
        }
        return;
      }

      if (platform === "win32") {
        const targetPath = path.resolve(process.cwd(), target);
        try {
          if (opts.shortcut) {
            await installToShortcut({ iconPath: resolvedIcon, shortcutPath: targetPath });
            console.log(chalk.green("\n✓ Shortcut icon updated!"));
            console.log(chalk.cyan(`  Shortcut: ${targetPath}`));
          } else {
            await installToFolderAsync({ iconPath: resolvedIcon, folderPath: targetPath });
            console.log(chalk.green("\n✓ Folder icon applied!"));
            console.log(chalk.cyan(`  Folder: ${targetPath}`));
          }
        } catch (err) {
          console.error(chalk.red(`\n✗ ${(err as Error).message}`));
          process.exit(1);
        }
        return;
      }

      console.log(chalk.yellow("\n⚠ Icon installation is only supported on macOS and Windows."));
      console.log("  On Linux, transfer the icon to a Mac or Windows system.");
      process.exit(1);
    });
}
