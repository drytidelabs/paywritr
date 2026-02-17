import { loadSiteMeta, loadThemeMeta } from './site_metadata.js';
import { scanContent } from './content.js';

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
