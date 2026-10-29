/**
 * A2UI v1.0 协议标准、端云 RPC 交互与端侧函数库专项单测
 * 覆盖：
 * 1. callRendererFunction 端侧函数调用通道 (Agent -> Client RPC)
 * 2. 标准结构化 error 协议消息 (Renderer -> Agent)
 * 3. 增强 Basic Catalog 内置函数库 (formatCurrency 国际化, pluralize 复数分支, openUrl 小程序降级, createRendererCapabilities 能力协商)
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
console.log('🧪 开始执行 A2UI v1.0 协议 RPC、结构化 Error 与核心函数库专项单测');
console.log('================================================================\n');

// ====================================================================
// SECTION 1: callRendererFunction 端侧函数调用通道 (Agent -> Client RPC)
// ====================================================================
console.log('👉 [1/3] 验证 callRendererFunction 端侧函数调用通道与特权函数');

{
  const engine = new A2UIEngine();
  const outboundMessages = [];
  engine.onOutboundMessage((msg) => {
    outboundMessages.push(msg);
  });

  // 初始化一个包含数据模型的 surface
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

  // 1.1 测试 getSystemInfo: 返回设备型号、操作系统、屏幕宽高等系统指标
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
  assert.ok(sysInfoResp, 'callRendererFunction 必须返回响应对象');
  assert.strictEqual(sysInfoResp.version, 'v1.0');
  assert.ok(sysInfoResp.rendererFunctionResponse, '必须封装在 rendererFunctionResponse 节点下');
  assert.strictEqual(sysInfoResp.rendererFunctionResponse.functionCallId, 'call_sys_001');

  // 同时校验 prompt 指定的 response 和 schema 规范的 value
  const sysInfoResult = sysInfoResp.rendererFunctionResponse.response;
  assert.ok(sysInfoResult, '响应体中必须存在 response/value 结果');
  assert.strictEqual(sysInfoResp.rendererFunctionResponse.value, sysInfoResult);
  assert.ok(sysInfoResult.model, '系统信息中必须包含 device model');
  assert.ok(sysInfoResult.system, '系统信息中必须包含 OS system');
  assert.ok(typeof sysInfoResult.screenWidth === 'number', '屏幕宽度必须为数值');
  assert.ok(typeof sysInfoResult.screenHeight === 'number', '屏幕高度必须为数值');
  console.log('   ✓ getSystemInfo 返回有效设备指标 (model, system, screenWidth, screenHeight)');

  // 1.2 测试 setClipboard: 将内容写入剪贴板 (动态绑定 surfaceId 上下文)
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

  // 通过 getClipboard 验证写入生效
  const getClipResp = engine.callRendererFunction({
    functionCallId: 'call_clip_003',
    callFunction: { '@call': 'getClipboard' },
  });
  assert.strictEqual(getClipResp.rendererFunctionResponse.response.data, 'https://a2ui.org/welcome');
  console.log('   ✓ setClipboard 成功通过动态数据绑定写入剪贴板并验证读取');

  // 1.3 测试 vibrate / hapticFeedback: 触发震动反馈
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
  console.log('   ✓ hapticFeedback / vibrate 震动反馈参数动态求解与执行正确');

  // 1.4 测试 getStorage / setStorage: 本地存储读写
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
  console.log('   ✓ getStorage / setStorage 本地存储读写闭环验证通过');

  // 1.5 验证出站监听器 (outbound listener) 实时捕获到所有的 RPC 响应
  const capturedCallIds = outboundMessages
    .filter((m) => m.rendererFunctionResponse)
    .map((m) => m.rendererFunctionResponse.functionCallId);
  assert.ok(capturedCallIds.includes('call_sys_001'));
  assert.ok(capturedCallIds.includes('call_clip_002'));
  assert.ok(capturedCallIds.includes('call_vib_004'));
  assert.ok(capturedCallIds.includes('call_store_set_005'));
  assert.ok(capturedCallIds.includes('call_store_get_006'));
  console.log('   ✓ outboundListener 100% 成功捕获全量 RPC 响应派发报文');

  // 1.6 测试未知函数调用错误响应与优雅降级
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
  assert.ok(unknownFnResp.rendererFunctionResponse.error, '未知函数必须返回 error 字段');
  assert.strictEqual(unknownFnResp.rendererFunctionResponse.error.code, 'UNKNOWN_FUNCTION');
  console.log('   ✓ 未知端侧函数返回符合规范的 UNKNOWN_FUNCTION 结构化错误响应');

  // 1.7 测试自定义端侧函数注册机制
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
  console.log('   ✓ registerRendererFunction 自定义端侧函数扩展验证通过');
}

// ====================================================================
// SECTION 2: 标准结构化 error 协议消息 (Renderer -> Agent)
// ====================================================================
console.log('\n👉 [2/3] 验证标准结构化 error 协议消息与异常自动上报');

{
  const engine = new A2UIEngine();
  const reportedErrors = [];
  engine.onError((err) => {
    reportedErrors.push(err);
  });

  // 2.1 验证 createErrorMessage 格式与标准规范错误码
  const errCodes = [
    ErrorCodes.VALIDATION_FAILED,
    ErrorCodes.UNKNOWN_COMPONENT,
    ErrorCodes.EXECUTION_ERROR,
    ErrorCodes.UNALLOWED_PARENT,
    ErrorCodes.UNALLOWED_CHILD,
  ];

  for (const code of errCodes) {
    const errObj = engine.createErrorMessage('surf_test', code, '/components/0/text', `Test error for ${code}`);
    assert.strictEqual(errObj.version, 'v1.0', '错误消息必须包含 version: v1.0');
    assert.ok(errObj.error, '必须包含 error 主体');
    assert.strictEqual(errObj.error.code, code);
    assert.strictEqual(errObj.error.surfaceId, 'surf_test');
    assert.strictEqual(errObj.error.path, '/components/0/text');
    assert.strictEqual(errObj.error.message, `Test error for ${code}`);
  }
  console.log('   ✓ createErrorMessage 构造全部 5 类标准错误码报文验证通过');

  // 2.2 验证非法组件 (UNKNOWN_COMPONENT) 自动检测并上报
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
            component: 'NonExistent3DCanvas', // 未知非法组件
          },
        ],
      },
    },
  ]);

  const unknownCompErr = reportedErrors.find((e) => e.error && e.error.code === ErrorCodes.UNKNOWN_COMPONENT);
  assert.ok(unknownCompErr, '遇到未知组件 NonExistent3DCanvas 时必须自动生成并派发 UNKNOWN_COMPONENT 错误');
  assert.strictEqual(unknownCompErr.error.surfaceId, 'surf_err_comp');
  assert.ok(unknownCompErr.error.message.includes('NonExistent3DCanvas'));
  console.log('   ✓ 遇到未知组件自动触发 UNKNOWN_COMPONENT 错误回调上报');

  // 2.3 验证组件缺失 ID (VALIDATION_FAILED) 自动检测并上报
  reportedErrors.length = 0;
  engine.process([
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'surf_err_comp',
        components: [
          {
            // 缺失 id
            component: 'Text',
            text: 'No ID',
          },
        ],
      },
    },
  ]);
  const validationErr = reportedErrors.find((e) => e.error && e.error.code === ErrorCodes.VALIDATION_FAILED);
  assert.ok(validationErr, '组件缺失 ID 时必须自动生成 VALIDATION_FAILED 错误');
  console.log('   ✓ 组件缺失 ID 自动触发 VALIDATION_FAILED 错误回调上报');

  // 2.4 验证原型链非法注入等解析异常自动拦截并生成 EXECUTION_ERROR 消息
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
  assert.ok(execErr, '非法数据模型路径操作必须拦截并上报 EXECUTION_ERROR');
  console.log('   ✓ 异常数据注入操作安全拦截并产生 EXECUTION_ERROR 消息');
}

// ====================================================================
// SECTION 3: 增强 Basic Catalog 内置函数库
// ====================================================================
console.log('\n👉 [3/3] 验证增强 Basic Catalog 内置函数库 (formatCurrency, pluralize, openUrl, capabilities)');

{
  // 3.1 formatCurrency 国际化货币符号补齐
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
    { currency: undefined, val: 250, expected: '$250.00' }, // 未指定时默认 $
    { currency: null, val: 10, expected: '$10.00' },
    { currency: 'EUR', val: -49.9, expected: '-€49.90' }, // 负数
    { currency: 'USD', val: 1234567.89, grouping: true, expected: '$1,234,567.89' }, // 千分位
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
      `formatCurrency [${c.currency || 'default'}] 预期 ${c.expected}，实际 ${res}`
    );
  }
  console.log('   ✓ formatCurrency 国际化货币符号 (EUR, GBP, JPY, CNY, INR, CAD, AUD, USD, KRW, 缺省) 100% 正确');

  // 3.2 pluralize 完整复数函数 (zero, one, two, few, many, other)
  const forms = {
    zero: 'no tickets left',
    one: '1 ticket available',
    two: 'a pair of tickets',
    few: 'a few tickets remaining',
    many: 'many tickets in stock',
    other: 'several tickets available',
  };

  // 分支测试
  assert.strictEqual(executePluralize(0, forms), 'no tickets left');
  assert.strictEqual(executePluralize(1, forms), '1 ticket available');
  assert.strictEqual(executePluralize(2, forms), 'a pair of tickets');
  assert.strictEqual(executePluralize(5, forms), 'several tickets available');

  // 当 zero 未指定时降级 other
  assert.strictEqual(
    executePluralize(0, { one: '1 apple', other: 'many apples' }),
    'many apples'
  );

  // 当 two 未指定时降级 other
  assert.strictEqual(
    executePluralize(2, { one: '1 apple', other: 'apples' }),
    'apples'
  );

  // 带有 Russian 规则的 few / many 测试
  assert.strictEqual(
    executePluralize(3, forms, 'ru'),
    'a few tickets remaining'
  );
  assert.strictEqual(
    executePluralize(5, forms, 'ru'),
    'many tickets in stock'
  );

  // 通过 evaluateFunction 测试调用
  const pluralRes = evaluateFunction('pluralize', {
    value: 1,
    one: 'item',
    other: 'items',
  });
  assert.strictEqual(pluralRes, 'item');
  console.log('   ✓ pluralize 完整复数分支 (zero, one, two, few, many, other) 动态匹配正确');

  // 3.3 openUrl 规范与小程序降级体验
  resetMockState();

  // 合法 HTTPS 链接
  const openRes1 = openUrl('https://mp.weixin.qq.com/guide');
  assert.strictEqual(openRes1.success, true);
  assert.strictEqual(openRes1.url, 'https://mp.weixin.qq.com/guide');
  assert.strictEqual(openRes1.action, 'copied_to_clipboard');
  const mockState1 = getMockState();
  assert.strictEqual(mockState1.clipboard, 'https://mp.weixin.qq.com/guide');
  assert.strictEqual(mockState1.toast.title, '链接已复制，请在浏览器中打开');

  // 合法 HTTP 链接
  const openRes2 = openUrl('http://example.com/spec');
  assert.strictEqual(openRes2.success, true);

  // 非法非 HTTP/HTTPS 链接（防 XSS 注入）
  const openResBad1 = openUrl('javascript:alert(1)');
  assert.strictEqual(openResBad1.success, false);
  assert.ok(openResBad1.error.includes('only HTTP/HTTPS are allowed'));

  const openResBad2 = openUrl('file:///etc/passwd');
  assert.strictEqual(openResBad2.success, false);

  const openResBad3 = openUrl('');
  assert.strictEqual(openResBad3.success, false);

  // 通过 evaluateFunction 测试
  const evalUrlRes = evaluateFunction('openUrl', { url: 'https://a2ui.org' });
  assert.strictEqual(evalUrlRes, 'https://a2ui.org');
  console.log('   ✓ openUrl 规范协议校验与微信小程序剪贴板复制/Toast降级体验通过');

  // 3.4 能力协商报文生成器 (createRendererCapabilities)
  // 默认能力
  const defaultCaps = createRendererCapabilities();
  assert.ok(defaultCaps['v1.0'], '必须包含 v1.0 顶层版本');
  assert.ok(Array.isArray(defaultCaps['v1.0'].supportedCatalogIds), '必须声明 supportedCatalogIds 数组');
  assert.strictEqual(
    defaultCaps['v1.0'].supportedCatalogIds[0],
    'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'
  );

  // 自定义支持的 Catalog 列表
  const customCatalogs = [
    'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
    'com.example:custom-chart-catalog',
  ];
  const customCaps = createRendererCapabilities(customCatalogs);
  assert.deepStrictEqual(customCaps['v1.0'].supportedCatalogIds, customCatalogs);

  // 单字符串入参
  const singleCap = createRendererCapabilities('my-app:catalog');
  assert.deepStrictEqual(singleCap['v1.0'].supportedCatalogIds, ['my-app:catalog']);
  console.log('   ✓ createRendererCapabilities 符合 renderer_capabilities.json 标准格式');
}

// ====================================================================
// SECTION 4: 模块导出健全性断言
// ====================================================================
console.log('\n👉 验证 index.js 与 miniprogram/index.js 新增特性导出一致性');
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
    assert.ok(rootIdx[exp] !== undefined, `根模块 index.js 必须导出 ${exp}`);
    assert.ok(mpIdx[exp] !== undefined, `小程序目录 miniprogram/index.js 必须导出 ${exp}`);
  }
  console.log('   ✓ 根目录与小程序目录双向模块导出完全对齐');
}

console.log('\n================================================================');
console.log('🎉 全部 A2UI v1.0 RPC 通道、结构化 Error 及核心函数单测 100% PASS！');
console.log('================================================================\n');
