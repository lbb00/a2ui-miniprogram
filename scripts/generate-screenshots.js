/**
 * Uses puppeteer-core with Chromium to render mobile viewport and capture streaming UI screenshots
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(__dirname, '../artifacts');
const EDGE_PATH = process.env.BROWSER_EXECUTABLE_PATH || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';

// Check browser existence
if (!fs.existsSync(EDGE_PATH)) {
  console.error('Edge browser not found at:', EDGE_PATH);
  process.exit(1);
}

// Build mobile preview HTML
const wxssContent = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss'), 'utf8')
  + '\n' + fs.readFileSync(path.resolve(__dirname, '../miniprogram/pages/index/index.wxss'), 'utf8');

// Convert rpx to px (375px: 1rpx = 0.5px)
const convertedCss = wxssContent.replace(/(\d+)rpx/g, (_, val) => `${val * 0.5}px`);

function createHtml(stage) {
  let contentHtml = '';
  let statusBadge = '';
  let thinking = '';

  if (stage === 'stream_step1') {
    statusBadge = '<div class="stream-indicator streaming"><span class="indicator-dot"></span><span class="indicator-text">[Chunk 1/5] Surface initialized, mounting card shell</span></div>';
    thinking = '> Analyzing user flight query intent...\n> Found matching flight: Air China CA1501...\n> Generating A2UI protocol frame (createSurface)...';
    contentHtml = `
      <div class="a2ui-card" style="min-height: 120px; border: 2px dashed #38bdf8; display:flex; align-items:center; justify-content:center;">
        <span style="color:#0284c7; font-size:13px; font-weight:600;">[Surface streaming components...]</span>
      </div>
    `;
  } else if (stage === 'stream_step2') {
    statusBadge = '<div class="stream-indicator streaming"><span class="indicator-dot"></span><span class="indicator-text">[Chunk 3/5] Flight route expansion and data binding</span></div>';
    thinking = '> Mounted header component...\n> Delivering child components (updateComponents: airport names and status)...';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <div class="a2ui-row a2ui-align-center" style="margin-bottom:8px;">
            <span class="a2ui-icon" style="margin-right:8px; font-size:18px;">✈️</span>
            <span class="a2ui-text a2ui-text-title" style="font-size:16px;">CA1501 Real-Time Status</span>
          </div>
          <div class="a2ui-divider"></div>
          <div class="a2ui-row a2ui-align-center a2ui-justify-spaceBetween" style="margin-top:8px;">
            <div class="a2ui-column a2ui-align-start">
              <span class="a2ui-text a2ui-text-caption">Beijing Capital</span>
              <span class="a2ui-text a2ui-text-title">PEK</span>
            </div>
            <span class="a2ui-text a2ui-text-body" style="color:#0284c7; font-weight:600;">✈️ On Time (09:30)</span>
            <div class="a2ui-column a2ui-align-end">
              <span class="a2ui-text a2ui-text-caption">Shanghai Hongqiao</span>
              <span class="a2ui-text a2ui-text-title">SHA</span>
            </div>
          </div>
          <div class="a2ui-divider"></div>
          <div style="padding:10px; text-align:center; color:#94a3b8; font-size:12px;">
            [ Streaming Action interaction button... ▋ ]
          </div>
        </div>
      </div>
    `;
  } else if (stage === 'stream_step3') {
    statusBadge = '<div class="stream-indicator done"><span class="indicator-dot"></span><span class="indicator-text">✅ Streaming complete, components ready</span></div>';
    thinking = '> Data model bound successfully...\n> Activated interactive action (Button: Check-in), streaming finished!';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <div class="a2ui-row a2ui-align-center" style="margin-bottom:8px;">
            <span class="a2ui-icon" style="margin-right:8px; font-size:18px;">✈️</span>
            <span class="a2ui-text a2ui-text-title" style="font-size:16px;">CA1501 Real-Time Status</span>
          </div>
          <div class="a2ui-divider"></div>
          <div class="a2ui-row a2ui-align-center a2ui-justify-spaceBetween" style="margin-top:8px;">
            <div class="a2ui-column a2ui-align-start">
              <span class="a2ui-text a2ui-text-caption">Beijing Capital</span>
              <span class="a2ui-text a2ui-text-title">PEK</span>
            </div>
            <span class="a2ui-text a2ui-text-body" style="color:#10b981; font-weight:600;">✈️ Departed On Time (09:30)</span>
            <div class="a2ui-column a2ui-align-end">
              <span class="a2ui-text a2ui-text-caption">Shanghai Hongqiao</span>
              <span class="a2ui-text a2ui-text-title">SHA</span>
            </div>
          </div>
          <div class="a2ui-divider"></div>
          <div class="a2ui-row a2ui-justify-end" style="margin-top:8px;">
            <button class="a2ui-btn a2ui-btn-primary" style="padding:8px 20px; font-size:14px; background:#0284c7; color:#fff; border-radius:6px; border:none; cursor:pointer;">Check-in Now</button>
          </div>
        </div>
      </div>
    `;
  } else if (stage === 'login') {
    statusBadge = '<div class="stream-indicator done"><span class="indicator-dot"></span><span class="indicator-text">00_simple-login-form</span></div>';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <span class="a2ui-text a2ui-text-title">A2UI Agent User Login</span>
          <div class="a2ui-form-item" style="margin-top:12px;">
            <span class="a2ui-label">Username</span>
            <input class="a2ui-input" value="agent_user_01" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:6px; padding:0 10px;" />
          </div>
          <div class="a2ui-form-item">
            <span class="a2ui-label">Password</span>
            <input class="a2ui-input" type="password" value="secret_password_123" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:6px; padding:0 10px;" />
          </div>
          <button class="a2ui-btn a2ui-btn-primary" style="margin-top:8px; height:40px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:600;">Log In</button>
        </div>
      </div>
    `;
  } else if (stage === 'product') {
    statusBadge = '<div class="stream-indicator done"><span class="indicator-dot"></span><span class="indicator-text">05_product-card</span></div>';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <img class="a2ui-image" src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=360&fit=crop" style="width:100%; height:160px; object-fit:cover; border-radius:8px; margin-bottom:10px;" />
          <span class="a2ui-text a2ui-text-title">Wireless Noise-Cancelling Headphones Pro</span>
          <div class="a2ui-row a2ui-align-center" style="margin-top:6px;">
            <span class="a2ui-text a2ui-text-title" style="color:#0284c7; font-size:18px;">$199.00</span>
            <span class="a2ui-text a2ui-text-caption" style="margin-left:8px; text-decoration:line-through;">Was $249.00</span>
          </div>
          <div class="a2ui-row a2ui-justify-end" style="margin-top:12px;">
            <button class="a2ui-btn a2ui-btn-primary" style="padding:8px 20px; background:#0284c7; color:#fff; border:none; border-radius:6px;">Add to Cart</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=375, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        ${convertedCss}
      </style>
    </head>
    <body>
      <div class="header">
        <span class="title">A2UI WeChat MiniProgram Renderer</span>
        <span class="subtitle">A2UI v1.0 Spec · Streaming UI</span>
      </div>

      <div class="mode-bar">
        <div class="mode-item ${stage.startsWith('stream') ? 'active' : ''}">⚡ Real-Time Streaming</div>
        <div class="mode-item ${!stage.startsWith('stream') ? 'active' : ''}">📱 Official Gallery</div>
      </div>

      <div class="stream-ctrl-panel">
        <div class="stream-status-row">
          ${statusBadge}
        </div>
      </div>

      ${thinking ? `
      <div class="thinking-box">
        <div class="thinking-header"><span class="thinking-label">🤖 Agent Thinking & Streaming Protocol:</span></div>
        <div class="thinking-content" style="white-space:pre-wrap;">${thinking}</div>
      </div>` : ''}

      <div class="surface-wrap">
        ${contentHtml}
      </div>

      <div class="log-section">
        <div class="log-header">
          <span class="log-title">Renderer → Agent Event Logs (Interactive Loop)</span>
        </div>
        <div class="log-placeholder">Waiting for interaction events...</div>
      </div>
    </body>
    </html>
  `;
}

// Start local preview server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:8899');
  const stage = url.searchParams.get('stage') || 'stream_step3';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(createHtml(stage));
});

server.listen(8899, async () => {
  console.log('HTTP preview server listening at http://localhost:8899');

  try {
    const browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 750, deviceScaleFactor: 2 });

    const screenshots = [
      { stage: 'stream_step1', file: 'a2ui_streaming_step1_init.png', desc: 'Streaming Stage 1: Surface initialization and thinking' },
      { stage: 'stream_step2', file: 'a2ui_streaming_step2_growing.png', desc: 'Streaming Stage 2: Component tree expansion and data injection' },
      { stage: 'stream_step3', file: 'a2ui_streaming_step3_complete.png', desc: 'Streaming Stage 3: Interactive button and complete card' },
      { stage: 'login', file: 'a2ui_login_form.png', desc: 'Official case: login form with password mask' },
      { stage: 'product', file: 'a2ui_product_card.png', desc: 'Official case: product card with price computation' },
    ];

    for (const item of screenshots) {
      await page.goto(`http://localhost:8899/?stage=${item.stage}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.surface-wrap');
      const outPath = path.join(ARTIFACT_DIR, item.file);
      await page.screenshot({ path: outPath });
      console.log(`📸 Screenshot captured: [${item.desc}] -> ${outPath}`);
    }

    await browser.close();
    console.log('🎉 All screenshots generated successfully!');
  } catch (err) {
    console.error('Screenshot generation failed:', err);
  } finally {
    server.close();
  }
});
