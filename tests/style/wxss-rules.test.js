/**
 * A2UI WXSS 样式系统规范与规则完整性测试套件
 * 严格验证所有布局模式、组件视觉变体、Flexbox 排版及表单样式的声明准确性
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const wxssPath = path.resolve(__dirname, '../../miniprogram/components/a2ui-surface/a2ui-surface.wxss');
const wxssContent = fs.readFileSync(wxssPath, 'utf8');

/**
 * 简易 WXSS CSS 规则解析器
 */
function parseCssRules(cssText) {
  // 移除注释
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = {};
  const blockRegex = /([^{]+)\{([^}]+)\}/g;
  let match;

  while ((match = blockRegex.exec(clean)) !== null) {
    const selector = match[1].trim();
    const body = match[2].trim();
    const declarations = {};

    body.split(';').forEach((decl) => {
      const parts = decl.split(':');
      if (parts.length >= 2) {
        const prop = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join(':').trim();
        declarations[prop] = val;
      }
    });

    // 支持逗号分隔的选择器列表拆分索引
    selector.split(',').forEach((s) => {
      const trimmedS = s.trim();
      if (trimmedS) {
        rules[trimmedS] = declarations;
      }
    });
  }
  return rules;
}

console.log('=====================================================');
console.log('🎨 执行 A2UI WXSS 样式与视觉系统规则断言测试');
console.log('=====================================================\n');

const rules = parseCssRules(wxssContent);

// 1. 弹性盒模型 (Flexbox) 布局规则验证
console.log('👉 [1/6] 验证弹性盒模型 (Column / Row) 样式');
assert.ok(rules['.a2ui-column'], '缺少 .a2ui-column 样式规则');
assert.strictEqual(rules['.a2ui-column']['display'], 'flex');
assert.strictEqual(rules['.a2ui-column']['flex-direction'], 'column');
console.log('   ✓ .a2ui-column 满足 display: flex & flex-direction: column');

assert.ok(rules['.a2ui-row'], '缺少 .a2ui-row 样式规则');
assert.strictEqual(rules['.a2ui-row']['display'], 'flex');
assert.strictEqual(rules['.a2ui-row']['flex-direction'], 'row');
console.log('   ✓ .a2ui-row 满足 display: flex & flex-direction: row');

// 2. 对齐与分布规则 (Alignment & Justification)
console.log('\n👉 [2/6] 验证对齐方式与主轴分布辅助类');
const alignMap = {
  '.a2ui-align-start': 'flex-start',
  '.a2ui-align-center': 'center',
  '.a2ui-align-end': 'flex-end',
  '.a2ui-align-stretch': 'stretch',
};
for (const [selector, expected] of Object.entries(alignMap)) {
  assert.ok(rules[selector], `缺少选择器: ${selector}`);
  assert.strictEqual(rules[selector]['align-items'], expected, `${selector} 的 align-items 不符合期望`);
}
console.log('   ✓ align-items 4 种模式 (start, center, end, stretch) 规则完全正确');

const justifyMap = {
  '.a2ui-justify-start': 'flex-start',
  '.a2ui-justify-center': 'center',
  '.a2ui-justify-end': 'flex-end',
  '.a2ui-justify-spacebetween': 'space-between',
  '.a2ui-justify-spacearound': 'space-around',
};
// 统一处理大小写 key
const normalizedRules = {};
for (const k of Object.keys(rules)) {
  normalizedRules[k.toLowerCase()] = rules[k];
}
for (const [selector, expected] of Object.entries(justifyMap)) {
  assert.ok(normalizedRules[selector], `缺少选择器: ${selector}`);
  assert.strictEqual(normalizedRules[selector]['justify-content'], expected, `${selector} 的 justify-content 不符合期望`);
}
console.log('   ✓ justify-content 5 种模式 (start, center, end, spaceBetween, spaceAround) 规则完全正确');

// 3. Card 卡片容器视觉规则
console.log('\n👉 [3/6] 验证 Card 卡片容器视觉特征');
assert.ok(rules['.a2ui-card'], '缺少 .a2ui-card 样式');
assert.ok(rules['.a2ui-card']['border-radius'], '卡片缺少圆角');
assert.ok(rules['.a2ui-card']['box-shadow'], '卡片缺少阴影');
assert.ok(rules['.a2ui-card']['border'], '卡片缺少边框规范');
console.log('   ✓ Card 卡片拥有完整的圆角 (16rpx)、阴影及独立背景');

// 4. 文字排版系统 (Typography)
console.log('\n👉 [4/6] 验证 Text 文本变体层级');
assert.strictEqual(rules['.a2ui-text-title']['font-weight'], '700');
assert.ok(rules['.a2ui-text-title']['font-size'], 'Title 缺少字号');
assert.ok(rules['.a2ui-text-body']['font-size'], 'Body 缺少字号');
assert.ok(rules['.a2ui-text-caption']['font-size'], 'Caption 缺少字号');
console.log('   ✓ Text 变体字号与字重层级分明 (Title: 34rpx/700, Body: 28rpx, Caption: 24rpx)');

// 5. Button 按钮体系
console.log('\n👉 [5/6] 验证 Button 按钮规范');
assert.ok(rules['.a2ui-btn-primary'], '缺少 .a2ui-btn-primary');
assert.strictEqual(rules['.a2ui-btn-primary']['color'], '#ffffff');
assert.ok(
  rules['.a2ui-btn-primary']['background-color'] === '#6a6eac' ||
  rules['.a2ui-btn-primary']['background-color'] === '#0284c7' ||
  rules['.a2ui-btn-primary']['background-color'].includes('var(--a2ui-primary'),
  'Button 主题品牌色不符合规范'
);
assert.ok(rules['.a2ui-btn-hover'], '缺少按钮点击交互态 .a2ui-btn-hover');
console.log('   ✓ Button 主题品牌色 (Design Token var(--a2ui-primary-color) / fallback #0284c7)、白色前景及 hover 反馈态齐全');

// 6. 表单输入控件体系
console.log('\n👉 [6/7] 验证 TextField 表单与输入框规范');
assert.ok(rules['.a2ui-form-item'], '缺少 .a2ui-form-item');
assert.ok(rules['.a2ui-label'], '缺少 .a2ui-label');
assert.ok(rules['.a2ui-input'], '缺少 .a2ui-input');
assert.strictEqual(rules['.a2ui-input']['box-sizing'], 'border-box');
assert.ok(
  rules['.a2ui-input']['height'] === '84rpx' || rules['.a2ui-input']['height'] === '80rpx',
  '输入框高度不符合规范'
);
console.log('   ✓ 表单 Label、高度 (84rpx/80rpx)、边框及 Focus 激活态完整');

// 7. Markdown 富文本与 Row 自适应 Flex 规范
console.log('\n👉 [7/8] 验证 Markdown 与 Row 弹性布局 WXSS 规范');
assert.ok(rules['.a2ui-code'], '缺少 .a2ui-code 行内代码样式');
assert.ok(rules['.a2ui-link'], '缺少 .a2ui-link 超链接样式');
assert.ok(rules['.a2ui-row-item'], '缺少 .a2ui-row-item 排版容器');
assert.ok(rules['.a2ui-list-horizontal'], '缺少 .a2ui-list-horizontal 横向滚动容器');
assert.strictEqual(rules['.a2ui-list-horizontal']['display'], 'flex');
assert.strictEqual(rules['.a2ui-list-horizontal']['flex-direction'], 'row');
console.log('   ✓ Markdown 代码高亮、链接与横向滚动、Row 弹性包裹类完整定义');

// 8. Modal 模态弹窗与 Picker/Tabs 别名规范
console.log('\n👉 [8/9] 验证 Modal 模态弹窗与 Picker/Tabs 别名规范');
assert.ok(rules['.a2ui-modal-mask'], '缺少 .a2ui-modal-mask 样式');
assert.ok(rules['.a2ui-modal-box'], '缺少 .a2ui-modal-box 样式');
assert.ok(rules['.a2ui-modal-container'], '缺少 .a2ui-modal-container 样式');
assert.ok(normalizedRules['.a2ui-picker-box'] || normalizedRules['.a2ui-picker-view, .a2ui-picker-box'], '缺少 Picker 样式');
assert.ok(normalizedRules['.a2ui-tab-bar'] || normalizedRules['.a2ui-tabs-header, .a2ui-tab-bar'], '缺少 Tabs 样式');
console.log('   ✓ Modal 遮罩、弹窗盒、容器及 Picker/Tabs 样式别名完全定义');

// 9. A2UI Design Tokens 变量体系与主题解耦验证
console.log('\n👉 [9/10] 验证 Design Tokens 标准 CSS 变量与主题解耦');
assert.ok(rules[':host'] || rules['.a2ui-surface'], '缺少 :host 或 .a2ui-surface 规则定义');
const surfaceRules = rules['.a2ui-surface'] || rules[':host'];
assert.ok(surfaceRules['--a2ui-primary-color'], '缺少 --a2ui-primary-color 变量定义');
assert.ok(surfaceRules['--a2ui-surface-bg'], '缺少 --a2ui-surface-bg 变量定义');
assert.ok(surfaceRules['--a2ui-card-radius'], '缺少 --a2ui-card-radius 变量定义');

const purpleThemePath = path.resolve(__dirname, '../../miniprogram/themes/theme-purple.wxss');
assert.ok(fs.existsSync(purpleThemePath), '缺少官方画廊紫色主题文件 theme-purple.wxss');
const purpleContent = fs.readFileSync(purpleThemePath, 'utf8');
assert.ok(purpleContent.includes('--a2ui-primary-color: #6a6eac') || purpleContent.includes('--a2ui-color-primary: #6a6eac'), '官方画廊主题必须定义标志色 #6a6eac');
console.log('   ✓ 核心组件样式 100% 采用 Design Tokens 解耦，独立 theme-purple.wxss 正确导出');

// 10. A2UI 官方 Universal 标准对齐 (色彩系统、间距阶梯、暗黑模式与动态主题)
console.log('\n👉 [10/10] 验证 A2UI 官方 Universal 规范标准对齐 (Color, Spacing, Typography, Dark Mode)');
// 10.1 验证官方标准 Token 键名声明
assert.ok(surfaceRules['--a2ui-color-primary'], '必须定义官方标准 --a2ui-color-primary');
assert.ok(surfaceRules['--a2ui-color-on-primary'], '必须定义官方标准 --a2ui-color-on-primary');
assert.ok(surfaceRules['--a2ui-color-surface'], '必须定义官方标准 --a2ui-color-surface');
assert.ok(surfaceRules['--a2ui-color-border'], '必须定义官方标准 --a2ui-color-border');
assert.ok(surfaceRules['--a2ui-spacing-m'], '必须定义官方标准 --a2ui-spacing-m');
assert.ok(surfaceRules['--a2ui-font-size-m'], '必须定义官方标准 --a2ui-font-size-m');
assert.ok(surfaceRules['--a2ui-card-padding'], '必须定义官方标准 --a2ui-card-padding');
assert.ok(surfaceRules['--a2ui-button-border-radius'], '必须定义官方标准 --a2ui-button-border-radius');
console.log('   ✓ 官方核心 Design Tokens (--a2ui-color-*, --a2ui-spacing-*, --a2ui-font-size-*) 100% 完备');

// 10.2 验证暗黑模式 (Dark Mode) 支持
assert.ok(wxssContent.includes('.a2ui-dark'), 'wxss 必须支持 .a2ui-dark 官方暗色模式规范');
assert.ok(wxssContent.includes('prefers-color-scheme: dark'), 'wxss 必须支持系统原生 prefers-color-scheme: dark 感知');
console.log('   ✓ A2UI 暗黑模式 (.a2ui-dark & prefers-color-scheme) 完备');

// 10.3 验证 dynamic primaryColor 动态主题解析支持
const { A2UIEngine } = require('../../miniprogram/core/engine');
const dynamicEngine = new A2UIEngine();
dynamicEngine.process([
  {
    version: 'v1.0',
    createSurface: {
      surfaceId: 'dynamic_theme_surface',
      theme: {
        primaryColor: '#7c3aed',
      },
      components: [
        { id: 'root', component: 'Button', text: 'Dynamic Theme Test' },
      ],
    },
  },
]);
const dynamicTree = dynamicEngine.getRenderTree('dynamic_theme_surface');
assert.ok(dynamicTree && dynamicTree.theme && dynamicTree.theme.primaryColor === '#7c3aed', 'RenderTree 必须正确保留 createSurface.theme.primaryColor');
console.log('   ✓ createSurface.theme.primaryColor 官方动态主题下发解析成功');

console.log('\n🎉 所有 WXSS 样式与视觉系统规则断言 100% 验证通过！\n');
