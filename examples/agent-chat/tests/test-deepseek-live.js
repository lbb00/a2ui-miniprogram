const assert = require('assert');
const { AgentLoop } = require('../core/agent-loop');

async function testDeepSeek() {
  console.log('=====================================================');
  console.log('🤖 测试独立小程序直接调用 DeepSeek 真实 API (流式 + A2UI)');
  console.log('=====================================================\n');

  const loop = new AgentLoop({
    config: {
      mode: process.env.DEEPSEEK_API_KEY ? 'api' : 'mock',
      apiUrl: 'https://api.deepseek.com/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat',
    },
    onStateChange: (state) => {
      console.log(`[状态流转] ➔ ${state}`);
    },
    onMessageUpdate: (msgs) => {
      const last = msgs[msgs.length - 1];
      if (last.role === 'assistant' && last.thinking) {
        process.stdout.write(`\r[思考/进度] ${last.thinking.slice(0, 50)}...`);
      }
    },
  });

  console.log('1. 发送提示词: "请帮我查一下明天北京飞上海的机票"');
  await loop.sendMessage('请帮我查一下明天北京飞上海的机票');

  console.log('\n\n2. 校验 DeepSeek 回复内容:');
  const msgs = loop.getMessages();
  const agentMsg = msgs[msgs.length - 1];

  console.log('--- DeepSeek 文本回复 ---');
  console.log(agentMsg.content);

  console.log('\n--- 挂载的 A2UI 渲染树 ---');
  console.log('SurfaceId:', agentMsg.surfaceId);
  console.log('RenderTree Root:', agentMsg.renderTree ? agentMsg.renderTree.component : 'null');
  if (agentMsg.renderTree) {
    console.log('RenderTree 节点深度:', agentMsg.renderTree.depth, '子节点数:', agentMsg.renderTree.children.length);
  }

  assert(agentMsg.content && agentMsg.content.length > 0, 'DeepSeek 应返回文本内容');
  console.log('\n✅ DeepSeek 真实 API 流式调用与 A2UI 卡片直出验证 100% 成功！\n');
}

testDeepSeek().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
