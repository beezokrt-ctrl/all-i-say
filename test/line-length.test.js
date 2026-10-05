import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

async function violationsIn(directory) {
  const violations = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      violations.push(...await violationsIn(filename));
    } else if (entry.isFile()) {
      const lines = (await readFile(filename, 'utf8')).split(/\r?\n/);
      lines.forEach((line, index) => {
        const length = [...line].length;
        if (length > 120) {
          violations.push(`${path.relative(root, filename)}:${index + 1}: ${length} characters`);
        }
      });
    }
  }
  return violations;
}

test('archive source lines stay within 120 characters', async () => {
  const violations = (await Promise.all(
    ['js', 'css', 'data'].map(directory => violationsIn(path.join(root, directory)))
  )).flat();
  assert.deepEqual(violations, [], violations.join('\n'));
});
