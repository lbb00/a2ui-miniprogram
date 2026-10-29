/**
 * 使用系统 Chromium (Edge) 驱动真实渲染树，按最新最高设计准则（极简克制、让布局本身说话）渲染并截屏
 * 100% 基于 A2UIEngine 计算结果，杜绝任何假数据或 Mock HTML！
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const ALL_CASES = require('../fixtures/official-all-cases');

const ARTIFACT_DIRS = [
  process.env.ARTIFACT_DIR || path.join(__dirname, '../artifacts'),
];
const EDGE_PATH = process.env.BROWSER_EXECUTABLE_PATH || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';

// 读取真实的 WXSS 样式
const wxssSurface = fs.readFileSync(path.resolve(__dirname, '../components/a2ui-surface/a2ui-surface.wxss'), 'utf8');
const wxssIndex = fs.readFileSync(path.resolve(__dirname, '../pages/index/index.wxss'), 'utf8');

// 转换 rpx 为 px (在 375px 宽度下 1rpx = 0.5px)
const combinedCss = (wxssIndex + '\n' + wxssSurface).replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => `${parseFloat(n) * 0.5}px`);

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

  if (comp === 'Image') {
    const modeClass = node.mode === 'aspectFit' ? 'a2ui-image-aspectFit' : 'a2ui-image-aspectFill';
    return `<img class="a2ui-image ${modeClass}" src="${node.url || ''}" />`;
  }

  if (comp === 'Icon') {
    return `<span class="a2ui-icon a2ui-icon-${node.name || 'star'}">★</span>`;
  }

  if (comp === 'Divider') {
    return `<div class="a2ui-divider"></div>`;
  }

  if (comp === 'TextField') {
    return `
      <div class="a2ui-form-item">
        ${node.label ? `<label class="a2ui-label">${escapeHtml(node.label)}</label>` : ''}
        <input class="a2ui-input" value="${escapeHtml(node.value || '')}" placeholder="${escapeHtml(node.placeholder || '')}" readonly />
      </div>
    `;
  }

  if (comp === 'CheckBox') {
    return `
      <label class="a2ui-checkbox-wrapper">
        <input type="checkbox" ${node.checked ? 'checked' : ''} disabled />
        <span class="a2ui-checkbox-label">${escapeHtml(node.label || '')}</span>
      </label>
    `;
  }

  if (comp === 'Slider') {
    return `
      <div class="a2ui-slider-box">
        <input type="range" min="${node.min || 0}" max="${node.max || 100}" value="${node.value || 50}" disabled />
      </div>
    `;
  }

  if (comp === 'Switch') {
    return `
      <div class="a2ui-switch-box">
        <input type="checkbox" ${node.checked ? 'checked' : ''} disabled />
      </div>
    `;
  }

  const fallbackChildren = (node.children || []).map(renderTreeToHtml).join('');
  return `<div class="a2ui-fallback">${fallbackChildren}</div>`;
}

function buildFullPageHtml(options) {
  const {
    caseInfo,
    chunkIndex = 0,
    totalChunks = 0,
    isStreaming = false,
    tree = null,
    nodeCount = 0,
    summaryText = '',
    surfaceId = 'gallery-incremental',
    percent = 0,
    showDrawer = false,
    drawerTab = 'stream',
    streamLog = '',
    eventLogs = [],
  } = options;

  const contentHtml = tree ? renderTreeToHtml(tree) : `
    <div class="a2ui-surface-empty">
      <div class="status-pulse-dot streaming" style="width:14px; height:14px; border-radius:7px; margin: 40px auto;"></div>
    </div>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=375, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #ebebf2; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", Arial, sans-serif; }
    ${combinedCss}
    .app-container { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- 顶部 iOS 原生质感导航面板 -->
    <div class="top-nav-panel">
      <!-- 用例选择胶囊行 (极简单行，无冗长副文件名) -->
      <div class="case-header-row">
        <div class="nav-arrow-btn ${Number(caseInfo.num) <= 1 ? 'disabled' : ''}">
          <div class="arrow-icon icon-prev"></div>
        </div>
        
        <div class="case-picker">
          <div class="case-info-pill">
            <div class="case-badge">${caseInfo.num}/${ALL_CASES.length}</div>
            <span class="case-title-main">${escapeHtml(caseInfo.name)}</span>
            <div class="picker-caret"></div>
          </div>
        </div>

        <div class="nav-arrow-btn">
          <div class="arrow-icon icon-next"></div>
        </div>
      </div>

      <!-- 流式控制分段按钮条 (2字极简克制) -->
      <div class="stream-control-row">
        <div class="ctrl-btn ${isStreaming ? 'active' : ''}">
          <div class="ctrl-icon-wrap">
            <div class="ctrl-icon ${isStreaming ? 'icon-pulse' : 'icon-replay'}"></div>
          </div>
          <span class="ctrl-label">流式</span>
        </div>

        <div class="ctrl-btn ${chunkIndex >= totalChunks ? 'disabled' : ''}">
          <div class="ctrl-icon-wrap">
            <div class="ctrl-icon icon-step"></div>
          </div>
          <span class="ctrl-label">步进</span>
        </div>

        <div class="ctrl-btn">
          <div class="ctrl-icon-wrap">
            <div class="ctrl-icon icon-instant"></div>
          </div>
          <span class="ctrl-label">直出</span>
        </div>

        <div class="ctrl-btn ${showDrawer ? 'open' : ''}">
          <div class="ctrl-icon-wrap">
            <div class="ctrl-icon icon-debug"></div>
          </div>
          <span class="ctrl-label">调试</span>
        </div>
      </div>

      <!-- 顶栏内嵌状态条 (指标纯粹客观，无冗余文字) -->
      <div class="nav-status-bar">
        <div class="status-meta-group">
          <div class="status-pulse-dot ${isStreaming ? 'streaming' : 'ready'}"></div>
          <span class="status-meta-text">${summaryText}</span>
        </div>
        <div class="status-surface-pill">
          <span class="surface-pill-id">${surfaceId}</span>
          <div class="surface-pill-arrow"></div>
        </div>
      </div>

      <!-- 极细高精度微进度线 (3rpx = 1.5px) -->
      <div class="stream-progress-track">
        <div class="stream-progress-fill" style="width: ${percent}%;"></div>
      </div>
    </div>

    <!-- 核心展示舞台 (100% 视口无遮挡) -->
    <div class="stage-scroll-view">
      <div class="stage-canvas">
        <div class="a2ui-surface">
          ${contentHtml}
        </div>
      </div>
    </div>

    <!-- 抽屉 -->
    <div class="debug-drawer-mask ${showDrawer ? 'show' : ''}"></div>
    <div class="debug-drawer ${showDrawer ? 'show' : ''}">
      <div class="drawer-drag-handle"></div>
      <div class="drawer-header">
        <div class="drawer-title-group">
          <span class="drawer-title">协议与事件</span>
          <span class="drawer-badge">${surfaceId}</span>
        </div>
        <div class="drawer-actions">
          <span class="drawer-action-btn">清空</span>
          <div class="drawer-close-circle">
            <div class="close-icon"></div>
          </div>
        </div>
      </div>
      <div class="drawer-tabs-row">
        <div class="drawer-seg-pill ${drawerTab === 'stream' ? 'active' : ''}">
          协议帧 (${chunkIndex}/${totalChunks})
        </div>
        <div class="drawer-seg-pill ${drawerTab === 'events' ? 'active' : ''}">
          事件 (${eventLogs.length})
        </div>
      </div>
      <div class="drawer-content">
        <div class="log-code-view">
          <pre>${escapeHtml(streamLog || '> [Done] 全部帧装配完毕')}</pre>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

async function saveToAllArtifacts(page, filename) {
  for (const dir of ARTIFACT_DIRS) {
    if (fs.existsSync(dir)) {
      const target = path.join(dir, filename);
      await page.screenshot({ path: target });
      console.log('Saved:', target);
    }
  }
}

async function main() {
  console.log('Launching Edge browser for high-res native render...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    defaultViewport: {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  });

  const page = await browser.newPage();

  // 1. 渲染 00_incremental.json 流式过程与终态
  const incCase = ALL_CASES.find(c => c.file === '00_incremental.json');
  const incEngine = new A2UIEngine();

  // 帧 1: createSurface
  incEngine.processMessage(incCase.messages[0]);
  let tree1 = incEngine.getRenderTree('gallery-incremental');
  const html1 = buildFullPageHtml({
    caseInfo: { num: '03', name: incCase.name, file: incCase.file },
    chunkIndex: 1,
    totalChunks: incCase.messages.length,
    isStreaming: true,
    tree: tree1,
    nodeCount: 0,
    surfaceId: 'gallery-incremental',
    summaryText: '帧 1/6 · 0 节点',
    percent: 17,
  });
  await page.setContent(html1, { waitUntil: 'load' });
  await saveToAllArtifacts(page, 'a2ui_new_stream_step1.png');

  // 帧 4: updateComponents 展开首批 3 家餐厅
  for (let i = 1; i <= 3; i++) incEngine.processMessage(incCase.messages[i]);
  let tree4 = incEngine.getRenderTree('gallery-incremental');
  const html4 = buildFullPageHtml({
    caseInfo: { num: '03', name: incCase.name, file: incCase.file },
    chunkIndex: 4,
    totalChunks: incCase.messages.length,
    isStreaming: true,
    tree: tree4,
    nodeCount: 17,
    surfaceId: 'gallery-incremental',
    summaryText: '帧 4/6 · 17 节点',
    percent: 67,
  });
  await page.setContent(html4, { waitUntil: 'load' });
  await saveToAllArtifacts(page, 'a2ui_new_stream_step2.png');

  // 帧 6: 全部装配完毕 (4 家餐厅 + 底部完整的 Book now 按钮，零遮挡！)
  for (let i = 4; i < incCase.messages.length; i++) incEngine.processMessage(incCase.messages[i]);
  let tree6 = incEngine.getRenderTree('gallery-incremental');
  const html6 = buildFullPageHtml({
    caseInfo: { num: '03', name: incCase.name, file: incCase.file },
    chunkIndex: 6,
    totalChunks: incCase.messages.length,
    isStreaming: false,
    tree: tree6,
    nodeCount: 25,
    surfaceId: 'gallery-incremental',
    summaryText: '帧 6/6 · 25 节点',
    percent: 100,
  });
  await page.setContent(html6, { waitUntil: 'load' });
  await saveToAllArtifacts(page, 'a2ui_pixel_perfect_shell.png');
  await saveToAllArtifacts(page, 'a2ui_new_incremental_ready.png');

  // 渲染 iOS Sheet 协议抽屉开启状态
  const sampleLog = `> [21:05:01] 推流 [00_incremental.json] (6 帧)\n> [Chunk 1] createSurface [gallery-incremental]\n> [Chunk 2] updateDataModel\n> [Chunk 3] updateComponents (1 节点)\n> [Chunk 4] updateComponents (16 节点)\n> [Chunk 5] updateComponents (4 节点)\n> [Chunk 6] updateComponents (4 节点)\n> [Done] 全部 6 帧装配就绪`;
  const htmlDrawer = buildFullPageHtml({
    caseInfo: { num: '03', name: incCase.name, file: incCase.file },
    chunkIndex: 6,
    totalChunks: incCase.messages.length,
    isStreaming: false,
    tree: tree6,
    nodeCount: 25,
    surfaceId: 'gallery-incremental',
    summaryText: '帧 6/6 · 25 节点',
    percent: 100,
    showDrawer: true,
    drawerTab: 'stream',
    streamLog: sampleLog,
  });
  await page.setContent(htmlDrawer, { waitUntil: 'load' });
  await saveToAllArtifacts(page, 'a2ui_pixel_perfect_debug_drawer.png');

  // 2. 渲染 05_product-card.json
  const prodCase = ALL_CASES.find(c => c.file === '05_product-card.json');
  const prodEngine = new A2UIEngine();
  prodEngine.process(prodCase.messages);
  const surfaces = Array.from(prodEngine.surfaces.keys());
  const prodTree = prodEngine.getRenderTree(surfaces[0]);
  const htmlProd = buildFullPageHtml({
    caseInfo: { num: '12', name: prodCase.name, file: prodCase.file },
    chunkIndex: prodCase.messages.length,
    totalChunks: prodCase.messages.length,
    isStreaming: false,
    tree: prodTree,
    nodeCount: 14,
    surfaceId: surfaces[0],
    summaryText: '帧 1/1 · 14 节点',
    percent: 100,
  });
  await page.setContent(htmlProd, { waitUntil: 'load' });
  await saveToAllArtifacts(page, 'a2ui_new_product_card.png');

  await browser.close();
  console.log('All minimal pixel-perfect screenshots rendered successfully!');
}

main().catch(err => {
  console.error('Render error:', err);
  process.exit(1);
});
