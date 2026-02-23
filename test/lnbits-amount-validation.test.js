/**
 * #159 — LNbits invoice amount validation tests
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createInvoice } from '../lib/payments.js';

const LNBITS_ENV = {
  PAYMENTS_PROVIDER: 'lnbits',
  LNBITS_URL: 'https://lnbits.example.com',
  LNBITS_INVOICE_KEY: 'test-invoice-key',
  LNBITS_READ_KEY: 'test-read-key',
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

test('LNbits createInvoice rejects NaN amount', async () => {
  await withEnv(LNBITS_ENV, async () => {
    await assert.rejects(
      () => createInvoice({ provider: 'lnbits', amountSats: NaN, memo: 'test', slug: 'test' }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});

test('LNbits createInvoice rejects zero amount', async () => {
  await withEnv(LNBITS_ENV, async () => {
    await assert.rejects(
      () => createInvoice({ provider: 'lnbits', amountSats: 0, memo: 'test', slug: 'test' }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});

test('LNbits createInvoice rejects negative amount', async () => {
  await withEnv(LNBITS_ENV, async () => {
    await assert.rejects(
      () => createInvoice({ provider: 'lnbits', amountSats: -5, memo: 'test', slug: 'test' }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});

test('LNbits createInvoice rejects fractional sats', async () => {
  await withEnv(LNBITS_ENV, async () => {
    await assert.rejects(
      () => createInvoice({ provider: 'lnbits', amountSats: 1.5, memo: 'test', slug: 'test' }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});

test('LNbits createInvoice rejects string non-numeric amount', async () => {
  await withEnv(LNBITS_ENV, async () => {
    await assert.rejects(
      () => createInvoice({ provider: 'lnbits', amountSats: 'abc', memo: 'test', slug: 'test' }),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});
