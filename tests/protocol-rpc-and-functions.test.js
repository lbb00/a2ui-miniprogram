/**
 * A2UI v1.0 Protocol Standard, RPC Interaction & Client Functions Test Suite
 *
 * Covers:
 * 1. callRendererFunction client function invocation channel (Agent -> Client RPC)
 * 2. Standard structured error protocol messages (Renderer -> Agent)
 * 3. Enhanced Basic Catalog built-in function library (formatCurrency, pluralize, openUrl, createRendererCapabilities)
 */

const assert = require('assert');
const { A2UIEngine, ErrorCodes, KNOWN_COMPONENTS } = require('../miniprogram/core/engine');
const {
  resolveValue,
  resolveDeep,
  getValueByPath,
  evaluateFunction,
  executePluralize,
  openUrl,
  createRendererCapabilities,
  getMockState,
  resetMockState,
  CURRENCY_SYMBOLS,
  getCurrencySymbol,
} = require('../miniprogram/core/data-model');

console.log('================================================================');
console.log('🧪 Running A2UI v1.0 Protocol RPC, Structured Error & Functions Tests');
console.log('================================================================\n');

// ====================================================================
// SECTION 1: callRendererFunction client function channel (Agent -> Client RPC)
// ====================================================================
console.log('👉 [1/3] Verify callRendererFunction client function invocation and privileged functions');

{
  const engine = new A2UIEngine();
  const outboundMessages = [];
  engine.onOutboundMessage((msg) => {
    outboundMessages.push(msg);
  });

  // Initialize surface with dataModel
  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_rpc',
        dataModel: {
          deviceConfig: {
            theme: 'dark',
            vibrateIntensity: 'heavy',
          },
          clipboardPayload: 'https://a2ui.org/welcome',
        },
      },
    },
  ]);

  // 1.1 Test getSystemInfo
  const sysInfoMsg = {
    version: 'v1.0',
    callRendererFunction: {
      surfaceId: 'surf_rpc',
      functionCallId: 'call_sys_001',
      callFunction: {
        catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        '@call': 'getSystemInfo',
        args: {},
      },
    },
  };

  const sysInfoResp = engine.process(sysInfoMsg);
  assert.ok(sysInfoResp, 'callRendererFunction must return response object');
  assert.strictEqual(sysInfoResp.version, 'v1.0');
  assert.ok(sysInfoResp.rendererFunctionResponse, 'Must be wrapped under rendererFunctionResponse');
  assert.strictEqual(sysInfoResp.rendererFunctionResponse.functionCallId, 'call_sys_001');

  const sysInfoResult = sysInfoResp.rendererFunctionResponse.response;
  assert.ok(sysInfoResult, 'Response body must contain response/value');
  assert.strictEqual(sysInfoResp.rendererFunctionResponse.value, sysInfoResult);
  assert.ok(sysInfoResult.model, 'System info must contain device model');
  assert.ok(sysInfoResult.system, 'System info must contain OS system');
  assert.ok(typeof sysInfoResult.screenWidth === 'number', 'Screen width must be numeric');
  assert.ok(typeof sysInfoResult.screenHeight === 'number', 'Screen height must be numeric');
  console.log('   ✓ getSystemInfo returns valid system metrics (model, system, screenWidth, screenHeight)');

  // 1.2 Test setClipboard
  const clipMsg = {
    version: 'v1.0',
    callRendererFunction: {
      surfaceId: 'surf_rpc',
      functionCallId: 'call_clip_002',
      callFunction: {
        '@call': 'setClipboard',
        args: {
          data: { '@path': '/clipboardPayload' },
        },
      },
    },
  };

  const clipResp = engine.process(clipMsg);
  assert.strictEqual(clipResp.rendererFunctionResponse.functionCallId, 'call_clip_002');
  assert.strictEqual(clipResp.rendererFunctionResponse.response.success, true);
  assert.strictEqual(clipResp.rendererFunctionResponse.response.data, 'https://a2ui.org/welcome');

  // Verify write via getClipboard
  const getClipResp = engine.callRendererFunction({
    functionCallId: 'call_clip_003',
    callFunction: { '@call': 'getClipboard' },
  });
  assert.strictEqual(getClipResp.rendererFunctionResponse.response.data, 'https://a2ui.org/welcome');
  console.log('   ✓ setClipboard writes to clipboard with dynamic binding and reads back successfully');

  // 1.3 Test vibrate / hapticFeedback
  const vibrateMsg = {
    version: 'v1.0',
    callRendererFunction: {
      surfaceId: 'surf_rpc',
      functionCallId: 'call_vib_004',
      callFunction: {
        '@call': 'hapticFeedback',
        args: {
          type: { '@path': '/deviceConfig/vibrateIntensity' },
        },
      },
    },
  };

  const vibResp = engine.process(vibrateMsg);
  assert.strictEqual(vibResp.rendererFunctionResponse.functionCallId, 'call_vib_004');
  assert.strictEqual(vibResp.rendererFunctionResponse.response.success, true);
  assert.strictEqual(vibResp.rendererFunctionResponse.response.type, 'heavy');
  console.log('   ✓ hapticFeedback / vibrate dynamic parameter evaluation verified');

  // 1.4 Test getStorage / setStorage
  const setStorageMsg = {
    version: 'v1.0',
    callRendererFunction: {
      surfaceId: 'surf_rpc',
      functionCallId: 'call_store_set_005',
      callFunction: {
        '@call': 'setStorage',
        args: {
          key: 'userAuthToken',
          value: 'jwt_token_secret_12345',
        },
      },
    },
  };
  const setStoreResp = engine.process(setStorageMsg);
  assert.strictEqual(setStoreResp.rendererFunctionResponse.functionCallId, 'call_store_set_005');
  assert.strictEqual(setStoreResp.rendererFunctionResponse.response.success, true);

  const getStorageMsg = {
    version: 'v1.0',
    callRendererFunction: {
      surfaceId: 'surf_rpc',
      functionCallId: 'call_store_get_006',
      callFunction: {
        '@call': 'getStorage',
        args: {
          key: 'userAuthToken',
        },
      },
    },
  };
  const getStoreResp = engine.process(getStorageMsg);
  assert.strictEqual(getStoreResp.rendererFunctionResponse.functionCallId, 'call_store_get_006');
  assert.strictEqual(getStoreResp.rendererFunctionResponse.response.success, true);
  assert.strictEqual(getStoreResp.rendererFunctionResponse.response.value, 'jwt_token_secret_12345');
  console.log('   ✓ getStorage / setStorage local storage read/write verified');

  // 1.5 Verify outbound listener captures all RPC responses
  const capturedCallIds = outboundMessages
    .filter((m) => m.rendererFunctionResponse)
    .map((m) => m.rendererFunctionResponse.functionCallId);
  assert.ok(capturedCallIds.includes('call_sys_001'));
  assert.ok(capturedCallIds.includes('call_clip_002'));
  assert.ok(capturedCallIds.includes('call_vib_004'));
  assert.ok(capturedCallIds.includes('call_store_set_005'));
  assert.ok(capturedCallIds.includes('call_store_get_006'));
  console.log('   ✓ outboundListener captures 100% of outbound RPC responses');

  // 1.6 Test unknown function error response
  const unknownFnMsg = {
    version: 'v1.0',
    callRendererFunction: {
      surfaceId: 'surf_rpc',
      functionCallId: 'call_err_007',
      callFunction: {
        '@call': 'unregisteredNativeFunction',
        args: {},
      },
    },
  };
  const unknownFnResp = engine.process(unknownFnMsg);
  assert.strictEqual(unknownFnResp.rendererFunctionResponse.functionCallId, 'call_err_007');
  assert.ok(unknownFnResp.rendererFunctionResponse.error, 'Unknown function must return error');
  assert.strictEqual(unknownFnResp.rendererFunctionResponse.error.code, 'UNKNOWN_FUNCTION');
  console.log('   ✓ Unknown client function returns standard UNKNOWN_FUNCTION error');

  // 1.7 Test custom client function registration
  engine.registerRendererFunction('customCalculateTax', (args) => {
    return { tax: (Number(args.amount) || 0) * 0.1 };
  });
  const customCallResp = engine.callRendererFunction({
    functionCallId: 'call_custom_008',
    callFunction: {
      '@call': 'customCalculateTax',
      args: { amount: 200 },
    },
  });
  assert.strictEqual(customCallResp.rendererFunctionResponse.response.tax, 20);
  console.log('   ✓ registerRendererFunction custom extension verified');
}

// ====================================================================
// SECTION 2: Standard structured error protocol messages (Renderer -> Agent)
// ====================================================================
console.log('\n👉 [2/3] Verify standard structured error protocol messages & automatic reporting');

{
  const engine = new A2UIEngine();
  const reportedErrors = [];
  engine.onError((err) => {
    reportedErrors.push(err);
  });

  // 2.1 Verify createErrorMessage format and standard error codes
  const errCodes = [
    ErrorCodes.VALIDATION_FAILED,
    ErrorCodes.UNKNOWN_COMPONENT,
    ErrorCodes.EXECUTION_ERROR,
    ErrorCodes.UNALLOWED_PARENT,
    ErrorCodes.UNALLOWED_CHILD,
  ];

  for (const code of errCodes) {
    const errObj = engine.createErrorMessage('surf_test', code, '/components/0/text', `Test error for ${code}`);
    assert.strictEqual(errObj.version, 'v1.0', 'Error message must specify version: v1.0');
    assert.ok(errObj.error, 'Must contain error payload');
    assert.strictEqual(errObj.error.code, code);
    assert.strictEqual(errObj.error.surfaceId, 'surf_test');
    assert.strictEqual(errObj.error.path, '/components/0/text');
    assert.strictEqual(errObj.error.message, `Test error for ${code}`);
  }
  console.log('   ✓ createErrorMessage constructs all 5 standard error code messages verified');

  // 2.2 Verify illegal component (UNKNOWN_COMPONENT) auto reporting
  reportedErrors.length = 0;
  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_err_comp',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['valid_btn', 'invalid_comp'],
          },
          {
            id: 'valid_btn',
            component: 'Button',
            text: 'Valid',
          },
          {
            id: 'invalid_comp',
            component: 'NonExistent3DCanvas',
          },
        ],
      },
    },
  ]);

  const unknownCompErr = reportedErrors.find((e) => e.error && e.error.code === ErrorCodes.UNKNOWN_COMPONENT);
  assert.ok(unknownCompErr, 'Must dispatch UNKNOWN_COMPONENT error for NonExistent3DCanvas');
  assert.strictEqual(unknownCompErr.error.surfaceId, 'surf_err_comp');
  assert.ok(unknownCompErr.error.message.includes('NonExistent3DCanvas'));
  console.log('   ✓ Unknown component triggers UNKNOWN_COMPONENT error callback');

  // 2.3 Verify component missing ID (VALIDATION_FAILED) auto reporting
  reportedErrors.length = 0;
  engine.process([
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'surf_err_comp',
        components: [
          {
            // Missing ID
            component: 'Text',
            text: 'No ID',
          },
        ],
      },
    },
  ]);
  const validationErr = reportedErrors.find((e) => e.error && e.error.code === ErrorCodes.VALIDATION_FAILED);
  assert.ok(validationErr, 'Missing ID must trigger VALIDATION_FAILED error');
  console.log('   ✓ Component missing ID triggers VALIDATION_FAILED error callback');

  // 2.4 Verify prototype injection raises EXECUTION_ERROR
  reportedErrors.length = 0;
  engine.process([
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: 'surf_err_comp',
        path: '/__proto__/evil',
        value: 'hacked',
      },
    },
  ]);
  const execErr = reportedErrors.find((e) => e.error && e.error.code === ErrorCodes.EXECUTION_ERROR);
  assert.ok(execErr, 'Illegal data model path operation must raise EXECUTION_ERROR');
  console.log('   ✓ Prototype injection operation intercepted with EXECUTION_ERROR');
}

// ====================================================================
// SECTION 3: Enhanced Basic Catalog Built-in Functions
// ====================================================================
console.log('\n👉 [3/3] Verify Basic Catalog functions (formatCurrency, pluralize, openUrl, capabilities)');

{
  // 3.1 formatCurrency international currency symbols
  const currencyCases = [
    { currency: 'EUR', val: 1299.5, expected: '€1299.50' },
    { currency: 'GBP', val: 89.99, expected: '£89.99' },
    { currency: 'JPY', val: 5000, expected: '¥5000.00' },
    { currency: 'CNY', val: 399.0, expected: '¥399.00' },
    { currency: 'RMB', val: 99.0, expected: '¥99.00' },
    { currency: 'INR', val: 1500.75, expected: '₹1500.75' },
    { currency: 'CAD', val: 45.5, expected: '$45.50' },
    { currency: 'AUD', val: 68.2, expected: '$68.20' },
    { currency: 'USD', val: 100, expected: '$100.00' },
    { currency: 'KRW', val: 50000, expected: '₩50000.00' },
    { currency: undefined, val: 250, expected: '$250.00' },
    { currency: null, val: 10, expected: '$10.00' },
    { currency: 'EUR', val: -49.9, expected: '-€49.90' },
    { currency: 'USD', val: 1234567.89, grouping: true, expected: '$1,234,567.89' },
  ];

  for (const c of currencyCases) {
    const res = evaluateFunction('formatCurrency', {
      value: c.val,
      currency: c.currency,
      grouping: c.grouping,
    });
    assert.strictEqual(
      res,
      c.expected,
      `formatCurrency [${c.currency || 'default'}] expected ${c.expected}, got ${res}`
    );
  }
  console.log('   ✓ formatCurrency international currency symbols verified 100%');

  // 3.2 pluralize complete plural rules (zero, one, two, few, many, other)
  const forms = {
    zero: 'no tickets left',
    one: '1 ticket available',
    two: 'a pair of tickets',
    few: 'a few tickets remaining',
    many: 'many tickets in stock',
    other: 'several tickets available',
  };

  // Branch tests
  assert.strictEqual(executePluralize(0, forms), 'no tickets left');
  assert.strictEqual(executePluralize(1, forms), '1 ticket available');
  assert.strictEqual(executePluralize(2, forms), 'a pair of tickets');
  assert.strictEqual(executePluralize(5, forms), 'several tickets available');

  // Fallback to other when zero omitted
  assert.strictEqual(
    executePluralize(0, { one: '1 apple', other: 'many apples' }),
    'many apples'
  );

  // Fallback to other when two omitted
  assert.strictEqual(
    executePluralize(2, { one: '1 apple', other: 'apples' }),
    'apples'
  );

  // Russian rules few / many
  assert.strictEqual(
    executePluralize(3, forms, 'ru'),
    'a few tickets remaining'
  );
  assert.strictEqual(
    executePluralize(5, forms, 'ru'),
    'many tickets in stock'
  );

  // evaluateFunction test
  const pluralRes = evaluateFunction('pluralize', {
    value: 1,
    one: 'item',
    other: 'items',
  });
  assert.strictEqual(pluralRes, 'item');
  console.log('   ✓ pluralize full branches (zero, one, two, few, many, other) verified');

  // 3.3 openUrl spec & miniprogram fallback
  resetMockState();

  // Valid HTTPS link
  const openRes1 = openUrl('https://mp.weixin.qq.com/guide');
  assert.strictEqual(openRes1.success, true);
  assert.strictEqual(openRes1.url, 'https://mp.weixin.qq.com/guide');
  assert.strictEqual(openRes1.action, 'copied_to_clipboard');
  const mockState1 = getMockState();
  assert.strictEqual(mockState1.clipboard, 'https://mp.weixin.qq.com/guide');
  assert.strictEqual(mockState1.toast.title, 'Link copied, please open in browser');

  // Valid HTTP link
  const openRes2 = openUrl('http://example.com/spec');
  assert.strictEqual(openRes2.success, true);

  // Illegal schemes (XSS prevention)
  const openResBad1 = openUrl('javascript:alert(1)');
  assert.strictEqual(openResBad1.success, false);
  assert.ok(openResBad1.error.includes('only HTTP/HTTPS are allowed'));

  const openResBad2 = openUrl('file:///etc/passwd');
  assert.strictEqual(openResBad2.success, false);

  const openResBad3 = openUrl('');
  assert.strictEqual(openResBad3.success, false);

  // evaluateFunction call
  const evalUrlRes = evaluateFunction('openUrl', { url: 'https://a2ui.org' });
  assert.strictEqual(evalUrlRes, 'https://a2ui.org');
  console.log('   ✓ openUrl scheme validation & clipboard/toast fallback verified');

  // 3.4 Capabilities message generator (createRendererCapabilities)
  const defaultCaps = createRendererCapabilities();
  assert.ok(defaultCaps['v1.0'], 'Must contain v1.0 root version');
  assert.ok(Array.isArray(defaultCaps['v1.0'].supportedCatalogIds), 'Must declare supportedCatalogIds array');
  assert.strictEqual(
    defaultCaps['v1.0'].supportedCatalogIds[0],
    'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'
  );

  // Custom supported catalogs
  const customCatalogs = [
    'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
    'com.example:custom-chart-catalog',
  ];
  const customCaps = createRendererCapabilities(customCatalogs);
  assert.deepStrictEqual(customCaps['v1.0'].supportedCatalogIds, customCatalogs);

  // Single string arg
  const singleCap = createRendererCapabilities('my-app:catalog');
  assert.deepStrictEqual(singleCap['v1.0'].supportedCatalogIds, ['my-app:catalog']);
  console.log('   ✓ createRendererCapabilities matches renderer_capabilities.json format');
}

// ====================================================================
// SECTION 4: Module Export Integrity
// ====================================================================
console.log('\n👉 Verify index.js and miniprogram/index.js exports consistency');
{
  const rootIdx = require('../index');
  const mpIdx = require('../miniprogram/index');

  const requiredExports = [
    'A2UIEngine',
    'ErrorCodes',
    'KNOWN_COMPONENTS',
    'createRendererCapabilities',
    'openUrl',
    'executePluralize',
    'CURRENCY_SYMBOLS',
    'getCurrencySymbol',
  ];

  for (const exp of requiredExports) {
    assert.ok(rootIdx[exp] !== undefined, `Root index.js must export ${exp}`);
    assert.ok(mpIdx[exp] !== undefined, `Miniprogram index.js must export ${exp}`);
  }
  console.log('   ✓ Root and miniprogram module exports fully aligned');
}

console.log('\n================================================================');
console.log('🎉 All A2UI v1.0 RPC, Error & core functions tests passed 100%!');
console.log('================================================================\n');
