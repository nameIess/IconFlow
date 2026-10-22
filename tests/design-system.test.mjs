import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `Expected ${name} color token`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("light-theme secondary text meets WCAG AA normal-text contrast", () => {
  const lightTheme = styles.match(/:root\[data-theme="light"\]\s*\{([^}]+)\}/);
  assert.ok(lightTheme, "Expected a light-theme token block");
  const foreground = token(lightTheme[1], "muted-2");
  const background = token(lightTheme[1], "bg");
  const ratio = contrastRatio(foreground, background);
  assert.ok(ratio >= 4.5, `Expected at least 4.5:1 contrast, got ${ratio.toFixed(2)}:1`);
});

test("all custom dialogs expose focusable dialog containers and keyboard focus containment", () => {
  assert.equal((app.match(/role="dialog" aria-modal="true"/g) || []).length, 3);
  assert.equal((app.match(/role="dialog" aria-modal="true"[^>]*tabIndex=\{?-1\}?/g) || []).length, 3);
  assert.match(app, /event\.key !== "Tab"/);
  assert.match(app, /dialogReturnFocusRef\.current\?\.focus\(\)/);
});

test("CI runs on master and feature branch pushes and on pull requests to master", () => {
  assert.ok(workflow.includes("pull_request:\n    branches:\n      - master"));
  assert.ok(workflow.includes("push:\n    branches:\n      - master\n      - 'feature/**'"));
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /npm test/);
});
