export const MACOSICONS_HOSTS = new Set(["macosicons.com", "www.macosicons.com"]);

export function parseImportUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

export function parseIconImportText(text: string): { urls: string[]; invalidCount: number } {
  const seen = new Set<string>();
  const urls: string[] = [];
  let invalidCount = 0;

  for (const line of text.split(/\\r?\\n/)) {
    const value = line.trim();
    if (!value) continue;

    const candidates = value.match(/https:\\/\\/[^\\s<>"']+/gi) || [value];
    let added = false;

    for (const raw of candidates) {
      const cleaned = raw.replace(/[),.;]+$/, "");
      const url = parseImportUrl(cleaned);
      if (!url) continue;

      const host = url.hostname.toLowerCase();
      const supported = MACOSICONS_HOSTS.has(host) ||
        (host === "s3-new.macosicons.com" && /\\.(?:icns|png|jpe?g|webp)(?:$|[?#])/i.test(url.pathname));

      if (!supported) continue;

      const normalized = url.toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        urls.push(normalized);
      }
      added = true;
    }

    if (!added) invalidCount += 1;
    if (urls.length >= 100) break;
  }

  return { urls: urls.slice(0, 100), invalidCount };
}
