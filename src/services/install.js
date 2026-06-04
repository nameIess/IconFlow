const fs = require("fs");
const path = require("path");
const { execFileSync, execSync } = require("child_process");
const { convertIcnsToIco } = require("./download");

async function resolveIcoPath(iconPath) {
  const ext = path.extname(iconPath).toLowerCase();
  if (ext !== ".icns") return iconPath;
  const icoPath = iconPath.replace(/\.icns$/i, ".ico");
  await convertIcnsToIco(iconPath, icoPath);
  return icoPath;
}

async function installToFolder(iconPath, folderPath) {
  const icoPath = await resolveIcoPath(iconPath);
  if (!fs.existsSync(folderPath)) throw new Error("Folder not found: " + folderPath);

  const dest = path.join(folderPath, path.basename(icoPath));
  fs.copyFileSync(icoPath, dest);

  const ini = path.join(folderPath, "Desktop.ini");
  fs.writeFileSync(
    ini,
    `[.ShellClassInfo]\r\nIconFile=${path.basename(dest)}\r\nIconIndex=0\r\nInfoTip=`,
    "utf16le"
  );

  try { execFileSync("attrib", ["+s", folderPath], { stdio: "pipe" }); } catch {}
  try { execFileSync("attrib", ["+h", ini], { stdio: "pipe" }); } catch {}
}

async function installToShortcut(iconPath, shortcutPath) {
  const icoPath = await resolveIcoPath(iconPath);
  const script = `$ws = New-Object -ComObject WScript.Shell; $sh = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}'); $sh.IconLocation = '${icoPath.replace(/'/g, "''")}'; $sh.Save(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null`;
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, { stdio: "pipe" });
}

module.exports = { installToFolder, installToShortcut };
