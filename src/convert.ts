import fs from "fs";
import path from "path";
import { Icns } from "@fiahfy/icns";
import sharp from "sharp";
import ico from "sharp-ico";

/**
 * Extract the largest image from an ICNS file and convert to ICO.
 * ICNS contains multiple sizes; we use the largest available for best quality.
 */
export async function convertIcnsToIco(icnsPath: string, icoPath: string): Promise<void> {
  const buf = fs.readFileSync(icnsPath);
  const icns = Icns.from(buf);

  if (!icns.images || icns.images.length === 0) {
    throw new Error(`No images found in ICNS file: ${icnsPath}`);
  }

  // Find largest image buffer
  let bestBuffer: Buffer | null = null;
  let bestSize = 0;

  for (const img of icns.images) {
    const data = (img as { image?: Buffer }).image;
    if (!Buffer.isBuffer(data)) continue;
    const size = data.length;
    if (size > bestSize) {
      bestSize = size;
      bestBuffer = data;
    }
  }

  if (!bestBuffer) {
    throw new Error(`Could not extract image data from ICNS: ${icnsPath}`);
  }

  fs.mkdirSync(path.dirname(icoPath), { recursive: true });
  const sharpInstance = sharp(bestBuffer);
  await ico.sharpsToIco([sharpInstance], icoPath, {
    sizes: [256, 128, 64, 48, 32, 24, 16],
    resizeOptions: {},
  });
}
