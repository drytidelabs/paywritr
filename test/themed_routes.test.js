import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

import { app } from '../server.js';

/** @type {import('node:http').Server} */
let server;
let baseUrl;

async function httpGet(routePath) {
  const res = await fetch(`${baseUrl}${routePath}`, { redirect: 'manual' });
  const text = await res.text();
  return { res, text };
}

function assertThemeCssPresent(html) {
  // We don't want to overfit to exact theme name/path.
  // Mustache templates may escape '/' as '&#x2F;'.
  assert.match(html, /<link[^>]+href="(?:\/themes\/|&#x2F;themes&#x2F;)/i);
  assert.match(html, /theme\.css/i);
}

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object' && 'port' in addr);
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('GET / returns 200 and themed output', async () => {
  const { res, text } = await httpGet('/');
  assert.equal(res.status, 200);
  assertThemeCssPresent(text);
  assert.match(text, /<main\b/);
});

test('GET /p/free-note/ returns 200 and no paywall container', async () => {
  const { res, text } = await httpGet('/p/free-note/');
  assert.equal(res.status, 200);
  assertThemeCssPresent(text);
  assert.ok(!text.includes('id="paywall"'));
  assert.match(text, /<h1>\s*Free note\s*<\/h1>/i);
});

test('GET /p/hello-paywall/ returns 200 and includes paywall container', async () => {
  const { res, text } = await httpGet('/p/hello-paywall/');
  assert.equal(res.status, 200);
  assertThemeCssPresent(text);
  assert.ok(text.includes('id="paywall"'));
  assert.match(text, /data-slug="hello-paywall"/);
});

test('GET /about/ returns 200 (page route)', async () => {
  const { res, text } = await httpGet('/about/');
  assert.equal(res.status, 200);
  assertThemeCssPresent(text);
  assert.match(text, /<h1>\s*About\s*<\/h1>/);
});

test('GET /nope/ returns 404 (not 500)', async () => {
  const { res, text } = await httpGet('/nope/');
  assert.equal(res.status, 404);
  // still themed (404 should render via theme template)
  assertThemeCssPresent(text);
  assert.match(text, /Not found/i);
});

test('fallback behavior: missing kind template still renders (no 500)', async () => {
  const templatesDir = path.join(process.cwd(), 'themes', 'classic', 'templates');
  const postTpl = path.join(templatesDir, 'post.mustache');
  const bakTpl = path.join(templatesDir, 'post.mustache.__bak');

  // If this test previously crashed and left a backup behind, restore it first.
  try {
    await fs.stat(bakTpl);
    await fs.rename(bakTpl, postTpl);
  } catch {
    // ignore
  }

  await fs.rename(postTpl, bakTpl);
  try {
    const { res, text } = await httpGet('/p/free-note/');
    assert.equal(res.status, 200);
    assertThemeCssPresent(text);
    assert.match(text, /<h1>\s*Free note\s*<\/h1>/i);
  } finally {
    await fs.rename(bakTpl, postTpl);
  }
});
