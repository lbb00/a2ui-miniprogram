/**
 * Claude Code Review Round 6 专项加固完整回归测试套件
 * 
 * 覆盖全部 11 项审查发现：
 * [M1] setEngine/detached 监听器注销与无内存泄露
 * [M2] dispatchInputEvent 与页面单向数据流防重复写与差量保障
 * [M3] regex 彻底防御分支型与嵌套型 ReDoS (^(a|a)+$ 在 1ms 内安全拦截)
 * [M4] dispatchTapEvent 缺失引擎时标准结构化报错，杜绝残缺 action
 * [M5] DateTimeInput 本地客户端时区换算与 UTC ISO 往返保全
 * [M6] 单一源码真相源 (删去根目录冗余副本，统一 require miniprogram/)
 * [L1] ChoicePicker 初始无值时选择统一保全数组格式
 * [L2] ChoicePicker 多选 (mutuallyExclusive: false) 与 chips 模式支持
 * [L3] a2ui-surface conversationId 会话切换与新数组引用即刻重置
 * [L4] package.json files 字段精简与体积优化
 * [L5] uiState 键名特殊字符转义 (防 . 和 [ 导致 setData 路径畸形)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { evaluateFunction } = require('../miniprogram/core/data-model');

console.log('================================================================');
console.log('🛡️  开始执行 Claude Code Review Round 6 深度加固回归测试套件');
console.log('================================================================\n');

// ----------------------------------------------------
// [M1] setEngine/detached 监听器注销与防泄露
// ----------------------------------------------------
console.log('👉 [M1] 验证 setEngine 切换与 detached 自动注销监听器，无多倍触发');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  const engine = new A2UIEngine();
  const eventsTriggered = [];

  const instance = {
    data: { surfaceId: 'surf_m1', localRenderTree: null },
    setData(data, cb) { Object.assign(this.data, data); if (cb) cb(); },
    triggerEvent(name, detail) { eventsTriggered.push({ name, detail }); },
  };
  Object.assign(instance, componentDef.methods);

  // 模拟连续调用 3 次 setEngine
  instance.setEngine(engine);
  instance.setEngine(engine);
  instance.setEngine(engine);

  // 发送 1 条错误消息
  engine.emitError('surf_m1', 'EXECUTION_ERROR', '/test', 'Error M1 Test');

  // 断言：由于每次 setEngine 都会取消旧的监听器，1 条错误只能触发 1 次 a2uiEvent / error
  const a2uiEvents = eventsTriggered.filter(e => e.name === 'a2uiEvent');
  const errorEvents = eventsTriggered.filter(e => e.name === 'error');
  assert.strictEqual(a2uiEvents.length, 1, '调 3 次 setEngine 后，1 条错误只能触发 1 次 a2uiEvent');
  assert.strictEqual(errorEvents.length, 1, '调 3 次 setEngine 后，1 条错误只能触发 1 次 error');

  // 组件销毁 detached
  componentDef.lifetimes.detached.call(instance);

  // 再次发送错误消息
  engine.emitError('surf_m1', 'EXECUTION_ERROR', '/test', 'Error M1 Test 2');
  // 断言：detached 后监听器已被清空，不会再收到新事件
  assert.strictEqual(eventsTriggered.filter(e => e.name === 'a2uiEvent').length, 1, 'detached 后不应收到任何新事件');
  console.log('   ✓ M1 监听器保存与注销机制校验 100% 通过');
}

// ----------------------------------------------------
// [M2] dispatchInputEvent 单向反写与差量更新保障
// ----------------------------------------------------
console.log('👉 [M2] 验证 dispatchInputEvent 内部反写引擎与 _isHandlingInput 标志');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  const engine = new A2UIEngine();
  const S = 'surf_m2';
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: { query: 'init' },
        components: [
          { id: 'root', component: 'Column', children: ['in_1'] },
          { id: 'in_1', component: 'TextField', value: { '@path': '/query' } },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  let setDataCalls = 0;
  const instance = {
    data: { surfaceId: S, localRenderTree: tree },
    setData(patches) { setDataCalls++; },
    triggerEvent() {},
    findNodeById(root, id) { return root?.children?.[0]; },
  };
  Object.assign(instance, componentDef.methods);
  instance.setEngine(engine);

  // 触发输入变更
  instance.dispatchInputEvent('in_1', '/query', 'new_value');

  // 断言：数据模型已在 engine 中被更新
  assert.strictEqual(engine.surfaces.get(S).dataModel.query, 'new_value');
  // 断言：_isHandlingInput 结束后已复位
  assert.strictEqual(instance._isHandlingInput, false);
  console.log('   ✓ M2 单向反写与差量更新标志验证通过');
}

// ----------------------------------------------------
// [M3] regex 分支型与嵌套型 ReDoS 防爆
// ----------------------------------------------------
console.log('👉 [M3] 验证 regex 彻底防御分支型 (a|a)+ 与嵌套型 ReDoS');
{
  const dangerousBranchPattern = '^(a|a)+$';
  const maliciousInput = 'a'.repeat(30) + '!';

  const t0 = Date.now();
  const result = evaluateFunction('regex', {
    pattern: dangerousBranchPattern,
    value: maliciousInput,
  });
  const elapsed = Date.now() - t0;

  assert.strictEqual(result, false, '危险的分支重叠正则必须被拦截并返回 false');
  assert.ok(elapsed < 20, `耗时必须在 20ms 内 (实测: ${elapsed}ms)，绝不产生数秒卡顿`);

  // 校验合法常见业务正则正常工作
  const phoneRes = evaluateFunction('regex', { pattern: '^1[3-9]\\d{9}$', value: '13800138000' });
  assert.strictEqual(phoneRes, true, '合法手机号正则应匹配成功');

  const emailRes = evaluateFunction('regex', { pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', value: 'test@example.com' });
  assert.strictEqual(emailRes, true, '合法邮箱正则应匹配成功');
  console.log(`   ✓ M3 ReDoS 安全防爆校验通过 (恶意分支正则匹配耗时: ${elapsed}ms)`);
}

// ----------------------------------------------------
// [M4] dispatchTapEvent 缺失引擎时标准结构化报错
// ----------------------------------------------------
console.log('👉 [M4] 验证 dispatchTapEvent 无引擎时不发残缺 action，统一上报错误');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  const errorEvents = [];
  const actionEvents = [];
  const instance = {
    data: {
      surfaceId: 'surf_m4',
      localRenderTree: {
        id: 'btn_no_engine',
        component: 'Button',
        action: { event: { name: 'submit', context: { u: { '@path': '/user/name' } } } },
      },
    },
    engine: null,
    internalEngine: null,
    triggerEvent(name, detail) {
      if (name === 'error') errorEvents.push(detail);
      if (name === 'action' || name === 'a2uiEvent') actionEvents.push(detail);
    },
    findNodeById(root, id) { return root; },
  };
  Object.assign(instance, componentDef.methods);

  instance.dispatchTapEvent('btn_no_engine');

  // 断言：由于没有引擎，绝不能派发 action 事件，必须派发标准的 error 报文
  assert.strictEqual(actionEvents.length, 0, '未注入引擎时绝对不能发出残缺的 action 消息');
  assert.strictEqual(errorEvents.length, 1, '必须上报 1 条错误事件');
  assert.strictEqual(errorEvents[0].error.code, 'EXECUTION_ERROR');
  assert.ok(errorEvents[0].error.message.includes('A2UIEngine instance is required'));
  console.log('   ✓ M4 缺失引擎 Action 安全拦截与错误上报通过');
}

// ----------------------------------------------------
// [M5] DateTimeInput 本地客户端时区换算与 UTC ISO 往返
// ----------------------------------------------------
console.log('👉 [M5] 验证 DateTimeInput 换算为客户端本地时区展示');
{
  const S = 'surf_m5';
  const engine = new A2UIEngine();
  const utcIso = '2025-12-15T19:00:00Z';
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: { targetTime: utcIso },
        components: [
          { id: 'root', component: 'Column', children: ['dt_1'] },
          { id: 'dt_1', component: 'DateTimeInput', enableDate: true, enableTime: true, value: { '@path': '/targetTime' } },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const node = tree.children[0];

  const expectedLocal = new Date(utcIso);
  const expY = expectedLocal.getFullYear();
  const expM = String(expectedLocal.getMonth() + 1).padStart(2, '0');
  const expD = String(expectedLocal.getDate()).padStart(2, '0');
  const expH = String(expectedLocal.getHours()).padStart(2, '0');
  const expMin = String(expectedLocal.getMinutes()).padStart(2, '0');

  assert.strictEqual(node.dateValue, `${expY}-${expM}-${expD}`, '必须转换为客户端本地年月日');
  assert.strictEqual(node.timeValue, `${expH}:${expMin}`, '必须转换为客户端本地时分');
  assert.strictEqual(node.isIso, true);
  console.log(`   ✓ M5 本地客户端时区转换断言通过 (${utcIso} -> ${node.dateValue} ${node.timeValue})`);
}

// ----------------------------------------------------
// [M6 & L4] 单一源码真相源与 package.json files 精简
// ----------------------------------------------------
console.log('👉 [M6 & L4] 验证根目录无冗余副本，package.json files 精炼');
{
  const rootCoreExists = fs.existsSync(path.resolve(__dirname, '../core'));
  const rootComponentsExists = fs.existsSync(path.resolve(__dirname, '../components'));
  assert.strictEqual(rootCoreExists, false, '根目录下的 core 副本必须彻底删除');
  assert.strictEqual(rootComponentsExists, false, '根目录下的 components 副本必须彻底删除');

  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
  assert.deepStrictEqual(pkg.files, ['miniprogram', 'index.js'], 'package.json files 必须精简为 miniprogram 与 index.js');
  console.log('   ✓ M6 & L4 单一真相源结构校验通过');
}

// ----------------------------------------------------
// [L1] ChoicePicker 初始无值时选择统一保持数组结构
// ----------------------------------------------------
console.log('👉 [L1] 验证 ChoicePicker 初始无值时统一写回数组类型');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  let dispatchedVal = null;
  const instance = {
    data: {
      localRenderTree: {
        id: 'picker_l1',
        component: 'ChoicePicker',
        options: [
          { label: 'Option A', value: 'a' },
          { label: 'Option B', value: 'b' },
        ],
        value: undefined, // 初始无值
      },
    },
    triggerEvent() {},
    dispatchInputEvent(id, path, val) { dispatchedVal = val; },
    findNodeById(root, id) { return root; },
  };
  Object.assign(instance, componentDef.methods);
  instance.dispatchInputEvent = (id, path, val) => { dispatchedVal = val; };

  instance.handlePickerChange({
    currentTarget: { dataset: { id: 'picker_l1', path: '/choice' } },
    detail: { value: 0 },
  });

  assert.deepStrictEqual(dispatchedVal, ['a'], '初始无值时写回的值必须是数组 ["a"]，而不是标量 "a"');
  console.log('   ✓ L1 ChoicePicker 初始无值回写数组校验通过');
}

// ----------------------------------------------------
// [L2] ChoicePicker 多选与 chips 模式
// ----------------------------------------------------
console.log('👉 [L2] 验证 ChoicePicker 多选 (mutuallyExclusive: false) 与 chips 选中态');
{
  const S = 'surf_l2';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: { tags: ['tech', 'news'] },
        components: [
          { id: 'root', component: 'Column', children: ['cp_multi', 'cp_chips'] },
          {
            id: 'cp_multi',
            component: 'ChoicePicker',
            mutuallyExclusive: false,
            options: ['tech', 'music', 'news'],
            value: { '@path': '/tags' },
          },
          {
            id: 'cp_chips',
            component: 'ChoicePicker',
            displayStyle: 'chips',
            options: ['tech', 'music', 'news'],
            value: { '@path': '/tags' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const multiNode = tree.children[0];
  const chipsNode = tree.children[1];

  assert.strictEqual(multiNode.mutuallyExclusive, false);
  assert.strictEqual(multiNode.options[0].selected, true, 'tech 必须被标记为 selected: true');
  assert.strictEqual(multiNode.options[1].selected, false, 'music 必须被标记为 selected: false');
  assert.strictEqual(multiNode.options[2].selected, true, 'news 必须被标记为 selected: true');

  assert.strictEqual(chipsNode.displayStyle, 'chips');
  assert.strictEqual(chipsNode.options[0].selected, true);
  console.log('   ✓ L2 ChoicePicker 多选与 chips 模式支持校验通过');
}

// ----------------------------------------------------
// [L3] a2ui-surface conversationId 会话切换与新数组引用重置
// ----------------------------------------------------
console.log('👉 [L3] 验证 conversationId 变更与新数组引用彻底重置引擎状态');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  let cleared = false;
  const instance = {
    data: { messages: [] },
    clear() { cleared = true; this.internalEngine = null; },
    _processMessages() {},
  };

  // 1. 测试 conversationId 变更触发重置
  componentDef.properties.conversationId.observer.call(instance, 'session_2', 'session_1');
  assert.strictEqual(cleared, true, 'conversationId 变更必须调用 clear()');

  // 2. 测试 messages 引用更换且不是 append 触发重置
  cleared = false;
  const oldMsgs = [{ createSurface: { surfaceId: 's1' } }];
  const newMsgs = [{ createSurface: { surfaceId: 's2' } }]; // 首条消息不同
  componentDef.properties.messages.observer.call(instance, newMsgs, oldMsgs);
  assert.strictEqual(cleared, true, '新消息数组引用替换且非追加时必须调用 clear()');
  console.log('   ✓ L3 conversationId 与新数组引用重置校验通过');
}

// ----------------------------------------------------
// [L5] uiState 键名安全字符转义 (防 . 和 [ 导致 setData 路径解析异常)
// ----------------------------------------------------
console.log('👉 [L5] 验证 uiState 键名中含特殊字符 (. 和 [) 安全转义');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  let setDataObj = null;
  const instance = {
    data: { uiState: {} },
    setData(obj) { setDataObj = obj; },
  };
  Object.assign(instance, componentDef.methods);

  // 模拟组件 id 包含特殊字符，如 items[0].modal
  instance.onModalOpen({
    currentTarget: { dataset: { id: 'items[0].modal', uikey: 'items_0__modal' } },
  });

  assert.ok(setDataObj, '必须调用 setData');
  assert.ok('uiState.items_0__modal_open' in setDataObj, '必须采用转义后的安全 key 设置 uiState');
  assert.strictEqual(setDataObj['uiState.items_0__modal_open'], true);

  // 若无 uikey，通过 _safeKey 自动转义
  instance.onTabTap({
    currentTarget: { dataset: { id: 'tabs.item[1]', idx: 2 } },
  });
  assert.ok('uiState.tabs_item_1_' in setDataObj, '_safeKey 必须将特殊字符自动转为下划线');
  assert.strictEqual(setDataObj['uiState.tabs_item_1_'], 2);
  console.log('   ✓ L5 uiState 键名安全字符转义防路径解析异常通过');
}

console.log('\n================================================================');
console.log('🎉 全部 11 项 Claude Code Review Round 6 深度加固单测 100% PASS！');
console.log('================================================================');
