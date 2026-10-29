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

  const curCase = ALL_CASES.find(c => c.file === '00_incremental.json');
  engine.process(curCase.messages);
  const caseTree = engine.getRenderTree('gallery-incremental');
  const caseHtml = renderTreeToHtml(caseTree);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=375, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f7f8fa; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif; }
    ${combinedCss}
    .chat-viewport { flex: 1; overflow-y: auto; }
    .chat-content { padding: 14px 14px 20px 14px; }
  </style>
</head>
<body>
  <div class="agent-app-container">
    
    <!-- 1. 顶部 Agent 状态栏 -->
    <div class="agent-nav-bar">
      <div class="agent-identity">
        <div class="agent-status-dot online"></div>
        <div class="agent-info">
          <span class="agent-name">A2UI Agent</span>
          <span class="agent-status-text">就绪 · 帧 6/6 · 25 节点</span>
        </div>
      </div>

      <div class="sample-picker-pill">
        <span class="sample-tag">03/43</span>
        <span class="sample-name">Incremental (00_incremental.json)</span>
        <span class="picker-caret">▾</span>
      </div>

      <div class="nav-action-group">
        <div class="nav-icon-btn"><span class="nav-icon">⟳</span></div>
        <div class="nav-icon-btn"><span class="nav-icon">⌥</span></div>
      </div>
    </div>

    <!-- 2. 主会话与 Surface 舞台 -->
    <div class="chat-viewport">
      <div class="chat-content">
        
        <!-- 用户提问气泡 -->
        <div class="user-message-row">
          <div class="user-bubble">
            <span class="user-prompt-text">推荐 4 家纽约高分特色餐厅并支持即时预订</span>
          </div>
        </div>

        <!-- Agent 动态下发并渲染出的 Surface -->
        <div class="agent-surface-wrapper">
          <div class="surface-badge-row">
            <span class="surface-tag">A2UI SURFACE: gallery-incremental</span>
            <span class="surface-meta">已装配 25 个节点 · 交互已就绪</span>
          </div>

          <div class="a2ui-surface">
            ${caseHtml}
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 底部 Agent 交互输入与快捷意图胶囊 -->
    <div class="agent-bottom-bar">
      <div class="chips-row" style="margin-bottom: 8px;">
        <div class="chip-item active"><span class="chip-text">🍽 餐厅探索与预订</span></div>
        <div class="chip-item"><span class="chip-text">✈️ 实时航班动态</span></div>
        <div class="chip-item"><span class="chip-text">🎧 电商商品卡片</span></div>
        <div class="chip-item"><span class="chip-text">🥗 美食菜谱指南</span></div>
      </div>

      <div class="input-row">
        <input class="agent-input" placeholder="向 A2UI Agent 提问或切换场景..." readonly value="推荐 4 家纽约高分特色餐厅..." />
        <div class="send-btn"><span class="send-btn-icon">↑</span></div>
      </div>
    </div>

  </div>
</body>
</html>
  `;

  await page.setContent(fullHtml, { waitUntil: 'load' });
  const outPath = path.join(ARTIFACT_DIR, 'a2ui_official_agent_app.png');
  await page.screenshot({ path: outPath });
  console.log('Saved official agent app screenshot to:', outPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
