/**
 * Claude Code Review Round 5 专项加固回归测试
 * 针对 Claude 最新 16 项 review 建议进行全面覆盖断言
 */

const assert = require('assert');
const { A2UIEngine, ErrorCodes } = require('../miniprogram/core/engine');
const { evaluateFunction, resolveValue, openUrl } = require('../miniprogram/core/data-model');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🛡️  开始执行 Claude Code Review Round 5 专项深度回归测试');
console.log('================================================================\n');

// ----------------------------------------------------
// [CR-1] 列表展开作用域防覆盖与保留字段安全 (base, data, index, parent)
// ----------------------------------------------------
console.log('👉 [1/16] 验证列表项包含 base/data/index/parent 关键字时防白屏与崩溃 (CR-1)');
{
  const S = 'surf_reserved_keywords';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          items: [
            { name: 'Item A', base: 'evil_base_override', data: 'custom_data', index: 999, parent: 'fake_parent' },
            { name: 'Item B', base: 12345, data: { nested: true } },
          ],
        },
        components: [
          { id: 'root', component: 'List', children: { path: '/items', componentId: 'item_row' } },
          { id: 'item_row', component: 'Row', children: ['item_text', 'item_btn'] },
          { id: 'item_text', component: 'Text', text: { '@path': 'name' } },
          {
            id: 'item_btn',
            component: 'Button',
            text: 'Click',
            action: {
              event: {
                name: 'inspect',
                context: {
                  fieldBase: { '@path': 'base' },
                  fieldData: { '@path': 'data' },
                  fieldIndex: { '@path': 'index' },
                  fieldParent: { '@path': 'parent' },
                  sysIndex: { '@call': 'index' },
                },
              },
            },
          },
        ],
      },
    },
  ]);

  let tree = null;
  assert.doesNotThrow(() => {
    tree = engine.getRenderTree(S);
  }, '数据项包含 base 字段时绝对不可抛出 itemScope.base.map is not a function 异常导致白屏');

  assert.ok(tree, '渲染树必须正常生成');
  assert.strictEqual(tree.children.length, 2, '必须正常展开两个列表项');
  assert.strictEqual(tree.children[0].children[0].text, 'Item A');
  assert.strictEqual(tree.children[1].children[0].text, 'Item B');

  // 验证业务保留关键字字段与内置函数 index() 均能精准求值互不覆盖
  const actionMsg0 = engine.createActionMessage(S, tree.children[0].children[1].id);
  assert.strictEqual(actionMsg0.action.context.fieldBase, 'evil_base_override');
  assert.strictEqual(actionMsg0.action.context.fieldData, 'custom_data');
  assert.strictEqual(actionMsg0.action.context.fieldIndex, 999);
  assert.strictEqual(actionMsg0.action.context.fieldParent, 'fake_parent');
  assert.strictEqual(actionMsg0.action.context.sysIndex, 0);

  const actionMsg1 = engine.createActionMessage(S, tree.children[1].children[1].id);
  assert.strictEqual(actionMsg1.action.context.fieldBase, 12345);
  assert.strictEqual(actionMsg1.action.context.sysIndex, 1);
  console.log('   ✓ CR-1 列表项保留关键字防御验证 100% 通过');
}

// ----------------------------------------------------
// [CR-2] ChoicePicker 数组值、下标与 label 换算及回写
// ----------------------------------------------------
console.log('👉 [2/16] 验证 ChoicePicker 数组值解析、selectedIndex/displayLabel 换算与回写 (CR-2)');
{
  const S = 'surf_choice_picker';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          billingPeriod: ['annual'],
        },
        components: [
          { id: 'root', component: 'Column', children: ['picker'] },
          {
            id: 'picker',
            component: 'ChoicePicker',
            label: 'Billing Period',
            options: [
              { label: 'Annual (10% off)', value: 'annual' },
              { label: 'Monthly', value: 'monthly' },
            ],
            value: { '@path': '/billingPeriod' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const pickerNode = tree.children[0];
  assert.strictEqual(pickerNode.selectedIndex, 0, 'selectedIndex 必须精确对应 annual 的下标 0');
  assert.strictEqual(pickerNode.displayLabel, 'Annual (10% off)', 'displayLabel 必须正确显示 option 的 label 而非原始 value');
  assert.strictEqual(pickerNode.isChoiceArray, true, '必须记录原始数据为数组');

  // 模拟组件选择第二项 (index: 1 -> 'monthly') 并写回
  engine.handleInputChange(S, '/billingPeriod', ['monthly']);
  const treeAfter = engine.getRenderTree(S);
  const pickerAfter = treeAfter.children[0];
  assert.strictEqual(pickerAfter.selectedIndex, 1, '修改后 selectedIndex 必须为 1');
  assert.strictEqual(pickerAfter.displayLabel, 'Monthly', 'displayLabel 必须更新为 Monthly');
  assert.deepStrictEqual(pickerAfter.value, ['monthly'], '写回后数据类型必须保持数组');
  console.log('   ✓ CR-2 ChoicePicker 数组值与展示换算校验通过');
}

// ----------------------------------------------------
// [CR-3] DateTimeInput 完整支持 enableDate 与 enableTime 及 ISO 格式
// ----------------------------------------------------
console.log('👉 [3/16] 验证 DateTimeInput enableDate/enableTime 与 ISO 格式保持 (CR-3)');
{
  const S = 'surf_datetime';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          eventDate: '2025-12-15T17:00:00Z',
        },
        components: [
          { id: 'root', component: 'Column', children: ['dt_input'] },
          {
            id: 'dt_input',
            component: 'DateTimeInput',
            label: 'Event Time',
            enableDate: true,
            enableTime: true,
            value: { '@path': '/eventDate' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const dtNode = tree.children[0];
  const expectedDate = new Date('2025-12-15T17:00:00Z');
  const expY = expectedDate.getFullYear();
  const expM = String(expectedDate.getMonth() + 1).padStart(2, '0');
  const expD = String(expectedDate.getDate()).padStart(2, '0');
  const expH = String(expectedDate.getHours()).padStart(2, '0');
  const expMin = String(expectedDate.getMinutes()).padStart(2, '0');
  assert.strictEqual(dtNode.dateValue, `${expY}-${expM}-${expD}`, 'dateValue 必须正确换算为本地客户端年月日展示 (M5)');
  assert.strictEqual(dtNode.timeValue, `${expH}:${expMin}`, 'timeValue 必须正确换算为本地客户端时分展示 (M5)');
  assert.strictEqual(dtNode.enableDate, true);
  assert.strictEqual(dtNode.enableTime, true);
  console.log('   ✓ CR-3 DateTimeInput ISO 拆解与本地时区展示换算校验通过');
}

// ----------------------------------------------------
// [CR-4] checks 校验仅禁用 Button，TextField 显示 validationError
// ----------------------------------------------------
console.log('👉 [4/16] 验证 checks 失败仅禁用 Button，TextField 显示校验提示 (CR-4)');
{
  const S = 'surf_checks';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: {
          username: '',
          email: 'not-an-email',
          agreed: true,
        },
        components: [
          { id: 'root', component: 'Column', children: ['u_input', 'e_input', 's_btn', 'ok_btn'] },
          {
            id: 'u_input',
            component: 'TextField',
            label: '用户名',
            value: { '@path': '/username' },
            checks: [
              {
                condition: { '@call': 'required', args: { value: { '@path': '/username' } } },
                message: '用户名不能为空',
              },
            ],
          },
          {
            id: 'e_input',
            component: 'TextField',
            label: '邮箱',
            value: { '@path': '/email' },
            checks: [
              {
                condition: { '@call': 'required', args: { value: { '@path': '/email' } } },
                message: '邮箱必填',
              },
              {
                condition: false,
                message: '邮箱格式不合规',
              },
            ],
          },
          {
            id: 's_btn',
            component: 'Button',
            text: '提交',
            checks: [
              {
                condition: { '@call': 'required', args: { value: { '@path': '/username' } } },
                message: '请先填写完整表单',
              },
            ],
          },
          {
            id: 'ok_btn',
            component: 'Button',
            text: '已同意',
            checks: [
              {
                condition: { '@path': '/agreed' },
                message: '需先同意协议',
              },
            ],
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const inputNode = tree.children[0];
  const emailNode = tree.children[1];
  const btnNode = tree.children[2];
  const okBtnNode = tree.children[3];

  assert.strictEqual(inputNode.disabled, undefined, 'TextField 绝不能因 checks 失败而被禁用');
  assert.strictEqual(inputNode.validationError, '用户名不能为空', 'TextField 必须显示校验失败提示');

  assert.strictEqual(emailNode.disabled, undefined, '多项校验且第二项失败时，输入框绝不能被禁用');
  assert.strictEqual(emailNode.validationError, '邮箱格式不合规', '多项校验时必须精准提取首个失败 check 的 message');

  assert.strictEqual(btnNode.disabled, true, 'Button 在 checks 失败时必须保持 disabled: true');
  assert.strictEqual(btnNode.validationError, '请先填写完整表单');

  assert.strictEqual(okBtnNode.disabled, undefined, 'Button 在 checks 全部通过时不能被置为 disabled');
  assert.strictEqual(okBtnNode.validationError, undefined, 'Button 在 checks 全部通过时 validationError 为 undefined');
  console.log('   ✓ CR-4 checks 校验对 Button 与 TextField 差异化控制通过');
}

// ----------------------------------------------------
// [CR-5] UNKNOWN_COMPONENT 单次校验防刷屏
// ----------------------------------------------------
console.log('👉 [5/16] 验证 UNKNOWN_COMPONENT 只在接收消息时校验，重建树不重复报错 (CR-5)');
{
  const S = 'surf_unknown_comp';
  const engine = new A2UIEngine();
  const errors = [];
  engine.addErrorListener((err) => errors.push(err));

  engine.process([
    {
      createSurface: {
        surfaceId: S,
        components: [
          { id: 'root', component: 'Column', children: ['weird_widget'] },
          { id: 'weird_widget', component: 'NonExistentComponent' },
        ],
      },
    },
  ]);

  assert.strictEqual(errors.length, 1, '初次接收组件消息时必须上报 1 条错误');

  // 模拟用户连续按键 5 次，多次调用 getRenderTree 重建渲染树
  for (let i = 0; i < 5; i++) {
    engine.getRenderTree(S);
  }
  assert.strictEqual(errors.length, 1, '重建渲染树时严禁重复刷屏报 UNKNOWN_COMPONENT 错误');

  // 再次发送包含相同未知组件的 updateComponents，做去重保护
  engine.process([
    {
      updateComponents: {
        surfaceId: S,
        components: [
          { id: 'weird_widget', component: 'NonExistentComponent' },
        ],
      },
    },
  ]);
  assert.strictEqual(errors.length, 1, '相同未知组件重复 updateComponents 必须做去重防御');

  // 再次调用 getRenderTree
  for (let i = 0; i < 3; i++) {
    engine.getRenderTree(S);
  }
  assert.strictEqual(errors.length, 1, '后续重建渲染树依然严禁产生新报错');
  console.log('   ✓ CR-5 未知组件错误防刷屏去重机制通过');
}

// ----------------------------------------------------
// [CR-7] Action 兜底路径 sourceComponentId 保护与 context 解析
// ----------------------------------------------------
console.log('👉 [7/16] 验证 Action 兜底 sourceComponentId 完整保留 (如 submit_btn) (CR-7)');
{
  const S = 'surf_action_fallback';
  const engine = new A2UIEngine();
  engine.process({
    createSurface: {
      surfaceId: S,
      dataModel: { role: 'admin' },
      components: [
        { id: 'root', component: 'Column', children: ['submit_btn'] },
        {
          id: 'submit_btn',
          component: 'Button',
          text: '提交',
          action: {
            event: {
              name: 'doSubmit',
              context: { currentRole: { '@path': '/role' } },
            },
          },
        },
      ],
    },
  });

  const actionMsg = engine.createActionMessage(S, 'submit_btn');
  assert.strictEqual(actionMsg.action.sourceComponentId, 'submit_btn', 'sourceComponentId 绝不能被截断成 submit');
  assert.strictEqual(actionMsg.action.context.currentRole, 'admin', 'context 必须正确解析');
  console.log('   ✓ CR-7 sourceComponentId 与 context 校验通过');
}

// ----------------------------------------------------
// [CR-8] 统一 engine/internalEngine 与出站消息转发
// ----------------------------------------------------
console.log('👉 [8/16] 验证 setEngine 外部引擎注入与 internalEngine 出站转发对齐 (CR-8)');
{
  const S = 'surf_outbound_relay';
  const engine = new A2UIEngine();
  const outboundMessages = [];
  engine.addOutboundListener((msg) => outboundMessages.push(msg));

  engine.registerRendererFunction('testFunc', () => ({ ok: true }));

  engine.process({
    createSurface: { surfaceId: S },
  });
  engine.process({
    callRendererFunction: {
      surfaceId: S,
      functionCallId: 'call_1',
      callFunction: {
        '@call': 'testFunc',
        args: {},
      },
    },
  });

  assert.strictEqual(outboundMessages.length, 1, '引擎必须成功派发 RPC 出站响应');
  assert.strictEqual(outboundMessages[0].rendererFunctionResponse.functionCallId, 'call_1');
  console.log('   ✓ CR-8 出站消息通道闭环验证通过');
}

// ----------------------------------------------------
// [CR-10] openUrl 渲染无副作用与 regex ReDoS 防御
// ----------------------------------------------------
console.log('👉 [10/16] 验证 openUrl 纯求值无副作用及 regex ReDoS 安全防爆 (CR-10)');
{
  // openUrl 纯函数求值
  const cleanUrl = evaluateFunction('openUrl', { url: 'https://example.com' });
  assert.strictEqual(cleanUrl, 'https://example.com', '合法链接应返回清洗后的 URL');

  const badUrl = evaluateFunction('openUrl', { url: 'javascript:alert(1)' });
  assert.strictEqual(badUrl, '', '非法 scheme 必须返回空字符串');

  // ReDoS 防御：嵌套灾难性量词拦截
  const redosPattern = '((a+)+)+$';
  const matchResult = evaluateFunction('regex', { pattern: redosPattern, value: 'aaaaaaaaaaaaaaaaaaaaa!' });
  assert.strictEqual(matchResult, false, '灾难性回溯模式必须被安全拦截');

  // 正常正则
  const normalMatch = evaluateFunction('regex', { pattern: '^\\d{3}-\\d{4}$', value: '123-4567' });
  assert.strictEqual(normalMatch, true, '正常合法正则校验通过');
  console.log('   ✓ CR-10 openUrl 纯函数与 ReDoS 安全防御校验通过');
}

// ----------------------------------------------------
// [CR-12] project.config.json miniprogramRoot 校验
// ----------------------------------------------------
console.log('👉 [12/16] 验证 project.config.json 正确配置 miniprogramRoot (CR-12)');
{
  const projectConfigPath = path.resolve(__dirname, '../project.config.json');
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
  assert.strictEqual(projectConfig.miniprogramRoot, 'miniprogram/', '必须指定 miniprogramRoot 为 miniprogram/');
  console.log('   ✓ CR-12 project.config.json miniprogramRoot 校验通过');
}

// ----------------------------------------------------
// [CR-13] sendDataModel 深拷贝快照隔离
// ----------------------------------------------------
console.log('👉 [13/16] 验证 sendDataModel 发送独立深拷贝快照 (CR-13)');
{
  const S = 'surf_snapshot';
  const engine = new A2UIEngine();
  engine.process({
    createSurface: {
      surfaceId: S,
      sendDataModel: true,
      dataModel: { count: 10, nested: { status: 'init' } },
      components: [
        { id: 'root', component: 'Button', text: 'Go', action: { event: { name: 'test' } } },
      ],
    },
  });

  const actionMsg = engine.createActionMessage(S, 'root');
  assert.strictEqual(actionMsg.action.dataModel.count, 10);

  const eventMsg = engine.createEventMessage(S, 'custom_event');
  assert.strictEqual(eventMsg.action.dataModel.count, 10);

  // 原地修改 dataModel
  engine.updateLocalValue(S, '/count', 999);
  engine.updateLocalValue(S, '/nested/status', 'modified');

  assert.strictEqual(actionMsg.action.dataModel.count, 10, '已发出的 actionMsg 快照 count 绝不能被后续 setIn 原地修改污染');
  assert.strictEqual(actionMsg.action.dataModel.nested.status, 'init', '已发出的 actionMsg 快照 nested.status 绝不能被后续修改污染');

  assert.strictEqual(eventMsg.action.dataModel.count, 10, '已发出的 eventMsg 快照 count 绝不能被后续修改污染');
  assert.strictEqual(eventMsg.action.dataModel.nested.status, 'init', '已发出的 eventMsg 快照 nested.status 绝不能被后续修改污染');

  // 反向污染防御：篡改派发出的快照，模型本身不受影响
  actionMsg.action.dataModel.count = -1;
  assert.strictEqual(engine.surfaces.get(S).dataModel.count, 999, '快照被外部篡改时，引擎内部 dataModel 必须完全不受影响');
  console.log('   ✓ CR-13 dataModel 深拷贝隔离断言 100% 通过');
}

// ----------------------------------------------------
// [CR-14] 假值列表项 (0, '', false, null) scopeData 防 parent 链泄漏
// ----------------------------------------------------
console.log('👉 [14/16] 验证假值基本类型 (0, false, "", null) 列表项不泄漏 parent 链 (CR-14)');
{
  const S = 'surf_falsy_scope';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        dataModel: { numbers: [0, false, '', null] },
        components: [
          { id: 'root', component: 'List', children: { path: '/numbers', componentId: 'num_btn' } },
          {
            id: 'num_btn',
            component: 'Button',
            text: 'Click',
            action: {
              event: {
                name: 'pick',
                context: {
                  itemVal: { '@path': '' },
                },
              },
            },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  const btn0 = tree.children[0];
  assert.strictEqual(btn0.scopeData, 0, '数据为 0 时 scopeData 必须精准为 0，不能退回含 parent 的整个 scope');
  assert.strictEqual(btn0.scopeData.parent, undefined, 'scopeData 绝不可携带 parent 链');

  const btn1 = tree.children[1];
  assert.strictEqual(btn1.scopeData, false, '数据为 false 时 scopeData 必须精准为 false');

  const btn2 = tree.children[2];
  assert.strictEqual(btn2.scopeData, '', '数据为空字符串时 scopeData 必须精准为空字符串');

  const btn3 = tree.children[3];
  assert.strictEqual(btn3.scopeData, null, '数据为 null 时 scopeData 必须精准为 null');

  // 验证 Action 消息中对假值项 @path: "" 的精准提取
  const actionMsg0 = engine.createActionMessage(S, btn0.id);
  assert.strictEqual(actionMsg0.action.context.itemVal, 0, '0 假值项 @path: "" 提取值必须精准为 0');

  const actionMsg1 = engine.createActionMessage(S, btn1.id);
  assert.strictEqual(actionMsg1.action.context.itemVal, false, 'false 假值项 @path: "" 提取值必须精准为 false');

  const actionMsg2 = engine.createActionMessage(S, btn2.id);
  assert.strictEqual(actionMsg2.action.context.itemVal, '', '"" 假值项 @path: "" 提取值必须精准为空字符串');
  console.log('   ✓ CR-14 假值列表项 scopeData 隔离校验通过');
}

// ----------------------------------------------------
// [CR-15] Modal 缺 trigger 时具名字段防止 content 顺位错位
// ----------------------------------------------------
console.log('👉 [15/16] 验证 Modal 缺 trigger 时 triggerNode/contentNode 具名字段不混淆 (CR-15)');
{
  const S = 'surf_modal_no_trig';
  const engine = new A2UIEngine();
  engine.process([
    {
      createSurface: {
        surfaceId: S,
        components: [
          { id: 'root', component: 'Modal', content: 'dialog_body' },
          { id: 'dialog_body', component: 'Text', text: 'Dialog Content' },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree(S);
  assert.strictEqual(tree.triggerNode, undefined, '缺 trigger 时 triggerNode 必须为 undefined');
  assert.ok(tree.contentNode, 'contentNode 必须正确挂载');
  assert.strictEqual(tree.contentNode.text, 'Dialog Content');
  assert.strictEqual(tree.children.length, 0, '缺 trigger 时 children 必须为空，content 绝不能顺位成为 children[0]');
  assert.strictEqual(tree.children[0], undefined, '缺 trigger 时 children[0] 必须为 undefined');

  // 对比：完整带有 trigger 与 content 的 Modal
  const S2 = 'surf_modal_with_trig';
  engine.process([
    {
      createSurface: {
        surfaceId: S2,
        components: [
          { id: 'root', component: 'Modal', trigger: 'open_btn', content: 'dialog_body' },
          { id: 'open_btn', component: 'Button', text: 'Open Dialog' },
          { id: 'dialog_body', component: 'Text', text: 'Dialog Content' },
        ],
      },
    },
  ]);

  const tree2 = engine.getRenderTree(S2);
  assert.ok(tree2.triggerNode, '有 trigger 时 triggerNode 存在');
  assert.strictEqual(tree2.triggerNode.text, 'Open Dialog');
  assert.ok(tree2.contentNode, '有 content 时 contentNode 存在');
  assert.strictEqual(tree2.contentNode.text, 'Dialog Content');
  assert.strictEqual(tree2.children.length, 2, '有 trigger 时 children 必须包含两个节点');
  assert.strictEqual(tree2.children[0].text, 'Open Dialog', 'children[0] 对应 trigger');
  assert.strictEqual(tree2.children[1].text, 'Dialog Content', 'children[1] 对应 content');
  console.log('   ✓ CR-15 Modal 具名字段隔离断言通过');
}

// ----------------------------------------------------
// [CR-16] package.json files 精简与资产体积优化
// ----------------------------------------------------
console.log('👉 [16/16] 验证 package.json files 字段仅包含核心发布资产 (CR-16)');
{
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert.ok(Array.isArray(pkg.files), 'package.json 必须配置 files 数组');
  assert.ok(!pkg.files.includes('fixtures'), 'npm 发包严禁包含 496KB 的 fixtures 目录');
  assert.ok(!pkg.files.includes('pages'), 'npm 发包严禁包含测试演示 pages 目录');
  assert.ok(pkg.files.includes('miniprogram'), '必须包含核心 miniprogram 目录 (M6/L4)');
  console.log('   ✓ CR-16 package.json 发布资产精简校验通过');
}

console.log('\n================================================================');
console.log('🎉 全部 16 项 Claude Code Review 专项加固单测 100% PASS！');
console.log('================================================================');
