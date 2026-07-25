#!/usr/bin/env node
/**
 * Audits the permanent registry-backed content structure.
 *
 *   node scripts/audit-content-structure.cjs
 *   node scripts/audit-content-structure.cjs --json
 *   node scripts/audit-content-structure.cjs --strict
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.join(ROOT, 'app');
const CONTENT_ENTRIES_ROOT = path.join(ROOT, 'content', 'entries');
const LEGACY_LESSONS_ROOT = path.join(ROOT, 'content', 'lessons');
const REGISTRY_PATH = path.join(ROOT, 'lib', 'content-registry.ts');
const SECTIONS = [
  'fundamentals',
  'genai',
  'ml-systems',
  'technology',
  'case-studies',
  'practice',
  'reference',
  'tools',
];
const REQUIRED_DYNAMIC_ROUTES = new Set(
  SECTIONS.map((section) => `/${section}/[slug]`)
);
const INTENTIONAL_NON_CONTENT_ROUTES = new Set([
  '/ml-systems/reference',
  '/ml-systems/technology',
  '/practice/quiz/[topic]',
  '/tools/calculators',
]);

function parseArgs(argv) {
  const supported = new Set(['--json', '--strict']);
  const unknown = argv.filter((arg) => !supported.has(arg));
  if (unknown.length > 0) {
    throw new Error(`unknown option${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`);
  }
  return {
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
  };
}

function loadRegistry() {
  const source = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: REGISTRY_PATH,
  });

  const mod = new Module(REGISTRY_PATH, module);
  mod.filename = REGISTRY_PATH;
  mod.paths = Module._nodeModulePaths(path.dirname(REGISTRY_PATH));
  mod._compile(outputText, REGISTRY_PATH);
  return mod.exports.CONTENT_REGISTRY || [];
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, out);
    } else if (!predicate || predicate(full)) {
      out.push(full);
    }
  }

  return out;
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch (_error) {
    return false;
  }
}

function routeFromPageFile(file) {
  const route = '/' + path.relative(APP_ROOT, path.dirname(file)).replace(/\\/g, '/');
  return route === '/.' ? '/' : route;
}

function slugFromPath(routePath) {
  return String(routePath || '').split('/').filter(Boolean).pop() || '';
}

function canonicalBodyForNode(node) {
  return path.join(
    CONTENT_ENTRIES_ROOT,
    String(node.section || ''),
    slugFromPath(node.path),
    'index.mdoc'
  );
}

function concretePageForNode(node) {
  return path.join(APP_ROOT, String(node.path || '').replace(/^\//, ''), 'page.tsx');
}

function toRelative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function parseScalarFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|\s*$)/);
  if (!match) return {};

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return data;
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function duplicatesBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function createReport() {
  const registry = loadRegistry();
  const active = registry.filter((node) => node.status === 'active');
  const authoredRegistryEntries = registry.filter((node) => node.renderMode === 'mdoc');
  const activePaths = new Set(active.map((node) => node.path));
  const activeNonMdocEntries = active
    .filter((node) => node.renderMode !== 'mdoc')
    .map((node) => ({ id: node.id, path: node.path, renderMode: node.renderMode || null }));

  const appPages = walkFiles(APP_ROOT, (file) => path.basename(file) === 'page.tsx');
  const sectionRoutes = appPages
    .map(routeFromPageFile)
    .filter((route) => SECTIONS.some(
      (section) => route === `/${section}` || route.startsWith(`/${section}/`)
    ))
    .sort();
  const sectionRouteSet = new Set(sectionRoutes);
  const sectionLandingRoutes = new Set(SECTIONS.map((section) => `/${section}`));
  const shadowingRegisteredPages = active
    .filter((node) => isFile(concretePageForNode(node)))
    .map((node) => ({
      id: node.id,
      path: node.path,
      file: toRelative(concretePageForNode(node)),
    }));
  const missingDynamicRoutes = [...REQUIRED_DYNAMIC_ROUTES]
    .filter((route) => !sectionRouteSet.has(route))
    .sort();
  const unexpectedSectionRoutes = sectionRoutes.filter(
    (route) =>
      !sectionLandingRoutes.has(route) &&
      !REQUIRED_DYNAMIC_ROUTES.has(route) &&
      !INTENTIONAL_NON_CONTENT_ROUTES.has(route) &&
      !activePaths.has(route)
  );
  const intentionalNonContentRoutes = sectionRoutes.filter((route) =>
    INTENTIONAL_NON_CONTENT_ROUTES.has(route)
  );

  const bodyInventory = authoredRegistryEntries.map((node) => ({
    node,
    file: canonicalBodyForNode(node),
  }));
  const expectedBodyFiles = new Set(bodyInventory.map((item) => toRelative(item.file)));
  const authoredBodyFiles = walkFiles(
    CONTENT_ENTRIES_ROOT,
    (file) => file.endsWith('.mdoc')
  ).sort();
  const missingBodies = bodyInventory
    .filter((item) => !isFile(item.file))
    .map((item) => ({ id: item.node.id, file: toRelative(item.file) }));
  const orphanBodies = authoredBodyFiles
    .map(toRelative)
    .filter((file) => !expectedBodyFiles.has(file));
  const duplicateBodyTargets = duplicatesBy(bodyInventory, (item) => toRelative(item.file)).map(
    ([file, items]) => ({ file, registryIds: items.map((item) => item.node.id).sort() })
  );
  const bodyBindings = authoredBodyFiles.map((file) => ({
    file: toRelative(file),
    registryId: parseScalarFrontmatter(fs.readFileSync(file, 'utf8')).registryId || '',
  }));
  const duplicateBodyBindings = duplicatesBy(bodyBindings, (item) => item.registryId).map(
    ([registryId, items]) => ({
      registryId,
      files: items.map((item) => item.file).sort(),
    })
  );
  const mismatchedBodyBindings = bodyInventory
    .filter((item) => isFile(item.file))
    .map((item) => ({
      id: item.node.id,
      file: toRelative(item.file),
      registryId:
        parseScalarFrontmatter(fs.readFileSync(item.file, 'utf8')).registryId || null,
    }))
    .filter((item) => item.registryId !== item.id);
  const legacyFallbackPresent = fs.existsSync(LEGACY_LESSONS_ROOT);
  const legacyFallbackFiles = walkFiles(LEGACY_LESSONS_ROOT).map(toRelative).sort();

  return {
    registry: {
      active: active.length,
      bySection: countBy(active, (node) => node.section),
      nonMdocEntries: activeNonMdocEntries,
    },
    routes: {
      physicalSectionRoutes: sectionRoutes.length,
      requiredDynamicRoutes: [...REQUIRED_DYNAMIC_ROUTES].sort(),
      missingDynamicRoutes,
      shadowingRegisteredPages,
      unexpectedSectionRoutes,
      intentionalNonContentRoutes,
    },
    bodies: {
      expected: expectedBodyFiles.size,
      authored: authoredBodyFiles.length,
      missing: missingBodies,
      orphan: orphanBodies,
      duplicateTargets: duplicateBodyTargets,
      duplicateBindings: duplicateBodyBindings,
      mismatchedBindings: mismatchedBodyBindings,
      legacyFallbackPresent,
      legacyFallbackFiles,
    },
  };
}

function blockersForReport(report) {
  return [
    ...report.registry.nonMdocEntries.map(
      (item) => `active registry entry ${item.id} is not mdoc`
    ),
    ...report.routes.shadowingRegisteredPages.map(
      (item) => `concrete page ${item.file} shadows ${item.path}`
    ),
    ...report.routes.unexpectedSectionRoutes.map(
      (route) => `unexpected section route ${route}`
    ),
    ...report.routes.missingDynamicRoutes.map(
      (route) => `missing dynamic route ${route}/page.tsx`
    ),
    ...report.bodies.missing.map((item) => `missing canonical body ${item.file}`),
    ...report.bodies.orphan.map((file) => `orphan canonical body ${file}`),
    ...report.bodies.duplicateTargets.map(
      (item) => `duplicate canonical body target ${item.file}`
    ),
    ...report.bodies.duplicateBindings.map(
      (item) => `duplicate canonical body binding ${item.registryId}`
    ),
    ...report.bodies.mismatchedBindings.map(
      (item) =>
        `canonical body ${item.file} binds ${item.registryId || '(missing registryId)'} instead of ${item.id}`
    ),
    ...(report.bodies.legacyFallbackPresent
      ? ['legacy content/lessons fallback path is present']
      : []),
  ];
}

function printReport(report) {
  console.log('\nContent structure audit\n');
  console.log(`Active registry entries: ${report.registry.active}`);
  console.log(`Canonical bodies: ${report.bodies.authored}/${report.bodies.expected}`);
  console.log(
    `Dynamic section routes: ${report.routes.requiredDynamicRoutes.length - report.routes.missingDynamicRoutes.length}/${report.routes.requiredDynamicRoutes.length}`
  );
  console.log(`Intentional non-content routes: ${report.routes.intentionalNonContentRoutes.length}`);
  console.log(`Physical section routes: ${report.routes.physicalSectionRoutes}`);

  const issues = blockersForReport(report);
  if (issues.length === 0) {
    console.log('\nFinal content structure invariants pass.');
  } else {
    console.log('\nStructural violations:');
    issues.forEach((issue) => console.log(`  - ${issue}`));
  }
  console.log('\nUse --json for machine-readable output. Use --strict to fail on violations.\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createReport();
  const blockers = blockersForReport(report);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (options.strict && blockers.length > 0) {
    console.error('Strict content audit failed:');
    blockers.forEach((blocker) => console.error(`  - ${blocker}`));
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error('Content structure audit failed:', error && error.message ? error.message : error);
  process.exit(1);
}
