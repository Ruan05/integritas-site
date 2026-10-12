import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('team cards keep safe heights from tablet through wide desktop', async () => {
  const [page, css] = await Promise.all([
    readFile(`${root}/app/page.tsx`, 'utf8'),
    readFile(`${root}/app/globals.css`, 'utf8'),
  ]);

  assert.match(page, /grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8/);
  assert.match(css, /\.flip-card\s*\{[\s\S]*?height:\s*590px;[\s\S]*?isolation:\s*isolate;/);
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.flip-card\s*\{\s*height:\s*600px;/);
});
