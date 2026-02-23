/**
 * #158 — LNbits request timeout tests
 *
 * Strategy: replace the global `fetch` with a mock that simulates
 * an AbortError (i.e. the AbortController fired before the response arrived).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';

import { createInvoice, checkInvoicePaid, classifyProviderError } from '../lib/payments.js';

// Shared env stubs for LNbits
const LNBITS_ENV = {
  PAYMENTS_PROVIDER: 'lnbits',
  LNBITS_URL: 'https://lnbits.example.com',
  LNBITS_INVOICE_KEY: 'test-invoice-key',
  LNBITS_READ_KEY: 'test-read-key',
};

function makeAbortError() {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  err.code = 'ABORT_ERR';
  return err;
}

test('classifyProviderError classifies AbortError as timeout (retryable)', () => {
  const result = classifyProviderError(makeAbortError());
  assert.equal(result.category, 'timeout');
  assert.equal(result.retryable, true);
});

test('classifyProviderError classifies "timed out" message as timeout (retryable)', () => {
  const err = new Error('LNbits request timed out after 15000ms');
  err.statusCode = 504;
  const result = classifyProviderError(err);
  assert.equal(result.category, 'timeout');
  assert.equal(result.retryable, true);
});

test('LNbits createInvoice surfaces timeout when fetch aborts', async (t) => {
  // Patch global fetch to simulate abort.
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (_url, opts) => {
    // Simulate the signal firing.
    if (opts?.signal) {
      const err = makeAbortError();
      throw err;
    }
    throw new Error('unexpected fetch call without signal');
  };

  t.after(() => {
    globalThis.fetch = origFetch;
  });

  const env = { ...LNBITS_ENV };
  // Temporarily override process.env for the duration of this call.
  const envBackup = {};
  for (const [k, v] of Object.entries(env)) {
    envBackup[k] = process.env[k];
    process.env[k] = v;
  }
  t.after(() => {
    for (const [k, v] of Object.entries(envBackup)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  await assert.rejects(
    () => createInvoice({ provider: 'lnbits', amountSats: 100, memo: 'test', slug: 'test' }),
    (err) => {
      assert.ok(err.name === 'AbortError' || err.message.includes('timed out') || err.message.includes('aborted'),
        `Expected timeout/abort error, got: ${err.message}`);
      return true;
    }
  );
});

test('LNbits checkInvoicePaid surfaces timeout when fetch aborts', async (t) => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (_url, opts) => {
    if (opts?.signal) {
      throw makeAbortError();
    }
    throw new Error('unexpected fetch call without signal');
  };

  t.after(() => {
    globalThis.fetch = origFetch;
  });

  const envBackup = {};
  for (const [k, v] of Object.entries(LNBITS_ENV)) {
    envBackup[k] = process.env[k];
    process.env[k] = v;
  }
  t.after(() => {
    for (const [k, v] of Object.entries(envBackup)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  await assert.rejects(
    () => checkInvoicePaid({ provider: 'lnbits', payment_hash: 'abc123' }),
    (err) => {
      assert.ok(err.name === 'AbortError' || err.message.includes('timed out') || err.message.includes('aborted'),
        `Expected timeout/abort error, got: ${err.message}`);
      return true;
    }
  );
});
