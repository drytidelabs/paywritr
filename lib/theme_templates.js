import fs from 'node:fs/promises';
import path from 'node:path';

function safeJoin(root, ...parts) {
  // Prevent path traversal by resolving and verifying prefix.
  const p = path.resolve(root, ...parts);
  const r = path.resolve(root);
  if (!p.startsWith(r + path.sep) && p !== r) return null;
  return p;
}

async function readFileIfExists(absPath) {
  if (!absPath) return null;
  try {
    return await fs.readFile(absPath, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return null;
    return null;
  }
}

export function themeRoot({ cwd = process.cwd(), themeName }) {
  return path.join(cwd, 'themes', themeName || '');
}

export async function loadThemePartials({ cwd = process.cwd(), themeName }) {
  if (!themeName) return {};
  const root = themeRoot({ cwd, themeName });
  const partialsDir = safeJoin(root, 'partials');
  if (!partialsDir) return {};

  let entries;
  try {
    entries = await fs.readdir(partialsDir, { withFileTypes: true });
  } catch {
    return {};
  }

  const partials = {};
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith('.mustache')) continue;
    const name = ent.name.replace(/\.mustache$/, '');
    const abs = safeJoin(partialsDir, ent.name);
    const txt = await readFileIfExists(abs);
    if (typeof txt === 'string') partials[name] = txt;
  }

  return partials;
}

export async function loadThemeTemplate({ cwd = process.cwd(), themeName, templateName }) {
  // templateName should be like 'home', 'post', 'layout', etc.
  if (!themeName || !templateName) return null;
  const root = themeRoot({ cwd, themeName });
  const templatesDir = safeJoin(root, 'templates');
  if (!templatesDir) return null;
  const abs = safeJoin(templatesDir, `${templateName}.mustache`);
  return await readFileIfExists(abs);
}

export async function resolveTemplate({ cwd = process.cwd(), themeName, kind }) {
  // kind: home|post|page|content|notfound|error|<newtype>
  // Resolution rules:
  // 1) try kind-specific template
  // 2) fall back to content.mustache for unknown/new types
  // 3) return null (caller should use built-in fallback template)

  const primary = await loadThemeTemplate({ cwd, themeName, templateName: kind });
  if (primary) return { name: kind, template: primary };

  if (kind !== 'content') {
    const fallback = await loadThemeTemplate({ cwd, themeName, templateName: 'content' });
    if (fallback) return { name: 'content', template: fallback };
  }

  return null;
}
