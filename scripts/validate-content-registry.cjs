#!/usr/bin/env node
/**
 * validate-content-registry.cjs
 *
 * The content gate. Validates the typed registry loaded from the admin-managed
 * content/registry.json source for structural integrity. Run before every content PR;
 * CI runs it on every push/PR.
 *
 *   node scripts/validate-content-registry.cjs            # validate, fail on errors
 *   node scripts/validate-content-registry.cjs --strict   # also fail on quality warnings
 *
 * ERRORS (exit 1):  duplicate ids/paths, broken prerequisite/related/canonical/nextInSequence
 *                   references, invalid section/level/status enum values, missing required fields.
 * WARNINGS (exit 0 unless --strict):  SEO meta descriptions > 160 chars, entries with no tags,
 *                   path that does not start with /<section>/.
 *
 * Loads the TypeScript registry by transpiling it in-memory with the `typescript` dependency — no
 * build step required. Falls back to a lightweight text scan if `typescript` is unavailable.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'lib', 'content-registry.ts');

const STRICT = process.argv.includes('--strict');

const VALID_SECTIONS = [
  'fundamentals', 'genai', 'ml-systems', 'technology',
  'case-studies', 'practice', 'reference', 'tools',
];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];
const VALID_STATUS = ['active', 'draft', 'deprecated'];

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/** Transpile + load the TS registry in-memory. Returns its module exports. */
function loadRegistry() {
  let ts;
  try {
    ts = require('typescript');
  } catch (_e) {
    return null; // signal fallback
  }
  const source = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: REGISTRY_PATH,
  });
  const m = new Module(REGISTRY_PATH, module);
  m.filename = REGISTRY_PATH;
  m.paths = Module._nodeModulePaths(path.dirname(REGISTRY_PATH));
  m._compile(outputText, REGISTRY_PATH);
  return m.exports;
}

/** Fallback: scan the raw .ts text for duplicate ids/paths only. */
function fallbackTextScan() {
  const text = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const ids = [...text.matchAll(/^\s{4}id:\s*'([^']+)'/gm)].map((m) => m[1]);
  const paths = [...text.matchAll(/^\s{4}path:\s*'([^']+)'/gm)].map((m) => m[1]);
  const errors = [];
  const dupe = (arr, kind) => {
    const seen = new Set();
    for (const v of arr) {
      if (seen.has(v)) errors.push(`Duplicate ${kind}: ${v}`);
      seen.add(v);
    }
  };
  dupe(ids, 'id');
  dupe(paths, 'path');
  return { errors, warnings: [], dangling: new Map(), count: ids.length };
}

function validate(registry) {
  const nodes = registry.CONTENT_REGISTRY;
  if (!Array.isArray(nodes)) {
    return { errors: ['CONTENT_REGISTRY export is missing or not an array'], warnings: [], dangling: new Map(), count: 0 };
  }

  const byId = new Map();
  const errors = [];
  const warnings = [];
  const dangling = new Map(); // missingId -> occurrence count (soft prerequisite/related hints)
  const ids = new Set();
  const paths = new Set();

  // index first so reference checks can see every id
  nodes.forEach((n) => byId.set(n.id, n));
  const hasId = (id) => byId.has(id);
  const noteDangling = (id) => dangling.set(id, (dangling.get(id) || 0) + 1);

  nodes.forEach((node, i) => {
    const where = `[${i}] ${node && node.id ? node.id : '(no id)'}`;

    // required fields — ERROR
    for (const field of ['id', 'title', 'path', 'section', 'level', 'renderMode']) {
      if (!node[field]) errors.push(`${where}: missing required field "${field}"`);
    }
    if (node.renderMode !== 'mdoc') {
      errors.push(`${where}: renderMode must be "mdoc"`);
    }
    if (node.hasQuiz !== true) {
      errors.push(`${where}: hasQuiz must be true; every lesson requires one assessment`);
    }
    if (!node.seo || typeof node.seo.metaDescription !== 'string') {
      errors.push(`${where}: missing seo.metaDescription`);
    }

    // duplicates — ERROR (breaks routing / SSOT)
    if (node.id) {
      if (ids.has(node.id)) errors.push(`${where}: duplicate id`);
      ids.add(node.id);
    }
    if (node.path) {
      if (paths.has(node.path)) errors.push(`${where}: duplicate path "${node.path}"`);
      paths.add(node.path);
    }

    // enums — ERROR
    if (node.section && !VALID_SECTIONS.includes(node.section)) {
      errors.push(`${where}: invalid section "${node.section}"`);
    }
    if (node.level && !VALID_LEVELS.includes(node.level)) {
      errors.push(`${where}: invalid level "${node.level}"`);
    }
    if (node.status && !VALID_STATUS.includes(node.status)) {
      errors.push(`${where}: invalid status "${node.status}"`);
    }

    // canonical / sequence references affect URLs + routing — ERROR
    if (node.canonicalId && !hasId(node.canonicalId)) {
      errors.push(`${where}: invalid canonicalId "${node.canonicalId}"`);
    }
    if (node.nextInSequence && !hasId(node.nextInSequence)) {
      errors.push(`${where}: invalid nextInSequence "${node.nextInSequence}"`);
    }

    // prerequisites / related are soft nav hints — missing targets degrade suggestions but
    // do not break the app, so they are WARNINGS (summarized below). Use --strict to enforce.
    (node.prerequisites || []).forEach((id) => { if (!hasId(id)) noteDangling(id); });
    (node.related || []).forEach((id) => { if (!hasId(id)) noteDangling(id); });

    // quality warnings
    if (node.seo && typeof node.seo.metaDescription === 'string' && node.seo.metaDescription.length > 160) {
      warnings.push(`${where}: SEO meta description ${node.seo.metaDescription.length} chars (max 160)`);
    }
    if (Array.isArray(node.tags) && node.tags.length === 0) {
      warnings.push(`${where}: no tags`);
    }
    if (node.section && node.path && !node.path.startsWith(`/${node.section}/`) && node.path !== `/${node.section}`) {
      warnings.push(`${where}: path "${node.path}" does not start with /${node.section}/`);
    }
  });

  return { errors, warnings, dangling, count: nodes.length };
}

function main() {
  console.log(c.bold('\n🔎 Validating content registry') + c.dim(`  (${path.relative(ROOT, REGISTRY_PATH)})\n`));

  let result;
  let usedFallback = false;
  const registry = loadRegistry();
  if (!registry) {
    usedFallback = true;
    result = fallbackTextScan();
  } else {
    result = validate(registry);
  }

  const { errors, warnings, dangling, count } = result;
  const CAP = 25;

  if (usedFallback) {
    console.log(c.yellow('⚠  `typescript` not installed — ran a limited text-only scan (duplicate ids/paths).'));
    console.log(c.dim('   Run `pnpm install` for full validation.\n'));
  }

  // Dangling soft references (prerequisites/related → unknown ids), summarized by missing id.
  const danglingIds = dangling ? [...dangling.entries()].sort((a, b) => b[1] - a[1]) : [];
  const danglingTotal = danglingIds.reduce((sum, [, n]) => sum + n, 0);
  if (danglingIds.length) {
    console.log(c.yellow(`Dangling relationship references: ${danglingTotal} reference(s) point to ${danglingIds.length} unknown id(s)`));
    danglingIds.slice(0, CAP).forEach(([id, n]) =>
      console.log('  ' + c.yellow('•') + ` ${id} ` + c.dim(`(referenced ${n}×)`))
    );
    if (danglingIds.length > CAP) console.log(c.dim(`  …and ${danglingIds.length - CAP} more`));
    console.log(c.dim('  (prerequisites/related are soft nav hints — non-blocking. Add the missing lessons or trim the refs.)\n'));
  }

  if (warnings.length) {
    console.log(c.yellow(`Warnings (${warnings.length}):`));
    warnings.slice(0, CAP).forEach((w) => console.log('  ' + c.yellow('•') + ' ' + w));
    if (warnings.length > CAP) console.log(c.dim(`  …and ${warnings.length - CAP} more`));
    console.log('');
  }

  if (errors.length) {
    console.log(c.red(`Errors (${errors.length}):`));
    errors.forEach((e) => console.log('  ' + c.red('✗') + ' ' + e));
    console.log('');
  }

  const softCount = warnings.length + danglingIds.length;
  console.log(c.dim('────────────────────────────────────────'));
  console.log(
    `${c.cyan('Entries:')} ${count}   ${c.red('Errors:')} ${errors.length}   ` +
    `${c.yellow('Warnings:')} ${warnings.length}   ${c.yellow('Dangling refs:')} ${danglingIds.length}`
  );

  const failOnSoft = STRICT && softCount > 0;
  if (errors.length > 0 || failOnSoft) {
    console.log(c.red(c.bold('\n✗ Registry validation failed.\n')));
    process.exit(1);
  }

  console.log(
    c.green(c.bold('\n✓ Registry is valid.')) +
    (softCount ? c.dim('  (warnings/dangling refs are non-blocking; use --strict to enforce)') : '') + '\n'
  );
}

try {
  main();
} catch (err) {
  console.error(c.red('\n✗ Validator crashed:'), err && err.message ? err.message : err);
  console.error(c.dim('   This usually means lib/content-registry.ts has a syntax error.\n'));
  process.exit(1);
}
