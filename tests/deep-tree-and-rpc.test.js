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
console.log('⚔️  开始执行 Round 10: 对抗性渗透加固与全要素一致性验证套件');
console.log('================================================================\n');

// =========================================================================
// [1] Markdown 链接 URL 参数无双重转义 (No Double Escaping &amp;amp;)
// =========================================================================
console.log('👉 [1/8] 验证 Markdown 链接多参数与特殊字符单次规范转义');
{
  const mdText = '请点击 [授权中心](https://example.com/oauth/authorize?client_id=123&redirect_uri=https://app.com/cb&scope=read&state=xyz)';
  const html = parseMarkdown(mdText);

  // 绝不能出现 &amp;amp; 畸变
  assert.strictEqual(html.includes('&amp;amp;'), false, 'URL 中的 & 绝不能被二次转义为 &amp;amp;');
  assert.ok(html.includes('href="https://example.com/oauth/authorize?client_id=123&amp;redirect_uri=https://app.com/cb&amp;scope=read&amp;state=xyz"'), 'URL 中的 & 应在 HTML 属性中正确单次转义为 &amp;');

  // 恶意协议链接安全拦截
  const maliciousMd = '[恶意点击](javascript:alert(1)) 和 [数据伪协议](data:text/html,<script>alert(1)</script>)';
  const safeHtml = parseMarkdown(maliciousMd);
  assert.ok(safeHtml.includes('data-href="#"'), 'javascript: 伪协议必须被降级为 #');
  assert.strictEqual(safeHtml.includes('javascript:'), false, '输出 HTML 绝不能包含 javascript:');
  console.log('   ✓ Markdown URL 多查询参数与 XSS 安全防御验证通过');
}

// =========================================================================
// [2] findCloseBrace 奇偶转义反斜杠精准识别
// =========================================================================
console.log('\n👉 [2/8] 验证 findCloseBrace 与 parseNamedArgs 结尾反斜杠转义');
{
  // 字符串字面量中包含连续偶数个反斜杠 (表示单个转义的反斜杠本身，如 "path\\")
  const exprWithEscapedBs = 'prefix ${formatString(value: "hello\\\\")} suffix';
  const resolved = resolveValue(exprWithEscapedBs, {});
  assert.strictEqual(resolved, 'prefix hello\\ suffix', '偶数反斜杠应正确识别为非转义闭合引号');

  // 单位置参数带偶数反斜杠
  const exprPositionalBs = '${formatString("test\\\\")}';
  const resolvedPos = resolveValue(exprPositionalBs, {});
  assert.strictEqual(resolvedPos, 'test\\', '单位置参数带转义反斜杠应正确解析');
  console.log('   ✓ 奇偶反斜杠判定与花括号闭合解析验证通过');
}

// =========================================================================
// [3] 单位置参数缺省映射为 'value'
// =========================================================================
console.log('\n👉 [3/8] 验证 ${func(path)} 单位置参数缺省映射为 value');
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
  assert.strictEqual(notRes, 'true', 'not(/isRegistered) 必须正确将 /isRegistered 映射为 value 求值');

  // not(/isAdmin) -> false
  const notAdminRes = resolveValue('${not(/isAdmin)}', dataModel);
  assert.strictEqual(notAdminRes, 'false', 'not(/isAdmin) 必须求值为 false');

  // required(/email) -> true
  const reqEmail = resolveValue('${required(/email)}', dataModel);
  assert.strictEqual(reqEmail, 'true', 'required(/email) 必须求值为 true');

  // required(/emptyStr) -> false
  const reqEmpty = resolveValue('${required(/emptyStr)}', dataModel);
  assert.strictEqual(reqEmpty, 'false', 'required(/emptyStr) 必须求值为 false');

  // formatDate(/timestamp) -> 2024-xx-xx
  const dateFormatted = resolveValue('${formatDate(/timestamp)}', dataModel);
  assert.match(dateFormatted, /^\d{4}-\d{2}-\d{2}$/, 'formatDate(/timestamp) 单参数应正确输出标准日期');

  console.log('   ✓ 单位置参数自动缺省映射为 value 验证通过');
}

// =========================================================================
// [4] A2UIEngine.registerCustomComponent 与 registerComponent 双别名
// =========================================================================
console.log('\n👉 [4/8] 验证 A2UIEngine 自定义组件注册双别名');
{
  const engine = new A2UIEngine();
  assert.strictEqual(typeof engine.registerComponent, 'function');
  assert.strictEqual(typeof engine.registerCustomComponent, 'function');

  // 分别通过两种别名注册
  engine.registerComponent('MapMarker');
  engine.registerCustomComponent('AudioWave');

  assert.ok(engine.customComponents.has('MapMarker'));
  assert.ok(engine.customComponents.has('AudioWave'));

  // 验证注册的自定义组件在 updateComponents 时不会触发 UNKNOWN_COMPONENT 错误
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
  assert.strictEqual(errorTriggered, false, '已注册的自定义组件不应报错');
  console.log('   ✓ registerCustomComponent 与 registerComponent 双别名验证通过');
}

// =========================================================================
// [5] engine.process() 返回值契约与批量处理
// =========================================================================
console.log('\n👉 [5/8] 验证 engine.process() 返回受影响的 surfaceId 或 RPC 结果');
{
  const engine = new A2UIEngine();

  // 1. 处理单个 surface 消息 -> 返回 surfaceId 字符串
  const resSingle = engine.process({
    version: 'v1.0',
    createSurface: {
      surfaceId: 'surf_p1',
      components: [{ id: 'root', component: 'Text', text: 'Hello' }],
    },
  });
  assert.strictEqual(resSingle, 'surf_p1', '单个 surface 消息应返回对应的 surfaceId');

  // 2. 处理多个 surface 消息 -> 返回 surfaceId 数组
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
  assert.deepStrictEqual(resMulti, ['surf_p2', 'surf_p3'], '多个 surface 消息应返回受影响的所有 surfaceId 数组');

  // 3. 处理 RPC 消息 -> 返回 RPC 响应报文
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

  console.log('   ✓ engine.process() 返回值契约与多消息批量处理验证通过');
}

// =========================================================================
// [6] callRendererFunction 可选 surfaceId 与自定义异常错误码透传
// =========================================================================
console.log('\n👉 [6/8] 验证 callRendererFunction 可选 surfaceId 与自定义异常错误码');
{
  const engine = new A2UIEngine();

  // 注册一个会抛出特定错误码的特权函数
  engine.registerRendererFunction('customRpcFail', () => {
    const err = new Error('Resource authorization timeout');
    err.code = 'TIMEOUT';
    throw err;
  });

  // surfaceId 缺省调用 (无 surfaceId 字段)
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
  assert.strictEqual(rpcResp.rendererFunctionResponse.error.code, 'TIMEOUT', '自定义抛出的 TIMEOUT 错误码必须被准确透传，不能被降级为 generic EXECUTION_ERROR');
  assert.ok(rpcResp.rendererFunctionResponse.error.message.includes('timeout'));

  console.log('   ✓ callRendererFunction 可选 surfaceId 与错误码精准透传验证通过');
}

// =========================================================================
// [7] ChoicePicker 选项含 0, false, 负数时的严谨判定
// =========================================================================
console.log('\n👉 [7/8] 验证 ChoicePicker 选项值为 0, false, 负数时的状态判定');
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
            label: '评分',
            value: { '@path': '/selectedRating' },
            options: [
              { label: '0 星 (很差)', value: 0 },
              { label: '1 星 (一般)', value: 1 },
              { label: '5 星 (很好)', value: 5 },
            ],
          },
          {
            id: 'status_picker',
            component: 'ChoicePicker',
            label: '开关状态',
            value: { '@path': '/selectedStatus' },
            options: [
              { label: '关闭 (False)', value: false },
              { label: '开启 (True)', value: true },
            ],
          },
          {
            id: 'delta_picker',
            component: 'ChoicePicker',
            label: '增量',
            value: { '@path': '/selectedDelta' },
            options: [
              { label: '负 5', value: -5 },
              { label: '0', value: 0 },
              { label: '正 5', value: 5 },
            ],
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.ok(tree);

  // 1. rating_picker: 值为 0，应准确选中选项 0
  const ratingNode = tree.children[0];
  assert.strictEqual(ratingNode.selectedIndex, 0);
  assert.strictEqual(ratingNode.displayLabel, '0 星 (很差)');
  assert.strictEqual(ratingNode.options[0].selected, true);
  assert.strictEqual(ratingNode.options[1].selected, false);

  // 2. status_picker: 值为 false，应准确选中选项 false
  const statusNode = tree.children[1];
  assert.strictEqual(statusNode.selectedIndex, 0);
  assert.strictEqual(statusNode.displayLabel, '关闭 (False)');
  assert.strictEqual(statusNode.options[0].selected, true);
  assert.strictEqual(statusNode.options[1].selected, false);

  // 3. delta_picker: 值为 -5，应准确选中选项 -5
  const deltaNode = tree.children[2];
  assert.strictEqual(deltaNode.selectedIndex, 0);
  assert.strictEqual(deltaNode.displayLabel, '负 5');
  assert.strictEqual(deltaNode.options[0].selected, true);

  console.log('   ✓ ChoicePicker 针对 0、false、负数等假值边界值精准识别验证通过');
}

// =========================================================================
// [8] 深度溢出跳板 (Level Fallback) > 8 层递归渲染
// =========================================================================
console.log('\n👉 [8/8] 验证突破 8 层嵌套深度的跳板递归组装与节点推导');
{
  const engine = new A2UIEngine();
  const S = 'surf_deep_nesting';

  // 组装 10 层嵌套的 Column -> Column -> ... -> Button
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
  assert.ok(tree, '10 层深度树应成功生成');

  // 递归遍历到达底层
  let curr = tree;
  let d = 0;
  while (curr.children && curr.children.length > 0) {
    curr = curr.children[0];
    d++;
  }
  assert.strictEqual(d, 10, '深度必须准确到达 10 层');
  assert.strictEqual(curr.component, 'Button');
  assert.strictEqual(curr.text, 'Deep Button Level 10');

  // 验证最深层 Action 消息可正确创建
  const actionMsg = engine.createActionMessage(S, 'deep_leaf_btn');
  assert.ok(actionMsg);
  assert.strictEqual(actionMsg.action.name, 'deep_click');
  assert.strictEqual(actionMsg.action.context.depth, 10);

  console.log('   ✓ 10 层深度跳板展开与深层 Action 消息构建 100% 通过');
}

console.log('\n================================================================');
console.log('🎉 全部 8 项 Round 10 对抗性审查与全要素一致性测试 100% PASS！');
console.log('================================================================\n');
