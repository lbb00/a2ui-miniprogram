/**
 * Claude Code Review 回归测试套件 (CR-C1 ~ CR-L6)
 * 验证对 Claude 指出的全部安全漏洞、规范差异及边界异常的加固成果
 */

const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { getValueByPath, resolveValue, resolveDeep, evaluateFunction } = require('../miniprogram/core/data-model');
const { parsePointer, toPointer, getIn, setIn, resolveSegs } = require('../miniprogram/core/pointer');

console.log('================================================================');
console.log('🛡️  开始执行 Claude Code Review 专项加固回归测试套件');
console.log('================================================================\n');

// 1. [CR-C3] 原型链污染防御
console.log('👉 [1/8] 验证 JSON Pointer 原型链污染防御 (CR-C3)');
{
  assert.throws(() => setIn({}, parsePointer('/__proto__/polluted'), 'yes'));
  assert.strictEqual(({}).polluted, undefined, 'Object.prototype 绝不能被污染');

  assert.throws(() => setIn({}, parsePointer('/constructor/prototype/p2'), 1));
  assert.strictEqual(({}).p2, undefined, 'constructor.prototype 绝不能被污染');

  assert.strictEqual(getValueByPath({}, '/constructor'), undefined, '不能读取 constructor 属性');
  assert.strictEqual(getValueByPath({}, '/__proto__'), undefined, '不能读取 __proto__ 属性');
  console.log('   ✓ CR-C3 原型链安全攻防校验 100% 通过');
}

// 2. [CR-C2] and/or 规范参数与嵌套函数求值
console.log('👉 [2/8] 验证 and/or/not 逻辑函数与 ValidationResult (CR-C2)');
{
  assert.strictEqual(evaluateFunction('and', { values: [false, false] }), false);
  assert.strictEqual(evaluateFunction('and', { values: [true, false] }), false);
  assert.strictEqual(evaluateFunction('and', { values: [true, true] }), true);

  assert.strictEqual(evaluateFunction('or', { values: [false] }), false);
  assert.strictEqual(evaluateFunction('or', { values: [false, true] }), true);

  assert.strictEqual(evaluateFunction('not', { value: true }), false);
  assert.strictEqual(evaluateFunction('not', { value: false }), true);

  // 嵌套 ValidationResult
  const failedRequired = { '@call': 'required', args: { value: '' } };
  assert.strictEqual(evaluateFunction('and', { values: [failedRequired, true] }), false);

  const passedRequired = { '@call': 'required', args: { value: 'ok' } };
  assert.strictEqual(evaluateFunction('and', { values: [passedRequired, true] }), true);
  console.log('   ✓ CR-C2 and/or/not 逻辑运算与嵌套函数求值校验通过');
}

// 3. [CR-C4] 模板自引用防爆与 DAG 共享节点 (CR-C4 / CR-E10)
console.log('👉 [3/8] 验证模板自引用环路拦截与 DAG 共享节点 (CR-C4 / CR-E10)');
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
  }, '自引用模板绝对不可导致栈溢出崩溃');
  assert(tree, '应正常生成受保护的渲染树');

  // DAG 共享节点
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
  console.log('   ✓ CR-C4 自引用安全防御与 DAG 共享树组装通过');
}

// 4. [CR-C1] A2UI v1.0 标准 Action 消息上报
console.log('👉 [4/8] 验证标准 A2UI v1.0 Action 消息格式与作用域求值 (CR-C1)');
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
  console.log('   ✓ CR-C1 Action 消息标准格式与完整动态求值通过');
}

// 5. [CR-H1] 双向绑定相对路径寻址与即时生效
console.log('👉 [5/8] 验证双向绑定相对路径绝对化与即时生效 (CR-H1)');
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

  // 客户端修改 Task 2
  engine.handleInputChange(S, tree.children[1].valuePath, 'Task 2 Modified');
  assert.strictEqual(engine.surfaces.get(S).dataModel.todos[1].text, 'Task 2 Modified');

  const updatedTree = engine.getRenderTree(S);
  assert.strictEqual(updatedTree.children[1].value, 'Task 2 Modified');
  console.log('   ✓ CR-H1 相对路径精准反写与双向绑定渲染联动通过');
}

// 6. [CR-H2] 安全单遍模板插值与防注入
console.log('👉 [6/8] 验证安全单遍模板插值与防二次执行 (CR-H2)');
{
  const model = {
    user: { name: '${/secret}' },
    secret: 'LEAKED_SECRET',
    rawNum: -42,
    empty: null,
    meta: { a: 1 },
  };

  // 防二次执行注入
  const injected = resolveValue('Hello ${/user/name}', model);
  assert.strictEqual(injected, 'Hello ${/secret}', '数据中的表达式绝不可二次执行');

  // 转义 \${
  const escaped = resolveValue('Cost is \\${/rawNum}', model);
  assert.strictEqual(escaped, 'Cost is ${/rawNum}');

  // null 序列化为空字符串
  const nullStr = resolveValue('Val: [${/empty}]', model);
  assert.strictEqual(nullStr, 'Val: []');

  // 对象序列化为 JSON
  const objStr = resolveValue('Meta: ${/meta}', model);
  assert.strictEqual(objStr, 'Meta: {"a":1}');
  console.log('   ✓ CR-H2 安全单遍插值与防数据注入通过');
}

// 7. [CR-H3] updateDataModel RFC 6901 替换与删除语义
console.log('👉 [7/8] 验证 updateDataModel 根替换、删除与数组追加 (CR-H3)');
{
  const S = 'rfc_surf';
  const engine = new A2UIEngine();
  engine.process({ createSurface: { surfaceId: S } });

  // 根路径替换
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/', value: { a: 10 } } });
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/', value: { b: 20 } } });
  assert.deepStrictEqual(engine.surfaces.get(S).dataModel, { b: 20 });

  // null 删除字段
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/b', value: null } });
  assert.strictEqual(engine.surfaces.get(S).dataModel.b, undefined);

  // 数组 '-' 追加
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/tags', value: ['tech'] } });
  engine.processMessage({ updateDataModel: { surfaceId: S, path: '/tags/-', value: 'a2ui' } });
  assert.deepStrictEqual(engine.surfaces.get(S).dataModel.tags, ['tech', 'a2ui']);
  console.log('   ✓ CR-H3 RFC 6901 数据模型更新语义通过');
}

// 8. [CR-M1 / CR-M3] 内置函数库完整性与校验失败禁用按钮
console.log('👉 [8/8] 验证内置函数库完整性与 Check 失败禁用按钮 (CR-M1 / CR-M3)');
{
  // formatDate TR35
  const dStr = evaluateFunction('formatDate', { value: 0, format: 'yyyy' });
  assert.strictEqual(dStr, '1970');

  // pluralize zero
  assert.strictEqual(evaluateFunction('pluralize', { value: 0, zero: 'none', other: 'items' }), 'none');

  // formatNumber decimals
  assert.strictEqual(evaluateFunction('formatNumber', { value: 1234.5678, decimals: 2 }), '1,234.57');

  // Check 失败禁用按钮
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
  assert.strictEqual(tree.disabled, true, '校验失败时按钮必须自动 disabled');

  // 输入合法 email
  engine.handleInputChange(S, '/email', 'admin@example.com');
  const validTree = engine.getRenderTree(S);
  assert.strictEqual(validTree.disabled, undefined, '校验通过时按钮解除 disabled');
  console.log('   ✓ CR-M1 / CR-M3 内置函数与 Check 按钮联动验证通过');
}

// 9. [CR-N1] formatString 二次执行与数据注入拦截
console.log('👉 [9/12] 验证 formatString 彻底消除二次求值与输入注入 (CR-N1)');
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
  assert.strictEqual(updatedTree.children[1].text, '${/secret}', 'formatString 绝不可二次执行数据中的表达式');
  console.log('   ✓ CR-N1 formatString 防注入验证通过');
}

// 10. [CR-N3] DAG 指数级膨胀防御
console.log('👉 [10/12] 验证 DAG 拓扑多级引用节点防爆上限 (CR-N3)');
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

  assert(totalNodes <= 5000, `总节点数应受 MAX_TOTAL_NODES 限制，实际: ${totalNodes}`);
  console.log(`   ✓ CR-N3 DAG 指数膨胀防护验证通过，总节点被安全限制在: ${totalNodes}`);
}

// 11. [CR-N4] 实例 ID 抗路径碰撞
console.log('👉 [11/12] 验证不同列表路径下按钮实例 ID 与上下文隔离 (CR-N4)');
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

  assert.notStrictEqual(btn1.id, btn2.id, '不同路径的实例 ID 必须完全独立');

  const action1 = engine.createActionMessage(S, btn1.id);
  const action2 = engine.createActionMessage(S, btn2.id);

  assert.strictEqual(action1.action.context.n, 'X', '点击第一个按钮上下文必须为 X');
  assert.strictEqual(action2.action.context.n, 'Y', '点击第二个按钮上下文必须为 Y');
  console.log('   ✓ CR-N4 路径抗碰撞与准确动作映射通过');
}

// 12. [CR-N2 & CR-N5] 递归数据结构与原始值列表
console.log('👉 [12/12] 验证递归评论树与原始值列表 @path "" (CR-N2 / CR-N5)');
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
  assert.strictEqual(replies.children.length, 1, '递归子评论必须成功渲染');
  assert.strictEqual(replies.children[0].children[0].text, 'Nested reply');

  const tagsRow = tr.children[1];
  assert.deepStrictEqual(
    tagsRow.children.map((c) => c.text),
    ['alpha', 'beta'],
    '原始值列表 @path "" 必须求值为当前元素自身'
  );
  console.log('   ✓ CR-N2 / CR-N5 递归评论树渲染与原始值列表求值通过');
}

console.log('\n================================================================');
console.log('🎉 全部 12 项 Claude CR 专项加固单测 100% PASS！');
console.log('================================================================\n');
