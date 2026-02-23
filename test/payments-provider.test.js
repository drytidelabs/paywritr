import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePaymentsProvider, msatsFromSats } from '../lib/payments.js';

test('parsePaymentsProvider defaults to alby_hub', () => {
  assert.equal(parsePaymentsProvider({}), 'alby_hub');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: '' }), 'alby_hub');
});

test('parsePaymentsProvider supports lnbits', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'lnbits' }), 'lnbits');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'LNBITS' }), 'lnbits');
});

test('parsePaymentsProvider supports alby_hub', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'alby_hub' }), 'alby_hub');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'ALBY_HUB' }), 'alby_hub');
});

test('parsePaymentsProvider falls back to alby_hub on unknown', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'something-else' }), 'alby_hub');
});

test('Alby Hub amounts are millisats (msats)', () => {
  // NIP-47 uses millisatoshis: 1 sat = 1000 msats.
  assert.equal(msatsFromSats(50), 50_000);
  assert.equal(msatsFromSats('50'), 50_000);
  // Ensure integer msats even if caller passes a float.
  assert.equal(msatsFromSats(1.2345), 1234);
});

// #159 — msatsFromSats should throw on invalid amounts
test('msatsFromSats throws on non-numeric input', () => {
  assert.throws(() => msatsFromSats('nope'), { statusCode: 400 });
});

test('msatsFromSats throws on NaN', () => {
  assert.throws(() => msatsFromSats(NaN), { statusCode: 400 });
});

test('msatsFromSats throws on zero', () => {
  assert.throws(() => msatsFromSats(0), { statusCode: 400 });
});

test('msatsFromSats throws on negative', () => {
  assert.throws(() => msatsFromSats(-1), { statusCode: 400 });
});
