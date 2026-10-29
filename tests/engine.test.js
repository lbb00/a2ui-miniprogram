const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { getValueByPath, resolveValue, resolveDeep } = require('../miniprogram/core/data-model');

console.log('--- [1] 测试 A2UI 最新数据模型与表达式 ---');

const model = {
  user: {
    name: 'Alice',
    score: 98,
  },
  flight: {
    number: 'CA1501',
    departure: '2026-10-28T09:30:00Z',
  },
  cart: {
    total: 1299.5,
  },
};

// 1. JSON Pointer 测试
assert.strictEqual(getValueByPath(model, '/user/name'), 'Alice');
assert.strictEqual(getValueByPath(model, '/flight/number'), 'CA1501');

// 2. formatDate 测试
const formattedDate = resolveValue(
  {
    '@call': 'formatDate',
    args: { value: { '@path': '/flight/departure' } },
  },
  model
);
assert.strictEqual(formattedDate, '2026-10-28');
console.log('✓ formatDate 求解成功:', formattedDate);

// 3. formatCurrency 测试
const formattedPrice = resolveValue(
  {
    '@call': 'formatCurrency',
    args: { value: { '@path': '/cart/total' }, currency: 'CNY' },
  },
  model
);
assert.strictEqual(formattedPrice, '¥1299.50');
console.log('✓ formatCurrency 求解成功:', formattedPrice);

// 4. resolveDeep 递归解析 Action Context
const rawContext = {
  currentUser: { '@path': '/user/name' },
  orderFlight: { '@path': '/flight/number' },
  staticId: 'xyz_123',
};
const resolvedContext = resolveDeep(rawContext, model);
assert.deepStrictEqual(resolvedContext, {
  currentUser: 'Alice',
  orderFlight: 'CA1501',
  staticId: 'xyz_123',
});
console.log('✓ resolveDeep 深度上下文解析成功:', resolvedContext);

console.log('\n--- [2] 测试 A2UI Engine 与 双向绑定 ---');
const engine = new A2UIEngine();

// 5. 载入官方 00_simple-login-form
engine.process([
  {
    version: 'v1.0',
    createSurface: {
      surfaceId: 'surf_login',
      catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      sendDataModel: true,
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'surf_login',
      components: [
        { id: 'root', component: 'Column', children: ['input_user', 'btn_login'] },
        {
          id: 'input_user',
          component: 'TextField',
          label: '用户名',
          value: { '@path': '/username' },
        },
        {
          id: 'btn_login',
          component: 'Button',
          text: '登录',
          action: {
            event: {
              name: 'doLogin',
              context: {
                username: { '@path': '/username' },
              },
            },
          },
        },
      ],
    },
  },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: 'surf_login',
      value: { username: 'test_user_001' },
    },
  },
]);

let tree = engine.getRenderTree('surf_login');
assert.strictEqual(tree.children[0].value, 'test_user_001');
assert.strictEqual(tree.children[0].valuePath, '/username');
console.log('✓ 初始数据模型注入与路径记录通过');

// 6. 模拟客户端输入反写
engine.handleInputChange('surf_login', '/username', 'new_agent_admin');
tree = engine.getRenderTree('surf_login');
assert.strictEqual(tree.children[0].value, 'new_agent_admin');
console.log('✓ 客户端输入反写 DataModel 并在渲染树中即时生效');

// 7. 模拟点击事件上报，校验 context 中的动态取值
const eventMsg = engine.createEventMessage('surf_login', 'doLogin', {
  user: { '@path': '/username' },
});
assert.strictEqual(eventMsg.event.context.user, 'new_agent_admin');
console.log('✓ 客户端事件上报封装与动态 Context 映射测试通过:', eventMsg.event);

console.log('\n🎉 所有核心测试用例验证通过！');
