import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'posts');

// Helper: write a temp content file, import scanContent fresh, then clean up
async function withTempContent(filename, frontmatter, body, fn) {
  const filePath = path.join(CONTENT_DIR, filename);
  const content = `---\n${frontmatter}\n---\n\n${body}\n`;
  await fs.writeFile(filePath, content, 'utf8');
  try {
    // Dynamic import to get fresh module (scanContent reads filesystem each call)
    const { scanContent } = await import('../lib/content.js');
    await fn(scanContent);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

describe('Pricing validation (#59)', () => {
  it('valid integer price_sats passes', async () => {
    await withTempContent('_test-price-valid.md',
      'title: Test\ntype: post\nslug: test-price-valid\nprice_sats: 100',
      'Hello',
      async (scanContent) => {
        const { posts } = await scanContent();
        const p = posts.find(x => x.slug === 'test-price-valid');
        assert.ok(p, 'post should be found');
        assert.equal(p.price_sats, 100);
      }
    );
  });

  it('price_sats: 0 is valid (free)', async () => {
    await withTempContent('_test-price-zero.md',
      'title: Test\ntype: post\nslug: test-price-zero\nprice_sats: 0',
      'Hello',
      async (scanContent) => {
        const { posts } = await scanContent();
        const p = posts.find(x => x.slug === 'test-price-zero');
        assert.ok(p);
        assert.equal(p.price_sats, 0);
      }
    );
  });

  it('missing price_sats defaults to 0', async () => {
    await withTempContent('_test-price-missing.md',
      'title: Test\ntype: post\nslug: test-price-missing',
      'Hello',
      async (scanContent) => {
        const { posts } = await scanContent();
        const p = posts.find(x => x.slug === 'test-price-missing');
        assert.ok(p);
        assert.equal(p.price_sats, 0);
      }
    );
  });

  it('price_sats: -1 fails validation', async () => {
    await withTempContent('_test-price-neg.md',
      'title: Test\ntype: post\nslug: test-price-neg\nprice_sats: -1',
      'Hello',
      async (scanContent) => {
        await assert.rejects(() => scanContent(), (err) => {
          assert.ok(err.message.includes('non-negative'), `expected non-negative error, got: ${err.message}`);
          return true;
        });
      }
    );
  });

  it('price_sats: 3.5 fails validation', async () => {
    await withTempContent('_test-price-float.md',
      'title: Test\ntype: post\nslug: test-price-float\nprice_sats: 3.5',
      'Hello',
      async (scanContent) => {
        await assert.rejects(() => scanContent(), (err) => {
          assert.ok(err.message.includes('integer'), `expected integer error, got: ${err.message}`);
          return true;
        });
      }
    );
  });

  it('price_sats: "abc" fails validation', async () => {
    await withTempContent('_test-price-abc.md',
      'title: Test\ntype: post\nslug: test-price-abc\nprice_sats: abc',
      'Hello',
      async (scanContent) => {
        await assert.rejects(() => scanContent(), (err) => {
          assert.ok(err.message.includes('price_sats'), `expected price_sats error, got: ${err.message}`);
          return true;
        });
      }
    );
  });
});
