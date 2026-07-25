#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const scanHistory = process.argv.includes('--history');

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.env',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdoc',
  '.mdx',
  '.mjs',
  '.rules',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const allowList = [
  /AKIAIOSFODNN7EXAMPLE/,
  /-----BEGIN \(RSA \|EC \|OPENSSH \|\)PRIVATE KEY-----/,
  /sk-\(\?:proj-\[A-Za-z0-9_-\]\{32,\}\|\[A-Za-z0-9\]\{32,\}\)/,
];

const patterns = [
  {
    name: 'OpenAI API key',
    regex: /sk-(?:proj-[A-Za-z0-9_-]{32,}|[A-Za-z0-9]{32,})/g,
    grep: 'sk-(proj-[A-Za-z0-9_-]{32,}|[A-Za-z0-9]{32,})',
  },
  { name: 'GitHub token', regex: /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/g, grep: '(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})' },
  { name: 'Slack token', regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g, grep: 'xox[baprs]-[A-Za-z0-9-]{10,}' },
  { name: 'AWS access key id', regex: /AKIA[0-9A-Z]{16}/g, grep: 'AKIA[0-9A-Z]{16}' },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g, grep: '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' },
];

const githubPrivateKeyPlaceholder =
  'GITHUB_APP_PRIVATE_KEY=' + '-----BEGIN RSA ' + 'PRIVATE KEY-----\\n...';
const privateKeyPlaceholderPattern =
  /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----\\n\.\.\.\\n-----END (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/;

function trackedFiles() {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean);
}

function isProbablyText(file) {
  if (file === '.env.example' || file === '.npmrc' || file === '.nvmrc') {
    return true;
  }

  const dot = file.lastIndexOf('.');
  if (dot === -1) {
    return false;
  }

  return textExtensions.has(file.slice(dot).toLowerCase());
}

function lineAndColumn(source, index) {
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function lineAt(source, index) {
  const start = source.lastIndexOf('\n', index) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end === -1 ? undefined : end);
}

function isAllowedFinding(file, source, index, value) {
  if (allowList.some((allowed) => allowed.test(value))) {
    return true;
  }

  const line = lineAt(source, index);

  if (
    file === 'docs/DEVELOPMENT.md' &&
    line.includes(githubPrivateKeyPlaceholder)
  ) {
    return true;
  }

  if (privateKeyPlaceholderPattern.test(line)) {
    return true;
  }

  if (
    file === 'scripts/scan-secrets.cjs' &&
    line.includes("name: 'Private key block'")
  ) {
    return true;
  }

  return false;
}

function isAllowedLine(file, line, value) {
  if (allowList.some((allowed) => allowed.test(value))) {
    return true;
  }

  if (
    file === 'docs/DEVELOPMENT.md' &&
    line.includes(githubPrivateKeyPlaceholder)
  ) {
    return true;
  }

  if (privateKeyPlaceholderPattern.test(line)) {
    return true;
  }

  if (
    file === 'scripts/scan-secrets.cjs' &&
    line.includes("name: 'Private key block'")
  ) {
    return true;
  }

  return false;
}

function redact(value) {
  if (value.length <= 12) {
    return '[redacted]';
  }
  return `${value.slice(0, 6)}…${value.slice(-4)} (${value.length} chars)`;
}

const findings = [];

for (const file of trackedFiles()) {
  if (!isProbablyText(file) || !fs.existsSync(file)) {
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern.regex)) {
      const value = match[0];
      if (isAllowedFinding(file, source, match.index ?? 0, value)) {
        continue;
      }

      const location = lineAndColumn(source, match.index ?? 0);
      findings.push({
        file,
        line: location.line,
        column: location.column,
        name: pattern.name,
        value,
      });
    }
  }
}

function allCommits() {
  if (!scanHistory) {
    return [];
  }

  return execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function scanGitHistory() {
  const commits = allCommits();
  if (commits.length === 0) {
    return;
  }

  for (const pattern of patterns) {
    for (const commitChunk of chunks(commits, 40)) {
      let output = '';
      try {
        output = execFileSync(
          'git',
          ['grep', '-I', '-n', '-E', '-e', pattern.grep, ...commitChunk],
          { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 }
        );
      } catch (error) {
        if (error.status === 1) {
          continue;
        }
        throw error;
      }

      for (const row of output.split('\n').filter(Boolean)) {
        const firstColon = row.indexOf(':');
        const secondColon = row.indexOf(':', firstColon + 1);
        const thirdColon = row.indexOf(':', secondColon + 1);
        if (firstColon === -1 || secondColon === -1 || thirdColon === -1) {
          continue;
        }

        const commit = row.slice(0, firstColon);
        const file = row.slice(firstColon + 1, secondColon);
        const lineNumber = Number(row.slice(secondColon + 1, thirdColon));
        const line = row.slice(thirdColon + 1);

        for (const match of line.matchAll(pattern.regex)) {
          const value = match[0];
          if (isAllowedLine(file, line, value)) {
            continue;
          }

          findings.push({
            commit,
            file,
            line: lineNumber,
            column: (match.index ?? 0) + 1,
            name: pattern.name,
            value,
          });
        }
      }
    }
  }
}

scanGitHistory();

if (findings.length > 0) {
  console.error('\nPotential secrets found in tracked files:\n');
  for (const finding of findings) {
    const location = finding.commit
      ? `${finding.commit.slice(0, 12)}:${finding.file}:${finding.line}:${finding.column}`
      : `${finding.file}:${finding.line}:${finding.column}`;
    console.error(
      `- ${location} ${finding.name}: ${redact(finding.value)}`
    );
  }
  console.error('\nMove secrets to .env.local or a private secret manager, then rerun pnpm scan:secrets.\n');
  process.exit(1);
}

console.log(
  scanHistory
    ? 'No obvious secrets found in tracked text files or git history.'
    : 'No obvious secrets found in tracked text files.'
);
