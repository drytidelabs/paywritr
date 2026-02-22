/**
 * Tests for published_date display formatting (#124)
 *
 * Validates that timezone-aware datetimes render in site.timezone.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'content', 'posts');

async function withTempFiles({ siteYml, postFrontmatter }, fn) {
  const sitePath = path.join(ROOT, 'site.yml');
  const origSite = await fs.readFile(sitePath, 'utf8');

  const postPath = path.join(CONTENT_DIR, '_test-dt-display.md');
  const postRaw = `---\n${postFrontmatter}\n---\n\nHello\n`;

  await fs.writeFile(sitePath, siteYml, 'utf8');
  await fs.writeFile(postPath, postRaw, 'utf8');

  try {
    await fn();
  } finally {
    await fs.writeFile(sitePath, origSite, 'utf8');
    await fs.unlink(postPath).catch(() => {});
  }
}

describe('published_date display formatting (#124)', () => {
  it('renders Z datetime in configured site.timezone (America/New_York)', async () => {
    const siteYml = [
      '# temp override for test',
      'title: "Paywritr"',
      'tagline: ""',
      'description: ""',
      'timezone: "America/New_York"',
      '',
    ].join('\n');

    const fm = [
      'title: Test',
      'slug: test-dt-display',
      'type: post',
      'published_date: "2026-02-13T17:30:00Z"',
      'price_sats: 0',
    ].join('\n');

    await withTempFiles({ siteYml, postFrontmatter: fm }, async () => {
      const { buildThemeContext } = await import('../lib/theme_context.js');
      const ctx = await buildThemeContext({ themeName: 'classic' });
      const p = ctx.home.posts.find(x => x.slug === 'test-dt-display');
      assert.ok(p);
      assert.equal(p.published_date_display, '13 February 2026 · 12:30 PM');
    });
  });
});
