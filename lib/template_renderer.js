import Mustache from 'mustache';

// Safe, Mustache-style renderer for theme templates.
// - Escapes by default (Mustache default)
// - Triple-stash {{{var}}} is raw HTML (use only for trusted, pre-rendered HTML like markdown output).
// - No helpers / arbitrary code execution.

export function renderMustache({ template, view, partials = {} }) {
  if (typeof template !== 'string') throw new Error('template must be a string');
  // Mustache will HTML-escape variables by default.
  return Mustache.render(template, view || {}, partials || {});
}
