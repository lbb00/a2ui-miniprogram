const assert = require('assert');

console.log('--- [1] Verify root index.js module exports ---');
const rootModule = require('../index');
assert(rootModule.A2UIEngine, 'Root module must export A2UIEngine');
assert(rootModule.resolveValue, 'Root module must export resolveValue');
assert(rootModule.resolveDeep, 'Root module must export resolveDeep');
assert(rootModule.getValueByPath, 'Root module must export getValueByPath');
assert(rootModule.hasMarkdown, 'Root module must export hasMarkdown');
assert(rootModule.parseMarkdown, 'Root module must export parseMarkdown');
console.log('✓ Root module exports verified');

console.log('\n--- [2] Verify miniprogram index.js module exports ---');
const mpModule = require('../miniprogram/index');
assert(mpModule.A2UIEngine, 'MiniProgram module must export A2UIEngine');
assert(mpModule.resolveValue, 'MiniProgram module must export resolveValue');
assert(mpModule.hasMarkdown, 'MiniProgram module must export hasMarkdown');
assert(mpModule.parseMarkdown, 'MiniProgram module must export parseMarkdown');
console.log('✓ MiniProgram module exports verified');

console.log('\n--- [3] Verify exported A2UIEngine instantiation & tree derivation ---');
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
assert(tree, 'Render tree should be generated');
assert.strictEqual(tree.component, 'Card');
assert.strictEqual(tree.children[0].component, 'Button');
assert.strictEqual(tree.children[0].text, 'Module Export Test');
console.log('✓ Exported A2UIEngine render tree verified: Card -> Button');

console.log('\n🎉 Module export sanity tests passed (100%)\n');
