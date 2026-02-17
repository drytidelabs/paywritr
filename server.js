import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { marked } from 'marked';
import fs from 'node:fs/promises';

import { parsePaymentsProvider, createInvoice, checkInvoicePaid } from './lib/payments.js';
import { scanContent, findCanonical, ContentValidationError } from './lib/content.js';
import { loadSiteMeta, loadThemeMeta } from './lib/site_metadata.js';
import { renderMustache } from './lib/template_renderer.js';
import { buildThemeContext } from './lib/theme_context.js';
import { loadThemePartials, resolveTemplate, loadThemeTemplate } from './lib/theme_templates.js';

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const PAYMENTS_PROVIDER = parsePaymentsProvider(process.env);

const THEME = (process.env.THEME || 'classic').trim();
const THEMES_DIR = path.join(process.cwd(), 'themes');

const APP_SECRET = process.env.APP_SECRET || '';
const UNLOCK_DAYS = Number(process.env.UNLOCK_DAYS || 30);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

const VALID_SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

if (!APP_SECRET) {
  console.warn('[payblog] WARNING: APP_SECRET is not set. Set it in production.');
}
if (!Number.isFinite(UNLOCK_DAYS) || UNLOCK_DAYS <= 0) {
  console.warn('[payblog] WARNING: UNLOCK_DAYS is invalid; defaulting to 30.');
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use('/static', express.static(path.join(process.cwd(), 'static'), { fallthrough: false }));
app.use('/themes', express.static(THEMES_DIR, { fallthrough: false }));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// slug comes from frontmatter (`slug`), not the filename.

function assertValidSlug(slug) {
  if (!VALID_SLUG_RE.test(slug)) {
    const err = new Error('invalid slug');
    err.statusCode = 404;
    throw err;
  }
}

function hmac(data) {
  return crypto.createHmac('sha256', APP_SECRET || 'dev-secret').update(data).digest('hex');
}

function safeTimingEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  // hex strings => same length check avoids timingSafeEqual throwing.
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
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
  if (!safeTimingEqualHex(sig, expected)) return null;
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

function isBadUrlProtocol(url) {
  try {
    const u = new URL(url, 'http://example.com');
    const proto = (u.protocol || '').toLowerCase();
    return proto === 'javascript:' || proto === 'data:';
  } catch {
    // If parsing fails, err on the side of safety.
    return true;
  }
}

// Harden marked: drop raw HTML and disallow javascript:/data: in links/images.
marked.use({
  renderer: {
    html() {
      return '';
    },
  },
  walkTokens(token) {
    if (token?.type === 'link' && typeof token.href === 'string') {
      if (isBadUrlProtocol(token.href)) token.href = '';
    }
    if (token?.type === 'image' && typeof token.href === 'string') {
      if (isBadUrlProtocol(token.href)) token.href = '';
    }
  },
});
marked.setOptions({ mangle: false, headerIds: false });

function renderMarkdown(md) {
  return marked.parse(md || '');
}

function computeFallbackTeaser(md, maxChars = 800) {
  const s = String(md || '').trim();
  if (!s) return '';
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars).trim()}\n\n…`;
}

async function listPosts() {
  const { posts } = await scanContent();
  // Drafts excluded.
  return posts
    .filter((p) => !p.draft)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.published_date,
      price_sats: p.price_sats,
      description: p.summary,
    }));
}

async function listPages() {
  const { pages } = await scanContent();
  // Drafts excluded.
  return pages
    .filter((p) => !p.draft)
    .slice()
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    .map((p) => ({
      slug: p.slug,
      title: p.title,
    }));
}

async function resolveThemeCssHref() {
  // Any subdirectory in /themes is a valid theme; THEME selects the active one.
  // Folder name is the canonical identifier.
  const candidates = [THEME, 'classic'];
  for (const t of candidates) {
    if (!t) continue;
    const rel = path.posix.join('/themes', encodeURIComponent(t), 'theme.css');
    const abs = path.join(THEMES_DIR, t, 'theme.css');
    try {
      await fs.stat(abs);
      return rel;
    } catch {
      // try next
    }
  }
  return null;
}

async function resolveContent({ type, slug, allowAlias = false }) {
  assertValidSlug(slug);

  const scanned = await scanContent();
  const found = findCanonical(scanned, { type, slug });
  if (!found) {
    const err = new Error('not found');
    err.statusCode = 404;
    throw err;
  }

  if (found.kind === 'alias' && !allowAlias) {
    const err = new Error('not found');
    err.statusCode = 404;
    throw err;
  }

  const c = found.content;
  if (c.draft) {
    const err = new Error('not found');
    err.statusCode = 404;
    throw err;
  }

  const body = c.body || '';

  const hasMoreSplit = body.includes('<!--more-->');
  const [teaserMdRaw] = body.split('<!--more-->');

  // IMPORTANT: for paid posts, if the author forgets <!--more-->,
  // do NOT leak the entire post. Use a conservative fallback teaser.
  const price_sats = Number(c.price_sats || 0);
  const teaserMd = type === 'post' && price_sats > 0 && !hasMoreSplit ? computeFallbackTeaser(body) : (teaserMdRaw || '');

  const teaserHtml = renderMarkdown(teaserMd);
  const fullHtml = renderMarkdown(body);

  const view = {
    type,
    slug: c.slug,
    title: c.title,
    date: c.published_date,
    price_sats,
    description: c.summary || '',
    teaserHtml,
    fullHtml,
    hasMoreSplit,
  };

  return {
    kind: found.kind,
    canonicalSlug: c.slug,
    // only set when kind==='alias'
    requestedSlug: slug,
    view,
  };
}

async function resolvePost(slug, { allowAlias = false } = {}) {
  const r = await resolveContent({ type: 'post', slug, allowAlias });
  return { kind: r.kind, canonicalSlug: r.canonicalSlug, requestedSlug: r.requestedSlug, post: r.view };
}

async function resolvePage(slug, { allowAlias = false } = {}) {
  const r = await resolveContent({ type: 'page', slug, allowAlias });
  return { kind: r.kind, canonicalSlug: r.canonicalSlug, requestedSlug: r.requestedSlug, page: r.view };
}

async function loadPost(slug) {
  const r = await resolvePost(slug, { allowAlias: false });
  return r.post;
}

async function loadPage(slug) {
  const r = await resolvePage(slug, { allowAlias: false });
  return r.page;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function schemeHeadScriptHtml() {
  // Applies scheme early to avoid flash.
  // Cookie write happens in /static/scheme-toggle.js; cookie read here.
  return `<script>
    (function () {
      function getCookie(name) {
        try {
          var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-.$?*|{}()\\[\\]\\\\/+^]/g, '\\$&') + '=([^;]*)'));
          return m ? decodeURIComponent(m[1]) : '';
        } catch (e) {
          return '';
        }
      }

      try {
        var v = (getCookie('paywritr_color_scheme') || '').toLowerCase();
        if (v === 'light' || v === 'dark') {
          document.documentElement.setAttribute('data-color-scheme', v);
          return;
        }

        var m = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        if (m && m.matches) document.documentElement.setAttribute('data-color-scheme', 'dark');
      } catch (e) {}
    })();
  </script>`;
}

function schemeToggleHtml() {
  // Icon-only light/dark toggle (#100). JS swaps the SVG + aria-label at runtime.
  // Initial render assumes light scheme; the early head script may flip scheme before JS runs.
  const moonSvg = `<svg class="scheme-toggle__svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 14.3A8.4 8.4 0 0 1 9.7 3a7.6 7.6 0 1 0 11.3 11.3Z"/></svg>`;
  return `<button id="schemeToggle" class="scheme-toggle" type="button" aria-label="Switch to dark mode">${moonSvg}</button>`;
}

async function renderWithTheme({ kind, view }) {
  // kind: home|post|page|content|...
  // If the theme doesn't provide templates yet, return null (caller uses legacy render).
  const layoutTpl = await loadThemeTemplate({ themeName: THEME, templateName: 'layout' });
  if (!layoutTpl) return null;

  const partials = await loadThemePartials({ themeName: THEME });

  const resolved = await resolveTemplate({ themeName: THEME, kind });
  const bodyTpl = resolved?.template;

  // Built-in safe fallback body template (no errors)
  const fallbackBodyTpl = `<article class="post">{{#content.title}}<h1>{{content.title}}</h1>{{/content.title}}<section class="content">{{{content_html}}}</section>{{{paywall_html}}}</article>`;

  const bodyHtml = renderMustache({
    template: bodyTpl || fallbackBodyTpl,
    view,
    partials,
  });

  const layoutView = {
    ...view,
    page: {
      title: view?.page?.title || view?.site?.title || 'Paywritr',
      body_html: bodyHtml,
    },
  };

  return renderMustache({ template: layoutTpl, view: layoutView, partials });
}

async function renderStatusPage({ req, res, status = 200, kind, title, contentHtml, extraBody = '' }) {
  const [site, themeCssHref, baseCtx] = await Promise.all([
    loadSiteMeta(),
    resolveThemeCssHref(),
    buildThemeContext({ themeName: THEME }),
  ]);

  const themed = await renderWithTheme({
    kind,
    view: {
      ...baseCtx,
      site,
      year: new Date().getUTCFullYear(),
      theme: {
        ...(baseCtx.theme || {}),
        css_href: themeCssHref,
      },
      global: {
        ...(baseCtx.global || {}),
        scheme_head_script: schemeHeadScriptHtml(),
        scheme_toggle_html: schemeToggleHtml(),
        extra_body: extraBody,
      },
      page: { title },
      content_html: contentHtml,
    },
  });

  if (themed) {
    res.status(status).type('html').send(themed);
    return;
  }

  res
    .status(status)
    .type('html')
    .send(
      await layout({
        title,
        content: contentHtml,
        extraBody,
      })
    );
}

async function layout({ title, content, extraHead = '', extraBody = '' }) {
  const [themeHref, pages, site, themeMeta] = await Promise.all([
    resolveThemeCssHref(),
    listPages(),
    loadSiteMeta(),
    loadThemeMeta({ themeName: THEME }),
  ]);

  const nav = pages.length
    ? `<nav class="site-nav" aria-label="Pages">${pages
        .map((p) => `<a class="nav-link" href="/${encodeURIComponent(p.slug)}/">${escapeHtml(p.title)}</a>`)
        .join('')}</nav>`
    : '';

  const pageTitle = `${escapeHtml(title)} — ${escapeHtml(site.title)}`;

  return `<!doctype html>
<html lang="en" data-color-scheme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  ${site.description ? `<meta name="description" content="${escapeHtml(site.description)}" />` : ''}

  ${schemeHeadScriptHtml()}

  <link rel="stylesheet" href="/static/style.css" />
  ${themeHref ? `<link rel="stylesheet" href="${themeHref}" />` : ''}
  ${extraHead}
</head>
<body>
  <header class="site-header">
    <div class="container">
      <div class="site-header-row">
        <a class="brand" href="/">${escapeHtml(site.title)}</a>
        ${schemeToggleHtml()}
      </div>
      ${nav}
    </div>
  </header>

  <main class="container">
    ${content}
  </main>

  <footer class="site-footer">
    <div class="container">
      <span>© ${new Date().getUTCFullYear()} ${escapeHtml(site.title)}</span>
    </div>
  </footer>

  ${extraBody}
  <script src="/static/scheme-toggle.js"></script>
</body>
</html>`;
}

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const [posts, site, themeCssHref, baseCtx] = await Promise.all([
      listPosts(),
      loadSiteMeta(),
      resolveThemeCssHref(),
      buildThemeContext({ themeName: THEME }),
    ]);

    // Attempt theme template render
    const themed = await renderWithTheme({
      kind: 'home',
      view: {
        ...baseCtx,
        site,
        year: new Date().getUTCFullYear(),
        theme: {
          ...(baseCtx.theme || {}),
          css_href: themeCssHref,
        },
        global: {
          ...(baseCtx.global || {}),
          scheme_head_script: schemeHeadScriptHtml(),
          scheme_toggle_html: schemeToggleHtml(),
          extra_body: '',
        },
        home: {
          posts: posts.map((p) => ({
            type: 'post',
            slug: p.slug,
            title: p.title,
            published_date: p.date,
            summary: p.description,
            price_sats: p.price_sats,
            price_label: p.price_sats > 0 ? `${p.price_sats} sats` : 'free',
          })),
        },
        page: { title: site.title },
      },
    });

    if (themed) {
      res.type('html').send(themed);
      return;
    }

    // Legacy render fallback
    const items = posts
      .map((p) => {
        const price = p.price_sats > 0 ? `${p.price_sats} sats` : 'free';
        return `<article class="post-card">
      <h2><a href="/p/${encodeURIComponent(p.slug)}/">${escapeHtml(p.title)}</a></h2>
      <div class="meta">${p.date ? escapeHtml(p.date) : ''}${p.date ? ' · ' : ''}${escapeHtml(price)}</div>
      ${p.description ? `<p class="desc">${escapeHtml(p.description)}</p>` : ''}
    </article>`;
      })
      .join('\n');

    res.type('html').send(
      await layout({
        title: site.title,
        content: `
      <section class="hero">
        <h1>${escapeHtml(site.title)}</h1>
        ${site.tagline ? `<p class="muted">${escapeHtml(site.tagline)}</p>` : ''}
      </section>
      <section class="post-list">${items || '<p class="muted">No posts yet.</p>'}</section>
    `,
      })
    );
  })
);

function buildPaywallHtml({ post, slug, unlocked }) {
  const priceLine = post.price_sats > 0 ? `${post.price_sats} sats` : 'free';
  if (post.price_sats <= 0 || unlocked) return '';

  return `
    <section class="paywall" id="paywall" data-slug="${escapeHtml(slug)}" data-price="${post.price_sats}">
      <div class="paywall-card">
        <div class="paywall-title">Unlock this post</div>
        <div class="paywall-meta">Price: <strong>${escapeHtml(priceLine)}</strong></div>

        <div class="status" id="status">To continue, pay once via Lightning.</div>
        <div class="status" id="statusHelp">After payment, this page unlocks automatically on this device.</div>

        <div class="paywall-actions">
          <button class="btn" id="getInvoiceBtn">Get invoice</button>
          <button class="btn btn-secondary" id="newInvoiceBtn" hidden>Get a new invoice</button>
        </div>

        <div class="invoice" id="invoice" hidden>
          <div class="invoice-row">
            <div class="muted">Invoice</div>
            <code class="bolt11" id="bolt11"></code>
            <div class="invoice-actions">
              <button class="btn btn-secondary" id="copyInvoiceBtn" type="button">Copy invoice</button>
            </div>
          </div>
          <div class="invoice-row">
            <div class="muted">QR</div>
            <div id="qrcode"></div>
          </div>
          <div class="invoice-actions">
            <button class="btn btn-secondary" id="refreshStatusBtn" type="button">Refresh status</button>
            <button class="btn btn-secondary" id="reloadBtn" type="button">Reload page</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPostHtml({ post, slug, req }) {
  const unlocked = post.price_sats <= 0 || hasValidUnlock(req, slug);
  const priceLine = post.price_sats > 0 ? `${post.price_sats} sats` : 'free';
  const paywall = buildPaywallHtml({ post, slug, unlocked });

  return `
    <article class="post">
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta">${post.date ? escapeHtml(post.date) : ''}${post.date ? ' · ' : ''}${escapeHtml(priceLine)}</div>
      <section class="content">
        ${unlocked ? post.fullHtml : post.teaserHtml}
      </section>
      ${paywall}
    </article>
  `;
}

function renderPageHtml({ page }) {
  return `
    <article class="post">
      <h1>${escapeHtml(page.title)}</h1>
      <div class="meta">${page.date ? escapeHtml(page.date) : ''}</div>
      <section class="content">${page.fullHtml}</section>
    </article>
  `;
}

app.get(
  '/post/:slug',
  asyncHandler(async (req, res) => {
    // Back-compat: old post route.
    res.redirect(301, `/p/${encodeURIComponent(req.params.slug)}/`);
  })
);

app.get(
  '/p/:slug',
  asyncHandler(async (req, res) => {
    const requestedSlug = req.params.slug;
    let resolved;
    try {
      resolved = await resolvePost(requestedSlug, { allowAlias: true });
    } catch (e) {
      if (e instanceof ContentValidationError) {
        await renderStatusPage({
          req,
          res,
          status: 500,
          kind: 'error',
          title: 'Content error',
          contentHtml: `<h1>Content error</h1><p class="muted">${escapeHtml(e.message)}</p>`,
        });
        return;
      }
      await renderStatusPage({
        req,
        res,
        status: 404,
        kind: 'notfound',
        title: 'Not found',
        contentHtml: '<h1>Not found</h1>',
      });
      return;
    }

    if (resolved.kind === 'alias') {
      // Preserve unlocks across slug renames (best-effort): if a user previously unlocked
      // the *old* slug on this device, copy that unlock cookie to the new canonical slug.
      const tok = req.cookies?.[unlockCookieName(requestedSlug)];
      const data = verifySignedJSON(tok);
      if (data && data.slug === requestedSlug && typeof data.exp === 'number' && Date.now() <= data.exp) {
        const maxAge = Math.max(0, data.exp - Date.now());
        const newTok = signJSON({ slug: resolved.canonicalSlug, exp: data.exp });
        res.cookie(unlockCookieName(resolved.canonicalSlug), newTok, {
          httpOnly: true,
          sameSite: 'lax',
          secure: COOKIE_SECURE,
          maxAge,
          path: '/',
        });
      }

      res.redirect(301, `/p/${encodeURIComponent(resolved.canonicalSlug)}/`);
      return;
    }

    const post = resolved.post;
    const slug = resolved.canonicalSlug;

    const [site, themeCssHref, baseCtx] = await Promise.all([
      loadSiteMeta(),
      resolveThemeCssHref(),
      buildThemeContext({ themeName: THEME }),
    ]);

    const unlocked = post.price_sats <= 0 || hasValidUnlock(req, slug);
    const priceLabel = post.price_sats > 0 ? `${post.price_sats} sats` : 'free';

    // Attempt theme template render
    const themed = await renderWithTheme({
      kind: 'post',
      view: {
        ...baseCtx,
        site,
        year: new Date().getUTCFullYear(),
        theme: {
          ...(baseCtx.theme || {}),
          css_href: themeCssHref,
        },
        global: {
          ...(baseCtx.global || {}),
          scheme_head_script: schemeHeadScriptHtml(),
          scheme_toggle_html: schemeToggleHtml(),
          extra_body: `<script src="/static/qrcode.min.js"></script><script src="/static/pay.js"></script>`,
        },
        content: {
          type: 'post',
          slug,
          title: post.title,
          published_date: post.date,
          summary: post.description,
          price_sats: post.price_sats,
          price_label: priceLabel,
        },
        content_html: unlocked ? post.fullHtml : post.teaserHtml,
        paywall_html: buildPaywallHtml({ post, slug, unlocked }),
        page: { title: post.title },
      },
    });

    if (themed) {
      res.type('html').send(themed);
      return;
    }

    // Legacy render fallback
    res.type('html').send(
      await layout({
        title: post.title,
        content: renderPostHtml({ post, slug, req }),
        extraBody: `<script src="/static/qrcode.min.js"></script><script src="/static/pay.js"></script>`,
      })
    );
  })
);

app.get(
  '/api/invoice',
  asyncHandler(async (req, res) => {
    const requestedSlug = String(req.query.slug || '');
    if (!requestedSlug) return res.status(400).json({ error: 'missing slug' });

    let resolved;
    try {
      resolved = await resolvePost(requestedSlug, { allowAlias: true });
    } catch (e) {
      if (e instanceof ContentValidationError) {
        return res.status(500).json({ error: 'content error', detail: e.message });
      }
      return res.status(404).json({ error: 'unknown post' });
    }

    const post = resolved.post;
    const slug = resolved.canonicalSlug;

    if (post.price_sats <= 0) return res.status(400).json({ error: 'post is free' });

    const amount = post.price_sats;
    const site = await loadSiteMeta();
    const memo = `${site.title}: ${post.title} (${slug})`;

    let inv;
    try {
      inv = await createInvoice({ provider: PAYMENTS_PROVIDER, amountSats: amount, memo, slug });
    } catch (e) {
      const status = Number(e?.statusCode || 502);
      const detail = status >= 500 ? String(e?.detail || e?.message || 'error') : undefined;
      return res.status(status).json({ error: String(e?.message || 'failed to create invoice'), detail });
    }

    const payment_hash = inv.payment_hash;
    const payment_request = inv.payment_request;

    // short-lived state token to prevent stale polling & reduce replay window
    const stateExpMs = Date.now() + 15 * 60 * 1000;
    const state = signJSON({ slug, amount, payment_hash, provider: PAYMENTS_PROVIDER, iat: Date.now(), exp: stateExpMs });

    res.json({
      slug,
      amount,
      payment_hash,
      payment_request,
      state,
      pay_url: `${BASE_URL}/p/${encodeURIComponent(slug)}/`,
    });
  })
);

app.get(
  '/api/invoice/status',
  asyncHandler(async (req, res) => {
    const payment_hash = String(req.query.payment_hash || '');
    const state = String(req.query.state || '');
    if (!payment_hash || !state) return res.status(400).json({ error: 'missing params' });

    const stateData = verifySignedJSON(state);
    if (!stateData) return res.status(400).json({ error: 'bad state' });
    if (stateData.exp && Date.now() > stateData.exp) return res.status(400).json({ error: 'state expired' });
    if (stateData.payment_hash !== payment_hash) return res.status(400).json({ error: 'state mismatch' });

    // Ensure we don't accidentally switch providers between create and poll.
    const provider = stateData.provider || PAYMENTS_PROVIDER;

    let paid;
    try {
      paid = await checkInvoicePaid({ provider, payment_hash });
    } catch (e) {
      const status = Number(e?.statusCode || 502);
      const detail = status >= 500 ? String(e?.detail || e?.message || 'error') : undefined;
      return res.status(status).json({ error: String(e?.message || 'failed to check payment'), detail });
    }

    if (paid) {
      const stateSlug = stateData.slug;

      let resolved;
      try {
        resolved = await resolvePost(stateSlug, { allowAlias: true });
      } catch (e) {
        if (e instanceof ContentValidationError) {
          return res.status(500).json({ error: 'content error', detail: e.message });
        }
        return res.status(400).json({ error: 'unknown post for state' });
      }

      const slug = resolved.canonicalSlug;

      const days = Number.isFinite(UNLOCK_DAYS) && UNLOCK_DAYS > 0 ? UNLOCK_DAYS : 30;
      const exp = Date.now() + days * 24 * 60 * 60 * 1000;
      const token = signJSON({ slug, exp });
      res.cookie(unlockCookieName(slug), token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        maxAge: days * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }

    res.json({ paid });
  })
);

app.get('/healthz', (req, res) => res.type('text').send('ok'));

app.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    // Avoid route collisions with known prefixes.
    const reserved = new Set(['p', 'post', 'api', 'static', 'healthz', 'readyz']);
    if (reserved.has(String(slug || '').toLowerCase())) {
      await renderStatusPage({
        req,
        res,
        status: 404,
        kind: 'notfound',
        title: 'Not found',
        contentHtml: '<h1>Not found</h1>',
      });
      return;
    }

    let resolved;
    try {
      resolved = await resolvePage(slug, { allowAlias: true });
    } catch (e) {
      if (e instanceof ContentValidationError) {
        await renderStatusPage({
          req,
          res,
          status: 500,
          kind: 'error',
          title: 'Content error',
          contentHtml: `<h1>Content error</h1><p class="muted">${escapeHtml(e.message)}</p>`,
        });
        return;
      }
      await renderStatusPage({
        req,
        res,
        status: 404,
        kind: 'notfound',
        title: 'Not found',
        contentHtml: '<h1>Not found</h1>',
      });
      return;
    }

    if (resolved.kind === 'alias') {
      res.redirect(301, `/${encodeURIComponent(resolved.canonicalSlug)}/`);
      return;
    }

    const page = resolved.page;

    const [site, themeCssHref, baseCtx] = await Promise.all([
      loadSiteMeta(),
      resolveThemeCssHref(),
      buildThemeContext({ themeName: THEME }),
    ]);

    const themed = await renderWithTheme({
      kind: 'page',
      view: {
        ...baseCtx,
        site,
        year: new Date().getUTCFullYear(),
        theme: {
          ...(baseCtx.theme || {}),
          css_href: themeCssHref,
        },
        global: {
          ...(baseCtx.global || {}),
          scheme_head_script: schemeHeadScriptHtml(),
          scheme_toggle_html: schemeToggleHtml(),
          extra_body: '',
        },
        content: {
          type: 'page',
          slug: page.slug,
          title: page.title,
          published_date: page.date,
          summary: page.description,
          price_sats: page.price_sats,
          price_label: 'free',
        },
        content_html: page.fullHtml,
        paywall_html: '',
        page: { title: page.title },
      },
    });

    if (themed) {
      res.type('html').send(themed);
      return;
    }

    res.type('html').send(
      await layout({
        title: page.title,
        content: renderPageHtml({ page }),
      })
    );
  })
);

// Catch-all 404 (routes that fall through)
app.use(
  asyncHandler(async (req, res) => {
    await renderStatusPage({
      req,
      res,
      status: 404,
      kind: 'notfound',
      title: 'Not found',
      contentHtml: '<h1>Not found</h1>',
    });
  })
);

// Basic error handler to avoid unhandled promise rejections leaking stack traces.
// (Express 5 will route async errors here.)
app.use(async (err, req, res, next) => {
  const status = Number(err?.statusCode || err?.status || 500);
  const msg = status >= 500 ? 'internal error' : String(err?.message || 'error');

  if (req.path.startsWith('/api/')) {
    res.status(status).json({ error: msg });
    return;
  }

  await renderStatusPage({
    req,
    res,
    status,
    kind: 'error',
    title: 'Error',
    contentHtml: `<h1>${escapeHtml(msg)}</h1>`,
  });
});

app.listen(PORT, () => {
  console.log(`[payblog] listening on ${BASE_URL}`);
});
