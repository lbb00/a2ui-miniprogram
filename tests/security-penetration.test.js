/**
 * A2UI MiniProgram Round 4: 终极对抗性攻防与安全渗透测试套件
 * 
 * 专门针对新增的 RPC 信令通道、Markdown 富文本 AST、Flex 权重与扩展函数库
 * 实施恶意注入、边界溢出与破坏性攻击测试，确保绝对企业级健壮性。
 */

const assert = require('assert');
const { A2UIEngine, ErrorCodes, createRendererCapabilities } = require('../miniprogram/core/engine');
const { parseMarkdown, hasMarkdown } = require('../miniprogram/core/markdown');
const { evaluateFunction, formatCurrency, executePluralize } = require('../miniprogram/core/data-model');

console.log('================================================================');
console.log('⚔️  开始执行 Round 4: A2UI 核心能力终极对抗性攻防渗透测试');
console.log('================================================================\n');

// -------------------------------------------------------------
// [对抗测试 1] 攻击 Markdown 解析器：XSS 注入、未闭合语法与极端长文本
// -------------------------------------------------------------
console.log('👉 [对抗攻击 1/5] 渗透测试 Markdown 解析器与 XSS 防护');

// 1.1 恶意 script 标签注入
const xssPayload1 = '**Hello** <script>alert("pwned")</script> World';
const html1 = parseMarkdown(xssPayload1);
assert.ok(!html1.includes('<script>'), '必须防御 <script> 注入');
assert.ok(html1.includes('&lt;script&gt;'), 'script 必须被完整实体转义');
assert.ok(html1.includes('<strong>Hello</strong>'), '正常语法应正确渲染');
console.log('   ✓ 1.1 恶意 script 标签注入被安全拦截转义');

// 1.2 伪造 img onerror 事件注入
const xssPayload2 = '[点击领取](javascript:alert(document.cookie)) <img src="x" onerror="steal()"/>';
const html2 = parseMarkdown(xssPayload2);
assert.ok(!html2.includes('javascript:'), '必须屏蔽 javascript: 伪协议');
assert.ok(!html2.includes('<img'), '必须拦截非法 img 标签');
console.log('   ✓ 1.2 javascript: 伪协议与 img onerror 攻击被安全拦截');

// 1.3 极端未闭合符号与乱序语法防死循环
const brokenMarkdown = '******未闭合加粗 `未闭合代码 [未闭合链接(http://example.com ~~未闭合删除';
const html3 = parseMarkdown(brokenMarkdown);
assert.ok(typeof html3 === 'string', '极端未闭合语法不可报错崩溃');
console.log('   ✓ 1.3 极端未闭合语法与乱序标记防崩溃通过');

// 1.4 万字长文本解析性能防爆
const largeText = '这是普通段落，带有 **加粗文字** 和 `inline_code()` 代码。\n'.repeat(1000);
const startMs = Date.now();
const htmlLarge = parseMarkdown(largeText);
const elapsedMs = Date.now() - startMs;
assert.ok(elapsedMs < 100, `长文本解析耗时需在 100ms 内，实际: ${elapsedMs}ms`);
console.log(`   ✓ 1.4 万字长文本解析性能达标 (耗时: ${elapsedMs}ms)`);

// -------------------------------------------------------------
// [对抗测试 2] 攻击 callRendererFunction RPC 通道：恶意调用与越权注入
// -------------------------------------------------------------
console.log('\n👉 [对抗攻击 2/5] 渗透测试 callRendererFunction 端侧 RPC 通道');

const engine = new A2UIEngine();
const surfaceId = 'surf_attack_test';
engine.processMessage({
  version: 'v1.0',
  createSurface: { surfaceId }
});

// 2.1 恶意调用不存在的特权指令
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
console.log('   ✓ 2.1 未授权特权函数调用被安全拦截');

// 2.2 原型链污染尝试通过 setStorage 渗透
const rpcProto = engine.executeRendererFunction({
  surfaceId,
  functionCallId: 'call_proto_01',
  callFunction: {
    name: 'setStorage',
    args: { key: '__proto__.hacked', value: 'yes' }
  }
});
assert.strictEqual(({}).hacked, undefined);
console.log('   ✓ 2.2 通过 RPC 篡改原型链被安全拦截');

// 2.3 openUrl 恶意跨站协议拦截
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
console.log('   ✓ 2.3 openUrl 恶意协议拦截验证通过');

// 2.4 标准合法 RPC getSystemInfo 与 setClipboard
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
console.log('   ✓ 2.4 标准系统信息与剪贴板合法 RPC 闭环通过');

// -------------------------------------------------------------
// [对抗测试 3] 攻击 Flex 权重与 ownWidth 极端边界
// -------------------------------------------------------------
console.log('\n👉 [对抗攻击 3/5] 验证 Flex weight 畸形边界与 ownWidth 隔离');

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

// 权重 0
assert.strictEqual(cZero.weight, 0);
assert.ok(cZero.flexStyle.includes('flex: 0 1 0%'));

// 负数权重安全规整为 0
assert.strictEqual(cNeg.weight, 0);
assert.ok(cNeg.flexStyle.includes('flex: 0 1 0%'));

// 超大权重安全截断（上限 10000，防止浮点与布局崩溃）
assert.strictEqual(cHuge.weight, 10000);
assert.ok(cHuge.flexStyle.includes('flex: 10000 1 0%'));

// Icon 必须维持 ownWidth (flex: 0 0 auto)
assert.strictEqual(cIcon.ownWidth, true);
assert.ok(cIcon.flexStyle.includes('flex: 0 0 auto'));
console.log('   ✓ 3.1 零权重、负数权重、超大权重及 ownWidth 隔离完全通过');

// -------------------------------------------------------------
// [对抗测试 4] 攻击结构化 Error 消息捕获与上报
// -------------------------------------------------------------
console.log('\n👉 [对抗攻击 4/5] 校验结构化 Error 协议报文规格');

const reportedErrors = [];
engine.onError((err) => {
  reportedErrors.push(err);
});

// 触发 UNKNOWN_COMPONENT
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

assert.ok(reportedErrors.length > 0, '必须捕获并上报错误');
const lastErr = reportedErrors[reportedErrors.length - 1];
assert.strictEqual(lastErr.version, 'v1.0');
assert.strictEqual(lastErr.error.code, ErrorCodes.UNKNOWN_COMPONENT);
assert.strictEqual(lastErr.error.surfaceId, surfaceId);
assert.ok(lastErr.error.message.includes('Quantum3DPortal'));
console.log('   ✓ 4.1 非法组件 UNKNOWN_COMPONENT 结构化上报校验通过');

// -------------------------------------------------------------
// [对抗测试 5] 扩展函数库极端多语言与边界数据攻击
// -------------------------------------------------------------
console.log('\n👉 [对抗攻击 5/5] 测试多语言复数、多币种与 Capability 报文');

// 5.1 货币格式化极端边界
assert.strictEqual(formatCurrency(0, 'EUR'), '€0.00');
assert.strictEqual(formatCurrency(-49.5, 'GBP'), '-£49.50');
assert.strictEqual(formatCurrency(1299, 'JPY'), '¥1299.00');
assert.strictEqual(formatCurrency(88.8, 'UNKNOWN_COIN'), '$88.80');
console.log('   ✓ 5.1 国际货币符号、负数与非法币种回退验证通过');

// 5.2 复杂复数边界
const pluralResZero = executePluralize(0, { zero: '没有消息', one: '一条消息', other: '多条消息' });
assert.strictEqual(pluralResZero, '没有消息');

const pluralResOne = executePluralize(1, { one: '1 item', other: 'many items' });
assert.strictEqual(pluralResOne, '1 item');

const pluralResMany = executePluralize(15, { one: '1 item', other: 'many items' });
assert.strictEqual(pluralResMany, 'many items');

const pluralFallback = executePluralize(99, { other: 'default items' });
assert.strictEqual(pluralFallback, 'default items');
console.log('   ✓ 5.2 复数 zero/one/other 分支与降级验证通过');

// 5.3 握手 Capability 报文生成
const cap = createRendererCapabilities(['https://a2ui.org/custom']);
assert.strictEqual(cap['v1.0'].supportedCatalogIds[0], 'https://a2ui.org/custom');
assert.strictEqual(cap['v1.0'].supportedCatalogIds[1], 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json');
console.log('   ✓ 5.3 客户端能力协商 Capability 报文验证通过');

console.log('\n================================================================');
console.log('🎉 Round 4 终极对抗性攻防渗透测试全部 100% PASS！');
console.log('================================================================');
