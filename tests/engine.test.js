const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { getValueByPath, resolveValue, resolveDeep } = require('../miniprogram/core/data-model');

console.log('--- [1] Test A2UI Data Model and Expression Resolution ---');

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

// 1. JSON Pointer tests
assert.strictEqual(getValueByPath(model, '/user/name'), 'Alice');
assert.strictEqual(getValueByPath(model, '/flight/number'), 'CA1501');

// 2. formatDate tests
const formattedDate = resolveValue(
  {
    '@call': 'formatDate',
    args: { value: { '@path': '/flight/departure' } },
  },
  model
);
assert.strictEqual(formattedDate, '2026-10-28');
console.log('✓ formatDate resolved successfully:', formattedDate);

// 3. formatCurrency tests
const formattedPrice = resolveValue(
  {
    '@call': 'formatCurrency',
    args: { value: { '@path': '/cart/total' }, currency: 'CNY' },
  },
  model
);
assert.strictEqual(formattedPrice, '¥1299.50');
console.log('✓ formatCurrency resolved successfully:', formattedPrice);

// 4. resolveDeep recursive context resolution
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
console.log('✓ resolveDeep context resolution verified:', resolvedContext);

console.log('\n--- [2] Test A2UI Engine & Two-Way Data Binding ---');
const engine = new A2UIEngine();

// 5. Load 00_simple-login-form structure
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
          label: 'Username',
          value: { '@path': '/username' },
        },
        {
          id: 'btn_login',
          component: 'Button',
          text: 'Login',
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
console.log('✓ Initial dataModel injection and valuePath resolution verified');

// 6. Simulate client input mutation
engine.handleInputChange('surf_login', '/username', 'new_agent_admin');
tree = engine.getRenderTree('surf_login');
assert.strictEqual(tree.children[0].value, 'new_agent_admin');
console.log('✓ Client input update reflected in dataModel and render tree');

// 7. Simulate click event reporting with dynamic context mapping
const eventMsg = engine.createEventMessage('surf_login', 'doLogin', {
  user: { '@path': '/username' },
});
assert.strictEqual(eventMsg.event.context.user, 'new_agent_admin');
console.log('✓ Event dispatch encapsulation & dynamic context verified:', eventMsg.event);

console.log('\n🎉 All core engine tests passed successfully!');
