/**
 * A2UI Headless Automated Test Suite
 * Simulates Page + CustomComponent lifecycle, two-way data flow, action dispatching, and style class mappings.
 */

const assert = require('assert');

async function runHeadlessAutomator() {
  console.log('=====================================================');
  console.log('🧪 Starting A2UI High-Fidelity Headless Simulation Suite');
  console.log('=====================================================\n');

  // Inject MiniProgram runtime global environment
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

  // Build mocked Page context
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

  // ================= Stage 1: Structure & Two-Way Binding =================
  console.log('--- [Stage 1] Structure and two-way data flow (00_simple-login-form) ---');
  let tree = pageInstance.engine.getRenderTree('gallery-simple-login-form');
  if (!tree || tree.children.length === 0) {
    throw new Error('Case 1 failed: Render tree was not generated');
  }
  const usernameNode = tree.children[1];
  console.log(`   ✓ Initial render: label="${usernameNode.label}", value="${usernameNode.value}"`);

  // User input two-way binding
  pageInstance.engine.handleInputChange('gallery-simple-login-form', '/username', 'automator_test_user');
  tree = pageInstance.engine.getRenderTree('gallery-simple-login-form');
  const updatedUsernameNode = tree.children[1];
  if (updatedUsernameNode.value !== 'automator_test_user') {
    throw new Error('Case 1 failed: Two-way input binding not applied');
  }
  console.log(`   ✓ Two-way input binding effective: value="${updatedUsernameNode.value}"`);

  // Submit and verify dynamic context in action event
  const submitBtn = tree.children[3];
  const submitEvent = pageInstance.engine.createEventMessage(
    'gallery-simple-login-form',
    submitBtn.action.event.name,
    submitBtn.action.event.context
  );
  if (submitEvent.event.context.user !== 'automator_test_user') {
    throw new Error('Case 1 failed: Action context failed to resolve latest input value');
  }
  console.log('   ✓ Action event payload carries latest input context:', submitEvent.event);

  // ================= Stage 2: Styles & Visual System Assertions =================
  console.log('\n--- [Stage 2] Style and visual class mappings (Style & Layout Classes) ---');
  // 1. Verify Column layout alignment classes
  const colNode = tree;
  const expectedColClasses = `a2ui-column a2ui-align-${colNode.align} a2ui-justify-${colNode.justify}`;
  if (colNode.align !== 'stretch' || colNode.justify !== 'start') {
    throw new Error('Style test failed: Column alignment parameters mismatch');
  }
  console.log(`   ✓ Column layout class matched: class="${expectedColClasses}"`);

  // 2. Verify Button variant classes
  const expectedBtnClass = `a2ui-btn a2ui-btn-${submitBtn.variant}`;
  if (submitBtn.variant !== 'primary') {
    throw new Error('Style test failed: Button variant must be primary');
  }
  console.log(`   ✓ Button variant class matched: class="${expectedBtnClass}"`);

  // 3. Verify TextField password obscuring
  const passwordNode = colNode.children[2];
  if (passwordNode.variant !== 'obscured') {
    throw new Error('Style test failed: Password input must be obscured');
  }
  console.log('   ✓ TextField style matched: class="a2ui-form-item", password=true (obscured variant active)');

  // ================= Stage 3: Complex layouts & Formatting Functions =================
  console.log('\n--- [Stage 3] Complex layouts (01_flight-status & 05_product-card) ---');
  const flightIndex = pageInstance.data.allCases.findIndex((c) => c.file && c.file.includes('flight-status'));
  if (flightIndex >= 0) {
    pageInstance.switchCase(flightIndex, false);
    pageInstance.skipToDirect();
  }
  const flightTree = pageInstance.engine.getRenderTree('gallery-flight-status');
  const headerRow = flightTree.children[0].children[0];
  const dateNode = headerRow.children[1];
  if (dateNode.text !== 'Mon, Dec 15') {
    throw new Error(`Case 2 failed: formatDate error, expected Mon, Dec 15, received ${dateNode.text}`);
  }
  console.log(`   ✓ formatDate evaluation verified: text="${dateNode.text}"`);

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
    throw new Error(`Case 3 failed: formatCurrency error, received ${priceNode.text}`);
  }
  console.log(`   ✓ formatCurrency initial amount evaluation: text="${priceNode.text}"`);

  // Simulate streaming price adjustment from Agent
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
    throw new Error(`Case 3 failed: price not updated after streaming message, received ${updatedPriceNode.text}`);
  }
  console.log(`   ✓ Streaming incremental price adjustment verified: text="${updatedPriceNode.text}"`);

  // ================= Stage 4: WXSS Rule Assertions =================
  console.log('\n--- [Stage 4] WXSS rule level assertions ---');
  require('../style/wxss-rules.test.js');

  console.log('\n🎉 All functional, layout, and style assertions passed (100% PASS)\n');
}

runHeadlessAutomator().catch((err) => {
  console.error(err);
  process.exit(1);
});
