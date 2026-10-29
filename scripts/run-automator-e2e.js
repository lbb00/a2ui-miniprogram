const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(__dirname, '../artifacts');

async function run() {
  console.log('Connecting to WeChat DevTools automator on ws://127.0.0.1:9421...');
  let miniProgram;
  try {
    miniProgram = await automator.connect({
      wsEndpoint: 'ws://127.0.0.1:9421',
    });
  } catch (err) {
    console.error('Failed to connect to ws://127.0.0.1:9421:', err.message);
    process.exit(1);
  }

  console.log('Connected successfully!');
  const page = await miniProgram.reLaunch('/pages/index/index');
  console.log('reLaunch /pages/index/index, waiting for streaming...');

  // Wait for stream rendering to settle (280ms * 6 = ~1.7s)
  await page.waitFor(2500);

  // 1. Get current page data
  const pageData = await page.data();
  console.log('Current Case:', pageData.currentCase?.name, `(${pageData.currentCase?.file})`);
  console.log('RenderTree Node Count:', pageData.nodeCount);
  console.log('Current Surface ID:', pageData.currentSurfaceId);

  // 2. Real DOM element inspection
  const surfaceEl = await page.$('a2ui-surface');
  console.log('a2ui-surface element found:', !!surfaceEl);

  // 3. Screenshot: save 00_incremental real render result
  const screenshotPath1 = path.join(ARTIFACT_DIR, 'a2ui_real_incremental_wechat.png');
  await miniProgram.screenshot({ path: screenshotPath1 });
  console.log('Saved screenshot 1 to:', screenshotPath1);

  // 4. Simulate tap on first "Book now" button for end-to-end action loop verification
  console.log('Testing interactive tap on Book now button...');
  const btn = await page.$('.a2ui-btn');
  if (btn) {
    await btn.tap();
    console.log('Tapped .a2ui-btn!');
    await page.waitFor(600);
    const updatedData = await page.data();
    console.log('Event Logs count:', updatedData.eventLogs?.length);
    if (updatedData.eventLogs?.length > 0) {
      console.log('Latest Event Log:', updatedData.eventLogs[0]);
    }
  } else {
    console.warn('No .a2ui-btn found on page!');
  }

  // 5. Screenshot post-interaction state
  const screenshotPath2 = path.join(ARTIFACT_DIR, 'a2ui_real_interaction_wechat.png');
  await miniProgram.screenshot({ path: screenshotPath2 });
  console.log('Saved screenshot 2 to:', screenshotPath2);

  // 6. Switch to 05_product-card.json for multi-case testing
  console.log('Switching to 05_product-card.json...');
  // Find product-card index
  const targetIdx = pageData.allCases.findIndex(c => c.file === '05_product-card.json');
  if (targetIdx !== -1) {
    await page.setData({
      selectedCaseIndex: targetIdx,
      currentCase: pageData.allCases[targetIdx],
    });
    // Render full direct output
    await page.callMethod('skipToDirect');
    await page.waitFor(1000);
    const productData = await page.data();
    console.log('Product Card nodeCount:', productData.nodeCount);
    const screenshotPath3 = path.join(ARTIFACT_DIR, 'a2ui_real_product_card_wechat.png');
    await miniProgram.screenshot({ path: screenshotPath3 });
    console.log('Saved screenshot 3 to:', screenshotPath3);
  }

  await miniProgram.disconnect();
  console.log('All automator operations completed!');
}

run().catch(e => {
  console.error('Automator Error:', e);
  process.exit(1);
});
