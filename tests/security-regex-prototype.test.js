/**
 * Adversarial Review Round 9 Hardening & Penetration Test Suite
 *
 * Verifies:
 * 1. Boundary delimiter recognition (; and _) eliminating false positives for semicolon/underscore token lists
 * 2. Unclosed character classes safely rejected by isSafeRegex
 * 3. Catastrophic ReDoS backtracking patterns blocked in < 5ms
 * 4. Deep prototype pollution defenses in setIn & updateDataModel
 * 5. String timestamp parsing and TR35 escaped quotes in formatDate / formatTR35Date
 * 6. Fenced code block parsing to <pre><code class="a2ui-code-block"> with XSS sanitization
 * 7. ChoicePicker label vs value disambiguation
 * 8. Outbound action message dispatch to external engine listeners without duplicate event bubbling
 */

const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { isSafeRegex, evaluateFunction, formatTR35Date } = require('../miniprogram/core/data-model');
const { setIn } = require('../miniprogram/core/pointer');
const { parseMarkdown, hasMarkdown } = require('../miniprogram/core/markdown');

console.log('================================================================');
console.log('⚔️  Running Round 9: Adversarial Security & Penetration Tests');
console.log('================================================================');

// =========================================================================
// [1] Semicolon & Underscore Boundary Delimiters Recognition
// =========================================================================
console.log('\n👉 [1/7] Verify semicolon and underscore boundary delimiter recognition');
{
  // 1.1 Semicolon delimiter repetition
  const semiPattern = '^([a-zA-Z0-9]+;)+$';
  assert.strictEqual(isSafeRegex(semiPattern), true, 'Semicolon delimiter pattern must be recognized as safe');
  const semiRes = evaluateFunction('regex', {
    pattern: semiPattern,
    value: 'item1;item2;item3;'
  });
  assert.strictEqual(semiRes, true, 'Semicolon list regex match must return true');

  // 1.2 Underscore delimiter (e.g. word_word_)
  const underscorePattern = '^([a-zA-Z0-9]+_)+$';
  assert.strictEqual(isSafeRegex(underscorePattern), true, 'Underscore delimiter pattern must be recognized as safe');
  const underRes = evaluateFunction('regex', {
    pattern: underscorePattern,
    value: 'token_alpha_beta_'
  });
  assert.strictEqual(underRes, true, 'Underscore boundary regex match must return true');

  // 1.3 Unclosed character class rejection (e.g. [a-z)
  assert.strictEqual(isSafeRegex('[a-z'), false, 'Unclosed character class must return false');
  assert.strictEqual(isSafeRegex('^abc['), false, 'Unclosed bracket [ must return false');

  // 1.4 High-risk ReDoS backtracking pattern strict interception (< 5ms)
  const dangerousList = [
    '^(a+a?)+$',
    '^(a?a+)+$',
    '^(a|ab)+$',
    '^(ab|a)+$',
    '^([a-z0-9]+_[a-z0-9]+)+$',
  ];
  for (const pat of dangerousList) {
    const t0 = Date.now();
    const isSafe = isSafeRegex(pat);
    const elapsed = Date.now() - t0;
    assert.strictEqual(isSafe, false, `Dangerous pattern "${pat}" must be rejected`);
    assert(elapsed < 5, `Analysis took too long: ${elapsed}ms`);
  }
  console.log('   ✓ Semicolon/underscore delimiter recognition & ReDoS interception verified');
}

// =========================================================================
// [2] Prototype Pollution Defense in setIn & updateDataModel
// =========================================================================
console.log('\n👉 [2/7] Verify setIn and updateDataModel deep prototype sanitization');
{
  // 2.1 Root replace with __proto__
  const evilPayload = JSON.parse('{"__proto__": {"injected": "hacked"}, "role": "admin", "name": "Alice"}');
  const cleanedRoot = setIn({}, [], evilPayload);
  assert.strictEqual(cleanedRoot.role, 'admin');
  assert.strictEqual(cleanedRoot.name, 'Alice');
  assert.strictEqual(Object.prototype.injected, undefined, 'Object.prototype must not be polluted');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(cleanedRoot, '__proto__'), false, '__proto__ must be filtered');

  // 2.2 Nested property with constructor / prototype
  const evilChild = JSON.parse('{"constructor": "bad", "score": 100}');
  const target = {};
  setIn(target, ['profile'], evilChild);
  assert.strictEqual(target.profile.score, 100);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(target.profile, 'constructor'), false);

  // 2.3 Simulate root injection via A2UIEngine updateDataModel
  const engine = new A2UIEngine();
  const S = 'surf_proto_test';
  engine.process({
    createSurface: { surfaceId: S, components: [{ id: 'root', component: 'Column' }] }
  });
  engine.process({
    updateDataModel: {
      surfaceId: S,
      path: '/',
      value: JSON.parse('{"__proto__": {"evil": true}, "normal": "ok"}')
    }
  });
  const model = engine.surfaces.get(S).dataModel;
  assert.strictEqual(model.normal, 'ok');
  assert.strictEqual(Object.prototype.evil, undefined, 'Prototype chain must remain clean');
  console.log('   ✓ Deep prototype sanitization in root replace and child properties verified');
}

// =========================================================================
// [3] Timestamp strings and TR35 escaped quotes in formatDate
// =========================================================================
console.log('\n👉 [3/7] Verify timestamp strings and TR35 escaped quotes');
{
  // 3.1 13-digit millisecond timestamp string
  const msTimestampStr = '1730160000000';
  const formattedMs = evaluateFunction('formatDate', { value: msTimestampStr, format: 'yyyy-MM-dd' });
  assert.strictEqual(formattedMs.length, 10, '13-digit timestamp string must format correctly');
  assert.match(formattedMs, /^\d{4}-\d{2}-\d{2}$/);

  // 3.2 10-digit second timestamp string
  const secTimestampStr = '1730160000';
  const formattedSec = evaluateFunction('formatDate', { value: secTimestampStr, format: 'yyyy-MM-dd' });
  assert.strictEqual(formattedSec.length, 10, '10-digit timestamp string must format correctly');
  assert.match(formattedSec, /^\d{4}-\d{2}-\d{2}$/);

  // 3.3 TR35 escaped quotes '' -> '
  const dateObj = new Date(2026, 9, 29, 14, 30, 0);
  const tr35Formatted = formatTR35Date(dateObj, "HH:mm 'o''clock'");
  assert.strictEqual(tr35Formatted, "14:30 o'clock", "TR35 'o''clock' must format as 14:30 o'clock");
  console.log('   ✓ Timestamp string parsing & TR35 escaped quotes verified');
}

// =========================================================================
// [4] Markdown fenced code blocks (<pre><code class="a2ui-code-block">) & XSS sanitization
// =========================================================================
console.log('\n👉 [4/7] Verify Markdown fenced code blocks & XSS defense');
{
  const mdCode = '```javascript\nconst a = 1;\nif (a < 2) {\n  console.log("hello");\n}\n```';
  assert.strictEqual(hasMarkdown(mdCode), true, 'hasMarkdown must detect fenced code blocks');
  const parsedHtml = parseMarkdown(mdCode);
  assert.ok(parsedHtml.includes('<pre class="a2ui-pre">'), 'Must contain <pre class="a2ui-pre">');
  assert.ok(parsedHtml.includes('<code class="a2ui-code-block">'), 'Must contain <code class="a2ui-code-block">');
  assert.ok(parsedHtml.includes('const a = 1;'), 'Code preserved');
  assert.ok(parsedHtml.includes('&lt; 2'), '< character must be escaped');
  assert.ok(parsedHtml.includes('&quot;hello&quot;'), 'Quotes must be escaped');

  // 4.2 Mixed paragraph and code block
  const mixedMd = 'Introductory paragraph:\n\n```python\nprint("hi")\n```\n\nConcluding summary paragraph.';
  const mixedHtml = parseMarkdown(mixedMd);
  assert.ok(mixedHtml.includes('<p>Introductory paragraph:</p>'));
  assert.ok(mixedHtml.includes('<pre class="a2ui-pre">'));
  assert.ok(mixedHtml.includes('<p>Concluding summary paragraph.</p>'));
  console.log('   ✓ Markdown code block parsing & XSS sanitization verified');
}

// =========================================================================
// [5] ChoicePicker label vs value disambiguation
// =========================================================================
console.log('\n👉 [5/7] Verify ChoicePicker disambiguation when label and value have numeric conflicts');
{
  const engine = new A2UIEngine();
  const S = 'surf_picker_disambiguation';
  engine.process({
    createSurface: {
      surfaceId: S,
      components: [
        { id: 'root', component: 'Column', children: ['picker_1'] },
        {
          id: 'picker_1',
          component: 'ChoicePicker',
          // Deliberate conflicting options: option A has label "0" value 1, option B has label "1" value 0
          options: [
            { label: '0', value: 1 },
            { label: '1', value: 0 },
          ],
          value: [0], // Select option B (value === 0)
        },
      ],
    },
  });

  const tree = engine.getRenderTree(S);
  const pickerNode = tree.children[0];
  assert.strictEqual(pickerNode.options[0].selected, false, 'Option A (value=1) must not be selected');
  assert.strictEqual(pickerNode.options[1].selected, true, 'Option B (value=0) must be selected');
  assert.strictEqual(pickerNode.selectedIndex, 1, 'selectedIndex must be 1');
  assert.strictEqual(pickerNode.displayLabel, '1', 'displayLabel must be option B label');
  console.log('   ✓ ChoicePicker option value vs label disambiguation verified');
}

// =========================================================================
// [6] Surface outbound action sync with external engine listeners
// =========================================================================
console.log('\n👉 [6/7] Verify a2ui-surface action syncs to external engine outboundListeners');
{
  let componentDef = null;
  global.Component = (def) => { componentDef = def; };
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  const engine = new A2UIEngine();
  const S = 'surf_outbound_sync';
  engine.process({
    createSurface: {
      surfaceId: S,
      components: [
        { id: 'root', component: 'Column', children: ['btn_sync'] },
        {
          id: 'btn_sync',
          component: 'Button',
          text: 'Select Seat Now',
          action: {
            event: {
              name: 'select_seat',
              context: { seat: '12A' },
            },
          },
        },
      ],
    },
  });

  const engineOutboundEvents = [];
  engine.addOutboundListener((msg) => {
    engineOutboundEvents.push(msg);
  });

  const triggeredEvents = [];
  const surfaceInstance = {
    data: { surfaceId: S, localRenderTree: engine.getRenderTree(S) },
    setData(d) { Object.assign(this.data, d); },
    triggerEvent(name, detail) {
      triggeredEvents.push({ name, detail });
    },
    findNodeById(root, id) { return root?.children?.[0]; },
  };
  Object.assign(surfaceInstance, componentDef.methods);
  surfaceInstance.setEngine(engine);

  // User taps button
  surfaceInstance.dispatchTapEvent('btn_sync');

  // 1. External engine listener receives outbound Action message
  assert.strictEqual(engineOutboundEvents.length, 1, 'External listener must receive outbound Action message');
  assert.strictEqual(engineOutboundEvents[0].action.name, 'select_seat');
  assert.strictEqual(engineOutboundEvents[0].action.context.seat, '12A');

  // 2. Component dispatches action and a2uiEvent once without duplicate bubbling
  const a2uiEvents = triggeredEvents.filter((e) => e.name === 'a2uiEvent');
  assert.strictEqual(a2uiEvents.length, 1, 'a2uiEvent must be dispatched only once');

  const actionEvents = triggeredEvents.filter((e) => e.name === 'action');
  assert.strictEqual(actionEvents.length, 1, 'action must be dispatched only once');
  console.log('   ✓ Surface action sync to engine outbound without duplicate bubbling verified');
}

// =========================================================================
// [7] email function robustness and nullish handling
// =========================================================================
console.log('\n👉 [7/7] Verify email function edge cases and parameter aliases');
{
  assert.strictEqual(evaluateFunction('email', { value: 'user@example.com' }), true);
  assert.strictEqual(evaluateFunction('email', { email: 'user@example.com' }), true);
  assert.strictEqual(evaluateFunction('email', { text: 'user@example.com' }), true);
  assert.strictEqual(evaluateFunction('email', { value: '' }), false);
  assert.strictEqual(evaluateFunction('email', { value: null }), false);
  assert.strictEqual(evaluateFunction('email', { value: undefined }), false);
  assert.strictEqual(evaluateFunction('email', { value: 'not-an-email' }), false);
  assert.strictEqual(evaluateFunction('email', { value: 'user@domain' }), false);
  console.log('   ✓ email function robustness verified');
}

console.log('\n================================================================');
console.log('🎉 All 7 Round 9 adversarial penetration tests passed 100%!');
console.log('================================================================\n');
