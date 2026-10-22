const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const ICNS_HEADER_SIZE = 8;
const ICNS_ENTRY_HEADER_SIZE = 8;
const MAX_ICNS_BYTES = 64 * 1024 * 1024;
const MAX_RENDER_SIZE = 1024;

function isPng(bytes: Uint8Array, offset: number): boolean {
  return offset >= 0 && offset + PNG.length <= bytes.length &&
    PNG.every((value, index) => bytes[offset + index] === value);
}

function typeSize(type: string): number {
  const sizes: Record<string, number> = {
    icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256,
    ic09: 512, ic10: 1024, ic11: 32, ic12: 64, ic13: 256, ic14: 512,
  };
  return sizes[type] || 0;
}

function readType(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function blobBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

function pngDimensions(png: Uint8Array): { width: number; height: number } {
  if (png.length < 24 || !isPng(png, 0)) {
    throw new Error("The extracted ICNS data does not contain a valid PNG header.");
  }

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);

  if (!width || !height || width > MAX_RENDER_SIZE || height > MAX_RENDER_SIZE) {
    throw new Error("The icon dimensions are unsupported or unsafe to render.");
  }

  return { width, height };
}

function validateIcns(buffer: ArrayBuffer): void {
  if (buffer.byteLength < ICNS_HEADER_SIZE) {
    throw new Error("The downloaded file is too small to be a valid ICNS file.");
  }
  if (buffer.byteLength > MAX_ICNS_BYTES) {
    throw new Error("The ICNS file is too large to process safely.");
  }

  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 105 || bytes[1] !== 99 || bytes[2] !== 110 || bytes[3] !== 115) {
    throw new Error("The downloaded file is not a valid ICNS file.");
  }

  const view = new DataView(buffer);
  const declaredLength = view.getUint32(4);
  if (declaredLength !== buffer.byteLength) {
    throw new Error("The ICNS file has an invalid declared length.");
  }
}

export function extractBestPng(buffer: ArrayBuffer): Uint8Array {
  validateIcns(buffer);

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const candidates: { size: number; data: Uint8Array }[] = [];
  let offset = ICNS_HEADER_SIZE;

  while (offset + ICNS_ENTRY_HEADER_SIZE <= bytes.length) {
    const type = readType(view, offset);
    const length = view.getUint32(offset + 4);

    if (length < ICNS_ENTRY_HEADER_SIZE || offset + length > bytes.length) {
      throw new Error("The ICNS file contains an invalid entry length.");
    }

    const start = offset + ICNS_ENTRY_HEADER_SIZE;
    const end = offset + length;

    for (let cursor = start; cursor + PNG.length <= end; cursor += 1) {
      if (isPng(bytes, cursor)) {
        const candidate = bytes.slice(cursor, end);
        try {
          pngDimensions(candidate);
          candidates.push({ size: typeSize(type), data: candidate });
        } catch {
          // Ignore malformed PNG representations and continue safely.
        }
        break;
      }
    }

    offset = end;
  }

  if (offset !== bytes.length) {
    throw new Error("The ICNS file contains an incomplete entry.");
  }

  candidates.sort((a, b) => b.size - a.size || b.data.length - a.data.length);
  if (!candidates.length) {
    throw new Error("This ICNS uses a representation not supported by the browser converter yet.");
  }

  return candidates[0].data;
}

async function imageFromPng(png: Uint8Array): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([blobBytes(png)], { type: "image/png" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderPng(source: Uint8Array, size: number): Promise<Uint8Array> {
  if (!Number.isInteger(size) || size < 1 || size > MAX_RENDER_SIZE) {
    throw new Error("The requested icon size is invalid.");
  }

  const image = await imageFromPng(source);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");

  context.clearRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size, size);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encoding failed.");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function icnsToPng(buffer: ArrayBuffer): Promise<Blob> {
  const source = extractBestPng(buffer);
  const { width, height } = pngDimensions(source);
  const size = Math.max(width, height);
  return new Blob([blobBytes(await renderPng(source, size))], { type: "image/png" });
}

export async function icnsToIco(buffer: ArrayBuffer): Promise<Blob> {
  const source = extractBestPng(buffer);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map((size) => renderPng(source, size)));
  const imageStart = 6 + sizes.length * 16;
  const total = imageStart + images.reduce((sum, item) => sum + item.length, 0);

  if (!Number.isSafeInteger(total) || total > 0xffffffff) {
    throw new Error("The generated ICO file is too large.");
  }

  const output = new ArrayBuffer(total);
  const view = new DataView(output);
  const bytes = new Uint8Array(output);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, sizes.length, true);

  let cursor = imageStart;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    const image = images[index];

    view.setUint8(entry, size === 256 ? 0 : size);
    view.setUint8(entry + 1, size === 256 ? 0 : size);
    view.setUint8(entry + 2, 0);
    view.setUint8(entry + 3, 0);
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, image.length, true);
    view.setUint32(entry + 12, cursor, true);

    bytes.set(image, cursor);
    cursor += image.length;
  });

  return new Blob([output], { type: "image/x-icon" });
}

export function previewUrl(buffer: ArrayBuffer): Promise<string> {
  return Promise.resolve(
    URL.createObjectURL(new Blob([blobBytes(extractBestPng(buffer))], { type: "image/png" })),
  );
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function filename(name: string, extension: string): string {
  const safeExtension = extension === "png" || extension === "ico" ? extension : "png";
  const sanitized = name
    .replace(/[\\/<>:"|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  const base = sanitized || "icon";
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base) ? `_${base}` : base;
  return `${reserved}.${safeExtension}`;
}
