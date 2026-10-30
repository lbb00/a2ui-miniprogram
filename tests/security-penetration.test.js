/**
 * A2UI MiniProgram Round 4: Adversarial Security & Penetration Test Suite
 *
 * Targets RPC signaling channel, Markdown AST, Flex weights, and extended functions.
 * Tests malicious injection, boundary overflow, and hostile inputs.
 */

const assert = require('assert');
const { A2UIEngine, ErrorCodes, createRendererCapabilities } = require('../miniprogram/core/engine');
const { parseMarkdown, hasMarkdown } = require('../miniprogram/core/markdown');
const { evaluateFunction, formatCurrency, executePluralize } = require('../miniprogram/core/data-model');

console.log('================================================================');
console.log('⚔️  Running Round 4: A2UI Adversarial Security Penetration Tests');
console.log('================================================================\n');

// -------------------------------------------------------------
// [Attack Test 1] Markdown Parser: XSS injection, unclosed syntax & large text
// -------------------------------------------------------------
console.log('👉 [Attack 1/5] Penetration test Markdown parser & XSS defense');

// 1.1 Malicious script tag injection
const xssPayload1 = '**Hello** <script>alert("pwned")</script> World';
const html1 = parseMarkdown(xssPayload1);
assert.ok(!html1.includes('<script>'), 'Must defend against <script> injection');
assert.ok(html1.includes('&lt;script&gt;'), 'script tag must be escaped to entity');
assert.ok(html1.includes('<strong>Hello</strong>'), 'Valid syntax renders normally');
console.log('   ✓ 1.1 Malicious script tag safely intercepted & escaped');

// 1.2 Forged img onerror injection
const xssPayload2 = '[Claim Reward](javascript:alert(document.cookie)) <img src="x" onerror="steal()"/>';
const html2 = parseMarkdown(xssPayload2);
assert.ok(!html2.includes('javascript:'), 'Must block javascript: pseudo-protocol');
assert.ok(!html2.includes('<img'), 'Must block illegal img tag');
console.log('   ✓ 1.2 javascript: pseudo-protocol and img onerror intercepted');

// 1.3 Unclosed syntax & out-of-order markers
const brokenMarkdown = '******unclosed bold `unclosed code [unclosed link(http://example.com ~~unclosed del';
const html3 = parseMarkdown(brokenMarkdown);
assert.ok(typeof html3 === 'string', 'Unclosed syntax must not crash parser');
console.log('   ✓ 1.3 Unclosed syntax and unordered markers handled safely');

// 1.4 Large text parsing performance
const largeText = 'This is a normal paragraph with **bold text** and `inline_code()` code.\n'.repeat(1000);
const startMs = Date.now();
const htmlLarge = parseMarkdown(largeText);
const elapsedMs = Date.now() - startMs;
assert.ok(elapsedMs < 100, `Large text parsing must complete in <100ms, measured: ${elapsedMs}ms`);
console.log(`   ✓ 1.4 Large text parsing performance verified (measured: ${elapsedMs}ms)`);

// -------------------------------------------------------------
// [Attack Test 2] callRendererFunction RPC Channel: unauthorized calls
// -------------------------------------------------------------
console.log('\n👉 [Attack 2/5] Penetration test callRendererFunction client RPC channel');

const engine = new A2UIEngine();
const surfaceId = 'surf_attack_test';
engine.processMessage({
  version: 'v1.0',
  createSurface: { surfaceId }
});

// 2.1 Malicious invocation of non-existent privileged command
const rpc1 = engine.executeRendererFunction({
  surfaceId,
  functionCallId: 'call_hack_01',
  callFunction: {
    name: 'system_root_exec',
    args: { command: 'rm -rf /' }
  }
});
assert.strictEqual(rpc1.version, 'v1.0');
assert.ok(rpc1.rendererFunctionResponse.error);
assert.strictEqual(rpc1.rendererFunctionResponse.error.code, 'UNKNOWN_FUNCTION');
console.log('   ✓ 2.1 Unauthorized privileged function call intercepted');

// 2.2 Prototype pollution attempt via setStorage
const rpcProto = engine.executeRendererFunction({
  surfaceId,
  functionCallId: 'call_proto_01',
  callFunction: {
    name: 'setStorage',
    args: { key: '__proto__.hacked', value: 'yes' }
  }
});
assert.strictEqual(({}).hacked, undefined);
console.log('   ✓ 2.2 Prototype tampering via RPC intercepted');

// 2.3 openUrl malicious cross-origin scheme interception
const rpcUrlEvil = engine.executeRendererFunction({
  surfaceId,
  functionCallId: 'call_url_01',
  callFunction: {
    name: 'openUrl',
    args: { url: 'javascript:void(0)' }
  }
});
assert.ok(rpcUrlEvil.rendererFunctionResponse.error);
assert.strictEqual(rpcUrlEvil.rendererFunctionResponse.error.code, ErrorCodes.EXECUTION_ERROR);
console.log('   ✓ 2.3 openUrl malicious scheme interception verified');

// 2.4 Standard valid RPC getSystemInfo & setClipboard
const rpcSys = engine.executeRendererFunction({
  surfaceId,
  functionCallId: 'call_sys_01',
  callFunction: { name: 'getSystemInfo' }
});
assert.ok(!rpcSys.rendererFunctionResponse.error);
assert.ok(rpcSys.rendererFunctionResponse.response.screenWidth > 0);

const rpcClip = engine.executeRendererFunction({
  surfaceId,
  functionCallId: 'call_clip_01',
  callFunction: {
    name: 'setClipboard',
    args: { text: 'A2UI Token Safe' }
  }
});
assert.ok(!rpcClip.rendererFunctionResponse.error);

const rpcClipGet = engine.executeRendererFunction({
  surfaceId,
  functionCallId: 'call_clip_02',
  callFunction: { name: 'getClipboard' }
});
assert.strictEqual(rpcClipGet.rendererFunctionResponse.response.data, 'A2UI Token Safe');
console.log('   ✓ 2.4 Standard system info and clipboard RPC verified');

// -------------------------------------------------------------
// [Attack Test 3] Flex weight & ownWidth extreme boundaries
// -------------------------------------------------------------
console.log('\n👉 [Attack 3/5] Verify Flex weight boundaries and ownWidth isolation');

engine.processMessage({
  version: 'v1.0',
  updateComponents: {
    surfaceId,
    components: [
      { id: 'root', component: 'Row', children: ['w_zero', 'w_neg', 'w_huge', 'w_icon'] },
      { id: 'w_zero', component: 'Text', text: 'Zero', weight: 0 },
      { id: 'w_neg', component: 'Text', text: 'Negative', weight: -5 },
      { id: 'w_huge', component: 'Text', text: 'Huge', weight: 9999999 },
      { id: 'w_icon', component: 'Icon', name: 'star' },
    ]
  }
});

const tree = engine.getRenderTree(surfaceId);
assert.ok(tree && tree.children.length === 4);
const [cZero, cNeg, cHuge, cIcon] = tree.children;

// Weight 0
assert.strictEqual(cZero.weight, 0);
assert.ok(cZero.flexStyle.includes('flex: 0 1 0%'));

// Negative weight clamped to 0
assert.strictEqual(cNeg.weight, 0);
assert.ok(cNeg.flexStyle.includes('flex: 0 1 0%'));

// Huge weight clamped to 10000
assert.strictEqual(cHuge.weight, 10000);
assert.ok(cHuge.flexStyle.includes('flex: 10000 1 0%'));

// Icon maintains ownWidth (flex: 0 0 auto)
assert.strictEqual(cIcon.ownWidth, true);
assert.ok(cIcon.flexStyle.includes('flex: 0 0 auto'));
console.log('   ✓ 3.1 Zero weight, negative weight, large weight and ownWidth verified');

// -------------------------------------------------------------
// [Attack Test 4] Structured Error protocol reporting
// -------------------------------------------------------------
console.log('\n👉 [Attack 4/5] Verify structured Error protocol reporting');

const reportedErrors = [];
engine.onError((err) => {
  reportedErrors.push(err);
});

// Trigger UNKNOWN_COMPONENT
engine.processMessage({
  version: 'v1.0',
  updateComponents: {
    surfaceId,
    components: [
      { id: 'root', component: 'Column', children: ['bad_comp'] },
      { id: 'bad_comp', component: 'Quantum3DPortal' },
    ]
  }
});
engine.getRenderTree(surfaceId);

assert.ok(reportedErrors.length > 0, 'Must capture and report error');
const lastErr = reportedErrors[reportedErrors.length - 1];
assert.strictEqual(lastErr.version, 'v1.0');
assert.strictEqual(lastErr.error.code, ErrorCodes.UNKNOWN_COMPONENT);
assert.strictEqual(lastErr.error.surfaceId, surfaceId);
assert.ok(lastErr.error.message.includes('Quantum3DPortal'));
console.log('   ✓ 4.1 Invalid component UNKNOWN_COMPONENT error reporting verified');

// -------------------------------------------------------------
// [Attack Test 5] Multi-language plurals, currencies & capabilities
// -------------------------------------------------------------
console.log('\n👉 [Attack 5/5] Test multi-currency, plural rules and capability handshake');

// 5.1 Currency formatting boundaries
assert.strictEqual(formatCurrency(0, 'EUR'), '€0.00');
assert.strictEqual(formatCurrency(-49.5, 'GBP'), '-£49.50');
assert.strictEqual(formatCurrency(1299, 'JPY'), '¥1299.00');
assert.strictEqual(formatCurrency(88.8, 'UNKNOWN_COIN'), '$88.80');
console.log('   ✓ 5.1 Currency symbols, negatives and fallback currency verified');

// 5.2 Plural boundaries
const pluralResZero = executePluralize(0, { zero: 'no messages', one: 'one message', other: 'many messages' });
assert.strictEqual(pluralResZero, 'no messages');

const pluralResOne = executePluralize(1, { one: '1 item', other: 'many items' });
assert.strictEqual(pluralResOne, '1 item');

const pluralResMany = executePluralize(15, { one: '1 item', other: 'many items' });
assert.strictEqual(pluralResMany, 'many items');

const pluralFallback = executePluralize(99, { other: 'default items' });
assert.strictEqual(pluralFallback, 'default items');
console.log('   ✓ 5.2 Plural zero/one/other branches and fallback verified');

// 5.3 Capability handshake message
const cap = createRendererCapabilities(['https://a2ui.org/custom']);
assert.strictEqual(cap['v1.0'].supportedCatalogIds[0], 'https://a2ui.org/custom');
assert.strictEqual(cap['v1.0'].supportedCatalogIds[1], 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json');
console.log('   ✓ 5.3 Capability negotiation message generation verified');

console.log('\n================================================================');
console.log('🎉 Round 4 Adversarial Security Tests passed 100%!');
console.log('================================================================');
