/**
 * A2UI Engine for WeChat MiniProgram
 * 协议解析引擎与高保真状态机 (A2UI v1.0 规范)
 * 具备原型链安全防护、循环引用深度拦截、作用域路径追踪、标准 Action 消息上报、模板轻量化
 */

const { resolveValue, resolveDeep, toBool, openUrl, createRendererCapabilities } = require('./data-model');
const { parsePointer, toPointer, getIn, setIn, resolveSegs, toPropertyPath, computeTreePatches } = require('./pointer');
const { hasMarkdown, parseMarkdown } = require('./markdown');

const MAX_DEPTH = 32;
const MAX_TOTAL_NODES = 5000;

/**
 * A2UI 标准结构化错误规范码 (renderer_to_agent.json#/$defs/error)
 */
const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_COMPONENT: 'UNKNOWN_COMPONENT',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  UNALLOWED_PARENT: 'UNALLOWED_PARENT',
  UNALLOWED_CHILD: 'UNALLOWED_CHILD',
};

/**
 * Basic Catalog 官方已知组件集合
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
  constructor() {
    this.surfaces = new Map();
    this.listeners = new Set();
    this.outboundListeners = new Set();
    this.errorListeners = new Set();
    this.rendererFunctions = new Map();
    this.customComponents = new Set();
    this._storage = new Map();
    this._clipboard = '';
    this._lastVibrate = null;
    this.registerBuiltinRendererFunctions();
  }

  /**
   * 注册内置端侧特权函数（支持小程序安全环境与 Node 仿真）
   */
  registerBuiltinRendererFunctions() {
    // 1. getSystemInfo: 返回设备型号、操作系统、屏幕宽高等系统指标
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

    // 2. setClipboard: 将内容写入剪贴板
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

    // 3. vibrate / hapticFeedback: 触发震动反馈
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

    // 4. getStorage / setStorage: 本地存储读写
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
   * 注册自定义端侧函数
   */
  registerRendererFunction(name, handler) {
    this.rendererFunctions.set(name, handler);
  }

  /**
   * 注册允许的自定义组件类型
   */
  registerComponent(name) {
    this.customComponents.add(name);
  }

  registerCustomComponent(name) {
    this.registerComponent(name);
  }

  /**
   * 注册出站消息监听器（Action, rendererFunctionResponse, error 等）
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
    if (this.outboundListener) {
      try {
        this.outboundListener(msg);
      } catch (e) {
        console.error('[A2UI] outboundListener error:', e);
      }
    }
    for (const listener of this.outboundListeners) {
      try {
        listener(msg);
      } catch (e) {
        console.error('[A2UI] outbound listener error:', e);
      }
    }
  }

  /**
   * 产生标准结构化 error 协议消息 (renderer_to_agent.json#/$defs/error)
   */
  createErrorMessage(surfaceId, code, path, message) {
    const errorObj = {
      code: code || ErrorCodes.EXECUTION_ERROR,
      surfaceId: surfaceId || 'unknown',
      path: path !== undefined && path !== null ? String(path) : '/',
      message: message ? String(message) : '',
    };
    return {
      version: 'v1.0',
      error: errorObj,
    };
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
   * 构造符合 renderer_to_agent.json#/$defs/rendererFunctionResponse 规范的标准响应报文
   */
  createRendererFunctionResponse(functionCallId, result, error = null) {
    if (error) {
      return {
        version: 'v1.0',
        rendererFunctionResponse: {
          functionCallId,
          error: typeof error === 'string' ? { code: ErrorCodes.EXECUTION_ERROR, message: error } : error,
        },
      };
    }
    return {
      version: 'v1.0',
      rendererFunctionResponse: {
        functionCallId,
        response: result,
        value: result,
      },
    };
  }

  /**
   * 执行端侧函数调用 (Agent -> Client RPC)
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
   * 注册渲染树更新监听器
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
   * 处理单条或多条 A2UI 消息流
   */
  process(messages) {
    const msgs = Array.isArray(messages) ? messages : [messages];
    const affectedSurfaces = new Set();
    const responses = [];

    for (const msg of msgs) {
      if (msg && msg.callRendererFunction) {
        const resp = this.executeRendererFunction(msg.callRendererFunction);
        if (resp) responses.push(resp);
      } else {
        const res = this.processMessage(msg);
        if (typeof res === 'string') {
          affectedSurfaces.add(res);
        } else if (res && res.rendererFunctionResponse) {
          responses.push(res);
        }
      }
    }

    // 批量通知所有受影响的 surface (CR-M4)
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

    try {
      // 0. callRendererFunction
      if (msg.callRendererFunction) {
        return this.executeRendererFunction(msg.callRendererFunction);
      }

      // 1. createSurface
      if (msg.createSurface) {
        const { surfaceId, catalogId, components, dataModel, sendDataModel, theme } = msg.createSurface;
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

        // 支持 createSurface 自带的 components 和 dataModel (CR-H4)
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
          components.forEach((comp, idx) => {
            if (!comp || typeof comp !== 'object') {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component must be an object');
              return;
            }
            if (!comp.id) {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component missing id');
              return;
            }
            if (comp.component && !KNOWN_COMPONENTS.has(comp.component) && !this.customComponents.has(comp.component)) {
              const errKey = `${comp.id}:${comp.component}`;
              if (!surface.reportedUnknown.has(errKey)) {
                surface.reportedUnknown.add(errKey);
                this.emitError(surfaceId, ErrorCodes.UNKNOWN_COMPONENT, `/components/${comp.id}/component`, `Unknown component: ${comp.component}`);
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
      if (msg.updateComponents) {
        const { surfaceId, components } = msg.updateComponents;
        const surface = this.surfaces.get(surfaceId);
        if (!surface) {
          this.emitError(surfaceId || 'unknown', ErrorCodes.VALIDATION_FAILED, '/', `Surface '${surfaceId}' not found`);
          return null;
        }
        if (!surface.reportedUnknown) {
          surface.reportedUnknown = new Set();
        }

        if (Array.isArray(components)) {
          components.forEach((comp, idx) => {
            if (!comp || typeof comp !== 'object') {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component must be an object');
              return;
            }
            if (!comp.id) {
              this.emitError(surfaceId, ErrorCodes.VALIDATION_FAILED, `/components/${idx}`, 'Component missing id');
              return;
            }
            if (comp.component && !KNOWN_COMPONENTS.has(comp.component) && !this.customComponents.has(comp.component)) {
              const errKey = `${comp.id}:${comp.component}`;
              if (!surface.reportedUnknown.has(errKey)) {
                surface.reportedUnknown.add(errKey);
                this.emitError(surfaceId, ErrorCodes.UNKNOWN_COMPONENT, `/components/${comp.id}/component`, `Unknown component: ${comp.component}`);
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
      if (msg.updateDataModel) {
        const { surfaceId, path, value } = msg.updateDataModel;
        const surface = this.surfaces.get(surfaceId);
        if (!surface) {
          this.emitError(surfaceId || 'unknown', ErrorCodes.VALIDATION_FAILED, '/', `Surface '${surfaceId}' not found`);
          return null;
        }

        const segs = parsePointer(path || '/');
        try {
          surface.dataModel = setIn(surface.dataModel, segs, value);
        } catch (err) {
          console.error(`[A2UI] updateDataModel error on path '${path}':`, err);
          this.emitError(surfaceId, ErrorCodes.EXECUTION_ERROR, path || '/', err.message || String(err));
        }
        return surfaceId;
      }

      // 4. deleteSurface
      if (msg.deleteSurface) {
        const surfaceId = typeof msg.deleteSurface === 'string'
          ? msg.deleteSurface
          : (msg.deleteSurface.surfaceId || null);
        if (surfaceId) {
          this.surfaces.delete(surfaceId);
        }
        return surfaceId;
      }

      return null;
    } catch (err) {
      const sId = (msg.createSurface?.surfaceId || msg.updateComponents?.surfaceId || msg.updateDataModel?.surfaceId || msg.deleteSurface?.surfaceId || msg.callRendererFunction?.surfaceId) || 'unknown';
      this.emitError(sId, ErrorCodes.EXECUTION_ERROR, '/', err.message || String(err));
      return null;
    }
  }

  /**
   * 递归组装微信小程序模板层所需的高保真渲染树 (Render Tree)
   */
  getRenderTree(surfaceId) {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return null;

    // 严格规范：未收到 root 组件之前只缓存，不提前渲染残破树 (CR-H4)
    if (!surface.components.has('root')) {
      return null;
    }

    // 清空实例注册表，重新构建
    surface.instances = new Map();
    const dataModel = surface.dataModel;
    let nodeCount = 0;

    const buildNode = (componentId, depth = 0, scope = null, instanceSuffix = '', ancestors = new Set()) => {
      if (!componentId) return null;

      // 总节点数防爆上限 (CR-N3: 防范 DAG 指数爆炸)
      if (nodeCount >= MAX_TOTAL_NODES) {
        return null;
      }

      // 深度上限与基于 (componentId @ 作用域数据路径) 的祖先防环 (CR-N2: 允许合法递归数据如评论树，精准拦截真循环)
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

      // 登记实例以支持精确 Action 上报与双向寻址 (CR-C1)
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

      // 提取 weight 与 ownWidth 弹性布局属性 (对齐官方 A2UI 规范: weight 映射为 flex-grow，未指定则为自适应宽度 flex: 0 0 auto)
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

      // 动态求解文本与常见属性 (传入 scope 支持相对路径)
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

      // 判定并打标业务自定义扩展组件 (Micro-level Generics 机制)
      const isCustomComponent = this.customComponents.has(comp.component) || !KNOWN_COMPONENTS.has(comp.component);
      if (isCustomComponent && comp.component !== 'Surface' && comp.component !== 'View') {
        node.isCustom = true;
        node.props = {};

        // 引擎保留字，避免污染基础骨架结构
        const ENGINE_RESERVED = new Set([
          'id', 'component', 'variant', 'align', 'justify', 'fit', 'weight',
          'children', 'child', 'tabs', 'trigger', 'content', 'action', 'checks', 'disabled'
        ]);

        for (const [propKey, propVal] of Object.entries(comp)) {
          if (!ENGINE_RESERVED.has(propKey)) {
            const resolvedVal = resolveDeep(propVal, dataModel, scope);
            node.props[propKey] = resolvedVal;
            // 平铺到 node 顶层，极大简化宿主 WXML 模板的数据绑定取值
            if (node[propKey] === undefined) {
              node[propKey] = resolvedVal;
            }
          }
        }
      }

      // Markdown 标题轻量解析 (对齐官方 Flutter: 未指定 variant 时走 Markdown 转换)
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

        // 富文本 Markdown 检测与渲染 (CR规范)
        if (hasMarkdown(node.text)) {
          node.richHtml = parseMarkdown(node.text);
        }
      }

      // Button 缺省变体对齐官方规范: OutlinedButton (描边按钮)
      if (node.component === 'Button' && !node.variant) {
        node.variant = 'outlined';
      }

      // Icon 图标符号增强映射 (对标官方 Basic Catalog 图标体系)
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

      // value 与 valuePath 寻址 (CR-H1: 计算绝对 JSON Pointer，支持双向反写)
      if (comp.value !== undefined) {
        node.value = resolveValue(comp.value, dataModel, scope);
        if (comp.value && typeof comp.value === 'object' && '@path' in comp.value) {
          const segs = resolveSegs(comp.value['@path'], scope);
          node.valuePath = toPointer(segs);
        }
      }
      if (comp.valuePath) {
        const segs = resolveSegs(comp.valuePath, scope);
        node.valuePath = toPointer(segs);
      }

      // CheckBox 特有 (规范中 CheckBox 状态对应 value 或 checked)
      if (comp.checked !== undefined) {
        node.checked = Boolean(resolveValue(comp.checked, dataModel, scope));
      } else if (comp.component === 'CheckBox' && node.value !== undefined) {
        node.checked = Boolean(node.value);
      }

      // Slider 特有 (规范为 steps，兼容 step)
      if (comp.min !== undefined) node.min = Number(resolveValue(comp.min, dataModel, scope)) || 0;
      if (comp.max !== undefined) node.max = Number(resolveValue(comp.max, dataModel, scope)) || 100;
      const stepVal = comp.steps !== undefined ? comp.steps : comp.step;
      if (stepVal !== undefined) node.step = Number(resolveValue(stepVal, dataModel, scope)) || 1;

      // ChoicePicker / Select 特有
      if (comp.options !== undefined) {
        node.options = resolveDeep(comp.options, dataModel, scope);
      }
      if (comp.component === 'ChoicePicker' && Array.isArray(node.options)) {
        // 官方 v1.0 规范 (catalogs/basic): variant = "multipleSelection" | "mutuallyExclusive"
        // 兼容保留: comp.mutuallyExclusive (boolean)
        const isMulti = comp.variant === 'multipleSelection' || comp.mutuallyExclusive === false;
        node.mutuallyExclusive = !isMulti;
        node.variant = isMulti ? 'multipleSelection' : 'mutuallyExclusive';
        // 官方 v1.0: displayStyle = "checkbox" | "chips" | "picker"
        node.displayStyle = comp.displayStyle || (isMulti ? 'checkbox' : 'picker');

        // 规范化 options 项为统一的 { label, value } 格式 (兼容字符串/数字列表与对象列表)
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
          node.displayLabel = targetVal !== undefined && targetVal !== null && targetVal !== '' ? String(targetVal) : '请点击选择';
        }
        // ChoicePicker 规范统一保持数组结构 (L1)
        node.isChoiceArray = true;
      }

      // DateTimeInput 特有 (CR-C5 & M5: 完整支持 enableDate 与 enableTime 及 ISO 格式换算为本地时间展示)
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
            // 换算为客户端本地时区展示 (M5)
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

      // Action 动作绑定 (仅存轻量数据，不存 parent 链，规避体积膨胀，CR-N7 / CR-14)
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

      // 校验规则与 Button 禁用状态 (CR-N6 / CR-4: 校验失败仅在 Button 上置 disabled: true；在 TextField 等输入组件上提取首个失败 check 的 message 为 validationError，不置 disabled)
      let disabled = false;
      if (comp.disabled !== undefined) {
        disabled = Boolean(resolveValue(comp.disabled, dataModel, scope));
      }
      if (comp.checks && Array.isArray(comp.checks)) {
        const resolvedChecks = resolveDeep(comp.checks, dataModel, scope);
        node.checks = resolvedChecks;
        const failedCheck = resolvedChecks.find((c) => !toBool(c.condition));
        if (failedCheck) {
          node.validationError = (failedCheck.message !== undefined && failedCheck.message !== null && failedCheck.message !== '')
            ? failedCheck.message
            : '输入校验未通过';
          // 仅 Button 会因 check 失败被置为 disabled；输入框需允许用户继续输入以修复校验
          if (comp.component === 'Button') {
            disabled = true;
          }
        }
      }
      if (disabled) {
        node.disabled = true;
      }

      // ================= 子节点递归与 ChildList 模板展开 =================

      // 情况 A: 静态数组子节点 ["id1", "id2"]
      if (Array.isArray(comp.children)) {
        for (const childId of comp.children) {
          const childNode = buildNode(childId, depth + 1, scope, instanceSuffix, nextAncestors);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      }
      // 情况 B: 单一子节点 child: "id1"
      else if (comp.child) {
        const childNode = buildNode(comp.child, depth + 1, scope, instanceSuffix, nextAncestors);
        if (childNode) {
          node.children.push(childNode);
        }
      }
      // 情况 C: 动态列表模板对象 {"path": "/restaurants", "componentId": "restaurant_card"}
      else if (comp.children && typeof comp.children === 'object' && comp.children.componentId) {
        const listPath = comp.children.path;
        const templateCompId = comp.children.componentId;
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
            // 安全隔离：严禁 Object.assign(itemScope, item)，防止 item 中的 base/data/index/parent 属性覆写引擎内部作用域 (CR-1)

            // 唯一且抗碰撞的实例 ID 后缀 (CR-N4 / OPT-2: 避免多层列表前缀重复)
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

      // 情况 D: Tabs 容器解析 (保留 children 与 tabs 索引对齐，CR-N7)
      if (Array.isArray(comp.tabs)) {
        node.tabs = comp.tabs.map((tab, tIdx) => {
          const tabTitle = resolveValue(tab.title, dataModel, scope) || `Tab ${tIdx + 1}`;
          let contentNode = null;
          if (tab.child) {
            contentNode = buildNode(tab.child, depth + 1, scope, `${instanceSuffix}_tab_${tIdx}`, nextAncestors);
          }
          // 缺失子组件时用空节点占位，保持索引对齐，防止下标错位与崩溃 (CR-N7)
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

      // 情况 E: Modal 触发器与内容解析 (CR-15: 具名字段存储，防止缺 trigger 时 content 顺位成为 children[0] 错位)
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
            // 防止缺少 trigger 时 content 顺位成为 children[0] 导致视图错位：
            // 仅在存在 triggerNode 时才将 contentNode 推入 children[1]
            if (node.triggerNode) {
              node.children.push(cntNode);
            }
          }
        }
      }

      // Row 弹性布局优化：
      // 1. 当 Row 指定了 spaceBetween, center, end, spaceAround, spaceEvenly 等主轴对齐方式，且其子项未显式声明 weight 权重时，
      //    子项不能被强行赋予 flex: 1 1 0% 均分撑满（否则会导致 free space 为 0，使得 spaceBetween 等主轴分布彻底失效，右侧内容卡在正中间）。
      //    此时未显式指定 weight 的子节点应维持内容自适应宽度 flex: 0 0 auto，使主轴空间能够正确在子项之间分布。
      // 2. 当 Row 处于常规主轴对齐 (start 或未指定) 且未显式指定各子项 weight 时，如果子项包含 Column 容器，
      //    Column 应当作为主内容容器自动撑满剩余可用空间 (对标官方 Column width: 100%，如 18_track-list / 11_purchase-complete / 26_podcast-episode)，
      //    从而使固定宽度的标号、封面缩略图与右侧端点元素 (如时长、操作按钮) 正确分居两端。
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
   * 创建标准 A2UI v1.0 客户端触发事件结构（Renderer-to-Agent，CR-C1）
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
      // 深拷贝隔离数据模型快照，防止异步传输或后续原地修改污染快照 (CR-13)
      action.dataModel = JSON.parse(JSON.stringify(surface.dataModel));
    }

    const legacyEvent = Object.assign({}, action);
    action.event = legacyEvent;

    return {
      version: 'v1.0',
      action,
      event: legacyEvent,
    };
  }

  /**
   * 兼容旧版调用入口
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
      // 深拷贝隔离数据模型快照，防止异步传输或后续原地修改污染快照 (CR-13)
      action.dataModel = JSON.parse(JSON.stringify(surface.dataModel));
    }

    const legacyEvent = Object.assign({}, action);
    action.event = legacyEvent;

    return {
      version: 'v1.0',
      action,
      event: legacyEvent,
    };
  }

  /**
   * 客户端输入反写本地 DataModel
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
   * 客户端输入变更并触发监听通知 (CR-H1)
   * 支持 options.silent 控制是否触发全量监听通知
   */
  handleInputChange(surfaceId, path, value, options = {}) {
    const res = this.updateLocalValue(surfaceId, path, value);
    if (res && !options.silent) {
      this.notify(surfaceId);
    }
    return res;
  }

  /**
   * 计算渲染树差量补丁集（定向刷新，规避受控输入框光标跳动）
   */
  computeTreePatches(oldTree, newTree, rootPrefix = 'localRenderTree', options = {}) {
    return computeTreePatches(oldTree, newTree, rootPrefix, options);
  }

  /**
   * 派发 Action 动作消息至出站监听器
   */
  dispatchAction(surfaceId, instanceId) {
    const msg = this.createActionMessage(surfaceId, instanceId);
    if (msg) {
      this.dispatchOutbound(msg);
    }
    return msg;
  }

  /**
   * 清空引擎所有画布状态 (OPT-1)
   */
  clear() {
    this.surfaces.clear();
  }

  /**
   * 彻底销毁引擎实例并释放所有监听器与内部状态
   */
  destroy() {
    this.surfaces.clear();
    this.listeners.clear();
    this.outboundListeners.clear();
    this.errorListeners.clear();
    this.rendererFunctions.clear();
    this.customComponents.clear();
    this._storage.clear();
  }
}

module.exports = {
  A2UIEngine,
  ErrorCodes,
  KNOWN_COMPONENTS,
  createRendererCapabilities,
  toPropertyPath,
  computeTreePatches,
};
