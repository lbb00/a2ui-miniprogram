/**
 * AgentLoop - Independent Agent Engine for agent-miniprogram
 * Powered by external module: a2ui-miniprogram
 * Native DeepSeek Function Calling & A2UI Protocol Injection
 */

let A2UIEngine;
try {
  ({ A2UIEngine } = require('a2ui-miniprogram'));
} catch (_) {
  try {
    ({ A2UIEngine } = require('../miniprogram_npm/a2ui-miniprogram/index.js'));
  } catch (__) {
    ({ A2UIEngine } = require('../../index.js'));
  }
}

const https = typeof window === 'undefined' && typeof wx === 'undefined' ? require('https') : null;

// DeepSeek 支持的标准 Function Calling 工具声明
const A2UI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'render_flight_card',
      description: '在微信小程序中渲染 A2UI 航班动态与在线值机选座卡片',
      parameters: {
        type: 'object',
        properties: {
          flightNumber: { type: 'string', description: '航班号，如 CA1501' },
          origin: { type: 'string', description: '出发机场，如 北京首都 (PEK)' },
          destination: { type: 'string', description: '到达机场，如 上海虹桥 (SHA)' },
          departureTime: { type: 'string', description: '起飞时间，如 08:30' },
          arrivalTime: { type: 'string', description: '到达时间，如 10:45' },
          price: { type: 'number', description: '当前票价' },
        },
        required: ['flightNumber', 'origin', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_product_card',
      description: '当用户咨询、搜索或想要购买商品、降噪耳机或申领特惠时，必须调用此工具在微信小程序中渲染 A2UI 电商商品详情卡片与实时优惠券',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '商品名称，如 Sony WH-1000XM5 无线降噪耳机' },
          price: { type: 'number', description: '原价或现价' },
          discountPrice: { type: 'number', description: '券后预估到手价' },
        },
        required: ['title', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_form_card',
      description: '当用户要求打开、展示、核验或填写登录/身份表单时，必须调用此工具在微信小程序中渲染 A2UI 原生支持双向数据绑定的表单卡片',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '表单标题，如 身份核验登录表单' },
        },
        required: ['title'],
      },
    },
  },
];

class AgentLoop {
  constructor(options = {}) {
    this.engine = options.engine || new A2UIEngine();
    const defaultApiKey =
      (typeof wx !== 'undefined' && wx.getStorageSync && wx.getStorageSync('DEEPSEEK_API_KEY')) ||
      (typeof process !== 'undefined' && process.env && process.env.DEEPSEEK_API_KEY) ||
      '';

    this.config = Object.assign(
      {
        mode: defaultApiKey ? 'api' : 'mock',
        apiUrl: 'https://api.deepseek.com/chat/completions',
        apiKey: defaultApiKey,
        model: 'deepseek-chat',
        timeout: 10000,
      },
      options.config || {}
    );

    this.onMessageUpdate = options.onMessageUpdate || (() => {});
    this.onStateChange = options.onStateChange || (() => {});

    this.state = 'idle'; // 'idle' | 'thinking' | 'streaming' | 'tool_executing'
    this.messages = [];
    this.generationId = 0;
    this._activeRequest = null;

    this.initWelcomeMessage();
  }

  setState(newState) {
    this.state = newState;
    this.onStateChange(this.state);
  }

  initWelcomeMessage() {
    this.messages = [
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: '你好，有什么可以帮您？',
        timestamp: Date.now(),
      },
    ];
    this.notifyUpdate();
  }

  getMessages() {
    return this.messages;
  }

  clearHistory() {
    this.generationId++;
    if (this._activeRequest) {
      try {
        if (typeof this._activeRequest.abort === 'function') {
          this._activeRequest.abort();
        }
      } catch (_) {}
      this._activeRequest = null;
    }
    for (const m of this.messages) {
      if (m.isStreaming) {
        m.isStreaming = false;
        m.thinking = '';
      }
    }
    if (this.engine && typeof this.engine.clear === 'function') {
      this.engine.clear();
    }
    this.setState('idle');
    this.initWelcomeMessage();
  }

  notifyUpdate() {
    this.onMessageUpdate([...this.messages]);
  }

  async sendMessage(userText) {
    if (!userText || !userText.trim() || this.state !== 'idle') return;

    const currentGen = ++this.generationId;
    const trimmed = userText.trim();
    const userMsgId = 'msg_user_' + Date.now();
    this.messages.push({
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    });
    this.notifyUpdate();

    if (this.config.mode === 'api' && this.config.apiKey) {
      await this.runDeepSeekLoop(trimmed, currentGen);
    } else {
      await this.runMockLoop(trimmed, currentGen);
    }
  }

  /**
   * DeepSeek 真实 API 调用与 Function Calling 工具驱动
   */
  async runDeepSeekLoop(userText, currentGen) {
    const gen = currentGen !== undefined ? currentGen : this.generationId;
    this.setState('thinking');
    const agentMsgId = 'msg_agent_' + Date.now();
    const agentMsg = {
      id: agentMsgId,
      role: 'assistant',
      content: '',
      thinking: '思考中...',
      timestamp: Date.now(),
      isStreaming: true,
    };
    this.messages.push(agentMsg);
    this.notifyUpdate();

    const systemPrompt = `你是微信小程序智能助手。当用户查询航班、商品推荐、购买降噪耳机、表单或核验时，必须调用对应的工具函数渲染原生 A2UI 卡片。文本回复需极简自然（一句话以内），由卡片内容直接呈现详情。`;

    const chatHistory = this.messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant' || m.role === 'action') && m.content)
      .map((m) => {
        if (m.role === 'action') {
          return { role: 'user', content: `[用户在小程序卡片上触发了操作]: ${m.content}` };
        }
        return { role: m.role, content: m.content };
      });

    const payload = {
      model: this.config.model,
      stream: false, // 使用结构化 Tool Call
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
      ],
      tools: A2UI_TOOLS,
      tool_choice: 'auto',
    };

    try {
      let responseData = null;
      const timeoutMs = this.config.timeout || 10000;

      if (typeof wx !== 'undefined' && wx.request) {
        // 微信小程序环境：通过 wx.request 发起调用
        responseData = await new Promise((resolve, reject) => {
          let timer = null;
          const reqTask = wx.request({
            url: this.config.apiUrl,
            method: 'POST',
            timeout: timeoutMs,
            header: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.config.apiKey}`,
            },
            data: payload,
            success: (res) => {
              if (timer) clearTimeout(timer);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(res.data);
              } else {
                reject(new Error(`DeepSeek API 状态码 ${res.statusCode}: ${JSON.stringify(res.data)}`));
              }
            },
            fail: (err) => {
              if (timer) clearTimeout(timer);
              reject(err);
            },
          });
          timer = setTimeout(() => {
            try {
              if (typeof reqTask.abort === 'function') reqTask.abort();
            } catch (_) {}
            reject(new Error(`DeepSeek API 请求超时 (${timeoutMs}ms)`));
          }, timeoutMs);
          this._activeRequest = reqTask;
        });
      } else if (https) {
        // Node.js 自动化测试与 CI 环境
        responseData = await new Promise((resolve, reject) => {
          let timer = null;
          const urlObj = new URL(this.config.apiUrl);
          const reqModule = urlObj.protocol === 'http:' ? require('http') : https;
          const req = reqModule.request(
            {
              hostname: urlObj.hostname,
              port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
              path: urlObj.pathname,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
              },
              timeout: timeoutMs,
            },
            (res) => {
              let body = '';
              res.on('data', (d) => (body += d));
              res.on('end', () => {
                if (timer) clearTimeout(timer);
                try {
                  resolve(JSON.parse(body));
                } catch (_e) {
                  reject(new Error(`JSON parse error: ${body}`));
                }
              });
            }
          );
          req.on('timeout', () => {
            if (timer) clearTimeout(timer);
            req.destroy(new Error(`DeepSeek API 请求超时 (${timeoutMs}ms)`));
          });
          req.on('error', (err) => {
            if (timer) clearTimeout(timer);
            reject(err);
          });
          timer = setTimeout(() => {
            try {
              req.destroy(new Error(`DeepSeek API 请求超时 (${timeoutMs}ms)`));
            } catch (_) {}
            reject(new Error(`DeepSeek API 请求超时 (${timeoutMs}ms)`));
          }, timeoutMs);
          req.write(JSON.stringify(payload));
          req.end();
          this._activeRequest = req;
        });
      }

      this._activeRequest = null;
      if (gen !== this.generationId) return;

      const choice = responseData?.choices?.[0];
      const message = choice?.message;

      if (!message) {
        throw new Error('DeepSeek 未返回有效 message: ' + JSON.stringify(responseData));
      }

      this.setState('streaming');
      const text = message.content || '已为您查询并生成实时交互卡片：';
      await this.streamTextToMessage(agentMsg, text, gen);
      if (gen !== this.generationId) return;

      // 处理 Tool Calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (let i = 0; i < message.tool_calls.length; i++) {
          if (gen !== this.generationId) return;
          const toolCall = message.tool_calls[i];
          const toolName = toolCall.function?.name;
          let args = {};
          try {
            args = JSON.parse(toolCall.function?.arguments || '{}');
          } catch (_) {}

          this.setState('tool_executing');

          // 为每个独立的工具调用保留/追加独立的 assistant 消息卡片，避免多卡片互相覆盖
          let targetMsg = agentMsg;
          if (i > 0 || targetMsg.surfaceId) {
            targetMsg = {
              id: 'msg_agent_' + Date.now() + '_' + i,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
            };
            this.messages.push(targetMsg);
          }

          targetMsg.thinking = `🛠️ 触发工具调用: ${toolName}(${JSON.stringify(args)})`;
          this.notifyUpdate();

          // 执行 A2UI 工具调用并即时通知渲染树更新
          this.executeA2UITool(targetMsg, toolName, args);
          this.notifyUpdate();
        }

        agentMsg.thinking = '✨ DeepSeek Tool Call 与 a2ui-miniprogram 渲染完成';
      }
    } catch (e) {
      this._activeRequest = null;
      if (gen !== this.generationId) return;
      console.warn('DeepSeek API 调用失败，自动降级至内置仿真驱动:', e.message);
      // Finalize the API message before falling back to mock mode (Codex Comment 7)
      agentMsg.isStreaming = false;
      agentMsg.thinking = '';
      agentMsg.content = `(DeepSeek API: ${e.message}，已自动平滑降级至智能仿真模式)\n\n`;
      this.notifyUpdate();
      await this.runMockLoop(userText, gen);
      return;
    }

    if (gen !== this.generationId) return;
    agentMsg.isStreaming = false;
    this.setState('idle');
    this.notifyUpdate();
  }

  /**
   * 执行 Tool Call 生成 A2UI 规范并调用 a2ui-miniprogram 编译为渲染树
   */
  executeA2UITool(msg, toolName, args) {
    const surfaceId = `surface_${toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let a2uiMessages = [];

    if (toolName === 'render_flight_card') {
      const flightNumber = args.flightNumber || 'CA1501';
      const origin = args.origin || '北京首都 (PEK)';
      const dest = args.destination || '上海虹桥 (SHA)';
      const depTime = args.departureTime || '08:30';
      const arrTime = args.arrivalTime || '10:45';
      const price = args.price || 1280;

      a2uiMessages = [
        {
          version: 'v1.0',
          createSurface: { surfaceId },
        },
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId,
            components: [
              { id: 'root', component: 'Card', children: ['main_col'] },
              { id: 'main_col', component: 'Column', children: ['header_row', 'route_row', 'divider', 'times_row', 'btn_book'] },
              { id: 'header_row', component: 'Row', justify: 'spaceBetween', children: ['flight_no', 'flight_price'] },
              { id: 'flight_no', component: 'Text', text: `✈️ ${flightNumber}`, variant: 'title' },
              { id: 'flight_price', component: 'Text', text: `¥${price}`, variant: 'title' },
              { id: 'route_row', component: 'Row', justify: 'spaceBetween', children: ['origin', 'arrow', 'dest'] },
              { id: 'origin', component: 'Text', text: origin, variant: 'body' },
              { id: 'arrow', component: 'Text', text: '➔' },
              { id: 'dest', component: 'Text', text: dest, variant: 'body' },
              { id: 'divider', component: 'Divider' },
              { id: 'times_row', component: 'Row', justify: 'spaceBetween', children: ['dep_col', 'status_col', 'arr_col'] },
              { id: 'dep_col', component: 'Column', children: ['dep_label', 'dep_time'] },
              { id: 'dep_label', component: 'Text', text: '起飞', variant: 'caption' },
              { id: 'dep_time', component: 'Text', text: depTime, variant: 'title' },
              { id: 'status_col', component: 'Column', align: 'center', children: ['status_label', 'status_val'] },
              { id: 'status_label', component: 'Text', text: '状态', variant: 'caption' },
              { id: 'status_val', component: 'Text', text: '准点率 98%', variant: 'body' },
              { id: 'arr_col', component: 'Column', children: ['arr_label', 'arr_time'] },
              { id: 'arr_label', component: 'Text', text: '到达', variant: 'caption' },
              { id: 'arr_time', component: 'Text', text: arrTime, variant: 'title' },
              {
                id: 'btn_book',
                component: 'Button',
                text: '✈️ 立即在线值机选座',
                variant: 'primary',
                action: {
                  event: {
                    name: 'book_flight',
                    context: { flightNumber, origin, destination: dest },
                  },
                },
              },
            ],
          },
        },
      ];
    } else if (toolName === 'render_product_card') {
      const title = args.title || 'Sony WH-1000XM5 无线降噪耳机';
      const price = args.price !== undefined ? args.price : 2499;
      const discount = args.discountPrice !== undefined ? args.discountPrice : price;

      a2uiMessages = [
        { version: 'v1.0', createSurface: { surfaceId } },
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId,
            components: [
              { id: 'root', component: 'Card', children: ['p_col'] },
              { id: 'p_col', component: 'Column', children: ['p_title', 'p_row', 'p_btn'] },
              { id: 'p_title', component: 'Text', text: title, variant: 'title' },
              { id: 'p_row', component: 'Row', justify: 'spaceBetween', children: ['p_label', 'p_price'] },
              { id: 'p_label', component: 'Text', text: args.discountPrice !== undefined ? '限时特惠价' : '商品售价' },
              { id: 'p_price', component: 'Text', text: `¥${discount}`, variant: 'title' },
              {
                id: 'p_btn',
                component: 'Button',
                text: '🛒 立即抢购加入购物车',
                variant: 'primary',
                action: {
                  event: {
                    name: 'addToCart',
                    context: { title, price: discount },
                  },
                },
              },
            ],
          },
        },
      ];
    } else if (toolName === 'render_form_card') {
      const title = args.title || '用户登录表单';
      a2uiMessages = [
        { version: 'v1.0', createSurface: { surfaceId } },
        {
          version: 'v1.0',
          updateDataModel: {
            surfaceId,
            value: { username: '', password: '' },
          },
        },
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId,
            components: [
              { id: 'root', component: 'Card', children: ['f_col'] },
              { id: 'f_col', component: 'Column', children: ['f_title', 'u_in', 'p_in', 'f_btn'] },
              { id: 'f_title', component: 'Text', text: title, variant: 'title' },
              { id: 'u_in', component: 'TextField', label: '账号/邮箱', value: { '@path': '/username' } },
              { id: 'p_in', component: 'TextField', label: '密码', variant: 'obscured', value: { '@path': '/password' } },
              {
                id: 'f_btn',
                component: 'Button',
                text: '确认提交',
                variant: 'primary',
                action: {
                  event: {
                    name: 'submitLogin',
                    context: { username: { '@path': '/username' } },
                  },
                },
              },
            ],
          },
        },
      ];
    }

    if (a2uiMessages.length > 0) {
      // 核心：调用 a2ui-miniprogram 模块推导渲染树
      this.engine.process(a2uiMessages);
      const renderTree = this.engine.getRenderTree(surfaceId);
      if (renderTree) {
        msg.surfaceId = surfaceId;
        msg.renderTree = renderTree;
        msg.a2uiMessages = a2uiMessages;
        if (!msg.cards) {
          msg.cards = [];
        }
        msg.cards.push({ surfaceId, renderTree });
      }
    }
  }

  async runMockLoop(userText, currentGen) {
    const gen = currentGen !== undefined ? currentGen : this.generationId;
    this.setState('thinking');
    const agentMsgId = 'msg_agent_' + Date.now();
    const agentMsg = {
      id: agentMsgId,
      role: 'assistant',
      content: '',
      thinking: '正在匹配意图并生成 A2UI 渲染卡片...',
      timestamp: Date.now(),
      isStreaming: true,
    };
    this.messages.push(agentMsg);
    this.notifyUpdate();

    await this.sleep(100);
    if (gen !== this.generationId) return;
    this.setState('streaming');

    if (/耳机|商品|购买|特惠/i.test(userText)) {
      await this.streamTextToMessage(agentMsg, '为您推荐索尼旗舰降噪耳机，已为您匹配专属新人优惠券：', gen);
      if (gen !== this.generationId) return;
      this.executeA2UITool(agentMsg, 'render_product_card', {
        title: 'Sony WH-1000XM5 无线降噪耳机',
        price: 2899,
        discountPrice: 2399,
      });
    } else if (/表单|登录|核验/i.test(userText)) {
      await this.streamTextToMessage(agentMsg, '请在下方表单中完成身份核验与安全登录：', gen);
      if (gen !== this.generationId) return;
      this.executeA2UITool(agentMsg, 'render_form_card', {
        title: '身份核验登录表单',
      });
    } else {
      await this.streamTextToMessage(agentMsg, '为您查询到国航 CA1501 实时动态，支持在线选座：', gen);
      if (gen !== this.generationId) return;
      this.executeA2UITool(agentMsg, 'render_flight_card', {
        flightNumber: 'CA1501',
        origin: '北京首都 (PEK)',
        destination: '上海虹桥 (SHA)',
        departureTime: '08:30',
        arrivalTime: '10:45',
        price: 1280,
      });
    }

    if (gen !== this.generationId) return;
    agentMsg.isStreaming = false;
    this.setState('idle');
    this.notifyUpdate();
  }

  async handleA2UIAction(detail) {
    if (!detail || this.state !== 'idle') return;
    const currentGen = ++this.generationId;
    const { surfaceId, componentId: _componentId, action, eventMessage } = detail;
    const eventName =
      detail.actionName ||
      detail.eventName ||
      eventMessage?.event?.name ||
      eventMessage?.action?.name ||
      action?.name ||
      action?.event?.name ||
      'action';

    const context =
      detail.params ||
      eventMessage?.event?.context ||
      eventMessage?.action?.context ||
      action?.context ||
      action?.event?.context ||
      {};

    let actionDesc = eventName;
    if (eventName === 'book_flight') actionDesc = `已选座值机 (航班 ${context.flightNumber || 'CA1501'})`;
    if (eventName === 'claimCoupon') actionDesc = `已领取 ¥${context.couponAmount || 200} 优惠券`;
    if (eventName === 'addToCart') actionDesc = `已加购 ${context.title || '商品'}`;
    if (eventName === 'submitLogin') actionDesc = `已提交身份核验`;

    this.messages.push({
      id: 'msg_act_' + Date.now(),
      role: 'action',
      content: actionDesc,
      eventName,
      context,
      surfaceId,
      timestamp: Date.now(),
    });
    this.notifyUpdate();

    this.setState('thinking');
    await this.sleep(300);
    if (currentGen !== this.generationId) return;

    const replyMsg = {
      id: 'msg_agent_' + Date.now(),
      role: 'assistant',
      content: '',
      thinking: '处理中...',
      timestamp: Date.now(),
      isStreaming: true,
    };
    this.messages.push(replyMsg);
    this.notifyUpdate();

    this.setState('streaming');
    let replyText = '';
    if (eventName === 'book_flight') {
      replyText = `值机成功，座位已锁定 **12A**。登机牌已同步至微信卡包。`;
    } else if (eventName === 'claimCoupon') {
      replyText = `优惠券领取成功，下单立减 ¥${context.couponAmount || 200}。`;
    } else if (eventName === 'addToCart') {
      replyText = `商品已加入购物车，可在购物车中结算。`;
    } else if (eventName === 'submitLogin') {
      replyText = `核验通过，欢迎回来！`;
    } else {
      replyText = `操作已完成。`;
    }

    await this.streamTextToMessage(replyMsg, replyText, currentGen);
    if (currentGen !== this.generationId) return;
    replyMsg.isStreaming = false;
    this.setState('idle');
    this.notifyUpdate();
  }

  handleA2UIInput(detail) {
    if (!detail) return;
    const { surfaceId, path, value } = detail;
    if (!surfaceId || !path) return;

    this.engine.handleInputChange(surfaceId, path, value);
    for (const msg of this.messages) {
      if (msg.surfaceId === surfaceId) {
        msg.renderTree = this.engine.getRenderTree(surfaceId);
      }
      if (msg.cards) {
        for (const card of msg.cards) {
          if (card.surfaceId === surfaceId) {
            card.renderTree = this.engine.getRenderTree(surfaceId);
          }
        }
      }
    }
    this.notifyUpdate();
  }

  async streamTextToMessage(msg, fullText, genId) {
    const chunkSize = 3;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      if (genId !== undefined && genId !== this.generationId) return;
      msg.content += fullText.slice(i, i + chunkSize);
      this.notifyUpdate();
      await this.sleep(20);
    }
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = {
  AgentLoop,
};
