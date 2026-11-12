import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const tagPattern =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;

function sectionBody(lines, heading) {
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return null;

  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body;
}

export function validateReleaseNotes(tag, markdown) {
  const errors = [];
  if (typeof tag !== "string" || !tagPattern.test(tag)) {
    errors.push(`Invalid release tag '${tag}'. Expected vMAJOR.MINOR.PATCH with an optional prerelease.`);
    return errors;
  }
  if (typeof markdown !== "string") {
    return ["Release notes must be text."];
  }

  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== `<!-- release-tag: ${tag} -->`) {
    errors.push(`The first line of .github/release.md must be '<!-- release-tag: ${tag} -->'.`);
  }
  if (/\b(?:TODO|TBD|FIXME|REPLACE_ME)\b|vX\.Y\.Z/i.test(normalized)) {
    errors.push("Replace all .github/release.md placeholders before creating the release.");
  }
  if (lines.slice(1).some((line) => line.includes("<!--") || line.includes("-->"))) {
    errors.push("Remove .github/release.md template comments other than the release-tag marker.");
  }

  const summary = sectionBody(lines, "Summary");
  if (!summary || !summary.some((line) => line.trim())) {
    errors.push("Add a summary under the '## Summary' heading.");
  }

  const changes = sectionBody(lines, "Changes");
  if (!changes || !changes.some((line) => /^[-*]\s+\S/.test(line.trim()))) {
    errors.push("Add at least one user-visible change under the '## Changes' heading.");
  }

  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tag, file = ".github/release.md"] = process.argv.slice(2);
  if (!tag) {
    process.stderr.write("Usage: node scripts/validate-release-notes.mjs <tag> [file]\n");
    process.exitCode = 2;
  } else {
    const markdown = readFileSync(file, "utf8");
    const errors = validateReleaseNotes(tag, markdown);
    if (errors.length) {
      process.stderr.write(`${errors.join("\n")}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`Release notes validated for ${tag}.\n`);
    }
  }
}
