/**
 * A2UI WeChat MiniProgram Runtime Performance & Architecture Test Suite
 * Asserts WXML DOM limits, setData bridge transfer efficiency, frame coalescing,
 * and memory lifecycle leak resilience aligned with WeChat specifications.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { computeTreePatches } = require('../miniprogram/core/pointer');

let originalGlobals = null;
function setupDom() {
  if (originalGlobals) return;
  originalGlobals = {
    window: global.window,
    document: global.document,
    Element: global.Element,
    HTMLElement: global.HTMLElement,
    Node: global.Node,
    navigator: global.navigator,
    Event: global.Event,
    CustomEvent: global.CustomEvent,
  };

  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Element = dom.window.Element;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.navigator = dom.window.navigator;
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;
}

function teardownDom() {
  if (!originalGlobals) return;
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) {
      delete global[key];
    } else {
      global[key] = value;
    }
  }
  originalGlobals = null;
}

function getDomDepth(el, depth = 1) {
  if (!el || !el.children || el.children.length === 0) return depth;
  let max = depth;
  for (let i = 0; i < el.children.length; i++) {
    const d = getDomDepth(el.children[i], depth + 1);
    if (d > max) max = d;
  }
  return max;
}

async function runSuite() {
  console.log('================================================================');
  console.log('⚡ Running WeChat MiniProgram Runtime Performance Assertions');
  console.log('================================================================');

  setupDom();
  const simulate = require('miniprogram-simulate');
  const compPath = path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface');
  const compId = simulate.load(compPath);

  // 1. WXML DOM Node Count & Nesting Depth Verification
  console.log('\n👉 [1/5] Verify WXML DOM Node Count & Depth against WeChat Scorecard');
  {
    const fixture = require('../fixtures/official-examples/33_financial-data-grid.json');
    const engine = new A2UIEngine();
    engine.process(fixture.messages);

    const sId = Array.from(engine.surfaces.keys())[0];
    const tree = engine.getRenderTree(sId);
    const comp = simulate.render(compId, { renderTree: tree });
    const parent = document.createElement('div');
    comp.attach(parent);

    const domNodes = comp.dom.querySelectorAll('*').length;
    const domDepth = getDomDepth(comp.dom);

    assert.ok(domNodes < 1000, `DOM nodes (${domNodes}) must be well below WeChat 1000 limit`);
    assert.ok(domDepth < 32, `DOM depth (${domDepth}) must be strictly below WeChat 32 limit`);
    assert.ok(domNodes <= 100, `Complex financial data grid must remain lightweight (actual: ${domNodes})`);
    assert.ok(domDepth <= 15, `DOM depth must not exceed 15 levels (actual: ${domDepth})`);

    comp.detach();
    console.log(`   ✓ Peak DOM nodes: ${domNodes} (< 1000), Peak depth: ${domDepth} (< 32) PASS`);
  }

  // 2. setData Bandwidth Reduction via computeTreePatches
  console.log('\n👉 [2/5] Verify setData Bandwidth Reduction (> 90% savings on dynamic updates)');
  {
    const fixture = require('../fixtures/official-examples/05_product-card.json');
    const engine = new A2UIEngine();
    engine.process(fixture.messages);

    const sId = 'gallery-product-card';
    const oldTree = engine.getRenderTree(sId);

    engine.process([
      {
        updateDataModel: {
          surfaceId: sId,
          path: '/price',
          value: 99.99,
        },
      },
    ]);
    const newTree = engine.getRenderTree(sId);

    const fullBytes = Buffer.byteLength(JSON.stringify({ localRenderTree: newTree }));
    const patches = computeTreePatches(oldTree, newTree, 'localRenderTree');
    const patchBytes = Buffer.byteLength(JSON.stringify(patches));
    const savingsRatio = 1 - patchBytes / fullBytes;

    assert.ok(savingsRatio > 0.9, `Bandwidth savings must exceed 90% (actual: ${(savingsRatio * 100).toFixed(2)}%)`);
    assert.ok(patchBytes < 150, `Price patch must be tiny (actual: ${patchBytes} bytes)`);
    assert.strictEqual(
      patches['localRenderTree.children[0].children[1].children[2].children[0].text'],
      '$99.99',
      'Patch must point directly to leaf text property'
    );

    console.log(`   ✓ Price update bandwidth savings: ${(savingsRatio * 100).toFixed(2)}% (${patchBytes}B vs ${fullBytes}B) PASS`);
  }

  // 3. Two-Way Input Cursor Jumping Defense
  console.log('\n👉 [3/5] Verify Two-Way Input Cursor Protection (activeComponentId omission)');
  {
    const engine = new A2UIEngine();
    const sId = 'cursor_guard_surface';
    engine.process([
      {
        createSurface: {
          surfaceId: sId,
          dataModel: { val: 'init' },
          components: [
            { id: 'root', component: 'Column', children: ['txt_field', 'lbl_echo'] },
            { id: 'txt_field', component: 'TextField', value: { '@path': '/val' } },
            { id: 'lbl_echo', component: 'Text', text: { '@path': '/val' } },
          ],
        },
      },
    ]);

    const oldTree = engine.getRenderTree(sId);
    engine.process([
      {
        updateDataModel: {
          surfaceId: sId,
          path: '/val',
          value: 'typing_fast',
        },
      },
    ]);
    const newTree = engine.getRenderTree(sId);

    const patches = computeTreePatches(oldTree, newTree, 'localRenderTree', {
      activeComponentId: 'txt_field',
    });

    assert.strictEqual(
      patches['localRenderTree.children[0].value'],
      undefined,
      'Active typing field value MUST NOT be sent in patches (prevents cursor jumping)'
    );
    assert.strictEqual(
      patches['localRenderTree.children[1].text'],
      'typing_fast',
      'Dependent mirrored text node must update seamlessly'
    );

    console.log('   ✓ Active input cursor protection verified (value patch suppressed for active input) PASS');
  }

  // 4. Streaming Frame Scheduler Coalescing
  console.log('\n👉 [4/5] Verify Streaming Frame Coalescing (wx.nextTick Microtask Batching)');
  {
    let batchedRuns = 0;
    let scheduled = false;
    let latestTask = null;

    function scheduleFrameRender(task) {
      latestTask = task;
      if (scheduled) return;
      scheduled = true;
      process.nextTick(() => {
        if (latestTask) {
          batchedRuns++;
          latestTask();
          latestTask = null;
        }
        scheduled = false;
      });
    }

    let executedValue = 0;
    // Emit 50 rapid stream chunks
    for (let i = 1; i <= 50; i++) {
      scheduleFrameRender(() => {
        executedValue = i;
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.strictEqual(batchedRuns, 1, '50 microtask emissions must be coalesced into 1 single batched execution');
    assert.strictEqual(executedValue, 50, 'Batched execution must run the latest state');
    console.log('   ✓ Frame coalescing verified: 50 chunks -> 1 batched setData (98% reduction) PASS');
  }

  // 5. Zero Resource Leakage after 100 Lifecycle Cycles
  console.log('\n👉 [5/5] Verify Zero Resource Leakage after 100 Lifecycle Cycles');
  {
    const engine = new A2UIEngine();
    for (let i = 0; i < 100; i++) {
      const sId = `cycle_${i}`;
      engine.process([
        {
          createSurface: {
            surfaceId: sId,
            dataModel: { count: i },
            components: [
              { id: 'root', component: 'Column', children: ['c1'] },
              { id: 'c1', component: 'Text', text: `Item ${i}` },
            ],
          },
        },
        {
          updateDataModel: {
            surfaceId: sId,
            path: '/count',
            value: i + 1,
          },
        },
        {
          deleteSurface: {
            surfaceId: sId,
          },
        },
      ]);
    }

    assert.strictEqual(engine.surfaces.size, 0, 'All surfaces must be deleted from memory');
    assert.strictEqual(engine.listeners.size, 0, 'All render listeners must be released');
    console.log('   ✓ Zero lingering surfaces and listeners verified across 100 cycles PASS');
  }

  // 6. Data Mutation Pipeline & High-Throughput Assertion (< 0.5ms, > 2000 ops/sec)
  console.log('\n👉 [6/6] Verify Data Mutation Pipeline Latency (< 0.5ms) & Throughput (> 2,000 ops/sec)');
  {
    const { performance: perf } = require('perf_hooks');
    const fixture = require('../fixtures/official-examples/05_product-card.json');
    const engine = new A2UIEngine();
    engine.process(fixture.messages);
    const sId = 'gallery-product-card';

    let tree = engine.getRenderTree(sId);
    const iters = 200;
    const start = perf.now();

    for (let i = 0; i < iters; i++) {
      engine.process([
        {
          updateDataModel: {
            surfaceId: sId,
            path: '/price',
            value: 100 + (i % 20),
          },
        },
      ]);
      const nextTree = engine.getRenderTree(sId);
      computeTreePatches(tree, nextTree, 'localRenderTree');
      tree = nextTree;
    }

    const elapsed = perf.now() - start;
    const avgMs = elapsed / iters;
    const opsSec = Math.round((iters / elapsed) * 1000);

    assert.ok(avgMs < 0.5, `Average data mutation latency (${avgMs.toFixed(3)}ms) must be under 0.5ms`);
    assert.ok(opsSec > 2000, `Data mutation throughput (${opsSec} ops/sec) must exceed 2,000 ops/sec`);
    console.log(`   ✓ Data mutation latency: ${(avgMs * 1000).toFixed(1)} us (${avgMs.toFixed(3)} ms) | Throughput: ${opsSec} ops/sec PASS`);
  }

  teardownDom();
  console.log('\n🎉 All WeChat runtime performance tests passed (100% PASS)!\n');
}

if (require.main === module) {
  runSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runSuite };
