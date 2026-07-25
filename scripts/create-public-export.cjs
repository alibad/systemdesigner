#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
} = require('node:fs');
const path = require('node:path');

function usage() {
  console.log(`Usage: pnpm create:public-export <target-directory>

Creates a non-destructive public export from the current working tree.

The export includes tracked files plus untracked, non-ignored files, then skips
private maintainer material, local secrets, build output, and dependency caches.
Use it when publishing a fresh public repository without carrying private git
history forward.

Example:
  pnpm create:public-export ../systemdesigner-public
`);
}

const targetArg = process.argv[2];

if (!targetArg || targetArg === '-h' || targetArg === '--help') {
  usage();
  process.exit(targetArg ? 0 : 1);
}

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const targetRoot = path.resolve(process.cwd(), targetArg);

if (targetRoot === repoRoot || targetRoot.startsWith(`${repoRoot}${path.sep}`)) {
  console.error('Refusing to export into this repository. Choose a sibling or external directory.');
  process.exit(1);
}

if (existsSync(targetRoot) && readdirSync(targetRoot).length > 0) {
  console.error(`Refusing to write into a non-empty directory: ${targetRoot}`);
  process.exit(1);
}

const excludedPrefixes = [
  '.git/',
  '.next/',
  '.turbo/',
  '.vercel/',
  'archive/',
  'build/',
  'coverage/',
  'dist/',
  'docs/knowledge-base/',
  'docs/research/',
  'node_modules/',
  'out/',
  'screenshots/',
  'secrets/',
  'todo/',
];

const excludedExact = new Set([
  '.DS_Store',
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.production.local',
  '.env.test.local',
]);

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldExclude(relativePath) {
  const normalized = normalizePath(relativePath);
  const baseName = path.basename(normalized);

  if (excludedExact.has(normalized) || baseName === '.DS_Store') {
    return true;
  }

  if (/^\.env\.(?!example$)/.test(normalized)) {
    return true;
  }

  if (/\.(log|pem|p12|p8|key|tsbuildinfo)$/i.test(normalized)) {
    return true;
  }

  return excludedPrefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function copyEntry(relativePath) {
  if (shouldExclude(relativePath)) {
    return false;
  }

  const sourcePath = path.join(repoRoot, relativePath);

  if (!existsSync(sourcePath)) {
    return false;
  }

  const destinationPath = path.join(targetRoot, relativePath);
  const stats = lstatSync(sourcePath);

  mkdirSync(path.dirname(destinationPath), { recursive: true });

  if (stats.isSymbolicLink()) {
    symlinkSync(readlinkSync(sourcePath), destinationPath);
    return true;
  }

  if (!stats.isFile()) {
    return false;
  }

  copyFileSync(sourcePath, destinationPath);
  return true;
}

const filesOutput = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: repoRoot,
  encoding: 'buffer',
  maxBuffer: 1024 * 1024 * 200,
});

const files = filesOutput.toString('utf8').split('\0').filter(Boolean);

mkdirSync(targetRoot, { recursive: true });

let copied = 0;
let skipped = 0;

for (const file of files) {
  if (copyEntry(file)) {
    copied += 1;
  } else {
    skipped += 1;
  }
}

console.log(`Created public export: ${targetRoot}`);
console.log(`Copied ${copied} files; skipped ${skipped} deleted, ignored, generated, or private files.`);
console.log('');
console.log('Next steps:');
console.log(`  cd ${targetRoot}`);
console.log('  corepack enable && corepack prepare pnpm@10.4.1 --activate');
console.log('  pnpm install --frozen-lockfile');
console.log('  pnpm check');
console.log('  git init -b main && git add . && git commit -m "chore: initial public release"');
