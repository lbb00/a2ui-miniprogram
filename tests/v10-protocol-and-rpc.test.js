const assert = require('assert');
const {
  A2UIEngine,
  A2UIError,
  A2UI_VERSION,
  A2UI_MIME_TYPE,
  ErrorCodes,
  createRendererCapabilities,
} = require('../miniprogram/index');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Running A2UI 1.0 Specification & Bidirectional RPC Tests');
  console.log('================================================================\n');

  // Test 1: Constants and Exports
  console.log('[1/17] Testing standard A2UI 1.0 version and MIME type...');
  assert.strictEqual(A2UI_VERSION, '1.0');
  assert.strictEqual(A2UI_MIME_TYPE, 'application/a2ui+json');
  assert.strictEqual(ErrorCodes.NO_TRANSPORT, 'NO_TRANSPORT');
  assert.strictEqual(ErrorCodes.SURFACE_DELETED, 'SURFACE_DELETED');
  assert.strictEqual(ErrorCodes.CANCELLED, 'CANCELLED');
  assert.strictEqual(ErrorCodes.DISPOSED, 'DISPOSED');

  const caps = createRendererCapabilities();
  assert.ok(caps['1.0']);
  assert.ok(caps['v1.0']);
  assert.ok(caps['1.0'].supportedCatalogIds.includes('https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'));
  console.log('✓ Passed [1/17]\n');

  // Test 2: Copy-on-Write Component Normalization
  console.log('[2/17] Testing Copy-on-Write zero-allocation for pure 1.0 and normalization of legacy keys...');
  {
    const engine = new A2UIEngine();

    const pure10Comp = {
      id: 'root',
      component: 'Card',
      '@checks': [{ condition: true, message: 'Valid' }],
      '@catalogId': 'https://custom.catalog/catalog.json',
      '@accessibility': { role: 'button', label: 'Submit' },
      '@metadata': { analyticsKey: 'submit_card' },
      children: ['btn'],
    };

    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_cow',
          components: [pure10Comp],
        },
      },
    ]);

    const surface = engine.surfaces.get('surf_cow');
    const storedComp = surface.components.get('root');

    // Pure 1.0 must be the exact same object reference (zero allocation!)
    assert.strictEqual(storedComp, pure10Comp, 'Pure 1.0 component should retain identical object reference without cloning');

    // Test legacy 0.9 component normalization
    const legacyComp = {
      id: 'legacy_btn',
      component: 'Button',
      text: 'Click Me',
      checks: [{ condition: false, message: 'Disabled check' }],
      catalogId: 'https://legacy.catalog/cat.json',
      accessibility: { role: 'button' },
      metadata: { trace: '123' },
    };

    engine.process([
      {
        updateComponents: {
          surfaceId: 'surf_cow',
          components: [legacyComp],
        },
      },
    ]);

    const storedLegacy = surface.components.get('legacy_btn');
    assert.notStrictEqual(storedLegacy, legacyComp, 'Legacy component should be shallow copied during normalization');
    assert.deepStrictEqual(storedLegacy['@checks'], legacyComp.checks);
    assert.strictEqual(storedLegacy['@catalogId'], 'https://legacy.catalog/cat.json');
    assert.deepStrictEqual(storedLegacy['@accessibility'], { role: 'button' });
    assert.deepStrictEqual(storedLegacy['@metadata'], { trace: '123' });
    // Legacy keys must be physically deleted
    assert.strictEqual(storedLegacy.checks, undefined);
    assert.strictEqual(storedLegacy.catalogId, undefined);
    assert.strictEqual(storedLegacy.accessibility, undefined);
    assert.strictEqual(storedLegacy.metadata, undefined);
  }
  console.log('✓ Passed [2/17]\n');

  // Test 3: Conflict Arbitration (@ takes precedence, no crash)
  console.log('[3/17] Testing conflict arbitration (@ takes precedence without crashing)...');
  {
    const engine = new A2UIEngine();
    const conflictComp = {
      id: 'root',
      component: 'Button',
      text: 'Submit',
      '@checks': [{ condition: true, message: '1.0 check' }],
      checks: [{ condition: false, message: '0.9 check' }],
    };

    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_conflict',
          components: [conflictComp],
        },
      },
    ]);

    const surface = engine.surfaces.get('surf_conflict');
    const stored = surface.components.get('root');
    assert.strictEqual(stored['@checks'][0].message, '1.0 check');
    assert.strictEqual(stored.checks, undefined);

    const tree = engine.getRenderTree('surf_conflict');
    assert.ok(tree);
    assert.strictEqual(tree.disabled, undefined, 'Button should not be disabled because 1.0 @checks is true');
  }
  console.log('✓ Passed [3/17]\n');

  // Test 4: Inbound agent_to_renderer Envelope Unwrapping
  console.log('[4/17] Testing inbound agent_to_renderer wire envelope unwrapping...');
  {
    const engine = new A2UIEngine();

    // 1. createSurface inside envelope
    engine.process([
      {
        agent_to_renderer: {
          createSurface: {
            surfaceId: 'surf_envelope',
            catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
            components: [
              {
                id: 'root',
                component: 'Column',
                children: ['txt'],
              },
              {
                id: 'txt',
                component: 'Text',
                text: { '@path': '/greeting' },
              },
            ],
            dataModel: {
              greeting: 'Hello from envelope!',
            },
          },
        },
      },
    ]);

    let tree = engine.getRenderTree('surf_envelope');
    assert.ok(tree);
    assert.strictEqual(tree.children[0].text, 'Hello from envelope!');

    // 2. updateDataModel inside envelope
    engine.process([
      {
        agent_to_renderer: {
          updateDataModel: {
            surfaceId: 'surf_envelope',
            path: '/greeting',
            value: 'Updated greeting!',
          },
        },
      },
    ]);

    tree = engine.getRenderTree('surf_envelope');
    assert.strictEqual(tree.children[0].text, 'Updated greeting!');

    // 3. deleteSurface inside envelope
    engine.process([
      {
        agent_to_renderer: {
          deleteSurface: {
            surfaceId: 'surf_envelope',
          },
        },
      },
    ]);

    assert.strictEqual(engine.surfaces.has('surf_envelope'), false);
  }
  console.log('✓ Passed [4/17]\n');

  // Test 5: Outbound Formatting (legacyOutbound: true vs false)
  console.log('[5/17] Testing outbound message formatting and legacyOutbound switch...');
  {
    // A. Default legacyOutbound: true
    const engineLegacy = new A2UIEngine({ legacyOutbound: true });
    let dispatchedLegacy = null;
    engineLegacy.onOutboundMessage((msg) => {
      dispatchedLegacy = msg;
    });

    engineLegacy.process([
      {
        createSurface: {
          surfaceId: 'surf_out',
          components: [
            {
              id: 'root',
              component: 'Button',
              text: 'Tap',
              action: { name: 'submit_click', context: { itemId: 42 } },
            },
          ],
        },
      },
    ]);

    engineLegacy.dispatchAction('surf_out', 'root');
    assert.ok(dispatchedLegacy);
    assert.strictEqual(dispatchedLegacy.version, 'v1.0');
    assert.ok(dispatchedLegacy.renderer_to_agent);
    assert.strictEqual(dispatchedLegacy.renderer_to_agent.action.name, 'submit_click');
    assert.strictEqual(dispatchedLegacy.action.name, 'submit_click');
    assert.ok(dispatchedLegacy.event, 'Should maintain root event for legacy backwards compatibility');

    // B. Strict 1.0 (legacyOutbound: false)
    const engineStrict = new A2UIEngine({ legacyOutbound: false });
    let dispatchedStrict = null;
    engineStrict.onOutboundMessage((msg) => {
      dispatchedStrict = msg;
    });

    engineStrict.process([
      {
        createSurface: {
          surfaceId: 'surf_strict',
          components: [
            {
              id: 'root',
              component: 'Button',
              text: 'Tap',
              action: { name: 'submit_click_strict', context: { itemId: 99 } },
            },
          ],
        },
      },
    ]);

    engineStrict.dispatchAction('surf_strict', 'root');
    assert.ok(dispatchedStrict);
    assert.strictEqual(dispatchedStrict.version, '1.0');
    assert.ok(dispatchedStrict.renderer_to_agent);
    assert.strictEqual(dispatchedStrict.renderer_to_agent.action.name, 'submit_click_strict');
    assert.strictEqual(dispatchedStrict.action.name, 'submit_click_strict');
    assert.strictEqual(dispatchedStrict.event, undefined, 'Strict mode should not produce root event');
    assert.strictEqual(dispatchedStrict.action.event, undefined, 'Strict mode should not produce action.event');
  }
  console.log('✓ Passed [5/17]\n');

  // Test 6: Bidirectional RPC callAgentFunction & agentFunctionResponse
  console.log('[6/17] Testing callAgentFunction & agentFunctionResponse successful resolution...');
  {
    const engine = new A2UIEngine();
    let outboundCall = null;
    engine.onOutboundMessage((msg) => {
      outboundCall = msg;
    });

    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_rpc',
          components: [{ id: 'root', component: 'Column' }],
          dataModel: { queryParam: 'flight_123' },
        },
      },
    ]);

    const callPromise = engine.callAgentFunction('surf_rpc', {
      '@call': 'searchFlights',
      args: {
        flightId: { '@path': '/queryParam' },
      },
    });

    assert.ok(outboundCall);
    const callPayload = outboundCall.callAgentFunction || outboundCall.renderer_to_agent?.callAgentFunction;
    assert.ok(callPayload);
    assert.strictEqual(callPayload.callFunction['@call'], 'searchFlights');
    assert.strictEqual(callPayload.callFunction.args.flightId, 'flight_123');

    const callId = callPayload.functionCallId;

    // Simulate agent responding
    engine.process([
      {
        agentFunctionResponse: {
          functionCallId: callId,
          value: { status: 'ON_TIME', gate: 'B12' },
        },
      },
    ]);

    const res = await callPromise;
    assert.deepStrictEqual(res, { status: 'ON_TIME', gate: 'B12' });
  }
  console.log('✓ Passed [6/17]\n');

  // Test 7: Bidirectional RPC error rejection
  console.log('[7/17] Testing callAgentFunction rejection on error response...');
  {
    const engine = new A2UIEngine();
    let outboundCall = null;
    engine.onOutboundMessage((msg) => {
      outboundCall = msg;
    });

    const callPromise = engine.callAgentFunction('surf_rpc_err', {
      '@call': 'fetchSensitiveData',
    });

    const callId = outboundCall.callAgentFunction.functionCallId;

    engine.process([
      {
        agentFunctionResponse: {
          functionCallId: callId,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'User does not have permission',
          },
        },
      },
    ]);

    await assert.rejects(
      async () => {
        await callPromise;
      },
      (err) => {
        assert.ok(err instanceof A2UIError);
        assert.strictEqual(err.code, 'PERMISSION_DENIED');
        assert.strictEqual(err.message, 'User does not have permission');
        return true;
      }
    );
  }
  console.log('✓ Passed [7/17]\n');

  // Test 8: Immediate rejection when no transport registered
  console.log('[8/17] Testing immediate NO_TRANSPORT rejection when no transport is registered...');
  {
    const engine = new A2UIEngine();
    await assert.rejects(
      async () => {
        await engine.callAgentFunction('surf_no_transport', { '@call': 'test' });
      },
      (err) => {
        assert.ok(err instanceof A2UIError);
        assert.strictEqual(err.code, ErrorCodes.NO_TRANSPORT);
        return true;
      }
    );
  }
  console.log('✓ Passed [8/17]\n');

  // Test 9: Timeout rejection for callAgentFunction
  console.log('[9/17] Testing callAgentFunction timeout rejection...');
  {
    const engine = new A2UIEngine();
    engine.onOutboundMessage(() => {});

    await assert.rejects(
      async () => {
        await engine.callAgentFunction(
          'surf_timeout',
          { '@call': 'longRunningTask' },
          { timeout: 50 }
        );
      },
      (err) => {
        assert.ok(err instanceof A2UIError);
        assert.strictEqual(err.code, ErrorCodes.TIMEOUT);
        return true;
      }
    );
  }
  console.log('✓ Passed [9/17]\n');

  // Test 10: Lifecycle cleanup rejections (clear, deleteSurface, destroy)
  console.log('[10/17] Testing lifecycle cleanup rejections (clear, deleteSurface, destroy)...');
  {
    const engine = new A2UIEngine();
    engine.onOutboundMessage(() => {});

    // 1. deleteSurface rejection
    const p1 = engine.callAgentFunction('surf_del', { '@call': 'fn1' }, { timeout: 10000 });
    engine.process([
      {
        deleteSurface: 'surf_del',
      },
    ]);
    await assert.rejects(p1, (err) => err.code === ErrorCodes.SURFACE_DELETED);

    // 2. clear() rejection
    const p2 = engine.callAgentFunction('surf_clear', { '@call': 'fn2' }, { timeout: 10000 });
    engine.clear();
    await assert.rejects(p2, (err) => err.code === ErrorCodes.CANCELLED);

    // 3. destroy() rejection
    const p3 = engine.callAgentFunction('surf_dest', { '@call': 'fn3' }, { timeout: 10000 });
    engine.destroy();
    await assert.rejects(p3, (err) => err.code === ErrorCodes.DISPOSED);

    // Call after destroy
    await assert.rejects(
      engine.callAgentFunction('surf_dest', { '@call': 'fn4' }),
      (err) => err.code === ErrorCodes.DISPOSED
    );
  }
  console.log('✓ Passed [10/17]\n');

  // Test 11: Dynamic list templates with @path and @componentId
  console.log('[11/17] Testing A2UI 1.0 @path and @componentId in dynamic list templates...');
  {
    const engine = new A2UIEngine();
    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_list',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: {
                '@path': '/restaurants',
                '@componentId': 'rest_card',
              },
            },
            {
              id: 'rest_card',
              component: 'Text',
              text: { '@path': 'name' },
            },
          ],
          dataModel: {
            restaurants: [{ name: 'Sushi Bar' }, { name: 'Taco Stand' }],
          },
        },
      },
    ]);

    const tree = engine.getRenderTree('surf_list');
    assert.ok(tree);
    assert.strictEqual(tree.children.length, 2);
    assert.strictEqual(tree.children[0].text, 'Sushi Bar');
    assert.strictEqual(tree.children[1].text, 'Taco Stand');
  }
  console.log('✓ Passed [11/17]\n');

  // Test 12: agentFunctionResponse process() isolation (no notify(callId), returns response object)
  console.log('[12/17] Testing agentFunctionResponse process() isolation (does not treat callId as surfaceId)...');
  {
    const engine = new A2UIEngine();
    let notifiedSurface = null;
    let notifiedTree = null;
    engine.subscribe((surfaceId, tree) => {
      notifiedSurface = surfaceId;
      notifiedTree = tree;
    });

    let lastOutbound = null;
    engine.onOutboundMessage((msg) => {
      lastOutbound = msg;
    });

    const promise = engine.callAgentFunction('surf_test', { '@call': 'testRpc' });
    const callId = lastOutbound.renderer_to_agent.callAgentFunction.functionCallId;

    // Process the agentFunctionResponse
    const procResult = engine.process({
      agent_to_renderer: {
        agentFunctionResponse: {
          functionCallId: callId,
          response: { success: true },
        },
      },
    });

    // Verification: procResult should be null (process() ignores inbound agentFunctionResponse from return values to prevent echoing back to Agent)
    assert.strictEqual(procResult, null, 'process() must not echo agentFunctionResponse back to Agent');

    // Verification: notify should NEVER have been called with callId
    assert.strictEqual(notifiedSurface, null, 'notify() must not be called with functionCallId');
    assert.strictEqual(notifiedTree, null);

    const val = await promise;
    assert.deepStrictEqual(val, { success: true });
  }
  console.log('✓ Passed [12/17]\n');

  // Test 13: callAgentFunction options edge cases & listener dispatch error rejection
  console.log('[13/17] Testing callAgentFunction options edge cases & listener error handling...');
  {
    const engine = new A2UIEngine();
    engine.onOutboundMessage(() => {});

    // options = null / undefined
    const p1 = engine.callAgentFunction('s1', { '@call': 'fn1' }, null);
    p1.catch(() => {});
    assert.ok(p1 instanceof Promise);

    // invalid negative timeout rejects with VALIDATION_FAILED
    const p2 = engine.callAgentFunction('s1', { '@call': 'fn2' }, { timeout: -50 });
    await assert.rejects(p2, (err) => err.code === ErrorCodes.VALIDATION_FAILED);

    // invalid non-numeric timeout rejects with VALIDATION_FAILED
    const p3 = engine.callAgentFunction('s1', { '@call': 'fn3' }, { timeout: 'invalid' });
    await assert.rejects(p3, (err) => err.code === ErrorCodes.VALIDATION_FAILED);

    // Outbound listener throws error -> immediate rejection
    const failEngine = new A2UIEngine();
    failEngine.onOutboundMessage(() => {
      throw new Error('Transport socket write failed');
    });

    await assert.rejects(
      failEngine.callAgentFunction('s1', { '@call': 'fn_fail' }),
      (err) => err.code === ErrorCodes.EXECUTION_ERROR
    );

    // Clean up timers
    engine.destroy();
    failEngine.destroy();
  }
  console.log('✓ Passed [13/17]\n');

  // Test 14: Inbound agent_to_renderer Array Unpacking
  console.log('[14/17] Testing inbound agent_to_renderer containing array of messages...');
  {
    const engine = new A2UIEngine();
    engine.process({
      agent_to_renderer: [
        {
          createSurface: {
            surfaceId: 'surf_batch',
            components: [
              {
                id: 'root',
                component: 'Text',
                text: { '@path': '/msg' },
              },
            ],
            dataModel: { msg: 'Initial' },
          },
        },
        {
          updateDataModel: {
            surfaceId: 'surf_batch',
            path: '/msg',
            value: 'Updated from array batch',
          },
        },
      ],
    });

    const tree = engine.getRenderTree('surf_batch');
    assert.ok(tree);
    assert.strictEqual(tree.text, 'Updated from array batch');
  }
  console.log('✓ Passed [14/17]\n');

  // Test 15: Disambiguation between Business Data and Function Call Objects
  console.log('[15/17] Testing disambiguation between business data and function call objects...');
  {
    const engine = new A2UIEngine();
    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_data',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['txt_biz', 'txt_fn'],
            },
            {
              id: 'txt_biz',
              component: 'Text',
              // Business data with "call" key should NOT be executed as a function!
              text: { '@path': '/item/note' },
            },
            {
              id: 'txt_fn',
              component: 'Text',
              // Valid function call with @call
              text: { '@call': 'formatCurrency', args: { value: 128, currency: 'USD' } },
            },
          ],
          dataModel: {
            item: {
              call: 'urgent',
              note: 'Call client back asap',
            },
          },
        },
      },
    ]);

    const tree = engine.getRenderTree('surf_data');
    assert.ok(tree);
    assert.strictEqual(tree.children[0].text, 'Call client back asap');
    assert.strictEqual(tree.children[1].text, '$128.00');

    // Test resolveDeep with business object containing 'call' key
    const { resolveDeep } = require('../miniprogram/core/data-model');
    const bizObj = { call: 'urgent', note: 'please call' };
    const resolvedBiz = resolveDeep(bizObj, {});
    assert.deepStrictEqual(resolvedBiz, { call: 'urgent', note: 'please call' });
  }
  console.log('✓ Passed [15/17]\n');

  // Test 16: Prototype Pollution Guard in normalizeComponent
  console.log('[16/17] Testing prototype pollution guard in component normalization...');
  {
    const engine = new A2UIEngine();
    const maliciousComp = JSON.parse(`{
      "id": "root",
      "component": "Card",
      "checks": [{ "condition": true, "message": "OK" }],
      "__proto__": { "polluted": true }
    }`);

    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_sec',
          components: [maliciousComp],
        },
      },
    ]);

    const baseObj = {};
    assert.strictEqual(baseObj.polluted, undefined, 'Prototype pollution must not affect base Object prototype');
  }
  console.log('✓ Passed [16/17]\n');

  // Test 17: WXML AST Cleanliness (No @checks on AST nodes)
  console.log('[17/25] Testing WXML AST cleanliness (no @checks property on AST nodes)...');
  {
    const engine = new A2UIEngine();
    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_ast',
          components: [
            {
              id: 'root',
              component: 'Button',
              text: 'Submit',
              '@checks': [{ condition: false, message: 'Value required' }],
            },
          ],
        },
      },
    ]);

    const tree = engine.getRenderTree('surf_ast');
    assert.ok(tree);
    assert.strictEqual(tree['@checks'], undefined, "AST node must not contain '@checks' key");
    assert.ok(Array.isArray(tree.checks), 'AST node must contain checks array');
    assert.strictEqual(tree.validationError, 'Value required');
    assert.strictEqual(tree.disabled, true);
  }
  console.log('✓ Passed [17/25]\n');

  // Test 18: Asynchronous (Promise) renderer functions in callRendererFunction
  console.log('[18/25] Testing asynchronous (Promise) renderer functions in callRendererFunction...');
  {
    const engine = new A2UIEngine();
    let outboundResp = null;
    engine.onOutboundMessage((msg) => {
      outboundResp = msg;
    });

    // Register async renderer function that returns a Promise
    engine.registerRendererFunction('asyncFetchUser', async (args) => {
      await new Promise((r) => setTimeout(r, 10));
      return { userId: args.id, name: 'Alice', score: 100 };
    });

    const promise = engine.process({
      callRendererFunction: {
        functionCallId: 'async_call_1',
        callFunction: {
          '@call': 'asyncFetchUser',
          args: { id: 42 },
        },
      },
    });

    // Wait for the async handler to complete
    await promise;

    assert.ok(outboundResp);
    const respBody = outboundResp.renderer_to_agent.rendererFunctionResponse;
    assert.strictEqual(respBody.functionCallId, 'async_call_1');
    assert.deepStrictEqual(respBody.response, { userId: 42, name: 'Alice', score: 100 });
    assert.deepStrictEqual(respBody.value, { userId: 42, name: 'Alice', score: 100 });

    // Test async handler rejection
    engine.registerRendererFunction('asyncFail', async () => {
      throw new A2UIError(ErrorCodes.EXECUTION_ERROR, 'Async operation failed', { step: 'network' });
    });

    let failOutbound = null;
    engine.onOutboundMessage((msg) => {
      failOutbound = msg;
    });

    await engine.process({
      callRendererFunction: {
        functionCallId: 'async_call_2',
        callFunction: {
          '@call': 'asyncFail',
        },
      },
    });

    assert.ok(failOutbound);
    const errBody = failOutbound.renderer_to_agent.rendererFunctionResponse;
    assert.strictEqual(errBody.functionCallId, 'async_call_2');
    assert.ok(errBody.error);
    assert.strictEqual(errBody.error.code, ErrorCodes.EXECUTION_ERROR);
    assert.strictEqual(errBody.error.message, 'Async operation failed');
    assert.strictEqual(errBody.error.details.step, 'network');
  }
  console.log('✓ Passed [18/25]\n');

  // Test 19: deleteSurface subscriber notification and UI clearance
  console.log('[19/25] Testing deleteSurface subscriber notification and UI clearance...');
  {
    const engine = new A2UIEngine();
    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_del_test',
          components: [{ id: 'root', component: 'Text', text: 'To be deleted' }],
        },
      },
    ]);

    let notifiedSurface = null;
    let notifiedTree = 'initial';
    engine.subscribe((sId, tree) => {
      notifiedSurface = sId;
      notifiedTree = tree;
    });

    // Delete surface via process()
    const delResult = engine.process({
      deleteSurface: 'surf_del_test',
    });

    assert.strictEqual(delResult, 'surf_del_test', 'deleteSurface should return deleted surfaceId');
    assert.strictEqual(notifiedSurface, 'surf_del_test', 'Subscriber should be notified of deleted surface');
    assert.strictEqual(notifiedTree, null, 'Render tree for deleted surface must be null');
    assert.strictEqual(engine.getRenderTree('surf_del_test'), null);
  }
  console.log('✓ Passed [19/25]\n');

  // Test 20: Preservation of business single-key {path} in resolveDeep
  console.log('[20/25] Testing preservation of business single-key {path} in resolveDeep...');
  {
    const { resolveDeep } = require('../miniprogram/core/data-model');
    const bizRoute = {
      action: 'navigate',
      route: {
        path: '/pages/detail/index',
      },
      icon: {
        path: 'M 10 10 L 20 20 Z',
      },
    };

    // Deep resolution should NOT erase { path: ... } when it is business data
    const resolved = resolveDeep(bizRoute, { pages: 'something' });
    assert.strictEqual(resolved.route.path, '/pages/detail/index', 'Business path property must not be cleared');
    assert.strictEqual(resolved.icon.path, 'M 10 10 L 20 20 Z', 'Business SVG path must not be cleared');

    // But explicit @path should still resolve
    const mixed = {
      route: { path: '/pages/detail/index' },
      user: { '@path': '/user/name' },
    };
    const resolvedMixed = resolveDeep(mixed, { user: { name: 'Bob' } });
    assert.strictEqual(resolvedMixed.route.path, '/pages/detail/index');
    assert.strictEqual(resolvedMixed.user, 'Bob');
  }
  console.log('✓ Passed [20/25]\n');

  // Test 21: Custom component accessibility, metadata and prototype pollution guard
  console.log('[21/25] Testing custom component accessibility, metadata and prototype pollution guard...');
  {
    const engine = new A2UIEngine();
    engine.registerCustomComponent('CustomCard');

    engine.process([
      {
        createSurface: {
          surfaceId: 'surf_custom',
          components: [
            {
              id: 'root',
              component: 'CustomCard',
              '@accessibility': { label: { '@path': '/cardLabel' } },
              '@metadata': { analyticsKey: 'card_view' },
              customProp: { '@path': '/cardProp' },
            },
          ],
          dataModel: {
            cardLabel: 'Accessible Card',
            cardProp: 'Extra Prop',
          },
        },
      },
    ]);

    const tree = engine.getRenderTree('surf_custom');
    assert.ok(tree);
    assert.strictEqual(tree.isCustom, true);
    assert.deepStrictEqual(tree.accessibility, { label: 'Accessible Card' });
    assert.deepStrictEqual(tree.metadata, { analyticsKey: 'card_view' });
    assert.strictEqual(tree.props.customProp, 'Extra Prop');
    assert.strictEqual(Object.getPrototypeOf(tree.props), null, 'Custom component props should have null prototype');
  }
  console.log('✓ Passed [21/25]\n');

  // Test 22: RPC idempotency guard on duplicate functionCallId
  console.log('[22/25] Testing RPC idempotency guard on duplicate functionCallId...');
  {
    const engine = new A2UIEngine();
    let executionCount = 0;
    engine.registerRendererFunction('countExec', () => {
      executionCount++;
      return { count: executionCount };
    });

    const callPayload = {
      functionCallId: 'idempotent_call_101',
      callFunction: { '@call': 'countExec' },
    };

    engine.executeRendererFunction(callPayload);
    assert.strictEqual(executionCount, 1);

    // Replay with identical functionCallId
    const secondRes = engine.executeRendererFunction(callPayload);
    assert.strictEqual(secondRes, null, 'Replayed functionCallId should be ignored');
    assert.strictEqual(executionCount, 1, 'Execution count must remain 1');
  }
  console.log('✓ Passed [22/25]\n');

  // Test 23: createCustomActionMessage envelope and identifier tamper defense
  console.log('[23/25] Testing createCustomActionMessage envelope and identifier tamper defense...');
  {
    const engine = new A2UIEngine({ legacyOutbound: false });
    const msg = engine.createCustomActionMessage('surf_real', 'comp_real', {
      name: 'tap_action',
      surfaceId: 'surf_fake', // attempt to tamper
      sourceComponentId: 'comp_fake',
      context: { val: 42 },
    });

    assert.strictEqual(msg.version, '1.0');
    assert.ok(msg.renderer_to_agent.action);
    assert.strictEqual(msg.renderer_to_agent.action.surfaceId, 'surf_real', 'surfaceId must not be overridden');
    assert.strictEqual(msg.renderer_to_agent.action.sourceComponentId, 'comp_real', 'sourceComponentId must not be overridden');
    assert.strictEqual(msg.renderer_to_agent.action.name, 'tap_action');
    assert.deepStrictEqual(msg.renderer_to_agent.action.context, { val: 42 });
  }
  console.log('✓ Passed [23/25]\n');

  // Test 24: destroy() cleanup and subsequent call safety
  console.log('[24/25] Testing destroy() cleanup and subsequent call safety...');
  {
    const engine = new A2UIEngine();
    let outboundCalled = false;
    engine.setOutboundListener(() => {
      outboundCalled = true;
    });

    engine.destroy();
    assert.strictEqual(engine.outboundListener, null, 'outboundListener must be cleared on destroy');
    assert.strictEqual(engine.process({ createSurface: { surfaceId: 's1' } }), null);
    assert.strictEqual(engine.processMessage({ createSurface: { surfaceId: 's1' } }), null);
    assert.strictEqual(engine.executeRendererFunction({ functionCallId: 'f1' }), null);

    await assert.rejects(
      engine.callAgentFunction('s1', { '@call': 'fn' }),
      (err) => err.code === ErrorCodes.DISPOSED
    );
  }
  console.log('✓ Passed [24/25]\n');

  // Test 25: ErrorCodes parity with TypeScript definition
  console.log('[25/25] Testing ErrorCodes parity with TypeScript definition...');
  {
    const expectedCodes = [
      'VALIDATION_FAILED',
      'UNKNOWN_COMPONENT',
      'EXECUTION_ERROR',
      'UNALLOWED_PARENT',
      'UNALLOWED_CHILD',
      'UNKNOWN_FUNCTION',
      'INVALID_FUNCTION_CALL',
      'UNKNOWN_ERROR',
      'NO_TRANSPORT',
      'SURFACE_DELETED',
      'TIMEOUT',
      'CANCELLED',
      'DISPOSED',
    ];
    for (const code of expectedCodes) {
      assert.strictEqual(ErrorCodes[code], code, `ErrorCodes.${code} must be defined`);
    }
  }
  console.log('✓ Passed [25/25]\n');

  console.log('🎉 All A2UI 1.0 and RPC tests passed successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
