import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const TAG_PATTERN =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;
const IMAGE_TAG_DEFAULT = "${IMAGE_TAG:-latest}";

export function createReleaseCompose(tag, composeTemplate, packageVersion) {
  if (typeof tag !== "string" || !TAG_PATTERN.test(tag)) {
    throw new Error(
      `Invalid release tag '${tag}'. Expected vMAJOR.MINOR.PATCH with an optional prerelease.`,
    );
  }

  const version = tag.slice(1);
  if (packageVersion !== version) {
    throw new Error(
      `Release tag ${tag} does not match package.json version ${packageVersion}.`,
    );
  }

  const occurrences = composeTemplate.split(IMAGE_TAG_DEFAULT).length - 1;
  if (occurrences !== 2) {
    throw new Error(
      `Expected exactly two '${IMAGE_TAG_DEFAULT}' image defaults in the Compose template, found ${occurrences}.`,
    );
  }

  return composeTemplate.replaceAll(IMAGE_TAG_DEFAULT, version);
}

function main() {
  const [tag, templatePath, outputPath] = process.argv.slice(2);
  if (!tag || !templatePath || !outputPath) {
    throw new Error(
      "Usage: node scripts/create-release-compose.mjs <tag> <compose-template> <output-file>",
    );
  }

  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const template = readFileSync(templatePath, "utf8");
  const compose = createReleaseCompose(tag, template, packageJson.version);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, compose);
  process.stdout.write("Created " + outputPath + " pinned to " + tag + ".\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      (error instanceof Error
        ? error.message
        : "Unable to create release Compose asset.") + "\n",
    );
    process.exitCode = 1;
  }
}
