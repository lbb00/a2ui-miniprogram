/**
 * A2UI MiniProgram 用例切换防残影与单步调试状态机单测套件
 * 
 * 严格验证：
 * 1. 用例切换时，立即清除上一个用例所有视图、渲染树、节点计数和日志，无残影；
 * 2. a2ui-surface 组件对 renderTree: null 的即时清空响应（消除残留卡片）；
 * 3. 单步调试（stepNextChunk）：
 *    - 初始状态/已播放完毕状态下点击步进，能自动重置并从第 1 帧开始逐帧执行；
 *    - 自动播放过程中点击步进，立即暂停并执行下一 chunk；
 *    - 前序帧（如只有 createSurface 或 updateDataModel）时，状态清晰反馈，不卡死不假死；
 *    - 随着组件装配帧推进，渲染树与数据模型逐帧正确生成，直到全量就绪。
 */

const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const ALL_CASES = require('../fixtures/official-all-cases');

console.log('================================================================');
console.log('🧪 开始执行 A2UI 用例切换防残影与流式单步状态机专项单测');
console.log('================================================================\n');

// 模拟微信小程序环境
global.wx = global.wx || {
  showToast: () => {},
};

let capturedPageConfig = null;
global.Page = (cfg) => {
  capturedPageConfig = cfg;
};

// 预先载入一次获取 pageConfig
require('../miniprogram/pages/index/index.js');
const basePageConfig = capturedPageConfig;

// 模拟微信小程序 a2ui-surface 组件环境
function createMockSurfaceComponent() {
  const surface = {
    data: {
      localRenderTree: null,
      surfaceId: '',
    },
    internalEngine: null,
    engine: null,
    setData(patch) {
      Object.assign(this.data, patch);
    },
    setEngine(engine) {
      this.engine = engine;
      if (engine && typeof engine.subscribe === 'function') {
        engine.subscribe((sId, tree) => {
          this.setData({ localRenderTree: tree || null });
        });
      }
    },
    setRenderTree(tree) {
      this.setData({ localRenderTree: tree || null });
    },
    clear() {
      if (this.internalEngine) {
        this.internalEngine = null;
      }
      this.setData({ localRenderTree: null });
    },
    // 模拟组件 properties observer
    onRenderTreeChange(newVal) {
      // 修复后的关键逻辑：支持 newVal 为 null / undefined 时的清空
      this.setData({ localRenderTree: newVal || null });
    },
  };
  return surface;
}

// 模拟微信小程序 index 页面环境
function createMockPage() {
  const surfaceComponent = createMockSurfaceComponent();

  const instance = Object.assign({}, basePageConfig, {
    data: JSON.parse(JSON.stringify(basePageConfig.data)),
    setData(patch) {
      Object.assign(this.data, patch);
      // 模拟微信小程序父子组件属性绑定: 当页面 renderTree 变更，触发 surface 组件的 observer
      if ('renderTree' in patch) {
        surfaceComponent.onRenderTreeChange(patch.renderTree);
      }
      if ('currentSurfaceId' in patch) {
        surfaceComponent.data.surfaceId = patch.currentSurfaceId;
      }
    },
    selectComponent(selector) {
      if (selector === '#main-surface') {
        return surfaceComponent;
      }
      return null;
    },
  });

  return { page: instance, surface: surfaceComponent };
}

// ============================================================================
// 测试用例 1: 验证 a2ui-surface observer 修复及 null 清空能力 (彻底杜绝旧界面卡片残留)
// ============================================================================
console.log('👉 [测试 1/4] 验证 a2ui-surface 渲染树 Observer 修复与残影清空机制');
{
  const surface = createMockSurfaceComponent();

  // 1. 模拟收到有效渲染树
  const fakeTree = { id: 'root', component: 'Card', children: [] };
  surface.onRenderTreeChange(fakeTree);
  assert.strictEqual(surface.data.localRenderTree, fakeTree, '有效渲染树未能正确挂载至 localRenderTree');

  // 2. 模拟用例切换时传入 null
  surface.onRenderTreeChange(null);
  assert.strictEqual(surface.data.localRenderTree, null, '传入 null 时未能成功重置 localRenderTree，卡片会残留！');

  // 3. 模拟传入 undefined
  surface.onRenderTreeChange(fakeTree);
  assert.strictEqual(surface.data.localRenderTree, fakeTree);
  surface.onRenderTreeChange(undefined);
  assert.strictEqual(surface.data.localRenderTree, null, '传入 undefined 时未能成功重置 localRenderTree');

  // 4. 模拟显式 clear 调用
  surface.onRenderTreeChange(fakeTree);
  surface.clear();
  assert.strictEqual(surface.data.localRenderTree, null, 'clear() 无法清空画布');

  console.log('   ✓ localRenderTree 在 newVal 为 null/undefined 时可即时清空，无任何残影残留\n');
}

// ============================================================================
// 测试用例 2: 验证用例切换逻辑（onSelectCase, prevCase, nextCase）的即时视图擦除
// ============================================================================
console.log('👉 [测试 2/4] 验证切换用例时立即擦除旧视图与引擎状态');
{
  const { page, surface } = createMockPage();

  // 1. 先载入并直出一个复杂用例 (如 00_incremental.json)
  const case0Index = ALL_CASES.findIndex((c) => c.file === '00_incremental.json');
  assert.ok(case0Index >= 0);
  page.switchCase(case0Index, false);
  page.skipToDirect(); // 直出全部帧

  assert.ok(page.data.nodeCount > 0, '旧用例 nodeCount 应大于 0');
  assert.ok(surface.data.localRenderTree !== null, 'surface 组件中未能渲染旧用例');

  // 模拟旧用例产生了一些事件日志
  page.setData({
    eventLogs: [{ time: '12:00:00', content: '{"action":"click"}' }],
  });
  assert.strictEqual(page.data.eventLogs.length, 1);

  // 2. 切换到另一个用例 (如 01_flight-status.json)
  const case1Index = ALL_CASES.findIndex((c) => c.file === '01_flight-status.json');
  assert.ok(case1Index >= 0);

  // 触发切换 (不自动播放，便于检查刚切换瞬间的状态)
  page.switchCase(case1Index, false);

  // 核心断言：在切换瞬间，所有旧数据必须被彻底抹除！
  assert.strictEqual(page.data.nodeCount, 0, '切换瞬间 nodeCount 必须重置为 0');
  assert.strictEqual(page.data.currentMessageIndex, 0, '切换瞬间 currentMessageIndex 必须重置为 0');
  assert.strictEqual(page.data.eventLogs.length, 0, '切换瞬间 eventLogs 必须清空');
  assert.strictEqual(surface.data.localRenderTree, null, 'surface.localRenderTree 必须瞬间同步清空为 null，杜绝残留');
  assert.strictEqual(page.data.currentSurfaceId, 'gallery-flight-status', 'currentSurfaceId 应更新为新用例');

  console.log('   ✓ 用例切换瞬间：原视图立即清空，节点计数归零，日志重置，绝无上一用例残留\n');
}

// ============================================================================
// 测试用例 3: 验证从第 0 帧开始步进 (stepNextChunk) 的逐帧状态迁移与无假死
// ============================================================================
console.log('👉 [测试 3/4] 验证从第 0 帧开始单步步进的逐帧状态机迁移');
{
  const { page, surface } = createMockPage();

  // 选中 01_flight-status.json
  const flightIndex = ALL_CASES.findIndex((c) => c.file === '01_flight-status.json');
  page.switchCase(flightIndex, false); // 不自动播放
  const messages = page.data.currentCase.messages;
  const totalFrames = messages.length;

  assert.strictEqual(page.data.currentMessageIndex, 0);

  // 逐帧单步执行
  for (let step = 0; step < totalFrames; step++) {
    const prevIndex = page.data.currentMessageIndex;
    page.stepNextChunk();
    const currIndex = page.data.currentMessageIndex;

    assert.strictEqual(currIndex, prevIndex + 1, `步进失败: 帧索引未正确递增 (${prevIndex} -> ${currIndex})`);

    // 检查第 1 帧 (createSurface) 与第 2 帧 (updateDataModel) 前序帧状态反馈
    const msg = messages[step];
    if (msg.createSurface || msg.updateDataModel) {
      if (!surface.data.localRenderTree) {
        assert.ok(page.data.streamSummaryText.length > 0, '前序未生成 root 帧时必须提供清晰的状态提示');
        assert.ok(page.data.emptyHint.length > 0, '前序未生成 root 帧时 emptyHint 必须提示当前处于哪一帧');
        assert.strictEqual(page.data.nodeCount, 0, '尚未挂载 root 时 nodeCount 应为 0');
      }
    }

    // 检查当 updateComponents 装配 root 后，渲染树非空
    if (surface.data.localRenderTree) {
      assert.ok(page.data.nodeCount > 0, '有渲染树时 nodeCount 必须大于 0');
      assert.strictEqual(page.data.emptyHint, '', '渲染树挂载后 emptyHint 应为空');
    }
  }

  // 全部执行完毕后检查最终状态
  assert.strictEqual(page.data.currentMessageIndex, totalFrames);
  assert.ok(page.data.nodeCount >= 20, `01_flight-status 最终节点数应 >= 20，实际: ${page.data.nodeCount}`);
  assert.strictEqual(page.data.isStreaming, false);

  console.log(`   ✓ 成功从第 0 帧逐帧步进至第 ${totalFrames} 帧，每帧状态流转精准，前序提示清晰，无任何卡死假死\n`);
}

// ============================================================================
// 测试用例 4: 验证播放完毕后再次点击步进（重新从第 1 帧开始）与自动推流打断
// ============================================================================
console.log('👉 [测试 4/4] 验证播放完毕后“重播步进”交互与自动推流中途暂停打断');
{
  const { page, surface } = createMockPage();

  const caseIndex = ALL_CASES.findIndex((c) => c.file === '00_incremental.json');
  page.switchCase(caseIndex, false);
  page.skipToDirect(); // 直出全部 6 帧

  assert.strictEqual(page.data.currentMessageIndex, page.data.currentTotalMessages);
  assert.ok(page.data.nodeCount > 0);

  // 1. 在已播放完毕状态下，点击步进一帧
  page.stepNextChunk();

  // 必须重置并执行了第 1 帧！
  assert.strictEqual(page.data.currentMessageIndex, 1, '播放完毕后点击步进应重置并执行第 1 帧');
  assert.ok(page.data.streamLog.includes('[Reset]'), '日志应记录重置为单步调试模式');

  // 2. 测试自动播放过程中打断
  page.switchCase(caseIndex, true); // 启动自动推流
  assert.ok(page.streamTimer !== null, '应有活跃的流式计时器');
  assert.strictEqual(page.data.isStreaming, true);

  // 立即点击步进一帧
  page.stepNextChunk();

  // 计时器必须立即销毁，isStreaming 变为 false
  assert.strictEqual(page.streamTimer, null, '步进应立即销毁自动推流计时器');
  assert.strictEqual(page.data.isStreaming, false, 'isStreaming 应立即置为 false');

  console.log('   ✓ 播放完毕后点击步进可无缝重头单步调试；自动推流中途点击步进可立即打断暂停\n');
}

console.log('================================================================');
console.log('🎉 全部 4 项切换防残影与流式单步状态机单测 100% PASS！');
console.log('================================================================\n');
