const assert = require('assert');
const { evaluateFunction, openUrl } = require('../miniprogram/core/data-model');
const { toPropertyPath, computeTreePatches } = require('../miniprogram/core/pointer');
const { A2UIEngine } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🛡️ Running core reinforcement tests for data flow, ReDoS defense, and input patching');
console.log('================================================================');

// ----------------------------------------------------
// 1. openUrl pure function evaluation and zero side-effects
// ----------------------------------------------------
console.log('👉 [1/3] Verify evaluateFunction openUrl pure evaluation and zero side effects');
{
  let clipboardCalled = false;
  let toastCalled = false;
  global.wx = {
    setClipboardData: () => { clipboardCalled = true; },
    showToast: () => { toastCalled = true; },
  };

  const valid1 = evaluateFunction('openUrl', { url: 'https://mp.weixin.qq.com/docs' });
  assert.strictEqual(valid1, 'https://mp.weixin.qq.com/docs', 'Valid HTTPS URL must be sanitized and returned');
  assert.strictEqual(clipboardCalled, false, 'Pure evaluation must never invoke wx.setClipboardData');
  assert.strictEqual(toastCalled, false, 'Pure evaluation must never invoke wx.showToast');

  const valid2 = evaluateFunction('openUrl', { target: 'http://a2ui.org/spec' });
  assert.strictEqual(valid2, 'http://a2ui.org/spec', 'Target parameter supported and sanitized');

  const invalidScheme = evaluateFunction('openUrl', { url: 'javascript:alert(1)' });
  assert.strictEqual(invalidScheme, '', 'Malicious javascript: pseudo-protocol must return empty string');

  const fileScheme = evaluateFunction('openUrl', { url: 'file:///etc/passwd' });
  assert.strictEqual(fileScheme, '', 'file: protocol must return empty string');

  const emptyUrl = evaluateFunction('openUrl', { url: '   ' });
  assert.strictEqual(emptyUrl, '', 'Empty URL must return empty string');

  delete global.wx;
  console.log('   ✓ openUrl pure evaluation and zero side effects verified');
}

// ----------------------------------------------------
// 2. regex security and ReDoS defense
// ----------------------------------------------------
console.log('👉 [2/3] Verify regex ReDoS exponential backtracking defense and boundary truncation');
{
  const longText = 'a'.repeat(1001);
  const resLongText = evaluateFunction('regex', { pattern: '^a+$', value: longText });
  assert.strictEqual(resLongText, false, 'Overly long text (>1000 chars) must be safely rejected');

  const longPattern = '^(' + 'a'.repeat(200) + ')+$';
  const resLongPattern = evaluateFunction('regex', { pattern: longPattern, value: 'aaa' });
  assert.strictEqual(resLongPattern, false, 'Overly long regex pattern (>200 chars) must be safely rejected');

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
    assert.strictEqual(res, false, `Dangerous ReDoS pattern "${pat}" must be safely blocked`);
  }

  const ok1 = evaluateFunction('regex', { pattern: '^\\d{3}-\\d{4}$', value: '123-4567' });
  assert.strictEqual(ok1, true, 'Valid regex matches successfully');

  const ok2 = evaluateFunction('regex', { pattern: '^[a-zA-Z0-9_]+@[a-zA-Z0-9]+\\.[a-zA-Z]{2,4}$', value: 'admin@test.com' });
  assert.strictEqual(ok2, true, 'Common email regex validation passes');

  console.log('   ✓ regex ReDoS safety guards and nested quantifier blocking verified');
}

// ----------------------------------------------------
// 3. Input cursor stability and directional patching
// ----------------------------------------------------
console.log('👉 [3/3] Verify computeTreePatches directional diffing and cursor stability');
{
  const path1 = toPropertyPath(['children', 0, 'children', 1, 'value'], 'localRenderTree');
  assert.strictEqual(path1, 'localRenderTree.children[0].children[1].value');

  const path2 = toPropertyPath(['todos', 3, 'title']);
  assert.strictEqual(path2, 'todos[3].title');

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
        text: 'Login',
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
        text: 'Login',
        disabled: true,
      },
    ],
  };

  const patches = computeTreePatches(oldTree, newTree, 'localRenderTree', {
    activeComponentId: 'u_in',
  });

  assert.strictEqual(patches['localRenderTree.children[0].value'], undefined, 'Active input value must not be written back in patches to avoid cursor jumps');
  assert.strictEqual(patches['localRenderTree.children[2].disabled'], true, 'Dependent component properties must be precisely patched');

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
  assert.strictEqual(notifyCalled, false, 'options.silent true must suppress global notify');
  assert.strictEqual(engine.surfaces.get('s1').dataModel.text, 'world', 'Data model must still be accurately updated');

  console.log('   ✓ computeTreePatches directional diff and input stability verified');
}

console.log('\n================================================================');
console.log('🎉 Core reinforcement test suite passed (100%)');
console.log('================================================================\n');
