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
console.log('⚔️  开始执行 Round 9: 全方位对抗性渗透审查与缺陷加固验证套件');
console.log('================================================================');

// =========================================================================
// [1] 正则边界定界符识别与反假拒绝 (Semicolon & Underscore Boundary Delimiters)
// =========================================================================
console.log('\n👉 [1/7] 验证分号与下划线边界定界符识别与安全放行');
{
  // 1.1 分号结尾的分组重复 (如分号分隔列表)
  const semiPattern = '^([a-zA-Z0-9]+;)+$';
  assert.strictEqual(isSafeRegex(semiPattern), true, '分号边界定界符模式必须被识别为安全');
  const semiRes = evaluateFunction('regex', {
    pattern: semiPattern,
    value: 'item1;item2;item3;'
  });
  assert.strictEqual(semiRes, true, '分号列表正则匹配结果必须为 true');

  // 1.2 下划线边界定界符 (如 word_word_)
  const underscorePattern = '^([a-zA-Z0-9]+_)+$';
  assert.strictEqual(isSafeRegex(underscorePattern), true, '下划线边界定界符模式必须被识别为安全');
  const underRes = evaluateFunction('regex', {
    pattern: underscorePattern,
    value: 'token_alpha_beta_'
  });
  assert.strictEqual(underRes, true, '下划线边界正则匹配结果必须为 true');

  // 1.3 未闭合字符类异常拦截 (如 [a-z)
  assert.strictEqual(isSafeRegex('[a-z'), false, '未闭合字符类模式必须被拦截返回 false');
  assert.strictEqual(isSafeRegex('^abc['), false, '未闭合字符类 [ 必须被拦截返回 false');

  // 1.4 高危 ReDoS 回溯模式严格拦截 (< 5ms)
  const dangerousList = [
    '^(a+a?)+$',
    '^(a?a+)+$',
    '^(a|ab)+$',
    '^(ab|a)+$',
    '^([a-z0-9]+_[a-z0-9]+)+$', // 组内未以定界符为边界导致跨迭代指数回溯
  ];
  for (const pat of dangerousList) {
    const t0 = Date.now();
    const isSafe = isSafeRegex(pat);
    const elapsed = Date.now() - t0;
    assert.strictEqual(isSafe, false, `高危模式 "${pat}" 必须被拒绝`);
    assert(elapsed < 5, `分析耗时过长: ${elapsed}ms`);
  }
  console.log('   ✓ 分号/下划线边界定界符识别放行与未闭合字符类/高危 ReDoS 拦截通过');
}

// =========================================================================
// [2] setIn 与 updateDataModel 深度原型链过滤 (Prototype Pollution Defense)
// =========================================================================
console.log('\n👉 [2/7] 验证 setIn 与 updateDataModel 根替换及子节点原型链深度净化');
{
  // 2.1 根替换含有 __proto__ 属性的恶意对象
  const evilPayload = JSON.parse('{"__proto__": {"injected": "hacked"}, "role": "admin", "name": "Alice"}');
  const cleanedRoot = setIn({}, [], evilPayload);
  assert.strictEqual(cleanedRoot.role, 'admin');
  assert.strictEqual(cleanedRoot.name, 'Alice');
  assert.strictEqual(Object.prototype.injected, undefined, 'Object.prototype 绝不能被污染');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(cleanedRoot, '__proto__'), false, '__proto__ 必须被过滤');

  // 2.2 子字段设值包含 constructor / prototype
  const evilChild = JSON.parse('{"constructor": "bad", "score": 100}');
  const target = {};
  setIn(target, ['profile'], evilChild);
  assert.strictEqual(target.profile.score, 100);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(target.profile, 'constructor'), false);

  // 2.3 通过 A2UIEngine updateDataModel 模拟恶意根注入
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
  assert.strictEqual(Object.prototype.evil, undefined, '原型链必须安全无污染');
  console.log('   ✓ 根替换与子节点原型链深度安全净化验证通过');
}

// =========================================================================
// [3] 时间戳字符串与 TR35 单引号转义 (Date & TR35 Formatting)
// =========================================================================
console.log('\n👉 [3/7] 验证纯数字字符串时间戳解析与 TR35 单引号转义');
{
  // 3.1 纯数字毫秒时间戳字符串 (13位)
  const msTimestampStr = '1730160000000';
  const formattedMs = evaluateFunction('formatDate', { value: msTimestampStr, format: 'yyyy-MM-dd' });
  assert.strictEqual(formattedMs.length, 10, '13位时间戳字符串必须正确解析格式化');
  assert.match(formattedMs, /^\d{4}-\d{2}-\d{2}$/);

  // 3.2 纯数字秒时间戳字符串 (10位)
  const secTimestampStr = '1730160000';
  const formattedSec = evaluateFunction('formatDate', { value: secTimestampStr, format: 'yyyy-MM-dd' });
  assert.strictEqual(formattedSec.length, 10, '10位时间戳字符串必须正确解析格式化');
  assert.match(formattedSec, /^\d{4}-\d{2}-\d{2}$/);

  // 3.3 TR35 单引号字面量中连续两个单引号 '' 转义为单个单引号 '
  const dateObj = new Date(2026, 9, 29, 14, 30, 0); // 14:30
  const tr35Formatted = formatTR35Date(dateObj, "HH:mm 'o''clock'");
  assert.strictEqual(tr35Formatted, "14:30 o'clock", "TR35 'o''clock' 必须格式化为 14:30 o'clock");
  console.log('   ✓ 时间戳数字字符串兼容与 TR35 引号转义格式化验证通过');
}

// =========================================================================
// [4] Markdown 代码块 (<pre><code class="a2ui-code-block">) 与 XSS 安全过滤
// =========================================================================
console.log('\n👉 [4/7] 验证 Markdown 多行围栏代码块解析与 XSS 防护');
{
  const mdCode = '```javascript\nconst a = 1;\nif (a < 2) {\n  console.log("hello");\n}\n```';
  assert.strictEqual(hasMarkdown(mdCode), true, 'hasMarkdown 必须识别围栏代码块');
  const parsedHtml = parseMarkdown(mdCode);
  assert.ok(parsedHtml.includes('<pre class="a2ui-pre">'), '必须包含 <pre class="a2ui-pre">');
  assert.ok(parsedHtml.includes('<code class="a2ui-code-block">'), '必须包含 <code class="a2ui-code-block">');
  assert.ok(parsedHtml.includes('const a = 1;'), '代码内容完整保留');
  assert.ok(parsedHtml.includes('&lt; 2'), '< 字符必须被实体转义防范 XSS');
  assert.ok(parsedHtml.includes('&quot;hello&quot;'), '双引号实体转义防范注入');

  // 4.2 混合段落与代码块
  const mixedMd = '前序说明文字：\n\n```python\nprint("hi")\n```\n\n后续总结段落。';
  const mixedHtml = parseMarkdown(mixedMd);
  assert.ok(mixedHtml.includes('<p>前序说明文字：</p>'));
  assert.ok(mixedHtml.includes('<pre class="a2ui-pre">'));
  assert.ok(mixedHtml.includes('<p>后续总结段落。</p>'));
  console.log('   ✓ Markdown 围栏代码块规范解析与 XSS 安全防御验证通过');
}

// =========================================================================
// [5] ChoicePicker 选项 label 与 value 区分消除错选 (Disambiguation)
// =========================================================================
console.log('\n👉 [5/7] 验证 ChoicePicker 当 label 与 value 存在数字冲突时的精准判定');
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
          // 故意构造冲突选项：选项A label="0" value=1, 选项B label="1" value=0
          options: [
            { label: '0', value: 1 },
            { label: '1', value: 0 },
          ],
          value: [0], // 期望选中选项B (value === 0)
        },
      ],
    },
  });

  const tree = engine.getRenderTree(S);
  const pickerNode = tree.children[0];
  assert.strictEqual(pickerNode.options[0].selected, false, '选项A (value=1) 不应该被选中');
  assert.strictEqual(pickerNode.options[1].selected, true, '选项B (value=0) 必须准确被选中');
  assert.strictEqual(pickerNode.selectedIndex, 1, 'selectedIndex 必须为 1');
  assert.strictEqual(pickerNode.displayLabel, '1', 'displayLabel 必须为选项B的 label');
  console.log('   ✓ ChoicePicker 选项值与文本严格隔离消歧验证通过');
}

// =========================================================================
// [6] Surface 组件出站事件与外部引擎监听器同步 (Outbound Sync)
// =========================================================================
console.log('\n👉 [6/7] 验证 a2ui-surface 点击 Action 时同步派发外部引擎 outboundListeners');
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
          text: '立即选座',
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

  // 外部订阅者（如 Agent 循环或 WebSocket）
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

  // 模拟用户点击按钮
  surfaceInstance.dispatchTapEvent('btn_sync');

  // 1. 外部引擎监听器必须收到出站动作报文
  assert.strictEqual(engineOutboundEvents.length, 1, '外部引擎监听器必须接收到出站 Action 报文');
  assert.strictEqual(engineOutboundEvents[0].action.name, 'select_seat');
  assert.strictEqual(engineOutboundEvents[0].action.context.seat, '12A');

  // 2. 组件自身派发 action 与 a2uiEvent，但不能因内部监听重复派发两次 a2uiEvent
  const a2uiEvents = triggeredEvents.filter((e) => e.name === 'a2uiEvent');
  assert.strictEqual(a2uiEvents.length, 1, 'a2uiEvent 必须只派发一次，杜绝重复冒泡');

  const actionEvents = triggeredEvents.filter((e) => e.name === 'action');
  assert.strictEqual(actionEvents.length, 1, 'action 必须正确派发一次');
  console.log('   ✓ Surface 点击 Action 同步派发引擎 outbound 且无重复冒泡验证通过');
}

// =========================================================================
// [7] email 函数健壮性与空值拦截
// =========================================================================
console.log('\n👉 [7/7] 验证 email 函数边缘场景与多参数名兼容');
{
  assert.strictEqual(evaluateFunction('email', { value: 'user@example.com' }), true);
  assert.strictEqual(evaluateFunction('email', { email: 'user@example.com' }), true);
  assert.strictEqual(evaluateFunction('email', { text: 'user@example.com' }), true);
  assert.strictEqual(evaluateFunction('email', { value: '' }), false);
  assert.strictEqual(evaluateFunction('email', { value: null }), false);
  assert.strictEqual(evaluateFunction('email', { value: undefined }), false);
  assert.strictEqual(evaluateFunction('email', { value: 'not-an-email' }), false);
  assert.strictEqual(evaluateFunction('email', { value: 'user@domain' }), false);
  console.log('   ✓ email 校验函数多参数名与边缘空值健壮性验证通过');
}

console.log('\n================================================================');
console.log('🎉 全部 7 项 Round 9 对抗性渗透与加固测试 100% PASS！');
console.log('================================================================\n');
