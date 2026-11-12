/**
 * A2UI Engine for WeChat MiniProgram
 * Protocol parsing engine and state machine (A2UI v1.0 specification)
 * Prototype pollution protection, DAG depth guard, scoped path tracking, standard Action message reporting
 */

const {
  A2UI_VERSION,
  A2UI_MIME_TYPE,
  resolveValue,
  resolveDeep,
  toBool,
  openUrl,
  createRendererCapabilities
} = require('./data-model');
const { parsePointer, toPointer, getIn, setIn, resolveSegs, toPropertyPath, computeTreePatches } = require('./pointer');
const { hasMarkdown, parseMarkdown } = require('./markdown');

const MAX_DEPTH = 32;
const MAX_TOTAL_NODES = 5000;

/**
 * Standard structured A2UI Error class with error code
 */
class A2UIError extends Error {
  constructor(code, message, details = {}) {
    super(typeof message === 'string' ? message : (details.message || code));
    this.name = 'A2UIError';
    this.code = code;
    this.details = details;
    if (typeof message === 'object' && message !== null) {
      Object.assign(this.details, message);
    }
  }
}

/**
 * A2UI standard structured error codes (renderer_to_agent.json#/$defs/error)
 */
const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_COMPONENT: 'UNKNOWN_COMPONENT',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  UNALLOWED_PARENT: 'UNALLOWED_PARENT',
  UNALLOWED_CHILD: 'UNALLOWED_CHILD',
  UNKNOWN_FUNCTION: 'UNKNOWN_FUNCTION',
  NO_TRANSPORT: 'NO_TRANSPORT',
  CANCELLED: 'CANCELLED',
  SURFACE_DELETED: 'SURFACE_DELETED',
  DISPOSED: 'DISPOSED',
  TIMEOUT: 'TIMEOUT',
};

/**
 * Fixed legacy key mapping table for copy-on-write normalization
 */
const LEGACY_KEY_MAPPINGS = [
  ['checks', '@checks'],
  ['catalogId', '@catalogId'],
  ['accessibility', '@accessibility'],
  ['metadata', '@metadata'],
];

/**
 * Normalizes component properties adhering to A2UI 1.0 standard with Copy-on-Write (zero allocation for pure 1.0)
 */
function normalizeComponent(comp, reportedConflicts = null, _surfaceId = 'unknown') {
  if (!comp || typeof comp !== 'object') return comp;

  let needsCopy = false;
  for (let i = 0; i < LEGACY_KEY_MAPPINGS.length; i++) {
    const legacyKey = LEGACY_KEY_MAPPINGS[i][0];
    if (comp[legacyKey] !== undefined) {
      needsCopy = true;
      break;
    }
  }

  // Pure 1.0 (no legacy keys): zero allocation, return original reference directly
  if (!needsCopy) {
    return comp;
  }

  // Copy-on-write shallow copy with prototype pollution guard
  const normalized = {};
  for (const key of Object.keys(comp)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    normalized[key] = comp[key];
  }

  for (let i = 0; i < LEGACY_KEY_MAPPINGS.length; i++) {
    const [legacyKey, standardKey] = LEGACY_KEY_MAPPINGS[i];
    if (comp[legacyKey] !== undefined) {
      if (comp[standardKey] !== undefined) {
        // Value conflict: standard @ takes precedence, log warning once per id:key
        const warnKey = `${comp.id || 'anonymous'}:${legacyKey}`;
        if (reportedConflicts && !reportedConflicts.has(warnKey)) {
          reportedConflicts.add(warnKey);
          console.warn(`[A2UI 1.0] Conflict: Component '${comp.id}' has both '${standardKey}' and '${legacyKey}'. Standard '${standardKey}' takes precedence.`);
        }
      } else {
        // Only legacy key: migrate to standard @ key
        normalized[standardKey] = comp[legacyKey];
      }
      // Physically remove legacy key so downstream only reads 1.0 @ key
      delete normalized[legacyKey];
    }
  }

  return normalized;
}

/**
 * Basic Catalog known component collection
 */
const KNOWN_COMPONENTS = new Set([
  'Text',
  'Column',
  'Row',
  'Card',
  'Button',
  'Divider',
  'Image',
  'TextField',
  'List',
  'CheckBox',
  'DateTimeInput',
  'ChoicePicker',
  'Modal',
  'Slider',
  'Tabs',
  'AudioPlayer',
  'Video',
  'Icon',
  'View',
  'Surface',
]);

class A2UIEngine {
  constructor(options = {}) {
    this.surfaces = new Map();
    this.listeners = new Set();
    this.outboundListeners = new Set();
    this.errorListeners = new Set();
    this.rendererFunctions = new Map();
    this.customComponents = new Set();
    this.catalogs = new Map();
    this._storage = new Map();
    this._clipboard = '';
    this._lastVibrate = null;
    this.pendingAgentCalls = new Map();
    this._callSeq = 0;
    this._isDestroyed = false;
    this.legacyOutbound = options.legacyOutbound !== undefined ? Boolean(options.legacyOutbound) : true;
    this.registerBuiltinRendererFunctions();
  }

  /**
   * Register a component catalog definition with permissions
   */
  registerCatalog(catalogId, def = {}) {
    this.catalogs.set(catalogId, {
      catalogId,
      components: new Set(def.components || []),
      functions: new Set(def.functions || []),
      allowedCallers: def.allowedCallers || ['agent', 'renderer'],
    });
  }

  /**
   * Register built-in client privileged functions (supports MiniProgram and Node test environment)
   */
  registerBuiltinRendererFunctions() {
    // 1. getSystemInfo: returns system metrics such as model, OS, screen dimensions
    this.registerRendererFunction('getSystemInfo', () => {
      if (typeof wx !== 'undefined' && (wx.getSystemInfoSync || wx.getDeviceInfo)) {
        if (wx.getSystemInfoSync) {
          return wx.getSystemInfoSync();
        }
        return Object.assign(
          {},
          wx.getDeviceInfo ? wx.getDeviceInfo() : {},
          wx.getWindowInfo ? wx.getWindowInfo() : {},
          wx.getAppBaseInfo ? wx.getAppBaseInfo() : {}
        );
      }
      return {
        brand: 'devtools',
        model: 'iPhone 14 Pro',
        pixelRatio: 3,
        screenWidth: 393,
        screenHeight: 852,
        windowWidth: 393,
        windowHeight: 852,
        statusBarHeight: 54,
        language: 'zh_CN',
        version: '8.0.40',
        system: 'iOS 16.5',
        platform: 'devtools',
        SDKVersion: '3.0.0',
      };
    });

    // 2. setClipboard: write content to clipboard
    this.registerRendererFunction('setClipboard', (args = {}) => {
      const text = args.data !== undefined ? args.data : (args.text !== undefined ? args.text : String(args.value || ''));
      if (typeof wx !== 'undefined' && wx.setClipboardData) {
        wx.setClipboardData({ data: String(text) });
      }
      this._clipboard = String(text);
      return { success: true, data: String(text), text: String(text) };
    });

    this.registerRendererFunction('getClipboard', () => {
      return { success: true, data: this._clipboard || '', text: this._clipboard || '' };
    });

    // 3. vibrate / hapticFeedback: trigger vibration feedback
    const vibrateHandler = (args = {}) => {
      const type = args.type || args.style || 'short';
      if (typeof wx !== 'undefined') {
        if (type === 'long' && wx.vibrateLong) {
          wx.vibrateLong();
        } else if (wx.vibrateShort) {
          const wxType = type === 'heavy' ? 'heavy' : (type === 'medium' ? 'medium' : 'light');
          wx.vibrateShort({ type: wxType });
        }
      }
      this._lastVibrate = { type, timestamp: Date.now() };
      return { success: true, type };
    };
    this.registerRendererFunction('vibrate', vibrateHandler);
    this.registerRendererFunction('hapticFeedback', vibrateHandler);

    // 4. getStorage / setStorage: read/write local storage
    this.registerRendererFunction('setStorage', (args = {}) => {
      const key = String(args.key || '');
      const val = args.data !== undefined ? args.data : (args.value !== undefined ? args.value : null);
      if (typeof wx !== 'undefined' && wx.setStorageSync) {
        wx.setStorageSync(key, val);
      }
      this._storage.set(key, val);
      return { success: true, key, value: val, data: val };
    });

    this.registerRendererFunction('getStorage', (args = {}) => {
      const key = String(args.key || '');
      let val;
      if (typeof wx !== 'undefined' && wx.getStorageSync) {
        val = wx.getStorageSync(key);
      } else {
        val = this._storage.get(key);
      }
      const exists = val !== undefined && val !== null;
      return {
        success: exists,
        key,
        value: exists ? val : null,
        data: exists ? val : null,
      };
    });

    // 5. openUrl
    this.registerRendererFunction('openUrl', (args = {}) => {
      const url = args.url || args.target;
      const res = openUrl(url);
      if (!res.success) {
        throw new Error(res.error || 'Failed to open URL');
      }
      return res;
    });
  }

  /**
   * Register custom client function
   */
  registerRendererFunction(name, handler) {
    this.rendererFunctions.set(name, handler);
  }

  /**
   * Register allowed custom component type
   */
  registerComponent(name) {
    this.customComponents.add(name);
  }

  registerCustomComponent(name) {
    this.registerComponent(name);
  }

  /**
   * Register outbound message listener (Action, rendererFunctionResponse, error, etc.)
   */
  onOutboundMessage(listener) {
    this.outboundListeners.add(listener);
    return () => this.outboundListeners.delete(listener);
  }

  setOutboundListener(listener) {
    this.outboundListener = listener;
  }

  subscribeOutbound(listener) {
    return this.onOutboundMessage(listener);
  }

  addOutboundListener(listener) {
    return this.onOutboundMessage(listener);
  }

  dispatchOutbound(msg) {
    let delivered = 0;
    const errors = [];
    if (this.outboundListener) {
      try {
        this.outboundListener(msg);
        delivered++;
      } catch (e) {
        errors.push(e);
        console.error('[A2UI] outboundListener error:', e);
      }
    }
    for (const listener of this.outboundListeners) {
      try {
        listener(msg);
        delivered++;
      } catch (e) {
        errors.push(e);
        console.error('[A2UI] outbound listener error:', e);
      }
    }
    return { delivered, errors };
  }

  /**
   * Unified outbound message wrapper supporting A2UI 1.0 renderer_to_agent and legacyOutbound mode
   */
  wrapOutbound(kind, body) {
    if (this.legacyOutbound) {
      if (kind === 'action') {
        const legacyEvent = Object.assign({}, body);
        const actionWithEvent = Object.assign({}, body, { event: legacyEvent });
        return {
          version: 'v1.0',
          action: actionWithEvent,
          event: legacyEvent,
          renderer_to_agent: {
            action: body,
          },
        };
      }
      return {
        version: 'v1.0',
        [kind]: body,
        renderer_to_agent: {
          [kind]: body,
        },
      };
    }

    // Pure 1.0 standard output
    return {
      version: A2UI_VERSION,
      [kind]: body,
      renderer_to_agent: {
        [kind]: body,
      },
    };
  }

  /**
   * Create standard structured error protocol message (renderer_to_agent.json#/$defs/error)
   */
  createErrorMessage(surfaceId, code, path, message) {
    const errorObj = {
      code: code || ErrorCodes.EXECUTION_ERROR,
      surfaceId: surfaceId || 'unknown',
      path: path !== undefined && path !== null ? String(path) : '/',
      message: message ? String(message) : '',
    };
    return this.wrapOutbound('error', errorObj);
  }

  emitError(surfaceId, code, path, message) {
    const errorMsg = this.createErrorMessage(surfaceId, code, path, message);
    this.dispatchOutbound(errorMsg);
    for (const listener of this.errorListeners) {
      try {
        listener(errorMsg);
      } catch (e) {
        console.error('[A2UI] error listener error:', e);
      }
    }
    return errorMsg;
  }

  onError(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  addErrorListener(listener) {
    return this.onError(listener);
  }

  /**
   * Construct standard response message adhering to renderer_to_agent.json#/$defs/rendererFunctionResponse
   */
  createRendererFunctionResponse(functionCallId, result, error = null) {
    let respPayload;
    if (error) {
      respPayload = {
        functionCallId,
        error: typeof error === 'string' ? { code: ErrorCodes.EXECUTION_ERROR, message: error } : error,
      };
    } else {
      respPayload = {
        functionCallId,
        response: result,
        value: result,
      };
    }
    return this.wrapOutbound('rendererFunctionResponse', respPayload);
  }

  /**
   * Client-initiated Remote Procedure Call to Agent (Client -> Agent RPC)
   */
  callAgentFunction(surfaceId, callFunction, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};

    if (this._isDestroyed) {
      return Promise.reject(new A2UIError(ErrorCodes.DISPOSED, 'A2UIEngine has been destroyed'));
    }

    if (!callFunction || typeof callFunction !== 'object') {
      return Promise.reject(new A2UIError(ErrorCodes.VALIDATION_FAILED, 'Invalid callFunction payload'));
    }

    const fnName = callFunction['@call'] || callFunction.call || callFunction.name;
    if (!fnName || typeof fnName !== 'string') {
      return Promise.reject(new A2UIError(ErrorCodes.VALIDATION_FAILED, 'Missing or invalid function name in callFunction'));
    }

    const hasTransport = Boolean(this.outboundListener) || this.outboundListeners.size > 0;
    if (!hasTransport) {
      return Promise.reject(new A2UIError(ErrorCodes.NO_TRANSPORT, 'No outbound transport listener registered to dispatch callAgentFunction'));
    }

    let timeout = 10000;
    if (opts.timeout !== undefined) {
      const parsedTimeout = Number(opts.timeout);
      if (Number.isFinite(parsedTimeout) && parsedTimeout > 0) {
        timeout = Math.min(parsedTimeout, 2147483647);
      } else if (parsedTimeout === 0) {
        timeout = 0;
      }
    }

    this._callSeq += 1;
    const functionCallId = `agcall_${Date.now()}_${this._callSeq}_${Math.random().toString(36).slice(2, 6)}`;
    const surface = surfaceId ? this.surfaces.get(surfaceId) : null;
    const dataModel = surface ? surface.dataModel : {};
    const rawArgs = callFunction.args || {};
    const args = resolveDeep(rawArgs, dataModel);
    const catalogId = callFunction['@catalogId'] || callFunction.catalogId || (surface ? surface.catalogId : undefined);

    const callPayload = {
      surfaceId: surfaceId || (surface ? surface.surfaceId : 'unknown'),
      functionCallId,
      callFunction: {
        '@call': fnName,
        ...(catalogId ? { catalogId } : {}),
        args,
      },
    };

    return new Promise((resolve, reject) => {
      let timer = null;
      if (timeout > 0) {
        timer = setTimeout(() => {
          if (this.pendingAgentCalls.has(functionCallId)) {
            this.pendingAgentCalls.delete(functionCallId);
            reject(new A2UIError(ErrorCodes.TIMEOUT, `callAgentFunction timed out after ${timeout}ms: ${functionCallId}`, { functionCallId, surfaceId }));
          }
        }, timeout);
      }

      this.pendingAgentCalls.set(functionCallId, {
        resolve,
        reject,
        timer,
        surfaceId,
        functionCallId,
      });

      const msg = this.wrapOutbound('callAgentFunction', callPayload);
      try {
        const { delivered, errors } = this.dispatchOutbound(msg);
        if (delivered === 0 && errors.length > 0) {
          if (timer) clearTimeout(timer);
          this.pendingAgentCalls.delete(functionCallId);
          reject(new A2UIError(ErrorCodes.EXECUTION_ERROR, `Failed to dispatch outbound message: ${errors[0]?.message || errors[0]}`, { errors }));
        }
      } catch (err) {
        if (timer) clearTimeout(timer);
        this.pendingAgentCalls.delete(functionCallId);
        reject(err);
      }
    });
  }

  /**
   * Handle Agent response to previously dispatched callAgentFunction
   */
  handleAgentFunctionResponse(respData) {
    if (!respData || typeof respData !== 'object') {
      return null;
    }
    const { functionCallId, value, response, error } = respData;
    if (!functionCallId) {
      console.warn('[A2UI] agentFunctionResponse received without functionCallId');
      return null;
    }

    const pending = this.pendingAgentCalls.get(functionCallId);
    if (!pending) {
      console.warn(`[A2UI] agentFunctionResponse ignored for unknown or expired functionCallId: '${functionCallId}'`);
      return null;
    }

    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    this.pendingAgentCalls.delete(functionCallId);

    const result = value !== undefined ? value : response;
    if (error) {
      const errObj = new A2UIError(
        error.code || ErrorCodes.EXECUTION_ERROR,
        error.message || String(error),
        { functionCallId, error }
      );
      pending.reject(errObj);
    } else {
      pending.resolve(result);
    }

    return {
      agentFunctionResponse: {
        functionCallId,
        ...(error ? { error } : { response: result, value: result }),
      },
    };
  }

  /**
   * Safe rejection of pending Agent RPC calls
   */
  _rejectPendingCalls(code, filterFn = null) {
    const entries = Array.from(this.pendingAgentCalls.values());
    for (const pending of entries) {
      if (!filterFn || filterFn(pending)) {
        if (pending.timer) {
          clearTimeout(pending.timer);
        }
        this.pendingAgentCalls.delete(pending.functionCallId);
        pending.reject(new A2UIError(code, `Agent RPC call ${code.toLowerCase()}: ${pending.functionCallId}`, {
          functionCallId: pending.functionCallId,
          surfaceId: pending.surfaceId,
        }));
      }
    }
  }

  /**
   * Execute client function call (Agent -> Client RPC)
   */
  executeRendererFunction(callData) {
    if (!callData || typeof callData !== 'object') {
      return this.emitError('unknown', ErrorCodes.VALIDATION_FAILED, '/', 'Invalid callRendererFunction payload');
    }

    const { surfaceId, functionCallId, callFunction } = callData;

    if (!functionCallId) {
      return this.emitError(surfaceId || 'unknown', ErrorCodes.VALIDATION_FAILED, '/functionCallId', 'Missing required functionCallId');
    }

    if (!callFunction || typeof callFunction !== 'object') {
      const errResp = this.createRendererFunctionResponse(functionCallId, null, {
        code: ErrorCodes.EXECUTION_ERROR,
        message: 'Missing callFunction in callRendererFunction',
      });
      this.dispatchOutbound(errResp);
      return errResp;
    }

    const fnName = callFunction['@call'] || callFunction.call || callFunction.name;
    if (!fnName) {
      const errResp = this.createRendererFunctionResponse(functionCallId, null, {
        code: ErrorCodes.EXECUTION_ERROR,
        message: 'Missing function name in callFunction',
      });
      this.dispatchOutbound(errResp);
      return errResp;
    }

    const surface = surfaceId ? this.surfaces.get(surfaceId) : null;
    const dataModel = surface ? surface.dataModel : {};
    const rawArgs = callFunction.args || {};
    const args = resolveDeep(rawArgs, dataModel);

    const handler = this.rendererFunctions.get(fnName);
    if (!handler) {
      const errResp = this.createRendererFunctionResponse(functionCallId, null, {
        code: 'UNKNOWN_FUNCTION',
        message: `Renderer function '${fnName}' not found`,
      });
      this.dispatchOutbound(errResp);
      return errResp;
    }

    try {
      const result = handler(args, surfaceId, this);
      const respMsg = this.createRendererFunctionResponse(functionCallId, result);
      this.dispatchOutbound(respMsg);
      return respMsg;
    } catch (err) {
      const errResp = this.createRendererFunctionResponse(functionCallId, null, {
        code: err.code || ErrorCodes.EXECUTION_ERROR,
        message: err.message || String(err),
      });
      this.dispatchOutbound(errResp);
      return errResp;
    }
  }

  callRendererFunction(payload) {
    const callData = (payload && payload.callRendererFunction) ? payload.callRendererFunction : payload;
    return this.executeRendererFunction(callData);
  }

  /**
   * Register render tree update listener
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(surfaceId) {
    let tree = null;
    try {
      tree = this.getRenderTree(surfaceId);
    } catch (err) {
      console.error(`[A2UI] Failed to build render tree for surface '${surfaceId}':`, err);
      this.emitError(surfaceId, ErrorCodes.EXECUTION_ERROR, '/', err.message || String(err));
    }

    for (const listener of this.listeners) {
      try {
        listener(surfaceId, tree);
      } catch (e) {
        console.error('Listener notify error:', e);
      }
    }
  }

  /**
   * Process single or multiple A2UI message streams
   */
  process(messages) {
    if (!messages) return null;
    const initialList = Array.isArray(messages) ? messages : [messages];
    const msgs = [];
    for (const m of initialList) {
      if (m && typeof m === 'object' && Array.isArray(m.agent_to_renderer)) {
        msgs.push(...m.agent_to_renderer);
      } else {
        msgs.push(m);
      }
    }

    const affectedSurfaces = new Set();
    const responses = [];

    for (const msg of msgs) {
      const res = this.processMessage(msg);
      if (typeof res === 'string' && this.surfaces.has(res)) {
        affectedSurfaces.add(res);
      } else if (res && (res.rendererFunctionResponse || res.agentFunctionResponse)) {
        responses.push(res);
      }
    }

    // Notify all affected surfaces in batch (CR-M4)
    for (const surfaceId of affectedSurfaces) {
      this.notify(surfaceId);
    }

    if (responses.length > 0) {
      return responses.length === 1 ? responses[0] : responses;
    }

    if (affectedSurfaces.size > 0) {
      return affectedSurfaces.size === 1
        ? Array.from(affectedSurfaces)[0]
        : Array.from(affectedSurfaces);
    }
    return null;
  }

  processMessage(msg) {
    if (!msg || typeof msg !== 'object') {
      this.emitError('unknown', ErrorCodes.VALIDATION_FAILED, '/', 'Invalid message: expected object');
      return null;
    }

    // Unpack top-level agent_to_renderer envelope if present
    const raw = (msg.agent_to_renderer && typeof msg.agent_to_renderer === 'object')
      ? msg.agent_to_renderer
      : msg;

    try {
      // 0. callRendererFunction
      if (raw.callRendererFunction) {
        return this.executeRendererFunction(raw.callRendererFunction);
      }

      // 0b. agentFunctionResponse
      if (raw.agentFunctionResponse) {
        return this.handleAgentFunctionResponse(raw.agentFunctionResponse);
      }

      // 1. createSurface
      if (raw.createSurface) {
        const { surfaceId, catalogId, components, dataModel, sendDataModel, theme } = raw.createSurface;
        if (!surfaceId) {
          this.emitError('unknown', ErrorCodes.VALIDATION_FAILED, '/createSurface/surfaceId', 'surfaceId is required');
          return null;
        }

        let surface = this.surfaces.get(surfaceId);
        if (!surface) {
          surface = {
            surfaceId,
            catalogId,
            components: new Map(),
            instances: new Map(),
            dataModel: {},
            rootId: 'root',
            sendDataModel: Boolean(sendDataModel),
            reportedUnknown: new Set(),
            reportedConflicts: new Set(),
            theme: theme && typeof theme === 'object' ? theme : null,
          };
          this.surfaces.set(surfaceId, surface);
        } else {
          if (sendDataModel !== undefined) {
            surface.sendDataModel = Boolean(sendDataModel);
          }
          if (theme && typeof theme === 'object') {
            surface.theme = theme;
          }
        }
        if (!surface.reportedUnknown) {
          surface.reportedUnknown = new Set();
        }
        if (!surface.reportedConflicts) {
          surface.reportedConflicts = new Set();
        }

        // Support components and dataModel bundled with createSurface (CR-H4)
        if (dataModel && typeof dataModel === 'object') {
          const safeData = {};
          for (const [k, v] of Object.entries(dataModel)) {
            if (k !== '__proto__' && k !== 'prototype' && k !== 'constructor') {
              safeData[k] = v;
            }
          }
          surface.dataModel = Object.assign({}, surface.dataModel, safeData);
        }
        if (Array.isArray(components)) {
          components.forEach((rawComp, idx) => {
            if (!rawComp || typeof rawComp !== 'object') {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component must be an object');
              return;
            }
            if (!rawComp.id) {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component missing id');
              return;
            }
            const comp = normalizeComponent(rawComp, surface.reportedConflicts, surfaceId);
            const compName = comp.component;
            if (compName && !KNOWN_COMPONENTS.has(compName) && !this.customComponents.has(compName)) {
              const errKey = `${comp.id}:${compName}`;
              if (!surface.reportedUnknown.has(errKey)) {
                surface.reportedUnknown.add(errKey);
                this.emitError(surfaceId, ErrorCodes.UNKNOWN_COMPONENT, `/components/${comp.id}/component`, `Unknown component: ${compName}`);
              }
            }
            surface.components.set(comp.id, comp);
            if (comp.id === 'root') {
              surface.rootId = 'root';
            }
          });
        }
        return surfaceId;
      }

      // 2. updateComponents
      if (raw.updateComponents) {
        const { surfaceId, components } = raw.updateComponents;
        const surface = this.surfaces.get(surfaceId);
        if (!surface) {
          this.emitError(surfaceId || 'unknown', ErrorCodes.VALIDATION_FAILED, '/', `Surface '${surfaceId}' not found`);
          return null;
        }
        if (!surface.reportedUnknown) {
          surface.reportedUnknown = new Set();
        }
        if (!surface.reportedConflicts) {
          surface.reportedConflicts = new Set();
        }

        if (Array.isArray(components)) {
          components.forEach((rawComp, idx) => {
            if (!rawComp || typeof rawComp !== 'object') {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component must be an object');
              return;
            }
            if (!rawComp.id) {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component missing id');
              return;
            }
            const comp = normalizeComponent(rawComp, surface.reportedConflicts, surfaceId);
            const compName = comp.component;
            if (compName && !KNOWN_COMPONENTS.has(compName) && !this.customComponents.has(compName)) {
              const errKey = `${comp.id}:${compName}`;
              if (!surface.reportedUnknown.has(errKey)) {
                surface.reportedUnknown.add(errKey);
                this.emitError(surfaceId, ErrorCodes.UNKNOWN_COMPONENT, `/components/${comp.id}/component`, `Unknown component: ${compName}`);
              }
            }
            surface.components.set(comp.id, comp);
            if (comp.id === 'root') {
              surface.rootId = 'root';
            }
          });
        }
        return surfaceId;
      }

      // 3. updateDataModel
      if (raw.updateDataModel) {
        const { surfaceId, path, value, data } = raw.updateDataModel;
        const surface = this.surfaces.get(surfaceId);
        if (!surface) {
          this.emitError(surfaceId || 'unknown', ErrorCodes.VALIDATION_FAILED, '/', `Surface '${surfaceId}' not found`);
          return null;
        }

        const modelPayload = value !== undefined ? value : data;

        // Root update handling: explicit root pointer ("/" or "") replaces root,
        // while omitted path safely merges top-level object fields.
        if (!path || path === '/') {
          if (path === '/' || path === '') {
            surface.dataModel = modelPayload == null ? {} : modelPayload;
          } else if (modelPayload && typeof modelPayload === 'object' && !Array.isArray(modelPayload)) {
            surface.dataModel = Object.assign({}, surface.dataModel, modelPayload);
          } else {
            console.warn(`[A2UI] Ignored primitive root update on surface '${surfaceId}' to prevent dataModel wipeout.`);
          }
          return surfaceId;
        }

        const segs = parsePointer(path);
        try {
          surface.dataModel = setIn(surface.dataModel, segs, modelPayload);
        } catch (err) {
          console.error(`[A2UI] updateDataModel error on path '${path}':`, err);
          this.emitError(surfaceId, ErrorCodes.EXECUTION_ERROR, path, err.message || String(err));
        }
        return surfaceId;
      }

      // 4. deleteSurface
      if (raw.deleteSurface) {
        const surfaceId = typeof raw.deleteSurface === 'string'
          ? raw.deleteSurface
          : (raw.deleteSurface.surfaceId || null);
        if (surfaceId) {
          this._rejectPendingCalls(ErrorCodes.SURFACE_DELETED, (p) => p.surfaceId === surfaceId);
          this.surfaces.delete(surfaceId);
        }
        return surfaceId;
      }

      this.emitError('unknown', ErrorCodes.VALIDATION_FAILED, '/', 'Unknown or unsupported message type');
      return null;
    } catch (err) {
      const sId = (raw?.createSurface?.surfaceId || raw?.updateComponents?.surfaceId || raw?.updateDataModel?.surfaceId || raw?.deleteSurface?.surfaceId || raw?.callRendererFunction?.surfaceId) || 'unknown';
      this.emitError(sId, ErrorCodes.EXECUTION_ERROR, '/', err.message || String(err));
      return null;
    }
  }

  /**
   * Recursively build render tree for WeChat MiniProgram template layer
   */
  getRenderTree(surfaceId) {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return null;

    // Strict spec: cache until root component arrives; avoid rendering broken tree (CR-H4)
    if (!surface.components.has('root')) {
      return null;
    }

    // Clear instance registry and rebuild
    surface.instances = new Map();
    const dataModel = surface.dataModel;
    let nodeCount = 0;

    const buildNode = (componentId, depth = 0, scope = null, instanceSuffix = '', ancestors = new Set()) => {
      if (!componentId) return null;

      // Total node limit to prevent DAG explosion (CR-N3)
      if (nodeCount >= MAX_TOTAL_NODES) {
        return null;
      }

      // Max depth and ancestor cycle detection based on (componentId @ scoped data path) (CR-N2)
      const scopePath = scope && Array.isArray(scope.base) ? toPointer(scope.base) : '/';
      const ancestorKey = `${componentId}@${scopePath}`;
      if (depth > MAX_DEPTH || ancestors.has(ancestorKey)) {
        return null;
      }

      const comp = surface.components.get(componentId);
      if (!comp) return null;

      nodeCount++;
      const nextAncestors = new Set(ancestors).add(ancestorKey);
      const instanceId = instanceSuffix ? `${comp.id}_${instanceSuffix}` : comp.id;

      // Register instance to support accurate Action reporting and two-way addressing (CR-C1)
      surface.instances.set(instanceId, { comp, scope });

      const node = {
        id: instanceId,
        uiKey: String(instanceId).replace(/[^a-zA-Z0-9_]/g, '_'),
        sourceId: comp.id,
        component: comp.component,
        variant: comp.variant || 'default',
        align: comp.align || 'start',
        justify: comp.justify || 'start',
        fit: comp.fit || 'contain',
        depth,
        children: [],
      };

      // Extract flex layout properties: weight mapped to flex-grow, unassigned defaults to flex: 0 0 auto
      node.ownWidth = ['Icon', 'Button', 'CheckBox'].includes(comp.component) ||
        (comp.component === 'Image' && ['icon', 'avatar'].includes(comp.variant));

      if (comp.weight !== undefined && !isNaN(Number(comp.weight))) {
        let w = Number(comp.weight);
        if (w < 0) w = 0;
        if (w > 10000) w = 10000;
        node.weight = w;
        node.flexStyle = `flex: ${node.weight} 1 0%; min-width: 0;`;
      } else {
        node.weight = undefined;
        node.flexStyle = 'flex: 0 0 auto;';
      }

      // Dynamically resolve text and common properties with scope
      const resolvableProps = [
        'text',
        'url',
        'label',
        'name',
        'title',
        'subtitle',
        'artist',
        'poster',
        'address',
        'description',
        'placeholder',
        'header',
        'direction',
      ];
      for (const p of resolvableProps) {
        if (comp[p] !== undefined) {
          node[p] = resolveValue(comp[p], dataModel, scope);
        }
      }

      // A2UI 1.0 component envelope properties
      if (comp['@catalogId'] !== undefined || comp.catalogId !== undefined) {
        node.catalogId = comp['@catalogId'] !== undefined ? comp['@catalogId'] : comp.catalogId;
      }
      if (comp['@accessibility'] !== undefined || comp.accessibility !== undefined) {
        node.accessibility = comp['@accessibility'] !== undefined ? comp['@accessibility'] : comp.accessibility;
      }
      if (comp['@metadata'] !== undefined || comp.metadata !== undefined) {
        node.metadata = comp['@metadata'] !== undefined ? comp['@metadata'] : comp.metadata;
      }

      // Detect and flag custom extension components (micro-level generics mechanism)
      const isCustomComponent = this.customComponents.has(comp.component) || !KNOWN_COMPONENTS.has(comp.component);
      if (isCustomComponent && comp.component !== 'Surface' && comp.component !== 'View') {
        node.isCustom = true;
        node.props = {};

        // Reserved engine keywords to prevent polluting structure
        const ENGINE_RESERVED = new Set([
          'id', 'component', 'variant', 'align', 'justify', 'fit', 'weight',
          'children', 'child', 'tabs', 'trigger', 'content', 'action', 'checks', '@checks',
          'catalogId', '@catalogId', 'accessibility', '@accessibility', 'metadata', '@metadata',
          'disabled'
        ]);

        for (const [propKey, propVal] of Object.entries(comp)) {
          if (!ENGINE_RESERVED.has(propKey)) {
            const resolvedVal = resolveDeep(propVal, dataModel, scope);
            node.props[propKey] = resolvedVal;
            // Flatten to top of node to simplify WXML template data binding
            if (node[propKey] === undefined) {
              node[propKey] = resolvedVal;
            }
          }
        }
      }

      // Lightweight Markdown heading parsing (Flutter alignment: fallback when no variant is specified)
      if (node.component === 'Text' && typeof node.text === 'string') {
        if (!node.variant || node.variant === 'default') {
          if (!node.text.includes('\n')) {
            if (node.text.startsWith('# ')) {
              node.variant = 'h1';
              node.text = node.text.replace(/^#\s+/, '');
            } else if (node.text.startsWith('## ')) {
              node.variant = 'h2';
              node.text = node.text.replace(/^##\s+/, '');
            } else if (node.text.startsWith('### ')) {
              node.variant = 'h3';
              node.text = node.text.replace(/^###\s+/, '');
            } else if (node.text.startsWith('#### ')) {
              node.variant = 'h4';
              node.text = node.text.replace(/^####\s+/, '');
            } else if (node.text.startsWith('##### ')) {
              node.variant = 'h5';
              node.text = node.text.replace(/^#####\s+/, '');
            }
          }
        }

        // Rich-text Markdown detection and rendering (CR spec)
        if (hasMarkdown(node.text)) {
          node.richHtml = parseMarkdown(node.text);
        }
      }

      // Default Button variant aligned with spec: OutlinedButton
      if (node.component === 'Button' && !node.variant) {
        node.variant = 'outlined';
      }

      // Icon glyph symbol mapping (aligned with Basic Catalog icon system)
      if (node.component === 'Icon') {
        const iconName = String(node.name || '');
        const iconMap = {
          skipPrevious: '⏮',
          skipNext: '⏭',
          play: '▶',
          pause: '⏸',
          star: '⭐',
          check: '✅',
          close: '✕',
          flight: '✈️',
          calendar: '📅',
          time: '🕒',
          location: '📍',
          email: '✉️',
          phone: '📞',
          send: '✈️',
          search: '🔍',
          settings: '⚙️',
          music: '🎵',
          favorite: '❤️',
          heart: '❤️',
          share: '↗️',
          person: '👤'
        };
        node.iconGlyph = iconMap[iconName] || iconMap[iconName.toLowerCase()] || '✦';
      }

      // value and valuePath resolution (calculates absolute JSON Pointer for two-way binding)
      if (comp.value !== undefined) {
        node.value = resolveValue(comp.value, dataModel, scope);
        if (comp.value && typeof comp.value === 'object') {
          const rawPath = comp.value['@path'] !== undefined ? comp.value['@path'] : comp.value.path;
          if (rawPath !== undefined) {
            const segs = resolveSegs(rawPath, scope);
            node.valuePath = toPointer(segs);
          }
        }
      }
      if (comp.valuePath) {
        const segs = resolveSegs(comp.valuePath, scope);
        node.valuePath = toPointer(segs);
      }

      // CheckBox specific (spec supports boolean state in value or checked)
      if (comp.checked !== undefined) {
        node.checked = toBool(resolveValue(comp.checked, dataModel, scope));
        if (comp.checked && typeof comp.checked === 'object' && !node.valuePath) {
          const rawPath = comp.checked['@path'] !== undefined ? comp.checked['@path'] : comp.checked.path;
          if (rawPath !== undefined) {
            const segs = resolveSegs(rawPath, scope);
            node.valuePath = toPointer(segs);
          }
        }
      } else if (comp.component === 'CheckBox' && node.value !== undefined) {
        node.checked = toBool(node.value);
      }

      // Slider specific (spec is steps, fallback to step)
      if (comp.min !== undefined) node.min = Number(resolveValue(comp.min, dataModel, scope)) || 0;
      if (comp.max !== undefined) node.max = Number(resolveValue(comp.max, dataModel, scope)) || 100;
      const stepVal = comp.steps !== undefined ? comp.steps : comp.step;
      if (stepVal !== undefined) node.step = Number(resolveValue(stepVal, dataModel, scope)) || 1;

      // ChoicePicker / Select specific
      if (comp.options !== undefined) {
        node.options = resolveDeep(comp.options, dataModel, scope);
      }
      if (comp.component === 'ChoicePicker' && Array.isArray(node.options)) {
        // Official v1.0 spec: variant = "multipleSelection" | "mutuallyExclusive"
        // Backward compatibility: comp.mutuallyExclusive (boolean)
        const isMulti = comp.variant === 'multipleSelection' || comp.mutuallyExclusive === false;
        node.mutuallyExclusive = !isMulti;
        node.variant = isMulti ? 'multipleSelection' : 'mutuallyExclusive';
        // Official v1.0: displayStyle = "checkbox" | "chips" | "picker"
        node.displayStyle = comp.displayStyle || (isMulti ? 'checkbox' : 'picker');

        // Normalize options to uniform { label, value } format (supports string/number/object items)
        const rawVal = node.value;
        const currentVals = Array.isArray(rawVal)
          ? rawVal.map(String)
          : (rawVal !== undefined && rawVal !== null && rawVal !== '' ? [String(rawVal)] : []);
        node.selectedValues = currentVals;

        node.options = node.options.map((opt) => {
          let label = '';
          let value = '';
          let hasExplicitValue = false;
          if (typeof opt === 'object' && opt !== null) {
            label = opt.label !== undefined ? String(opt.label) : (opt.value !== undefined ? String(opt.value) : '');
            if (opt.value !== undefined) {
              value = opt.value;
              hasExplicitValue = true;
            } else {
              value = opt.label;
            }
          } else {
            label = String(opt);
            value = opt;
          }
          const selected = currentVals.includes(String(value)) || (!hasExplicitValue && currentVals.includes(label));
          return { label, value, selected };
        });

        const targetVal = currentVals[0];
        let foundIdx = -1;
        if (targetVal !== undefined && targetVal !== null) {
          foundIdx = node.options.findIndex(
            (opt) => String(opt.value) === String(targetVal)
          );
          if (foundIdx < 0) {
            foundIdx = node.options.findIndex(
              (opt) => String(opt.label) === String(targetVal)
            );
          }
        }
        node.selectedIndex = foundIdx >= 0 ? foundIdx : 0;
        if (foundIdx >= 0) {
          node.displayLabel = node.options[foundIdx].label;
        } else {
          node.displayLabel = targetVal !== undefined && targetVal !== null && targetVal !== '' ? String(targetVal) : 'Please select';
        }
        // ChoicePicker maintains uniform array structure (L1)
        node.isChoiceArray = true;
      }

      // DateTimeInput specific (CR-C5 & M5: full support for enableDate and enableTime and ISO to local time)
      if (comp.component === 'DateTimeInput') {
        node.enableDate = comp.enableDate !== false;
        node.enableTime = Boolean(comp.enableTime);
        const rawDateStr = node.value ? String(node.value) : '';
        node.rawIsoValue = rawDateStr;
        let tz = 'Z';
        if (rawDateStr.endsWith('Z')) {
          tz = 'Z';
        } else {
          const matchTz = rawDateStr.match(/([+-]\d{2}:?\d{2})$/);
          if (matchTz) tz = matchTz[1];
        }
        node.timezone = tz;

        if (rawDateStr) {
          const parsedDate = new Date(rawDateStr);
          const isIsoFormat = !isNaN(parsedDate.getTime()) && (rawDateStr.includes('T') || rawDateStr.includes('Z'));
          node.isIso = isIsoFormat;

          if (isIsoFormat) {
            // Convert to local time string (M5)
            const Y = parsedDate.getFullYear();
            const M = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const D = String(parsedDate.getDate()).padStart(2, '0');
            const hh = String(parsedDate.getHours()).padStart(2, '0');
            const mm = String(parsedDate.getMinutes()).padStart(2, '0');
            const ss = String(parsedDate.getSeconds()).padStart(2, '0');
            node.dateValue = `${Y}-${M}-${D}`;
            node.timeValue = `${hh}:${mm}`;
            node.timeSec = ss;
          } else if (rawDateStr.includes(':') && !rawDateStr.includes('T')) {
            node.dateValue = '';
            node.timeValue = rawDateStr.slice(0, 5);
            node.timeSec = '00';
          } else {
            node.dateValue = rawDateStr;
            node.timeValue = '';
            node.timeSec = '00';
          }
        } else {
          node.dateValue = '';
          node.timeValue = '';
          node.timeSec = '00';
          node.isIso = false;
        }
      }

      // Action binding (lightweight data only, no parent chain, avoids memory bloat, CR-N7 / CR-14)
      if (comp.action) {
        node.action = comp.action;
        if (scope && typeof scope === 'object') {
          if ('data' in scope) {
            node.scopeData = scope.data;
          } else if ('parent' in scope) {
            const { parent: _parent, ...cleanScope } = scope;
            node.scopeData = cleanScope;
          } else {
            node.scopeData = scope;
          }
        } else if (scope !== undefined && scope !== null) {
          node.scopeData = scope;
        }
      }

      // Validation checks and Button disabled state (CR-N6 / CR-4: failed check sets disabled: true on Button; extracts first failed check message as validationError on input fields, does not disable input)
      let disabled = false;
      if (comp.disabled !== undefined) {
        disabled = toBool(resolveValue(comp.disabled, dataModel, scope));
      }
      const rawChecks = comp['@checks'] !== undefined ? comp['@checks'] : comp.checks;
      if (rawChecks && Array.isArray(rawChecks)) {
        const resolvedChecks = resolveDeep(rawChecks, dataModel, scope);
        node.checks = resolvedChecks;
        const failedCheck = resolvedChecks.find((c) => !toBool(c.condition));
        if (failedCheck) {
          node.validationError = (failedCheck.message !== undefined && failedCheck.message !== null && failedCheck.message !== '')
            ? failedCheck.message
            : 'Validation failed';
          // Only Button is disabled on failed check; input fields allow editing to fix validation
          if (comp.component === 'Button') {
            disabled = true;
          }
        }
      }
      if (disabled) {
        node.disabled = true;
      }

      // ================= Child Recursion & ChildList Template Expansion =================

      // Case A: Static array children ["id1", "id2"]
      if (Array.isArray(comp.children)) {
        for (const childId of comp.children) {
          const childNode = buildNode(childId, depth + 1, scope, instanceSuffix, nextAncestors);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      }
      // Case B: Single child "id1"
      else if (comp.child) {
        const childNode = buildNode(comp.child, depth + 1, scope, instanceSuffix, nextAncestors);
        if (childNode) {
          node.children.push(childNode);
        }
      }
      // Case C: Dynamic list template object {"@path": "/restaurants", "componentId": "restaurant_card"}
      else if (comp.children && typeof comp.children === 'object' && (comp.children.componentId || comp.children['@componentId'])) {
        const listPath = comp.children['@path'] !== undefined ? comp.children['@path'] : comp.children.path;
        const templateCompId = comp.children['@componentId'] !== undefined ? comp.children['@componentId'] : comp.children.componentId;
        const listSegs = resolveSegs(listPath, scope);
        const listData = getIn(dataModel, listSegs);

        if (Array.isArray(listData)) {
          listData.forEach((item, index) => {
            const itemScope = {
              base: listSegs.concat(String(index)),
              index,
              data: item,
              parent: scope,
            };
            // Security isolation: do not Object.assign(itemScope, item), prevents overwriting engine scope (CR-1)

            // Unique collision-resistant instance ID suffix (CR-N4 / OPT-2)
            const scopeId = Array.isArray(itemScope.base)
              ? itemScope.base.map((s) => String(s).replace(/:/g, '~c')).join(':')
              : String(index);
            const childSuffix = instanceSuffix
              ? (scopeId.startsWith(instanceSuffix) ? scopeId : `${instanceSuffix}_${scopeId}`)
              : scopeId;

            const childNode = buildNode(templateCompId, depth + 1, itemScope, childSuffix, nextAncestors);
            if (childNode) {
              node.children.push(childNode);
            }
          });
        }
      }

      // Case D: Tabs container resolution (keeps children aligned with tabs indices, CR-N7)
      if (Array.isArray(comp.tabs)) {
        node.tabs = comp.tabs.map((tab, tIdx) => {
          const tabTitle = resolveValue(tab.title, dataModel, scope) || `Tab ${tIdx + 1}`;
          let contentNode = null;
          if (tab.child) {
            contentNode = buildNode(tab.child, depth + 1, scope, `${instanceSuffix}_tab_${tIdx}`, nextAncestors);
          }
          // Placeholder node for missing child to maintain index alignment (CR-N7)
          const finalTabNode = contentNode || {
            id: `${tab.child || 'empty'}_tab_${tIdx}`,
            component: 'View',
            children: [],
            text: '',
          };
          node.children.push(finalTabNode);
          return {
            title: tabTitle,
            childId: tab.child,
            childIndex: tIdx,
          };
        });
        node.activeTab = comp.activeTab || 0;
      }

      // Case E: Modal trigger and content resolution (CR-15: named field storage)
      if (comp.component === 'Modal' || comp.trigger || comp.content) {
        if (comp.trigger) {
          const trigNode = buildNode(comp.trigger, depth + 1, scope, `${instanceSuffix}_modal_trig`, nextAncestors);
          if (trigNode) {
            node.triggerNode = trigNode;
            node.children.push(trigNode);
          }
        }
        if (comp.content) {
          const cntNode = buildNode(comp.content, depth + 1, scope, `${instanceSuffix}_modal_cnt`, nextAncestors);
          if (cntNode) {
            node.contentNode = cntNode;
            // Push contentNode to children[1] only if triggerNode exists to prevent misaligned indices:
            if (node.triggerNode) {
              node.children.push(cntNode);
            }
          }
        }
      }

      // Row flex layout optimization:
      // 1. When Row specifies spaceBetween, center, end, spaceAround, spaceEvenly and children lack explicit weight,
      //    children should maintain content-adaptive width (flex: 0 0 auto) rather than forced flex: 1 1 0%,
      //    allowing free space to distribute properly along the main axis.
      // 2. When Row is default (start or unspecified) and children lack explicit weight, if a child contains Column,
      //    Column should fill available space (width: 100% per spec), keeping fixed headers and right-hand endpoints at opposite ends.
      if (comp.component === 'Row' && node.children && node.children.length > 0) {
        const isDistributed = ['spaceBetween', 'center', 'end', 'spaceAround', 'spaceEvenly'].includes(node.justify);
        const hasWeightedChild = node.children.some((c) => c.weight !== undefined);
        if (isDistributed && !hasWeightedChild) {
          node.children.forEach((c) => {
            if (c.weight === undefined) {
              c.flexStyle = 'flex: 0 0 auto;';
            }
          });
        } else if (!isDistributed) {
          node.children.forEach((c) => {
            if (c.component === 'Column' && c.weight === undefined) {
              c.flexStyle = 'flex: 1 1 0%; min-width: 0;';
            }
          });
        }
      }

      return node;
    };

    const rootNode = buildNode('root', 0, null, '', new Set());
    if (rootNode && surface.theme) {
      rootNode.theme = surface.theme;
    }
    return rootNode;
  }

  /**
   * Creates standard A2UI v1.0 client event structure (Renderer-to-Agent, CR-C1)
   */
  createActionMessage(surfaceId, instanceId) {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return null;

    let inst = surface.instances.get(instanceId);
    let comp = inst ? inst.comp : surface.components.get(instanceId);
    if (!comp && typeof instanceId === 'string') {
      let longestMatch = '';
      for (const [id, c] of surface.components) {
        if (instanceId.startsWith(id + '_') && id.length > longestMatch.length) {
          longestMatch = id;
          comp = c;
        }
      }
    }
    if (!comp || !comp.action) return null;

    const actionDef = comp.action;
    const eventDef = actionDef.event || actionDef;
    const eventName = eventDef.name || 'click';
    const rawContext = eventDef.context || {};
    const scope = inst ? inst.scope : null;

    const resolvedContext = resolveDeep(rawContext, surface.dataModel, scope);

    const action = {
      name: eventName,
      surfaceId,
      sourceComponentId: comp.id,
      timestamp: new Date().toISOString(),
      context: resolvedContext,
    };

    if (eventDef.userMessage != null) {
      action.userMessage = resolveValue(eventDef.userMessage, surface.dataModel, scope);
    }

    if (surface.sendDataModel && surface.dataModel !== undefined) {
      // Deep copy isolated data model snapshot to prevent async mutations (CR-13)
      action.dataModel = JSON.parse(JSON.stringify(surface.dataModel));
    }

    if (comp['@catalogId'] !== undefined || comp.catalogId !== undefined) {
      action.catalogId = comp['@catalogId'] !== undefined ? comp['@catalogId'] : comp.catalogId;
    }

    return this.wrapOutbound('action', action);
  }

  /**
   * Backward compatible invocation entry
   */
  createEventMessage(surfaceId, eventName, rawContext = {}, scope = null) {
    const surface = this.surfaces.get(surfaceId);
    const dataModel = surface ? surface.dataModel : {};
    const context = resolveDeep(rawContext, dataModel, scope);

    const action = {
      name: eventName,
      surfaceId,
      sourceComponentId: 'unknown',
      timestamp: new Date().toISOString(),
      context,
    };
    if (surface && surface.sendDataModel && surface.dataModel !== undefined) {
      // Deep copy isolated data model snapshot to prevent async mutations (CR-13)
      action.dataModel = JSON.parse(JSON.stringify(surface.dataModel));
    }

    return this.wrapOutbound('action', action);
  }

  /**
   * Write client input back to local DataModel
   */
  updateLocalValue(surfaceId, path, value) {
    return this.processMessage({
      version: 'v1.0',
      updateDataModel: {
        surfaceId,
        path,
        value,
      },
    });
  }

  /**
   * Client input change and trigger listener notification (CR-H1)
   * Supports options.silent to control whether full listener notification is triggered
   */
  handleInputChange(surfaceId, path, value, options = {}) {
    const res = this.updateLocalValue(surfaceId, path, value);
    if (res && !options.silent) {
      this.notify(surfaceId);
    }
    return res;
  }

  /**
   * Compute render tree differential patch set (targeted refresh, prevents cursor jump)
   */
  computeTreePatches(oldTree, newTree, rootPrefix = 'localRenderTree', options = {}) {
    return computeTreePatches(oldTree, newTree, rootPrefix, options);
  }

  /**
   * Dispatch Action message to outbound listener
   */
  dispatchAction(surfaceId, instanceId) {
    const msg = this.createActionMessage(surfaceId, instanceId);
    if (msg) {
      this.dispatchOutbound(msg);
    }
    return msg;
  }

  /**
   * Clear all engine surface states (OPT-1)
   */
  clear() {
    this._rejectPendingCalls(ErrorCodes.CANCELLED);
    this.surfaces.clear();
  }

  /**
   * Destroy engine instance and release all listeners and internal states
   */
  destroy() {
    this._isDestroyed = true;
    this._rejectPendingCalls(ErrorCodes.DISPOSED);
    this.surfaces.clear();
    this.listeners.clear();
    this.outboundListeners.clear();
    this.errorListeners.clear();
    this.rendererFunctions.clear();
    this.customComponents.clear();
    this.catalogs.clear();
    this._storage.clear();
  }
}

module.exports = {
  A2UIEngine,
  A2UIError,
  A2UI_VERSION,
  A2UI_MIME_TYPE,
  ErrorCodes,
  KNOWN_COMPONENTS,
  createRendererCapabilities,
  toPropertyPath,
  computeTreePatches,
};
