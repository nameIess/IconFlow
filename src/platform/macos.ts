import fs from "fs";
import path from "path";

export function installToApp(params: {
  icnsPath: string;
  appName: string;
  appPath?: string;
  backup?: boolean;
}): void {
  const { icnsPath, appName, appPath: appPathOverride, backup } = params;
  const appPath = appPathOverride ?? `/Applications/${appName}.app`;

  if (!fs.existsSync(icnsPath)) {
    throw new Error(`Icon file not found: ${icnsPath}`);
  }
  if (!fs.existsSync(appPath)) {
    throw new Error(`App not found: ${appPath}\nUse --app-path to specify the full path.`);
  }

  const resourcesDir = path.join(appPath, "Contents", "Resources");
  if (!fs.existsSync(resourcesDir)) {
    throw new Error(`Invalid .app bundle (no Resources): ${resourcesDir}`);
  }

  let iconFileName = "AppIcon.icns";
  const plistPath = path.join(appPath, "Contents", "Info.plist");
  if (fs.existsSync(plistPath)) {
    const content = fs.readFileSync(plistPath, "utf8");
    const match = content.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/);
    if (match) {
      iconFileName = match[1];
      if (!iconFileName.endsWith(".icns")) iconFileName += ".icns";
    }
  }

  const targetPath = path.join(resourcesDir, iconFileName);
  if (backup && fs.existsSync(targetPath)) {
    fs.copyFileSync(targetPath, targetPath + ".backup");
  }

  fs.copyFileSync(icnsPath, targetPath);
}
