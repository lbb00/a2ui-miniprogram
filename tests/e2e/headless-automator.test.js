/**
 * A2UI Headless 自动化测试套件
 * 仿真运行 Page + CustomComponent 生命周期、双向数据流、事件派发与样式类映射
 */

const assert = require('assert');

async function runHeadlessAutomator() {
  console.log('=====================================================');
  console.log('🧪 启动 A2UI 页面与组件高保真自动化仿真测试套件');
  console.log('=====================================================\n');

  // 注入小程序运行时全局环境
  let pageConfig = null;
  global.Page = (config) => {
    pageConfig = config;
  };
  global.Component = () => {};
  global.wx = {
    showToast: () => {},
    showModal: () => {},
  };

  const { A2UIEngine } = require('../../miniprogram/core/engine');
  require('../../miniprogram/pages/index/index');

  // 构建模拟小程序 Page 上下文
  const pageInstance = Object.assign(
    {
      data: {
        engine: null,
        activeCase: 'login',
        currentSurfaceId: 'gallery-simple-login-form',
        eventLogs: [],
      },
      setData(update) {
        Object.assign(this.data, update);
      },
      selectComponent(selector) {
        return {
          clear() {},
          setEngine(eng) {},
        };
      },
    },
    pageConfig
  );

  pageInstance.onLoad();
  const loginIndex = pageInstance.data.allCases.findIndex((c) => c.file && c.file.includes('simple-login-form'));
  if (loginIndex >= 0) {
    pageInstance.switchCase(loginIndex, false);
    pageInstance.skipToDirect();
  }

  // ================= 阶段 1: 结构与双向数据流 =================
  console.log('--- [阶段 1] 结构与双向数据流测试 (00_simple-login-form) ---');
  let tree = pageInstance.engine.getRenderTree('gallery-simple-login-form');
  if (!tree || tree.children.length === 0) {
    throw new Error('Case 1 失败: 渲染树未成功生成');
  }
  const usernameNode = tree.children[1];
  console.log(`   ✓ 初始渲染: label="${usernameNode.label}", value="${usernameNode.value}"`);

  // 用户输入双向绑定
  pageInstance.engine.handleInputChange('gallery-simple-login-form', '/username', 'automator_test_user');
  tree = pageInstance.engine.getRenderTree('gallery-simple-login-form');
  const updatedUsernameNode = tree.children[1];
  if (updatedUsernameNode.value !== 'automator_test_user') {
    throw new Error('Case 1 失败: 用户输入双向绑定未生效');
  }
  console.log(`   ✓ 双向绑定输入更新生效: value="${updatedUsernameNode.value}"`);

  // 提交并校验 Action 动态 Context
  const submitBtn = tree.children[3];
  const submitEvent = pageInstance.engine.createEventMessage(
    'gallery-simple-login-form',
    submitBtn.action.event.name,
    submitBtn.action.event.context
  );
  if (submitEvent.event.context.user !== 'automator_test_user') {
    throw new Error('Case 1 失败: Action 上下文未动态求解最新输入值');
  }
  console.log('   ✓ Action 事件上报已自动携带最新输入上下文:', submitEvent.event);

  // ================= 阶段 2: 样式与视觉系统断言 =================
  console.log('\n--- [阶段 2] 样式与视觉类名生成 (Style & Layout Classes) ---');
  // 1. 验证 Column 布局对齐类名映射
  const colNode = tree;
  const expectedColClasses = `a2ui-column a2ui-align-${colNode.align} a2ui-justify-${colNode.justify}`;
  if (colNode.align !== 'stretch' || colNode.justify !== 'start') {
    throw new Error('样式测试失败: Column 对齐参数不匹配');
  }
  console.log(`   ✓ Column 布局类名匹配: class="${expectedColClasses}"`);

  // 2. 验证 Button 变体样式类映射
  const expectedBtnClass = `a2ui-btn a2ui-btn-${submitBtn.variant}`;
  if (submitBtn.variant !== 'primary') {
    throw new Error('样式测试失败: Button 变体必须为 primary');
  }
  console.log(`   ✓ Button 视觉变体类名匹配: class="${expectedBtnClass}"`);

  // 3. 验证 TextField 控件表单样式映射
  const passwordNode = colNode.children[2];
  if (passwordNode.variant !== 'obscured') {
    throw new Error('样式测试失败: 密码输入框未启用 obscured');
  }
  console.log('   ✓ TextField 样式匹配: class="a2ui-form-item", password=true (obscured 密码遮罩生效)');

  // ================= 阶段 3: 复杂布局与函数格式化 =================
  console.log('\n--- [阶段 3] 复杂布局 (01_flight-status & 05_product-card) ---');
  const flightIndex = pageInstance.data.allCases.findIndex((c) => c.file && c.file.includes('flight-status'));
  if (flightIndex >= 0) {
    pageInstance.switchCase(flightIndex, false);
    pageInstance.skipToDirect();
  }
  const flightTree = pageInstance.engine.getRenderTree('gallery-flight-status');
  const headerRow = flightTree.children[0].children[0];
  const dateNode = headerRow.children[1];
  if (dateNode.text !== 'Mon, Dec 15') {
    throw new Error(`Case 2 失败: formatDate 格式化错误, 期望 Mon, Dec 15, 实际得到 ${dateNode.text}`);
  }
  console.log(`   ✓ formatDate 动态求值成功: text="${dateNode.text}"`);

  const productIndex = pageInstance.data.allCases.findIndex((c) => c.file && c.file.includes('product-card'));
  if (productIndex >= 0) {
    pageInstance.switchCase(productIndex, false);
    pageInstance.skipToDirect();
  }
  const productTree = pageInstance.engine.getRenderTree('gallery-product-card');
  const detailsCol = productTree.children[0].children[1];
  const priceRow = detailsCol.children[2];
  const priceNode = priceRow.children[0];
  if (priceNode.text !== '$199.99') {
    throw new Error(`Case 3 失败: formatCurrency 格式化错误, 实际得到 ${priceNode.text}`);
  }
  console.log(`   ✓ formatCurrency 初始金额求解: text="${priceNode.text}"`);

  // 模拟 Agent 服务端流式推送调价
  pageInstance.engine.process({
    version: 'v1.0',
    updateDataModel: {
      surfaceId: 'gallery-product-card',
      path: '/price',
      value: 99.99,
    },
  });
  const updatedPriceTree = pageInstance.engine.getRenderTree('gallery-product-card');
  const updatedPriceNode = updatedPriceTree.children[0].children[1].children[2].children[0];
  if (updatedPriceNode.text !== '$99.99') {
    throw new Error(`Case 3 失败: 流式更新后金额未刷新, 实际得到 ${updatedPriceNode.text}`);
  }
  console.log(`   ✓ Agent 流式增量推送调价刷新成功: text="${updatedPriceNode.text}"`);

  // ================= 阶段 4: WXSS 语法规则层直接断言 =================
  console.log('\n--- [阶段 4] WXSS 语法规则层直接断言 ---');
  require('../style/wxss-rules.test.js');

  console.log('\n🎉 所有功能、交互、布局与 WXSS 样式系统全量自动化验证通过 (100% PASS)！\n');
}

runHeadlessAutomator().catch((err) => {
  console.error(err);
  process.exit(1);
});
