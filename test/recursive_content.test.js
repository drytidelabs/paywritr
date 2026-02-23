import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_DIR = path.join(process.cwd(), 'content');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeContent(relPath, frontmatter, body) {
  const filePath = path.join(CONTENT_DIR, relPath);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `---\n${frontmatter}\n---\n\n${body}\n`, 'utf8');
  return filePath;
}

async function removeContent(relPath) {
  const filePath = path.join(CONTENT_DIR, relPath);
  await fs.unlink(filePath).catch(() => {});
}

async function removeDirIfEmpty(relPath) {
  const dirPath = path.join(CONTENT_DIR, relPath);
  try {
    await fs.rmdir(dirPath);
  } catch {}
}

describe('Recursive content discovery (#91)', () => {
  const testFiles = [];

  after(async () => {
    // Clean up all test files
    for (const f of testFiles) {
      await removeContent(f);
    }
    // Clean up test dirs
    await removeDirIfEmpty('nested/deep');
    await removeDirIfEmpty('nested');
    await removeDirIfEmpty('pages');
  });

  it('content in content/posts/ is discovered', async () => {
    // existing files like hello-world.md should work
    const { scanContent } = await import('../lib/content.js');
    const { posts } = await scanContent();
    const helloWorld = posts.find(p => p.slug === 'hello-world');
    assert.ok(helloWorld, 'hello-world should be discovered in content/posts/');
  });

  it('content in content/pages/ subdirectory is discovered', async () => {
    const relPath = 'pages/test-page-subdir.md';
    testFiles.push(relPath);
    await writeContent(relPath,
      'title: Test Page Subdir\ntype: page\nslug: test-page-subdir\nprice_sats: 0',
      'Page in subdir'
    );

    const { scanContent } = await import('../lib/content.js');
    const { pages } = await scanContent();
    const found = pages.find(p => p.slug === 'test-page-subdir');
    assert.ok(found, 'page in content/pages/ should be discovered');
  });

  it('content in deeply nested directory is discovered', async () => {
    const relPath = 'nested/deep/test-deep-post.md';
    testFiles.push(relPath);
    await writeContent(relPath,
      'title: Deep Post\ntype: post\nslug: test-deep-post\nprice_sats: 0',
      'Deeply nested post'
    );

    const { scanContent } = await import('../lib/content.js');
    const { posts } = await scanContent();
    const found = posts.find(p => p.slug === 'test-deep-post');
    assert.ok(found, 'post in content/nested/deep/ should be discovered');
  });

  it('duplicate slugs across directories produce validation error', async () => {
    const relPath = 'pages/hello-world-dup.md';
    testFiles.push(relPath);
    // hello-world already exists in content/posts/
    await writeContent(relPath,
      'title: Duplicate\ntype: post\nslug: hello-world\nprice_sats: 0',
      'Duplicate slug'
    );

    const { scanContent } = await import('../lib/content.js');
    await assert.rejects(() => scanContent(), (err) => {
      assert.ok(err.message.includes('duplicate slug'), `expected duplicate slug error, got: ${err.message}`);
      return true;
    });

    // Clean up immediately so other tests aren't affected
    await removeContent(relPath);
    testFiles.pop();
  });
});
