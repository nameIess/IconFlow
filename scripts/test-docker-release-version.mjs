import assert from 'node:assert/strict';

// Keep aligned with scripts/docker-release-version.ps1.
const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;
function normalizeVersion(version) {
  if (typeof version !== 'string') throw new TypeError('Version must be a string');
  let normalized = version.trim();
  if (normalized.startsWith('v')) normalized = normalized.slice(1);
  if (!pattern.test(normalized)) throw new Error(`Invalid release version '${normalized}'.`);
  return normalized;
}

for (const [input, expected] of Object.entries({
  '3.1.0': '3.1.0',
  'v3.1.0': '3.1.0',
  '3.1.0-rc.1': '3.1.0-rc.1',
  '0.0.0': '0.0.0',
})) {
  assert.equal(normalizeVersion(input), expected, `normalizing ${input}`);
}
for (const input of ['', '1', '1.2', '01.2.3', '1.2.3+build', '1.2.3-01', '1.2.3-rc..1', 'v']) {
  assert.throws(() => normalizeVersion(input), undefined, `rejecting ${input}`);
}
console.log('Docker release version tests passed.');
