const assert = require('assert');
const { A2UIEngine, ErrorCodes } = require('../miniprogram/core/engine');
const {
  resolveValue,
  resolveDeep,
  evaluateFunction,
  formatCurrency,
  openUrl,
} = require('../miniprogram/core/data-model');
const { parseInline, hasMarkdown, parseMarkdown } = require('../miniprogram/core/markdown');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🛡️  Running Self-Review Round 7 Architectural Hardening Tests');
console.log('================================================================\n');

// -------------------------------------------------------------
// [1] SEC-H1: ReDoS overlapping quantifiers & character classes
// -------------------------------------------------------------
console.log('👉 [1/10] Verify SEC-H1: ReDoS overlapping quantifiers static interception (\\d+\\d+X, a+a+X)');
const attackPattern1 = '\\d+\\d+\\d+\\d+\\d+\\d+\\d+\\d+X';
const attackVal1 = '1234567890123456789012345678901234567890!';
const t0 = Date.now();
const res1 = evaluateFunction('regex', { pattern: attackPattern1, value: attackVal1 });
const elapsed1 = Date.now() - t0;
assert.strictEqual(res1, false, 'Overlapping digit quantifiers must be statically intercepted');
assert.ok(elapsed1 < 50, `Interception elapsed time must be < 50ms (measured: ${elapsed1}ms)`);

const attackPattern2 = 'a+a+a+a+a+a+X';
const attackVal2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!';
const res2 = evaluateFunction('regex', { pattern: attackPattern2, value: attackVal2 });
assert.strictEqual(res2, false, 'Overlapping letter quantifiers must be statically intercepted');
console.log(`   ✓ SEC-H1 ReDoS overlapping quantifiers intercepted safely (time: ${elapsed1}ms)`);

// -------------------------------------------------------------
// [2] SEC-H2: resolveDeep circular reference & max depth guard
// -------------------------------------------------------------
console.log('👉 [2/10] Verify SEC-H2: resolveDeep circular reference & depth explosion guard');
const cyclicObj = { name: 'cyclic' };
cyclicObj.self = cyclicObj;

// Must not throw RangeError: Maximum call stack size exceeded
let cyclicResult = null;
assert.doesNotThrow(() => {
  cyclicResult = resolveDeep(cyclicObj, {});
}, 'Objects with circular references must not cause call stack overflow');
assert.strictEqual(cyclicResult.name, 'cyclic');
assert.strictEqual(cyclicResult.self, cyclicObj, 'Self reference pointer should be preserved safely');

// Deeply nested object
let deepObj = { level: 0 };
let curr = deepObj;
for (let i = 1; i <= 50; i++) {
  curr.child = { level: i };
  curr = curr.child;
}
assert.doesNotThrow(() => {
  resolveDeep(deepObj, {});
}, 'Objects exceeding max depth must be truncated safely');
console.log('   ✓ SEC-H2 resolveDeep circular reference & depth limit verified');

// -------------------------------------------------------------
// [3] BUG-H3: numeric nullish & type safety
// -------------------------------------------------------------
console.log('👉 [3/10] Verify BUG-H3: numeric empty string, null, false reject coercion');
assert.strictEqual(evaluateFunction('numeric', { value: '', min: 0, max: 100 }), false, 'Empty string must not coerce to 0');
assert.strictEqual(evaluateFunction('numeric', { value: null, min: 0, max: 100 }), false, 'null must not coerce to 0');
assert.strictEqual(evaluateFunction('numeric', { value: undefined, min: 0, max: 100 }), false, 'undefined must return false');
assert.strictEqual(evaluateFunction('numeric', { value: false, min: 0, max: 100 }), false, 'false must return false');
assert.strictEqual(evaluateFunction('numeric', { value: [], min: 0, max: 100 }), false, 'Empty array must return false');
assert.strictEqual(evaluateFunction('numeric', { value: '0', min: 0, max: 100 }), true, 'Valid numeric string "0" must return true');
assert.strictEqual(evaluateFunction('numeric', { value: 50, min: 0, max: 100 }), true, 'Valid number 50 must return true');
console.log('   ✓ BUG-H3 numeric type coercion vulnerability verified resolved');

// -------------------------------------------------------------
// [4] PROT-M1: emit VALIDATION_FAILED when surface does not exist
// -------------------------------------------------------------
console.log('👉 [4/10] Verify PROT-M1: updateComponents/updateDataModel report error on non-existent surface');
const engine = new A2UIEngine();
const caughtErrors = [];
engine.onError((err) => caughtErrors.push(err));

engine.process({
  version: 'v1.0',
  updateComponents: {
    surfaceId: 'non_existent_surface',
    components: [{ id: 'comp_1', component: 'Text', text: 'Hi' }],
  },
});
assert.strictEqual(caughtErrors.length, 1);
assert.strictEqual(caughtErrors[0].error.code, ErrorCodes.VALIDATION_FAILED);
assert.ok(caughtErrors[0].error.message.includes('not found'));

engine.process({
  version: 'v1.0',
  updateDataModel: {
    surfaceId: 'non_existent_surface',
    path: '/title',
    value: 'Hello',
  },
});
assert.strictEqual(caughtErrors.length, 2);
assert.strictEqual(caughtErrors[1].error.code, ErrorCodes.VALIDATION_FAILED);
console.log('   ✓ PROT-M1 VALIDATION_FAILED structured error reporting verified');

// -------------------------------------------------------------
// [5] SEC-M3 & BUG-M4: parseNamedArgs prototype filter & decimals clamping
// -------------------------------------------------------------
console.log('👉 [5/10] Verify SEC-M3 & BUG-M4: prototype injection guard & decimals range clamping');
const exprWithProto = '${formatCurrency(value: 100, __proto__: evil, decimals: 50)}';
const resolvedProto = resolveValue(exprWithProto, {});
// 50 is clamped to 20 without RangeError in toFixed(50)
assert.ok(typeof resolvedProto === 'string');
assert.strictEqual(Object.prototype.evil, undefined, 'Prototype chain must not be polluted');

// Negative decimals
const formattedNegDec = formatCurrency(12.345, 'USD', -2);
assert.strictEqual(formattedNegDec, '$12', 'Negative decimals must clamp to 0');
console.log('   ✓ SEC-M3 & BUG-M4 prototype filter and decimals clamping verified');

// -------------------------------------------------------------
// [6] SPEC-L1: deleteSurface string shorthand compatibility
// -------------------------------------------------------------
console.log('👉 [6/10] Verify SPEC-L1: deleteSurface string shorthand support');
engine.process({
  version: 'v1.0',
  createSurface: { surfaceId: 'surf_to_delete' },
});
assert.ok(engine.surfaces.has('surf_to_delete'));
engine.process({
  version: 'v1.0',
  deleteSurface: 'surf_to_delete',
});
assert.strictEqual(engine.surfaces.has('surf_to_delete'), false);
console.log('   ✓ SPEC-L1 deleteSurface string and object format compatibility verified');

// -------------------------------------------------------------
// [7] BUG-L2: length check supports plain objects
// -------------------------------------------------------------
console.log('👉 [7/10] Verify BUG-L2: length check counts keys on plain objects');
const objData = { a: 1, b: 2 };
assert.strictEqual(evaluateFunction('length', { value: objData, min: 2, max: 2 }), true);
assert.strictEqual(evaluateFunction('length', { value: objData, min: 3 }), false);
console.log('   ✓ BUG-L2 length check for plain objects verified');

// -------------------------------------------------------------
// [8] H1: DateTimeInput oldTree immutability and computeTreePatches delta
// -------------------------------------------------------------
console.log('👉 [8/10] Verify H1: DateTimeInput change preserves oldTree immutability and generates patches');
let registeredDef = null;
global.Component = (def) => { registeredDef = def; };
delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

const eng = new A2UIEngine();
eng.process([
  { version: 'v1.0', createSurface: { surfaceId: 'test_dt' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'test_dt',
      components: [
        { id: 'root', component: 'Column', children: ['dt_comp'] },
        { id: 'dt_comp', component: 'DateTimeInput', enableDate: true, enableTime: true, value: { '@path': '/dt' } },
      ],
    },
  },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: 'test_dt',
      path: '/dt',
      value: '2025-06-10T08:00:00Z',
    },
  },
]);

const initialTree = eng.getRenderTree('test_dt');
const instance = {
  data: {
    surfaceId: 'test_dt',
    localRenderTree: JSON.parse(JSON.stringify(initialTree)),
    uiState: {},
  },
  engine: eng,
  findNodeById: registeredDef.methods.findNodeById,
  dispatchInputEvent: registeredDef.methods.dispatchInputEvent,
  handleDateTimeChange: registeredDef.methods.handleDateTimeChange,
  triggerEvent: () => {},
  setData: function(patch, cb) {
    this._lastPatch = patch;
    if (cb) cb();
  },
};

// Trigger date change to 2025-06-15
instance.handleDateTimeChange({
  currentTarget: {
    dataset: { id: 'dt_comp', path: '/dt', part: 'date' },
  },
  detail: { value: '2025-06-15' },
});

// Verify patch includes dateValue
const patchKeys = Object.keys(instance._lastPatch || {});
assert.ok(
  patchKeys.some((k) => k.includes('dateValue')),
  `setData patches must contain dateValue update: ${JSON.stringify(instance._lastPatch)}`
);
console.log('   ✓ H1 DateTimeInput delta patches contain dateValue verified');

// -------------------------------------------------------------
// [9] H2: Modal style declaration completeness check
// -------------------------------------------------------------
console.log('👉 [9/10] Verify H2: a2ui-surface.wxss contains complete Modal core styles');
const wxssContent = fs.readFileSync(
  path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss'),
  'utf-8'
);
assert.ok(wxssContent.includes('.a2ui-modal-mask'), 'wxss must contain .a2ui-modal-mask');
assert.ok(wxssContent.includes('.a2ui-modal-box'), 'wxss must contain .a2ui-modal-box');
assert.ok(wxssContent.includes('.a2ui-modal-container'), 'wxss must contain .a2ui-modal-container');
assert.ok(wxssContent.includes('position: fixed'), 'modal mask must have fixed positioning');
assert.ok(wxssContent.includes('.a2ui-picker-box'), 'wxss must contain .a2ui-picker-box');
assert.ok(wxssContent.includes('.a2ui-tab-bar'), 'wxss must contain .a2ui-tab-bar');
console.log('   ✓ H2 Modal and Picker/Tab core styles verified');

// -------------------------------------------------------------
// [10] H3: onDeepNodeInput single element array index [0] support
// -------------------------------------------------------------
console.log('👉 [10/10] Verify H3: onDeepNodeInput resolves single element numeric array index [0]');
eng.process([
  { version: 'v1.0', createSurface: { surfaceId: 'test_cp' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'test_cp',
      components: [
        { id: 'root', component: 'Column', children: ['choice_comp'] },
        {
          id: 'choice_comp',
          component: 'ChoicePicker',
          options: [{ label: 'Option A', value: 'opt_a' }, { label: 'Option B', value: 'opt_b' }],
          value: { '@path': '/selected' },
        },
      ],
    },
  },
]);

const cpTree = eng.getRenderTree('test_cp');
let dispatchedValue = null;
const cpInstance = {
  data: {
    surfaceId: 'test_cp',
    localRenderTree: cpTree,
  },
  engine: eng,
  findNodeById: registeredDef.methods.findNodeById,
  dispatchInputEvent: (id, path, val) => { dispatchedValue = val; },
  onDeepNodeInput: registeredDef.methods.onDeepNodeInput,
};

// Deep relay emits single element array [1]
cpInstance.onDeepNodeInput({
  detail: {
    componentId: 'choice_comp',
    path: '/selected',
    value: [1],
  },
});
assert.deepStrictEqual(dispatchedValue, ['opt_b'], 'Single element index [1] must resolve to ["opt_b"]');
console.log('   ✓ H3 onDeepNodeInput single-element array [1] resolved to ["opt_b"] verified');

console.log('\n================================================================');
console.log('🎉 All 10 Self-Review Round 7 hardening tests passed 100%!');
console.log('================================================================\n');
