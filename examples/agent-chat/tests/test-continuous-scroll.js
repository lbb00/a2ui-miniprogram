const automator = require('miniprogram-automator');
const assert = require('assert');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getScrollDiff(mini) {
  await mini.evaluate(() => {
    const q = wx.createSelectorQuery();
    q.select('.messages-scroll').scrollOffset();
    q.select('.messages-scroll').boundingClientRect();
    q.exec((res) => {
      wx.__testMetric = JSON.stringify({
        scrollOffset: res[0]?.scrollTop || 0,
        scrollHeight: res[0]?.scrollHeight || 0,
        viewHeight: res[1]?.height || 0,
      });
    });
  });
  await sleep(100);
  const mStr = await mini.evaluate(() => wx.__testMetric || '{}');
  const m = JSON.parse(mStr);
  const max = Math.max(0, (m.scrollHeight || 0) - (m.viewHeight || 0));
  const diff = Math.max(0, max - (m.scrollOffset || 0));
  return { ...m, max, diff };
}

async function waitForIdle(mini, maxSeconds = 15) {
  for (let i = 0; i < maxSeconds * 10; i++) {
    await sleep(100);
    const state = await mini.evaluate(() => {
      const pages = getCurrentPages();
      return pages[pages.length - 1].data.agentState;
    });
    if (state === 'idle' && i > 5) {
      await sleep(800); // 预留多阶梯校准与平滑滚动动画时间
      return;
    }
  }
}

async function main() {
  console.log('=====================================================');
  console.log('🧪 自动化验证：多轮连续对话与流式卡片生成自动触底测试');
  console.log('=====================================================\n');

  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9527' });

  // 1. 清空聊天
  await mini.evaluate(() => {
    const pages = getCurrentPages();
    const curr = pages[pages.length - 1];
    curr.clearChat();
  });
  await sleep(400);

  // 场景 1: 触发航班卡片
  console.log('--- 场景 1: 触发航班卡片「查一下明天北京飞上海的航班」 ---');
  await mini.evaluate(() => {
    const pages = getCurrentPages();
    const curr = pages[pages.length - 1];
    curr.onChipTap({ currentTarget: { dataset: { text: '查一下明天北京飞上海的航班' } } });
  });

  await waitForIdle(mini);
  let metric1 = await getScrollDiff(mini);
  console.log(`场景 1 稳定后: scrollOffset=${Math.round(metric1.scrollOffset)}, maxScroll=${Math.round(metric1.max)}, diff=${Math.round(metric1.diff)}px`);
  assert.ok(metric1.diff <= 5, `场景 1 必须触底，当前差值: ${metric1.diff}px`);
  console.log('✓ 场景 1: 航班卡片生成后已精确自动滚动至最底部！\n');

  // 场景 2: 点击卡片内在线值机按钮
  console.log('--- 场景 2: 点击卡片内在线值机 Action 事件 ---');
  await mini.evaluate(() => {
    const pages = getCurrentPages();
    const curr = pages[pages.length - 1];
    curr.onA2UIAction({
      detail: {
        actionName: 'book_flight',
        params: { flightNumber: 'CA1501' },
      },
    });
  });

  await waitForIdle(mini);
  let metric2 = await getScrollDiff(mini);
  console.log(`场景 2 稳定后: scrollOffset=${Math.round(metric2.scrollOffset)}, maxScroll=${Math.round(metric2.max)}, diff=${Math.round(metric2.diff)}px`);
  assert.ok(metric2.diff <= 5, `场景 2 必须触底，当前差值: ${metric2.diff}px`);
  console.log('✓ 场景 2: 动作交互响应后已精确自动滚动至最底部！\n');

  // 场景 3: 触发商品推荐卡片
  console.log('--- 场景 3: 触发商品卡片「我想买索尼降噪耳机并申领新人特惠」 ---');
  await mini.evaluate(() => {
    const pages = getCurrentPages();
    const curr = pages[pages.length - 1];
    curr.onChipTap({ currentTarget: { dataset: { text: '我想买索尼降噪耳机并申领新人特惠' } } });
  });

  await waitForIdle(mini);
  let metric3 = await getScrollDiff(mini);
  console.log(`场景 3 稳定后: scrollOffset=${Math.round(metric3.scrollOffset)}, maxScroll=${Math.round(metric3.max)}, diff=${Math.round(metric3.diff)}px`);
  assert.ok(metric3.diff <= 5, `场景 3 必须触底，当前差值: ${metric3.diff}px`);
  console.log('✓ 场景 3: 第二张卡片生成后已精确自动滚动至最底部！\n');

  // 场景 4: 触发身份核验表单卡片
  console.log('--- 场景 4: 触发双向绑定表单「打开登录表单」 ---');
  await mini.evaluate(() => {
    const pages = getCurrentPages();
    const curr = pages[pages.length - 1];
    curr.onChipTap({ currentTarget: { dataset: { text: '打开登录表单' } } });
  });

  await waitForIdle(mini);
  let metric4 = await getScrollDiff(mini);
  console.log(`场景 4 稳定后: scrollOffset=${Math.round(metric4.scrollOffset)}, maxScroll=${Math.round(metric4.max)}, diff=${Math.round(metric4.diff)}px`);
  assert.ok(metric4.diff <= 5, `场景 4 必须触底，当前差值: ${metric4.diff}px`);
  console.log('✓ 场景 4: 表单卡片生成后已精确自动滚动至最底部！\n');

  await mini.disconnect();
  console.log('=====================================================');
  console.log('🎉 全部流式卡片生成与滚动测试 100% PASS！');
  console.log('=====================================================');
}

main().catch((e) => {
  console.error('测试失败:', e);
  process.exit(1);
});
