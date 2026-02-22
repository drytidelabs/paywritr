#!/usr/bin/env node
/**
 * migrate-dates.mjs
 *
 * Rewrites content frontmatter to canonicalize published_date:
 *  1. Legacy `date: YYYY-MM-DD` (unquoted) → `published_date: "YYYY-MM-DD"`
 *  2. Unquoted `published_date: YYYY-MM-DD` → `published_date: "YYYY-MM-DD"`
 *
 * Only modifies lines within the YAML frontmatter block (between --- delimiters).
 * Diffs are minimal and deterministic.
 *
 * Usage:
 *   node bin/migrate-dates.mjs [--write] [content-dir]
 *
 * Default: dry-run (shows what would change; no files written).
 * Pass --write to apply changes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const write = process.argv.includes('--write');
const args = process.argv.slice(2).filter(a => a !== '--write');
const contentDir = path.resolve(args[0] ?? path.join(process.cwd(), 'content'));

const UNQUOTED_DATE_RE = /^(\s*)(date|published_date)(\s*:\s*)(\d{4}-\d{2}-\d{2})\s*$/;

/**
 * Transform the raw text of a markdown file.
 * Returns { changed: boolean, result: string, changes: string[] }
 */
function transform(raw, filePath) {
  const lines = raw.split('\n');
  const changes = [];

  // Find frontmatter block: starts at line 0 with '---', ends at next '---'
  if (!lines[0].match(/^---\s*$/)) {
    return { changed: false, result: raw, changes };
  }

  let fmEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^---\s*$/) || lines[i].match(/^[.]{3}\s*$/)) {
      fmEnd = i;
      break;
    }
  }

  if (fmEnd < 0) return { changed: false, result: raw, changes };

  const out = [...lines];

  for (let i = 1; i < fmEnd; i++) {
    const line = lines[i];
    const m = line.match(UNQUOTED_DATE_RE);
    if (!m) continue;

    const [, indent, key, sep, dateVal] = m;
    const newLine = `${indent}published_date${sep}"${dateVal}"`;

    if (newLine !== line) {
      changes.push(`  line ${i + 1}: ${JSON.stringify(line)} → ${JSON.stringify(newLine)}`);
      out[i] = newLine;
    }
  }

  const changed = changes.length > 0;
  return { changed, result: out.join('\n'), changes };
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => !e.isDirectory() && e.name.endsWith('.md'))
    .map(e => path.join(e.parentPath ?? e.path, e.name));
}

async function main() {
  let files;
  try {
    files = await walk(contentDir);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(`Content directory not found: ${contentDir}`);
      process.exit(0);
    }
    throw e;
  }

  if (files.length === 0) {
    console.log('No .md files found.');
    return;
  }

  let changedCount = 0;

  for (const filePath of files.sort()) {
    const raw = await fs.readFile(filePath, 'utf8');
    const { changed, result, changes } = transform(raw, filePath);
    if (!changed) continue;

    changedCount++;
    console.log(`${write ? 'UPDATED' : 'WOULD UPDATE'}: ${path.relative(process.cwd(), filePath)}`);
    for (const c of changes) console.log(c);

    if (write) {
      await fs.writeFile(filePath, result, 'utf8');
    }
  }

  if (changedCount === 0) {
    console.log('Nothing to migrate. All dates are already in canonical form.');
  } else if (!write) {
    console.log(`\nDry run: ${changedCount} file(s) would be updated. Pass --write to apply.`);
  } else {
    console.log(`\nMigrated ${changedCount} file(s).`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
