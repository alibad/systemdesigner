#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'lib/daily-learning-cloud.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, LEARNING_EMULATOR_TESTS: '1' },
});
process.exit(result.status ?? 1);
