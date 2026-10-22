import { spawnSync } from "node:child_process";

function run(name, executable, args, code) {
  console.log(`[verify] Starting: ${name}`);
  const result = spawnSync(executable, args, { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) {
    console.error(`[verify] Failed stage: ${name}; exit=${result.status ?? result.signal}; error=${result.error?.message ?? "none"}`);
    process.exit(code);
  }
  console.log(`[verify] Passed: ${name}`);
}

run("design-system tests", process.execPath, ["--test", "tests/design-system.test.mjs"], 11);

const converterCases = [
  ["short ICNS header", "files shorter than the container header"],
  ["declared ICNS length", "mismatched declared file length"],
  ["ICNS entry bounds", "entries extending beyond the file"],
  ["PNG representation extraction", "extracts a supported PNG representation"],
  ["PNG dimensions", "unsupported PNG dimensions when no supported representation remains"],
  ["filename safety", "download filenames sanitize unsafe characters"],
  ["empty ZIP", "ZIP builder rejects an empty selection"],
  ["ZIP file structure", "ZIP builder writes a valid local-file signature"],
];

for (let i = 0; i < converterCases.length; i += 1) {
  const [name, pattern] = converterCases[i];
  run(
    `converter test: ${name}`,
    process.execPath,
    ["--test", `--test-name-pattern=${pattern}`, "tests/converter.test.mjs"],
    20 + i,
  );
}

run("import parser tests", process.execPath, ["--test", "tests/import-parser.test.mjs"], 30);
run("resolver tests", process.execPath, ["--test", "tests/resolver.test.mjs"], 31);
run("resolver safeguard tests", process.execPath, ["--test", "tests/resolve-icon.test.mjs"], 32);
run("typecheck", "npm", ["run", "typecheck"], 33);
run("production build", "npm", ["run", "build"], 34);
run("dependency audit", "npm", ["audit", "--audit-level=high"], 35);

console.log("[verify] All quality gates passed.");
