const assert = require('assert');
const { A2UIEngine, ErrorCodes } = require('../miniprogram/core/engine');
const {
  resolveValue,
  resolveDeep,
  evaluateFunction,
  formatCurrency,
  openUrl,
} = require('../miniprogram/core/data-model');
const { parseInline, hasMarkdown, parseMarkdown } = require('../miniprogram/core/markdown');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🛡️  开始执行 Self-Review Round 7 深度架构加固综合测试套件');
console.log('================================================================\n');

// -------------------------------------------------------------
// [1] SEC-H1: ReDoS 重叠量词与字符类拦截
// -------------------------------------------------------------
console.log('👉 [1/10] 验证 SEC-H1: ReDoS 重叠量词静态拦截 (\\d+\\d+X, a+a+X)');
const attackPattern1 = '\\d+\\d+\\d+\\d+\\d+\\d+\\d+\\d+X';
const attackVal1 = '1234567890123456789012345678901234567890!';
const t0 = Date.now();
const res1 = evaluateFunction('regex', { pattern: attackPattern1, value: attackVal1 });
const elapsed1 = Date.now() - t0;
assert.strictEqual(res1, false, '重叠数字量词必须被静态拦截');
assert.ok(elapsed1 < 50, `重叠量词拦截耗时必须 < 50ms (实际: ${elapsed1}ms)`);

const attackPattern2 = 'a+a+a+a+a+a+X';
const attackVal2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!';
const res2 = evaluateFunction('regex', { pattern: attackPattern2, value: attackVal2 });
assert.strictEqual(res2, false, '重叠字母量词必须被静态拦截');
console.log(`   ✓ SEC-H1 ReDoS 重叠量词攻击被安全拦截 (耗时: ${elapsed1}ms)`);

// -------------------------------------------------------------
// [2] SEC-H2: resolveDeep 循环引用与深度防爆
// -------------------------------------------------------------
console.log('👉 [2/10] 验证 SEC-H2: resolveDeep 循环引用与深度防爆');
const cyclicObj = { name: 'cyclic' };
cyclicObj.self = cyclicObj;

// 绝不能抛出 RangeError: Maximum call stack size exceeded
let cyclicResult = null;
assert.doesNotThrow(() => {
  cyclicResult = resolveDeep(cyclicObj, {});
}, '存在循环引用的对象绝不能导致调用栈溢出崩溃');
assert.strictEqual(cyclicResult.name, 'cyclic');
assert.strictEqual(cyclicResult.self, cyclicObj, '循环引用自指针应原样安全保留');

// 极深嵌套对象
let deepObj = { level: 0 };
let curr = deepObj;
for (let i = 1; i <= 50; i++) {
  curr.child = { level: i };
  curr = curr.child;
}
assert.doesNotThrow(() => {
  resolveDeep(deepObj, {});
}, '超过 32 层深度的对象必须安全截断防护');
console.log('   ✓ SEC-H2 resolveDeep 循环引用与深度超限防护验证通过');

// -------------------------------------------------------------
// [3] BUG-H3: numeric 空值与类型安全
// -------------------------------------------------------------
console.log('👉 [3/10] 验证 BUG-H3: numeric 空字符串、null、false 绝不绕过校验');
assert.strictEqual(evaluateFunction('numeric', { value: '', min: 0, max: 100 }), false, '空字符串不能被强转为 0');
assert.strictEqual(evaluateFunction('numeric', { value: null, min: 0, max: 100 }), false, 'null 不能被强转为 0');
assert.strictEqual(evaluateFunction('numeric', { value: undefined, min: 0, max: 100 }), false, 'undefined 必须返回 false');
assert.strictEqual(evaluateFunction('numeric', { value: false, min: 0, max: 100 }), false, 'false 必须返回 false');
assert.strictEqual(evaluateFunction('numeric', { value: [], min: 0, max: 100 }), false, '空数组必须返回 false');
assert.strictEqual(evaluateFunction('numeric', { value: '0', min: 0, max: 100 }), true, '合法数字字符串 "0" 必须返回 true');
assert.strictEqual(evaluateFunction('numeric', { value: 50, min: 0, max: 100 }), true, '合法数字 50 必须返回 true');
console.log('   ✓ BUG-H3 numeric 空值隐式类型转换漏洞已彻底修复');

// -------------------------------------------------------------
// [4] PROT-M1: surface 不存在时派发 VALIDATION_FAILED 错误
// -------------------------------------------------------------
console.log('👉 [4/10] 验证 PROT-M1: updateComponents / updateDataModel 画布不存在时上报错误');
const engine = new A2UIEngine();
const caughtErrors = [];
engine.onError((err) => caughtErrors.push(err));

engine.process({
  version: 'v1.0',
  updateComponents: {
    surfaceId: 'non_existent_surface',
    components: [{ id: 'comp_1', component: 'Text', text: 'Hi' }],
  },
});
assert.strictEqual(caughtErrors.length, 1);
assert.strictEqual(caughtErrors[0].error.code, ErrorCodes.VALIDATION_FAILED);
assert.ok(caughtErrors[0].error.message.includes('not found'));

engine.process({
  version: 'v1.0',
  updateDataModel: {
    surfaceId: 'non_existent_surface',
    path: '/title',
    value: 'Hello',
  },
});
assert.strictEqual(caughtErrors.length, 2);
assert.strictEqual(caughtErrors[1].error.code, ErrorCodes.VALIDATION_FAILED);
console.log('   ✓ PROT-M1 画布不存在时标准 VALIDATION_FAILED 结构化错误上报校验通过');

// -------------------------------------------------------------
// [5] SEC-M3 & BUG-M4: parseNamedArgs 原型过滤与 decimals 范围钳制
// -------------------------------------------------------------
console.log('👉 [5/10] 验证 SEC-M3 & BUG-M4: 原型注入拦截与 decimals 范围钳制');
const exprWithProto = '${formatCurrency(value: 100, __proto__: evil, decimals: 50)}';
const resolvedProto = resolveValue(exprWithProto, {});
// 50 会被钳制到 20，绝不触发 toFixed(50) 的 RangeError
assert.ok(typeof resolvedProto === 'string');
assert.strictEqual(Object.prototype.evil, undefined, '原型链绝不能被污染');

// 负数 decimals
const formattedNegDec = formatCurrency(12.345, 'USD', -2);
assert.strictEqual(formattedNegDec, '$12', '负数小数位数必须钳制为 0');
console.log('   ✓ SEC-M3 & BUG-M4 原型过滤与 decimals 范围安全钳制通过');

// -------------------------------------------------------------
// [6] SPEC-L1: deleteSurface 字符串形式兼容
// -------------------------------------------------------------
console.log('👉 [6/10] 验证 SPEC-L1: deleteSurface 字符串简写支持');
engine.process({
  version: 'v1.0',
  createSurface: { surfaceId: 'surf_to_delete' },
});
assert.ok(engine.surfaces.has('surf_to_delete'));
engine.process({
  version: 'v1.0',
  deleteSurface: 'surf_to_delete',
});
assert.strictEqual(engine.surfaces.has('surf_to_delete'), false);
console.log('   ✓ SPEC-L1 deleteSurface 字符串与对象双形式兼容通过');

// -------------------------------------------------------------
// [7] BUG-L2: length 校验支持普通对象
// -------------------------------------------------------------
console.log('👉 [7/10] 验证 BUG-L2: length 校验对普通对象按键数统计');
const objData = { a: 1, b: 2 };
assert.strictEqual(evaluateFunction('length', { value: objData, min: 2, max: 2 }), true);
assert.strictEqual(evaluateFunction('length', { value: objData, min: 3 }), false);
console.log('   ✓ BUG-L2 length 校验对普通对象按 Object.keys() 统计通过');

// -------------------------------------------------------------
// [8] H1: DateTimeInput oldTree 不变异与 computeTreePatches 差量更新
// -------------------------------------------------------------
console.log('👉 [8/10] 验证 H1: DateTimeInput 修改时不前置就地变异 oldTree，patches 正确产出');
let registeredDef = null;
global.Component = (def) => { registeredDef = def; };
delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

const eng = new A2UIEngine();
eng.process([
  { version: 'v1.0', createSurface: { surfaceId: 'test_dt' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'test_dt',
      components: [
        { id: 'root', component: 'Column', children: ['dt_comp'] },
        { id: 'dt_comp', component: 'DateTimeInput', enableDate: true, enableTime: true, value: { '@path': '/dt' } },
      ],
    },
  },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: 'test_dt',
      path: '/dt',
      value: '2025-06-10T08:00:00Z',
    },
  },
]);

const initialTree = eng.getRenderTree('test_dt');
const instance = {
  data: {
    surfaceId: 'test_dt',
    localRenderTree: JSON.parse(JSON.stringify(initialTree)),
    uiState: {},
  },
  engine: eng,
  findNodeById: registeredDef.methods.findNodeById,
  dispatchInputEvent: registeredDef.methods.dispatchInputEvent,
  handleDateTimeChange: registeredDef.methods.handleDateTimeChange,
  triggerEvent: () => {},
  setData: function(patch, cb) {
    this._lastPatch = patch;
    if (cb) cb();
  },
};

// 触发修改日期为 2025-06-15
instance.handleDateTimeChange({
  currentTarget: {
    dataset: { id: 'dt_comp', path: '/dt', part: 'date' },
  },
  detail: { value: '2025-06-15' },
});

// 验证 patch 中包含了 dateValue，而不是被误判为无变化跳过！
const patchKeys = Object.keys(instance._lastPatch || {});
assert.ok(
  patchKeys.some((k) => k.includes('dateValue')),
  `setData patches 中必须包含 dateValue 局部更新: ${JSON.stringify(instance._lastPatch)}`
);
console.log('   ✓ H1 DateTimeInput 差量 patches 完整包含 dateValue，视图可正常刷新');

// -------------------------------------------------------------
// [9] H2: Modal 样式声明完整性检查
// -------------------------------------------------------------
console.log('👉 [9/10] 验证 H2: a2ui-surface.wxss 包含完整 Modal 核心样式');
const wxssContent = fs.readFileSync(
  path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss'),
  'utf-8'
);
assert.ok(wxssContent.includes('.a2ui-modal-mask'), 'wxss 必须包含 .a2ui-modal-mask');
assert.ok(wxssContent.includes('.a2ui-modal-box'), 'wxss 必须包含 .a2ui-modal-box');
assert.ok(wxssContent.includes('.a2ui-modal-container'), 'wxss 必须包含 .a2ui-modal-container');
assert.ok(wxssContent.includes('position: fixed'), 'modal mask 必须具有 fixed 定位');
assert.ok(wxssContent.includes('.a2ui-picker-box'), 'wxss 必须包含 .a2ui-picker-box 别名');
assert.ok(wxssContent.includes('.a2ui-tab-bar'), 'wxss 必须包含 .a2ui-tab-bar 别名');
console.log('   ✓ H2 Modal 与 Picker/Tab 核心样式完整性校验通过');

// -------------------------------------------------------------
// [10] H3: onDeepNodeInput 兼容单元素数组下标 [0]
// -------------------------------------------------------------
console.log('👉 [10/10] 验证 H3: onDeepNodeInput 成功解析深层传递的单元素数字数组 [0]');
eng.process([
  { version: 'v1.0', createSurface: { surfaceId: 'test_cp' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'test_cp',
      components: [
        { id: 'root', component: 'Column', children: ['choice_comp'] },
        {
          id: 'choice_comp',
          component: 'ChoicePicker',
          options: [{ label: 'Option A', value: 'opt_a' }, { label: 'Option B', value: 'opt_b' }],
          value: { '@path': '/selected' },
        },
      ],
    },
  },
]);

const cpTree = eng.getRenderTree('test_cp');
let dispatchedValue = null;
const cpInstance = {
  data: {
    surfaceId: 'test_cp',
    localRenderTree: cpTree,
  },
  engine: eng,
  findNodeById: registeredDef.methods.findNodeById,
  dispatchInputEvent: (id, path, val) => { dispatchedValue = val; },
  onDeepNodeInput: registeredDef.methods.onDeepNodeInput,
};

// 深层跳板传入单元素数组 [1]
cpInstance.onDeepNodeInput({
  detail: {
    componentId: 'choice_comp',
    path: '/selected',
    value: [1],
  },
});
assert.deepStrictEqual(dispatchedValue, ['opt_b'], '单元素下标 [1] 必须被解析为具体选项值 ["opt_b"]');
console.log('   ✓ H3 onDeepNodeInput 单元素数字数组 [1] 解析为 ["opt_b"] 校验通过');

console.log('\n================================================================');
console.log('🎉 全部 10 项 Self-Review Round 7 深度架构加固单测 100% PASS！');
console.log('================================================================');
