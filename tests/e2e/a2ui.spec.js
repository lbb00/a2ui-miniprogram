/**
 * A2UI 微信小程序 miniprogram-automator 自动化测试套件
 * 包含：
 * 1. 结构与数据绑定测试
 * 2. 交互与 Action 事件动态求值测试
 * 3. 样式与布局测试（Computed Styles, Class 映射, 物理尺寸）
 * 4. 视觉快照截图
 */

const automator = require('miniprogram-automator');
const path = require('path');

const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = path.resolve(__dirname, '../../');

describe('A2UI WeChat MiniProgram Automator Tests', () => {
  let miniProgram;
  let page;

  beforeAll(async () => {
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
    });
    page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(1500);
  }, 60000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.close();
    }
  });

  test('Case 1: 登录表单渲染与双向绑定 (00_simple-login-form)', async () => {
    const surface = await page.$('#main-surface');
    expect(surface).not.toBeNull();

    // 校验标题渲染
    const title = await page.$('.a2ui-text-title');
    expect(await title.text()).toContain('A2UI 智能体用户登录');

    // 校验输入框初始绑定值
    const inputs = await page.$$('.a2ui-input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(await inputs[0].value()).toBe('agent_user_01');

    // 修改输入
    await inputs[0].input('automator_test_user');
    await page.waitFor(400);

    // 点击提交按钮
    const submitBtn = await page.$('.a2ui-btn-primary');
    await submitBtn.tap();
    await page.waitFor(500);

    // 校验日志区域捕获到的 Agent 上报事件
    const logItem = await page.$('.log-item:first-child .log-content');
    const logText = await logItem.text();
    expect(logText).toContain('login_submitted');
    expect(logText).toContain('automator_test_user');
  });

  test('Case 2: 样式与排版布局验证 (Styles & Layout Computed Specs)', async () => {
    // 1. 验证 Card 容器样式与尺寸
    const card = await page.$('.a2ui-card');
    expect(card).not.toBeNull();
    const cardSize = await card.size();
    expect(cardSize.width).toBeGreaterThan(200);
    expect(cardSize.height).toBeGreaterThan(100);

    // 2. 验证 Primary Button 视觉样式与尺寸
    const primaryBtn = await page.$('.a2ui-btn-primary');
    expect(primaryBtn).not.toBeNull();
    const btnSize = await primaryBtn.size();
    expect(btnSize.height).toBeGreaterThanOrEqual(30);

    // 3. 验证输入框高度与类名
    const input = await page.$('.a2ui-input');
    const inputSize = await input.size();
    expect(inputSize.height).toBeGreaterThanOrEqual(25);

    // 4. 验证布局辅助类映射
    const col = await page.$('.a2ui-column');
    const colClass = await col.attribute('class');
    expect(colClass).toContain('a2ui-column');
    expect(colClass).toContain('a2ui-align-stretch');
  });

  test('Case 3: 切换航班状态卡片 (01_flight-status)', async () => {
    const flightTab = await page.$('.tab-item[data-case="flight"]');
    await flightTab.tap();
    await page.waitFor(800);

    // 校验布局类名
    const row = await page.$('.a2ui-row');
    const rowClass = await row.attribute('class');
    expect(rowClass).toContain('a2ui-row');

    // 断言航班号与 formatDate 格式化
    const texts = await page.$$('.a2ui-text');
    let textContents = '';
    for (const t of texts) {
      textContents += ' ' + (await t.text());
    }
    expect(textContents).toContain('CA1501');
    expect(textContents).toContain('2026-10-28');
  });

  test('Case 4: 切换商品卡片 (05_product-card) 与流式调价', async () => {
    const productTab = await page.$('.tab-item[data-case="product"]');
    await productTab.tap();
    await page.waitFor(800);

    // 校验图片渲染与尺寸
    const image = await page.$('.a2ui-image');
    expect(image).not.toBeNull();
    const imgSize = await image.size();
    expect(imgSize.width).toBeGreaterThan(150);
    expect(imgSize.height).toBeGreaterThan(80);

    // 点击流式调价
    const streamBtn = await page.$('.tool-btn');
    await streamBtn.tap();
    await page.waitFor(800);

    const priceText = await page.$('.a2ui-text-title:last-of-type');
    expect(await priceText.text()).toMatch(/^¥\d+/);
  });
});
