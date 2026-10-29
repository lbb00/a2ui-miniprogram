/**
 * 自动化批量渲染 A2UI 官方全部 43 个用例的真实视图截屏
 * 使用系统 Chromium/Edge 驱动，挂载真实的 a2ui-surface.wxss
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const ALL_CASES = require('../fixtures/official-all-cases');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../artifacts/gallery_cases');
const EDGE_PATH = process.env.BROWSER_EXECUTABLE_PATH || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';

const wxssSurface = fs.readFileSync(path.resolve(__dirname, '../components/a2ui-surface/a2ui-surface.wxss'), 'utf8');
const wxssIndex = fs.readFileSync(path.resolve(__dirname, '../pages/index/index.wxss'), 'utf8');

// 转换 rpx 为 px (标准 375px 视口下 1rpx = 0.5px)
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

  if (comp === 'Button') {
    const childHtml = node.children && node.children.length > 0
      ? node.children.map(renderTreeToHtml).join('')
      : escapeHtml(node.text || 'Button');
    return `<button class="a2ui-btn a2ui-btn-${variant || 'outlined'}">${childHtml}</button>`;
  }

  if (comp === 'Image') {
    const modeClass = node.mode === 'aspectFit' ? 'a2ui-image-aspectFit' : 'a2ui-image-aspectFill';
    return `<img class="a2ui-image a2ui-image-${variant || 'default'} ${modeClass}" src="${node.url || ''}" />`;
  }

  if (comp === 'Icon') {
    return `<span class="a2ui-icon a2ui-icon-${node.name || 'star'}">${node.iconGlyph || '✦'}</span>`;
  }

  if (comp === 'Divider') {
    return `<div class="a2ui-divider"></div>`;
  }

  if (comp === 'TextField') {
    return `
      <div class="a2ui-textfield-wrap">
        <label class="a2ui-textfield-label">${escapeHtml(node.label || '')}</label>
        <input class="a2ui-input" type="text" placeholder="${escapeHtml(node.placeholder || '')}" value="${escapeHtml(node.value || '')}" />
      </div>
    `;
  }

  if (comp === 'List') {
    const isHorizontal = node.direction === 'horizontal';
    const childrenHtml = (node.children || []).map(renderTreeToHtml).join('');
    return `<div class="a2ui-list ${isHorizontal ? 'a2ui-list-horizontal' : 'a2ui-list-wrap'}">${childrenHtml}</div>`;
  }

  if (comp === 'Tabs') {
    const tabsList = (node.tabs || []).map((t, idx) => `
      <div class="a2ui-tab-item ${idx === 0 ? 'active' : ''}">${escapeHtml(t.title || `Tab ${idx + 1}`)}</div>
    `).join('');
    const childrenHtml = (node.children || []).map(renderTreeToHtml).join('');
    return `
      <div class="a2ui-tabs">
        <div class="a2ui-tabs-header">${tabsList}</div>
        <div class="a2ui-tabs-content">${childrenHtml}</div>
      </div>
    `;
  }

  if (comp === 'Modal') {
    const childrenHtml = (node.children || []).map(renderTreeToHtml).join('');
    return `<div class="a2ui-modal-preview"><div class="a2ui-modal-content">${childrenHtml}</div></div>`;
  }

  if (comp === 'CheckBox') {
    return `
      <div class="a2ui-checkbox-wrap">
        <span class="a2ui-checkbox-box ${node.checked ? 'checked' : ''}"></span>
        <span class="a2ui-checkbox-label">${escapeHtml(node.label || '')}</span>
      </div>
    `;
  }

  if (comp === 'ChoicePicker') {
    const options = (node.options || []).map(o => `<option>${escapeHtml(o.label || o.value)}</option>`).join('');
    return `
      <div class="a2ui-picker-wrap">
        <label class="a2ui-picker-label">${escapeHtml(node.label || '')}</label>
        <select class="a2ui-picker-select">${options}</select>
      </div>
    `;
  }

  if (comp === 'Slider') {
    return `
      <div class="a2ui-slider-wrap">
        <label class="a2ui-slider-label">${escapeHtml(node.label || '')} (${node.value || 0})</label>
        <input type="range" class="a2ui-slider" min="${node.min || 0}" max="${node.max || 100}" value="${node.value || 0}" />
      </div>
    `;
  }

  if (comp === 'DateTimeInput') {
    return `
      <div class="a2ui-datetime-wrap">
        <label class="a2ui-datetime-label">${escapeHtml(node.label || '')}</label>
        <input type="text" class="a2ui-datetime-input" value="${escapeHtml(node.value || '2026-10-28')}" />
      </div>
    `;
  }

  return `<div class="a2ui-unknown">[${comp}]</div>`;
}

function buildHtml(caseData, tree) {
  const innerHtml = renderTreeToHtml(tree);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=375, initial-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #ebebf2;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif;
      padding: 16px;
      display: flex;
      justify-content: center;
      min-height: 100vh;
    }
    .phone-container {
      width: 375px;
      min-height: 520px;
      background: #ebebf2;
    }
    .header-banner {
      background: #ffffff;
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .header-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e1e24;
    }
    .header-file {
      font-size: 11px;
      color: #6a6eac;
      font-family: monospace;
    }
    ${combinedCss}
  </style>
</head>
<body>
  <div class="phone-container">
    <div class="header-banner">
      <span class="header-title">${escapeHtml(caseData.name || caseData.file)}</span>
      <span class="header-file">${escapeHtml(caseData.file)}</span>
    </div>
    <div class="a2ui-surface">
      ${innerHtml}
    </div>
  </div>
</body>
</html>
  `;
}

async function renderAll() {
  console.log(`Starting batch render for all ${ALL_CASES.length} cases...`);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 700, deviceScaleFactor: 2 });

  const summary = [];

  for (let i = 0; i < ALL_CASES.length; i++) {
    const curCase = ALL_CASES[i];
    const engine = new A2UIEngine();
    engine.process(curCase.messages || []);

    let surfaceId = '';
    for (const msg of (curCase.messages || [])) {
      if (msg.createSurface?.surfaceId) {
        surfaceId = msg.createSurface.surfaceId;
        break;
      }
    }

    const tree = engine.getRenderTree(surfaceId);
    const html = buildHtml(curCase, tree);

    await page.setContent(html, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 60));

    const num = (i + 1).toString().padStart(2, '0');
    const safeName = (curCase.file || `case_${num}`).replace(/\.json$/, '');
    const outFileName = `case_${num}_${safeName}.png`;
    const outPath = path.join(OUTPUT_DIR, outFileName);

    await page.screenshot({ path: outPath, fullPage: true });
    summary.push({ index: i + 1, file: curCase.file, name: curCase.name, outPath });
    if ((i + 1) % 10 === 0 || i === ALL_CASES.length - 1) {
      console.log(`Rendered [${i + 1}/${ALL_CASES.length}]: ${outFileName}`);
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Batch render completed! Saved ${summary.length} images to ${OUTPUT_DIR}`);
}

renderAll().catch(err => {
  console.error('Batch render failed:', err);
  process.exit(1);
});
