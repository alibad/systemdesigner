#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_MODULE_PATH = path.join(ROOT, 'lib', 'content-registry.ts');
const REGISTRY_DATA_PATH = path.join(ROOT, 'content', 'registry.json');

function loadRegistry() {
  const source = fs.readFileSync(REGISTRY_MODULE_PATH, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: REGISTRY_MODULE_PATH,
  });
  const registryModule = new Module(REGISTRY_MODULE_PATH, module);
  registryModule.filename = REGISTRY_MODULE_PATH;
  registryModule.paths = Module._nodeModulePaths(path.dirname(REGISTRY_MODULE_PATH));
  registryModule._compile(outputText, REGISTRY_MODULE_PATH);
  return registryModule.exports.CONTENT_REGISTRY;
}

const registry = loadRegistry();
if (!Array.isArray(registry)) {
  throw new Error('CONTENT_REGISTRY is not available.');
}

fs.mkdirSync(path.dirname(REGISTRY_DATA_PATH), { recursive: true });
fs.writeFileSync(REGISTRY_DATA_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
console.log(`Wrote ${registry.length} entries to ${path.relative(ROOT, REGISTRY_DATA_PATH)}.`);
