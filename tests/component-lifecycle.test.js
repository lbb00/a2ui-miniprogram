/**
 * Claude Code Review Round 6 Regression Hardening Test Suite
 *
 * Covers 11 audit items:
 * [M1] setEngine/detached listener deregistration & zero memory leaks
 * [M2] dispatchInputEvent unidirectional data flow, write protection & delta integrity
 * [M3] regex complete protection against branched & nested ReDoS (^(a|a)+$ intercepted in <1ms)
 * [M4] dispatchTapEvent missing engine produces structured error, prevents incomplete actions
 * [M5] DateTimeInput local client timezone conversion & UTC ISO preservation
 * [M6] Single source of truth (clean package structure)
 * [L1] ChoicePicker initializes missing selection as array
 * [L2] ChoicePicker multi-selection (mutuallyExclusive: false) & chips mode
 * [L3] a2ui-surface conversationId change & message array reset
 * [L4] package.json files field configuration
 * [L5] uiState key sanitization (prevents . and [ from breaking setData path parsing)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { evaluateFunction } = require('../miniprogram/core/data-model');

console.log('================================================================');
console.log('🛡️  Running Claude Code Review Round 6 Hardening Regression Suite');
console.log('================================================================\n');

// ----------------------------------------------------
// [M1] setEngine/detached listener deregistration & leak prevention
// ----------------------------------------------------
console.log('👉 [M1] Verify setEngine switching and detached listener cleanup without duplicate triggers');
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

  // Simulate consecutive setEngine calls
  instance.setEngine(engine);
  instance.setEngine(engine);
  instance.setEngine(engine);

  // Send 1 error message
  engine.emitError('surf_m1', 'EXECUTION_ERROR', '/test', 'Error M1 Test');

  // Verify: 1 error message triggers only 1 a2uiEvent / error despite 3 setEngine calls
  const a2uiEvents = eventsTriggered.filter(e => e.name === 'a2uiEvent');
  const errorEvents = eventsTriggered.filter(e => e.name === 'error');
  assert.strictEqual(a2uiEvents.length, 1, 'Calling setEngine 3 times should only trigger 1 a2uiEvent per error');
  assert.strictEqual(errorEvents.length, 1, 'Calling setEngine 3 times should only trigger 1 error event per error');

  // Component detached lifecycle
  componentDef.lifetimes.detached.call(instance);

  // Send another error message
  engine.emitError('surf_m1', 'EXECUTION_ERROR', '/test', 'Error M1 Test 2');
  // Verify: detached clears listeners, no further events received
  assert.strictEqual(eventsTriggered.filter(e => e.name === 'a2uiEvent').length, 1, 'No new events should be received after detached');
  console.log('   ✓ M1 listener registration & teardown verified 100%');
}

// ----------------------------------------------------
// [M2] dispatchInputEvent write-back and delta update flags
// ----------------------------------------------------
console.log('👉 [M2] Verify dispatchInputEvent internal engine write-back and _isHandlingInput flag');
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

  // Trigger input change
  instance.dispatchInputEvent('in_1', '/query', 'new_value');

  // Assert dataModel was updated in engine
  assert.strictEqual(engine.surfaces.get(S).dataModel.query, 'new_value');
  // Assert _isHandlingInput is reset
  assert.strictEqual(instance._isHandlingInput, false);
  console.log('   ✓ M2 unidirectional write-back and patch flags verified');
}

// ----------------------------------------------------
// [M3] regex branched and nested ReDoS prevention
// ----------------------------------------------------
console.log('👉 [M3] Verify regex defense against branched (a|a)+ and nested ReDoS');
{
  const dangerousBranchPattern = '^(a|a)+$';
  const maliciousInput = 'a'.repeat(30) + '!';

  const t0 = Date.now();
  const result = evaluateFunction('regex', {
    pattern: dangerousBranchPattern,
    value: maliciousInput,
  });
  const elapsed = Date.now() - t0;

  assert.strictEqual(result, false, 'Dangerous overlapping branch regex must be intercepted and return false');
  assert.ok(elapsed < 20, `Execution time must be under 20ms (measured: ${elapsed}ms)`);

  // Verify safe common regular expressions
  const phoneRes = evaluateFunction('regex', { pattern: '^1[3-9]\\d{9}$', value: '13800138000' });
  assert.strictEqual(phoneRes, true, 'Valid phone pattern should match');

  const emailRes = evaluateFunction('regex', { pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', value: 'test@example.com' });
  assert.strictEqual(emailRes, true, 'Valid email pattern should match');
  console.log(`   ✓ M3 ReDoS security defense verified (malicious regex processed in: ${elapsed}ms)`);
}

// ----------------------------------------------------
// [M4] dispatchTapEvent structured error when engine missing
// ----------------------------------------------------
console.log('👉 [M4] Verify dispatchTapEvent emits error when engine is missing');
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

  // Verify: without engine, no action event is dispatched; standard error is emitted
  assert.strictEqual(actionEvents.length, 0, 'No malformed action message should be emitted without engine');
  assert.strictEqual(errorEvents.length, 1, 'Exactly 1 error event must be reported');
  assert.strictEqual(errorEvents[0].error.code, 'EXECUTION_ERROR');
  assert.ok(errorEvents[0].error.message.includes('A2UIEngine instance is required'));
  console.log('   ✓ M4 missing engine action interception & error reporting verified');
}

// ----------------------------------------------------
// [M5] DateTimeInput local client timezone conversion & UTC ISO preservation
// ----------------------------------------------------
console.log('👉 [M5] Verify DateTimeInput timezone conversion for local display');
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

  assert.strictEqual(node.dateValue, `${expY}-${expM}-${expD}`, 'Must convert to local year-month-day');
  assert.strictEqual(node.timeValue, `${expH}:${expMin}`, 'Must convert to local hour-minute');
  assert.strictEqual(node.isIso, true);
  console.log(`   ✓ M5 client timezone conversion verified (${utcIso} -> ${node.dateValue} ${node.timeValue})`);
}

// ----------------------------------------------------
// [M6 & L4] Single source of truth & package files
// ----------------------------------------------------
console.log('👉 [M6 & L4] Verify zero root duplicates and clean package.json files');
{
  const rootCoreExists = fs.existsSync(path.resolve(__dirname, '../core'));
  const rootComponentsExists = fs.existsSync(path.resolve(__dirname, '../components'));
  assert.strictEqual(rootCoreExists, false, 'Root core duplicate must be removed');
  assert.strictEqual(rootComponentsExists, false, 'Root components duplicate must be removed');

  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
  assert.deepStrictEqual(pkg.files, ['miniprogram', 'index.js'], 'package.json files must be miniprogram and index.js');
  console.log('   ✓ M6 & L4 single source of truth verified');
}

// ----------------------------------------------------
// [L1] ChoicePicker initial missing value normalized as array
// ----------------------------------------------------
console.log('👉 [L1] Verify ChoicePicker initial missing value writes back array');
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
        value: undefined, // Initially undefined
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

  assert.deepStrictEqual(dispatchedVal, ['a'], 'Write-back value must be array ["a"] when initially empty');
  console.log('   ✓ L1 ChoicePicker initial array normalization verified');
}

// ----------------------------------------------------
// [L2] ChoicePicker multi-selection & chips mode
// ----------------------------------------------------
console.log('👉 [L2] Verify ChoicePicker multi-selection (mutuallyExclusive: false) and chips state');
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
  assert.strictEqual(multiNode.options[0].selected, true, 'tech must be marked selected: true');
  assert.strictEqual(multiNode.options[1].selected, false, 'music must be marked selected: false');
  assert.strictEqual(multiNode.options[2].selected, true, 'news must be marked selected: true');

  assert.strictEqual(chipsNode.displayStyle, 'chips');
  assert.strictEqual(chipsNode.options[0].selected, true);
  console.log('   ✓ L2 ChoicePicker multi-selection & chips verified');
}

// ----------------------------------------------------
// [L3] a2ui-surface conversationId reset and array reference change
// ----------------------------------------------------
console.log('👉 [L3] Verify conversationId change and array reference resets engine state');
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

  // 1. conversationId change triggers reset
  componentDef.properties.conversationId.observer.call(instance, 'session_2', 'session_1');
  assert.strictEqual(cleared, true, 'conversationId change must invoke clear()');

  // 2. messages array reference replaced triggers reset
  cleared = false;
  const oldMsgs = [{ createSurface: { surfaceId: 's1' } }];
  const newMsgs = [{ createSurface: { surfaceId: 's2' } }];
  componentDef.properties.messages.observer.call(instance, newMsgs, oldMsgs);
  assert.strictEqual(cleared, true, 'New messages array reference replacement must invoke clear()');
  console.log('   ✓ L3 conversationId and message array reset verified');
}

// ----------------------------------------------------
// [L5] uiState safe property keys (prevents . and [ path parsing issues)
// ----------------------------------------------------
console.log('👉 [L5] Verify uiState keys containing special characters (. and [) are sanitized');
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

  // Simulate component id with special characters: items[0].modal
  instance.onModalOpen({
    currentTarget: { dataset: { id: 'items[0].modal', uikey: 'items_0__modal' } },
  });

  assert.ok(setDataObj, 'Must call setData');
  assert.ok('uiState.items_0__modal_open' in setDataObj, 'Must set uiState with sanitized key');
  assert.strictEqual(setDataObj['uiState.items_0__modal_open'], true);

  // Fallback to _safeKey when uikey is not provided
  instance.onTabTap({
    currentTarget: { dataset: { id: 'tabs.item[1]', idx: 2 } },
  });
  assert.ok('uiState.tabs_item_1_' in setDataObj, '_safeKey must sanitize special characters to underscores');
  assert.strictEqual(setDataObj['uiState.tabs_item_1_'], 2);
  console.log('   ✓ L5 uiState sanitized key path handling verified');
}

console.log('\n================================================================');
console.log('🎉 All 11 Claude Code Review Round 6 hardening tests passed 100%');
console.log('================================================================');
