const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const ALL_CASES = require('../fixtures/official-all-cases');

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
    const childrenHtml = (node.children || []).map(renderTreeToHtml).join('');
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
  if (comp === 'TextField') {
    return `
      <div class="a2ui-form-item">
        ${node.label ? `<label class="a2ui-label">${escapeHtml(node.label)}</label>` : ''}
        <input class="a2ui-input" value="${escapeHtml(node.value || '')}" readonly />
      </div>
    `;
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

  // 1. 渲染 00_incremental.json (官方 Gallery 蓝紫色主题实测)
  const engine1 = new A2UIEngine();
  const case1 = ALL_CASES.find(c => c.file === '00_incremental.json');
  engine1.process(case1.messages);
  const tree1 = engine1.getRenderTree('gallery-incremental');
  const html1 = renderTreeToHtml(tree1);

  const fullHtml1 = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=375, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ${combinedCss}
    .surfaces-scroll-list { flex: 1; overflow-y: auto; }
    .surfaces-list-inner { padding: 16px 16px 60px 16px; }
  </style>
</head>
<body>
  <div class="flutter-scaffold light-theme">
    <div class="flutter-safe-area">
      <!-- ThemeToggleButton -->
      <div class="theme-toggle-btn"><span class="theme-icon">🌙</span></div>

      <!-- Top Case Switcher -->
      <div class="top-case-switcher">
        <div class="case-chip">
          <span class="case-chip-tag">03/43</span>
          <span class="case-chip-title">Incremental (00_incremental.json)</span>
          <span class="case-chip-caret">▾</span>
        </div>
        <div class="inspector-trigger-btn"><span class="trigger-icon">⌥</span></div>
      </div>

      <div class="flutter-surfaces-container">
        <div class="surfaces-header-bar">
          <div class="back-to-search-btn">
            <span class="back-icon">‹</span>
            <span class="back-label">返回搜索</span>
          </div>
          <div class="surface-status-pill">
            <span class="dot-indicator"></span>
            <span class="pill-meta">gallery-incremental (25 节点)</span>
          </div>
          <div class="replay-stream-btn">
            <span class="replay-icon">⟳ 流式回放</span>
          </div>
        </div>

        <div class="surfaces-scroll-list">
          <div class="surfaces-list-inner">
            <div class="a2ui-surface">
              ${html1}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  await page.setContent(fullHtml1, { waitUntil: 'load' });
  const out1 = path.join(ARTIFACT_DIR, 'a2ui_official_purple_gallery.png');
  await page.screenshot({ path: out1 });
  console.log('Saved:', out1);

  // 2. 渲染 08_user-profile.json (官方 Gallery 图中的 Sarah Chen 用户卡片)
  const engine2 = new A2UIEngine();
  const case2 = ALL_CASES.find(c => c.file === '08_user-profile.json');
  engine2.process(case2.messages);
  const surfaces2 = Array.from(engine2.surfaces.keys());
  const tree2 = engine2.getRenderTree(surfaces2[0]);
  const html2 = renderTreeToHtml(tree2);

  const fullHtml2 = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=375, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ${combinedCss}
    .surfaces-scroll-list { flex: 1; overflow-y: auto; }
    .surfaces-list-inner { padding: 16px 16px 60px 16px; }
  </style>
</head>
<body>
  <div class="flutter-scaffold light-theme">
    <div class="flutter-safe-area">
      <div class="theme-toggle-btn"><span class="theme-icon">🌙</span></div>

      <div class="top-case-switcher">
        <div class="case-chip">
          <span class="case-chip-tag">15/43</span>
          <span class="case-chip-title">User Profile (08_user-profile.json)</span>
          <span class="case-chip-caret">▾</span>
        </div>
        <div class="inspector-trigger-btn"><span class="trigger-icon">⌥</span></div>
      </div>

      <div class="flutter-surfaces-container">
        <div class="surfaces-header-bar">
          <div class="back-to-search-btn">
            <span class="back-icon">‹</span>
            <span class="back-label">返回搜索</span>
          </div>
          <div class="surface-status-pill">
            <span class="dot-indicator"></span>
            <span class="pill-meta">${surfaces2[0]} (19 节点)</span>
          </div>
          <div class="replay-stream-btn">
            <span class="replay-icon">⟳ 流式回放</span>
          </div>
        </div>

        <div class="surfaces-scroll-list">
          <div class="surfaces-list-inner">
            <div class="a2ui-surface">
              ${html2}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  await page.setContent(fullHtml2, { waitUntil: 'load' });
  const out2 = path.join(ARTIFACT_DIR, 'a2ui_official_user_profile.png');
  await page.screenshot({ path: out2 });
  console.log('Saved:', out2);

  await browser.close();
}

main().catch(err => {
  console.error('Render error:', err);
  process.exit(1);
});
