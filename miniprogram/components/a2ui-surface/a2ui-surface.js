const { A2UIEngine } = require('../../core/engine');

function isSameMessage(m1, m2) {
  if (m1 === m2) return true;
  if (!m1 || !m2) return false;
  if (m1.id && m2.id) return m1.id === m2.id;
  try {
    return JSON.stringify(m1) === JSON.stringify(m2);
  } catch (_) {
    return false;
  }
}

Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'apply-shared',
  },

  properties: {
    surfaceId: {
      type: String,
      value: '',
      observer(newVal, oldVal) {
        if (newVal !== oldVal) {
          this.setData({ uiState: {} });
          if (this.internalEngine) {
            this.internalEngine = null;
            this.processedMsgCount = 0;
            this.firstMsgSnapshot = null;
          }
          if (this.data.messages && this.data.messages.length > 0) {
            this._processMessages(this.data.messages);
          } else if (this.engine) {
            const tree = this.engine.getRenderTree(newVal);
            this._applyTreeUpdate(this.data.localRenderTree, tree, newVal);
          }
        }
      },
    },
    // Directly pass in compiled and resolved component render tree (O3: patch update optimization)
    renderTree: {
      type: Object,
      value: null,
      observer(newVal) {
        const oldTree = this.data.localRenderTree;
        this._applyTreeUpdate(oldTree, newVal, this.data.surfaceId);
      },
    },
    // Empty state / transition prompt
    emptyHint: {
      type: String,
      value: '',
    },
    // Dark mode toggle (aligned with A2UI .a2ui-dark spec)
    darkMode: {
      type: Boolean,
      value: false,
    },
    // Conversation identifier (CR-L3 / CR-5: reset session view on change, preserve external engine)
    conversationId: {
      type: String,
      value: '',
      observer(newVal, oldVal) {
        if (newVal !== oldVal) {
          if (typeof this.resetSession === 'function') {
            this.resetSession();
          } else if (typeof this.clear === 'function') {
            this.clear(true);
          }
        }
      },
    },
    sessionId: {
      type: String,
      value: '',
      observer(newVal, oldVal) {
        if (newVal !== oldVal) {
          if (typeof this.resetSession === 'function') {
            this.resetSession();
          } else if (typeof this.clear === 'function') {
            this.clear(true);
          }
        }
      },
    },
    // Supports stream-driven messages input (incremental handling, CR-M5 / CR-9 / CR-L3)
    messages: {
      type: Array,
      value: [],
      observer(newVal, oldVal) {
        if (oldVal && newVal !== oldVal) {
          // Compare first message content or ID to prevent flicker from object cloning (CR-L3 / CR-7)
          const isShrunk = Array.isArray(oldVal) && Array.isArray(newVal) && newVal.length < (this.processedMsgCount || oldVal.length);
          const isFirstChanged = Array.isArray(oldVal) && Array.isArray(newVal) && oldVal.length > 0 && newVal.length > 0 && !isSameMessage(newVal[0], oldVal[0]);
          if (isShrunk || isFirstChanged) {
            this.clear();
          }
        }
        this._processMessages(newVal);
      },
    },
  },

  data: {
    localRenderTree: null,
    uiState: {},
    surfaceThemeStyle: '',
  },

  lifetimes: {
    attached() {
      if (this.data.renderTree) {
        this.setData({ localRenderTree: this.data.renderTree }, () => {
          this.triggerEvent('rendered', { surfaceId: this.data.surfaceId });
        });
      } else if (this.data.messages && this.data.messages.length > 0 && !this.data.localRenderTree) {
        this._processMessages(this.data.messages);
      }
    },
    detached() {
      // Unsubscribe engine listeners on teardown to prevent leaks and double triggers (CR-M1)
      if (this._isFrameRenderScheduled) {
        this._pendingRenderTask = null;
        this._isFrameRenderScheduled = false;
      }
      this._currentActiveInputId = null;
      if (this._engineUnsubs) {
        this._engineUnsubs.forEach((unsub) => {
          try { unsub(); } catch (_) {}
        });
        this._engineUnsubs = [];
      }
      if (this.internalEngine) {
        this.internalEngine = null;
      }
      this.engine = null;
    },
  },

  methods: {
    _initInternalEngine() {
      this.internalEngine = new A2UIEngine();
      this.internalEngine.addOutboundListener((outboundMsg) => {
        this.triggerEvent('outbound', outboundMsg);
        this.triggerEvent('a2uiEvent', outboundMsg);
      });
      this.internalEngine.addErrorListener((errorMsg) => {
        this.triggerEvent('error', errorMsg);
      });
      this.processedMsgCount = 0;
      this.firstMsgSnapshot = null;
    },

    _scheduleFrameRender(task) {
      this._pendingRenderTask = task;
      if (this._isFrameRenderScheduled) {
        return;
      }
      this._isFrameRenderScheduled = true;
      const nextTick = (typeof wx !== 'undefined' && typeof wx.nextTick === 'function')
        ? wx.nextTick
        : (fn) => setTimeout(fn, 16);

      nextTick(() => {
        this._isFrameRenderScheduled = false;
        const pending = this._pendingRenderTask;
        this._pendingRenderTask = null;
        if (typeof pending === 'function') {
          pending();
        }
      });
    },

    _applyTreeUpdate(oldTree, newTree, surfaceId) {
      const engine = this.engine || this.internalEngine;
      const targetSurfaceId = surfaceId || this.data.surfaceId;

      // Extract official createSurface.theme.primaryColor dynamic theme color (aligned with official Lit willUpdate)
      let surfaceThemeStyle = '';
      const theme = (newTree && newTree.theme) || (engine && engine.surfaces && targetSurfaceId && engine.surfaces.get(targetSurfaceId)?.theme);
      if (theme && theme.primaryColor) {
        const pc = theme.primaryColor;
        surfaceThemeStyle = `--a2ui-color-primary: ${pc}; --a2ui-primary-color: ${pc}; --a2ui-border-focus: ${pc}; --a2ui-text-link: ${pc};`;
      }

      if (!newTree) {
        const resetData = { localRenderTree: null };
        if (this.data.surfaceThemeStyle) resetData.surfaceThemeStyle = '';
        this.setData(resetData, () => {
          if (targetSurfaceId) this.triggerEvent('rendered', { surfaceId: targetSurfaceId });
        });
        return;
      }

      if (oldTree && typeof oldTree === 'object' && engine && typeof engine.computeTreePatches === 'function') {
        const patches = engine.computeTreePatches(oldTree, newTree, 'localRenderTree', {
          activeComponentId: this._currentActiveInputId,
        });
        if (surfaceThemeStyle && this.data.surfaceThemeStyle !== surfaceThemeStyle) {
          patches.surfaceThemeStyle = surfaceThemeStyle;
        } else if (!surfaceThemeStyle && this.data.surfaceThemeStyle) {
          patches.surfaceThemeStyle = '';
        }
        const patchKeys = Object.keys(patches);
        if (patchKeys.length > 0) {
          this.setData(patches, () => {
            if (targetSurfaceId) this.triggerEvent('rendered', { surfaceId: targetSurfaceId });
          });
          this.data.localRenderTree = newTree;
          return;
        } else {
          this.data.localRenderTree = newTree;
          if (targetSurfaceId) this.triggerEvent('rendered', { surfaceId: targetSurfaceId });
          return;
        }
      }

      const updateData = { localRenderTree: newTree };
      if (surfaceThemeStyle) {
        updateData.surfaceThemeStyle = surfaceThemeStyle;
      }
      this.setData(updateData, () => {
        if (targetSurfaceId) this.triggerEvent('rendered', { surfaceId: targetSurfaceId });
      });
    },

    _processMessages(newVal) {
      if (newVal && newVal.length > 0) {
        if (!this.internalEngine) {
          this._initInternalEngine();
        }

        // Validate stream continuity: if array shrunk or first message changed, reset for new stream (CR-9)
        const currentFirstSnapshot = JSON.stringify(newVal[0] || {});
        if (this.firstMsgSnapshot && (newVal.length < (this.processedMsgCount || 0) || this.firstMsgSnapshot !== currentFirstSnapshot)) {
          this.clear();
          this._initInternalEngine();
        }
        this.firstMsgSnapshot = currentFirstSnapshot;

        // Process incremental messages only
        const startIdx = this.processedMsgCount || 0;
        if (newVal.length > startIdx) {
          const newChunk = newVal.slice(startIdx);
          this.internalEngine.process(newChunk);
          this.processedMsgCount = newVal.length;
        }

        let targetSurfaceId = this.data.surfaceId;
        if (!targetSurfaceId && this.internalEngine.surfaces.size > 0) {
          targetSurfaceId = Array.from(this.internalEngine.surfaces.keys())[0];
        }
        if (targetSurfaceId) {
          this._scheduleFrameRender(() => {
            if (!this.internalEngine) return;
            const tree = this.internalEngine.getRenderTree(targetSurfaceId);
            this._applyTreeUpdate(this.data.localRenderTree, tree, targetSurfaceId);
          });
        }
      } else {
        this.clear();
      }
    },

    setEngine(engine) {
      // Clean up previous engine listener subscriptions (CR-M1)
      if (this._engineUnsubs) {
        this._engineUnsubs.forEach((unsub) => {
          try { unsub(); } catch (_) {}
        });
        this._engineUnsubs = [];
      }
      this.engine = engine;
      if (this.engine) {
        this._engineUnsubs = [];
        if (typeof this.engine.addOutboundListener === 'function') {
          const unsubOut = this.engine.addOutboundListener((outboundMsg) => {
            if (this._lastDispatchedMsg !== outboundMsg) {
              this.triggerEvent('outbound', outboundMsg);
              this.triggerEvent('a2uiEvent', outboundMsg);
            }
          });
          if (typeof unsubOut === 'function') this._engineUnsubs.push(unsubOut);
        }
        if (typeof this.engine.addErrorListener === 'function') {
          const unsubErr = this.engine.addErrorListener((errorMsg) => {
            this.triggerEvent('error', errorMsg);
          });
          if (typeof unsubErr === 'function') this._engineUnsubs.push(unsubErr);
        }
        if (typeof this.engine.subscribe === 'function') {
          const unsubTree = this.engine.subscribe((sId, newTree) => {
            // Frame batching on external engine stream; targeted differential refresh on controlled input (CR-M2)
            if ((sId === this.data.surfaceId || !this.data.surfaceId) && !this._isHandlingInput) {
              this._scheduleFrameRender(() => {
                if (!this._isHandlingInput) {
                  this._applyTreeUpdate(this.data.localRenderTree, newTree, sId || this.data.surfaceId);
                }
              });
            }
          });
          if (typeof unsubTree === 'function') this._engineUnsubs.push(unsubTree);
        }
        if (this.data.surfaceId) {
          const tree = this.engine.getRenderTree(this.data.surfaceId);
          this._applyTreeUpdate(this.data.localRenderTree, tree, this.data.surfaceId);
        }
      }
    },

    setRenderTree(tree) {
      this._applyTreeUpdate(this.data.localRenderTree, tree, this.data.surfaceId);
    },

    clear(keepExternalEngine = false) {
      if (this._isFrameRenderScheduled) {
        this._pendingRenderTask = null;
        this._isFrameRenderScheduled = false;
      }
      this._currentActiveInputId = null;
      if (!keepExternalEngine) {
        if (this._engineUnsubs) {
          this._engineUnsubs.forEach((unsub) => {
            try { unsub(); } catch (_) {}
          });
          this._engineUnsubs = [];
        }
        this.engine = null;
      }
      if (this.internalEngine) {
        this.internalEngine = null;
      }
      this.processedMsgCount = 0;
      this.firstMsgSnapshot = null;
      this.setData({
        localRenderTree: null,
        uiState: {},
        surfaceThemeStyle: '',
      });
    },

    resetSession() {
      // Clear local state and view tree upon session change, preserving externally injected engine (CR-5)
      this.clear(true);
      // Fetch latest tree for surfaceId if engine is injected
      if (this.engine && this.data.surfaceId) {
        const tree = this.engine.getRenderTree(this.data.surfaceId);
        if (tree) {
          this._applyTreeUpdate(null, tree, this.data.surfaceId);
        }
      }
    },

    findNodeById(root, id) {
      if (!root || !id) return null;
      if (Array.isArray(root)) {
        for (const item of root) {
          const found = this.findNodeById(item, id);
          if (found) return found;
        }
        return null;
      }
      if (root.id === id) return root;
      if (root.children && Array.isArray(root.children)) {
        for (const child of root.children) {
          const found = this.findNodeById(child, id);
          if (found) return found;
        }
      }
      if (root.triggerNode) {
        const found = this.findNodeById(root.triggerNode, id);
        if (found) return found;
      }
      if (root.contentNode) {
        const found = this.findNodeById(root.contentNode, id);
        if (found) return found;
      }
      return null;
    },

    handleTap(e) {
      const componentId = e.currentTarget.dataset.id;
      this.dispatchTapEvent(componentId);
    },

    onDeepNodeTap(e) {
      const { componentId } = e.detail;
      this.dispatchTapEvent(componentId);
    },

    dispatchTapEvent(componentId) {
      const engine = this.engine || this.internalEngine;
      const surfaceId = this.data.surfaceId || (engine && engine.surfaces && engine.surfaces.size > 0 ? Array.from(engine.surfaces.keys())[0] : '');

      let eventMessage = null;
      if (engine && typeof engine.createActionMessage === 'function') {
        eventMessage = engine.createActionMessage(surfaceId, componentId);
      }

      // Do not emit unparsed or malformed action without engine, report standard error (CR-M4)
      if (!eventMessage) {
        if (!engine) {
          const err = {
            code: 'EXECUTION_ERROR',
            surfaceId: surfaceId || 'unknown',
            path: `/${componentId}`,
            message: 'A2UIEngine instance is required to resolve and dispatch action',
          };
          this.triggerEvent('error', { version: 'v1.0', error: err });
          console.error(`[A2UI] dispatchTapEvent failed: ${err.message}`);
        }
        return;
      }

      this._lastDispatchedMsg = eventMessage;
      if (engine && typeof engine.dispatchOutbound === 'function') {
        engine.dispatchOutbound(eventMessage);
      }
      this.triggerEvent('a2uiEvent', eventMessage);
      this.triggerEvent('action', {
        surfaceId,
        componentId,
        action: eventMessage.action,
        eventMessage,
      });
    },

    handleInput(e) {
      const { id, path, kind } = e.currentTarget.dataset;
      this._currentActiveInputId = id;
      let value = e.detail.value;
      if (kind === 'bool') {
        if (Array.isArray(value)) {
          value = value.length > 0;
        } else if (typeof value === 'string') {
          const s = value.trim().toLowerCase();
          value = !(s === 'false' || s === '0' || s === 'off' || s === 'no' || s === '');
        } else {
          value = Boolean(value);
        }
      } else if (kind === 'choice-multi') {
        // ChoicePicker multi-select: cast string values back to original option types
        const rawArray = Array.isArray(value) ? value : (value != null && value !== '' ? [value] : []);
        const node = this.findNodeById(this.data.localRenderTree, id);
        if (node && Array.isArray(node.options)) {
          value = rawArray.map((strVal) => {
            const matchedOpt = node.options.find((opt) => {
              const optVal = (typeof opt === 'object' && opt !== null)
                ? (opt.value !== undefined ? opt.value : opt.label)
                : opt;
              return String(optVal) === String(strVal);
            });
            return matchedOpt !== undefined
              ? ((typeof matchedOpt === 'object' && matchedOpt !== null)
                  ? (matchedOpt.value !== undefined ? matchedOpt.value : matchedOpt.label)
                  : matchedOpt)
              : strVal;
          });
        } else {
          value = rawArray;
        }
      }
      this.dispatchInputEvent(id, path, value);
    },

    handleInputFocus(e) {
      const componentId = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id)
        || (e.detail && e.detail.componentId);
      if (componentId) {
        this._currentActiveInputId = componentId;
      }
    },

    handleInputBlur() {
      this._currentActiveInputId = null;
    },

    // ChoicePicker selection change (CR-2 & L1: uniform array structure)
    handlePickerChange(e) {
      const { id, path } = e.currentTarget.dataset;
      const index = Number(e.detail.value);
      const node = this.findNodeById(this.data.localRenderTree, id);
      let value = [index];
      if (node && Array.isArray(node.options) && node.options[index]) {
        const opt = node.options[index];
        const optVal = (typeof opt === 'object' && opt !== null)
          ? (opt.value !== undefined ? opt.value : opt.label)
          : opt;
        value = [optVal];
      }
      this.dispatchInputEvent(id, path, value);
    },

    // ChoicePicker Chips single/multiple choice click (L2 & CR: restore original option type)
    onChipSelect(e) {
      const { id, path, val } = e.currentTarget.dataset;
      const node = this.findNodeById(this.data.localRenderTree, id);
      if (node && node.disabled) return;
      let matchedVal = val;
      if (node && Array.isArray(node.options)) {
        const found = node.options.find((opt) => {
          const optVal = (typeof opt === 'object' && opt !== null)
            ? (opt.value !== undefined ? opt.value : opt.label)
            : opt;
          return String(optVal) === String(val);
        });
        if (found !== undefined) {
          matchedVal = (typeof found === 'object' && found !== null)
            ? (found.value !== undefined ? found.value : found.label)
            : found;
        }
      }
      if (node && node.mutuallyExclusive === false) {
        const curVals = Array.isArray(node.value)
          ? [...node.value]
          : (node.value !== undefined && node.value !== null && node.value !== '' ? [node.value] : []);
        const strVal = String(matchedVal);
        const idx = curVals.findIndex((v) => String(v) === strVal);
        if (idx >= 0) {
          curVals.splice(idx, 1);
        } else {
          curVals.push(matchedVal);
        }
        this.dispatchInputEvent(id, path, curVals);
      } else {
        this.dispatchInputEvent(id, path, [matchedVal]);
      }
    },

    onDeepNodeChipSelect(e) {
      const { componentId, path, value } = e.detail;
      this.dispatchInputEvent(componentId, path, Array.isArray(value) ? value : [value]);
    },

    // Custom extension component Action message bridge
    onCustomAction(e) {
      const detail = e.detail || {};
      const componentId = detail.componentId;
      if (detail.action) {
        const engine = this.engine || this.internalEngine;
        const surfaceId = this.data.surfaceId;
        const outboundMsg = {
          version: 'v1.0',
          action: Object.assign(
            {
              surfaceId,
              sourceComponentId: componentId || 'custom_component',
              timestamp: new Date().toISOString(),
            },
            detail.action
          ),
        };
        if (engine && typeof engine.dispatchOutbound === 'function') {
          engine.dispatchOutbound(outboundMsg);
        }
        this.triggerEvent('a2uiEvent', outboundMsg);
        this.triggerEvent('action', {
          surfaceId,
          componentId,
          action: outboundMsg.action,
          eventMessage: outboundMsg,
        });
      } else if (componentId) {
        this.dispatchTapEvent(componentId);
      }
    },

    // Custom extension component two-way data binding bridge
    onCustomInput(e) {
      const { componentId, path, value } = e.detail || {};
      if (componentId && path !== undefined) {
        this.dispatchInputEvent(componentId, path, value);
      }
    },

    // Custom extension component local UI state update
    onCustomUIStateChange(e) {
      const { key, value } = e.detail || {};
      if (key) {
        this.setData({ [`uiState.${key}`]: value });
      }
    },

    // DateTimeInput change (CR-3 & M5: full support for enableDate and enableTime and UTC ISO roundtrip)
    handleDateTimeChange(e) {
      const { id, path, part } = e.currentTarget.dataset;
      const newVal = e.detail.value;
      const node = this.findNodeById(this.data.localRenderTree, id);

      let datePart = node ? (node.dateValue || '') : '';
      let timePart = node ? (node.timeValue || '') : '';

      if (part === 'date') {
        datePart = newVal;
      } else if (part === 'time') {
        timePart = newVal;
      }

      let finalValue = '';
      const enableDate = node ? node.enableDate !== false : true;
      const enableTime = node ? Boolean(node.enableTime) : false;

      if (enableDate && enableTime) {
        const now = new Date();
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const d = datePart || localToday;
        const t = timePart || '00:00';
        const s = (node && node.timeSec) ? node.timeSec : '00';
        if (node && node.isIso !== false) {
          // Convert local time back to standard ISO 8601 UTC string (M5)
          const localDt = new Date(`${d}T${t.length === 5 ? t : t.slice(0, 5)}:${s}`);
          if (!isNaN(localDt.getTime())) {
            finalValue = localDt.toISOString();
          } else {
            finalValue = `${d}T${t}:${s}Z`;
          }
        } else {
          finalValue = `${d}T${t}:${s}`;
        }
      } else if (enableTime) {
        finalValue = timePart;
      } else {
        finalValue = datePart;
      }

      // Do not mutate oldTree in-place (node.dateValue = ...), otherwise computeTreePatches will skip update (H1)

      this.dispatchInputEvent(id, path, finalValue);
    },

    onDeepNodeInput(e) {
      const { componentId, path, value } = e.detail;
      this._currentActiveInputId = componentId;
      let finalValue = value;
      // Fallback: if deep node passes unresolved index, resolve using top-level render tree (H3)
      const isIndex = typeof value === 'number' || (Array.isArray(value) && value.length === 1 && typeof value[0] === 'number');
      if (isIndex) {
        const rawIdx = typeof value === 'number' ? value : value[0];
        const node = this.findNodeById(this.data.localRenderTree, componentId);
        if (node && Array.isArray(node.options) && node.options[rawIdx]) {
          const opt = node.options[rawIdx];
          const optVal = (typeof opt === 'object' && opt !== null)
            ? (opt.value !== undefined ? opt.value : opt.label)
            : opt;
          finalValue = [optVal];
        }
      }
      this.dispatchInputEvent(componentId, path, finalValue);
    },

    dispatchInputEvent(componentId, path, value) {
      const engine = this.engine || this.internalEngine;
      const surfaceId = this.data.surfaceId || (engine && engine.surfaces && engine.surfaces.size > 0 ? Array.from(engine.surfaces.keys())[0] : '');
      if (engine && path) {
        const oldTree = this.data.localRenderTree;
        this._currentActiveInputId = componentId;
        this._isHandlingInput = true;
        try {
          engine.handleInputChange(surfaceId, path, value, { silent: true });
        } finally {
          this._isHandlingInput = false;
        }
        const newTree = engine.getRenderTree(surfaceId);

        // Targeted differential refresh: compute patches to prevent cursor jumping on controlled inputs (CR-M2)
        if (oldTree && newTree && typeof engine.computeTreePatches === 'function') {
          const patches = engine.computeTreePatches(oldTree, newTree, 'localRenderTree', {
            activeComponentId: componentId,
          });
          if (Object.keys(patches).length > 0) {
            this.setData(patches);
          }
          this.data.localRenderTree = newTree;
        } else {
          this.setData({ localRenderTree: newTree || null });
        }
      }

      this.triggerEvent('inputChange', {
        surfaceId,
        componentId,
        path,
        value,
      });
    },

    // Safe property key mapping (CR-L5: prevents dot or bracket syntax from corrupting setData path parsing)
    _safeKey(id, uikey) {
      if (uikey) return String(uikey);
      if (!id) return 'def';
      return String(id).replace(/[^a-zA-Z0-9_]/g, '_');
    },

    // Tabs interaction and state control (CR-H6 / CR-L5)
    onTabTap(e) {
      const { id, idx, uikey } = e.currentTarget.dataset;
      const key = this._safeKey(id, uikey);
      this.setData({
        [`uiState.${key}`]: Number(idx),
      });
    },

    onDeepNodeTabTap(e) {
      const { id, idx, uikey } = e.detail;
      const key = this._safeKey(id, uikey);
      this.setData({
        [`uiState.${key}`]: Number(idx),
      });
    },

    // Modal interaction and state control (CR-H6 / CR-L5)
    onModalOpen(e) {
      const { id, uikey } = e.currentTarget.dataset;
      const key = this._safeKey(id, uikey);
      this.setData({
        [`uiState.${key}_open`]: true,
      });
    },

    onModalClose(e) {
      const { id, uikey } = e.currentTarget.dataset;
      const key = this._safeKey(id, uikey);
      this.setData({
        [`uiState.${key}_open`]: false,
      });
    },

    onDeepNodeModalOpen(e) {
      const { id, uikey } = e.detail;
      const key = this._safeKey(id, uikey);
      this.setData({
        [`uiState.${key}_open`]: true,
      });
    },

    onDeepNodeModalClose(e) {
      const { id, uikey } = e.detail;
      const key = this._safeKey(id, uikey);
      this.setData({
        [`uiState.${key}_open`]: false,
      });
    },

    noop() {},
  },
});