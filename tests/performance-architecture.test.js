/**
 * Round 11: A2UI Performance Optimization & Underlying Rendering Architecture Test Suite
 * Covers 6 core areas: P0.1, P0.2, P0.3, P1.1, P1.2, P2.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { computeTreePatches, isShallowEqual, isDeepEqual } = require('../miniprogram/core/pointer');

console.log('================================================================');
console.log('⚡ Running Round 11: Performance Optimization & Architecture Tests');
console.log('================================================================');

// ====================================================================
// [1] P0.1: Smooth input, anti-jumping, silent flag & activeComponentId
// ====================================================================
console.log('\n👉 [1/6] Verify P0.1: Smooth input, silent flag & activeComponentId cursor protection');
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

  // 1. Focus TextField
  instance.handleInputFocus({
    currentTarget: { dataset: { id: 'txt_in' } },
  });
  assert.strictEqual(instance._currentActiveInputId, 'txt_in', 'Should record active input component ID upon focus');

  // 2. Simulate dispatchInputEvent typing "a" (length < 4, disables button)
  instance.dispatchInputEvent('txt_in', '/textVal', 'a');

  // Verify: with { silent: true }, engine.notify is not redundantly triggered
  assert.strictEqual(notifyCount, 0, 'dispatchInputEvent must write back silently to prevent redundant AST recompilation');
  assert.strictEqual(engine.surfaces.get(S).dataModel.textVal, 'a', 'Data model updated');

  // Verify: activeComponentId value omitted from patches, button disabled updated incrementally
  const lastSetData = setDataCalls[setDataCalls.length - 1];
  assert.ok(lastSetData, 'Must trigger targeted setData');
  assert.strictEqual(lastSetData['localRenderTree.children[0].value'], undefined, 'Active typing field value must not be in patches');
  assert.strictEqual(lastSetData['localRenderTree.children[1].disabled'], true, 'Affected button disabled status updated incrementally');

  // 3. Simulate external renderTree update while typing
  const externalNewTree = JSON.parse(JSON.stringify(tree));
  externalNewTree.children[0].value = 'server_overwritten_val';
  externalNewTree.children[1].text = 'Submit (Updated)';

  setDataCalls = [];
  componentDef.properties.renderTree.observer.call(instance, externalNewTree);

  // Verify: active input value protected from external overwrite
  const renderTreePatch = setDataCalls[0] || {};
  assert.strictEqual(renderTreePatch['localRenderTree.children[0].value'], undefined, 'External tree must not overwrite activeInput value while typing');
  assert.strictEqual(renderTreePatch['localRenderTree.children[1].text'], 'Submit (Updated)', 'Other properties update incrementally');

  // 4. Blur handleInputBlur
  instance.handleInputBlur();
  assert.strictEqual(instance._currentActiveInputId, null, 'Must clear _currentActiveInputId on blur');

  console.log('   ✓ P0.1 silent AST avoidance, focus tracking & cursor protection verified 100%');
}

// ====================================================================
// [2] P0.2: virtualHost & WXSS deduplication
// ====================================================================
console.log('\n👉 [2/6] Verify P0.2: virtualHost option, WXSS @import removal & animation isolation');
{
  let layerDef = null;
  global.Component = (def) => { layerDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface-layer/a2ui-surface-layer.js')];
  require('../miniprogram/components/a2ui-surface-layer/a2ui-surface-layer.js');

  // 1. Check virtualHost & styleIsolation
  assert.ok(layerDef.options, 'a2ui-surface-layer must configure options');
  assert.strictEqual(layerDef.options.virtualHost, true, 'virtualHost: true must be enabled');
  assert.strictEqual(layerDef.options.styleIsolation, 'apply-shared', 'styleIsolation: apply-shared must be enabled');

  // 2. Check a2ui-surface-layer.wxss
  const layerWxssPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface-layer/a2ui-surface-layer.wxss');
  const layerWxss = fs.readFileSync(layerWxssPath, 'utf8');
  assert.ok(!layerWxss.includes('@import'), 'a2ui-surface-layer.wxss must remove @import');
  assert.ok(layerWxss.includes('display: contents'), 'a2ui-surface-layer must use display: contents');

  // 3. Check a2ui-surface.wxss animation scoped to .a2ui-surface
  const surfaceWxssPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss');
  const surfaceWxss = fs.readFileSync(surfaceWxssPath, 'utf8');
  assert.ok(!surfaceWxss.match(/:host\s*,\s*\.a2ui-surface\s*\{[^}]*animation:/), ':host must not declare animation');
  assert.ok(surfaceWxss.includes('.a2ui-surface {\n  width: 100%;\n  box-sizing: border-box;\n  animation: a2uiFadeIn'), '.a2ui-surface has entrance animation');

  console.log('   ✓ P0.2 virtualHost, WXSS deduplication & animation isolation verified 100%');
}

// ====================================================================
// [3] P0.3: Streaming batch frame scheduler (wx.nextTick / Batching)
// ====================================================================
console.log('\n👉 [3/6] Verify P0.3: Streaming batch frame scheduler');
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

  assert.strictEqual(typeof instance._scheduleFrameRender, 'function', 'Must implement _scheduleFrameRender');

  // Simulate wx.nextTick
  let scheduledTasks = [];
  global.wx = {
    nextTick(cb) {
      scheduledTasks.push(cb);
    },
  };

  let executionCount = 0;
  let finalValue = 0;

  // Simulate 10 high-frequency streaming chunks
  for (let i = 1; i <= 10; i++) {
    const val = i;
    instance._scheduleFrameRender(() => {
      executionCount++;
      finalValue = val;
    });
  }

  // Verify only 1 nextTick scheduled
  assert.strictEqual(scheduledTasks.length, 1, '10 rapid calls must register only 1 nextTick callback');
  assert.strictEqual(executionCount, 0, 'No execution prior to nextTick');

  // Simulate nextTick execution
  scheduledTasks[0]();

  assert.strictEqual(executionCount, 1, 'Batching frame scheduler executes only 1 render');
  assert.strictEqual(finalValue, 10, 'Executed final batch state');

  delete global.wx;
  console.log('   ✓ P0.3 streaming batch frame scheduler verified');
}

// ====================================================================
// [4] P1.1: Delta patch optimization (incremental arrays, immutability)
// ====================================================================
console.log('\n👉 [4/6] Verify P1.1: Delta patch optimization & immutability');
{
  // 1. isShallowEqual & isDeepEqual
  assert.strictEqual(isShallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' }), true);
  assert.strictEqual(isShallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'y' }), false);
  assert.strictEqual(isShallowEqual([1, 2, 3], [1, 2, 3]), true);
  assert.strictEqual(isShallowEqual([1, 2], [1, 2, 3]), false);

  assert.strictEqual(isDeepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } }), true);
  assert.strictEqual(isDeepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 3] } }), false);

  // 2. Array append optimization
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

  const oldTreeSnapshot = JSON.stringify(oldTree);
  const patches = computeTreePatches(oldTree, newTree, 'localRenderTree');

  // Verify: do not replace entire children array
  assert.strictEqual(patches['localRenderTree.children'], undefined, 'Must not transmit whole children array on append');

  // Verify: only index patch children[2]
  assert.deepStrictEqual(patches['localRenderTree.children[2]'], {
    id: 'c3',
    component: 'Text',
    text: 'Msg 3 (New Streaming Chunk)',
  }, 'Must transmit index patch children[2]');

  // Verify immutability
  assert.strictEqual(JSON.stringify(oldTree), oldTreeSnapshot, 'computeTreePatches must not mutate oldTree');

  console.log('   ✓ P1.1 incremental index patch & tree immutability verified');
}

// ====================================================================
// [5] P1.2: _applyTreeUpdate unified delta updating
// ====================================================================
console.log('\n👉 [5/6] Verify P1.2: _applyTreeUpdate unified delta update mechanism');
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

  // 1. Initial full render fallback
  const initialTree = { id: 'root', component: 'Column', children: [] };
  instance._applyTreeUpdate(null, initialTree, 'surf_apply');

  assert.strictEqual(setDataCalls.length, 1);
  assert.deepStrictEqual(setDataCalls[0], { localRenderTree: initialTree });
  assert.strictEqual(renderedEvents.length, 1);
  assert.strictEqual(renderedEvents[0].surfaceId, 'surf_apply');

  // 2. Incremental patches with oldTree
  setDataCalls = [];
  renderedEvents = [];
  const updatedTree = {
    id: 'root',
    component: 'Column',
    children: [{ id: 'item_1', component: 'Text', text: 'Hello' }],
  };

  instance._applyTreeUpdate(initialTree, updatedTree, 'surf_apply');

  assert.strictEqual(setDataCalls.length, 1);
  assert.ok('localRenderTree.children' in setDataCalls[0] || 'localRenderTree.children[0]' in setDataCalls[0], 'Must update via delta patches');
  assert.strictEqual(instance.data.localRenderTree, updatedTree, 'Local reference maintained');
  assert.strictEqual(renderedEvents.length, 1);

  // 3. Clear on null
  setDataCalls = [];
  instance._applyTreeUpdate(updatedTree, null, 'surf_apply');
  assert.deepStrictEqual(setDataCalls[0], { localRenderTree: null });

  console.log('   ✓ P1.2 _applyTreeUpdate full fallback & incremental patching verified');
}

// ====================================================================
// [6] P2: Media & scroll improvements (webp, enhanced scroll-view)
// ====================================================================
console.log('\n👉 [6/6] Verify P2: Image native webp and horizontal enhanced scroll-view');
{
  const tmplPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface/templates.wxml');
  const tmplContent = fs.readFileSync(tmplPath, 'utf8');

  // 1. Image webp="true"
  assert.ok(tmplContent.includes('webp="true"'), 'templates.wxml must configure webp="true" on image tags');

  // 2. Scroll-view attributes
  assert.ok(tmplContent.includes('enhanced="true"'), 'templates.wxml must configure enhanced="true" on horizontal scroll-view');
  assert.ok(tmplContent.includes('show-scrollbar="false"'), 'templates.wxml must configure show-scrollbar="false"');
  assert.ok(tmplContent.includes('fast-deceleration="true"'), 'templates.wxml must configure fast-deceleration="true"');

  console.log('   ✓ P2 webp="true" and enhanced scroll-view properties verified');
}

console.log('\n================================================================');
console.log('🎉 All 6 Round 11 performance & architecture tests passed 100%!');
console.log('================================================================\n');
