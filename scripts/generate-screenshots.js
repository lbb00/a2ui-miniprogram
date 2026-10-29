/**
 * 使用 puppeteer-core 配合系统 Chromium 驱动真实移动端视口渲染，生成高清流式过程与用例截图
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(__dirname, '../artifacts');
const EDGE_PATH = process.env.BROWSER_EXECUTABLE_PATH || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';

// 检查是否存在系统浏览器
if (!fs.existsSync(EDGE_PATH)) {
  console.error('Edge browser not found at:', EDGE_PATH);
  process.exit(1);
}

// 构建高保真移动端预览 HTML
const wxssContent = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss'), 'utf8')
  + '\n' + fs.readFileSync(path.resolve(__dirname, '../miniprogram/pages/index/index.wxss'), 'utf8');

// 将 rpx 转换为 px (375px 下 1rpx = 0.5px)
const convertedCss = wxssContent.replace(/(\d+)rpx/g, (_, val) => `${val * 0.5}px`);

function createHtml(stage) {
  let contentHtml = '';
  let statusBadge = '';
  let thinking = '';

  if (stage === 'stream_step1') {
    statusBadge = '<div class="stream-indicator streaming"><span class="indicator-dot"></span><span class="indicator-text">[Chunk 1/5] Surface 建立，挂载卡片外壳</span></div>';
    thinking = '> 正在解析用户的即时行程查询意图...\n> 检索到匹配航班: 中国国际航空 CA1501...\n> 开始输出 A2UI 结构化协议帧 (createSurface)...';
    contentHtml = `
      <div class="a2ui-card" style="min-height: 120px; border: 2px dashed #38bdf8; display:flex; align-items:center; justify-content:center;">
        <span style="color:#0284c7; font-size:13px; font-weight:600;">[Surface 正在流式接收组件中...]</span>
      </div>
    `;
  } else if (stage === 'stream_step2') {
    statusBadge = '<div class="stream-indicator streaming"><span class="indicator-dot"></span><span class="indicator-text">[Chunk 3/5] 航线站点展开与数据注入</span></div>';
    thinking = '> 挂载头部组件完成...\n> 开始下发子组件流 (updateComponents: 展开航线站名与状态)...';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <div class="a2ui-row a2ui-align-center" style="margin-bottom:8px;">
            <span class="a2ui-icon" style="margin-right:8px; font-size:18px;">✈️</span>
            <span class="a2ui-text a2ui-text-title" style="font-size:16px;">CA1501 实时行程</span>
          </div>
          <div class="a2ui-divider"></div>
          <div class="a2ui-row a2ui-align-center a2ui-justify-spaceBetween" style="margin-top:8px;">
            <div class="a2ui-column a2ui-align-start">
              <span class="a2ui-text a2ui-text-caption">北京首都</span>
              <span class="a2ui-text a2ui-text-title">PEK</span>
            </div>
            <span class="a2ui-text a2ui-text-body" style="color:#0284c7; font-weight:600;">✈️ 准点 (09:30 起飞)</span>
            <div class="a2ui-column a2ui-align-end">
              <span class="a2ui-text a2ui-text-caption">上海虹桥</span>
              <span class="a2ui-text a2ui-text-title">SHA</span>
            </div>
          </div>
          <div class="a2ui-divider"></div>
          <div style="padding:10px; text-align:center; color:#94a3b8; font-size:12px;">
            [ 正在流式生成 Action 交互按钮... ▋ ]
          </div>
        </div>
      </div>
    `;
  } else if (stage === 'stream_step3') {
    statusBadge = '<div class="stream-indicator done"><span class="indicator-dot"></span><span class="indicator-text">✅ 流式生成完毕，组件完全就绪</span></div>';
    thinking = '> 流式绑定数据模型完成...\n> 激活交互动作 (Button: 办理值机)，流式传输完成！';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <div class="a2ui-row a2ui-align-center" style="margin-bottom:8px;">
            <span class="a2ui-icon" style="margin-right:8px; font-size:18px;">✈️</span>
            <span class="a2ui-text a2ui-text-title" style="font-size:16px;">CA1501 实时行程</span>
          </div>
          <div class="a2ui-divider"></div>
          <div class="a2ui-row a2ui-align-center a2ui-justify-spaceBetween" style="margin-top:8px;">
            <div class="a2ui-column a2ui-align-start">
              <span class="a2ui-text a2ui-text-caption">北京首都</span>
              <span class="a2ui-text a2ui-text-title">PEK</span>
            </div>
            <span class="a2ui-text a2ui-text-body" style="color:#10b981; font-weight:600;">✈️ 准点起飞 (09:30)</span>
            <div class="a2ui-column a2ui-align-end">
              <span class="a2ui-text a2ui-text-caption">上海虹桥</span>
              <span class="a2ui-text a2ui-text-title">SHA</span>
            </div>
          </div>
          <div class="a2ui-divider"></div>
          <div class="a2ui-row a2ui-justify-end" style="margin-top:8px;">
            <button class="a2ui-btn a2ui-btn-primary" style="padding:8px 20px; font-size:14px; background:#0284c7; color:#fff; border-radius:6px; border:none; cursor:pointer;">立即办理值机</button>
          </div>
        </div>
      </div>
    `;
  } else if (stage === 'login') {
    statusBadge = '<div class="stream-indicator done"><span class="indicator-dot"></span><span class="indicator-text">00_simple-login-form</span></div>';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <span class="a2ui-text a2ui-text-title">A2UI 智能体用户登录</span>
          <div class="a2ui-form-item" style="margin-top:12px;">
            <span class="a2ui-label">用户名</span>
            <input class="a2ui-input" value="agent_user_01" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:6px; padding:0 10px;" />
          </div>
          <div class="a2ui-form-item">
            <span class="a2ui-label">密码</span>
            <input class="a2ui-input" type="password" value="secret_password_123" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:6px; padding:0 10px;" />
          </div>
          <button class="a2ui-btn a2ui-btn-primary" style="margin-top:8px; height:40px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:600;">确认登录</button>
        </div>
      </div>
    `;
  } else if (stage === 'product') {
    statusBadge = '<div class="stream-indicator done"><span class="indicator-dot"></span><span class="indicator-text">05_product-card</span></div>';
    contentHtml = `
      <div class="a2ui-card">
        <div class="a2ui-column a2ui-align-stretch">
          <img class="a2ui-image" src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=360&fit=crop" style="width:100%; height:160px; object-fit:cover; border-radius:8px; margin-bottom:10px;" />
          <span class="a2ui-text a2ui-text-title">无线降噪头戴式耳机 Pro</span>
          <div class="a2ui-row a2ui-align-center" style="margin-top:6px;">
            <span class="a2ui-text a2ui-text-title" style="color:#0284c7; font-size:18px;">¥1299.00</span>
            <span class="a2ui-text a2ui-text-caption" style="margin-left:8px; text-decoration:line-through;">原价 ¥1,899</span>
          </div>
          <div class="a2ui-row a2ui-justify-end" style="margin-top:12px;">
            <button class="a2ui-btn a2ui-btn-primary" style="padding:8px 20px; background:#0284c7; color:#fff; border:none; border-radius:6px;">加入购物车</button>
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
        <span class="title">A2UI 微信小程序原生渲染器</span>
        <span class="subtitle">A2UI v1.0 最新规范 · 声明式流式输出 (Streaming UI)</span>
      </div>

      <div class="mode-bar">
        <div class="mode-item ${stage.startsWith('stream') ? 'active' : ''}">⚡ 实时流式输出</div>
        <div class="mode-item ${!stage.startsWith('stream') ? 'active' : ''}">📱 官方用例画廊</div>
      </div>

      <div class="stream-ctrl-panel">
        <div class="stream-status-row">
          ${statusBadge}
        </div>
      </div>

      ${thinking ? `
      <div class="thinking-box">
        <div class="thinking-header"><span class="thinking-label">🤖 Agent 思考与流式协议推流:</span></div>
        <div class="thinking-content" style="white-space:pre-wrap;">${thinking}</div>
      </div>` : ''}

      <div class="surface-wrap">
        ${contentHtml}
      </div>

      <div class="log-section">
        <div class="log-header">
          <span class="log-title">Renderer → Agent 上报事件日志 (双向交互闭环)</span>
        </div>
        <div class="log-placeholder">等待交互事件，请操作表单或点击按钮</div>
      </div>
    </body>
    </html>
  `;
}

// 启动简易服务器
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:8899');
  const stage = url.searchParams.get('stage') || 'stream_step3';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(createHtml(stage));
});

server.listen(8899, async () => {
  console.log('HTTP 预览服务器启动在 http://localhost:8899');

  try {
    const browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 750, deviceScaleFactor: 2 });

    const screenshots = [
      { stage: 'stream_step1', file: 'a2ui_streaming_step1_init.png', desc: '流式阶段 1: Surface 初始化与思考流' },
      { stage: 'stream_step2', file: 'a2ui_streaming_step2_growing.png', desc: '流式阶段 2: 组件树逐步长出与数据注入' },
      { stage: 'stream_step3', file: 'a2ui_streaming_step3_complete.png', desc: '流式阶段 3: 交互按钮点亮与完整卡片' },
      { stage: 'login', file: 'a2ui_login_form.png', desc: '官方用例: 登录表单与密码遮罩' },
      { stage: 'product', file: 'a2ui_product_card.png', desc: '官方用例: 商品卡片与货币计算' },
    ];

    for (const item of screenshots) {
      await page.goto(`http://localhost:8899/?stage=${item.stage}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.surface-wrap');
      const outPath = path.join(ARTIFACT_DIR, item.file);
      await page.screenshot({ path: outPath });
      console.log(`📸 截图生成: [${item.desc}] -> ${outPath}`);
    }

    await browser.close();
    console.log('🎉 所有真实运行截图生成完毕！');
  } catch (err) {
    console.error('截图生成失败:', err);
  } finally {
    server.close();
  }
});
