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

  console.log('\n--- [6] 验证商品卡片价格缺省与零值保留 (Codex P2 修复验证) ---');
  const dummyMsg1 = {};
  loop.executeA2UITool(dummyMsg1, 'render_product_card', { title: '测试普通商品', price: 100 });
  assert(dummyMsg1.a2uiMessages && dummyMsg1.a2uiMessages.length > 0, '必须包含 a2uiMessages 协议消息');
  
  const findNode = (node, predicate) => {
    if (!node) return null;
    if (predicate(node)) return node;
    if (node.children) {
      for (const c of node.children) {
        const found = findNode(c, predicate);
        if (found) return found;
      }
    }
    return null;
  };

  const priceTextNode1 = findNode(dummyMsg1.renderTree, (n) => n.text === '¥100');
  assert(priceTextNode1, '未指定 discountPrice 时应使用 price (¥100)');
  const btnNode1 = findNode(dummyMsg1.renderTree, (n) => n.component === 'Button');
  assert.strictEqual(btnNode1.action.event.context.price, 100, '加购 action context 应继承 price: 100');

  const dummyMsg2 = {};
  loop.executeA2UITool(dummyMsg2, 'render_product_card', { title: '免费试用商品', price: 99, discountPrice: 0 });
  const priceTextNode2 = findNode(dummyMsg2.renderTree, (n) => n.text === '¥0');
  assert(priceTextNode2, '显式指定 discountPrice=0 时应保留 0 (¥0)');
  const btnNode2 = findNode(dummyMsg2.renderTree, (n) => n.component === 'Button');
  assert.strictEqual(btnNode2.action.event.context.price, 0, '加购 action context 应保留 0');
  console.log('✓ 商品价格回退与零值保留断言 100% 通过');

  console.log('\n--- [7] 验证 Surface 组件绑定共享引擎与动作解析 (Codex P1 修复验证) ---');
  // 模拟 a2ui-surface 组件实例与 setEngine 机制
  const mockSurfaceComponent = {
    engine: null,
    setEngine(eng) {
      this.engine = eng;
    },
    dispatchTapEvent(componentId) {
      if (!this.engine) {
        throw new Error('EXECUTION_ERROR: A2UIEngine instance is required');
      }
      return this.engine.createActionMessage(flightMsg.surfaceId, componentId);
    },
  };

  // 未挂载引擎前抛出 EXECUTION_ERROR
  assert.throws(() => mockSurfaceComponent.dispatchTapEvent('btn_book'), /EXECUTION_ERROR/);
  // 挂载引擎后成功解析 action 消息
  mockSurfaceComponent.setEngine(loop.engine);
  const actionMsg = mockSurfaceComponent.dispatchTapEvent('btn_book');
  assert(actionMsg && actionMsg.event, '挂载 engine 后必须成功创建 Action 消息');
  assert.strictEqual(actionMsg.event.name, 'book_flight');
  console.log('✓ a2ui-surface 共享引擎挂载与 Action 解析断言 100% 通过');

  console.log('\n--- [8] 验证多工具调用保留独立卡片 (Codex 多 Tool Calls 修复验证) ---');
  const multiLoop = new AgentLoop();
  const baseAgentMsg = {
    id: 'msg_agent_test',
    role: 'assistant',
    content: '已为您查询航班与耳机：',
    timestamp: Date.now(),
  };
  multiLoop.messages.push(baseAgentMsg);

  const toolCalls = [
    { name: 'render_flight_card', args: { flightNumber: 'CA1501' } },
    { name: 'render_product_card', args: { title: 'Sony WH-1000XM5', price: 1999 } },
  ];
  for (let i = 0; i < toolCalls.length; i++) {
    let target = baseAgentMsg;
    if (i > 0 || target.surfaceId) {
      target = {
        id: 'msg_agent_test_' + i,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      multiLoop.messages.push(target);
    }
    multiLoop.executeA2UITool(target, toolCalls[i].name, toolCalls[i].args);
  }

  const msgsWithCards = multiLoop.getMessages().filter((m) => m.surfaceId && m.renderTree);
  assert.strictEqual(msgsWithCards.length, 2, '两个工具调用应生成两个独立的消息卡片');
  assert.notStrictEqual(msgsWithCards[0].surfaceId, msgsWithCards[1].surfaceId, '两张卡片应拥有不同的 surfaceId');
  console.log('✓ 多 Tool Calls 分别保留独立卡片验证通过');

  console.log('\n--- [9] 验证清空对话时取消并拦截未完成的异步任务 (Codex 取消任务修复验证) ---');
  const cancelLoop = new AgentLoop();
  // 触发一个卡片 action，内部有 300ms delay
  const dummySurface = 'surface_flight_cancel_test';
  cancelLoop.engine.process([
    { version: 'v1.0', createSurface: { surfaceId: dummySurface } },
    { version: 'v1.0', updateComponents: { surfaceId: dummySurface, components: [{ id: 'root', component: 'Card' }, { id: 'btn', component: 'Button', text: '按钮', action: { event: { name: 'book_flight' } } }] } },
  ]);
  const actionPromise = cancelLoop.handleA2UIAction({
    surfaceId: dummySurface,
    componentId: 'btn',
    actionName: 'book_flight',
  });
  // 50ms 后用户点击清空
  await new Promise((r) => setTimeout(r, 50));
  cancelLoop.clearHistory();
  assert.strictEqual(cancelLoop.getMessages().length, 1, '清空后应仅有欢迎卡片');
  assert.strictEqual(cancelLoop.state, 'idle', '清空后状态必须强制重置为 idle');
  // 等待原 action 完成其延迟
  await actionPromise;
  // 断言未完成的旧 action 没有污染新清空的对话
  assert.strictEqual(cancelLoop.getMessages().length, 1, '旧任务 continuation 不得污染清空后的新对话');
  assert.strictEqual(cancelLoop.getMessages()[0].id, 'msg_welcome');
  console.log('✓ 清空对话成功拦截并隔离已发起的异步任务');

  console.log('\n--- [10] 验证 API 模式报错降级时原消息被正确终态化 (Codex API 降级修复验证) ---');
  const fallbackLoop = new AgentLoop({
    config: {
      mode: 'api',
      apiKey: 'test-invalid-key',
      apiUrl: 'http://127.0.0.1:99999/invalid', // 故意触发失败
    },
  });
  await fallbackLoop.sendMessage('查航班');
  const allMsgs = fallbackLoop.getMessages();
  // 第一条应为报错提示信息，必须 isStreaming = false, thinking = ''
  const failedApiMsg = allMsgs.find((m) => m.content && m.content.includes('DeepSeek API'));
  assert(failedApiMsg, '应记录 API 报错降级提示');
  assert.strictEqual(failedApiMsg.isStreaming, false, '降级原消息必须置为 isStreaming=false');
  assert.strictEqual(failedApiMsg.thinking, '', '降级原消息必须清空 thinking 避免永久转圈');
  console.log('✓ API 降级时原消息终态化与 spinner 正常清理');

  console.log('\n--- [11] 验证 Agent 忙碌时拦截卡片 Action (Codex 并发 Action 保护验证) ---');
  const guardLoop = new AgentLoop();
  guardLoop.state = 'streaming';
  const beforeCount = guardLoop.getMessages().length;
  await guardLoop.handleA2UIAction({
    surfaceId: 'any_surface',
    componentId: 'btn',
    actionName: 'book_flight',
  });
  assert.strictEqual(guardLoop.getMessages().length, beforeCount, '忙碌状态下必须直接拦截并忽略卡片动作');
  console.log('✓ Agent 忙碌保护拦截断言 100% 通过');

  console.log('\n--- [12] 验证 API 请求超时强制终止与降级 (Codex Timeout 修复验证) ---');
  const http = require('http');
  const stallServer = http.createServer((_req, _res) => {
    // 故意挂起，永不响应
  });
  await new Promise((resolve) => stallServer.listen(0, resolve));
  const stallPort = stallServer.address().port;

  const timeoutLoop = new AgentLoop({
    config: {
      mode: 'api',
      apiKey: 'test-timeout-key',
      apiUrl: `http://127.0.0.1:${stallPort}/chat/completions`,
      timeout: 150, // 150ms 超时强制退出
    },
  });

  const startT = Date.now();
  await timeoutLoop.sendMessage('挂起测试');
  const elapsed = Date.now() - startT;
  stallServer.close();

  assert(elapsed < 2000, `必须在设定超时时间内强制退出降级 (实际耗时: ${elapsed}ms)`);
  const finalMsgs = timeoutLoop.getMessages();
  const timeoutMsg = finalMsgs.find((m) => m.content && m.content.includes('超时'));
  assert(timeoutMsg, '必须捕获并记录请求超时提示');
  console.log(`✓ 请求在 ${elapsed}ms 内成功触发超时机制并自动降级`);

  console.log('\n🎉 独立 Agent 小程序成功通过 a2ui-miniprogram 模块完成全流程测试！\n');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
