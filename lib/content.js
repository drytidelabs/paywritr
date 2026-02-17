import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');
const VALID_SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

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
  let files;
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch (e) {
    if (e && e.code === 'ENOENT') return { posts: [], pages: [], byTypeSlug: new Map(), aliases: new Map() };
    throw e;
  }

  const posts = [];
  const pages = [];
  const byTypeSlug = new Map(); // key: `${type}:${slug}` => content
  const allSlugs = new Map(); // slug => filePath
  const aliasToCanonical = new Map(); // alias => { type, slug }

  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const filePath = path.join(POSTS_DIR, f);
    const filenameSlug = f.replace(/\.md$/, '');

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

    // Dates / summary (back-compat)
    const published_date = (fm.published_date ?? fm.date ?? '').toString().trim() || null;
    const summary = (fm.summary ?? fm.description ?? '').toString().trim();

    const title = (fm.title ?? '').toString().trim() || slug;

    const draft = normBool(fm.draft, false);

    // price_sats rules
    let price_sats = Number(fm.price_sats ?? 0);
    if (!Number.isFinite(price_sats) || price_sats < 0) {
      fail(filePath, 'price_sats', 'price_sats must be a non-negative number');
    }
    price_sats = Math.trunc(price_sats);

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
