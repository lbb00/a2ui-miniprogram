/**
 * Claude Code Review Regression Test Suite (CR-C1 ~ CR-L6)
 * Verifies security defenses, specification alignment, and boundary handling.
 */

const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { getValueByPath, resolveValue, resolveDeep, evaluateFunction } = require('../miniprogram/core/data-model');
const { parsePointer, toPointer, getIn, setIn, resolveSegs } = require('../miniprogram/core/pointer');

console.log('================================================================');
console.log('🛡️  Running Claude Code Review Hardening Regression Suite');
console.log('================================================================\n');

// 1. [CR-C3] Prototype pollution defense
console.log('👉 [1/8] Verify JSON Pointer prototype pollution defense (CR-C3)');
{
  assert.throws(() => setIn({}, parsePointer('/__proto__/polluted'), 'yes'));
  assert.strictEqual(({}).polluted, undefined, 'Object.prototype must not be polluted');

  assert.throws(() => setIn({}, parsePointer('/constructor/prototype/p2'), 1));
  assert.strictEqual(({}).p2, undefined, 'constructor.prototype must not be polluted');

  assert.strictEqual(getValueByPath({}, '/constructor'), undefined, 'Cannot read constructor property');
  assert.strictEqual(getValueByPath({}, '/__proto__'), undefined, 'Cannot read __proto__ property');
  console.log('   ✓ CR-C3 prototype pollution defense verified 100%');
}

// 2. [CR-C2] and/or spec arguments and nested function evaluation
console.log('👉 [2/8] Verify and/or/not logical functions and ValidationResult (CR-C2)');
{
  assert.strictEqual(evaluateFunction('and', { values: [false, false] }), false);
  assert.strictEqual(evaluateFunction('and', { values: [true, false] }), false);
  assert.strictEqual(evaluateFunction('and', { values: [true, true] }), true);

  assert.strictEqual(evaluateFunction('or', { values: [false] }), false);
  assert.strictEqual(evaluateFunction('or', { values: [false, true] }), true);

  assert.strictEqual(evaluateFunction('not', { value: true }), false);
  assert.strictEqual(evaluateFunction('not', { value: false }), true);

  // Nested ValidationResult
  const failedRequired = { '@call': 'required', args: { value: '' } };
  assert.strictEqual(evaluateFunction('and', { values: [failedRequired, true] }), false);

  const passedRequired = { '@call': 'required', args: { value: 'ok' } };
  assert.strictEqual(evaluateFunction('and', { values: [passedRequired, true] }), true);
  console.log('   ✓ CR-C2 and/or/not logic and nested function evaluation verified');
}

// 3. [CR-C4] Template self-reference recursion guard & DAG shared nodes (CR-C4 / CR-E10)
console.log('👉 [3/8] Verify template cycle defense and DAG shared nodes (CR-C4 / CR-E10)');
{
  const S = 'cycle_surf';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: { items: [{ name: 'a' }] },
        components: [
          { id: 'root', component: 'List', children: { path: '/items', componentId: 'node' } },
          { id: 'node', component: 'Column', children: { path: '/items', componentId: 'node' } },
        ],
      },
    },
  ]);

  let tree = null;
  assert.doesNotThrow(() => {
    tree = engine.getRenderTree(S);
  }, 'Self-referencing templates must not cause stack overflow');
  assert(tree, 'Protected render tree should be generated');

  // DAG shared nodes
  const dagEngine = new A2UIEngine();
  dagEngine.process({
    createSurface: {
      surfaceId: S,
      components: [
        { id: 'root', component: 'Column', children: ['a', 'b'] },
        { id: 'a', component: 'Card', child: 'shared' },
        { id: 'b', component: 'Card', child: 'shared' },
        { id: 'shared', component: 'Text', text: 'SHARED' },
      ],
    },
  });
  const dagTree = dagEngine.getRenderTree(S);
  assert.strictEqual(dagTree.children[0].children[0].text, 'SHARED');
  assert.strictEqual(dagTree.children[1].children[0].text, 'SHARED');
  console.log('   ✓ CR-C4 self-reference defense & DAG shared node assembly verified');
}

// 4. [CR-C1] Standard A2UI v1.0 Action message reporting
console.log('👉 [4/8] Verify standard A2UI v1.0 Action message format and scope evaluation (CR-C1)');
{
  const S = 'action_surf';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          groups: [{ title: 'Group A', items: [{ id: 101, name: 'Apple' }] }],
          appToken: 'TOKEN_XYZ',
        },
        components: [
          { id: 'root', component: 'List', children: { path: '/groups/0/items', componentId: 'btn' } },
          {
            id: 'btn',
            component: 'Button',
            action: {
              event: {
                name: 'buyProduct',
                context: {
                  productName: { '@path': 'name' },
                  productId: { '@path': 'id' },
                  token: { '@path': '/appToken' },
                  itemIndex: { '@call': '@index' },
                },
                userMessage: 'Buy ${name}',
              },
            },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const btnNode = tree.children[0];
  const actionMsg = engine.createActionMessage(S, btnNode.id);

  assert.strictEqual(actionMsg.version, 'v1.0');
  assert.strictEqual(actionMsg.action.name, 'buyProduct');
  assert.strictEqual(actionMsg.action.sourceComponentId, 'btn');
  assert.strictEqual(actionMsg.action.context.productName, 'Apple');
  assert.strictEqual(actionMsg.action.context.productId, 101);
  assert.strictEqual(actionMsg.action.context.token, 'TOKEN_XYZ');
  assert.strictEqual(actionMsg.action.context.itemIndex, 0);
  assert.strictEqual(actionMsg.action.userMessage, 'Buy Apple');
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(actionMsg.action.timestamp));
  console.log('   ✓ CR-C1 Action message format and dynamic evaluation verified');
}

// 5. [CR-H1] Two-way binding relative path resolution and reactivity
console.log('👉 [5/8] Verify two-way binding relative path resolution and reactivity (CR-H1)');
{
  const S = 'binding_surf';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          todos: [
            { text: 'Task 1', done: false },
            { text: 'Task 2', done: true },
          ],
        },
        components: [
          { id: 'root', component: 'List', children: { path: '/todos', componentId: 'item' } },
          { id: 'item', component: 'TextField', value: { '@path': 'text' } },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.strictEqual(tree.children[0].valuePath, '/todos/0/text');
  assert.strictEqual(tree.children[1].valuePath, '/todos/1/text');

  // Client modifies Task 2
  engine.handleInputChange(S, tree.children[1].valuePath, 'Task 2 Modified');
  assert.strictEqual(engine.surfaces.get(S).dataModel.todos[1].text, 'Task 2 Modified');

  const updatedTree = engine.getRenderTree(S);
  assert.strictEqual(updatedTree.children[1].value, 'Task 2 Modified');
  console.log('   ✓ CR-H1 relative path write-back and rendering reactivity verified');
}

// 6. [CR-H2] Single pass secure template interpolation & injection defense
console.log('👉 [6/8] Verify secure single-pass interpolation and injection prevention (CR-H2)');
{
  const model = {
    user: { name: '${/secret}' },
    secret: 'LEAKED_SECRET',
    rawNum: -42,
    empty: null,
    meta: { a: 1 },
  };

  // Prevent double evaluation
  const injected = resolveValue('Hello ${/user/name}', model);
  assert.strictEqual(injected, 'Hello ${/secret}', 'Expressions in data must not be evaluated twice');

  // Escape \${
  const escaped = resolveValue('Cost is \\${/rawNum}', model);
  assert.strictEqual(escaped, 'Cost is ${/rawNum}');

  // Null serializes to empty string
  const nullStr = resolveValue('Val: [${/empty}]', model);
  assert.strictEqual(nullStr, 'Val: []');

  // Object serializes to JSON
  const objStr = resolveValue('Meta: ${/meta}', model);
  assert.strictEqual(objStr, 'Meta: {"a":1}');
  console.log('   ✓ CR-H2 secure single-pass interpolation verified');
}

// 7. [CR-H3] updateDataModel RFC 6901 replace and delete semantics
console.log('👉 [7/8] Verify updateDataModel root replace, deletion & array append (CR-H3)');
{
  const S = 'rfc_surf';
  const engine = new A2UIEngine();
  engine.process({ createSurface: { surfaceId: S } });

  // Root path replace
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/', value: { a: 10 } } });
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/', value: { b: 20 } } });
  assert.deepStrictEqual(engine.surfaces.get(S).dataModel, { b: 20 });

  // Null deletes property
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/b', value: null } });
  assert.strictEqual(engine.surfaces.get(S).dataModel.b, undefined);

  // Array '-' append
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/tags', value: ['tech'] } });
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/tags/-', value: 'a2ui' } });
  assert.deepStrictEqual(engine.surfaces.get(S).dataModel.tags, ['tech', 'a2ui']);
  console.log('   ✓ CR-H3 RFC 6901 data model update semantics verified');
}

// 8. [CR-M1 / CR-M3] Built-in functions & check failure disables Button
console.log('👉 [8/8] Verify built-in function library and check failure Button disable (CR-M1 / CR-M3)');
{
  // formatDate TR35
  const dStr = evaluateFunction('formatDate', { value: 0, format: 'yyyy' });
  assert.strictEqual(dStr, '1970');

  // pluralize zero
  assert.strictEqual(evaluateFunction('pluralize', { value: 0, zero: 'none', other: 'items' }), 'none');

  // formatNumber decimals
  assert.strictEqual(evaluateFunction('formatNumber', { value: 1234.5678, decimals: 2 }), '1,234.57');

  // Check failure disables Button
  const S = 'check_surf';
  const engine = new A2UIEngine();
  engine.process({
    createSurface: {
      surfaceId: S,
      dataModel: { email: 'invalid_email' },
      components: [
        {
          id: 'root',
          component: 'Button',
          text: 'Submit',
          checks: [
            {
              condition: { '@call': 'email', args: { value: { '@path': '/email' } } },
              message: 'Invalid email',
            },
          ],
        },
      ],
    },
  });

  const tree = engine.getRenderTree(S);
  assert.strictEqual(tree.disabled, true, 'Button must be disabled when checks fail');

  // Provide valid email
  engine.handleInputChange(S, '/email', 'admin@example.com');
  const validTree = engine.getRenderTree(S);
  assert.strictEqual(validTree.disabled, undefined, 'Button must be enabled when checks pass');
  console.log('   ✓ CR-M1 / CR-M3 built-in functions & Button check linkage verified');
}

// 9. [CR-N1] formatString double evaluation & injection defense
console.log('👉 [9/12] Verify formatString eliminates double evaluation and data injection (CR-N1)');
{
  const S = 'n1_surf';
  const engine = new A2UIEngine();
  engine.process({
    createSurface: {
      surfaceId: S,
      dataModel: { secret: 'SECRET_TOKEN', q: '' },
      components: [
        { id: 'root', component: 'Column', children: ['tf', 't'] },
        { id: 'tf', component: 'TextField', value: { '@path': '/q' } },
        { id: 't', component: 'Text', text: { '@call': 'formatString', args: { value: { '@path': '/q' } } } },
      ],
    },
  });

  const tr = engine.getRenderTree(S);
  engine.handleInputChange(S, tr.children[0].valuePath, '${/secret}');
  const updatedTree = engine.getRenderTree(S);
  assert.strictEqual(updatedTree.children[1].text, '${/secret}', 'formatString must not evaluate expressions in data');
  console.log('   ✓ CR-N1 formatString injection defense verified');
}

// 10. [CR-N3] DAG exponential explosion guard
console.log('👉 [10/12] Verify DAG multi-level reference explosion limit (CR-N3)');
{
  const S = 'n3_surf';
  const L = 18;
  const comps = [{ id: 'root', component: 'Column', children: ['a0', 'a0'] }];
  for (let i = 0; i < L; i++) {
    comps.push({ id: 'a' + i, component: 'Column', children: i < L - 1 ? ['a' + (i + 1), 'a' + (i + 1)] : [] });
  }
  const engine = new A2UIEngine();
  engine.process({ createSurface: { surfaceId: S, components: comps } });

  const tr = engine.getRenderTree(S);
  let totalNodes = 0;
  (function count(x) {
    if (!x) return;
    totalNodes++;
    if (x.children) x.children.forEach(count);
  })(tr);

  assert(totalNodes <= 5000, `Total nodes should be limited by MAX_TOTAL_NODES, got: ${totalNodes}`);
  console.log(`   ✓ CR-N3 DAG exponential explosion guard verified, nodes capped at: ${totalNodes}`);
}

// 11. [CR-N4] Instance ID collision resistance
console.log('👉 [11/12] Verify instance ID and context isolation across different paths (CR-N4)');
{
  const S = 'n4_surf';
  const engine = new A2UIEngine();
  engine.process({
    createSurface: {
      surfaceId: S,
      dataModel: {
        a_b: [{ n: 'X' }],
        a: { b: [{ n: 'Y' }] },
      },
      components: [
        { id: 'root', component: 'Column', children: ['l1', 'l2'] },
        { id: 'l1', component: 'Column', children: { path: '/a_b', componentId: 'btn' } },
        { id: 'l2', component: 'Column', children: { path: '/a/b', componentId: 'btn' } },
        {
          id: 'btn',
          component: 'Button',
          text: { '@path': 'n' },
          action: { event: { name: 'pick', context: { n: { '@path': 'n' } } } },
        },
      ],
    },
  });

  const tr = engine.getRenderTree(S);
  const btn1 = tr.children[0].children[0];
  const btn2 = tr.children[1].children[0];

  assert.notStrictEqual(btn1.id, btn2.id, 'Instance IDs on different paths must be independent');

  const action1 = engine.createActionMessage(S, btn1.id);
  const action2 = engine.createActionMessage(S, btn2.id);

  assert.strictEqual(action1.action.context.n, 'X', 'First button context must be X');
  assert.strictEqual(action2.action.context.n, 'Y', 'Second button context must be Y');
  console.log('   ✓ CR-N4 path anti-collision & action mapping verified');
}

// 12. [CR-N2 & CR-N5] Recursive data structures and primitive list items
console.log('👉 [12/12] Verify recursive comment tree and primitive list items with @path "" (CR-N2 / CR-N5)');
{
  const S = 'n2_surf';
  const engine = new A2UIEngine();
  engine.process({
    createSurface: {
      surfaceId: S,
      dataModel: {
        comments: [
          {
            text: 'Top comment',
            replies: [{ text: 'Nested reply', replies: [] }],
          },
        ],
        tags: ['alpha', 'beta'],
      },
      components: [
        { id: 'root', component: 'Column', children: ['c_list', 'tag_list'] },
        { id: 'c_list', component: 'Column', children: { path: '/comments', componentId: 'cm' } },
        { id: 'cm', component: 'Column', children: ['c_text', 'c_replies'] },
        { id: 'c_text', component: 'Text', text: { '@path': 'text' } },
        { id: 'c_replies', component: 'Column', children: { path: 'replies', componentId: 'cm' } },
        { id: 'tag_list', component: 'Row', children: { path: '/tags', componentId: 'tag_item' } },
        { id: 'tag_item', component: 'Text', text: { '@path': '' } },
      ],
    },
  });

  const tr = engine.getRenderTree(S);
  const topComment = tr.children[0].children[0];
  assert.strictEqual(topComment.children[0].text, 'Top comment');
  const replies = topComment.children[1];
  assert.strictEqual(replies.children.length, 1, 'Recursive sub-comment must be rendered');
  assert.strictEqual(replies.children[0].children[0].text, 'Nested reply');

  const tagsRow = tr.children[1];
  assert.deepStrictEqual(
    tagsRow.children.map((c) => c.text),
    ['alpha', 'beta'],
    'Primitive list @path "" must resolve to item itself'
  );
  console.log('   ✓ CR-N2 / CR-N5 recursive comments & primitive list evaluation verified');
}

console.log('\n================================================================');
console.log('🎉 All 12 Claude CR hardening tests passed 100%!');
console.log('================================================================\n');
