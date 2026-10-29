/**
 * Adversarial Review Round 10 Hardening & Verification Test Suite
 *
 * Verifies fixes for:
 * 1. Markdown link URL sanitization without double escaping ampersands (&amp;amp;)
 * 2. findCloseBrace escaped backslash parity with parseNamedArgs
 * 3. Positional single argument fallback in interpolation (e.g., not(/flag), required(/email))
 * 4. A2UIEngine registerCustomComponent alias and registerComponent
 * 5. engine.process() return values for both UI lifecycle and RPC execution
 * 6. callRendererFunction optional surfaceId and handler custom error code preservation
 * 7. ChoicePicker with zero, false, and numeric values
 * 8. Deep nesting through a2ui-surface-layer trampoline (> 8 levels)
 */

const assert = require('assert');
const { A2UIEngine, ErrorCodes } = require('../miniprogram/core/engine');
const { evaluateFunction, resolveValue, isSafeRegex } = require('../miniprogram/core/data-model');
const { parseMarkdown } = require('../miniprogram/core/markdown');

console.log('================================================================');
console.log('⚔️  Running Round 10: Adversarial Security & Consistency Test Suite');
console.log('================================================================\n');

// =========================================================================
// [1] Markdown link URL query parameters without double escaping (&amp;amp;)
// =========================================================================
console.log('👉 [1/8] Verify Markdown link multi-parameter URL sanitization without double escaping');
{
  const mdText = 'Click [Auth Center](https://example.com/oauth/authorize?client_id=123&redirect_uri=https://app.com/cb&scope=read&state=xyz)';
  const html = parseMarkdown(mdText);

  // Must not have double escaping &amp;amp;
  assert.strictEqual(html.includes('&amp;amp;'), false, 'URL ampersands must not be double escaped to &amp;amp;');
  assert.ok(html.includes('href="https://example.com/oauth/authorize?client_id=123&amp;redirect_uri=https://app.com/cb&amp;scope=read&amp;state=xyz"'), 'URL ampersand should be single escaped as &amp;');

  // Dangerous protocol interception
  const maliciousMd = '[Malicious Link](javascript:alert(1)) and [Data Protocol](data:text/html,<script>alert(1)</script>)';
  const safeHtml = parseMarkdown(maliciousMd);
  assert.ok(safeHtml.includes('data-href="#"'), 'javascript: pseudo-protocol must be downgraded to #');
  assert.strictEqual(safeHtml.includes('javascript:'), false, 'Output HTML must never contain javascript:');
  console.log('   ✓ Markdown URL query parameters & XSS defense verified');
}

// =========================================================================
// [2] findCloseBrace escaped backslash parity with parseNamedArgs
// =========================================================================
console.log('\n👉 [2/8] Verify findCloseBrace and parseNamedArgs escaped backslashes');
{
  // String literal containing consecutive even backslashes representing an escaped backslash
  const exprWithEscapedBs = 'prefix ${formatString(value: "hello\\\\")} suffix';
  const resolved = resolveValue(exprWithEscapedBs, {});
  assert.strictEqual(resolved, 'prefix hello\\ suffix', 'Even backslashes should be identified as non-escaping close quote');

  // Positional single arg with even backslashes
  const exprPositionalBs = '${formatString("test\\\\")}';
  const resolvedPos = resolveValue(exprPositionalBs, {});
  assert.strictEqual(resolvedPos, 'test\\', 'Single positional argument with escaped backslash should resolve correctly');
  console.log('   ✓ Escaped backslash detection & brace parsing verified');
}

// =========================================================================
// [3] Positional single argument defaults to 'value'
// =========================================================================
console.log('\n👉 [3/8] Verify ${func(path)} single positional argument defaults to value');
{
  const dataModel = {
    isRegistered: false,
    isAdmin: true,
    email: 'test@example.com',
    emptyStr: '',
    count: 10,
    timestamp: 1730160000000,
  };

  // not(/isRegistered) -> true
  const notRes = resolveValue('${not(/isRegistered)}', dataModel);
  assert.strictEqual(notRes, 'true', 'not(/isRegistered) must map /isRegistered to value');

  // not(/isAdmin) -> false
  const notAdminRes = resolveValue('${not(/isAdmin)}', dataModel);
  assert.strictEqual(notAdminRes, 'false', 'not(/isAdmin) must evaluate to false');

  // required(/email) -> true
  const reqEmail = resolveValue('${required(/email)}', dataModel);
  assert.strictEqual(reqEmail, 'true', 'required(/email) must evaluate to true');

  // required(/emptyStr) -> false
  const reqEmpty = resolveValue('${required(/emptyStr)}', dataModel);
  assert.strictEqual(reqEmpty, 'false', 'required(/emptyStr) must evaluate to false');

  // formatDate(/timestamp) -> 2024-xx-xx
  const dateFormatted = resolveValue('${formatDate(/timestamp)}', dataModel);
  assert.match(dateFormatted, /^\d{4}-\d{2}-\d{2}$/, 'formatDate(/timestamp) single arg should output ISO date');

  console.log('   ✓ Single positional argument mapping to value verified');
}

// =========================================================================
// [4] A2UIEngine.registerCustomComponent and registerComponent aliases
// =========================================================================
console.log('\n👉 [4/8] Verify A2UIEngine custom component registration dual aliases');
{
  const engine = new A2UIEngine();
  assert.strictEqual(typeof engine.registerComponent, 'function');
  assert.strictEqual(typeof engine.registerCustomComponent, 'function');

  // Register through both aliases
  engine.registerComponent('MapMarker');
  engine.registerCustomComponent('AudioWave');

  assert.ok(engine.customComponents.has('MapMarker'));
  assert.ok(engine.customComponents.has('AudioWave'));

  // Registered custom component should not trigger UNKNOWN_COMPONENT
  let errorTriggered = false;
  engine.addErrorListener((e) => {
    if (e.error && e.error.code === 'UNKNOWN_COMPONENT') {
      errorTriggered = true;
    }
  });

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_custom',
        components: [
          { id: 'root', component: 'Column', children: ['m1', 'a1'] },
          { id: 'm1', component: 'MapMarker' },
          { id: 'a1', component: 'AudioWave' },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree('surf_custom');
  assert.ok(tree);
  assert.strictEqual(tree.children.length, 2);
  assert.strictEqual(errorTriggered, false, 'Registered custom component should not trigger error');
  console.log('   ✓ registerCustomComponent and registerComponent aliases verified');
}

// =========================================================================
// [5] engine.process() return value contracts & batch processing
// =========================================================================
console.log('\n👉 [5/8] Verify engine.process() return values for surfaceId or RPC result');
{
  const engine = new A2UIEngine();

  // 1. Single surface message -> returns surfaceId string
  const resSingle = engine.process({
    version: 'v1.0',
    createSurface: {
      surfaceId: 'surf_p1',
      components: [{ id: 'root', component: 'Text', text: 'Hello' }],
    },
  });
  assert.strictEqual(resSingle, 'surf_p1', 'Single surface message should return surfaceId');

  // 2. Multiple surface messages -> returns surfaceId array
  const resMulti = engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_p2',
        components: [{ id: 'root', component: 'Text', text: 'P2' }],
      },
    },
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_p3',
        components: [{ id: 'root', component: 'Text', text: 'P3' }],
      },
    },
  ]);
  assert.deepStrictEqual(resMulti, ['surf_p2', 'surf_p3'], 'Multiple surface messages should return array of surfaceIds');

  // 3. RPC message -> returns RPC response message
  const resRpc = engine.process({
    version: 'v1.0',
    callRendererFunction: {
      functionCallId: 'rpc_test_1',
      callFunction: {
        '@call': 'getStorage',
        args: { key: 'non_existent_key' },
      },
    },
  });
  assert.ok(resRpc && resRpc.rendererFunctionResponse);
  assert.strictEqual(resRpc.rendererFunctionResponse.functionCallId, 'rpc_test_1');
  assert.strictEqual(resRpc.rendererFunctionResponse.value.success, false);

  console.log('   ✓ engine.process() return value contract & batching verified');
}

// =========================================================================
// [6] callRendererFunction optional surfaceId & custom error code preservation
// =========================================================================
console.log('\n👉 [6/8] Verify callRendererFunction optional surfaceId & custom error code preservation');
{
  const engine = new A2UIEngine();

  // Register function that throws error with custom code
  engine.registerRendererFunction('customRpcFail', () => {
    const err = new Error('Resource authorization timeout');
    err.code = 'TIMEOUT';
    throw err;
  });

  // surfaceId omitted
  const rpcResp = engine.process({
    version: 'v1.0',
    callRendererFunction: {
      functionCallId: 'call_timeout_99',
      callFunction: {
        '@call': 'customRpcFail',
        args: {},
      },
    },
  });

  assert.ok(rpcResp && rpcResp.rendererFunctionResponse);
  assert.strictEqual(rpcResp.rendererFunctionResponse.functionCallId, 'call_timeout_99');
  assert.ok(rpcResp.rendererFunctionResponse.error);
  assert.strictEqual(rpcResp.rendererFunctionResponse.error.code, 'TIMEOUT', 'Custom thrown TIMEOUT code must be preserved');
  assert.ok(rpcResp.rendererFunctionResponse.error.message.includes('timeout'));

  console.log('   ✓ callRendererFunction optional surfaceId & error code preservation verified');
}

// =========================================================================
// [7] ChoicePicker selection for 0, false, negative numbers
// =========================================================================
console.log('\n👉 [7/8] Verify ChoicePicker selection for 0, false, negative numbers');
{
  const engine = new A2UIEngine();
  const S = 'surf_picker_zero';

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: S,
        dataModel: {
          selectedRating: 0,
          selectedStatus: false,
          selectedDelta: -5,
        },
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['rating_picker', 'status_picker', 'delta_picker'],
          },
          {
            id: 'rating_picker',
            component: 'ChoicePicker',
            label: 'Rating',
            value: { '@path': '/selectedRating' },
            options: [
              { label: '0 Stars (Poor)', value: 0 },
              { label: '1 Star (Fair)', value: 1 },
              { label: '5 Stars (Great)', value: 5 },
            ],
          },
          {
            id: 'status_picker',
            component: 'ChoicePicker',
            label: 'Switch State',
            value: { '@path': '/selectedStatus' },
            options: [
              { label: 'Disabled (False)', value: false },
              { label: 'Enabled (True)', value: true },
            ],
          },
          {
            id: 'delta_picker',
            component: 'ChoicePicker',
            label: 'Delta',
            value: { '@path': '/selectedDelta' },
            options: [
              { label: 'Minus 5', value: -5 },
              { label: '0', value: 0 },
              { label: 'Plus 5', value: 5 },
            ],
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.ok(tree);

  // 1. rating_picker: value 0 should select option 0
  const ratingNode = tree.children[0];
  assert.strictEqual(ratingNode.selectedIndex, 0);
  assert.strictEqual(ratingNode.displayLabel, '0 Stars (Poor)');
  assert.strictEqual(ratingNode.options[0].selected, true);
  assert.strictEqual(ratingNode.options[1].selected, false);

  // 2. status_picker: value false should select option false
  const statusNode = tree.children[1];
  assert.strictEqual(statusNode.selectedIndex, 0);
  assert.strictEqual(statusNode.displayLabel, 'Disabled (False)');
  assert.strictEqual(statusNode.options[0].selected, true);
  assert.strictEqual(statusNode.options[1].selected, false);

  // 3. delta_picker: value -5 should select option -5
  const deltaNode = tree.children[2];
  assert.strictEqual(deltaNode.selectedIndex, 0);
  assert.strictEqual(deltaNode.displayLabel, 'Minus 5');
  assert.strictEqual(deltaNode.options[0].selected, true);

  console.log('   ✓ ChoicePicker handling for 0, false, negative numbers verified');
}

// =========================================================================
// [8] Trampoline deep nesting (> 8 levels)
// =========================================================================
console.log('\n👉 [8/8] Verify trampoline recursive assembly beyond 8 nesting levels');
{
  const engine = new A2UIEngine();
  const S = 'surf_deep_nesting';

  // Assemble 10 levels of Column -> Column -> ... -> Button
  const comps = [];
  const depthLimit = 10;
  for (let i = 0; i < depthLimit; i++) {
    const id = i === 0 ? 'root' : `col_${i}`;
    const nextChildId = i === depthLimit - 1 ? 'deep_leaf_btn' : `col_${i + 1}`;
    comps.push({
      id,
      component: 'Column',
      children: [nextChildId],
    });
  }
  comps.push({
    id: 'deep_leaf_btn',
    component: 'Button',
    text: 'Deep Button Level 10',
    action: {
      event: {
        name: 'deep_click',
        context: { depth: depthLimit },
      },
    },
  });

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: S,
        components: comps,
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.ok(tree, '10-level deep tree should be generated');

  // Traverse down to leaf
  let curr = tree;
  let d = 0;
  while (curr.children && curr.children.length > 0) {
    curr = curr.children[0];
    d++;
  }
  assert.strictEqual(d, 10, 'Depth must reach 10 levels');
  assert.strictEqual(curr.component, 'Button');
  assert.strictEqual(curr.text, 'Deep Button Level 10');

  // Deepest Action message creation
  const actionMsg = engine.createActionMessage(S, 'deep_leaf_btn');
  assert.ok(actionMsg);
  assert.strictEqual(actionMsg.action.name, 'deep_click');
  assert.strictEqual(actionMsg.action.context.depth, 10);

  console.log('   ✓ 10-level deep trampoline unrolling & action message verified 100%');
}

console.log('\n================================================================');
console.log('🎉 All 8 Round 10 adversarial security tests passed 100%!');
console.log('================================================================\n');
