import test from 'node:test';
import assert from 'node:assert/strict';

import { buildThemeContext } from '../lib/theme_context.js';

test('buildThemeContext returns site + nav/pages + home/posts', async () => {
  const ctx = await buildThemeContext({ themeName: 'classic' });
  assert.ok(ctx.site);
  assert.ok(typeof ctx.site.title === 'string');
  assert.ok(ctx.nav);
  assert.ok(Array.isArray(ctx.nav.pages));
  assert.ok(ctx.home);
  assert.ok(Array.isArray(ctx.home.posts));
});
