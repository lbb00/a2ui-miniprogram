const assert = require('assert');
const a2ui = require('a2ui-miniprogram');
const { AgentLoop } = require('../core/agent-loop');

async function runTest() {
  console.log('--- [1] 验证独立小程序中成功导入 a2ui-miniprogram 模块 ---');
  assert(a2ui.A2UIEngine, '必须能够从 a2ui-miniprogram 引入 A2UIEngine');
  console.log('✓ 成功从 a2ui-miniprogram 引入 A2UIEngine 与 数据模型工具');

  console.log('\n--- [2] 验证 AgentLoop 初始化与初始状态 ---');
  const loop = new AgentLoop();
  const msgs = loop.getMessages();
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].role, 'assistant');
  console.log('✓ AgentLoop 启动成功，包含欢迎卡片');

  console.log('\n--- [3] 验证用户消息驱动 A2UI 协议卡片生成 (航班场景) ---');
  await loop.sendMessage('查一下明天北京飞上海的航班');
  const msgsAfterFlight = loop.getMessages();
  assert.strictEqual(msgsAfterFlight.length, 3);
  const flightMsg = msgsAfterFlight[2];
  assert(flightMsg.surfaceId, '应注入 surfaceId');
  assert(flightMsg.renderTree, '应通过 a2ui-miniprogram 编译生成 renderTree');
  assert.strictEqual(flightMsg.renderTree.component, 'Card');
  console.log('✓ 成功调用 a2ui-miniprogram 引擎生成航班卡片: Card -> Column -> Button');

  console.log('\n--- [4] 验证 A2UI Action 用户交互到 Agent 闭环响应 ---');
  await loop.handleA2UIAction({
    surfaceId: flightMsg.surfaceId,
    componentId: 'btn_book',
    action: {
      event: {
        name: 'book_flight',
        context: { flightNumber: 'CA1501' },
      },
    },
    eventMessage: {
      version: 'v1.0',
      event: {
        surfaceId: flightMsg.surfaceId,
        name: 'book_flight',
        context: { flightNumber: 'CA1501' },
      },
    },
  });

  const msgsAfterAction = loop.getMessages();
  assert.strictEqual(msgsAfterAction.length, 5);
  const actMsg = msgsAfterAction[3];
  const respMsg = msgsAfterAction[4];
  assert.strictEqual(actMsg.role, 'action');
  assert(actMsg.content.includes('CA1501'));
  assert(respMsg.content.includes('值机成功') || respMsg.content.includes('12A'));
  console.log('✓ Action 事件闭环验证成功: 用户点击 ➔ Agent 闭环确认为 12A 座位');

  console.log('\n--- [5] 验证表单双向绑定反写 a2ui-miniprogram 底座 DataModel ---');
  await loop.sendMessage('打开登录表单');
  const formMsg = loop.getMessages()[loop.getMessages().length - 1];
  assert(formMsg.surfaceId);

  loop.handleA2UIInput({
    surfaceId: formMsg.surfaceId,
    componentId: 'u_input',
    path: '/username',
    value: 'independent_agent_tester',
  });

  const updatedTree = loop.engine.getRenderTree(formMsg.surfaceId);
  const findValue = (node) => {
    if (!node) return null;
    if (node.valuePath === '/username') return node.value;
    if (node.children) {
      for (const c of node.children) {
        const v = findValue(c);
        if (v) return v;
      }
    }
    return null;
  };
  assert.strictEqual(findValue(updatedTree), 'independent_agent_tester');
  console.log('✓ 表单输入成功反写 a2ui-miniprogram 底座 DataModel:', findValue(updatedTree));

  console.log('\n🎉 独立 Agent 小程序成功通过 a2ui-miniprogram 模块完成全流程测试！\n');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
