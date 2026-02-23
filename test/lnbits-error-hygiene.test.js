/**
 * #162 — LNbits error hygiene tests
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createInvoice, checkInvoicePaid, classifyProviderError } from '../lib/payments.js';

const LNBITS_ENV = {
  PAYMENTS_PROVIDER: 'lnbits',
  LNBITS_URL: 'https://lnbits.example.com',
  LNBITS_INVOICE_KEY: 'super-secret-invoice-key',
  LNBITS_READ_KEY: 'super-secret-read-key',
};

function withEnv(env, fn) {
  const backup = {};
  for (const [k, v] of Object.entries(env)) {
    backup[k] = process.env[k];
    process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(backup)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  return fn().finally(restore);
}

test('LNbits createInvoice non-2xx error includes safe detail (no secrets)', async (t) => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => 'db down',
  });
  t.after(() => (globalThis.fetch = origFetch));

  await withEnv(LNBITS_ENV, async () => {
    await assert.rejects(
      () => createInvoice({ provider: 'lnbits', amountSats: 1, memo: 'x', slug: 's' }),
      (err) => {
        assert.equal(err.statusCode, 502);
        assert.ok(String(err.detail || '').includes('lnbits=https://lnbits.example.com'));
        // Do not leak env keys.
        assert.ok(!String(err.detail || '').includes(LNBITS_ENV.LNBITS_INVOICE_KEY));
        assert.ok(!String(err.detail || '').includes(LNBITS_ENV.LNBITS_READ_KEY));
        return true;
      }
    );
  });
});

test('LNbits status non-2xx maps to unavailable category when 5xx', async (t) => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'maintenance',
  });
  t.after(() => (globalThis.fetch = origFetch));

  await withEnv(LNBITS_ENV, async () => {
    await assert.rejects(
      () => checkInvoicePaid({ provider: 'lnbits', payment_hash: 'abc' }),
      (err) => {
        const c = classifyProviderError(err);
        assert.equal(c.category, 'unavailable');
        return true;
      }
    );
  });
});
