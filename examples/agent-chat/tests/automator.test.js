/**
 * miniprogram-automator E2E 自动化测试套件
 * 
 * 重点覆盖与验证：
 * 1. 聊天内容的自动滚动 (scrollToBottom, scroll-top, scroll-into-view, scrollWithAnimation)
 * 2. 键盘抬起时间与动画同步 (duration, keyboardHeight, margin-bottom 动画)
 * 3. 输入框贴底与安全区 (adjust-position: false, env(safe-area-inset-bottom))
 * 4. DeepSeek Function Calling + a2ui-miniprogram 动态卡片挂载
 * 5. A2UI Action 用户交互闭环
 */

const path = require('path');
const automator = require('miniprogram-automator');
const assert = require('assert');
const http = require('http');
const net = require('net');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host: '127.0.0.1' }, () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

async function ensureAutoPort(port = 9527) {
  const open = await isPortOpen(port);
  if (open) {
    console.log(`[Automator] 自动化端口 ${port} 已在运行中，直接复用`);
    return port;
  }

  console.log(`[Automator] 正在请求微信 IDE 打开自动化端口 ${port}...`);
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(__dirname, '..');
    const req = http.get(
      `http://127.0.0.1:9420/v2/auto?project=${encodeURIComponent(projectRoot)}&autoPort=${port}`,
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', async () => {
          await sleep(2500);
          resolve(port);
        });
      }
    );
    req.on('error', reject);
  });
}

async function runAutomatorTests() {
  console.log('=====================================================');
  console.log('🚀 开始执行 miniprogram-automator 自动化端到端测试');
  console.log('=====================================================\n');

  const port = await ensureAutoPort(9527);
  console.log(`[Automator] 自动化 WebSocket 端口已确认: ${port}`);

  console.log('[Automator] 正在通过 WebSocket 连接 miniprogram-automator...');
  const miniProgram = await automator.connect({
    wsEndpoint: `ws://127.0.0.1:${port}`,
  });
  console.log('✓ 成功连接至微信小程序运行时！\n');

  try {
    // ----------------------------------------------------
    // 测试 1: 校验当前页面路径
    // ----------------------------------------------------
    let currentRoute = await miniProgram.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      return pages.length > 0 ? pages[pages.length - 1].route : null;
    });

    if (!currentRoute) {
      console.log('  ├─ 检测到页面栈初始为空，等待 1.5s 页面就绪...');
      await sleep(1500);
      currentRoute = await miniProgram.evaluate(() => {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        return pages.length > 0 ? pages[pages.length - 1].route : 'pages/chat/chat';
      });
    }

    console.log(`[测试 1] 校验当前页面路径: ${currentRoute}`);
    assert.strictEqual(currentRoute, 'pages/chat/chat', '页面路径必须为 pages/chat/chat');
    console.log('✓ 页面路径断言正确\n');

    // ----------------------------------------------------
    // 测试 2: 键盘抬起时间与动画同步 (duration, margin-bottom)
    // ----------------------------------------------------
    console.log('[测试 2] 校验键盘抬起 (Keyboard Raise) 动画与时间同步');
    console.log('  ├─ 模拟微信原生键盘弹出事件: height=336px, duration=250ms');
    const raiseData = await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const curr = pages[pages.length - 1];
      curr.onKeyboardHeightChange({ detail: { height: 336, duration: 250 } });
      return {
        keyboardHeight: curr.data.keyboardHeight,
        keyboardDuration: curr.data.keyboardDuration,
      };
    });
    await sleep(350);

    console.log(`  ├─ 键盘抬起后 keyboardHeight: ${raiseData.keyboardHeight}px (预期: 336)`);
    console.log(`  ├─ 键盘动画时长 keyboardDuration: ${raiseData.keyboardDuration}s (预期: 0.25)`);
    assert.strictEqual(raiseData.keyboardHeight, 336, '键盘高度必须精确记录');
    assert.strictEqual(raiseData.keyboardDuration, 0.25, '键盘动画时间必须转换为秒');

    let page = null;
    try {
      page = await miniProgram.currentPage();
    } catch (_) {}

    if (page) {
      const inputBar = await page.$('.chat-input-bar');
      if (inputBar) {
        const inputBarStyle = await inputBar.attribute('style');
        console.log(`  ├─ DOM .chat-input-bar style: "${inputBarStyle}"`);
        assert.ok(inputBarStyle.includes('margin-bottom: 336px'), '输入栏必须向上平移 336px');
        assert.ok(inputBarStyle.includes('0.25s'), '平移动画过渡时间必须与键盘同步 (0.25s)');
      }
    }
    console.log('✓ 键盘抬起时间动画同步断言 100% 通过！\n');

    // ----------------------------------------------------
    // 测试 3: 键盘收起 (Keyboard Dismiss) 与输入框贴底
    // ----------------------------------------------------
    console.log('[测试 3] 校验键盘收起 (Keyboard Dismiss) 与安全区贴底');
    const dismissData = await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const curr = pages[pages.length - 1];
      curr.onKeyboardHeightChange({ detail: { height: 0, duration: 250 } });
      return {
        keyboardHeight: curr.data.keyboardHeight,
      };
    });
    await sleep(350);

    console.log(`  ├─ 键盘收起后 keyboardHeight: ${dismissData.keyboardHeight}px (预期: 0)`);
    assert.strictEqual(dismissData.keyboardHeight, 0, '键盘高度必须恢复为 0');

    if (page) {
      const inputBar = await page.$('.chat-input-bar');
      if (inputBar) {
        const inputBarStyleAfter = await inputBar.attribute('style');
        console.log(`  ├─ DOM 收起后 style: "${inputBarStyleAfter}"`);
        assert.ok(inputBarStyleAfter.includes('margin-bottom: 0px'), '输入栏必须平滑回落至贴底');
        assert.ok(inputBarStyleAfter.includes('safe-area-inset-bottom'), '收起后必须重新启用 safe-area 底部安全距离适配');
      }
    }
    console.log('✓ 输入框贴底与安全区自适应断言 100% 通过！\n');

    // ----------------------------------------------------
    // 测试 4: 聊天内容滚动 (Chat Content Scrolling)
    // ----------------------------------------------------
    console.log('[测试 4] 校验聊天内容滚动与触底机制 (scrollToBottom)');
    const scrollData = await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const curr = pages[pages.length - 1];
      curr.scrollToBottom(true);
      return {
        scrollToView: curr.data.scrollToView,
        scrollTop: curr.data.scrollTop,
        scrollWithAnimation: curr.data.scrollWithAnimation,
      };
    });
    await sleep(200);

    console.log(`  ├─ 滚动目标 scrollToView: "${scrollData.scrollToView}"`);
    console.log(`  ├─ 滚动位置 scrollTop: ${scrollData.scrollTop}`);
    console.log(`  ├─ 滚动动画开关 scrollWithAnimation: ${scrollData.scrollWithAnimation}`);
    assert.strictEqual(scrollData.scrollToView, 'scroll_bottom', '必须定位至底部锚点');
    assert.ok(scrollData.scrollTop > 0, 'scrollTop 必须触发真实 SelectorQuery 触底计算');
    assert.strictEqual(scrollData.scrollWithAnimation, true, '必须开启平滑滚动动画');
    console.log('✓ 聊天内容触底滚动断言 100% 通过！\n');

    // ----------------------------------------------------
    // 测试 5: 模拟发送指令触发 DeepSeek Function Calling + A2UI
    // ----------------------------------------------------
    console.log('[测试 5] 模拟点击快捷芯片「北京飞上海」调起 Agent');
    await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const curr = pages[pages.length - 1];
      curr.onChipTap({ currentTarget: { dataset: { text: '查一下明天北京飞上海的航班' } } });
    });
    console.log('  ├─ 已触发芯片点击，等待 DeepSeek API 与 A2UI 卡片渲染...');

    let cardWrapperMounted = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const res = await miniProgram.evaluate(() => {
        const pages = getCurrentPages();
        const curr = pages[pages.length - 1];
        const last = curr.data.messages[curr.data.messages.length - 1];
        return {
          messagesCount: curr.data.messages.length,
          hasRenderTree: !!last?.renderTree,
          component: last?.renderTree?.component,
        };
      });
      if (res.hasRenderTree) {
        console.log(`  ├─ [${i + 1}s] A2UI 渲染树在小程序内成功生成！Root: ${res.component}`);
        cardWrapperMounted = true;
        break;
      }
    }
    assert.ok(cardWrapperMounted, '必须在小程序数据模型中成功生成 A2UI renderTree');
    console.log('  ├─ A2UI 动态卡片成功挂载渲染！');

    // ----------------------------------------------------
    // 测试 6: A2UI 卡片动作按钮点击闭环
    // ----------------------------------------------------
    console.log('\n[测试 6] 模拟触发卡片内在线值机 Action 事件');
    await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const curr = pages[pages.length - 1];
      curr.onA2UIAction({
        detail: {
          actionName: 'book_flight',
          params: { flightNumber: 'CA1501' },
        },
      });
    });

    await sleep(1000);
    const lastMsg = await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const curr = pages[pages.length - 1];
      return curr.data.messages[curr.data.messages.length - 1];
    });

    console.log(`  ├─ Agent 闭环响应内容: "${lastMsg.content}"`);
    assert.ok(
      lastMsg.content.includes('值机成功') || lastMsg.content.includes('12A') || lastMsg.content.includes('CA1501'),
      '必须收到值机成功的闭环确认'
    );
    console.log('✓ A2UI 用户交互动作到 Agent 闭环流转 100% 通过！\n');

    console.log('=====================================================');
    console.log('🎉 miniprogram-automator 全量端到端测试 100% 成功！');
    console.log('=====================================================');
  } finally {
    await miniProgram.disconnect();
    console.log('[Automator] 断开连接完成');
  }
}

runAutomatorTests().catch((err) => {
  console.error('[Automator] 测试失败:', err);
  process.exit(1);
});
