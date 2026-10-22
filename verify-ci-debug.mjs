import { spawnSync } from "node:child_process";

const checks = [
  { name: "design-system tests", executable: process.execPath, args: ["--test", "tests/design-system.test.mjs"], code: 11 },
  { name: "converter tests", executable: process.execPath, args: ["--test", "tests/converter.test.mjs"], code: 12 },
  { name: "import parser tests", executable: process.execPath, args: ["--test", "tests/import-parser.test.mjs"], code: 13 },
  { name: "resolver tests", executable: process.execPath, args: ["--test", "tests/resolver.test.mjs"], code: 14 },
  { name: "resolver safeguard tests", executable: process.execPath, args: ["--test", "tests/resolve-icon.test.mjs"], code: 15 },
  { name: "typecheck", executable: "npm", args: ["run", "typecheck"], code: 16 },
  { name: "production build", executable: "npm", args: ["run", "build"], code: 17 },
  { name: "dependency audit", executable: "npm", args: ["audit", "--audit-level=high"], code: 18 },
];

for (const check of checks) {
  console.log(`[verify] Starting: ${check.name}`);
  const result = spawnSync(check.executable, check.args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(`[verify] Could not start ${check.name}: ${result.error.message}`);
    process.exit(check.code);
  }

  if (result.status !== 0) {
    console.error(`[verify] Failed stage: ${check.name}; exit=${result.status ?? result.signal}`);
    process.exit(check.code);
  }

  console.log(`[verify] Passed: ${check.name}`);
}

console.log("[verify] All quality gates passed.");
