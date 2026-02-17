import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const DEFAULT_SITE = {
  title: 'Paywritr',
  tagline: '',
  description: '',
};

export async function loadSiteMeta({ cwd = process.cwd() } = {}) {
  const file = path.join(cwd, 'site.yml');
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ...DEFAULT_SITE };
    throw e;
  }

  let parsed;
  try {
    parsed = YAML.parse(raw) || {};
  } catch {
    // Fail soft: if YAML is invalid, fall back to defaults rather than taking the site down.
    return { ...DEFAULT_SITE };
  }

  const title = String(parsed.title ?? DEFAULT_SITE.title).trim() || DEFAULT_SITE.title;
  const tagline = String(parsed.tagline ?? DEFAULT_SITE.tagline).trim();
  const description = String(parsed.description ?? DEFAULT_SITE.description).trim();

  return { title, tagline, description };
}

export async function loadThemeMeta({ themeName, cwd = process.cwd() } = {}) {
  if (!themeName) return null;
  const file = path.join(cwd, 'themes', themeName, 'theme.yml');
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return null;
    return null;
  }

  try {
    const parsed = YAML.parse(raw) || {};
    const label = parsed.label != null ? String(parsed.label).trim() : null;
    const version = parsed.version != null ? String(parsed.version).trim() : null;
    return { label, version };
  } catch {
    return null;
  }
}
