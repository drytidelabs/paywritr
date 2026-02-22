import { loadSiteMeta, loadThemeMeta } from './site_metadata.js';
import { scanContent } from './content.js';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDateOnly(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

function formatDateTime(dt, { timezone = 'UTC' } = {}) {
  const date = new Date(dt);
  if (isNaN(date.getTime())) return null;

  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${datePart} · ${timePart}`;
}

function formatPublishedDate(published_date, { timezone = 'UTC' } = {}) {
  if (!published_date) return null;
  const s = String(published_date).trim();
  if (!s) return null;
  const dateOnly = formatDateOnly(s);
  if (dateOnly) return dateOnly;
  return formatDateTime(s, { timezone }) || s;
}

export async function buildThemeContext({ themeName } = {}) {
  const [site, themeMeta, scanned] = await Promise.all([
    loadSiteMeta(),
    themeName ? loadThemeMeta({ themeName }) : Promise.resolve(null),
    scanContent(),
  ]);

  const navPages = scanned.pages
    .filter((p) => !p.draft)
    .slice()
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    .map((p) => ({ slug: p.slug, title: p.title }));

  const homePosts = scanned.posts
    .filter((p) => !p.draft)
    .map((p) => ({
      type: 'post',
      slug: p.slug,
      title: p.title,
      published_date: p.published_date,
      published_date_display: formatPublishedDate(p.published_date, { timezone: site.timezone }),
      summary: p.summary,
      price_sats: p.price_sats,
    }));

  return {
    site,
    theme: themeMeta,
    nav: { pages: navPages },
    home: { posts: homePosts },
    // global helpers/snippets (optional to render)
    global: {
      // This will be replaced by template-driven rendering in #92.
      // For now, keep as an empty placeholder.
      scheme_toggle_html: '',
    },
  };
}
