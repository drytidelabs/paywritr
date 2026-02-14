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
  if (!raw) return 'lnbits';
  if (raw === 'lnbits') return 'lnbits';
  if (raw === 'alby_nwc' || raw === 'alby-nwc' || raw === 'nwc') return 'alby_nwc';
  return 'lnbits';
}

export function isPaymentsProviderSupported(provider) {
  return provider === 'lnbits' || provider === 'alby_nwc';
}

function redact(str) {
  if (!str) return '';
  // Avoid leaking secrets. Keep only a short fingerprint for debugging.
  const h = createHash('sha256').update(String(str)).digest('hex');
  return `redacted:${h.slice(0, 10)}`;
}

export function parseAlbyNwcUrl(nwcUrl) {
  const raw = String(nwcUrl || '').trim();
  if (!raw) throw new Error('ALBY_NWC_URL is not set');

  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('ALBY_NWC_URL is invalid');
  }

  const proto = String(u.protocol || '').toLowerCase();
  if (proto !== 'nostr+walletconnect:') {
    throw new Error('ALBY_NWC_URL must start with nostr+walletconnect://');
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
  if (!walletPubkey) throw new Error('ALBY_NWC_URL missing wallet pubkey');
  if (!relay) throw new Error('ALBY_NWC_URL missing relay');
  if (!secretHex) throw new Error('ALBY_NWC_URL missing secret');
  if (!/^[a-f0-9]{64}$/i.test(secretHex)) {
    throw new Error('ALBY_NWC_URL secret must be 32-byte hex');
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

async function nwcCall({ relays, walletPubkey, clientSecretKey, method, params, timeoutMs = 30_000 }) {
  const pool = new SimplePool();
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
    throw new Error('no NWC relays configured');
  }

  // publish
  let pubOk = false;
  try {
    await Promise.any(pool.publish(targetRelays, event));
    pubOk = true;
  } catch {
    // handled below
  }
  if (!pubOk) {
    throw new Error('failed to publish NWC request');
  }

  // wait for response
  const filter = {
    kinds: [23195],
    authors: [walletPubkey],
    '#p': [clientPubkey],
    since: created_at - 2,
  };

  return await new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try {
        sub.close();
      } catch {}
      try {
        pool.close(targetRelays);
      } catch {}
      reject(new Error('NWC timeout'));
    }, timeoutMs);

    const sub = pool.subscribeMany(
      targetRelays,
      filter,
      {
        onevent: async (ev) => {
          try {
            const decrypted = await nip04.decrypt(clientSecretKey, walletPubkey, ev.content);
            const msg = JSON.parse(decrypted);
            clearTimeout(t);
            try {
              sub.close();
            } catch {}
            try {
              pool.close(targetRelays);
            } catch {}
            resolve(msg);
          } catch {
            // ignore unrelated/bad events
          }
        },
      }
    );
  });
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

    const r = await fetch(`${LNBITS_URL}/api/v1/payments`, {
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

  if (provider === 'alby_nwc') {
    const { relays, walletPubkey, secretKey } = parseAlbyNwcUrl(process.env.ALBY_NWC_URL);

    const msg = await nwcCall({
      relays,
      walletPubkey,
      clientSecretKey: secretKey,
      method: 'make_invoice',
      params: {
        // NIP-47 (NWC) expects amount in millisatoshis.
        amount: Math.trunc(Number(amountSats) * 1000),
        description: memo,
      },
    });

    if (msg?.error) {
      const err = new Error('failed to create invoice');
      err.statusCode = 502;
      // Do NOT attach secrets.
      err.detail = String(msg.error?.message || msg.error || 'NWC error');
      throw err;
    }

    const result = msg?.result || {};
    const payment_request = result.invoice || result.bolt11 || result.payment_request;
    const payment_hash = result.payment_hash;
    if (!payment_request || !payment_hash) {
      const err = new Error('bad NWC invoice response');
      err.statusCode = 502;
      throw err;
    }

    return {
      payment_hash,
      payment_request,
      provider: 'alby_nwc',
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

    const r = await fetch(`${LNBITS_URL}/api/v1/payments/${encodeURIComponent(payment_hash)}`, {
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

  if (provider === 'alby_nwc') {
    const { relays, walletPubkey, secretKey } = parseAlbyNwcUrl(process.env.ALBY_NWC_URL);

    const msg = await nwcCall({
      relays,
      walletPubkey,
      clientSecretKey: secretKey,
      method: 'lookup_invoice',
      params: { payment_hash },
    });

    if (msg?.error) {
      const err = new Error('failed to check payment');
      err.statusCode = 502;
      err.detail = String(msg.error?.message || msg.error || 'NWC error');
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
