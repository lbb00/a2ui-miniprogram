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
    if (node.richHtml) {
      return `<div class="a2ui-text a2ui-text-${variant}">${node.richHtml}</div>`;
    }
    return `<span class="a2ui-text a2ui-text-${variant}">${escapeHtml(node.text || '')}</span>`;
  }
  if (comp === 'List') {
    const isHorizontal = node.direction === 'horizontal';
    const childrenHtml = (node.children || []).map(renderTreeToHtml).join('');
    return `<div class="a2ui-list ${isHorizontal ? 'a2ui-list-horizontal' : 'a2ui-list-wrap'}">${childrenHtml}</div>`;
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

  // 1. Render Flutter initial form state (_buildForm)
  const formHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=375, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ${combinedCss}
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

      <!-- _buildForm() -->
      <div class="flutter-form-container">
        <div class="restaurant-hero-icon"><span class="hero-icon-char">🍽️</span></div>
        <h1 class="headline-medium">Restaurant Finder</h1>

        <div class="search-input-row">
          <input class="flutter-text-field" value="Find me 3 Chinese restaurants in New York." readonly />
          <div class="flutter-circle-send-btn"><span class="send-arrow-icon">➔</span></div>
        </div>

        <div class="preset-chips-group">
          <div class="preset-chip"><span class="preset-chip-text">🍽 Recommend 4 top-rated NYC restaurants with instant booking</span></div>
          <div class="preset-chip"><span class="preset-chip-text">✈️ Check live flight status from Beijing to Shanghai</span></div>
          <div class="preset-chip"><span class="preset-chip-text">🎧 View Sony wireless noise-canceling headphones reviews</span></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  await page.setContent(formHtml, { waitUntil: 'load' });
  const picForm = path.join(ARTIFACT_DIR, 'flutter_align_form.png');
  await page.screenshot({ path: picForm });
  console.log('Saved:', picForm);

  // 2. Render Flutter A2UI Surfaces result state (_buildSurfaces)
  const engine = new A2UIEngine();
  const curCase = ALL_CASES.find(c => c.file === '00_incremental.json');
  engine.process(curCase.messages);
  const caseTree = engine.getRenderTree('gallery-incremental');
  const caseHtml = renderTreeToHtml(caseTree);

  const surfacesHtml = `
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

      <!-- _buildSurfaces() -->
      <div class="flutter-surfaces-container">
        <div class="surfaces-header-bar">
          <div class="back-to-search-btn">
            <span class="back-icon">‹</span>
            <span class="back-label">Back to Search</span>
          </div>
          <div class="surface-status-pill">
            <span class="dot-indicator"></span>
            <span class="pill-meta">gallery-incremental (25 nodes)</span>
          </div>
          <div class="replay-stream-btn">
            <span class="replay-icon">⟳ Stream Replay</span>
          </div>
        </div>

        <div class="surfaces-scroll-list">
          <div class="surfaces-list-inner">
            <div class="a2ui-surface">
              ${caseHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  await page.setContent(surfacesHtml, { waitUntil: 'load' });
  const picSurfaces = path.join(ARTIFACT_DIR, 'flutter_align_surfaces.png');
  await page.screenshot({ path: picSurfaces });
  console.log('Saved:', picSurfaces);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
