import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { app } from '../server.js';

describe('Draft exclusion (#43)', () => {
  let server;
  let base;

  before(async () => {
    server = app.listen(0);
    await once(server, 'listening');
    const addr = server.address();
    base = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (!server) return;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('draft post is not listed on home page', async () => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(!html.includes('draft-test'), 'draft-test slug should not appear on home page');
    assert.ok(!html.includes('Draft Test Post'), 'draft title should not appear on home page');
  });

  it('draft post returns 404 on direct access', async () => {
    const res = await fetch(base + '/p/draft-test/');
    assert.equal(res.status, 404);
  });

  it('draft post invoice creation returns 404', async () => {
    const res = await fetch(base + '/api/invoice?slug=draft-test');
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.error, 'unknown post');
  });
});
