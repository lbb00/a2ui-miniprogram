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

    // Render tree and node counts
    renderTree: null,
    nodeCount: 0,
    emptyHint: '',

    // Streaming state
    isStreaming: false,
    currentMessageIndex: 0,
    currentTotalMessages: 0,
    streamProgressPercent: 0,
    streamSummaryText: '',
    streamLog: '',

    // Interactive & debug drawer
    showDebugDrawer: false,
    activeDebugTab: 'stream',
    eventLogs: [],
  },

  onLoad() {
    // Format all test case titles
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
    // Inject engine into surface component instance safely after initial mount
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
        hint: `Surface [${sId}] initialized`,
      };
    }
    if (msg.updateDataModel) {
      return {
        desc: `updateDataModel`,
        hint: `Data model injected`,
      };
    }
    if (msg.updateComponents) {
      const count = msg.updateComponents.components ? msg.updateComponents.components.length : 0;
      return {
        desc: `updateComponents (${count})`,
        hint: `Components assembled (${count})`,
      };
    }
    if (msg.deleteSurface) {
      const sId = msg.deleteSurface.surfaceId;
      return {
        desc: `deleteSurface [${sId}]`,
        hint: `Surface destroyed`,
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
        streamSummaryText = `0/${total} chunks`;
      } else if (currentIndex < total) {
        emptyHint = `Chunk ${currentIndex}/${total} · ${hint}`;
        streamSummaryText = `Chunk ${currentIndex}/${total} · ${hint}`;
      } else {
        emptyHint = '';
        streamSummaryText = `${total}/${total} chunks`;
      }
    } else {
      emptyHint = '';
      if (this.data.isStreaming) {
        streamSummaryText = `Streaming · Chunk ${currentIndex}/${total} · ${count} nodes`;
      } else if (currentIndex >= total) {
        streamSummaryText = `Ready · ${count} nodes`;
      } else {
        streamSummaryText = `Step · Chunk ${currentIndex}/${total} · ${count} nodes`;
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
   * Switch test case: resets engine and clears all previous state cleanly.
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

    // Reset engine and subscription
    this.engine = new A2UIEngine();
    this.setupEngineSubscription();

    // Explicitly clear surface component and bind new engine
    const surfaceComp = typeof this.selectComponent === 'function' ? this.selectComponent('#main-surface') : null;
    if (surfaceComp) {
      if (typeof surfaceComp.clear === 'function') surfaceComp.clear();
      if (typeof surfaceComp.setEngine === 'function') surfaceComp.setEngine(this.engine);
    }

    const initLog = `> Switching: [${nextCase.name || nextCase.file}] (${messages.length} chunks)\n`;

    // Clear previous view state
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
      streamSummaryText: autoPlay ? `Streaming · 0/${messages.length} chunks` : `0/${messages.length} chunks`,
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
          streamSummaryText: `Ready · ${this.data.nodeCount} nodes`,
          streamLog: appendCircularLog(this.data.streamLog, `> [Done] All ${messages.length} chunks ready\n`),
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
   * Step next chunk:
   * 1. If currently auto-streaming, pause and step next chunk;
   * 2. If finished, reset and step from chunk 1;
   * 3. Process chunk, update log and notify surface.
   */
  stepNextChunk() {
    // 1. Pause active streaming timer
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
      this.setData({ isStreaming: false });
    }

    const currentCase = this.data.currentCase || this.data.allCases[this.data.selectedCaseIndex];
    const messages = currentCase ? (currentCase.messages || []) : [];
    if (!messages.length) return;

    let index = this.data.currentMessageIndex;

    // 2. If finished, reset and start from chunk 1
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
        streamLog: `> [Reset] Step mode (starting from chunk 1)\n`,
      });
    }

    // 3. Process current chunk
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

    // 4. Notify surface
    const surfaceId = this.data.currentSurfaceId || this.findSurfaceIdFromMessages(messages);
    if (surfaceId) {
      this.engine.notify(surfaceId);
    }
  },

  /**
   * Skip streaming and assemble all chunks directly
   */
  skipToDirect() {
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }

    const currentCase = this.data.currentCase || this.data.allCases[this.data.selectedCaseIndex];
    const messages = currentCase ? (currentCase.messages || []) : [];

    // Reset engine and process all messages in batch
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
      streamLog: appendCircularLog(this.data.streamLog, `> [Skip] All ${messages.length} chunks assembled\n`),
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
    // Engine handles input mutations and diff patching internally
  },

  clearLogs() {
    this.setData({
      eventLogs: [],
      streamLog: `> Logs cleared\n`,
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
