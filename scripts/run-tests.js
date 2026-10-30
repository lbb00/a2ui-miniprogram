#!/usr/bin/env node

/**
 * A2UI MiniProgram Unified Test Runner
 * Automated runner for unit, protocol, security, performance, and E2E test suites.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.resolve(ROOT_DIR, 'tests');

// Test suites matrix ordered by dependency layers
const TEST_SUITES = [
  // 1. Core engine and data model foundation
  'module-export.test.js',
  'engine.test.js',
  'core-reinforce.test.js',
  'data-model-safety.test.js',
  'regression-boundaries.test.js',
  'engine-limits.test.js',

  // 2. Protocol specifications, RPC and capabilities
  'protocol-rpc-and-functions.test.js',
  'rpc-capabilities.test.js',
  'deep-tree-and-rpc.test.js',

  // 3. Security defenses and penetration tests
  'security-penetration.test.js',
  'security-regex-prototype.test.js',

  // 4. Component systems, forms and lifecycle
  'component-lifecycle.test.js',
  'custom-components-expansion.test.js',
  'surface-component-hardening.test.js',
  'stepper-and-switch.test.js',
  'picker-modal-hardening.test.js',
  'layout-markdown-horizontal.test.js',

  // 5. Rendering architecture, performance and visual specs
  'performance-architecture.test.js',
  'wechat-runtime-performance.test.js',
  'visual-parity.test.js',
  'style/wxss-rules.test.js',

  // 6. E2E and official gallery render suites
  'e2e/official-all-36.test.js',
  'e2e/headless-automator.test.js',
  'e2e/simulate-component-e2e.test.js',
  'e2e/adversarial-render.test.js',
];

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('-')) || '';
const isPerfOnly = args.includes('--perf');
const isStyleOnly = args.includes('--style');
const isE2EOnly = args.includes('--e2e');
const isUnitOnly = args.includes('--unit');
const isVerbose = args.includes('-v') || args.includes('--verbose');

let targets = TEST_SUITES;

if (isPerfOnly) {
  targets = targets.filter((f) => f.includes('perf'));
} else if (isStyleOnly) {
  targets = targets.filter((f) => f.includes('style') || f.includes('visual'));
} else if (isE2EOnly) {
  targets = targets.filter((f) => f.startsWith('e2e/'));
} else if (isUnitOnly) {
  targets = targets.filter((f) => !f.startsWith('e2e/'));
} else if (filter) {
  targets = targets.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));
}

if (targets.length === 0) {
  console.error(`❌ No test suites matched: "${filter}"`);
  process.exit(1);
}

console.log('================================================================');
console.log(`🚀 A2UI Test Suite Runner (${targets.length} test files)`);
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const startTime = Date.now();
const failures = [];

for (let i = 0; i < targets.length; i++) {
  const relFile = targets[i];
  const fullPath = path.resolve(TESTS_DIR, relFile);

  if (!fs.existsSync(fullPath)) {
    console.error(`[MISSING] ${relFile} does not exist`);
    failedCount++;
    failures.push({ file: relFile, error: 'File not found' });
    continue;
  }

  process.stdout.write(`[${i + 1}/${targets.length}] Running ${relFile} ... `);
  const suiteStart = Date.now();

  const res = spawnSync(process.execPath, [fullPath], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    env: process.env,
  });

  const duration = Date.now() - suiteStart;

  if (res.status === 0) {
    passedCount++;
    console.log(`\x1b[32m✓ PASS\x1b[0m (${duration}ms)`);
    if (isVerbose && res.stdout) {
      console.log(res.stdout);
    }
  } else {
    failedCount++;
    console.log(`\x1b[31m✖ FAIL\x1b[0m (${duration}ms)`);
    failures.push({
      file: relFile,
      stdout: res.stdout,
      stderr: res.stderr,
    });
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n================================================================');
if (failedCount === 0) {
  console.log(`\x1b[32m🎉 All tests passed! (${passedCount}/${targets.length} passed in ${totalDuration}s)\x1b[0m`);
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.log(`\x1b[31m💥 Test run failed! (${passedCount} passed, ${failedCount} failed in ${totalDuration}s)\x1b[0m`);
  console.log('================================================================\n');

  console.log('Failure details:\n');
  failures.forEach(({ file, stdout, stderr }) => {
    console.log(`--- [FAIL] ${file} ---`);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    console.log('\n');
  });

  process.exit(1);
}
