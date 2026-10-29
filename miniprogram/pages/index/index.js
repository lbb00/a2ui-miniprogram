const { A2UIEngine } = require('../../core/engine');
const ALL_CASES = require('../../fixtures/official-all-cases');

const MAX_LOG_LINES = 200;
const MAX_EVENT_LOGS = 50;

function appendCircularLog(currentLog, newLine) {
  const combined = (currentLog || '') + newLine;
  const lines = combined.split('\n');
  if (lines.length > MAX_LOG_LINES) {
    return lines.slice(lines.length - MAX_LOG_LINES).join('\n');
  }
  return combined;
}

Page({
  data: {
    allCases: ALL_CASES,
    caseTitles: [],
    selectedCaseIndex: 0,
    currentCase: null,
    currentSurfaceId: '',

    // 渲染树与节点
    renderTree: null,
    nodeCount: 0,
    emptyHint: '',

    // 流式状态
    isStreaming: false,
    currentMessageIndex: 0,
    currentTotalMessages: 0,
    streamProgressPercent: 0,
    streamSummaryText: '',
    streamLog: '',

    // 交互与调试面板
    showDebugDrawer: false,
    activeDebugTab: 'stream',
    eventLogs: [],
  },

  onLoad() {
    // 格式化全部用例
    const caseTitles = ALL_CASES.map((item, idx) => {
      const num = (idx + 1).toString().padStart(2, '0');
      return `[${num}] ${item.name} (${item.file})`;
    });

    let defaultIndex = ALL_CASES.findIndex((c) => c.file === '00_incremental.json');
    if (defaultIndex === -1) defaultIndex = 0;

    this.setData({
      caseTitles,
    });

    this.switchCase(defaultIndex, true);
  },

  onReady() {
    // 页面初次渲染完成后，安全获取 surface 组件实例并注入引擎 (确保首屏不白屏)
    const surfaceComp = typeof this.selectComponent === 'function' ? this.selectComponent('#main-surface') : null;
    if (surfaceComp && this.engine) {
      if (typeof surfaceComp.setEngine === 'function') {
        surfaceComp.setEngine(this.engine);
      }
    }
  },

  countNodes(node) {
    if (!node) return 0;
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  },

  findSurfaceIdFromMessages(messages) {
    if (!Array.isArray(messages)) return '';
    for (const msg of messages) {
      if (msg.createSurface?.surfaceId) return msg.createSurface.surfaceId;
      if (msg.updateComponents?.surfaceId) return msg.updateComponents.surfaceId;
      if (msg.updateDataModel?.surfaceId) return msg.updateDataModel.surfaceId;
    }
    return '';
  },

  describeMessage(msg) {
    if (!msg) return { desc: '', hint: '' };
    if (msg.createSurface) {
      const sId = msg.createSurface.surfaceId;
      return {
        desc: `createSurface [${sId}]`,
        hint: `画布 [${sId}] 初始化`,
      };
    }
    if (msg.updateDataModel) {
      return {
        desc: `updateDataModel`,
        hint: `数据模型注入`,
      };
    }
    if (msg.updateComponents) {
      const count = msg.updateComponents.components ? msg.updateComponents.components.length : 0;
      return {
        desc: `updateComponents (${count})`,
        hint: `组件装配 (${count})`,
      };
    }
    if (msg.deleteSurface) {
      const sId = msg.deleteSurface.surfaceId;
      return {
        desc: `deleteSurface [${sId}]`,
        hint: `画布销毁`,
      };
    }
    return { desc: 'message', hint: '' };
  },

  setupEngineSubscription() {
    if (this.unsubEngine) {
      this.unsubEngine();
      this.unsubEngine = null;
    }
    this.unsubEngine = this.engine.subscribe((surfaceId, tree) => {
      if (surfaceId === this.data.currentSurfaceId) {
        this.syncRenderState(tree);
      }
    });
  },

  syncRenderState(tree) {
    const count = this.countNodes(tree);
    const total = this.data.currentTotalMessages;
    const currentIndex = this.data.currentMessageIndex;
    const percent = total > 0 ? Math.round((currentIndex / total) * 100) : 100;
    const lastMsg = (currentIndex > 0 && this.data.currentCase?.messages)
      ? this.data.currentCase.messages[currentIndex - 1]
      : null;
    const { hint } = this.describeMessage(lastMsg);

    let streamSummaryText = '';
    let emptyHint = '';

    if (!tree || count === 0) {
      if (currentIndex === 0) {
        emptyHint = '';
        streamSummaryText = `0/${total} 帧`;
      } else if (currentIndex < total) {
        emptyHint = `第 ${currentIndex}/${total} 帧 · ${hint}`;
        streamSummaryText = `第 ${currentIndex}/${total} 帧 · ${hint}`;
      } else {
        emptyHint = '';
        streamSummaryText = `${total}/${total} 帧`;
      }
    } else {
      emptyHint = '';
      if (this.data.isStreaming) {
        streamSummaryText = `推流 · 帧 ${currentIndex}/${total} · ${count} 节点`;
      } else if (currentIndex >= total) {
        streamSummaryText = `就绪 · ${count} 节点`;
      } else {
        streamSummaryText = `单步 · 帧 ${currentIndex}/${total} · ${count} 节点`;
      }
    }

    this.setData({
      nodeCount: count,
      streamProgressPercent: percent,
      streamSummaryText,
      emptyHint,
    });
  },

  /**
   * 切换用例核心逻辑：立即重置引擎，清除上一个用例所有视图与缓存，无残影
   */
  switchCase(index, autoPlay = true) {
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }

    if (this.unsubEngine) {
      this.unsubEngine();
      this.unsubEngine = null;
    }

    const nextCase = this.data.allCases[index];
    if (!nextCase) return;

    const messages = nextCase.messages || [];
    const surfaceId = this.findSurfaceIdFromMessages(messages);

    // 立即重置引擎与事件监听
    this.engine = new A2UIEngine();
    this.setupEngineSubscription();

    // 显式触发 surface 组件清空并绑定新引擎（双重保障，清除残影）
    const surfaceComp = typeof this.selectComponent === 'function' ? this.selectComponent('#main-surface') : null;
    if (surfaceComp) {
      if (typeof surfaceComp.clear === 'function') surfaceComp.clear();
      if (typeof surfaceComp.setEngine === 'function') surfaceComp.setEngine(this.engine);
    }

    const initLog = `> 切换: [${nextCase.name || nextCase.file}] (${messages.length} 帧)\n`;

    // 立即清除所有上一个用例的数据与视图状态
    this.setData({
      selectedCaseIndex: index,
      currentCase: nextCase,
      currentSurfaceId: surfaceId,
      renderTree: null,
      nodeCount: 0,
      emptyHint: '',
      isStreaming: autoPlay,
      currentMessageIndex: 0,
      currentTotalMessages: messages.length,
      streamProgressPercent: 0,
      streamSummaryText: autoPlay ? `推流中 · 0/${messages.length} 帧` : `0/${messages.length} 帧`,
      streamLog: initLog,
      eventLogs: [],
    });

    if (autoPlay) {
      this.runStreamingLoop(messages, surfaceId);
    }
  },

  runStreamingLoop(messages, surfaceId, startIndex = 0) {
    let index = startIndex;
    const intervalMs = 280;

    this.streamTimer = setInterval(() => {
      if (index >= messages.length) {
        clearInterval(this.streamTimer);
        this.streamTimer = null;
        this.setData({
          isStreaming: false,
          streamSummaryText: `就绪 · ${this.data.nodeCount} 节点`,
          streamLog: appendCircularLog(this.data.streamLog, `> [Done] 全部 ${messages.length} 帧就绪\n`),
        });
        return;
      }

      const msg = messages[index];
      const chunkNum = index + 1;
      const { desc } = this.describeMessage(msg);

      this.engine.processMessage(msg);
      index++;

      const currentPercent = Math.round((index / messages.length) * 100);
      const newLog = appendCircularLog(this.data.streamLog, `> [${chunkNum}/${messages.length}] ${desc}\n`);

      this.setData({
        currentMessageIndex: index,
        streamProgressPercent: currentPercent,
        streamLog: newLog,
      });

      if (surfaceId) {
        this.engine.notify(surfaceId);
      }
    }, intervalMs);
  },

  /**
   * 步进一帧 (stepNextChunk)：
   * 1. 若正在自动播放，立即打断暂停并执行下一 chunk；
   * 2. 若用例已播放完毕，重置引擎并从第 1 帧开始逐帧执行；
   * 3. 每一帧执行后，精准刷新引擎渲染树并通过 notify 触发 UI；对前序无 root 帧显示极简状态。
   */
  stepNextChunk() {
    // 1. 如果正在自动流式播放，立即暂停并打断定时器
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
      this.setData({ isStreaming: false });
    }

    const currentCase = this.data.currentCase || this.data.allCases[this.data.selectedCaseIndex];
    const messages = currentCase ? (currentCase.messages || []) : [];
    if (!messages.length) return;

    let index = this.data.currentMessageIndex;

    // 2. 如果用例已经播放完毕（或者处于越界状态），重置引擎并从第 1 帧重新开始单步执行
    if (index >= messages.length) {
      if (this.unsubEngine) {
        this.unsubEngine();
        this.unsubEngine = null;
      }
      this.engine = new A2UIEngine();
      this.setupEngineSubscription();
      const surfaceComp = typeof this.selectComponent === 'function' ? this.selectComponent('#main-surface') : null;
      if (surfaceComp) {
        if (typeof surfaceComp.clear === 'function') surfaceComp.clear();
        if (typeof surfaceComp.setEngine === 'function') surfaceComp.setEngine(this.engine);
      }

      index = 0;
      this.setData({
        renderTree: null,
        nodeCount: 0,
        currentMessageIndex: 0,
        streamProgressPercent: 0,
        eventLogs: [],
        streamLog: `> [Reset] 单步模式 (从第 1 帧开始)\n`,
      });
    }

    // 3. 执行当前帧
    const msg = messages[index];
    const chunkNum = index + 1;
    const { desc } = this.describeMessage(msg);

    this.engine.processMessage(msg);

    const nextIndex = index + 1;
    const currentPercent = Math.round((nextIndex / messages.length) * 100);
    const newLog = appendCircularLog(this.data.streamLog, `> [Step ${chunkNum}/${messages.length}] ${desc}\n`);

    this.setData({
      currentMessageIndex: nextIndex,
      isStreaming: false,
      streamProgressPercent: currentPercent,
      streamLog: newLog,
    });

    // 4. 触发引擎通知刷新界面与前序帧状态反馈
    const surfaceId = this.data.currentSurfaceId || this.findSurfaceIdFromMessages(messages);
    if (surfaceId) {
      this.engine.notify(surfaceId);
    }
  },

  /**
   * 跳过流式过程，全量直出
   */
  skipToDirect() {
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }

    const currentCase = this.data.currentCase || this.data.allCases[this.data.selectedCaseIndex];
    const messages = currentCase ? (currentCase.messages || []) : [];

    // 重置引擎并一次性全量灌入所有帧 (CR-M6: process 直接批处理，不重复 notify)
    if (this.unsubEngine) {
      this.unsubEngine();
      this.unsubEngine = null;
    }
    this.engine = new A2UIEngine();
    this.setupEngineSubscription();
    const surfaceComp = typeof this.selectComponent === 'function' ? this.selectComponent('#main-surface') : null;
    if (surfaceComp) {
      if (typeof surfaceComp.clear === 'function') surfaceComp.clear();
      if (typeof surfaceComp.setEngine === 'function') surfaceComp.setEngine(this.engine);
    }

    this.engine.process(messages);

    this.setData({
      isStreaming: false,
      currentMessageIndex: messages.length,
      streamProgressPercent: 100,
      streamLog: appendCircularLog(this.data.streamLog, `> [Skip] 直出全部 ${messages.length} 帧\n`),
    });
  },

  restartStreaming() {
    this.switchCase(this.data.selectedCaseIndex, true);
  },

  onSelectCase(e) {
    const selectedCaseIndex = Number(e.detail.value);
    this.switchCase(selectedCaseIndex, true);
  },

  prevCase() {
    if (this.data.selectedCaseIndex > 0) {
      this.switchCase(this.data.selectedCaseIndex - 1, true);
    }
  },

  nextCase() {
    if (this.data.selectedCaseIndex < this.data.allCases.length - 1) {
      this.switchCase(this.data.selectedCaseIndex + 1, true);
    }
  },

  toggleDebugDrawer() {
    this.setData({
      showDebugDrawer: !this.data.showDebugDrawer,
    });
  },

  setDebugTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeDebugTab: tab });
  },

  preventD() {},

  onA2UIEvent(e) {
    const eventMsg = e.detail;
    const now = new Date().toLocaleTimeString();

    const newLogs = [
      {
        time: now,
        content: JSON.stringify(eventMsg, null, 2),
      },
      ...this.data.eventLogs,
    ].slice(0, MAX_EVENT_LOGS);

    this.setData({
      eventLogs: newLogs,
    });

    const actionName = eventMsg.action?.name || eventMsg.action?.event?.name || eventMsg.event?.name || 'event';
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({
        title: `⚡️ ${actionName}`,
        icon: 'none',
        duration: 1200,
      });
    }
  },

  onInputChange(_e) {
    // a2ui-surface 组件内部已通过注入的 engine 完成数据反写与局部差量更新 (CR-M2)
    // 此处仅接收事件通知记录日志，不再重复调用 engine.handleInputChange，彻底杜绝双重反写
  },

  clearLogs() {
    this.setData({
      eventLogs: [],
      streamLog: `> 清空日志\n`,
    });
  },

  onHide() {
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
      this.wasStreaming = true;
    }
  },

  onShow() {
    if (this.wasStreaming && this.data.isStreaming) {
      this.wasStreaming = false;
      const currentCase = this.data.currentCase;
      const messages = currentCase ? (currentCase.messages || []) : [];
      if (this.data.currentMessageIndex < messages.length) {
        this.runStreamingLoop(messages, this.data.currentSurfaceId, this.data.currentMessageIndex);
      }
    }
  },

  onUnload() {
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }
    if (this.unsubEngine) {
      this.unsubEngine();
      this.unsubEngine = null;
    }
  },
});
