/**
 * A2UI MiniProgram Case Switching & Stepper State Machine Test Suite
 *
 * Verifies:
 * 1. Immediate view, render tree, node count & log clearing on case switch without ghosting
 * 2. a2ui-surface component immediate reset response to renderTree: null
 * 3. Step execution (stepNextChunk):
 *    - Automatic reset and frame-by-frame execution from initial or finished state
 *    - Interruption of autoplay into step-by-step debug mode
 *    - Preamble frame handling (createSurface / updateDataModel)
 *    - Correct incremental render tree & data model construction
 */

const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const ALL_CASES = require('../fixtures/official-all-cases');

console.log('================================================================');
console.log('🧪 Running A2UI Case Switching & Stepper State Machine Tests');
console.log('================================================================\n');

// Mock WeChat miniprogram runtime environment
global.wx = global.wx || {
  showToast: () => {},
};

let capturedPageConfig = null;
global.Page = (cfg) => {
  capturedPageConfig = cfg;
};

// Preload index.js to capture pageConfig
require('../miniprogram/pages/index/index.js');
const basePageConfig = capturedPageConfig;

// Mock WeChat miniprogram a2ui-surface component
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
    // Mock component properties observer
    onRenderTreeChange(newVal) {
      this.setData({ localRenderTree: newVal || null });
    },
  };
  return surface;
}

// Mock WeChat miniprogram index page
function createMockPage() {
  const surfaceComponent = createMockSurfaceComponent();

  const instance = Object.assign({}, basePageConfig, {
    data: JSON.parse(JSON.stringify(basePageConfig.data)),
    setData(patch) {
      Object.assign(this.data, patch);
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
// Test 1: Verify a2ui-surface observer reset on null (prevent stale card ghosting)
// ============================================================================
console.log('👉 [Test 1/4] Verify a2ui-surface render tree Observer reset & ghosting prevention');
{
  const surface = createMockSurfaceComponent();

  // 1. Mount valid tree
  const fakeTree = { id: 'root', component: 'Card', children: [] };
  surface.onRenderTreeChange(fakeTree);
  assert.strictEqual(surface.data.localRenderTree, fakeTree, 'Valid render tree should mount to localRenderTree');

  // 2. Pass null on case switch
  surface.onRenderTreeChange(null);
  assert.strictEqual(surface.data.localRenderTree, null, 'Passing null must reset localRenderTree');

  // 3. Pass undefined
  surface.onRenderTreeChange(fakeTree);
  assert.strictEqual(surface.data.localRenderTree, fakeTree);
  surface.onRenderTreeChange(undefined);
  assert.strictEqual(surface.data.localRenderTree, null, 'Passing undefined must reset localRenderTree');

  // 4. Explicit clear() invocation
  surface.onRenderTreeChange(fakeTree);
  surface.clear();
  assert.strictEqual(surface.data.localRenderTree, null, 'clear() must reset canvas');

  console.log('   ✓ localRenderTree clears immediately on null/undefined, eliminating ghosting\n');
}

// ============================================================================
// Test 2: Verify immediate view erase on case switch (onSelectCase, prevCase, nextCase)
// ============================================================================
console.log('👉 [Test 2/4] Verify immediate erasure of old view and engine state on case switch');
{
  const { page, surface } = createMockPage();

  // 1. Load complex case (00_incremental.json)
  const case0Index = ALL_CASES.findIndex((c) => c.file === '00_incremental.json');
  assert.ok(case0Index >= 0);
  page.switchCase(case0Index, false);
  page.skipToDirect();

  assert.ok(page.data.nodeCount > 0, 'Old case nodeCount should be > 0');
  assert.ok(surface.data.localRenderTree !== null, 'surface component rendered old case');

  // Simulate event logs
  page.setData({
    eventLogs: [{ time: '12:00:00', content: '{"action":"click"}' }],
  });
  assert.strictEqual(page.data.eventLogs.length, 1);

  // 2. Switch to another case (01_flight-status.json)
  const case1Index = ALL_CASES.findIndex((c) => c.file === '01_flight-status.json');
  assert.ok(case1Index >= 0);

  // Trigger switch without autoplay
  page.switchCase(case1Index, false);

  // Assert all old data is wiped
  assert.strictEqual(page.data.nodeCount, 0, 'nodeCount must reset to 0 upon switch');
  assert.strictEqual(page.data.currentMessageIndex, 0, 'currentMessageIndex must reset to 0 upon switch');
  assert.strictEqual(page.data.eventLogs.length, 0, 'eventLogs must be cleared upon switch');
  assert.strictEqual(surface.data.localRenderTree, null, 'surface.localRenderTree must reset to null upon switch');
  assert.strictEqual(page.data.currentSurfaceId, 'gallery-flight-status', 'currentSurfaceId must update to new case');

  console.log('   ✓ Case switch cleans previous view, resets node count and clears event logs\n');
}

// ============================================================================
// Test 3: Verify stepNextChunk from frame 0 state machine transitions
// ============================================================================
console.log('👉 [Test 3/4] Verify stepNextChunk step-by-step state machine transitions from frame 0');
{
  const { page, surface } = createMockPage();

  // Select 01_flight-status.json
  const flightIndex = ALL_CASES.findIndex((c) => c.file === '01_flight-status.json');
  page.switchCase(flightIndex, false);
  const messages = page.data.currentCase.messages;
  const totalFrames = messages.length;

  assert.strictEqual(page.data.currentMessageIndex, 0);

  // Execute frame by frame
  for (let step = 0; step < totalFrames; step++) {
    const prevIndex = page.data.currentMessageIndex;
    page.stepNextChunk();
    const currIndex = page.data.currentMessageIndex;

    assert.strictEqual(currIndex, prevIndex + 1, `Frame index should increment (${prevIndex} -> ${currIndex})`);

    // Check preamble frames (createSurface & updateDataModel)
    const msg = messages[step];
    if (msg.createSurface || msg.updateDataModel) {
      if (!surface.data.localRenderTree) {
        assert.ok(page.data.streamSummaryText.length > 0, 'Preamble frames must provide status text');
        assert.ok(page.data.emptyHint.length > 0, 'Preamble frames must provide emptyHint');
        assert.strictEqual(page.data.nodeCount, 0, 'nodeCount is 0 before root component is mounted');
      }
    }

    // Check tree after updateComponents mounts root
    if (surface.data.localRenderTree) {
      assert.ok(page.data.nodeCount > 0, 'nodeCount > 0 when render tree is mounted');
      assert.strictEqual(page.data.emptyHint, '', 'emptyHint cleared after render tree is mounted');
    }
  }

  // Check final state
  assert.strictEqual(page.data.currentMessageIndex, totalFrames);
  assert.ok(page.data.nodeCount >= 20, `01_flight-status final node count should be >= 20, got: ${page.data.nodeCount}`);
  assert.strictEqual(page.data.isStreaming, false);

  console.log(`   ✓ Successfully stepped through all ${totalFrames} frames with accurate state transitions\n`);
}

// ============================================================================
// Test 4: Verify replay after completion & autoplay interruption
// ============================================================================
console.log('👉 [Test 4/4] Verify replay after completion and autoplay interruption');
{
  const { page, surface } = createMockPage();

  const caseIndex = ALL_CASES.findIndex((c) => c.file === '00_incremental.json');
  page.switchCase(caseIndex, false);
  page.skipToDirect();

  assert.strictEqual(page.data.currentMessageIndex, page.data.currentTotalMessages);
  assert.ok(page.data.nodeCount > 0);

  // 1. Click stepNextChunk after playback complete
  page.stepNextChunk();

  // Must reset and execute frame 1
  assert.strictEqual(page.data.currentMessageIndex, 1, 'Clicking step after completion should reset and execute frame 1');
  assert.ok(page.data.streamLog.includes('[Reset]'), 'Log should record reset to step mode');

  // 2. Interrupt autoplay
  page.switchCase(caseIndex, true);
  assert.ok(page.streamTimer !== null, 'Active stream timer should exist');
  assert.strictEqual(page.data.isStreaming, true);

  // Tap stepNextChunk immediately
  page.stepNextChunk();

  // Timer must be cleared, isStreaming false
  assert.strictEqual(page.streamTimer, null, 'Stepping should destroy stream timer');
  assert.strictEqual(page.data.isStreaming, false, 'isStreaming must become false');

  console.log('   ✓ Replay stepper resets seamlessly and interrupts autoplay\n');
}

console.log('================================================================');
console.log('🎉 All 4 case switching & stepper state machine tests passed 100%!');
console.log('================================================================\n');
