import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const VALID_SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

// Matches YYYY-MM-DD (date-only canonical form)
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Matches ISO-like datetime strings (future Notes support)
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * Normalize `published_date` (or legacy `date`) from frontmatter.
 *
 * gray-matter may parse an unquoted YAML date scalar (e.g. `2026-02-13`) as a
 * JS Date object. We convert that to YYYY-MM-DD using UTC to avoid timezone
 * off-by-one-day shifts. Quoted strings are validated and returned as-is.
 *
 * Returns a canonical string (YYYY-MM-DD or ISO datetime) or null.
 */
function normalizePublishedDate(raw, filePath) {
  if (raw == null || raw === '') return null;

  // gray-matter produced a JS Date from an unquoted YAML date scalar
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) {
      fail(filePath, 'published_date', 'invalid date value');
    }
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(raw).trim();
  if (!s) return null;

  if (DATE_ONLY_RE.test(s) || DATETIME_RE.test(s)) return s;

  fail(filePath, 'published_date', `invalid published_date format: "${s}" (expected YYYY-MM-DD or ISO datetime)`);
}

function normBool(v, defaultValue = false) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return defaultValue;
}

function asString(v) {
  if (v == null) return '';
  return String(v);
}

function asStringList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(asString).map((s) => s.trim()).filter(Boolean);
  // allow comma-separated as a convenience
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export class ContentValidationError extends Error {
  constructor(message, { filePath, field } = {}) {
    super(message);
    this.name = 'ContentValidationError';
    this.filePath = filePath;
    this.field = field;
  }
}

function fail(filePath, field, message) {
  throw new ContentValidationError(`${message} (file=${filePath}${field ? ` field=${field}` : ''})`, {
    filePath,
    field,
  });
}

function validateSlug(filePath, slug) {
  if (!slug) fail(filePath, 'slug', 'missing slug');
  if (!VALID_SLUG_RE.test(slug)) fail(filePath, 'slug', 'invalid slug (allowed: a-z0-9_-; must start with alnum)');
}

export async function scanContent() {
  let entries;
  try {
    entries = await fs.readdir(CONTENT_DIR, { recursive: true });
  } catch (e) {
    if (e && e.code === 'ENOENT') return { posts: [], pages: [], byTypeSlug: new Map(), aliases: new Map() };
    throw e;
  }

  // Filter to .md files and build absolute paths
  const mdFiles = entries.filter((x) => x.endsWith('.md')).map((rel) => path.join(CONTENT_DIR, rel));

  const posts = [];
  const pages = [];
  const byTypeSlug = new Map(); // key: `${type}:${slug}` => content
  const allSlugs = new Map(); // slug => filePath
  const aliasToCanonical = new Map(); // alias => { type, slug }

  for (const filePath of mdFiles) {
    const filenameSlug = path.basename(filePath).replace(/\.md$/, '');

    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = matter(raw);
    } catch {
      fail(filePath, null, 'failed to parse frontmatter');
    }

    const fm = parsed.data || {};
    const body = parsed.content || '';

    // v0.2 canonical fields
    const typeRaw = (fm.type == null ? 'post' : String(fm.type)).trim().toLowerCase();
    const type = typeRaw;
    if (type !== 'post' && type !== 'page') {
      fail(filePath, 'type', 'type must be post|page');
    }

    const slug = (fm.slug == null ? filenameSlug : String(fm.slug)).trim();
    validateSlug(filePath, slug);

    // Unique slug across all content
    if (allSlugs.has(slug)) {
      fail(filePath, 'slug', `duplicate slug (already used by ${allSlugs.get(slug)})`);
    }
    allSlugs.set(slug, filePath);

    // Dates / summary (back-compat: fm.date is legacy; normalizePublishedDate handles Date objects)
    const published_date = normalizePublishedDate(fm.published_date ?? fm.date ?? null, filePath);
    const summary = (fm.summary ?? fm.description ?? '').toString().trim();

    const title = (fm.title ?? '').toString().trim() || slug;

    const draft = normBool(fm.draft, false);

    // price_sats rules (#59)
    const rawPrice = fm.price_sats ?? 0;
    let price_sats;
    if (rawPrice === '' || rawPrice === null || rawPrice === undefined) {
      price_sats = 0;
    } else {
      price_sats = Number(rawPrice);
    }
    if (!Number.isFinite(price_sats)) {
      fail(filePath, 'price_sats', `price_sats must be a non-negative integer (got: ${JSON.stringify(rawPrice)})`);
    }
    if (price_sats < 0) {
      fail(filePath, 'price_sats', `price_sats must be non-negative (got: ${price_sats})`);
    }
    if (!Number.isInteger(price_sats)) {
      fail(filePath, 'price_sats', `price_sats must be an integer, not a float (got: ${rawPrice})`);
    }
    if (price_sats > 1_000_000) {
      console.warn(`[content] WARNING: very high price_sats=${price_sats} in ${filePath} — verify this is intentional`);
    }

    if (type === 'page') {
      if (price_sats !== 0) {
        fail(filePath, 'price_sats', 'pages cannot be paywalled; require price_sats: 0');
      }
    }

    const aliases = asStringList(fm.aliases);
    const topics = asStringList(fm.topics);

    // Validate aliases and build redirect map.
    for (const a of aliases) {
      validateSlug(filePath, a);
      if (allSlugs.has(a)) {
        fail(filePath, 'aliases', `alias collides with canonical slug: ${a}`);
      }
      if (aliasToCanonical.has(a)) {
        const prev = aliasToCanonical.get(a);
        fail(filePath, 'aliases', `alias already claimed by ${prev.type}:${prev.slug}`);
      }
      aliasToCanonical.set(a, { type, slug });
    }

    const content = {
      filePath,
      type,
      slug,
      title,
      published_date,
      draft,
      price_sats,
      summary,
      aliases,
      topics,
      body,
    };

    byTypeSlug.set(`${type}:${slug}`, content);
    if (type === 'post') posts.push(content);
    else pages.push(content);
  }

  // Sort posts by published_date desc (string compare; ISO recommended)
  posts.sort((a, b) => String(b.published_date || '').localeCompare(String(a.published_date || '')));

  return {
    posts,
    pages,
    byTypeSlug,
    aliases: aliasToCanonical,
  };
}

export function findCanonical({ byTypeSlug, aliases }, { type, slug }) {
  const key = `${type}:${slug}`;
  const hit = byTypeSlug.get(key);
  if (hit) return { kind: 'canonical', content: hit };

  const ali = aliases.get(slug);
  if (ali && ali.type === type) {
    const target = byTypeSlug.get(`${ali.type}:${ali.slug}`);
    if (target) return { kind: 'alias', content: target, canonicalSlug: ali.slug };
  }

  return null;
}
