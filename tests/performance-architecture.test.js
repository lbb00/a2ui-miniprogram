/**
 * Round 11: A2UI 性能优化与底层渲染架构核心改造专项测试套件
 * 严格覆盖 P0.1, P0.2, P0.3, P1.1, P1.2, P2 六大核心专项
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { computeTreePatches, isShallowEqual, isDeepEqual } = require('../miniprogram/core/pointer');

console.log('================================================================');
console.log('⚡ 开始执行 Round 11: A2UI 性能优化与渲染架构专项验收测试');
console.log('================================================================');

// ====================================================================
// [1] P0.1: 输入平滑防跳动与消除双重 AST 重算
// ====================================================================
console.log('\n👉 [1/6] 验证 P0.1: 输入平滑防跳动、silent 拦截与 activeComponentId 光标保护');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  const engine = new A2UIEngine();
  const S = 'surf_p0_1';
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: { textVal: 'abcde' },
        components: [
          { id: 'root', component: 'Column', children: ['txt_in', 'btn_act'] },
          { id: 'txt_in', component: 'TextField', value: { '@path': '/textVal' } },
          {
            id: 'btn_act',
            component: 'Button',
            text: 'Submit',
            checks: [
              {
                condition: {
                  '@call': 'length',
                  args: { value: { '@path': '/textVal' }, min: 4 },
                },
                message: 'Must have at least 4 chars',
              },
            ],
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  let setDataCalls = [];
  let triggeredEvents = [];
  let notifyCount = 0;

  engine.subscribe(() => {
    notifyCount++;
  });

  const instance = {
    data: {
      surfaceId: S,
      localRenderTree: JSON.parse(JSON.stringify(tree)),
      uiState: {},
    },
    engine,
    setData(d, cb) {
      setDataCalls.push(d);
      if (typeof cb === 'function') cb();
    },
    triggerEvent(name, detail) {
      triggeredEvents.push({ name, detail });
    },
    findNodeById: componentDef.methods.findNodeById,
  };
  Object.assign(instance, componentDef.methods);

  // 1. 模拟聚焦 TextField
  instance.handleInputFocus({
    currentTarget: { dataset: { id: 'txt_in' } },
  });
  assert.strictEqual(instance._currentActiveInputId, 'txt_in', '聚焦后应精准记录当前激活输入组件 ID');

  // 2. 模拟 dispatchInputEvent 键入 "a"（长度不足 4，联动使 Submit 按钮禁用）
  instance.dispatchInputEvent('txt_in', '/textVal', 'a');

  // 断言：由于传入 { silent: true }，engine.notify 未被重复触发
  assert.strictEqual(notifyCount, 0, 'dispatchInputEvent 必须静默反写，杜绝重复触发第 1 次全量 AST 计算与全局通知');
  assert.strictEqual(engine.surfaces.get(S).dataModel.textVal, 'a', '数据模型仍正常反写');

  // 断言：activeComponentId 的 value 绝对不会被回写至 setData，而联动按钮的 disabled 差量更新
  const lastSetData = setDataCalls[setDataCalls.length - 1];
  assert.ok(lastSetData, '必须触发定向 setData');
  assert.strictEqual(lastSetData['localRenderTree.children[0].value'], undefined, '当前打字输入框的 value 绝对不能出现在 patches 中');
  assert.strictEqual(lastSetData['localRenderTree.children[1].disabled'], true, '联动受影响的按钮状态精准差量更新');

  // 3. 模拟外部状态推送引起 renderTree 变更（如后台推送联动数据），此时用户仍在输入
  const externalNewTree = JSON.parse(JSON.stringify(tree));
  externalNewTree.children[0].value = 'server_overwritten_val';
  externalNewTree.children[1].text = 'Submit (Updated)';

  setDataCalls = [];
  componentDef.properties.renderTree.observer.call(instance, externalNewTree);

  // 断言：因为 _currentActiveInputId 为 txt_in，外部 renderTree 的 value 更新被保护拦截，不覆盖真机文本
  const renderTreePatch = setDataCalls[0] || {};
  assert.strictEqual(renderTreePatch['localRenderTree.children[0].value'], undefined, '用户输入中时，外部 renderTree 不应覆盖 activeInput 的 value 导致光标归位');
  assert.strictEqual(renderTreePatch['localRenderTree.children[1].text'], 'Submit (Updated)', '外部其他组件属性正常差量更新');

  // 4. 模拟失焦 handleInputBlur
  instance.handleInputBlur();
  assert.strictEqual(instance._currentActiveInputId, null, '失焦后必须清理 _currentActiveInputId');

  console.log('   ✓ P0.1 silent 拦截 AST 重算、焦点状态跟踪与真机光标防跳动验证 100% 通过');
}

// ====================================================================
// [2] P0.2: virtualHost 启用与 WXSS 重复解析消除
// ====================================================================
console.log('\n👉 [2/6] 验证 P0.2: virtualHost 选项、WXSS @import 移除与动画隔离');
{
  let layerDef = null;
  global.Component = (def) => { layerDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface-layer/a2ui-surface-layer.js')];
  require('../miniprogram/components/a2ui-surface-layer/a2ui-surface-layer.js');

  // 1. 校验 virtualHost 与 styleIsolation
  assert.ok(layerDef.options, 'a2ui-surface-layer 必须配置 options');
  assert.strictEqual(layerDef.options.virtualHost, true, '必须开启 virtualHost: true 消除多余宿主节点');
  assert.strictEqual(layerDef.options.styleIsolation, 'apply-shared', '必须开启 styleIsolation: apply-shared 共享父级样式表');

  // 2. 校验 a2ui-surface-layer.wxss
  const layerWxssPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface-layer/a2ui-surface-layer.wxss');
  const layerWxss = fs.readFileSync(layerWxssPath, 'utf8');
  assert.ok(!layerWxss.includes('@import'), 'a2ui-surface-layer.wxss 必须彻底移除 @import 重复引入');
  assert.ok(layerWxss.includes('display: contents'), 'a2ui-surface-layer 必须使用 display: contents 消除外层包裹盒');

  // 3. 校验 a2ui-surface.wxss 动画限定在 .a2ui-surface
  const surfaceWxssPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss');
  const surfaceWxss = fs.readFileSync(surfaceWxssPath, 'utf8');
  assert.ok(!surfaceWxss.match(/:host\s*,\s*\.a2ui-surface\s*\{[^}]*animation:/), ':host 不得带有 animation 入场动画');
  assert.ok(surfaceWxss.includes('.a2ui-surface {\n  width: 100%;\n  box-sizing: border-box;\n  animation: a2uiFadeIn'), '.a2ui-surface 独占入场动画');

  console.log('   ✓ P0.2 virtualHost 配置、700 行 WXSS 重复导入消除与 host 动画漂移隔离验证 100% 通过');
}

// ====================================================================
// [3] P0.3: 流式合帧调度器 (wx.nextTick / Batching Scheduler)
// ====================================================================
console.log('\n👉 [3/6] 验证 P0.3: 流式合帧批处理调度器 (Batching Frame Scheduler)');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  const instance = {
    data: { surfaceId: 'surf_batch', localRenderTree: null },
    setData: () => {},
    triggerEvent: () => {},
  };
  Object.assign(instance, componentDef.methods);

  assert.strictEqual(typeof instance._scheduleFrameRender, 'function', '必须实现 _scheduleFrameRender 方法');

  // 模拟微信小程序环境下的 wx.nextTick
  let scheduledTasks = [];
  global.wx = {
    nextTick(cb) {
      scheduledTasks.push(cb);
    },
  };

  let executionCount = 0;
  let finalValue = 0;

  // 模拟大模型流式打字机 10 次高频 chunk 连续推送
  for (let i = 1; i <= 10; i++) {
    const val = i;
    instance._scheduleFrameRender(() => {
      executionCount++;
      finalValue = val;
    });
  }

  // 断言：在 tick 触发前，只调度了 1 次帧任务
  assert.strictEqual(scheduledTasks.length, 1, '10 次高频调用必须仅在消息队列中注册 1 次 nextTick');
  assert.strictEqual(executionCount, 0, 'nextTick 执行前不触发实际渲染');

  // 模拟下一帧到达，执行批处理任务
  scheduledTasks[0]();

  assert.strictEqual(executionCount, 1, '合帧批处理生效，仅执行最终帧渲染 1 次');
  assert.strictEqual(finalValue, 10, '合帧渲染执行了最终时刻的任务');

  delete global.wx;
  console.log('   ✓ P0.3 流式合帧调度器完美合并高频打字机 chunk 验证通过');
}

// ====================================================================
// [4] P1.1: 差量补丁算法深度优化 (增量数组、无就地变异、快速比较)
// ====================================================================
console.log('\n👉 [4/6] 验证 P1.1: 差量补丁算法、数组增量下标补丁与杜绝就地变异');
{
  // 1. isShallowEqual & isDeepEqual 验证
  assert.strictEqual(isShallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' }), true);
  assert.strictEqual(isShallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'y' }), false);
  assert.strictEqual(isShallowEqual([1, 2, 3], [1, 2, 3]), true);
  assert.strictEqual(isShallowEqual([1, 2], [1, 2, 3]), false);

  assert.strictEqual(isDeepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } }), true);
  assert.strictEqual(isDeepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 3] } }), false);

  // 2. 数组增量优化验证：前缀一致，仅追加元素
  const oldTree = {
    id: 'root',
    component: 'Column',
    children: [
      { id: 'c1', component: 'Text', text: 'Msg 1' },
      { id: 'c2', component: 'Text', text: 'Msg 2' },
    ],
  };

  const newTree = {
    id: 'root',
    component: 'Column',
    children: [
      { id: 'c1', component: 'Text', text: 'Msg 1' },
      { id: 'c2', component: 'Text', text: 'Msg 2' },
      { id: 'c3', component: 'Text', text: 'Msg 3 (New Streaming Chunk)' },
    ],
  };

  // 深拷贝 oldTree 快照用于不可变性检测
  const oldTreeSnapshot = JSON.stringify(oldTree);

  const patches = computeTreePatches(oldTree, newTree, 'localRenderTree');

  // 断言：杜绝整块替换 children 数组
  assert.strictEqual(patches['localRenderTree.children'], undefined, '前缀一致追加时不得全量传输 children 数组');

  // 断言：仅生成增量子项下标补丁
  assert.deepStrictEqual(patches['localRenderTree.children[2]'], {
    id: 'c3',
    component: 'Text',
    text: 'Msg 3 (New Streaming Chunk)',
  }, '必须仅传输新增下标 children[2] 的增量补丁');

  // 断言：杜绝就地变异 oldTree
  assert.strictEqual(JSON.stringify(oldTree), oldTreeSnapshot, 'computeTreePatches 必须保持纯函数，杜绝就地变异 oldTree');

  console.log('   ✓ P1.1 增量下标补丁输出、快速比较与老树不可变性验证通过');
}

// ====================================================================
// [5] P1.2: 全场景接入差量更新 (_applyTreeUpdate)
// ====================================================================
console.log('\n👉 [5/6] 验证 P1.2: 全场景接入 _applyTreeUpdate 差量更新机制');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  const engine = new A2UIEngine();
  let setDataCalls = [];
  let renderedEvents = [];

  const instance = {
    data: {
      surfaceId: 'surf_apply',
      localRenderTree: null,
    },
    engine,
    setData(d, cb) {
      setDataCalls.push(d);
      if (typeof cb === 'function') cb();
    },
    triggerEvent(name, detail) {
      if (name === 'rendered') renderedEvents.push(detail);
    },
  };
  Object.assign(instance, componentDef.methods);

  // 1. 无老树时，降级全量更新
  const initialTree = { id: 'root', component: 'Column', children: [] };
  instance._applyTreeUpdate(null, initialTree, 'surf_apply');

  assert.strictEqual(setDataCalls.length, 1);
  assert.deepStrictEqual(setDataCalls[0], { localRenderTree: initialTree });
  assert.strictEqual(renderedEvents.length, 1);
  assert.strictEqual(renderedEvents[0].surfaceId, 'surf_apply');

  // 2. 有老树且产生差量时，优先使用 patches
  setDataCalls = [];
  renderedEvents = [];
  const updatedTree = {
    id: 'root',
    component: 'Column',
    children: [{ id: 'item_1', component: 'Text', text: 'Hello' }],
  };

  instance._applyTreeUpdate(initialTree, updatedTree, 'surf_apply');

  assert.strictEqual(setDataCalls.length, 1);
  assert.ok('localRenderTree.children' in setDataCalls[0] || 'localRenderTree.children[0]' in setDataCalls[0], '必须通过差量 patches 更新');
  assert.strictEqual(instance.data.localRenderTree, updatedTree, '本地数据引用保持同步');
  assert.strictEqual(renderedEvents.length, 1);

  // 3. 传入 null 时，正确清空
  setDataCalls = [];
  instance._applyTreeUpdate(updatedTree, null, 'surf_apply');
  assert.deepStrictEqual(setDataCalls[0], { localRenderTree: null });

  console.log('   ✓ P1.2 _applyTreeUpdate 全量降级与局部差量更新验证通过');
}

// ====================================================================
// [6] P2: 媒体与滚动条增强 (webp, enhanced scroll-view)
// ====================================================================
console.log('\n👉 [6/6] 验证 P2: Image 原生 webp 与横向 scroll-view 丝滑滚动体验');
{
  const tmplPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface/templates.wxml');
  const tmplContent = fs.readFileSync(tmplPath, 'utf8');

  // 1. Image webp="true" 验证
  assert.ok(tmplContent.includes('webp="true"'), 'templates.wxml 必须为 image 标签配置 webp="true"');

  // 2. Scroll-view 增强配置验证
  assert.ok(tmplContent.includes('enhanced="true"'), 'templates.wxml 必须为横向 scroll-view 配置 enhanced="true"');
  assert.ok(tmplContent.includes('show-scrollbar="false"'), 'templates.wxml 必须为横向 scroll-view 配置 show-scrollbar="false"');
  assert.ok(tmplContent.includes('fast-deceleration="true"'), 'templates.wxml 必须为横向 scroll-view 配置 fast-deceleration="true"');

  console.log('   ✓ P2 webp="true" 与 enhanced scroll-view 原生属性配置验证通过');
}

console.log('\n================================================================');
console.log('🎉 全部 6 项 Round 11 性能优化与渲染架构专项验收测试 100% PASS！');
console.log('================================================================\n');
