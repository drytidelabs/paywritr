/**
 * Tests for published_date normalization (#124)
 *
 * Covers:
 * - Quoted YYYY-MM-DD string (canonical)
 * - Unquoted YAML date scalar (gray-matter produces JS Date object)
 * - Legacy `date:` key (back-compat, also quoted)
 * - Invalid date format → ContentValidationError
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'posts');

async function withTempContent(filename, frontmatterLines, body, fn) {
  const fm = frontmatterLines.join('\n');
  const raw = `---\n${fm}\n---\n\n${body}\n`;
  const filePath = path.join(CONTENT_DIR, filename);
  await fs.writeFile(filePath, raw, 'utf8');
  try {
    const { scanContent, ContentValidationError } = await import('../lib/content.js');
    await fn(scanContent, ContentValidationError);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

describe('published_date normalization (#124)', () => {
  it('quoted YYYY-MM-DD string passes through unchanged', async () => {
    await withTempContent('_test-date-quoted.md', [
      'title: Test',
      'slug: test-date-quoted',
      'type: post',
      'published_date: "2026-02-13"',
    ], 'Hello', async (scanContent) => {
      const { posts } = await scanContent();
      const p = posts.find(x => x.slug === 'test-date-quoted');
      assert.ok(p, 'post should be found');
      assert.equal(p.published_date, '2026-02-13');
    });
  });

  it('unquoted YAML date scalar (gray-matter Date object) normalizes to YYYY-MM-DD', async () => {
    // gray-matter parses `published_date: 2026-02-13` as a JS Date.
    // normalizePublishedDate must convert it to "2026-02-13" (no Date.toString()).
    await withTempContent('_test-date-unquoted.md', [
      'title: Test',
      'slug: test-date-unquoted',
      'type: post',
      'published_date: 2026-02-13',
    ], 'Hello', async (scanContent) => {
      const { posts } = await scanContent();
      const p = posts.find(x => x.slug === 'test-date-unquoted');
      assert.ok(p, 'post should be found');
      assert.equal(p.published_date, '2026-02-13',
        'should be canonical YYYY-MM-DD string, not verbose JS Date string');
      // Explicitly verify it does NOT look like Date.toString() output
      assert.ok(!p.published_date.includes('GMT'), 'should not contain GMT (Date.toString() artifact)');
      assert.ok(!p.published_date.includes('Feb'), 'should not contain month name (Date.toString() artifact)');
    });
  });

  it('legacy date: key maps to published_date', async () => {
    await withTempContent('_test-date-legacy.md', [
      'title: Test',
      'slug: test-date-legacy',
      'type: post',
      'date: "2026-01-01"',
    ], 'Hello', async (scanContent) => {
      const { posts } = await scanContent();
      const p = posts.find(x => x.slug === 'test-date-legacy');
      assert.ok(p, 'post should be found');
      assert.equal(p.published_date, '2026-01-01');
    });
  });

  it('legacy unquoted date: scalar normalizes to YYYY-MM-DD', async () => {
    await withTempContent('_test-date-legacy-unquoted.md', [
      'title: Test',
      'slug: test-date-legacy-unquoted',
      'type: post',
      'date: 2025-12-31',
    ], 'Hello', async (scanContent) => {
      const { posts } = await scanContent();
      const p = posts.find(x => x.slug === 'test-date-legacy-unquoted');
      assert.ok(p, 'post should be found');
      assert.equal(p.published_date, '2025-12-31');
      assert.ok(!p.published_date.includes('GMT'));
    });
  });

  it('missing published_date returns null', async () => {
    await withTempContent('_test-date-missing.md', [
      'title: Test',
      'slug: test-date-missing',
      'type: post',
    ], 'Hello', async (scanContent) => {
      const { posts } = await scanContent();
      const p = posts.find(x => x.slug === 'test-date-missing');
      assert.ok(p, 'post should be found');
      assert.equal(p.published_date, null);
    });
  });

  it('rejects naive datetime (no timezone) to avoid server-local timezone bugs', async () => {
    await withTempContent('_test-dt-naive.md', [
      'title: Test',
      'slug: test-dt-naive',
      'type: post',
      'published_date: "2026-02-13T12:30:00"',
    ], 'Hello', async (scanContent) => {
      await assert.rejects(() => scanContent(), (err) => {
        assert.ok(String(err.message || '').includes('must include timezone'));
        return true;
      });
    });
  });

  it('accepts timezone-aware datetime (Z) and preserves the string', async () => {
    await withTempContent('_test-dt-z.md', [
      'title: Test',
      'slug: test-dt-z',
      'type: post',
      'published_date: "2026-02-13T17:30:00Z"',
    ], 'Hello', async (scanContent) => {
      const { posts } = await scanContent();
      const p = posts.find(x => x.slug === 'test-dt-z');
      assert.ok(p);
      assert.equal(p.published_date, '2026-02-13T17:30:00Z');
    });
  });

  it('posts sort descending by published_date (string compare)', async () => {
    const files = [
      ['_test-sort-a.md', '2026-01-01', 'test-sort-a'],
      ['_test-sort-b.md', '2026-03-01', 'test-sort-b'],
      ['_test-sort-c.md', '2026-02-01', 'test-sort-c'],
    ];
    for (const [fn, date, slug] of files) {
      await fs.writeFile(
        path.join(CONTENT_DIR, fn),
        `---\ntitle: Test\nslug: ${slug}\ntype: post\npublished_date: "${date}"\n---\nHello\n`,
        'utf8'
      );
    }
    try {
      const { scanContent } = await import('../lib/content.js');
      const { posts } = await scanContent();
      const sorted = posts
        .filter(p => p.slug.startsWith('test-sort-'))
        .map(p => p.published_date);
      assert.deepEqual(sorted, ['2026-03-01', '2026-02-01', '2026-01-01'],
        'posts should be sorted newest-first');
    } finally {
      for (const [fn] of files) await fs.unlink(path.join(CONTENT_DIR, fn)).catch(() => {});
    }
  });
});
