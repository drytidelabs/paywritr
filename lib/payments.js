import { createHash } from 'node:crypto';

import { getPublicKey, finalizeEvent, nip04, SimplePool } from 'nostr-tools';
import { hexToBytes } from 'nostr-tools/utils';
import { useWebSocketImplementation } from 'nostr-tools/pool';
import WS from 'ws';

// Alby relay (`wss://relay.getalby.com/v1`) does NOT negotiate a websocket subprotocol.
// So we must not force one; just provide a Node-compatible WS implementation.
useWebSocketImplementation(WS);

export function parsePaymentsProvider(env = process.env) {
  const raw = String(env.PAYMENTS_PROVIDER || '').trim().toLowerCase();
  if (!raw) return 'alby_hub';
  if (raw === 'lnbits') return 'lnbits';

  // Canonical provider name: alby_hub
  if (raw === 'alby_hub') return 'alby_hub';

  return 'lnbits';
}

export function isPaymentsProviderSupported(provider) {
  return provider === 'lnbits' || provider === 'alby_hub';
}

function redact(str) {
  if (!str) return '';
  // Avoid leaking secrets. Keep only a short fingerprint for debugging.
  const h = createHash('sha256').update(String(str)).digest('hex');
  return `redacted:${h.slice(0, 10)}`;
}

function getAlbyHubUrl(env = process.env) {
  return (env.ALBY_HUB_URL || '').trim();
}

export function parseAlbyHubUrl(hubUrl) {
  const raw = String(hubUrl || '').trim();
  if (!raw) throw new Error('ALBY_HUB_URL is not set');

  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('ALBY_HUB_URL is invalid');
  }

  const proto = String(u.protocol || '').toLowerCase();
  if (proto !== 'nostr+walletconnect:') {
    throw new Error('ALBY_HUB_URL must start with nostr+walletconnect://');
  }

  const walletPubkey = u.hostname;
  // Alby Hub sometimes provides one or multiple `relay=` params.
  const relaysRaw = u.searchParams.getAll('relay').filter(Boolean);
  const relays = relaysRaw
    .map((r) => String(r).trim())
    .filter(Boolean)
    // Normalize common variants (trailing slashes break some relays)
    .map((r) => r.replace(/\/+$/g, ''));

  const relay = relays[0] || '';
  const secretHex = u.searchParams.get('secret') || '';

  // Basic validation without leaking values.
  if (!walletPubkey) throw new Error('ALBY_HUB_URL missing wallet pubkey');
  if (!relay) throw new Error('ALBY_HUB_URL missing relay');
  if (!secretHex) throw new Error('ALBY_HUB_URL missing secret');
  if (!/^[a-f0-9]{64}$/i.test(secretHex)) {
    throw new Error('ALBY_HUB_URL secret must be 32-byte hex');
  }

  const secretKey = hexToBytes(secretHex);

  return {
    walletPubkey,
    relays: relays.length ? relays : [relay],
    secretKey,
    // For safe logging only.
    debug: {
      walletPubkey: `${walletPubkey.slice(0, 8)}…${walletPubkey.slice(-8)}`,
      relay,
      relays,
      secret: redact(secretHex),
      url: redact(raw),
    },
  };
}

export function msatsFromSats(amountSats) {
  const n = Number(amountSats);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error(`invalid amount: ${amountSats} (must be a positive number)`);
    err.statusCode = 400;
    throw err;
  }
  // NIP-47 uses millisatoshis. Keep it integer.
  return Math.trunc(n * 1000);
}

/**
 * Validate that amountSats is a positive integer suitable for invoice creation.
 * Throws a 400-classified error on failure.
 */
function assertValidAmountSats(amountSats) {
  const n = Number(amountSats);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    const err = new Error(`invalid invoice amount: "${amountSats}" (must be a positive integer number of sats)`);
    err.statusCode = 400;
    throw err;
  }
}

function createAlbyHubPool() {
  // Enable keepalive/reconnect when supported by this nostr-tools version.
  // (Fallback to default constructor for compatibility.)
  try {
    return new SimplePool({ enablePing: true, enableReconnect: true });
  } catch {
    return new SimplePool();
  }
}

/**
 * Classify a provider error into a user-friendly category for API consumers.
 */
export function classifyProviderError(e) {
  // AbortError from AbortController (e.g. our LNbits request timeout wrapper).
  if (e && (e.name === 'AbortError' || e.code === 'ABORT_ERR')) {
    return { category: 'timeout', message: 'Payment service is slow, please try again', retryable: true };
  }
  const s = stringifyError(e).toLowerCase();
  if (s.includes('timeout') || s.includes('timed out')) {
    return { category: 'timeout', message: 'Payment service is slow, please try again', retryable: true };
  }
  if (s.includes('closed') || s.includes('econnrefused') || s.includes('econnreset') || s.includes('socket hang up') || s.includes('relay')) {
    return { category: 'unavailable', message: 'Payment service unavailable', retryable: true };
  }
  if (s.includes('not configured')) {
    return { category: 'config', message: 'Payment provider is not configured', retryable: false };
  }
  return { category: 'error', message: "Couldn't process payment request, please try again", retryable: true };
}

function stringifyError(e) {
  if (!e) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || String(e);
  return String(e);
}

function classifyRelayFailure(e) {
  const s = stringifyError(e).toLowerCase();
  if (s.includes('timeout')) return { kind: 'timeout', message: 'timeout' };
  // nostr-tools / relay implementations vary; try to bucket common cases.
  if (s.includes('closed') || s.includes('socket hang up') || s.includes('econnreset')) {
    return { kind: 'relay_closed', message: 'relay closed connection' };
  }
  if (s.includes('notice')) return { kind: 'relay_notice', message: 'relay NOTICE' };
  return { kind: 'relay_error', message: stringifyError(e) || 'relay error' };
}

// Reuse a single pool across calls to avoid reconnect overhead during polling.
const _albyHubPool = createAlbyHubPool();

async function albyHubCall({ relays, walletPubkey, clientSecretKey, method, params, timeoutMs = 30_000 }) {
  const pool = _albyHubPool;
  const targetRelays = Array.isArray(relays) && relays.length ? relays : [];
  const clientPubkey = getPublicKey(clientSecretKey);
  const created_at = Math.floor(Date.now() / 1000);

  const plaintext = JSON.stringify({ method, params: params || {} });
  const content = await nip04.encrypt(clientSecretKey, walletPubkey, plaintext);

  const event = finalizeEvent(
    {
      kind: 23194,
      created_at,
      tags: [['p', walletPubkey]],
      content,
    },
    clientSecretKey
  );

  if (targetRelays.length === 0) {
    throw new Error('no Alby Hub relays configured');
  }

  // publish
  try {
    await Promise.any(pool.publish(targetRelays, event));
  } catch (e) {
    const info = classifyRelayFailure(e);
    const err = new Error(
      info.kind === 'relay_notice'
        ? 'Alby Hub relay rejected request'
        : info.kind === 'relay_closed'
          ? 'Alby Hub relay connection closed'
          : 'failed to publish Alby Hub request'
    );
    err.cause = e;
    err.detail = `${info.message}; relays=${redact(JSON.stringify(targetRelays))}`;
    throw err;
  }

  // wait for response
  const filter = {
    kinds: [23195],
    authors: [walletPubkey],
    '#p': [clientPubkey],
    since: created_at - 2,
  };

  return await new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = (sub) => {
      try {
        sub?.close?.();
      } catch {}
      // Intentionally do not close the shared pool here.
      // The server is long-lived and polling benefits from keeping relay connections warm.
    };

    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup(sub);
      const err = new Error('Alby Hub timeout waiting for response');
      err.detail = `timeoutMs=${timeoutMs}; relays=${redact(JSON.stringify(targetRelays))}`;
      reject(err);
    }, timeoutMs);

    const sub = pool.subscribeMany(targetRelays, filter, {
      onevent: async (ev) => {
        if (settled) return;
        try {
          const decrypted = await nip04.decrypt(clientSecretKey, walletPubkey, ev.content);
          const msg = JSON.parse(decrypted);
          settled = true;
          clearTimeout(t);
          cleanup(sub);
          resolve(msg);
        } catch {
          // ignore unrelated/bad events
        }
      },
    });
  });
}

const LNBITS_TIMEOUT_MS = 15_000;

/**
 * fetch() wrapper with an AbortController timeout for LNbits calls.
 * Throws with name='AbortError' on timeout so classifyProviderError picks it up.
 */
async function lnbitsFetch(url, options = {}, timeoutMs = LNBITS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.code === 'ABORT_ERR')) {
      const err = new Error(`LNbits request timed out after ${timeoutMs}ms`);
      err.name = 'AbortError';
      err.statusCode = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function createInvoice({ provider, amountSats, memo, slug }) {
  if (provider === 'lnbits') {
    const LNBITS_URL = (process.env.LNBITS_URL || '').replace(/\/$/, '');
    const LNBITS_INVOICE_KEY = process.env.LNBITS_INVOICE_KEY || '';
    const LNBITS_READ_KEY = process.env.LNBITS_READ_KEY || '';

    if (!LNBITS_URL || !LNBITS_INVOICE_KEY || !LNBITS_READ_KEY) {
      const err = new Error('LNbits is not configured');
      err.statusCode = 500;
      throw err;
    }

    assertValidAmountSats(amountSats);

    const r = await lnbitsFetch(`${LNBITS_URL}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': LNBITS_INVOICE_KEY,
      },
      body: JSON.stringify({ out: false, amount: amountSats, memo, unit: 'sat' }),
    });

    if (!r.ok) {
      const text = await r.text();
      const err = new Error('failed to create invoice');
      err.statusCode = 502;
      err.detail = text;
      throw err;
    }

    const data = await r.json();
    return {
      payment_hash: data.payment_hash,
      payment_request: data.payment_request,
      provider: 'lnbits',
    };
  }

  if (provider === 'alby_hub') {
    const { relays, walletPubkey, secretKey } = parseAlbyHubUrl(getAlbyHubUrl(process.env));

    const msg = await albyHubCall({
      relays,
      walletPubkey,
      clientSecretKey: secretKey,
      method: 'make_invoice',
      params: {
        // NIP-47 expects amount in millisatoshis.
        amount: msatsFromSats(amountSats),
        description: memo,
      },
    });

    if (msg?.error) {
      const err = new Error('failed to create invoice');
      err.statusCode = 502;
      // Do NOT attach secrets.
      err.detail = String(msg.error?.message || msg.error || 'Alby Hub error');
      throw err;
    }

    const result = msg?.result || {};
    const payment_request = result.invoice || result.bolt11 || result.payment_request;
    const payment_hash = result.payment_hash;
    if (!payment_request || !payment_hash) {
      const err = new Error('bad Alby Hub invoice response');
      err.statusCode = 502;
      throw err;
    }

    return {
      payment_hash,
      payment_request,
      provider: 'alby_hub',
    };
  }

  const err = new Error(`unsupported provider: ${provider}`);
  err.statusCode = 500;
  throw err;
}

export async function checkInvoicePaid({ provider, payment_hash }) {
  if (provider === 'lnbits') {
    const LNBITS_URL = (process.env.LNBITS_URL || '').replace(/\/$/, '');
    const LNBITS_READ_KEY = process.env.LNBITS_READ_KEY || '';

    if (!LNBITS_URL || !LNBITS_READ_KEY) {
      const err = new Error('LNbits is not configured');
      err.statusCode = 500;
      throw err;
    }

    const r = await lnbitsFetch(`${LNBITS_URL}/api/v1/payments/${encodeURIComponent(payment_hash)}`, {
      headers: { 'X-Api-Key': LNBITS_READ_KEY },
    });

    if (!r.ok) {
      const text = await r.text();
      const err = new Error('failed to check payment');
      err.statusCode = 502;
      err.detail = text;
      throw err;
    }

    const data = await r.json();
    return Boolean(data.paid);
  }

  if (provider === 'alby_hub') {
    const { relays, walletPubkey, secretKey } = parseAlbyHubUrl(getAlbyHubUrl(process.env));

    const msg = await albyHubCall({
      relays,
      walletPubkey,
      clientSecretKey: secretKey,
      method: 'lookup_invoice',
      params: { payment_hash },
      // Polling should fail fast; long timeouts can make the UI feel stuck.
      // Tuned based on observed real-world unlock latency.
      timeoutMs: 10_000,
    });

    if (msg?.error) {
      const err = new Error('failed to check payment');
      err.statusCode = 502;
      err.detail = String(msg.error?.message || msg.error || 'Alby Hub error');
      throw err;
    }

    const result = msg?.result || {};
    // NIP-47 implementations differ; accept a few common indicators.
    const paid = Boolean(result.paid || result.preimage || result.settled_at || result.paid_at);
    return paid;
  }

  const err = new Error(`unsupported provider: ${provider}`);
  err.statusCode = 500;
  throw err;
}
