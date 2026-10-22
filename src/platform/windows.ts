import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { convertIcnsToIco } from "../convert.js";

async function resolveIconPathForWindows(iconPath: string): Promise<string> {
  const ext = path.extname(iconPath).toLowerCase();
  if (ext !== ".icns") return iconPath;

  const icoPath = path.join(path.dirname(iconPath), path.basename(iconPath, ".icns") + ".ico");
  await convertIcnsToIco(iconPath, icoPath);
  return icoPath;
}

export async function installToFolderAsync(params: {
  iconPath: string;
  folderPath: string;
}): Promise<void> {
  const icoPath = await resolveIconPathForWindows(params.iconPath);

  const folderPath = params.folderPath;
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder not found: ${folderPath}`);
  }

  const icoInFolder = path.join(folderPath, path.basename(icoPath));
  fs.copyFileSync(icoPath, icoInFolder);

  const desktopIni = path.join(folderPath, "Desktop.ini");
  const content = [
    "[.ShellClassInfo]",
    `IconFile=${path.basename(icoInFolder)}`,
    "IconIndex=0",
    "InfoTip=",
  ].join("\r\n");

  fs.writeFileSync(desktopIni, content, "utf16le");

  try {
    execFileSync("attrib", ["+s", folderPath], { stdio: "pipe" });
    execFileSync("attrib", ["+h", desktopIni], { stdio: "pipe" });
  } catch {
    // Ignore
  }
}

export async function installToShortcut(params: {
  iconPath: string;
  shortcutPath: string;
}): Promise<void> {
  const icoPath = await resolveIconPathForWindows(params.iconPath);

  const { execSync } = await import("child_process");
  const { writeFileSync, unlinkSync } = await import("fs");
  const { tmpdir } = await import("os");
  const scriptPath = path.join(tmpdir(), `mac-icns-seticon-${Date.now()}.ps1`);
  const icoLoc = `${icoPath},0`;
  const script = `
$ws = New-Object -ComObject WScript.Shell
$sh = $ws.CreateShortcut('${params.shortcutPath.replace(/'/g, "''")}')
$sh.IconLocation = '${icoLoc.replace(/'/g, "''")}'
$sh.Save()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null
`;
  try {
    writeFileSync(scriptPath, script, "utf8");
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, { stdio: "pipe" });
  } finally {
    try {
      unlinkSync(scriptPath);
    } catch {
      // ignore
    }
  }
}
