import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePaymentsProvider } from '../lib/payments.js';

test('parsePaymentsProvider defaults to lnbits', () => {
  assert.equal(parsePaymentsProvider({}), 'lnbits');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: '' }), 'lnbits');
});

test('parsePaymentsProvider supports lnbits', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'lnbits' }), 'lnbits');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'LNBITS' }), 'lnbits');
});

test('parsePaymentsProvider supports alby_nwc aliases', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'alby_nwc' }), 'alby_nwc');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'alby-nwc' }), 'alby_nwc');
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'nwc' }), 'alby_nwc');
});

test('parsePaymentsProvider falls back to lnbits on unknown', () => {
  assert.equal(parsePaymentsProvider({ PAYMENTS_PROVIDER: 'something-else' }), 'lnbits');
});
