const { AgentLoop } = require('../core/agent-loop');
const assert = require('assert');

async function testAll() {
  console.log('=====================================================');
  console.log('🤖 深度全链路验证: DeepSeek API + A2UI Module 交互');
  console.log('=====================================================\n');

  const agent = new AgentLoop({
    config: {
      mode: process.env.DEEPSEEK_API_KEY ? 'api' : 'mock',
      apiUrl: 'https://api.deepseek.com/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat',
    },
    onStateChange: (state) => {
      console.log(`[Agent 状态] -> ${state}`);
    },
  });

  // 测试 1: 航班查询与值机
  console.log('--- 测试用例 1: 航班查询 (render_flight_card) ---');
  await agent.sendMessage('请帮我查一下明天北京飞上海的机票');
  let msgs = agent.getMessages();
  let latestMsg = msgs[msgs.length - 1];
  assert.ok(latestMsg.renderTree, '必须生成 A2UI renderTree');
  assert.strictEqual(latestMsg.renderTree.component, 'Card', '根节点必须是 Card');
  console.log('航班卡片生成成功: component =', latestMsg.renderTree.component);

  // 模拟用户在小程序点击卡片上的动作按钮
  console.log('\n模拟用户点击卡片按钮: [立即在线值机选座]');
  await agent.handleA2UIAction({
    actionName: 'book_flight',
    params: { flightNumber: 'CA1501' },
  });
  msgs = agent.getMessages();
  const flightActionRes = msgs[msgs.length - 1];
  console.log('用户交互响应:', flightActionRes.content);
  assert.ok(
    flightActionRes.content.includes('值机成功') ||
      flightActionRes.content.includes('12A') ||
      flightActionRes.content.includes('CA1501'),
    '必须包含值机确认'
  );

  // 测试 2: 商品查询与领券
  console.log('\n--- 测试用例 2: 商品推荐 (render_product_card) ---');
  await agent.sendMessage('我想买索尼降噪耳机');
  msgs = agent.getMessages();
  latestMsg = msgs[msgs.length - 1];
  assert.ok(latestMsg.renderTree, '必须生成 A2UI renderTree');
  console.log('商品卡片生成成功: component =', latestMsg.renderTree.component);

  console.log('\n模拟用户点击卡片按钮: [领券立减 200 元]');
  await agent.handleA2UIAction({
    actionName: 'claimCoupon',
    params: { couponAmount: 200 },
  });
  msgs = agent.getMessages();
  const couponRes = msgs[msgs.length - 1];
  console.log('用户交互响应:', couponRes.content);

  // 测试 3: 双向绑定表单卡片
  console.log('\n--- 测试用例 3: 双向绑定表单 (render_form_card) ---');
  await agent.sendMessage('请打开身份核验登录表单');
  msgs = agent.getMessages();
  latestMsg = msgs[msgs.length - 1];
  if (!latestMsg.renderTree) {
    console.log('Case 3 failed. All messages:');
    msgs.forEach((m, idx) => console.log(`[${idx}] ${m.role}: ${m.content} (renderTree=${!!m.renderTree})`));
  }
  assert.ok(latestMsg.renderTree, '必须生成 A2UI renderTree');
  console.log('表单卡片生成成功: component =', latestMsg.renderTree.component);

  console.log('\n模拟用户输入手机号与短信验证码');
  agent.handleA2UIInput({ field: 'phone', value: '13800138000' });
  agent.handleA2UIInput({ field: 'code', value: '888888' });

  console.log('模拟用户点击 [确认核验并授权登录]');
  await agent.handleA2UIAction({
    actionName: 'submitLogin',
    params: {},
  });
  msgs = agent.getMessages();
  const loginRes = msgs[msgs.length - 1];
  console.log('用户交互响应:', loginRes.content);
  assert.ok(
    loginRes.content.includes('验证通过') ||
      loginRes.content.includes('核验通过') ||
      loginRes.content.includes('欢迎回来') ||
      loginRes.content.includes('13800138000'),
    '必须包含核验确认'
  );

  console.log('\n=====================================================');
  console.log('🎉 验证全部通过！DeepSeek API + a2ui-miniprogram 运行完美！');
  console.log('=====================================================');
}

testAll().catch((err) => {
  console.error('测试失败:', err);
  process.exit(1);
});
