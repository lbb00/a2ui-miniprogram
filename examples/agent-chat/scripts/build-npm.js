/**
 * WeChat MiniProgram NPM Builder for Example Project
 * Simulates WeChat Developer Tools "构建 npm" (npm build)
 * Copies the root package's "miniprogram" directory to miniprogram_npm/
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../../miniprogram');
const targetDir = path.resolve(__dirname, '../miniprogram_npm/a2ui-miniprogram');

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
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
  copyRecursive(pkgDir, nodeModuleTarget);
  console.log('📁 拷贝 node_modules/a2ui-miniprogram 完成');
}

console.log('✅ 构建 npm 完成！');
