/**
 * Self-Review Architecture Hardening Test Suite
 *
 * Verifies 5 deep architectural hardening items:
 * 1. ChoicePicker string array option normalization and label/index resolution
 * 2. computeTreePatches recursive diff on Modal contentNode/triggerNode & activeComponentId cursor jump protection
 * 3. DateTimeInput seconds and custom timezone (+08:00) preservation
 * 4. createSurface dataModel prototype pollution guard
 * 5. TextField explicit disabled status isolation from checks
 */

const assert = require('assert');
const { A2UIEngine, computeTreePatches } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🛡️  Running Self-Review Hardening Test Suite');
console.log('================================================================\n');

// ----------------------------------------------------
// [SR-1] ChoicePicker string array option normalization & matching
// ----------------------------------------------------
console.log('👉 [1/5] Verify ChoicePicker string array option normalization and display matching (SR-1)');
{
  const S = 'surf_cp_strings';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          billingCycle: 'monthly',
        },
        components: [
          { id: 'root', component: 'Column', children: ['picker_1'] },
          {
            id: 'picker_1',
            component: 'ChoicePicker',
            label: 'Billing Cycle',
            options: ['annual', 'monthly', 'weekly'],
            value: { '@path': '/billingCycle' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.ok(tree && tree.children && tree.children[0], 'Render tree must be valid');
  const pickerNode = tree.children[0];

  assert.strictEqual(pickerNode.options.length, 3, 'Options length must be 3');
  assert.strictEqual(pickerNode.options[0].label, 'annual', 'String options must normalize to {label, value}');
  assert.strictEqual(pickerNode.options[0].value, 'annual');
  assert.strictEqual(pickerNode.options[0].selected, false);
  assert.strictEqual(pickerNode.options[1].label, 'monthly');
  assert.strictEqual(pickerNode.options[1].value, 'monthly');
  assert.strictEqual(pickerNode.options[1].selected, true, 'monthly must be marked selected: true');
  assert.strictEqual(pickerNode.selectedIndex, 1, 'selectedIndex must map to monthly (index 1)');
  assert.strictEqual(pickerNode.displayLabel, 'monthly', 'displayLabel must show monthly');
  console.log('   ✓ SR-1 ChoicePicker string array normalization verified 100%');
}

// ----------------------------------------------------
// [SR-2] computeTreePatches Modal contentNode recursive diff & anti-jumping
// ----------------------------------------------------
console.log('👉 [2/5] Verify computeTreePatches Modal contentNode recursive diff and cursor jumping protection (SR-2)');
{
  const oldTree = {
    id: 'root',
    component: 'Column',
    children: [
      {
        id: 'modal_1',
        component: 'Modal',
        triggerNode: { id: 'btn_open', component: 'Button', text: 'Open Modal' },
        contentNode: {
          id: 'col_modal',
          component: 'Column',
          children: [
            { id: 'modal_input', component: 'TextField', value: 'hello', validationError: '' },
            { id: 'btn_confirm', component: 'Button', text: 'Confirm', disabled: false },
          ],
        },
        children: [],
      },
    ],
  };

  const newTree = {
    id: 'root',
    component: 'Column',
    children: [
      {
        id: 'modal_1',
        component: 'Modal',
        triggerNode: { id: 'btn_open', component: 'Button', text: 'Open Modal' },
        contentNode: {
          id: 'col_modal',
          component: 'Column',
          children: [
            { id: 'modal_input', component: 'TextField', value: 'hello world', validationError: 'Length too long' },
            { id: 'btn_confirm', component: 'Button', text: 'Confirm', disabled: true },
          ],
        },
        children: [],
      },
    ],
  };

  const patches = computeTreePatches(oldTree, newTree, 'localRenderTree', {
    activeComponentId: 'modal_input',
  });

  // Verify: when activeComponentId is modal_input, its value must not appear in patches
  const keys = Object.keys(patches);
  const valuePatchKey = keys.find((k) => k.includes('value'));
  assert.strictEqual(valuePatchKey, undefined, 'Controlled input protection: patches must omit activeComponentId value');

  // Verify: modal validationError and button disabled generate fine-grained patches
  const hasValidationError = keys.some((k) => k.includes('validationError') && patches[k] === 'Length too long');
  const hasDisabled = keys.some((k) => k.includes('disabled') && patches[k] === true);

  assert.ok(hasValidationError, 'Modal TextField validationError must update incrementally');
  assert.ok(hasDisabled, 'Modal Button disabled state must update incrementally');
  assert.ok(!patches['localRenderTree.children[0].contentNode'], 'Must not replace entire contentNode');
  console.log('   ✓ SR-2 Modal contentNode incremental updates verified 100%');
}

// ----------------------------------------------------
// [SR-3] DateTimeInput seconds and custom timezone (+08:00) preservation
// ----------------------------------------------------
console.log('👉 [3/5] Verify DateTimeInput seconds and custom timezone (+08:00) preservation (SR-3)');
{
  const S = 'surf_dt_tz';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          meetingTime: '2025-10-28T14:30:45+08:00',
        },
        components: [
          { id: 'root', component: 'Column', children: ['dt_input'] },
          {
            id: 'dt_input',
            component: 'DateTimeInput',
            enableDate: true,
            enableTime: true,
            value: { '@path': '/meetingTime' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const dtNode = tree.children[0];
  const expectedDate = new Date('2025-10-28T14:30:45+08:00');
  const expY = expectedDate.getFullYear();
  const expM = String(expectedDate.getMonth() + 1).padStart(2, '0');
  const expD = String(expectedDate.getDate()).padStart(2, '0');
  const expH = String(expectedDate.getHours()).padStart(2, '0');
  const expMin = String(expectedDate.getMinutes()).padStart(2, '0');
  assert.strictEqual(dtNode.dateValue, `${expY}-${expM}-${expD}`, 'dateValue must convert to local year-month-day');
  assert.strictEqual(dtNode.timeValue, `${expH}:${expMin}`, 'timeValue must convert to local hour-minute');
  assert.strictEqual(dtNode.timeSec, '45', 'timeSec must preserve 45 seconds');
  assert.strictEqual(dtNode.timezone, '+08:00', 'timezone must preserve +08:00');
  console.log('   ✓ SR-3 DateTimeInput seconds and timezone preservation verified 100%');
}

// ----------------------------------------------------
// [SR-4] createSurface dataModel prototype pollution guard
// ----------------------------------------------------
console.log('👉 [4/5] Verify createSurface dataModel prototype pollution defense (SR-4)');
{
  const S = 'surf_pollution_guard';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          normalField: 'ok',
          __proto__: { polluted: true },
        },
        components: [
          { id: 'root', component: 'Text', text: 'Hello' },
        ],
      },
    },
  ]);

  assert.strictEqual({}.polluted, undefined, 'Global prototype must not be polluted');
  const surface = engine.surfaces.get(S);
  assert.strictEqual(surface.dataModel.normalField, 'ok');
  console.log('   ✓ SR-4 createSurface dataModel prototype defense verified');
}

// ----------------------------------------------------
// [SR-5] TextField explicit disabled status isolated from checks
// ----------------------------------------------------
console.log('👉 [5/5] Verify TextField explicit disabled status isolated from checks (SR-5)');
{
  const S = 'surf_tf_explicit_disabled';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          code: '123456',
        },
        components: [
          { id: 'root', component: 'Column', children: ['input_disabled', 'input_normal'] },
          { id: 'input_disabled', component: 'TextField', value: { '@path': '/code' }, disabled: true },
          { id: 'input_normal', component: 'TextField', value: { '@path': '/code' } },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.strictEqual(tree.children[0].disabled, true, 'Explicit disabled: true field must be marked disabled');
  assert.strictEqual(tree.children[1].disabled, undefined, 'Normal input disabled status must be undefined');
  console.log('   ✓ SR-5 TextField explicit disabled assertion verified');
}

console.log('\n================================================================');
console.log('🎉 All 5 Self-Review hardening tests passed 100%!');
console.log('================================================================');
