const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const ALL_CASES = require('../fixtures/official-all-cases');
const { createSelfHostedShellMessages } = require('../fixtures/shell-schema');

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(__dirname, '../artifacts');
const EDGE_PATH = process.env.BROWSER_EXECUTABLE_PATH || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';

const wxssSurface = fs.readFileSync(path.resolve(__dirname, '../components/a2ui-surface/a2ui-surface.wxss'), 'utf8');
const wxssIndex = fs.readFileSync(path.resolve(__dirname, '../pages/index/index.wxss'), 'utf8');
const combinedCss = (wxssIndex + '\n' + wxssSurface).replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${parseFloat(n) * 0.5}px`);

function renderTreeToHtml(node) {
  if (!node) return '';
  const comp = node.component;
  const variant = node.variant || 'default';
  const align = node.align || 'start';
  const justify = node.justify || 'start';

  if (comp === 'Column') {
    const childrenHtml = (node.children || []).map(renderTreeToHtml).join('');
    return `<div class="a2ui-column a2ui-align-${align} a2ui-justify-${justify}">${childrenHtml}</div>`;
  }
  if (comp === 'Row') {
    const childrenHtml = (node.children || []).map(child => {
      const flexStyle = child.flexStyle || (child.weight ? `flex: ${child.weight} 1 0%; min-width: 0;` : (child.ownWidth ? 'flex: 0 0 auto;' : 'flex: 1 1 0%; min-width: 0;'));
      const ownClass = child.ownWidth ? 'a2ui-item-own' : 'a2ui-item-flex';
      return `<div class="a2ui-row-item ${ownClass}" style="${flexStyle}">${renderTreeToHtml(child)}</div>`;
    }).join('');
    return `<div class="a2ui-row a2ui-align-${align} a2ui-justify-${justify}">${childrenHtml}</div>`;
  }
  if (comp === 'Card') {
    const childrenHtml = (node.children || []).map(renderTreeToHtml).join('');
    return `<div class="a2ui-card">${childrenHtml}</div>`;
  }
  if (comp === 'Text') {
    return `<span class="a2ui-text a2ui-text-${variant}">${escapeHtml(node.text || '')}</span>`;
  }
  if (comp === 'Button') {
    const childHtml = node.children && node.children.length > 0
      ? node.children.map(renderTreeToHtml).join('')
      : escapeHtml(node.text || 'Button');
    return `<button class="a2ui-btn a2ui-btn-${variant}">${childHtml}</button>`;
  }
  if (comp === 'Divider') {
    return `<div class="a2ui-divider"></div>`;
  }
  if (comp === 'Image') {
    return `<img class="a2ui-image" src="${node.url || ''}" style="width:100%; height:160px; object-fit:cover;" />`;
  }
  if (comp === 'Icon') {
    return `<span class="a2ui-icon">⭐</span>`;
  }
  return `<div class="a2ui-fallback">${(node.children || []).map(renderTreeToHtml).join('')}</div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  });

  const page = await browser.newPage();
  const engine = new A2UIEngine();

  // 1. Initialize A2UI self-hosted shell
  const curCase = ALL_CASES.find(c => c.file === '00_incremental.json');
  const shellMessages = createSelfHostedShellMessages({
    caseIndex: 2,
    totalCases: 43,
    caseName: curCase.name,
    caseFile: curCase.file,
    streamStatus: 'Fully Ready',
    streamProgress: '6/6',
    nodeCount: 25,
    eventLogSummary: '[20:47:30] Captured action: book_now | payload: {"restaurantName": "The Golden Fork"}',
  });
  engine.process(shellMessages);
  const shellTree = engine.getRenderTree('a2ui-test-shell');

  // 2. Initialize official test case
  engine.process(curCase.messages);
  const caseTree = engine.getRenderTree('gallery-incremental');

  const shellHtml = renderTreeToHtml(shellTree);
  const caseHtml = renderTreeToHtml(caseTree);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=375, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #d9d9e5; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; }
    ${combinedCss}
    .self-hosted-page-scroll { height: 100vh; overflow-y: auto; }
    .self-hosted-layout { padding: 16px 16px 40px 16px; }
  </style>
</head>
<body>
  <div class="self-hosted-page-scroll">
    <div class="self-hosted-layout">
      <!-- 1. A2UI Shell Surface (Assembled via Card/Row/Button) -->
      <div class="shell-surface-container">
        <div class="a2ui-surface">
          ${shellHtml}
        </div>
      </div>

      <!-- 2. Official test case stage surface -->
      <div class="case-surface-container">
        <div class="case-stage-header">
          <span class="case-stage-tag">OFFICIAL GALLERY SURFACE</span>
          <span class="case-stage-id">[gallery-incremental]</span>
        </div>
        <div class="a2ui-surface">
          ${caseHtml}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  await page.setContent(fullHtml, { waitUntil: 'load' });
  const outPath = path.join(ARTIFACT_DIR, 'a2ui_pure_self_hosted_gallery.png');
  await page.screenshot({ path: outPath });
  console.log('Saved pure self-hosted screenshot to:', outPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
