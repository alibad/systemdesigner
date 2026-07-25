#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOT = path.join(ROOT, 'content', 'entries');
const TRACE_PATH = path.join(
  ROOT,
  '.next',
  'server',
  'app',
  'api',
  'content',
  '[...path]',
  'route.js.nft.json'
);
const RUNTIME_ASSET_DIRECTORIES = new Set(['code', 'quiz', 'data']);

function walkRuntimeAssets(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRuntimeAssets(file, out);
    } else {
      const relative = path.relative(CONTENT_ROOT, file).split(path.sep);
      if (relative.some((segment) => RUNTIME_ASSET_DIRECTORIES.has(segment))) {
        out.push(path.resolve(file));
      }
    }
  }

  return out;
}

function main() {
  if (!fs.existsSync(TRACE_PATH)) {
    throw new Error(`Missing content API build trace: ${path.relative(ROOT, TRACE_PATH)}`);
  }

  const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
  const traceDirectory = path.dirname(TRACE_PATH);
  const tracedFiles = new Set(
    trace.files.map((file) => path.resolve(traceDirectory, file))
  );
  const expectedAssets = walkRuntimeAssets(CONTENT_ROOT).sort();
  const missingAssets = expectedAssets.filter((file) => !tracedFiles.has(file));

  if (missingAssets.length > 0) {
    console.error('Content API build trace is missing canonical runtime assets:');
    missingAssets.slice(0, 20).forEach((file) => {
      console.error(`  - ${path.relative(ROOT, file)}`);
    });
    if (missingAssets.length > 20) {
      console.error(`  - and ${missingAssets.length - 20} more`);
    }
    process.exit(1);
  }

  console.log(`Content API build trace includes ${expectedAssets.length} canonical runtime assets.`);
}

main();
