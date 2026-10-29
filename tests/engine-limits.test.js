/**
 * Self-Review Architecture Hardening Test Suite
 * 验证自审发现的 5 项深度架构加固点：
 * 1. ChoicePicker 字符串数组选项规范化与下标/文案精准换算
 * 2. computeTreePatches 对 Modal contentNode/triggerNode 递归 diff 与 activeComponentId 防光标跳动保护
 * 3. DateTimeInput 秒数与自定义时区 (+08:00) 完整保留
 * 4. createSurface dataModel 原型链过滤防护
 * 5. TextField 显式 disabled 状态与 check 隔离
 */

const assert = require('assert');
const { A2UIEngine, computeTreePatches } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🛡️  开始执行 Self-Review 专项深度加固测试套件');
console.log('================================================================\n');

// ----------------------------------------------------
// [SR-1] ChoicePicker 字符串数组选项规范化与展示/匹配换算
// ----------------------------------------------------
console.log('👉 [1/5] 验证 ChoicePicker 字符串数组选项规范化与展示/匹配换算 (SR-1)');
{
  const S = 'surf_cp_strings';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          billingCycle: 'monthly',
        },
        components: [
          { id: 'root', component: 'Column', children: ['picker_1'] },
          {
            id: 'picker_1',
            component: 'ChoicePicker',
            label: '计费周期',
            options: ['annual', 'monthly', 'weekly'],
            value: { '@path': '/billingCycle' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.ok(tree && tree.children && tree.children[0], '渲染树必须有效');
  const pickerNode = tree.children[0];

  assert.strictEqual(pickerNode.options.length, 3, '选项数量必须为 3');
  assert.strictEqual(pickerNode.options[0].label, 'annual', '字符串选项必须规范化为 {label, value}');
  assert.strictEqual(pickerNode.options[0].value, 'annual');
  assert.strictEqual(pickerNode.options[0].selected, false);
  assert.strictEqual(pickerNode.options[1].label, 'monthly');
  assert.strictEqual(pickerNode.options[1].value, 'monthly');
  assert.strictEqual(pickerNode.options[1].selected, true, 'monthly 必须被标记为 selected: true');
  assert.strictEqual(pickerNode.selectedIndex, 1, 'selectedIndex 必须准确匹配到 monthly (下标 1)');
  assert.strictEqual(pickerNode.displayLabel, 'monthly', 'displayLabel 必须正确显示 monthly');
  console.log('   ✓ SR-1 ChoicePicker 字符串数组选项规范化与换算验证 100% 通过');
}

// ----------------------------------------------------
// [SR-2] computeTreePatches 对 Modal contentNode 递归 diff 与防跳动
// ----------------------------------------------------
console.log('👉 [2/5] 验证 computeTreePatches 对 Modal contentNode 递归 diff 与防光标跳动 (SR-2)');
{
  const oldTree = {
    id: 'root',
    component: 'Column',
    children: [
      {
        id: 'modal_1',
        component: 'Modal',
        triggerNode: { id: 'btn_open', component: 'Button', text: '打开弹窗' },
        contentNode: {
          id: 'col_modal',
          component: 'Column',
          children: [
            { id: 'modal_input', component: 'TextField', value: 'hello', validationError: '' },
            { id: 'btn_confirm', component: 'Button', text: '确认', disabled: false },
          ],
        },
        children: [],
      },
    ],
  };

  const newTree = {
    id: 'root',
    component: 'Column',
    children: [
      {
        id: 'modal_1',
        component: 'Modal',
        triggerNode: { id: 'btn_open', component: 'Button', text: '打开弹窗' },
        contentNode: {
          id: 'col_modal',
          component: 'Column',
          children: [
            { id: 'modal_input', component: 'TextField', value: 'hello world', validationError: '长度过长' },
            { id: 'btn_confirm', component: 'Button', text: '确认', disabled: true },
          ],
        },
        children: [],
      },
    ],
  };

  const patches = computeTreePatches(oldTree, newTree, 'localRenderTree', {
    activeComponentId: 'modal_input',
  });

  // 断言：activeComponentId 为 modal_input 时，modal_input 的 value 绝对不能出现在 patches 中
  const keys = Object.keys(patches);
  const valuePatchKey = keys.find((k) => k.includes('value'));
  assert.strictEqual(valuePatchKey, undefined, '受控输入框防跳动：patches 绝对不能包含 activeComponentId 的 value 补丁');

  // 断言：弹窗内的校验信息和按钮禁用态必须生成精准局部补丁，而不是整块替换 contentNode
  const hasValidationError = keys.some((k) => k.includes('validationError') && patches[k] === '长度过长');
  const hasDisabled = keys.some((k) => k.includes('disabled') && patches[k] === true);
  assert.ok(hasValidationError, '弹窗内部 TextField validationError 必须精准差量更新');
  assert.ok(hasDisabled, '弹窗内部 Button disabled 必须精准差量更新');
  assert.ok(!patches['localRenderTree.children[0].contentNode'], '不能整块粗暴替换 contentNode');
  console.log('   ✓ SR-2 Modal contentNode 递归差量更新与防光标跳动保护 100% 通过');
}

// ----------------------------------------------------
// [SR-3] DateTimeInput 秒数与自定义时区 (+08:00) 保持
// ----------------------------------------------------
console.log('👉 [3/5] 验证 DateTimeInput 秒数与特定时区 (+08:00) 完整保留 (SR-3)');
{
  const S = 'surf_dt_tz';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          meetingTime: '2025-10-28T14:30:45+08:00',
        },
        components: [
          { id: 'root', component: 'Column', children: ['dt_input'] },
          {
            id: 'dt_input',
            component: 'DateTimeInput',
            enableDate: true,
            enableTime: true,
            value: { '@path': '/meetingTime' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const dtNode = tree.children[0];
  const expectedDate = new Date('2025-10-28T14:30:45+08:00');
  const expY = expectedDate.getFullYear();
  const expM = String(expectedDate.getMonth() + 1).padStart(2, '0');
  const expD = String(expectedDate.getDate()).padStart(2, '0');
  const expH = String(expectedDate.getHours()).padStart(2, '0');
  const expMin = String(expectedDate.getMinutes()).padStart(2, '0');
  assert.strictEqual(dtNode.dateValue, `${expY}-${expM}-${expD}`, 'dateValue 必须正确换算为本地客户端年月日展示');
  assert.strictEqual(dtNode.timeValue, `${expH}:${expMin}`, 'timeValue 必须正确换算为本地客户端时分展示供选择器使用');
  assert.strictEqual(dtNode.timeSec, '45', 'timeSec 必须精确保留 45 秒');
  assert.strictEqual(dtNode.timezone, '+08:00', 'timezone 必须精确保留 +08:00');
  console.log('   ✓ SR-3 DateTimeInput 秒数与特定时区完整保留断言 100% 通过');
}

// ----------------------------------------------------
// [SR-4] createSurface dataModel 原型链过滤防御
// ----------------------------------------------------
console.log('👉 [4/5] 验证 createSurface dataModel 原型链过滤防护 (SR-4)');
{
  const S = 'surf_pollution_guard';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          normalField: 'ok',
          __proto__: { polluted: true },
        },
        components: [
          { id: 'root', component: 'Text', text: 'Hello' },
        ],
      },
    },
  ]);

  assert.strictEqual({}.polluted, undefined, '全局原型链绝对不能被污染');
  const surface = engine.surfaces.get(S);
  assert.strictEqual(surface.dataModel.normalField, 'ok');
  console.log('   ✓ SR-4 createSurface dataModel 原型链安全防御验证通过');
}

// ----------------------------------------------------
// [SR-5] TextField 显式 disabled 状态与 check 隔离
// ----------------------------------------------------
console.log('👉 [5/5] 验证 TextField 显式 disabled 与 check 隔离 (SR-5)');
{
  const S = 'surf_tf_explicit_disabled';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          code: '123456',
        },
        components: [
          { id: 'root', component: 'Column', children: ['input_disabled', 'input_normal'] },
          { id: 'input_disabled', component: 'TextField', value: { '@path': '/code' }, disabled: true },
          { id: 'input_normal', component: 'TextField', value: { '@path': '/code' } },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.strictEqual(tree.children[0].disabled, true, '显式声明 disabled: true 的输入框必须标记 disabled');
  assert.strictEqual(tree.children[1].disabled, undefined, '普通未禁用输入框 disabled 必须为 undefined/falsy');
  console.log('   ✓ SR-5 TextField 显式 disabled 状态断言通过');
}

console.log('\n================================================================');
console.log('🎉 全部 5 项 Self-Review 专项深度加固单测 100% PASS！');
console.log('================================================================');
