const assert = require('assert');
const { evaluateFunction, openUrl } = require('../miniprogram/core/data-model');
const { toPropertyPath, computeTreePatches } = require('../miniprogram/core/pointer');
const { A2UIEngine } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🛡️  开始执行数据流、ReDoS 与输入定向差量更新核心加固单测');
console.log('================================================================');

// ----------------------------------------------------
// 1. openUrl 纯函数求值与无副作用验证
// ----------------------------------------------------
console.log('👉 [1/3] 验证 evaluateFunction openUrl 纯函数求值与无副作用');
{
  // 模拟微信环境
  let clipboardCalled = false;
  let toastCalled = false;
  global.wx = {
    setClipboardData: () => { clipboardCalled = true; },
    showToast: () => { toastCalled = true; },
  };

  const valid1 = evaluateFunction('openUrl', { url: 'https://mp.weixin.qq.com/docs' });
  assert.strictEqual(valid1, 'https://mp.weixin.qq.com/docs', '合法 HTTPS 必须清洗返回');
  assert.strictEqual(clipboardCalled, false, '纯求值严禁调用 wx.setClipboardData');
  assert.strictEqual(toastCalled, false, '纯求值严禁调用 wx.showToast');

  const valid2 = evaluateFunction('openUrl', { target: 'http://a2ui.org/spec' });
  assert.strictEqual(valid2, 'http://a2ui.org/spec', '支持 target 参数并清洗返回');

  const invalidScheme = evaluateFunction('openUrl', { url: 'javascript:alert(1)' });
  assert.strictEqual(invalidScheme, '', '恶意 javascript: 伪协议必须返回空串');

  const fileScheme = evaluateFunction('openUrl', { url: 'file:///etc/passwd' });
  assert.strictEqual(fileScheme, '', 'file: 协议必须返回空串');

  const emptyUrl = evaluateFunction('openUrl', { url: '   ' });
  assert.strictEqual(emptyUrl, '', '空 URL 必须返回空串');

  // 清理全局 mock
  delete global.wx;
  console.log('   ✓ openUrl 纯函数求值与系统 API 零副作用校验 100% 通过');
}

// ----------------------------------------------------
// 2. regex 正则表达式安全 (ReDoS 防御)
// ----------------------------------------------------
console.log('👉 [2/3] 验证 regex ReDoS 指数级回溯防御与边界截断');
{
  // 待测试文本 > 1000 字符限制
  const longText = 'a'.repeat(1001);
  const resLongText = evaluateFunction('regex', { pattern: '^a+$', value: longText });
  assert.strictEqual(resLongText, false, '超长文本 (>1000) 必须直接安全拒绝');

  // 正则模式 > 200 字符限制
  const longPattern = '^(' + 'a'.repeat(200) + ')+$';
  const resLongPattern = evaluateFunction('regex', { pattern: longPattern, value: 'aaa' });
  assert.strictEqual(resLongPattern, false, '超长正则模式 (>200) 必须直接安全拒绝');

  // 嵌套与危险量词拦截
  const dangerousPatterns = [
    '((a+)+)+$',
    '(a+)+',
    '(.*a){10,}',
    '([a-z]+)*',
    '(a|b+)+',
    '(a*)*',
    '([0-9]{1,}){5,}',
    '(a+){10,}',
    '(?:a+)+',
    'a++',
    'a**',
  ];

  for (const pat of dangerousPatterns) {
    const res = evaluateFunction('regex', { pattern: pat, value: 'aaaaaaaaaaaaaaaaaaaaa!' });
    assert.strictEqual(res, false, `高危 ReDoS 模式 "${pat}" 必须被安全拦截拒绝`);
  }

  // 正常合法模式正常求值
  const ok1 = evaluateFunction('regex', { pattern: '^\\d{3}-\\d{4}$', value: '123-4567' });
  assert.strictEqual(ok1, true, '正常合法正则匹配成功');

  const ok2 = evaluateFunction('regex', { pattern: '^[a-zA-Z0-9_]+@[a-zA-Z0-9]+\\.[a-zA-Z]{2,4}$', value: 'admin@test.com' });
  assert.strictEqual(ok2, true, '常见安全邮箱正则校验通过');

  console.log('   ✓ regex ReDoS 安全防爆与嵌套量词拦截 100% 通过');
}

// ----------------------------------------------------
// 3. 输入防跳动与定向差量刷新
// ----------------------------------------------------
console.log('👉 [3/3] 验证 computeTreePatches 定向差量刷新与受控输入防跳动');
{
  // 1. toPropertyPath 寻址转换
  const path1 = toPropertyPath(['children', 0, 'children', 1, 'value'], 'localRenderTree');
  assert.strictEqual(path1, 'localRenderTree.children[0].children[1].value');

  const path2 = toPropertyPath(['todos', 3, 'title']);
  assert.strictEqual(path2, 'todos[3].title');

  // 2. 模拟表单界面
  const oldTree = {
    id: 'root',
    component: 'Column',
    children: [
      {
        id: 'u_in',
        sourceId: 'u_in',
        component: 'TextField',
        value: 'admin',
        validationError: null,
      },
      {
        id: 'p_in',
        sourceId: 'p_in',
        component: 'TextField',
        value: '123',
        validationError: null,
      },
      {
        id: 'btn_submit',
        sourceId: 'btn_submit',
        component: 'Button',
        text: '登录',
        disabled: false,
      },
    ],
  };

  const newTree = {
    id: 'root',
    component: 'Column',
    children: [
      {
        id: 'u_in',
        sourceId: 'u_in',
        component: 'TextField',
        value: 'admin_typing',
        validationError: null,
      },
      {
        id: 'p_in',
        sourceId: 'p_in',
        component: 'TextField',
        value: '123',
        validationError: null,
      },
      {
        id: 'btn_submit',
        sourceId: 'btn_submit',
        component: 'Button',
        text: '登录',
        disabled: true, // checks 动态导致按钮禁用
      },
    ],
  };

  // 用户正在在 u_in 输入框键入内容
  const patches = computeTreePatches(oldTree, newTree, 'localRenderTree', {
    activeComponentId: 'u_in',
  });

  // 核心断言：
  // 1. u_in 的 value 绝对不能出现在 patches 中（真机原生 input 已包含用户打字，再次回传 value 会触发光标跳动与失焦）
  assert.strictEqual(patches['localRenderTree.children[0].value'], undefined, '受控输入框自身 value 绝不回写 setData');

  // 2. 联动受影响的按钮 disabled 必须精准定向刷新
  assert.strictEqual(patches['localRenderTree.children[2].disabled'], true, '其他受控组件属性必须精确定向更新');

  // 3. 验证 engine.handleInputChange 支持 options.silent
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: 's1',
        dataModel: { text: 'hello' },
        components: [
          { id: 'root', component: 'TextField', value: { '@path': '/text' } },
        ],
      },
    },
  ]);

  let notifyCalled = false;
  engine.subscribe(() => { notifyCalled = true; });

  engine.handleInputChange('s1', '/text', 'world', { silent: true });
  assert.strictEqual(notifyCalled, false, 'options.silent 为 true 时不触发全局 notify');
  assert.strictEqual(engine.surfaces.get('s1').dataModel.text, 'world', '数据模型仍精确反写');

  console.log('   ✓ computeTreePatches 定向差量与受控输入防跳动校验 100% 通过');
}

console.log('\n================================================================');
console.log('🎉 核心加固专项单测全部 100% PASS！');
console.log('================================================================\n');
