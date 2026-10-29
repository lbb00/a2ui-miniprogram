/**
 * A2UI MiniProgram Component E2E Tests via miniprogram-simulate
 * 基于微信官方 miniprogram-simulate 的真实组件挂载、WXML DOM 渲染与全链路交互测试
 */

const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

// 1. 初始化 DOM 仿真环境（miniprogram-simulate 运行所必须）
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'https://miniprogram.simulate.local',
  referrer: 'https://miniprogram.simulate.local',
  contentType: 'text/html',
});
global.window = dom.window;
global.document = dom.window.document;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.navigator = dom.window.navigator;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

const simulate = require('miniprogram-simulate');
const { A2UIEngine } = require('../../miniprogram/core/engine');

function wait(ms = 35) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSimulateE2E() {
  console.log('=====================================================');
  console.log('🚀 运行 miniprogram-simulate 真实组件渲染与交互 E2E 测试');
  console.log('=====================================================\n');

  const compPath = path.resolve(__dirname, '../../miniprogram/components/a2ui-surface/a2ui-surface');
  const compId = simulate.load(compPath);

  // ----------------------------------------------------------------
  // 测试用例 1: 基础渲染与表单双向绑定闭环 (00_simple-login-form)
  // ----------------------------------------------------------------
  console.log('--- [用例 1] 表单渲染、双向绑定输入与 Action 上报闭环 ---');
  {
    const fixture = require('../../fixtures/official-examples/00_simple-login-form.json');
    const engine = new A2UIEngine();
    engine.process(fixture.messages);

    const comp = simulate.render(compId, { surfaceId: 'gallery-simple-login-form' });
    comp.attach(document.createElement('div'));
    comp.instance.setEngine(engine);

    // 验证 DOM 结构
    const inputs = comp.querySelectorAll('.a2ui-input');
    assert.strictEqual(inputs.length, 2, '登录表单应渲染 2 个输入框 (username 与 password)');
    console.log('   ✓ 真实 WXML DOM 渲染成功，包含 2 个 .a2ui-input 节点');

    let receivedAction = null;
    comp.addEventListener('action', (evt) => {
      receivedAction = evt.detail;
    });

    // 模拟用户输入
    inputs[0].dispatchEvent('input', { detail: { value: 'alice_adventurer' } });
    inputs[1].dispatchEvent('input', { detail: { value: 'secure_password_999' } });
    await wait();

    // 校验 Engine 内部数据模型已更新
    const surface = engine.surfaces.get('gallery-simple-login-form');
    assert.strictEqual(surface.dataModel.username, 'alice_adventurer', 'username 数据模型未同步');
    assert.strictEqual(surface.dataModel.password, 'secure_password_999', 'password 数据模型未同步');
    console.log('   ✓ 逻辑层数据模型双向同步验证通过');

    // 模拟点击提交按钮
    const btn = comp.querySelector('.a2ui-btn');
    assert(btn, '提交按钮未渲染');
    btn.dispatchEvent('tap');
    await wait(40);

    assert(receivedAction, '组件未派发 action 事件');
    assert.strictEqual(receivedAction.action.name, 'login_submitted');
    assert.strictEqual(receivedAction.action.context.user, 'alice_adventurer');
    assert.strictEqual(receivedAction.action.context.pass, 'secure_password_999');
    console.log('   ✓ 点击提交触发 action 事件，动态 context 成功解析最新表单值');
  }

  // ----------------------------------------------------------------
  // 测试用例 2: 动态卡片更新 (updateComponents 增量重渲染)
  // ----------------------------------------------------------------
  console.log('\n--- [用例 2] 动态组件增量更新与局部 DOM 响应 ---');
  {
    const surfaceId = 'dynamic_surface';
    const engine = new A2UIEngine();
    engine.process([
      { createSurface: { surfaceId } },
      {
        updateComponents: {
          surfaceId,
          components: [
            { id: 'root', component: 'Column', children: ['item_1'] },
            { id: 'item_1', component: 'Text', text: 'Item 1' },
          ],
        },
      },
    ]);

    const comp = simulate.render(compId, { surfaceId });
    comp.attach(document.createElement('div'));
    comp.instance.setEngine(engine);

    let texts = comp.querySelectorAll('.a2ui-text');
    assert.strictEqual(texts.length, 1);
    console.log('   ✓ 初始单条文本节点渲染完成');

    // 动态增加 item_2
    engine.process([
      {
        updateComponents: {
          surfaceId,
          components: [
            { id: 'root', component: 'Column', children: ['item_1', 'item_2'] },
            { id: 'item_2', component: 'Text', text: 'Item 2 Added' },
          ],
        },
      },
    ]);
    await wait();

    texts = comp.querySelectorAll('.a2ui-text');
    assert.strictEqual(texts.length, 2, '增量更新后应渲染 2 个文本节点');
    console.log('   ✓ 动态 updateComponents 增量生效，DOM 成功渲染新增节点');
  }

  // ----------------------------------------------------------------
  // 测试用例 3: 复杂交互表单组件 (CheckBox / Slider / ChoicePicker Chips)
  // ----------------------------------------------------------------
  console.log('\n--- [用例 3] 复杂表单组件 (CheckBox / Slider / ChoicePicker Chips) 真实交互 ---');
  {
    const surfaceId = 'controls_surface';
    const engine = new A2UIEngine();
    engine.process([
      { createSurface: { surfaceId } },
      {
        updateDataModel: {
          surfaceId,
          data: { agreed: false, volume: 20, themeOption: 'light' },
        },
      },
      {
        updateComponents: {
          surfaceId,
          components: [
            { id: 'root', component: 'Column', children: ['agree_box', 'volume_slider', 'theme_picker'] },
            { id: 'agree_box', component: 'CheckBox', label: 'Agree to terms', checked: { '@path': '/agreed' } },
            { id: 'volume_slider', component: 'Slider', min: 0, max: 100, step: 5, value: { '@path': '/volume' } },
            {
              id: 'theme_picker',
              component: 'ChoicePicker',
              label: 'Theme',
              displayStyle: 'chips',
              value: { '@path': '/themeOption' },
              options: [
                { value: 'light', label: 'Light Mode' },
                { value: 'dark', label: 'Dark Mode' },
              ],
            },
          ],
        },
      },
    ]);

    const comp = simulate.render(compId, { surfaceId });
    comp.attach(document.createElement('div'));
    comp.instance.setEngine(engine);

    // 1. 触发 CheckBox 的 change 事件
    const checkboxGroup = comp.querySelector('.a2ui-checkbox-group');
    assert(checkboxGroup, 'CheckBoxGroup 未找到');
    checkboxGroup.dispatchEvent('change', { detail: { value: ['true'] } });
    await wait();

    const surface = engine.surfaces.get(surfaceId);
    assert.strictEqual(surface.dataModel.agreed, true, 'CheckBox 未更新为 true');
    console.log('   ✓ CheckBox change 事件触发成功，agreed=true');

    // 2. 触发 Slider 的 change 事件
    const slider = comp.querySelector('.a2ui-slider');
    assert(slider, 'Slider 未找到');
    slider.dispatchEvent('change', { detail: { value: 85 } });
    await wait();

    assert.strictEqual(surface.dataModel.volume, 85, 'Slider 未更新为 85');
    console.log('   ✓ Slider change 事件触发成功，volume=85');

    // 3. 触发 ChoicePicker Chips 点击
    const chips = comp.querySelectorAll('.a2ui-choice-chip');
    assert.strictEqual(chips.length, 2, '应渲染 2 个 ChoiceChip');
    chips[1].dispatchEvent('tap'); // 点击 Dark Mode
    await wait();

    assert.deepStrictEqual(surface.dataModel.themeOption, ['dark'], 'ChoicePicker 未更新为 [dark]');
    console.log('   ✓ ChoicePicker Chips tap 触发成功，themeOption=["dark"]');
  }

  // ----------------------------------------------------------------
  // 测试用例 4: 嵌套布局与多级组件结构 (Card / Row / Column / Divider)
  // ----------------------------------------------------------------
  console.log('\n--- [用例 4] 嵌套容器与复合结构渲染 (Card / Row / Column / Divider) ---');
  {
    const surfaceId = 'composite_surface';
    const engine = new A2UIEngine();
    engine.process([
      { createSurface: { surfaceId } },
      {
        updateComponents: {
          surfaceId,
          components: [
            { id: 'root', component: 'Card', child: 'card_col' },
            { id: 'card_col', component: 'Column', children: ['title', 'split_line', 'row_actions'] },
            { id: 'title', component: 'Text', text: 'Card Header Title' },
            { id: 'split_line', component: 'Divider' },
            { id: 'row_actions', component: 'Row', children: ['btn_cancel', 'btn_confirm'] },
            { id: 'btn_cancel', component: 'Button', label: 'Cancel', variant: 'secondary' },
            { id: 'btn_confirm', component: 'Button', label: 'Confirm', variant: 'primary' },
          ],
        },
      },
    ]);

    const comp = simulate.render(compId, { surfaceId });
    comp.attach(document.createElement('div'));
    comp.instance.setEngine(engine);

    assert(comp.querySelector('.a2ui-card'), 'Card 容器未生成');
    assert(comp.querySelector('.a2ui-divider'), 'Divider 分割线未生成');
    assert(comp.querySelector('.a2ui-row'), 'Row 横向布局未生成');
    const buttons = comp.querySelectorAll('.a2ui-btn');
    assert.strictEqual(buttons.length, 2, '应渲染 2 个按钮 (Cancel / Confirm)');
    console.log('   ✓ Card / Column / Row / Divider 复杂复合节点树渲染一致无误');
  }

  // ----------------------------------------------------------------
  // 测试用例 5: 错误防御与合法性保护
  // ----------------------------------------------------------------
  console.log('\n--- [用例 5] 无 Engine 注入时的安全边界与结构化错误防护 ---');
  {
    const comp = simulate.render(compId, { surfaceId: 'orphan_surface' });
    comp.attach(document.createElement('div'));

    let errorEvent = null;
    comp.addEventListener('error', (evt) => {
      errorEvent = evt.detail;
    });

    comp.setData({
      localRenderTree: {
        id: 'btn_orphan',
        component: 'Button',
        label: 'Orphan Button',
      },
    });

    const btn = comp.querySelector('.a2ui-btn');
    btn.dispatchEvent('tap');
    await wait();

    assert(errorEvent, '未注入 engine 时点击应安全抛出标准 error 事件');
    assert.strictEqual(errorEvent.error.code, 'EXECUTION_ERROR');
    console.log('   ✓ 结构化错误拦截有效:', errorEvent.error.message);
  }

  console.log('\n=====================================================');
  console.log('🎉 所有 miniprogram-simulate E2E 测试均 100% 通过！');
  console.log('=====================================================\n');
}

if (require.main === module) {
  runSimulateE2E().catch((err) => {
    console.error('❌ E2E 测试执行失败:', err);
    process.exit(1);
  });
}

module.exports = { runSimulateE2E };
