#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', '.next');
const packageFile = path.join(distDir, 'package.json');
const contents = '{"type":"commonjs"}\n';

fs.mkdirSync(distDir, { recursive: true });
if (!fs.existsSync(packageFile) || fs.readFileSync(packageFile, 'utf8') !== contents) {
  fs.writeFileSync(packageFile, contents);
}
