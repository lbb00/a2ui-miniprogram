#!/usr/bin/env node

/**
 * A2UI MiniProgram Unified Test Runner
 * 统一标准测试运行器：自动化执行单元测试、协议测试、安全性测试、性能测试与 E2E 测试
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.resolve(ROOT_DIR, 'tests');

// 按照依赖深度与执行分层组织的测试矩阵
const TEST_SUITES = [
  // 1. 核心引擎与数据模型基础
  'module-export.test.js',
  'engine.test.js',
  'core-reinforce.test.js',
  'data-model-safety.test.js',
  'regression-boundaries.test.js',
  'engine-limits.test.js',

  // 2. 协议规范、RPC 与能力扩展
  'protocol-rpc-and-functions.test.js',
  'rpc-capabilities.test.js',
  'deep-tree-and-rpc.test.js',

  // 3. 安全防御与攻防渗透
  'security-penetration.test.js',
  'security-regex-prototype.test.js',

  // 4. 组件系统、表单与生命周期
  'component-lifecycle.test.js',
  'custom-components-expansion.test.js',
  'surface-component-hardening.test.js',
  'stepper-and-switch.test.js',
  'picker-modal-hardening.test.js',
  'layout-markdown-horizontal.test.js',

  // 5. 渲染架构、性能与视觉规范
  'performance-architecture.test.js',
  'visual-parity.test.js',
  'style/wxss-rules.test.js',

  // 6. E2E 与官方全量 36 画廊渲染
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
  console.error(`❌ 未找到匹配 "${filter}" 的测试用例`);
  process.exit(1);
}

console.log('================================================================');
console.log(`🚀 A2UI 测试套件运行器 (共 ${targets.length} 个测试文件)`);
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const startTime = Date.now();
const failures = [];

for (let i = 0; i < targets.length; i++) {
  const relFile = targets[i];
  const fullPath = path.resolve(TESTS_DIR, relFile);

  if (!fs.existsSync(fullPath)) {
    console.error(`[MISSING] ${relFile} 文件不存在`);
    failedCount++;
    failures.push({ file: relFile, error: 'File not found' });
    continue;
  }

  process.stdout.write(`[${i + 1}/${targets.length}] 正在运行 ${relFile} ... `);
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
  console.log(`\x1b[32m🎉 测试全部通过！(${passedCount}/${targets.length} passed in ${totalDuration}s)\x1b[0m`);
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.log(`\x1b[31m💥 测试失败！(${passedCount} passed, ${failedCount} failed in ${totalDuration}s)\x1b[0m`);
  console.log('================================================================\n');

  console.log('失败测试详细报错信息：\n');
  failures.forEach(({ file, stdout, stderr }) => {
    console.log(`--- [FAIL] ${file} ---`);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    console.log('\n');
  });

  process.exit(1);
}
