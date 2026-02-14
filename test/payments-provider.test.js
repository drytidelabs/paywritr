import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePaymentsProvider, msatsFromSats } from '../lib/payments.js';

test('parsePaymentsProvider defaults to lnbits', () => {
  assert.equal(parsePaymentsProvider({}), 'lnbits');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: '' }), 'lnbits');
});

test('parsePaymentsProvider supports lnbits', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'lnbits' }), 'lnbits');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'LNBITS' }), 'lnbits');
});

test('parsePaymentsProvider supports alby_hub', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'alby_hub' }), 'alby_hub');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'ALBY_HUB' }), 'alby_hub');
});

test('parsePaymentsProvider falls back to lnbits on unknown', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'something-else' }), 'lnbits');
});

test('Alby Hub amounts are millisats (msats)', () => {
  // NIP-47 uses millisatoshis: 1 sat = 1000 msats.
  assert.equal(msatsFromSats(50), 50_000);
  assert.equal(msatsFromSats('50'), 50_000);
  // Ensure integer msats even if caller passes a float.
  assert.equal(msatsFromSats(1.2345), 1234);
  assert.ok(Number.isNaN(msatsFromSats('nope')));
});
