import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMustache } from '../lib/template_renderer.js';

test('renderMustache escapes variables by default', () => {
  const html = renderMustache({
    template: '<h1>{{title}}</h1>',
    view: { title: '<script>alert(1)</script>' },
  });
  // Mustache escapes '/' as &#x2F;.
  assert.equal(html, '<h1>&lt;script&gt;alert(1)&lt;&#x2F;script&gt;</h1>');
});

test('renderMustache allows raw HTML via triple-stash', () => {
  const html = renderMustache({
    template: '<div>{{{content_html}}}</div>',
    view: { content_html: '<p><strong>ok</strong></p>' },
  });
  assert.equal(html, '<div><p><strong>ok</strong></p></div>');
});

test('renderMustache supports partials', () => {
  const html = renderMustache({
    template: '<div>{{> header}}</div>',
    view: { title: 'Hello' },
    partials: { header: '<h1>{{title}}</h1>' },
  });
  assert.equal(html, '<div><h1>Hello</h1></div>');
});
