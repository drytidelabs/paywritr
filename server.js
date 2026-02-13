import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import matter from 'gray-matter';
import { marked } from 'marked';

const app = express();

const PORT = process.env.PORT || 3000;
const SITE_TITLE = process.env.SITE_TITLE || 'PayBlog';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// LNbits config
const LNBITS_URL = (process.env.LNBITS_URL || '').replace(/\/$/, '');
const LNBITS_INVOICE_KEY = process.env.LNBITS_INVOICE_KEY || '';
const LNBITS_READ_KEY = process.env.LNBITS_READ_KEY || '';

const APP_SECRET = process.env.APP_SECRET || '';
const UNLOCK_DAYS = Number(process.env.UNLOCK_DAYS || 30);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

if (!APP_SECRET) {
  console.warn('[payblog] WARNING: APP_SECRET is not set. Set it in production.');
}

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use('/static', express.static(path.join(process.cwd(), 'static')));

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

function slugify(filename) {
  return filename.replace(/\.md$/, '');
}

function hmac(data) {
  return crypto.createHmac('sha256', APP_SECRET || 'dev-secret').update(data).digest('hex');
}

function signJSON(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

function verifySignedJSON(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function unlockCookieName(slug) {
  return `unlock_${slug}`;
}

function hasValidUnlock(req, slug) {
  const token = req.cookies?.[unlockCookieName(slug)];
  const data = verifySignedJSON(token);
  if (!data) return false;
  if (data.slug !== slug) return false;
  if (typeof data.exp !== 'number') return false;
  if (Date.now() > data.exp) return false;
  return true;
}

async function listPosts() {
  const files = await fs.readdir(POSTS_DIR);
  const posts = [];
  for (const f of files.filter(x => x.endsWith('.md'))) {
    const slug = slugify(f);
    const fullPath = path.join(POSTS_DIR, f);
    const raw = await fs.readFile(fullPath, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data || {};
    posts.push({
      slug,
      title: fm.title || slug,
      date: fm.date || null,
      price_sats: Number(fm.price_sats || 0),
      description: fm.description || '',
    });
  }
  posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return posts;
}

async function loadPost(slug) {
  const fullPath = path.join(POSTS_DIR, `${slug}.md`);
  const raw = await fs.readFile(fullPath, 'utf8');
  const parsed = matter(raw);
  const fm = parsed.data || {};
  const body = parsed.content || '';

  const [teaserMd, restMd] = body.split('<!--more-->');
  const teaser = marked.parse(teaserMd || '');
  const full = marked.parse(body);

  return {
    slug,
    title: fm.title || slug,
    date: fm.date || null,
    price_sats: Number(fm.price_sats || 0),
    description: fm.description || '',
    teaserHtml: teaser,
    fullHtml: full,
    hasMoreSplit: body.includes('<!--more-->'),
  };
}

function layout({ title, content, extraHead = '', extraBody = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — ${escapeHtml(SITE_TITLE)}</title>
  <link rel="stylesheet" href="/static/style.css" />
  ${extraHead}
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a class="brand" href="/">${escapeHtml(SITE_TITLE)}</a>
    </div>
  </header>

  <main class="container">
    ${content}
  </main>

  <footer class="site-footer">
    <div class="container">
      <span>© ${new Date().getUTCFullYear()} ${escapeHtml(SITE_TITLE)}</span>
    </div>
  </footer>

  ${extraBody}
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

app.get('/', async (req, res) => {
  const posts = await listPosts();
  const items = posts.map(p => {
    const price = p.price_sats > 0 ? `${p.price_sats} sats` : 'free';
    return `<article class="post-card">
      <h2><a href="/post/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h2>
      <div class="meta">${p.date ? escapeHtml(p.date) : ''}${p.date ? ' · ' : ''}${escapeHtml(price)}</div>
      ${p.description ? `<p class="desc">${escapeHtml(p.description)}</p>` : ''}
    </article>`;
  }).join('\n');

  res.type('html').send(layout({
    title: 'Home',
    content: `
      <section class="hero">
        <h1>${escapeHtml(SITE_TITLE)}</h1>
        <p class="muted">Minimal writing. Pay per post with Lightning.</p>
      </section>
      <section class="post-list">${items}</section>
    `,
  }));
});

app.get('/post/:slug', async (req, res) => {
  const slug = req.params.slug;
  let post;
  try {
    post = await loadPost(slug);
  } catch {
    res.status(404).type('html').send(layout({ title: 'Not found', content: '<h1>Not found</h1>' }));
    return;
  }

  const unlocked = post.price_sats <= 0 || hasValidUnlock(req, slug);
  const priceLine = post.price_sats > 0 ? `${post.price_sats} sats` : 'free';

  const paywall = post.price_sats > 0 && !unlocked ? `
    <section class="paywall" id="paywall" data-slug="${escapeHtml(slug)}" data-price="${post.price_sats}">
      <div class="paywall-card">
        <div class="paywall-title">Unlock this post</div>
        <div class="paywall-meta">Price: <strong>${escapeHtml(priceLine)}</strong></div>
        <button class="btn" id="unlockBtn">Unlock for ${escapeHtml(post.price_sats)} sats</button>
        <div class="invoice" id="invoice" hidden>
          <div class="invoice-row">
            <div class="muted">Invoice</div>
            <code class="bolt11" id="bolt11"></code>
          </div>
          <div class="invoice-row">
            <div class="muted">QR</div>
            <div id="qrcode"></div>
          </div>
          <div class="status" id="status">Waiting for payment…</div>
        </div>
      </div>
    </section>
  ` : '';

  const html = `
    <article class="post">
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta">${post.date ? escapeHtml(post.date) : ''}${post.date ? ' · ' : ''}${escapeHtml(priceLine)}</div>
      <section class="content">
        ${unlocked ? post.fullHtml : (post.hasMoreSplit ? post.teaserHtml : post.teaserHtml)}
      </section>
      ${paywall}
    </article>
  `;

  res.type('html').send(layout({
    title: post.title,
    content: html,
    extraBody: `<script src="/static/qrcode.min.js"></script><script src="/static/pay.js"></script>`,
  }));
});

app.get('/api/invoice', async (req, res) => {
  const slug = String(req.query.slug || '');
  if (!slug) return res.status(400).json({ error: 'missing slug' });

  let post;
  try {
    post = await loadPost(slug);
  } catch {
    return res.status(404).json({ error: 'unknown post' });
  }

  if (post.price_sats <= 0) return res.status(400).json({ error: 'post is free' });
  if (!LNBITS_URL || !LNBITS_INVOICE_KEY || !LNBITS_READ_KEY) {
    return res.status(500).json({ error: 'LNbits is not configured' });
  }

  const amount = post.price_sats;
  const memo = `${SITE_TITLE}: ${post.title} (${slug})`;

  const r = await fetch(`${LNBITS_URL}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': LNBITS_INVOICE_KEY,
    },
    body: JSON.stringify({ out: false, amount, memo, unit: 'sat' }),
  });

  if (!r.ok) {
    const text = await r.text();
    return res.status(502).json({ error: 'failed to create invoice', detail: text });
  }

  const data = await r.json();
  // LNbits returns: payment_hash, payment_request, checking_id
  const payment_hash = data.payment_hash;
  const payment_request = data.payment_request;

  const state = signJSON({ slug, amount, payment_hash, iat: Date.now() });

  res.json({
    slug,
    amount,
    payment_hash,
    payment_request,
    state,
    pay_url: `${BASE_URL}/post/${encodeURIComponent(slug)}`,
  });
});

app.get('/api/invoice/status', async (req, res) => {
  const payment_hash = String(req.query.payment_hash || '');
  const state = String(req.query.state || '');
  if (!payment_hash || !state) return res.status(400).json({ error: 'missing params' });

  if (!LNBITS_URL || !LNBITS_READ_KEY) {
    return res.status(500).json({ error: 'LNbits is not configured' });
  }

  const stateData = verifySignedJSON(state);
  if (!stateData) return res.status(400).json({ error: 'bad state' });
  if (stateData.payment_hash !== payment_hash) return res.status(400).json({ error: 'state mismatch' });

  const r = await fetch(`${LNBITS_URL}/api/v1/payments/${encodeURIComponent(payment_hash)}`, {
    headers: { 'X-Api-Key': LNBITS_READ_KEY },
  });
  if (!r.ok) {
    const text = await r.text();
    return res.status(502).json({ error: 'failed to check payment', detail: text });
  }

  const data = await r.json();
  const paid = Boolean(data.paid);

  if (paid) {
    const slug = stateData.slug;
    const exp = Date.now() + UNLOCK_DAYS * 24 * 60 * 60 * 1000;
    const token = signJSON({ slug, exp });
    res.cookie(unlockCookieName(slug), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      maxAge: UNLOCK_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  res.json({ paid });
});

app.get('/healthz', (req, res) => res.type('text').send('ok'));

app.listen(PORT, () => {
  console.log(`[payblog] listening on ${BASE_URL}`);
});
