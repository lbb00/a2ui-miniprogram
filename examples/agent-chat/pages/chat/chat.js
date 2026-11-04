const { AgentLoop } = require('../../core/agent-loop');

Page({
  data: {
    messages: [],
    inputText: '',
    agentState: 'idle',
    agentStateText: '在线',
    scrollToView: 'scroll_bottom',
    scrollTop: 0,
    scrollWithAnimation: true,
    keyboardHeight: 0,
    keyboardDuration: 0.25,

    quickPrompts: [
      { icon: '✈️', label: '北京飞上海', text: '查一下明天北京飞上海的航班' },
      { icon: '🎧', label: '索尼降噪耳机', text: '我想买索尼降噪耳机并申领新人特惠' },
      { icon: '📋', label: '身份核验表单', text: '打开登录表单' },
    ],
  },

  onLoad() {
    this.initAgent();
  },

  onUnload() {
    if (this._multiScrollTimers) {
      this._multiScrollTimers.forEach((t) => clearTimeout(t));
      this._multiScrollTimers = null;
    }
  },

  initAgent() {
    this.agent = new AgentLoop({
      onMessageUpdate: (messages) => {
        this.setData({ messages }, () => {
          this.scheduleAutoScroll();
        });
      },
      onStateChange: (state) => {
        let text = '在线';
        if (state === 'thinking') text = '思考中...';
        if (state === 'streaming') text = '生成中...';
        if (state === 'tool_executing') text = '渲染中...';

        this.setData({
          agentState: state,
          agentStateText: text,
        });

        if (state === 'idle' || state === 'tool_executing') {
          this.scheduleMultiTickScroll();
        }
      },
    });

    this.setData({
      messages: this.agent.getMessages(),
    }, () => {
      this.scrollToBottom(false);
    });
  },

  /**
   * 监听原生键盘高度变化
   * 同步更新输入框 margin-bottom 与动画时间，并平滑滚动聊天记录到底部
   */
  onKeyboardHeightChange(e) {
    const height = e.detail.height || 0;
    // 微信底层 duration 单位可能为 ms，转换为秒
    const rawDuration = e.detail.duration;
    const duration = rawDuration ? (rawDuration > 10 ? rawDuration / 1000 : rawDuration) : 0.25;

    this.setData({
      keyboardHeight: height,
      keyboardDuration: duration > 0 ? duration : 0.25,
    }, () => {
      this.scrollToBottom(true);
    });
  },

  /**
   * 输入框获得焦点
   */
  onInputFocus(e) {
    const height = e.detail.height || 0;
    if (height > 0 && height !== this.data.keyboardHeight) {
      this.setData({ keyboardHeight: height }, () => {
        this.scrollToBottom(true);
      });
    }
  },

  /**
   * 输入框失去焦点
   */
  onInputBlur() {
    this.setData({ keyboardHeight: 0 }, () => {
      this.scrollToBottom(true);
    });
  },

  /**
   * 监听 a2ui-surface 组件内部渲染就绪事件 (bind:rendered)
   * 当卡片 DOM 节点与样式在小程序底层展开时触发，校准滚动位置
   */
  onCardRendered() {
    this.scrollToBottom(true);
    this.scheduleMultiTickScroll();
  },

  /**
   * 流式生成与卡片渲染触底调度器
   * 包含限流平滑滚动与跨帧多阶梯校准，确保流式文字增长及 A2UI 卡片展开时 100% 紧贴底部
   */
  scheduleAutoScroll() {
    const isStreaming = this.data.agentState === 'streaming';

    // 如果处于文字流式吐字阶段，采用节流滚动避免频繁 SelectorQuery 阻塞原生渲染桥
    if (isStreaming) {
      const now = Date.now();
      if (!this._lastStreamScroll || now - this._lastStreamScroll > 60) {
        this._lastStreamScroll = now;
        this.scrollToBottom(false);
      }
      return;
    }

    // 非流式或卡片产生阶段：立即触底并安排多阶梯校验
    this.scrollToBottom(true);
    this.scheduleMultiTickScroll();
  },

  scheduleMultiTickScroll() {
    if (this._multiScrollTimers) {
      this._multiScrollTimers.forEach((t) => clearTimeout(t));
    }
    this._multiScrollTimers = [
      setTimeout(() => this.scrollToBottom(true), 30),
      setTimeout(() => this.scrollToBottom(true), 100),
      setTimeout(() => this.scrollToBottom(true), 250),
      setTimeout(() => this.scrollToBottom(true), 450),
    ];
  },

  /**
   * 统一平滑滚动到底部
   * 结合 scroll-into-view 与 scroll-top 双保险，确保每次都能触底
   */
  scrollToBottom(animated = true) {
    this.setData({
      scrollWithAnimation: animated,
      scrollToView: 'scroll_bottom',
    });

    const query = this.createSelectorQuery();
    query.select('.messages-list').boundingClientRect();
    query.exec((res) => {
      if (res && res[0]) {
        this.setData({
          scrollTop: res[0].height + 10000,
        });
      }
    });
  },

  onInputTyping(e) {
    this.setData({ inputText: e.detail.value });
  },

  onSend() {
    const text = this.data.inputText.trim();
    if (!text || this.data.agentState !== 'idle') return;

    this.setData({ inputText: '' });
    this.scrollToBottom(true);
    this.agent.sendMessage(text);
  },

  onChipTap(e) {
    const text = e.currentTarget.dataset.text;
    if (!text || this.data.agentState !== 'idle') return;

    this.setData({ inputText: '' });
    this.scrollToBottom(true);
    this.agent.sendMessage(text);
  },

  /**
   * 监听来自 a2ui-surface 组件的动作事件
   */
  onA2UIAction(e) {
    console.log('[Agent App] 捕获 a2ui-surface Action 事件:', e.detail);
    if (this.agent) {
      this.agent.handleA2UIAction(e.detail);
    }
  },

  /**
   * 监听来自 a2ui-surface 表单的双向输入
   */
  onA2UIInput(e) {
    if (this.agent) {
      this.agent.handleA2UIInput(e.detail);
    }
  },

  clearChat() {
    if (this.agent) {
      this.agent.clearHistory();
    }
  },
});
