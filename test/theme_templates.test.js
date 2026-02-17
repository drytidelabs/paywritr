import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadThemePartials, resolveTemplate } from '../lib/theme_templates.js';

async function withTmpDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paywritr-theme-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('resolveTemplate prefers kind-specific template and falls back to content.mustache', async () => {
  await withTmpDir(async (cwd) => {
    const tdir = path.join(cwd, 'themes', 't1', 'templates');
    await fs.mkdir(tdir, { recursive: true });
    await fs.writeFile(path.join(tdir, 'content.mustache'), 'CONTENT', 'utf8');
    await fs.writeFile(path.join(tdir, 'post.mustache'), 'POST', 'utf8');

    const post = await resolveTemplate({ cwd, themeName: 't1', kind: 'post' });
    assert.equal(post.name, 'post');
    assert.equal(post.template, 'POST');

    const note = await resolveTemplate({ cwd, themeName: 't1', kind: 'note' });
    assert.equal(note.name, 'content');
    assert.equal(note.template, 'CONTENT');
  });
});

test('loadThemePartials loads *.mustache partial files by basename', async () => {
  await withTmpDir(async (cwd) => {
    const pdir = path.join(cwd, 'themes', 't1', 'partials');
    await fs.mkdir(pdir, { recursive: true });
    await fs.writeFile(path.join(pdir, 'header.mustache'), '<h1>{{site.title}}</h1>', 'utf8');

    const partials = await loadThemePartials({ cwd, themeName: 't1' });
    assert.equal(typeof partials.header, 'string');
    assert.ok(partials.header.includes('{{site.title}}'));
  });
});
