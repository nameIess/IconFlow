import type { IconHit } from "./api";

export function mergeUniqueHits(current: IconHit[], next: IconHit[]): IconHit[] {
  const seen = new Set<string>();
  const merged: IconHit[] = [];
  for (const hit of [...current, ...next]) {
    const keys = [
      hit.objectID ? `id:${hit.objectID.toLowerCase()}` : "",
      hit.icnsUrl ? `icns:${hit.icnsUrl.toLowerCase()}` : "",
      hit.lowResPngUrl ? `preview:${hit.lowResPngUrl.toLowerCase()}` : "",
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) continue;
    if (!keys.length)
      keys.push(`name:${hit.appName.toLowerCase()}:${merged.length}`);
    keys.forEach((key) => seen.add(key));
    merged.push(hit);
  }
  return merged;
}

export function mergeImportedHits(
  current: IconHit[],
  incoming: IconHit[],
  alreadyViewingImports: boolean,
): IconHit[] {
  return mergeUniqueHits(alreadyViewingImports ? current : [], incoming);
}

export function retrySelection(
  selected: { id: string }[],
  failedIds: ReadonlySet<string>,
): Set<string> {
  return new Set(
    selected.filter(({ id }) => failedIds.has(id)).map(({ id }) => id),
  );
}
