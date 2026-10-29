const assert = require('assert');

console.log('--- [1] 验证 a2ui-miniprogram 根 index.js 模块导出 ---');
const rootModule = require('../index');
assert(rootModule.A2UIEngine, '根模块应导出 A2UIEngine');
assert(rootModule.resolveValue, '根模块应导出 resolveValue');
assert(rootModule.resolveDeep, '根模块应导出 resolveDeep');
assert(rootModule.getValueByPath, '根模块应导出 getValueByPath');
assert(rootModule.hasMarkdown, '根模块应导出 hasMarkdown');
assert(rootModule.parseMarkdown, '根模块应导出 parseMarkdown');
console.log('✓ 根模块导出验证通过');

console.log('\n--- [2] 验证 a2ui-miniprogram 小程序目录 (miniprogram/index.js) 模块导出 ---');
const mpModule = require('../miniprogram/index');
assert(mpModule.A2UIEngine, '小程序模块应导出 A2UIEngine');
assert(mpModule.resolveValue, '小程序模块应导出 resolveValue');
assert(mpModule.hasMarkdown, '小程序模块应导出 hasMarkdown');
assert(mpModule.parseMarkdown, '小程序模块应导出 parseMarkdown');
console.log('✓ 小程序模块导出验证通过');

console.log('\n--- [3] 验证导出的 A2UIEngine 可实例化并正常推导渲染树 ---');
const engine = new rootModule.A2UIEngine();
engine.process([
  {
    version: 'v1.0',
    createSurface: {
      surfaceId: 'test_surface',
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'test_surface',
      components: [
        {
          id: 'root',
          component: 'Card',
          children: ['btn'],
        },
        {
          id: 'btn',
          component: 'Button',
          text: 'Module Export Test',
        },
      ],
    },
  },
]);

const tree = engine.getRenderTree('test_surface');
assert(tree, '应成功生成渲染树');
assert.strictEqual(tree.component, 'Card');
assert.strictEqual(tree.children[0].component, 'Button');
assert.strictEqual(tree.children[0].text, 'Module Export Test');
console.log('✓ 导出的 A2UIEngine 渲染树验证通过: Card -> Button');

console.log('\n🎉 a2ui-miniprogram 微信小程序模块导出健全性测试 100% 通过！\n');
