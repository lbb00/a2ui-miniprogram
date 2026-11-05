/**
 * WeChat MiniProgram NPM Builder for Example Project
 * Simulates WeChat Developer Tools "构建 npm" (npm build)
 * Copies the root package's "miniprogram" directory to miniprogram_npm/
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../../miniprogram');
const targetDir = path.resolve(__dirname, '../miniprogram_npm/a2ui-miniprogram');

function copyRecursive(src, dest, ignoreNames = []) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreNames.includes(entry.name)) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, ignoreNames);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`📦 构建 a2ui-miniprogram NPM 模块至: ${targetDir}`);
copyRecursive(srcDir, targetDir);

// 确保在 node_modules 中也建立软链或引用，以便 Node.js 单测能直接 require('a2ui-miniprogram')
const nodeModulesDir = path.resolve(__dirname, '../node_modules');
if (!fs.existsSync(nodeModulesDir)) {
  fs.mkdirSync(nodeModulesDir, { recursive: true });
}
const nodeModuleTarget = path.join(nodeModulesDir, 'a2ui-miniprogram');
if (fs.existsSync(nodeModuleTarget)) {
  fs.rmSync(nodeModuleTarget, { recursive: true, force: true });
}
const pkgDir = process.env.A2UI_PKG_DIR || path.resolve(__dirname, '../../..');
try {
  fs.symlinkSync(pkgDir, nodeModuleTarget, 'dir');
  console.log(`🔗 成功软链 node_modules/a2ui-miniprogram -> ${pkgDir}`);
} catch (e) {
  // 降级拷贝：仅拷贝 package.json 声明的分发文件，严格排除递归拷贝到自身以及 node_modules/examples 目录
  const distFiles = ['miniprogram', 'index.js', 'package.json', 'README.md'];
  fs.mkdirSync(nodeModuleTarget, { recursive: true });
  for (const item of distFiles) {
    const s = path.join(pkgDir, item);
    const d = path.join(nodeModuleTarget, item);
    if (fs.existsSync(s)) {
      if (fs.statSync(s).isDirectory()) {
        copyRecursive(s, d, ['node_modules', 'miniprogram_npm', '.git']);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  }
  console.log('📁 拷贝 node_modules/a2ui-miniprogram 完成 (仅包含分发产物，排除递归嵌套)');
}

console.log('✅ 构建 npm 完成！');
