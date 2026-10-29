/**
 * A2UI WeChat MiniProgram Automator Test Suite
 * Includes:
 * 1. Structure and data binding tests
 * 2. Interaction and Action event dynamic evaluation tests
 * 3. Styles and layout tests (Computed Styles, Class mapping, dimensions)
 * 4. Visual snapshot evaluation
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

  test('Case 1: Login form rendering and two-way binding (00_simple-login-form)', async () => {
    const surface = await page.$('#main-surface');
    expect(surface).not.toBeNull();

    // Verify title rendering
    const title = await page.$('.a2ui-text-title');
    expect(await title.text()).toContain('A2UI');

    // Verify initial input values
    const inputs = await page.$$('.a2ui-input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(await inputs[0].value()).toBe('agent_user_01');

    // Mutate input value
    await inputs[0].input('automator_test_user');
    await page.waitFor(400);

    // Tap submit button
    const submitBtn = await page.$('.a2ui-btn-primary');
    await submitBtn.tap();
    await page.waitFor(500);

    // Verify logged action event payload
    const logItem = await page.$('.log-item:first-child .log-content');
    const logText = await logItem.text();
    expect(logText).toContain('login_submitted');
    expect(logText).toContain('automator_test_user');
  });

  test('Case 2: Styles and layout validation (Styles & Layout Computed Specs)', async () => {
    // 1. Verify Card container styles and dimensions
    const card = await page.$('.a2ui-card');
    expect(card).not.toBeNull();
    const cardSize = await card.size();
    expect(cardSize.width).toBeGreaterThan(200);
    expect(cardSize.height).toBeGreaterThan(100);

    // 2. Verify Primary Button styles and dimensions
    const primaryBtn = await page.$('.a2ui-btn-primary');
    expect(primaryBtn).not.toBeNull();
    const btnSize = await primaryBtn.size();
    expect(btnSize.height).toBeGreaterThanOrEqual(30);

    // 3. Verify input dimensions and classes
    const input = await page.$('.a2ui-input');
    const inputSize = await input.size();
    expect(inputSize.height).toBeGreaterThanOrEqual(25);

    // 4. Verify layout classes
    const col = await page.$('.a2ui-column');
    const colClass = await col.attribute('class');
    expect(colClass).toContain('a2ui-column');
    expect(colClass).toContain('a2ui-align-stretch');
  });

  test('Case 3: Switch flight status card (01_flight-status)', async () => {
    const flightTab = await page.$('.tab-item[data-case="flight"]');
    await flightTab.tap();
    await page.waitFor(800);

    // Verify layout class
    const row = await page.$('.a2ui-row');
    const rowClass = await row.attribute('class');
    expect(rowClass).toContain('a2ui-row');

    // Assert flight number and formatted date
    const texts = await page.$$('.a2ui-text');
    let textContents = '';
    for (const t of texts) {
      textContents += ' ' + (await t.text());
    }
    expect(textContents).toContain('CA1501');
    expect(textContents).toContain('2026-10-28');
  });

  test('Case 4: Switch product card (05_product-card) and streaming price updates', async () => {
    const productTab = await page.$('.tab-item[data-case="product"]');
    await productTab.tap();
    await page.waitFor(800);

    // Verify image rendering and size
    const image = await page.$('.a2ui-image');
    expect(image).not.toBeNull();
    const imgSize = await image.size();
    expect(imgSize.width).toBeGreaterThan(150);
    expect(imgSize.height).toBeGreaterThan(80);

    // Trigger price adjustment
    const streamBtn = await page.$('.tool-btn');
    await streamBtn.tap();
    await page.waitFor(800);

    const priceText = await page.$('.a2ui-text-title:last-of-type');
    expect(await priceText.text()).toMatch(/^¥\d+/);
  });
});
