/**
 * A2UI MiniProgram Component E2E Tests via miniprogram-simulate
 * High-fidelity component mounting, WXML template unrolling, and interaction tests.
 */

const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

let originalGlobals = null;

function setupDomEnvironment() {
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
}

function teardownDomEnvironment() {
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

function sleep(ms = 40) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(predicate, timeoutMs = 1500, intervalMs = 20) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await sleep(intervalMs);
  }
  return false;
}

async function runSimulateE2E() {
  console.log('=====================================================');
  console.log('🚀 Running miniprogram-simulate Component E2E Suites');
  console.log('=====================================================\n');

  setupDomEnvironment();

  const simulate = require('miniprogram-simulate');
  const { A2UIEngine } = require('../../miniprogram/core/engine');
  const compPath = path.resolve(__dirname, '../../miniprogram/components/a2ui-surface/a2ui-surface');
  const compId = simulate.load(compPath, { rootPath: path.resolve(__dirname, '../../miniprogram') });

  try {
    // ----------------------------------------------------------------
    // Case 1: Form rendering, two-way data binding, and action dispatch
    // ----------------------------------------------------------------
    console.log('--- [Suite 1] Form rendering, two-way binding & action dispatch ---');
    {
      const fixture = require('../../fixtures/official-examples/00_simple-login-form.json');
      const engine = new A2UIEngine();
      engine.process(fixture.messages);

      const comp = simulate.render(compId, { surfaceId: 'gallery-simple-login-form' });
      const parent = document.createElement('div');
      comp.attach(parent);
      comp.instance.setEngine(engine);

      const inputs = comp.querySelectorAll('.a2ui-input');
      assert.strictEqual(inputs.length, 2, 'Login form must render 2 input fields');
      console.log('   ✓ Real WXML DOM unrolled with 2 input elements');

      let receivedAction = null;
      comp.addEventListener('action', (evt) => {
        receivedAction = evt.detail;
      });

      inputs[0].dispatchEvent('input', { detail: { value: 'alice_adventurer' } });
      inputs[1].dispatchEvent('input', { detail: { value: 'secure_password_999' } });

      const surface = engine.surfaces.get('gallery-simple-login-form');
      const synced = await waitForCondition(
        () => surface.dataModel.username === 'alice_adventurer' && surface.dataModel.password === 'secure_password_999'
      );
      assert.strictEqual(synced, true, 'Data model synchronization timed out');
      console.log('   ✓ Logic layer two-way data model binding verified');

      const btn = comp.querySelector('.a2ui-btn');
      assert(btn, 'Submit button must be rendered');
      btn.dispatchEvent('tap');

      const actionDispatched = await waitForCondition(() => receivedAction !== null);
      assert.strictEqual(actionDispatched, true, 'Action event was not dispatched');
      assert.strictEqual(receivedAction.action.name, 'login_submitted');
      assert.strictEqual(receivedAction.action.context.user, 'alice_adventurer');
      assert.strictEqual(receivedAction.action.context.pass, 'secure_password_999');
      console.log('   ✓ Tap dispatched action event with dynamically resolved context');

      comp.detach();
    }

    // ----------------------------------------------------------------
    // Case 2: Incremental updates with updateComponents
    // ----------------------------------------------------------------
    console.log('\n--- [Suite 2] Incremental updateComponents & DOM reactivity ---');
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
              { id: 'item_1', component: 'Text', text: 'Initial Item' },
            ],
          },
        },
      ]);

      const comp = simulate.render(compId, { surfaceId });
      const parent = document.createElement('div');
      comp.attach(parent);
      comp.instance.setEngine(engine);

      let texts = comp.querySelectorAll('.a2ui-text');
      assert.strictEqual(texts.length, 1);
      console.log('   ✓ Initial text node rendered');

      engine.process([
        {
          updateComponents: {
            surfaceId,
            components: [
              { id: 'root', component: 'Column', children: ['item_1', 'item_2'] },
              { id: 'item_2', component: 'Text', text: 'Appended Item' },
            ],
          },
        },
      ]);

      const updated = await waitForCondition(() => comp.querySelectorAll('.a2ui-text').length === 2);
      assert.strictEqual(updated, true, 'Incremental update failed to render second text node');
      console.log('   ✓ Incremental updateComponents rendered new DOM node');

      comp.detach();
    }

    // ----------------------------------------------------------------
    // Case 3: Interactive form controls (CheckBox, Slider, ChoicePicker)
    // ----------------------------------------------------------------
    console.log('\n--- [Suite 3] Form controls (CheckBox, Slider, ChoicePicker Chips) ---');
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
      const parent = document.createElement('div');
      comp.attach(parent);
      comp.instance.setEngine(engine);

      // 1. CheckBox change event
      const checkboxGroup = comp.querySelector('.a2ui-checkbox-group');
      assert(checkboxGroup, 'CheckBoxGroup component not found');
      checkboxGroup.dispatchEvent('change', { detail: { value: ['true'] } });

      const surface = engine.surfaces.get(surfaceId);
      const checkedSynced = await waitForCondition(() => surface.dataModel.agreed === true);
      assert.strictEqual(checkedSynced, true, 'CheckBox failed to sync to dataModel');
      console.log('   ✓ CheckBox change event handled (agreed=true)');

      // 2. Slider change event
      const slider = comp.querySelector('.a2ui-slider');
      assert(slider, 'Slider component not found');
      slider.dispatchEvent('change', { detail: { value: 85 } });

      const sliderSynced = await waitForCondition(() => surface.dataModel.volume === 85);
      assert.strictEqual(sliderSynced, true, 'Slider failed to sync to dataModel');
      console.log('   ✓ Slider change event handled (volume=85)');

      // 3. ChoicePicker Chips tap event
      const chips = comp.querySelectorAll('.a2ui-choice-chip');
      assert.strictEqual(chips.length, 2, 'ChoicePicker should render 2 chips');
      chips[1].dispatchEvent('tap');

      const chipSynced = await waitForCondition(
        () => Array.isArray(surface.dataModel.themeOption) && surface.dataModel.themeOption[0] === 'dark'
      );
      assert.strictEqual(chipSynced, true, 'ChoicePicker failed to sync selected chip');
      console.log('   ✓ ChoicePicker Chips tap handled (themeOption=["dark"])');

      comp.detach();
    }

    // ----------------------------------------------------------------
    // Case 4: Nested composite layouts (Card, Row, Column, Divider)
    // ----------------------------------------------------------------
    console.log('\n--- [Suite 4] Composite container layout unrolling ---');
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
      const parent = document.createElement('div');
      comp.attach(parent);
      comp.instance.setEngine(engine);

      assert(comp.querySelector('.a2ui-card'), 'Card container missing');
      assert(comp.querySelector('.a2ui-divider'), 'Divider missing');
      assert(comp.querySelector('.a2ui-row'), 'Row container missing');
      const buttons = comp.querySelectorAll('.a2ui-btn');
      assert.strictEqual(buttons.length, 2, 'Two action buttons expected');
      console.log('   ✓ Card / Column / Row / Divider unrolled consistently');

      comp.detach();
    }

    // ----------------------------------------------------------------
    // Case 5: Defense boundary when unattached to engine
    // ----------------------------------------------------------------
    console.log('\n--- [Suite 5] Defense boundary without engine injection ---');
    {
      const comp = simulate.render(compId, { surfaceId: 'orphan_surface' });
      const parent = document.createElement('div');
      comp.attach(parent);

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

      const errorCaught = await waitForCondition(() => errorEvent !== null);
      assert.strictEqual(errorCaught, true, 'Error event should be emitted without engine');
      assert.strictEqual(errorEvent.error.code, 'EXECUTION_ERROR');
      console.log('   ✓ Structured error successfully intercepted without engine');

      comp.detach();
    }

    console.log('\n=====================================================');
    console.log('🎉 All miniprogram-simulate E2E suites passed (100%)');
    console.log('=====================================================\n');
  } finally {
    teardownDomEnvironment();
  }
}

if (require.main === module) {
  runSimulateE2E().catch((err) => {
    console.error('❌ Simulate E2E execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runSimulateE2E };
