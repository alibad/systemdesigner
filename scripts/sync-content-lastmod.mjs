#!/usr/bin/env node
// Sets each registry entry's seo.lastModified to the date of the last commit that changed its
// lesson folder (content/entries/<section>/<slug>/, ignoring generated *.generated.json practice
// packs), when that is newer than the stored date.
// The sitemap publishes these dates as <lastmod>, and Google only trusts lastmod on a site
// whose dates are consistently accurate.
//
//   pnpm sync:lastmod          update content/registry.json
//   pnpm sync:lastmod --check  exit 1 if any date is behind the git history
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, 'content', 'registry.json');
const check = process.argv.includes('--check');

const log = execFileSync('git', ['log', '--format=@%cI', '--name-only', '--', 'content/entries'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});

// Newest commit first, so the first date seen for a folder is its latest change.
const latest = new Map();
let date = null;
for (const line of log.split('\n')) {
  if (line.startsWith('@')) {
    date = line.slice(1).trim();
    continue;
  }
  const file = line.trim();
  const match = file.match(/^content\/entries\/([^/]+)\/([^/]+)\//);
  // Generated daily-practice packs feed /learn, not the page a crawler reads.
  if (!match || !date || file.endsWith('.generated.json')) continue;
  const key = `/${match[1]}/${match[2]}`;
  if (!latest.has(key)) latest.set(key, new Date(date));
}

const raw = fs.readFileSync(REGISTRY, 'utf8');
const registry = JSON.parse(raw);
const behind = [];
for (const entry of registry) {
  const changed = latest.get(entry.path);
  if (!changed) continue;
  const stored = new Date(entry.seo.lastModified);
  // Day precision: a lesson changed today is "today", whatever the hour.
  const day = new Date(Date.UTC(changed.getUTCFullYear(), changed.getUTCMonth(), changed.getUTCDate()));
  if (day > stored) {
    behind.push(entry.path);
    entry.seo.lastModified = day.toISOString();
  }
}

if (check) {
  if (behind.length) {
    console.error(`${behind.length} registry lastModified dates are older than their lesson's git history. Run pnpm sync:lastmod.`);
    process.exit(1);
  }
  console.log('registry lastModified dates match the git history');
} else {
  fs.writeFileSync(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`updated lastModified for ${behind.length} of ${registry.length} entries`);
}
